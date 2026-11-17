import express from 'express';
import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright';
import { settings } from '../../../config/settings.js';
import db from '../../database/db.js';
import openaiClient from '../../ai/openai-client.js';
import memoryManager from './memory-manager.js';
import qualification from './qualification.js';
import transbordo from './transbordo.js';
import { runGmnPipeline } from '../3-miner-gmn/index.js';
import { runOutboundPipeline } from '../2-outbound-instagram/index.js';
import waChecker from '../3-miner-gmn/wa-checker.js';
import whatsappClient, {
  initNativeWhatsApp,
  getNativeStatus,
  getNativeQrCode,
  disconnectNativeWhatsApp
} from '../../integrations/whatsapp-client.js';
import whatsappDispatcher from '../3-miner-gmn/whatsapp-dispatcher.js';

const app = express();

// Servir arquivos estáticos da pasta public/ (Dashboard Web Local)
const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use(express.static(publicDir));

// Middlewares essenciais
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * Middleware de Validação de Segurança do Webhook
 */
function validateWebhookSecret(req, res, next) {
  const secretFromHeader = req.headers['x-webhook-secret'] || req.headers['x-api-key'];
  const secretFromQuery = req.query.secret;
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const providedSecret = secretFromHeader || secretFromQuery || bearerToken;
  const configuredSecret = settings.server.webhookSecret;

  if (!configuredSecret || configuredSecret === 'default_secret' || providedSecret === configuredSecret) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Acesso não autorizado: WEBHOOK_SECRET inválido ou ausente.'
  });
}

/**
 * Rota de Healthcheck do Servidor
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'legado-sdr-inbound',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: settings.server.nodeEnv
  });
});

/**
 * Rota Principal: Receptor de Webhook do ManyChat / Direct Oficial
 */
app.post(['/api/inbound/webhook', '/webhook/manychat'], validateWebhookSecret, async (req, res) => {
  const startTime = Date.now();
  let lead = null;
  const body = req.body || {};

  try {
    // 1. Extração flexível dos dados enviados pelo ManyChat
    const rawIdentifier = body.instagram_username || body.ig_username || body.user_id || body.subscriber_id || body.phone || body.contact?.handle || body.contact?.id || body.contact?.username;
    let userMessage = body.message || body.last_input_text || body.text || body.content || '';
    const userName = body.name || [body.first_name, body.last_name].filter(Boolean).join(' ') || body.contact?.name || null;
    const userPhone = body.phone || body.contact?.phone || null;

    if (!rawIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'Identificador do usuário ausente no payload (necessário instagram_username, user_id ou phone).'
      });
    }

    // Detecção e suporte a Gatilhos de Primeira Interação (Stories, Reels e Comentários)
    const isStoryTrigger = body.event === 'story_reply' || body.event === 'story_reaction' || 
      body.trigger === 'story_reaction' || body.story_reply || Boolean(body.reaction);

    const isCommentTrigger = body.event === 'comment' || body.event === 'post_comment' || 
      body.event === 'reel_comment' || body.trigger === 'comment' || Boolean(body.comment) || Boolean(body.comment_text);

    if (isStoryTrigger) {
      const emoji = body.reaction || body.story_reply || '🔥';
      const storyContext = `[Reagiu ao seu Story no Instagram com ${emoji}]`;
      userMessage = userMessage ? `${storyContext} - Mensagem: "${userMessage}"` : storyContext;
      appendLog('inbound', `Gatilho de Story recebido de @${rawIdentifier} (${emoji})`, 'info');
    } else if (isCommentTrigger) {
      const commentContent = body.comment || body.comment_text || userMessage || 'Interesse manifestado';
      const commentContext = `[Comentou na sua publicação/Reel do Instagram: "${commentContent}"]`;
      userMessage = (userMessage && userMessage !== commentContent) ? `${commentContext} - Mensagem: "${userMessage}"` : commentContext;
      appendLog('inbound', `Gatilho de Comentário recebido de @${rawIdentifier}: "${commentContent}"`, 'info');
    }

    // Normaliza identificador: se for usuário de Instagram, garante prefixo '@'
    const identifier = String(rawIdentifier).trim().startsWith('@') || !isNaN(rawIdentifier)
      ? String(rawIdentifier).trim()
      : `@${String(rawIdentifier).trim()}`;

    // 2. Resgata ou cria o Lead no banco SQLite WAL
    lead = memoryManager.getOrCreateLead(identifier, {
      source: 'inbound_official',
      name: userName,
      phone: userPhone
    });

    // 3. Grava imediatamente a mensagem do usuário na memória contínua
    if (userMessage) {
      db.addConversationMessage(lead.id, 'user', userMessage);
    }

    // 4. Resgata histórico completo para manter contexto com a IA
    const history = memoryManager.getConversationHistory(lead.id, 15);

    // 5. Processamento Cognitivo via OpenAI (GPT-4o-mini com prompt Amanda SDR)
    const aiResult = await openaiClient.processInboundConversation(history, lead);

    // 6. Grava a resposta da IA na memória do banco
    if (aiResult.reply_message) {
      db.addConversationMessage(lead.id, 'assistant', aiResult.reply_message);
    }

    // 7. Atualiza a ficha e status de qualificação do lead
    const updatedLead = qualification.evaluateAndSaveLead(
      lead.id,
      aiResult.extracted_data,
      aiResult.status
    );

    // 8. Se atingiu o ICP ('qualified'), executa o transbordo duplo imediato (WhatsApp Baileys + CRM)
    let transbordoResult = null;
    if (updatedLead.status === 'qualified') {
      transbordoResult = await transbordo.executeTransbordo(updatedLead);
      appendLog('inbound', `🚨 Lead qualificado: @${updatedLead.identifier} -> Alerta WhatsApp enviado ao SDR e injetado no CRM.`, 'success');
    }

    const elapsedMs = Date.now() - startTime;

    // 9. Resposta estruturada retornada ao ManyChat para envio direto no chat
    return res.status(200).json({
      success: true,
      lead_id: updatedLead.id,
      reply_message: aiResult.reply_message,
      status: updatedLead.status,
      transbordo_executed: Boolean(transbordoResult?.transbordoExecuted),
      elapsed_ms: elapsedMs
    });

  } catch (error) {
    console.warn(`⚠️ [Inbound Webhook] Aviso na inferência de IA (${error.message}). Ativando resposta de contingência amigável.`);

    const fallbackReply = 'Perfeito! Poderia me informar qual é o nicho da sua empresa e a média de faturamento mensal para direcionarmos ao especialista correto?';

    // Grava a resposta de contingência na memória para manter o diálogo consistente
    if (lead?.id) {
      db.addConversationMessage(lead.id, 'assistant', fallbackReply);
    }

    return res.status(200).json({
      success: true,
      is_fallback: true,
      reply_message: fallbackReply,
      status: 'in_qualification',
      warning: error.message
    });
  }
});

