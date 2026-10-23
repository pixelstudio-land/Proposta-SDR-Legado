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
app.post('/api/inbound/webhook', validateWebhookSecret, async (req, res) => {
  const startTime = Date.now();
  let lead = null;
  const body = req.body || {};

  try {
    // 1. Extração flexível dos dados enviados pelo ManyChat
    const rawIdentifier = body.instagram_username || body.ig_username || body.user_id || body.subscriber_id || body.phone;
    const userMessage = body.message || body.last_input_text || body.text || body.content || '';
    const userName = body.name || [body.first_name, body.last_name].filter(Boolean).join(' ') || null;
    const userPhone = body.phone || null;

    if (!rawIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'Identificador do usuário ausente no payload (necessário instagram_username, user_id ou phone).'
      });
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

    // 8. Se atingiu o ICP ('qualified'), executa o transbordo duplo imediato (WhatsApp + CRM)
    let transbordoResult = null;
    if (updatedLead.status === 'qualified') {
      transbordoResult = await transbordo.executeTransbordo(updatedLead);
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
 * POST /api/dashboard/accounts
 * Cadastra uma nova conta do Instagram no SQLite
 */
app.post('/api/dashboard/accounts', (req, res) => {
  try {
    const { username, password, role, proxy, daily_limit } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Usuário e senha são obrigatórios.' });
    }

    const account = db.createInstagramAccount({
      username,
      password,
      role: role === 'sender' ? 'sender' : 'scraper',
      proxy,
      daily_limit: parseInt(daily_limit || '25', 10)
    });

    appendLog('system', `Conta @${account.username} cadastrada como ${account.role}.`, 'info');

    return res.status(201).json({ success: true, account });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
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
    const launchOptions = {
      headless: false,
      args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
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
 * Retorna as credenciais e configurações salvas no .env
 */
app.get('/api/dashboard/config', (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      config: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? (process.env.OPENAI_API_KEY.slice(0, 7) + '...' + process.env.OPENAI_API_KEY.slice(-4)) : '',
        WA_API_URL: process.env.WA_API_URL || settings.integrations.evolutionApi.baseUrl || '',
        WA_API_KEY: process.env.WA_API_KEY || settings.integrations.evolutionApi.apiKey || '',
        WA_INSTANCE_NAME: process.env.WA_INSTANCE_NAME || settings.integrations.evolutionApi.instanceName || '',
        SDR_NOTIFICATION_PHONE: process.env.SDR_NOTIFICATION_PHONE || settings.integrations.whatsapp.sdrNotificationPhone || '',
        CRM_WEBHOOK_URL: process.env.CRM_WEBHOOK_URL || settings.integrations.crm.webhookUrl || ''
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dashboard/config
 * Atualiza as variáveis de ambiente no arquivo .env e em memória
 */
app.post('/api/dashboard/config', (req, res) => {
  try {
    const { OPENAI_API_KEY, WA_API_URL, WA_API_KEY, WA_INSTANCE_NAME, SDR_NOTIFICATION_PHONE, CRM_WEBHOOK_URL } = req.body;

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

    updateEnvVar('OPENAI_API_KEY', OPENAI_API_KEY);
    updateEnvVar('WA_API_URL', WA_API_URL);
    updateEnvVar('WA_API_KEY', WA_API_KEY);
    updateEnvVar('WA_INSTANCE_NAME', WA_INSTANCE_NAME);
    updateEnvVar('SDR_NOTIFICATION_PHONE', SDR_NOTIFICATION_PHONE);
    updateEnvVar('CRM_WEBHOOK_URL', CRM_WEBHOOK_URL);

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');

    // Atualiza settings em memória
    if (settings.whatsapp) {
      if (WA_API_URL) settings.whatsapp.apiUrl = WA_API_URL;
      if (WA_API_KEY) settings.whatsapp.apiKey = WA_API_KEY;
      if (WA_INSTANCE_NAME) settings.whatsapp.instanceName = WA_INSTANCE_NAME;
      if (SDR_NOTIFICATION_PHONE) settings.whatsapp.sdrNotificationPhone = SDR_NOTIFICATION_PHONE;
    }
    if (settings.crm && CRM_WEBHOOK_URL) {
      settings.crm.webhookUrl = CRM_WEBHOOK_URL;
    }
    if (settings.ai && OPENAI_API_KEY && !String(OPENAI_API_KEY).includes('...')) {
      settings.ai.openaiApiKey = OPENAI_API_KEY;
    }

    appendLog('system', 'Credenciais e integrações (.env) atualizadas.', 'success');

    return res.status(200).json({
      success: true,
      message: 'Configurações salvas e aplicadas em memória com sucesso!'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dashboard/validate-leads-wa
 * Executa a checagem em lote de WhatsApp (waChecker) nos leads ainda não verificados
 */
app.post('/api/dashboard/validate-leads-wa', async (req, res) => {
  try {
    const unverifiedLeads = db.db.prepare('SELECT id, phone FROM leads WHERE phone IS NOT NULL AND is_whatsapp_active = 0').all();

    if (unverifiedLeads.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Todos os leads com telefone já estão validados.',
        checkedCount: 0,
        activeCount: 0
      });
    }

    appendLog('miner', `Validando WhatsApp ativo para ${unverifiedLeads.length} leads pendentes...`, 'info');

    const phoneList = unverifiedLeads.map(l => l.phone);
    const waResults = await waChecker.validateNumbers(phoneList);

    let activeCount = 0;
    const updateStmt = db.db.prepare('UPDATE leads SET is_whatsapp_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

    for (const lead of unverifiedLeads) {
      const resItem = waResults.get(lead.phone);
      if (resItem && resItem.exists) {
        updateStmt.run(lead.id);
        activeCount++;
      }
    }

    appendLog('miner', `Validação concluída: ${activeCount} novos números de WhatsApp ativos confirmados.`, 'success');

    return res.status(200).json({
      success: true,
      message: `Validação concluída: ${activeCount} números ativos confirmados de ${unverifiedLeads.length} testados.`,
      checkedCount: unverifiedLeads.length,
      activeCount
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