// ==============================================================================
// ROTAS DA API DO DASHBOARD WEB LOCAL
// ==============================================================================

// Buffer de logs em memória para acompanhamento em tempo real
// Buffer de logs em memória para acompanhamento em tempo real
const runtimeLogs = [];
export function appendLog(moduleName, message, level = 'info') {
  const cleanMsg = String(message)
    .replace(/\x1B\[[0-9;]*[mK]/g, '')
    .trim();

  if (!cleanMsg) return;

  const entry = {
    id: Date.now() + Math.random(),
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    module: moduleName, // 'miner' | 'outbound' | 'system'
    level,              // 'info' | 'success' | 'warn' | 'error'
    message: cleanMsg
  };
  runtimeLogs.push(entry);
  if (runtimeLogs.length > 500) runtimeLogs.shift();
  return entry;
}

// Interceptação global de console para streaming em tempo real nos mini-consoles do Dashboard
const origConsoleLog = console.log;
const origConsoleWarn = console.warn;
const origConsoleError = console.error;

function routeConsoleToLog(level, args) {
  try {
    const raw = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    if (!raw || raw.startsWith('===') || raw.includes('ExperimentalWarning') || raw.includes('node:internal')) {
      return;
    }

    let moduleName = 'system';
    if (
      raw.includes('[MapsScraper]') ||
      raw.includes('[LeadExporter]') ||
      raw.includes('[WhatsAppChecker]') ||
      raw.includes('Google Maps') ||
      raw.includes('Google Meu Negócio') ||
      raw.includes('MINERAÇÃO') ||
      raw.includes('Dashboard Miner')
    ) {
      moduleName = 'miner';
    } else if (
      raw.includes('[TargetScraper]') ||
      raw.includes('[ProfileFilter]') ||
      raw.includes('[Messenger]') ||
      raw.includes('[AccountRotator]') ||
      raw.includes('Instagram') ||
      raw.includes('Cold DM') ||
      raw.includes('Outbound') ||
      raw.includes('Dashboard Outbound')
    ) {
      moduleName = 'outbound';
    }

    let logLvl = level;
    if (raw.includes('✅') || raw.includes('🎯') || raw.includes('APROVADO') || raw.includes('sucesso') || raw.includes('Concluído')) {
      logLvl = 'success';
    } else if (raw.includes('❌') || raw.includes('🚨') || raw.includes('Falha') || raw.includes('Erro')) {
      logLvl = 'error';
    } else if (raw.includes('⚠️') || raw.includes('Descarte') || raw.includes('REPROVADO') || raw.includes('Pulando')) {
      logLvl = 'warn';
    }

    appendLog(moduleName, raw, logLvl);
  } catch (_) {}
}

console.log = function(...args) {
  origConsoleLog.apply(console, args);
  routeConsoleToLog('info', args);
};

console.warn = function(...args) {
  origConsoleWarn.apply(console, args);
  routeConsoleToLog('warn', args);
};

console.error = function(...args) {
  origConsoleError.apply(console, args);
  routeConsoleToLog('error', args);
};

// Log inicial
appendLog('system', 'Servidor unificado ativo. Banco de dados SQLite WAL conectado.', 'success');

// Estado em memória das tarefas em background
let minerTaskState = {
  status: 'idle',
  query: null,
  limit: 0,
  startedAt: null,
  completedAt: null,
  lastResult: null,
  error: null
};

let outboundTaskState = {
  status: 'idle',
  target: null,
  limit: 0,
  startedAt: null,
  completedAt: null,
  lastResult: null,
  error: null
};

// ============================================================================
// SISTEMA DE AUTENTICAÇÃO DO PAINEL OPERACIONAL (ADMIN_PASSWORD)
// ============================================================================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || settings.server.adminPassword || 'legado123';
const activeAdminTokens = new Set();

function generateAdminToken() {
  const token = 'adm_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  activeAdminTokens.add(token);
  return token;
}

function checkAdminAuth(req) {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const customHeader = req.headers['x-admin-token'];
  const cookieHeader = req.headers['cookie'] || '';
  const cookieMatch = cookieHeader.match(/admin_token=([^;\s]+)/);
  const cookieToken = cookieMatch ? cookieMatch[1] : null;

  const token = bearerToken || customHeader || cookieToken;

  if (token && activeAdminTokens.has(token)) {
    return true;
  }
  // Permite token direto igual à senha para facilidade de integrações/CLI
  if (customHeader === ADMIN_PASSWORD || bearerToken === ADMIN_PASSWORD) {
    return true;
  }
  return false;
}

function requireDashboardAuth(req, res, next) {
  if (checkAdminAuth(req)) {
    return next();
  }
  return res.status(401).json({
    success: false,
    require_auth: true,
    error: 'Acesso restrito. Faça login com a senha de administrador.'
  });
}

/**
 * POST /api/auth/login
 * Autentica com ADMIN_PASSWORD
 */
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  const expectedPassword = process.env.ADMIN_PASSWORD || settings.server.adminPassword || 'legado123';

  if (password && String(password).trim() === expectedPassword) {
    const token = generateAdminToken();
    res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; SameSite=Lax; Max-Age=2592000`);
    appendLog('system', 'Login administrativo efetuado com sucesso no painel.', 'success');
    return res.status(200).json({ success: true, token });
  }

  appendLog('system', 'Tentativa de login administrativo com senha incorreta.', 'warn');
  return res.status(401).json({ success: false, error: 'Senha incorreta.' });
});

/**
 * GET /api/auth/verify
 * Verifica se a sessão do administrador continua ativa
 */
app.get('/api/auth/verify', (req, res) => {
  if (checkAdminAuth(req)) {
    return res.status(200).json({ success: true, authenticated: true });
  }
  return res.status(401).json({ success: false, authenticated: false });
});

/**
 * POST /api/auth/logout
 * Encerra sessão do painel
 */
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token) activeAdminTokens.delete(token);
  res.setHeader('Set-Cookie', 'admin_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  return res.status(200).json({ success: true });
});

// Proteção das rotas operacionais do painel (mantendo /api/inbound/webhook e /health públicos)
app.use('/api/dashboard', requireDashboardAuth);
app.use('/api/whatsapp', requireDashboardAuth);

/**
 * GET /api/dashboard/logs
 * Retorna os logs reais recentes do buffer de memória
 */
app.get('/api/dashboard/logs', (req, res) => {
  try {
    const { module, limit } = req.query;
    let logs = runtimeLogs;
    if (module && module !== 'all') {
      logs = runtimeLogs.filter(l => l.module === module);
    }
    const max = parseInt(limit || '60', 10);
    const sliced = logs.slice(-max);
    return res.status(200).json({ success: true, count: sliced.length, logs: sliced });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/dashboard/stats
 * Retorna contadores reais do banco de dados e estado das tarefas
 */
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const stats = db.getDashboardStats();
    return res.status(200).json({
      success: true,
      stats: {
        ...stats,
        miner: minerTaskState,
        outbound: outboundTaskState
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/dashboard/leads
 * Retorna a lista completa de leads do SQLite com suporte a filtros opcionais
 */
app.get('/api/dashboard/leads', (req, res) => {
  try {
    const { source, status } = req.query;
    const leads = db.getAllLeads({ source, status });
    return res.status(200).json({
      success: true,
      count: leads.length,
      leads
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/dashboard/leads/:id
 * Exclui um lead específico e seus históricos
 */
app.delete('/api/dashboard/leads/:id', (req, res) => {
  try {
    const success = db.deleteLead(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Lead não encontrado.' });
    }
    return res.status(200).json({ success: true, message: 'Lead excluído com sucesso.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/dashboard/leads
 * Limpa todos os leads e seus históricos de conversa
 */
app.delete('/api/dashboard/leads', (req, res) => {
  try {
    db.clearAllLeads();
    appendLog('system', 'Todos os leads e históricos foram removidos da base.', 'info');
    return res.status(200).json({ success: true, message: 'Todos os leads foram excluídos com sucesso.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/dashboard/leads/:id/history
 * Retorna a memória contínua de turnos (conversation_history) do lead para auditoria
 */
app.get('/api/dashboard/leads/:id/history', (req, res) => {
  try {
    const leadId = req.params.id;
    const lead = db.getLeadById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead não encontrado.' });
    }
    const history = db.getLeadHistory(leadId);
    return res.status(200).json({
      success: true,
      lead,
      history
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/dashboard/accounts
 * Lista todas as contas do Instagram cadastradas no SQLite e status da sessão
 */
app.get('/api/dashboard/accounts', (req, res) => {
  try {
    const accounts = db.getAllInstagramAccounts();
    const mapped = accounts.map(a => {
      const cleanUser = String(a.username).replace(/[^a-zA-Z0-9._-]/g, '_');
      const standardSession = path.join(settings.paths.sessionsDir, `${cleanUser}.json`);
      const legacySession = path.join(settings.paths.sessionsDir, `${cleanUser}_storage.json`);
      const hasSession = fs.existsSync(standardSession) || fs.existsSync(legacySession);
      const sentToday = db.getDailySentCount(a.username);

      return {
        id: a.id,
        username: a.username,
        role: a.role,
        proxy: a.proxy,
        daily_limit: a.daily_limit,
        status: hasSession ? (a.status === 'challenged' ? 'challenged' : 'active') : 'disconnected',
        has_session: hasSession,
        sent_today: sentToday,
        last_login_at: a.last_login_at
      };
    });

    return res.status(200).json({ success: true, count: mapped.length, accounts: mapped });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Helper para validar e persistir cookies/storageState de sessão para uma conta
 */
function saveSessionCookiesForAccount(account, { sessionid, storageState, cookies }) {
  const cleanUser = String(account.username).replace(/[^a-zA-Z0-9._-]/g, '_');
  const sessionPath = path.join(settings.paths.sessionsDir, `${cleanUser}.json`);

  let finalStorageState = null;

  // Caso 1: storageState JSON completo
  if (storageState) {
    if (typeof storageState === 'string') {
      try {
        const parsed = JSON.parse(storageState);
        if (parsed && (parsed.cookies || Array.isArray(parsed))) {
          finalStorageState = Array.isArray(parsed) ? { cookies: parsed, origins: [{ origin: 'https://www.instagram.com', localStorage: [] }] } : parsed;
        }
      } catch (_) {}
    } else if (typeof storageState === 'object' && storageState.cookies) {
      finalStorageState = storageState;
    }
  }

  // Caso 2: Array de cookies
  if (!finalStorageState && (Array.isArray(cookies) || Array.isArray(storageState))) {
    const cookieList = Array.isArray(cookies) ? cookies : storageState;
    finalStorageState = {
      cookies: cookieList.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain || '.instagram.com',
        path: c.path || '/',
        expires: c.expirationDate || c.expires || Math.floor(Date.now() / 1000) + 365 * 86400,
        httpOnly: Boolean(c.httpOnly),
        secure: Boolean(c.secure),
        sameSite: c.sameSite || 'None'
      })),
      origins: [{ origin: 'https://www.instagram.com', localStorage: [] }]
    };
  }

  // Caso 3: String de cookie ou sessionid isolado
  const rawInput = sessionid || (typeof storageState === 'string' ? storageState : '');
  if (!finalStorageState && rawInput) {
    let cleanSessionId = rawInput.trim();
    let cleanUserId = null;

    if (cleanSessionId.includes('sessionid=')) {
      const matchSession = cleanSessionId.match(/sessionid=([^;\s]+)/);
      if (matchSession) cleanSessionId = matchSession[1];
    }
    if (rawInput.includes('ds_user_id=')) {
      const matchUser = rawInput.match(/ds_user_id=([^;\s]+)/);
      if (matchUser) cleanUserId = matchUser[1];
    }

    cleanSessionId = cleanSessionId.replace(/^['"]|['"]$/g, '');

    if (cleanSessionId && cleanSessionId.length >= 10) {
      finalStorageState = {
        cookies: [
          {
            name: 'sessionid',
            value: cleanSessionId,
            domain: '.instagram.com',
            path: '/',
            expires: Math.floor(Date.now() / 1000) + 365 * 86400,
            httpOnly: true,
            secure: true,
            sameSite: 'None'
          },
          ...(cleanUserId ? [{
            name: 'ds_user_id',
            value: cleanUserId,
            domain: '.instagram.com',
            path: '/',
            expires: Math.floor(Date.now() / 1000) + 365 * 86400,
            httpOnly: false,
            secure: true,
            sameSite: 'None'
          }] : [])
        ],
        origins: [{ origin: 'https://www.instagram.com', localStorage: [] }]
      };
    }
  }

  if (!finalStorageState) {
    return { success: false, error: 'Nenhum cookie sessionid ou JSON de sessão válido foi fornecido.' };
  }

  if (!fs.existsSync(settings.paths.sessionsDir)) {
    fs.mkdirSync(settings.paths.sessionsDir, { recursive: true });
  }

  fs.writeFileSync(sessionPath, JSON.stringify(finalStorageState, null, 2), 'utf8');
  db.updateInstagramAccountStatus(account.id, 'active');
  appendLog('outbound', `Sessão da conta @${account.username} importada com sucesso via sessionid!`, 'success');

  return { success: true, sessionPath };
}

/**
 * POST /api/dashboard/accounts
 * Cadastra uma nova conta secundária do Instagram no SQLite (com papel automático se não informado)
 */
app.post('/api/dashboard/accounts', (req, res) => {
  try {
    const { username, password, role, proxy, daily_limit, sessionid, storageState, cookies } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, error: 'O nome de usuário é obrigatório.' });
    }

    const hasSessionInput = Boolean(sessionid || storageState || cookies);
    if (!password && !hasSessionInput) {
      return res.status(400).json({ success: false, error: 'Informe a senha ou o cookie de sessão para cadastrar a conta.' });
    }

    // Distribuição automática de papel caso não informado
    let finalRole = role;
    if (!finalRole || (finalRole !== 'sender' && finalRole !== 'scraper')) {
      const stats = db.getDashboardStats();
      finalRole = (stats.scrapersCount <= stats.sendersCount) ? 'scraper' : 'sender';
    }

    const account = db.createInstagramAccount({
      username,
      password: password || '',
      role: finalRole,
      proxy,
      daily_limit: parseInt(daily_limit || '25', 10) || 25
    });

    let sessionSaved = false;
    if (hasSessionInput) {
      const sessionRes = saveSessionCookiesForAccount(account, { sessionid, storageState, cookies });
      sessionSaved = sessionRes.success;
      if (sessionSaved) {
        account.status = 'active';
        account.has_session = true;
      }
    }

    appendLog('system', `Conta secundária @${account.username} cadastrada como ${account.role === 'sender' ? 'Disparador' : 'Localizador'}${sessionSaved ? ' com sessão ativa' : ''}.`, 'info');

    return res.status(201).json({ success: true, account, sessionSaved });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dashboard/accounts/batch
 * Cadastra múltiplas contas secundárias em lote (usuario:senha ou usuario:senha:sessionid, uma por linha)
 */
app.post('/api/dashboard/accounts/batch', (req, res) => {
  try {
    const { rawList } = req.body || {};
    if (!rawList || typeof rawList !== 'string') {
      return res.status(400).json({ success: false, error: 'Lista de contas não informada.' });
    }

    const lines = rawList.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhuma linha válida encontrada na lista.' });
    }

    const created = [];
    const errors = [];
    let stats = db.getDashboardStats();
    let currentScrapers = stats.scrapersCount;
    let currentSenders = stats.sendersCount;

    for (const line of lines) {
      // Formato: usuario:senha ou usuario:senha:sessionid
      const parts = line.split(':');
      if (parts.length < 2) {
        errors.push(`Linha inválida (use usuario:senha): "${line}"`);
        continue;
      }

      const cleanUser = parts[0].trim().replace(/^@/, '');
      const pass = parts[1].trim();
      const sess = parts[2] ? parts[2].trim() : undefined;

      if (!cleanUser) {
        errors.push(`Linha sem usuário: "${line}"`);
        continue;
      }

      try {
        const autoRole = (currentScrapers <= currentSenders) ? 'scraper' : 'sender';
        if (autoRole === 'scraper') currentScrapers++; else currentSenders++;

        const account = db.createInstagramAccount({
          username: cleanUser,
          password: pass || '',
          role: autoRole,
          daily_limit: 25
        });

        if (sess) {
          saveSessionCookiesForAccount(account, { sessionid: sess });
          account.status = 'active';
          account.has_session = true;
        }

        created.push(account);
      } catch (err) {
        errors.push(`@${cleanUser}: ${err.message}`);
      }
    }

    appendLog('system', `Lote processado: ${created.length} contas adicionadas com sucesso (${errors.length} erros/duplicadas).`, 'info');

    return res.status(200).json({
      success: true,
      createdCount: created.length,
      errorCount: errors.length,
      created,
      errors
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/dashboard/accounts/:id
 * Remove uma conta do Instagram do SQLite e apaga sua sessão
 */
app.delete('/api/dashboard/accounts/:id', (req, res) => {
  try {
    const account = db.getInstagramAccountById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada.' });
    }

    // Apaga arquivo de sessão se existir
    const cleanUser = String(account.username).replace(/[^a-zA-Z0-9._-]/g, '_');
    const standardSession = path.join(settings.paths.sessionsDir, `${cleanUser}.json`);
    const legacySession = path.join(settings.paths.sessionsDir, `${cleanUser}_storage.json`);
    if (fs.existsSync(standardSession)) fs.unlinkSync(standardSession);
    if (fs.existsSync(legacySession)) fs.unlinkSync(legacySession);

    db.deleteInstagramAccount(account.id);
    appendLog('system', `Conta @${account.username} e sessões removidas.`, 'info');

    return res.status(200).json({ success: true, message: 'Conta removida com sucesso.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dashboard/accounts/:id/session
 * Importa diretamente o Cookie sessionid ou JSON de storageState sem precisar abrir navegador (ideal para VPS Linux)
 */
app.post('/api/dashboard/accounts/:id/session', async (req, res) => {
  const accountId = req.params.id;
  const account = db.getInstagramAccountById(accountId);
  if (!account) {
    return res.status(404).json({ success: false, error: 'Conta não encontrada no banco.' });
  }

  const { sessionid, storageState, cookies } = req.body || {};

  try {
    const sessionRes = saveSessionCookiesForAccount(account, { sessionid, storageState, cookies });
    if (!sessionRes.success) {
      return res.status(400).json({ success: false, error: sessionRes.error });
    }

    return res.status(200).json({
      success: true,
      message: `Cookies salvos para @${account.username}! Conta ativada com sucesso.`,
      sessionPath: sessionRes.sessionPath
    });
  } catch (err) {
    appendLog('outbound', `Erro ao importar sessão para @${account.username}: ${err.message}`, 'error');
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dashboard/accounts/:id/login
 * Abre o Playwright em modo VISÍVEL (headless: false) para autenticar a conta e salvar storageState
 */
app.post('/api/dashboard/accounts/:id/login', async (req, res) => {
  const accountId = req.params.id;
  const account = db.getInstagramAccountById(accountId);
  if (!account) {
    return res.status(404).json({ success: false, error: 'Conta não encontrada no banco.' });
  }

  appendLog('outbound', `Abrindo navegador visível para autenticar @${account.username}...`, 'info');

  let browser = null;
  try {
    const isHeadless = process.env.NODE_ENV === 'production' || process.env.HEADLESS_BROWSER !== 'false';
    const launchOptions = {
      headless: isHeadless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled'
      ]
    };

    if (account.proxy) {
      try {
        const url = new URL(account.proxy);
        launchOptions.proxy = {
          server: `${url.protocol}//${url.host}`,
          username: url.username || undefined,
          password: url.password || undefined
        };
      } catch {
        // ignora proxy malformado
      }
    }

    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      viewport: null,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    appendLog('outbound', `Acessando login do Instagram...`, 'info');
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Aguarda e preenche credenciais
    await page.waitForSelector('input[name="username"]', { timeout: 15000 }).catch(() => null);

    const userInput = await page.$('input[name="username"]');
    if (userInput) {
      await userInput.click();
      await page.keyboard.type(account.username, { delay: 90 });
      await page.waitForTimeout(400);

      const passInput = await page.$('input[name="password"]');
      if (passInput) {
        await passInput.click();
        await page.keyboard.type(account.password, { delay: 90 });
        await page.waitForTimeout(500);

        const submitBtn = await page.$('button[type="submit"]');
        if (submitBtn) {
          await submitBtn.click();
          appendLog('outbound', `Credenciais enviadas. Aguardando finalização (aprove 2FA se solicitado)...`, 'info');
        }
      }
    }

    // Aguarda até 120s pela confirmação do login
    const startTime = Date.now();
    let loggedIn = false;

    while (Date.now() - startTime < 120000) {
      await page.waitForTimeout(2000);

      const cookies = await context.cookies();
      const hasSession = cookies.some(c => c.name === 'sessionid' || c.name === 'ds_user_id');
      const currentUrl = page.url();

      if (hasSession || (!currentUrl.includes('/accounts/login') && !currentUrl.includes('/challenge'))) {
        loggedIn = true;
        break;
      }
    }

    if (!loggedIn) {
      throw new Error('Tempo limite de 120s esgotado sem confirmação de login no Instagram.');
    }

    // Salva storageState
    const cleanUser = String(account.username).replace(/[^a-zA-Z0-9._-]/g, '_');
    const sessionPath = path.join(settings.paths.sessionsDir, `${cleanUser}.json`);
    await context.storageState({ path: sessionPath });

    // Atualiza status no banco
    db.updateInstagramAccountStatus(account.id, 'active');
    appendLog('outbound', `Conta @${account.username} autenticada com sucesso! Sessão salva.`, 'success');

    await browser.close();

    return res.status(200).json({
      success: true,
      message: `Conta @${account.username} conectada e autenticada com sucesso!`,
      sessionPath
    });

  } catch (err) {
    if (browser) await browser.close().catch(() => null);
    appendLog('outbound', `Falha ao autenticar @${account.username}: ${err.message}`, 'error');
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/dashboard/config
 * Retorna as credenciais e configurações salvas no SQLite / .env
 */
app.get('/api/dashboard/config', (req, res) => {
  try {
    const rawOpenAiKey = db.getSetting('openai_api_key') || process.env.OPENAI_API_KEY || '';
    const maskedOpenAiKey = rawOpenAiKey && rawOpenAiKey.length > 8
      ? (rawOpenAiKey.slice(0, 7) + '...' + rawOpenAiKey.slice(-4))
      : rawOpenAiKey;

    const currentPitch = db.getSetting('whatsapp_pitch_template') || whatsappDispatcher.pitchTemplate;
    const currentMinDelay = Number(db.getSetting('whatsapp_min_delay')) || whatsappDispatcher.minDelaySeconds || 60;
    const currentMaxDelay = Number(db.getSetting('whatsapp_max_delay')) || whatsappDispatcher.maxDelaySeconds || 120;
    const sdrPhone = db.getSetting('sdr_notification_phone') || process.env.SDR_NOTIFICATION_PHONE || settings.whatsapp.sdrNotificationPhone || '';
    const crmUrl = db.getSetting('crm_webhook_url') || process.env.CRM_WEBHOOK_URL || settings.crm.webhookUrl || '';
    const crmKey = db.getSetting('crm_api_key') || process.env.CRM_API_BEARER_TOKEN || settings.crm.bearerToken || '';

    // Parâmetros da Conta Oficial (Meta / Inbound)
    const officialUser = db.getSetting('official_instagram_user') || 'legadoperformance';
    const officialAiActive = db.getSetting('official_ai_enabled') !== '0' ? '1' : '0';
    const officialIcpCriteria = db.getSetting('official_icp_criteria') || 'Faturamento mensal mínimo acima de R$ 30.000/mês em nichos de estética, saúde, clínicas e odontologia.';

    return res.status(200).json({
      success: true,
      config: {
        OPENAI_API_KEY: maskedOpenAiKey,
        SDR_NOTIFICATION_PHONE: sdrPhone,
        CRM_WEBHOOK_URL: crmUrl,
        CRM_API_KEY: crmKey,
        WHATSAPP_PITCH_TEMPLATE: currentPitch,
        WHATSAPP_MIN_DELAY: currentMinDelay,
        WHATSAPP_MAX_DELAY: currentMaxDelay,
        OFFICIAL_INSTAGRAM_USER: officialUser,
        OFFICIAL_AI_ENABLED: officialAiActive,
        OFFICIAL_ICP_CRITERIA: officialIcpCriteria
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dashboard/config
 * Atualiza configurações no SQLite (app_settings) e no arquivo .env
 */
app.post('/api/dashboard/config', (req, res) => {
  try {
    const {
      OPENAI_API_KEY,
      SDR_NOTIFICATION_PHONE,
      CRM_WEBHOOK_URL,
      CRM_API_KEY,
      WHATSAPP_PITCH_TEMPLATE,
      WHATSAPP_MIN_DELAY,
      WHATSAPP_MAX_DELAY,
      OFFICIAL_INSTAGRAM_USER,
      OFFICIAL_AI_ENABLED,
      OFFICIAL_ICP_CRITERIA
    } = req.body || {};

    // 1. Grava parâmetros operacionais no SQLite (app_settings)
    if (OPENAI_API_KEY && !String(OPENAI_API_KEY).includes('...')) {
      db.setSetting('openai_api_key', OPENAI_API_KEY.trim());
    }
    if (SDR_NOTIFICATION_PHONE !== undefined) {
      db.setSetting('sdr_notification_phone', String(SDR_NOTIFICATION_PHONE).trim());
    }
    if (CRM_WEBHOOK_URL !== undefined) {
      db.setSetting('crm_webhook_url', String(CRM_WEBHOOK_URL).trim());
    }
    if (CRM_API_KEY !== undefined) {
      db.setSetting('crm_api_key', String(CRM_API_KEY).trim());
    }
    if (WHATSAPP_PITCH_TEMPLATE !== undefined) {
      db.setSetting('whatsapp_pitch_template', String(WHATSAPP_PITCH_TEMPLATE).trim());
    }
    if (WHATSAPP_MIN_DELAY !== undefined) {
      db.setSetting('whatsapp_min_delay', parseInt(WHATSAPP_MIN_DELAY, 10));
    }
    if (WHATSAPP_MAX_DELAY !== undefined) {
      db.setSetting('whatsapp_max_delay', parseInt(WHATSAPP_MAX_DELAY, 10));
    }
    if (OFFICIAL_INSTAGRAM_USER !== undefined) {
      db.setSetting('official_instagram_user', String(OFFICIAL_INSTAGRAM_USER).replace(/^@/, '').trim());
    }
    if (OFFICIAL_AI_ENABLED !== undefined) {
      db.setSetting('official_ai_enabled', String(OFFICIAL_AI_ENABLED) === '1' || OFFICIAL_AI_ENABLED === true ? '1' : '0');
    }
    if (OFFICIAL_ICP_CRITERIA !== undefined) {
      db.setSetting('official_icp_criteria', String(OFFICIAL_ICP_CRITERIA).trim());
    }

    // 2. Atualiza parâmetros do despachador WhatsApp em tempo de execução
    whatsappDispatcher.updateConfig({
      minDelaySeconds: WHATSAPP_MIN_DELAY,
      maxDelaySeconds: WHATSAPP_MAX_DELAY,
      pitchTemplate: WHATSAPP_PITCH_TEMPLATE
    });

    // 3. Atualiza arquivo .env para manter sincronização com a VPS
    const envPath = path.resolve('.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    const updateEnvVar = (name, value) => {
      if (value === undefined || value === null) return;
      if (name === 'OPENAI_API_KEY' && String(value).includes('...')) return;

      const regex = new RegExp(`^${name}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${name}=${value}`);
      } else {
        envContent += `\n${name}=${value}`;
      }
      process.env[name] = value;
    };

    if (OPENAI_API_KEY && !String(OPENAI_API_KEY).includes('...')) updateEnvVar('OPENAI_API_KEY', OPENAI_API_KEY.trim());
    if (SDR_NOTIFICATION_PHONE !== undefined) updateEnvVar('SDR_NOTIFICATION_PHONE', SDR_NOTIFICATION_PHONE);
    if (CRM_WEBHOOK_URL !== undefined) updateEnvVar('CRM_WEBHOOK_URL', CRM_WEBHOOK_URL);
    if (CRM_API_KEY !== undefined) updateEnvVar('CRM_API_BEARER_TOKEN', CRM_API_KEY);

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');

    appendLog('system', 'Configurações operacionais salvas no SQLite e .env com sucesso.', 'success');

    return res.status(200).json({
      success: true,
      message: 'Configurações salvas no SQLite e aplicadas com sucesso!'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// ROTAS DE GERENCIAMENTO DO WHATSAPP BAILEYS NATIVO (QR CODE & STATUS)
// ============================================================================

/**
 * GET /api/whatsapp/status
 * Retorna o status de conexão atual do WhatsApp nativo Baileys
 */
app.get('/api/whatsapp/status', (req, res) => {
  try {
    const status = getNativeStatus();
    return res.status(200).json({
      success: true,
      ...status
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/whatsapp/qr
 * Retorna o QR Code atual gerado em formato DataURL para renderização direta na UI
 */
app.get('/api/whatsapp/qr', (req, res) => {
  try {
    const status = getNativeStatus();
    const qr = getNativeQrCode();
    return res.status(200).json({
      success: true,
      qr,
      state: status.state,
      connected: status.connected,
      user: status.user
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/whatsapp/reconnect
 * Força a inicialização ou reconexão do socket Baileys
 */
app.post('/api/whatsapp/reconnect', async (req, res) => {
  try {
    appendLog('miner', 'Disparando reinicialização do WhatsApp Baileys Nativo...', 'info');
    initNativeWhatsApp().catch(err => {
      console.warn('⚠️ [WhatsApp] Aviso ao reinicializar:', err.message);
    });
    return res.status(200).json({
      success: true,
      message: 'Reconexão iniciada com sucesso. Verifique o QR Code ou status.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/whatsapp/disconnect
 * Encerra sessão do WhatsApp e limpa arquivos de autenticação em disco
 */
app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    appendLog('miner', 'Desconectando sessão local do WhatsApp Baileys...', 'info');
    const result = await disconnectNativeWhatsApp();
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// FILA DE DISPARO AUTOMÁTICO WHATSAPP (MÓDULO 3 MINERADOR MAPS)
// ============================================================================

/**
 * GET /api/dashboard/whatsapp-dispatcher/status
 * Retorna estado da fila de disparos de prospecção do WhatsApp
 */
app.get('/api/dashboard/whatsapp-dispatcher/status', (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      status: whatsappDispatcher.getStatus()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dashboard/whatsapp-dispatcher/toggle
 * Liga ou pausa a fila de disparos automáticos no WhatsApp
 */
app.post('/api/dashboard/whatsapp-dispatcher/toggle', (req, res) => {
  try {
    const status = whatsappDispatcher.toggle();
    appendLog('miner', `Fila automática de WhatsApp ${status.isRunning ? 'LIGADA' : 'PAUSADA'}.`, status.isRunning ? 'success' : 'warn');
    return res.status(200).json({
      success: true,
      status
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dashboard/whatsapp-dispatcher/config
 * Atualiza configurações de delay, limite e template da fila
 */
app.post('/api/dashboard/whatsapp-dispatcher/config', (req, res) => {
  try {
    const status = whatsappDispatcher.updateConfig(req.body);
    appendLog('miner', 'Parâmetros da fila de WhatsApp atualizados.', 'info');
    return res.status(200).json({
      success: true,
      status
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dashboard/validate-leads-wa (e alias /api/dashboard/revalidate-whatsapp)
 * Executa a checagem em lote de WhatsApp (waChecker) nos leads ainda não verificados
 */
app.post(['/api/dashboard/validate-leads-wa', '/api/dashboard/revalidate-whatsapp'], async (req, res) => {
  try {
    const waStatus = getNativeStatus();
    if (!waStatus.connected) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp Baileys não está conectado. Conecte pelo QR Code no topo do painel antes de validar os leads.'
      });
    }

    const unverifiedLeads = db.db.prepare(`
      SELECT id, phone, phone_type, status 
      FROM leads 
      WHERE phone IS NOT NULL 
        AND (is_whatsapp_active IS NULL OR is_whatsapp_active = -1 OR is_whatsapp_active = 0 OR status = 'no_whatsapp')
    `).all();

    if (unverifiedLeads.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Todos os leads com telefone já estão validados no WhatsApp.',
        checkedCount: 0,
        activeCount: 0
      });
    }

    appendLog('miner', `Validando WhatsApp ativo para ${unverifiedLeads.length} leads pendentes...`, 'info');

    const phoneList = unverifiedLeads.map(l => l.phone);
    const waResults = await waChecker.validateNumbers(phoneList);

    let activeCount = 0;
    let noWaCount = 0;
    const updateActiveStmt = db.db.prepare(`
      UPDATE leads 
      SET is_whatsapp_active = 1, 
          status = CASE WHEN status = 'no_whatsapp' OR status = 'new' THEN 'in_qualification' ELSE status END, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    const updateNoWaStmt = db.db.prepare(`
      UPDATE leads 
      SET is_whatsapp_active = 0, 
          status = 'no_whatsapp', 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);

    for (const lead of unverifiedLeads) {
      const resItem = waResults.get(lead.phone);
      if (resItem && resItem.exists) {
        updateActiveStmt.run(lead.id);
        activeCount++;
      } else if (resItem && !resItem.exists && !resItem.isOffline) {
        updateNoWaStmt.run(lead.id);
        noWaCount++;
      }
    }

    appendLog('miner', `Validação concluída: ${activeCount} ativos confirmados e ${noWaCount} sem WhatsApp.`, 'success');

    return res.status(200).json({
      success: true,
      message: `Validação concluída: ${activeCount} ativos e ${noWaCount} sem WhatsApp de ${unverifiedLeads.length} testados.`,
      checkedCount: unverifiedLeads.length,
      activeCount,
      noWaCount
    });

  } catch (err) {
    appendLog('miner', `Erro na validação de WhatsApp: ${err.message}`, 'error');
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dashboard/miner
 * Inicia execução real do Módulo 3 (Minerador Google Maps) em background
 */
app.post('/api/dashboard/miner', async (req, res) => {
  try {
    if (minerTaskState.status === 'running') {
      return res.status(409).json({
        success: false,
        error: 'Uma mineração no Google Maps já está em execução no momento.'
      });
    }

    const query = req.body.query?.trim() || 'Clinica Odontologica Barueri SP';
    const limit = parseInt(req.body.limit || '5', 10);

    minerTaskState = {
      status: 'running',
      query,
      limit,
      startedAt: new Date().toISOString(),
      completedAt: null,
      lastResult: null,
      error: null
    };

    appendLog('miner', `Iniciando varredura no Google Maps para "${query}" (${limit} alvos)...`, 'info');

    // Executa em segundo plano de forma assíncrona
    runGmnPipeline({ query, limit, fromApi: true })
      .then(result => {
        minerTaskState.status = 'completed';
        minerTaskState.completedAt = new Date().toISOString();
        minerTaskState.lastResult = result;
        appendLog('miner', `Mineração concluída! ${result.total} empresas salvas na planilha ${result.file || ''}.`, 'success');
      })
      .catch(err => {
        minerTaskState.status = 'error';
        minerTaskState.completedAt = new Date().toISOString();
        minerTaskState.error = err.message;
        appendLog('miner', `Falha na mineração: ${err.message}`, 'error');
      });

    return res.status(200).json({
      success: true,
      message: `Mineração iniciada para "${query}" (${limit} estabelecimentos).`,
      task: minerTaskState
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dashboard/outbound
 * Trava de Segurança e Disparo real do Módulo 2 (Outbound Instagram)
 */
app.post('/api/dashboard/outbound', async (req, res) => {
  try {
    if (outboundTaskState.status === 'running') {
      return res.status(409).json({
        success: false,
        error: 'Um disparo de Outbound Instagram já está em execução no momento.'
      });
    }

    // TRAVA DE SEGURANÇA OBRIGATÓRIA: Verifica se há pelo menos 1 scraper e 1 sender no SQLite
    const accounts = db.getAllInstagramAccounts();
    const scrapersCount = accounts.filter(a => a.role === 'scraper').length;
    const sendersCount = accounts.filter(a => a.role === 'sender').length;

    if (scrapersCount === 0 || sendersCount === 0) {
      appendLog('outbound', 'Disparo bloqueado: Nenhuma conta Scraper ou Sender conectada no sistema.', 'error');
      return res.status(400).json({
        success: false,
        error: 'Nenhuma conta Scraper/Sender conectada. Cadastre e autentique suas contas primeiro.'
      });
    }

    const target = req.body.target ? req.body.target.replace('@', '').trim() : null;
    const limit = parseInt(req.body.limit || '10', 10);

    outboundTaskState = {
      status: 'running',
      target,
      limit,
      startedAt: new Date().toISOString(),
      completedAt: null,
      lastResult: null,
      error: null
    };

    appendLog('outbound', `Iniciando Outbound para @${target || 'leads pendentes'} (${limit} alvos)...`, 'info');

    runOutboundPipeline({ target, limit, fromApi: true })
      .then(result => {
        outboundTaskState.status = 'completed';
        outboundTaskState.completedAt = new Date().toISOString();
        outboundTaskState.lastResult = result;
        appendLog('outbound', `Outbound concluído com sucesso: ${result.sent} DMs enviadas.`, 'success');
      })
      .catch(err => {
        outboundTaskState.status = 'error';
        outboundTaskState.completedAt = new Date().toISOString();
        outboundTaskState.error = err.message;
        appendLog('outbound', `Falha no Outbound: ${err.message}`, 'error');
      });

    return res.status(200).json({
      success: true,
      message: `Fluxo de Outbound iniciado para @${target || 'leads pendentes'} (${limit} alvos).`,
      task: outboundTaskState
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/dashboard/exports
 * Lista as planilhas .xlsx reais disponíveis em data/exports/
 */
app.get('/api/dashboard/exports', (req, res) => {
  try {
    const exportsDir = settings.paths.exportsDir;
    if (!fs.existsSync(exportsDir)) {
      return res.status(200).json({ success: true, count: 0, files: [] });
    }

    const fileNames = fs.readdirSync(exportsDir).filter(f => f.endsWith('.xlsx'));
    const files = fileNames.map(fileName => {
      const fullPath = path.join(exportsDir, fileName);
      const stat = fs.statSync(fullPath);
      return {
        name: fileName,
        sizeBytes: stat.size,
        sizeFormatted: `${(stat.size / 1024).toFixed(1)} KB`,
        createdAt: stat.birthtime,
        downloadUrl: `/api/dashboard/exports/${encodeURIComponent(fileName)}`
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      success: true,
      count: files.length,
      files
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/dashboard/exports/:filename
 * Download da planilha Excel com 1 clique direto pelo navegador
 */
app.get('/api/dashboard/exports/:filename', (req, res) => {
  try {
    const safeFileName = path.basename(req.params.filename);
    const filePath = path.join(settings.paths.exportsDir, safeFileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Planilha não encontrada.' });
    }
    return res.download(filePath, safeFileName);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Redirecionamento da raiz e rota dashboard para o painel em public/index.html
app.get(['/', '/dashboard'], (req, res) => {
  const dashboardHtml = path.resolve('public', 'index.html');
  if (fs.existsSync(dashboardHtml)) {
    return res.sendFile(dashboardHtml);
  }
  return res.send('Dashboard Web Carregando... por favor atualize em instantes.');
});

// Inicialização do Servidor Express Unificado
const PORT = settings.server.port;
const server = app.listen(PORT, () => {
  console.log(`🚀 [Legado SDR Engine] Servidor unificado ativo na porta ${PORT}`);
  console.log(`🖥️ Dashboard Web: http://localhost:${PORT}`);
  console.log(`🔗 Healthcheck: http://localhost:${PORT}/health`);
  console.log(`📥 Inbound Webhook: http://localhost:${PORT}/api/inbound/webhook`);

  // Inicializa o motor Baileys em background automaticamente
  initNativeWhatsApp().catch(err => {
    console.warn(`⚠️ [WhatsApp Baileys] Inicialização em background: ${err.message}`);
  });
});

// Encerramento gracioso
function gracefulShutdown() {
  console.log('\n🛑 Encerrando servidor graciosamente...');
  server.close(() => {
    db.close();
    console.log('✅ Banco de dados fechado e servidor finalizado.');
    process.exit(0);
  });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default app;
