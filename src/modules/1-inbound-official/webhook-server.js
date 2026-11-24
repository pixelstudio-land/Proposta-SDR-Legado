import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import { chromium } from 'playwright';
import { settings } from '../../../config/settings.js';
import db from '../../database/db.js';
import openaiClient from '../../ai/openai-client.js';
import memoryManager from './memory-manager.js';
import qualification from './qualification.js';
import transbordo from './transbordo.js';
import crmClient from '../../integrations/crm-client.js';
import { runGmnPipeline } from '../3-miner-gmn/index.js';
import { runOutboundPipeline } from '../2-outbound-instagram/index.js';
import waChecker from '../3-miner-gmn/wa-checker.js';
import {
  initPersistedWhatsAppSessions,
  initNativeWhatsAppForSession,
  getNativeStatusForUser,
  getNativeQrCodeForUser,
  disconnectNativeWhatsAppForSession,
  isNativeConnectedForUser
} from '../../integrations/whatsapp-client.js';
import { getDispatcherForUser, stopDispatcherForUser } from '../3-miner-gmn/whatsapp-dispatcher.js';
import { verifyPassword, signJwt, verifyJwt, parseCookies } from '../../utils/auth.js';

const app = express();
app.set('trust proxy', 1);

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use(express.static(publicDir));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const JWT_SECRET = db.getOrCreateJwtSecret();
const AUTH_COOKIE_NAME = 'sdr_session';

// ==============================================================================
// BUFFER DE LOGS ISOLADO POR TENANT
// ==============================================================================
const runtimeLogs = [];
export function appendLog(moduleName, message, level = 'info', userId = null) {
  const cleanMsg = String(message)
    .replace(/\x1B\[[0-9;]*[mK]/g, '')
    .trim();

  if (!cleanMsg) return;

  const entry = {
    id: Date.now() + Math.random(),
    userId: userId ? Number(userId) : null,
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    module: moduleName,
    level,
    message: cleanMsg
  };
  runtimeLogs.push(entry);
  if (runtimeLogs.length > 800) runtimeLogs.shift();
  return entry;
}

const origConsoleLog = console.log;
const origConsoleWarn = console.warn;
const origConsoleError = console.error;

function routeConsoleToLog(level, args) {
  try {
    const raw = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    if (!raw || raw.startsWith('===') || raw.includes('ExperimentalWarning') || raw.includes('node:internal')) {
      return;
    }

    const userMatch = raw.match(/(?:User|USER)\s*#(\d+)/i);
    const extractedUserId = userMatch ? Number(userMatch[1]) : null;

    let moduleName = 'system';
    if (
      raw.includes('[MapsScraper]') ||
      raw.includes('[LeadExporter]') ||
      raw.includes('[WhatsAppChecker]') ||
      raw.includes('Google Maps') ||
      raw.includes('Google Meu Negócio') ||
      raw.includes('MINERAÇÃO')
    ) {
      moduleName = 'miner';
    } else if (
      raw.includes('[TargetScraper]') ||
      raw.includes('[ProfileFilter]') ||
      raw.includes('[Messenger]') ||
      raw.includes('[AccountRotator]') ||
      raw.includes('Instagram') ||
      raw.includes('Cold DM') ||
      raw.includes('Outbound')
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

    appendLog(moduleName, raw, logLvl, extractedUserId);
  } catch (_) {}
}

console.log = function (...args) {
  origConsoleLog.apply(console, args);
  routeConsoleToLog('info', args);
};
console.warn = function (...args) {
  origConsoleWarn.apply(console, args);
  routeConsoleToLog('warn', args);
};
console.error = function (...args) {
  origConsoleError.apply(console, args);
  routeConsoleToLog('error', args);
};

// Estado de background tasks isolado por userId
const minerTaskStateByUser = new Map();
const outboundTaskStateByUser = new Map();

function getMinerState(userId) {
  const uid = Number(userId);
  if (!minerTaskStateByUser.has(uid)) {
    minerTaskStateByUser.set(uid, {
      status: 'idle', query: null, limit: 0, startedAt: null, completedAt: null, lastResult: null, error: null
    });
  }
  return minerTaskStateByUser.get(uid);
}

function getOutboundState(userId) {
  const uid = Number(userId);
  if (!outboundTaskStateByUser.has(uid)) {
    outboundTaskStateByUser.set(uid, {
      status: 'idle', target: null, limit: 0, startedAt: null, completedAt: null, lastResult: null, error: null
    });
  }
  return outboundTaskStateByUser.get(uid);
}

// ==============================================================================
// SISTEMA DE AUTENTICAÇÃO MULTI-TENANT (JWT EM COOKIE HTTP-ONLY)
// ==============================================================================
function isSecureRequest(req) {
  return Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
}

function setSessionCookie(req, res, token) {
  const parts = [
    `${AUTH_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=604800'
  ];
  if (isSecureRequest(req) || settings.server.nodeEnv === 'production') {
    // Em localhost http://127.0.0.1 o curl/navegador local pode testar sem TLS; envia Secure apenas se HTTPS
    if (isSecureRequest(req)) {
      parts.push('Secure');
    }
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
}

function extractAuthUser(req) {
  const cookies = parseCookies(req.headers['cookie'] || '');
  const cookieToken = cookies[AUTH_COOKIE_NAME];
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

  const token = cookieToken || bearerToken;
  if (!token) return null;

  const payload = verifyJwt(token, JWT_SECRET);
  if (!payload || !payload.sub) return null;

  const user = db.getUserById(payload.sub);
  if (!user || Number(user.active) !== 1) return null;

  return {
    id: Number(user.id),
    email: user.email,
    role: user.role,
    max_chips: Number(user.max_chips),
    active: Boolean(user.active)
  };
}

function requireAuth(req, res, next) {
  const user = extractAuthUser(req);
  if (!user) {
    return res.status(401).json({
      success: false,
      require_auth: true,
      error: 'Acesso restrito. Faça login com seu e-mail e senha.'
    });
  }
  req.user = user;
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Recurso exclusivo para administradores.'
    });
  }
  return next();
}

/**
 * POST /api/auth/login
 * Autentica usuário (email + senha) e grava JWT em Cookie HTTP-only
 */
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Informe seu e-mail e senha.' });
    }

    const userRecord = db.getUserAuthByEmail(String(email).trim());
    if (!userRecord || !verifyPassword(String(password), userRecord.password_hash)) {
      return res.status(401).json({ success: false, error: 'E-mail ou senha inválidos.' });
    }

    if (Number(userRecord.active) !== 1) {
      return res.status(403).json({ success: false, error: 'Acesso desativado pelo administrador.' });
    }

    const token = signJwt(
      { sub: userRecord.id, email: userRecord.email, role: userRecord.role },
      JWT_SECRET
    );

    setSessionCookie(req, res, token);
    appendLog('system', `Login efetuado por ${userRecord.email} (${userRecord.role}).`, 'success', userRecord.id);

    return res.status(200).json({
      success: true,
      user: {
        id: Number(userRecord.id),
        email: userRecord.email,
        role: userRecord.role,
        max_chips: Number(userRecord.max_chips),
        active: true
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/verify
 * Verifica se a sessão HTTP-only JWT está ativa e retorna os dados atualizados de req.user
 */
app.get('/api/auth/verify', (req, res) => {
  const user = extractAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, authenticated: false });
  }
  return res.status(200).json({ success: true, authenticated: true, user });
});

/**
 * POST /api/auth/logout
 */
app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  return res.status(200).json({ success: true });
});

// ==============================================================================
// ROTAS PÚBLICAS (HEALTHCHECK & INBOUND WEBHOOK MULTI-TENANT)
// ==============================================================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'legado-sdr-inbound',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: settings.server.nodeEnv
  });
});

function resolveInboundTenant(req) {
  const secretFromHeader = req.headers['x-webhook-secret'] || req.headers['x-api-key'] || req.headers['x-tenant-token'];
  const secretFromQuery = req.query.secret || req.query.token;
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const providedSecret = secretFromHeader || secretFromQuery || bearerToken;

  const explicitUserId = req.params.userId || req.query.user_id;
  if (explicitUserId) {
    const user = db.getUserById(Number(explicitUserId));
    if (!user || !user.active) return { authorized: false, error: 'Tenant inválido ou inativo.' };
    const userSecret = db.getSetting('inbound_webhook_token', null, user.id);
    if (userSecret && providedSecret === userSecret) {
      return { authorized: true, userId: user.id };
    }
    const globalSecret = settings.server.webhookSecret;
    if (user.role === 'admin' && (!globalSecret || globalSecret === 'default_secret' || providedSecret === globalSecret)) {
      return { authorized: true, userId: user.id };
    }
    return { authorized: false, error: 'Token de webhook inválido para este usuário.' };
  }

  // Fallback legado: se houver token de tenant específico em app_settings
  if (providedSecret) {
    const row = db.db.prepare("SELECT user_id FROM app_settings WHERE key = 'inbound_webhook_token' AND value = ? LIMIT 1").get(String(providedSecret));
    if (row?.user_id) {
      const user = db.getUserById(row.user_id);
      if (user && user.active) return { authorized: true, userId: user.id };
    }
  }

  const configuredSecret = settings.server.webhookSecret;
  if (!configuredSecret || configuredSecret === 'default_secret' || providedSecret === configuredSecret) {
    return { authorized: true, userId: db.getAdminUserId() };
  }

  return { authorized: false, error: 'Acesso não autorizado: WEBHOOK_SECRET inválido ou ausente.' };
}

app.post(['/api/inbound/webhook', '/api/inbound/webhook/:userId', '/webhook/manychat'], async (req, res) => {
  const tenantAuth = resolveInboundTenant(req);
  if (!tenantAuth.authorized) {
    return res.status(401).json({ success: false, error: tenantAuth.error });
  }

  const userId = Number(tenantAuth.userId);
  const startTime = Date.now();
  let lead = null;
  const body = req.body || {};

  try {
    const rawIdentifier = body.instagram_username || body.ig_username || body.user_id || body.subscriber_id || body.phone || body.contact?.handle || body.contact?.id || body.contact?.username;
    let userMessage = body.message || body.last_input_text || body.text || body.content || '';
    const userName = body.name || [body.first_name, body.last_name].filter(Boolean).join(' ') || body.contact?.name || null;
    const userPhone = body.phone || body.contact?.phone || null;

    if (!rawIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'Identificador do usuário ausente no payload.'
      });
    }

    const isStoryTrigger = body.event === 'story_reply' || body.event === 'story_reaction' ||
      body.trigger === 'story_reaction' || body.story_reply || Boolean(body.reaction);
    const isCommentTrigger = body.event === 'comment' || body.event === 'post_comment' ||
      body.event === 'reel_comment' || body.trigger === 'comment' || Boolean(body.comment) || Boolean(body.comment_text);

    if (isStoryTrigger) {
      const emoji = body.reaction || body.story_reply || '🔥';
      const storyContext = `[Reagiu ao seu Story no Instagram com ${emoji}]`;
      userMessage = userMessage ? `${storyContext} - Mensagem: "${userMessage}"` : storyContext;
    } else if (isCommentTrigger) {
      const commentContent = body.comment || body.comment_text || userMessage || 'Interesse manifestado';
      const commentContext = `[Comentou na sua publicação/Reel do Instagram: "${commentContent}"]`;
      userMessage = (userMessage && userMessage !== commentContent) ? `${commentContext} - Mensagem: "${userMessage}"` : commentContext;
    }

    const identifier = String(rawIdentifier).trim().startsWith('@') || !isNaN(rawIdentifier)
      ? String(rawIdentifier).trim()
      : `@${String(rawIdentifier).trim()}`;

    lead = memoryManager.getOrCreateLead(identifier, {
      source: 'inbound_official',
      name: userName,
      phone: userPhone
    }, userId);

    if (userMessage) {
      db.addConversationMessage(lead.id, 'user', userMessage, userId);
    }

    const history = memoryManager.getConversationHistory(lead.id, 15, userId);
    const aiResult = await openaiClient.processInboundConversation(history, { ...lead, user_id: userId });

    if (aiResult.reply_message) {
      db.addConversationMessage(lead.id, 'assistant', aiResult.reply_message, userId);
    }

    const updatedLead = qualification.evaluateAndSaveLead(
      lead.id,
      aiResult.extracted_data,
      aiResult.status,
      userId
    );

    let transbordoResult = null;
    if (updatedLead.status === 'qualified') {
      transbordoResult = await transbordo.executeTransbordo(updatedLead);
      appendLog('inbound', `Lead qualificado: ${updatedLead.identifier} -> Alerta enviado e injetado no CRM.`, 'success', userId);
    }

    return res.status(200).json({
      success: true,
      lead_id: updatedLead.id,
      reply_message: aiResult.reply_message,
      status: updatedLead.status,
      transbordo_executed: Boolean(transbordoResult?.transbordoExecuted),
      elapsed_ms: Date.now() - startTime
    });
  } catch (error) {
    const fallbackReply = 'Perfeito! Poderia me informar qual é o nicho da sua empresa e a média de faturamento mensal para direcionarmos ao especialista correto?';
    if (lead?.id) {
      try { db.addConversationMessage(lead.id, 'assistant', fallbackReply, userId); } catch (_) {}
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
// PROTEÇÃO GLOBAL DE TODAS AS ROTAS DO PAINEL & ADMIN
// ==============================================================================
app.use('/api/dashboard', requireAuth);
app.use('/api/whatsapp', requireAuth);
app.use('/api/admin', requireAuth, requireAdmin);

// ==============================================================================
// ROTAS EXCLUSIVAS DE GESTÃO DE CLIENTES (SOMENTE ADMIN)
// ==============================================================================
app.get('/api/admin/users', (req, res) => {
  try {
    const users = db.getAllUsers();
    return res.status(200).json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/users', (req, res) => {
  try {
    const { email, password, max_chips, role } = req.body || {};
    const user = db.createUser({
      email,
      password,
      role: role === 'admin' ? 'admin' : 'user',
      max_chips: parseInt(max_chips, 10) || 1,
      active: 1
    });
    appendLog('system', `Admin ${req.user.email} criou cliente ${user.email} (max_chips=${user.max_chips}).`, 'success', req.user.id);
    return res.status(201).json({ success: true, user });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.patch('/api/admin/users/:id', async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const { active, max_chips } = req.body || {};

    if (targetId === req.user.id && active === false) {
      return res.status(400).json({ success: false, error: 'Você não pode desativar sua própria conta de administrador.' });
    }

    const updated = db.updateUserAccess(targetId, { active, max_chips });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
    }

    // Se o cliente foi desativado, encerra dispatcher e desconecta sessões dele imediatamente
    if (active === false || active === 0) {
      stopDispatcherForUser(targetId);
      const sessions = db.getWaSessionsByUser(targetId);
      for (const s of sessions) {
        await disconnectNativeWhatsAppForSession(targetId, s.id).catch(() => {});
      }
    }

    appendLog('system', `Admin atualizou usuário #${targetId} (${updated.email}): active=${updated.active}, max_chips=${updated.max_chips}.`, 'info', req.user.id);
    return res.status(200).json({ success: true, user: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// ROTAS OPERACIONAIS DO DASHBOARD (ISOLADAS POR req.user.id)
// ==============================================================================
app.get('/api/dashboard/logs', (req, res) => {
  try {
    const { module, limit } = req.query;
    let logs = runtimeLogs.filter(l => l.userId === req.user.id);
    if (module && module !== 'all') {
      logs = logs.filter(l => l.module === module);
    }
    const max = parseInt(limit || '60', 10);
    const sliced = logs.slice(-max);
    return res.status(200).json({ success: true, count: sliced.length, logs: sliced });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/dashboard/stats', (req, res) => {
  try {
    const stats = db.getDashboardStats(req.user.id);
    return res.status(200).json({
      success: true,
      stats: {
        ...stats,
        miner: getMinerState(req.user.id),
        outbound: getOutboundState(req.user.id)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/dashboard/leads', (req, res) => {
  try {
    const { source, status } = req.query;
    const leads = db.getAllLeads({ source, status, userId: req.user.id });
    return res.status(200).json({ success: true, count: leads.length, leads });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/dashboard/leads/:id', (req, res) => {
  try {
    const success = db.deleteLead(req.params.id, req.user.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Lead não encontrado.' });
    }
    return res.status(200).json({ success: true, message: 'Lead excluído com sucesso.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/dashboard/leads', (req, res) => {
  try {
    db.clearAllLeads(req.user.id);
    appendLog('system', 'Leads e históricos da conta removidos.', 'info', req.user.id);
    return res.status(200).json({ success: true, message: 'Todos os leads da sua conta foram excluídos.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/dashboard/leads/:id/history', (req, res) => {
  try {
    const leadId = req.params.id;
    const lead = db.getLeadById(leadId, req.user.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead não encontrado.' });
    }
    const history = db.getLeadHistory(leadId, req.user.id);
    return res.status(200).json({ success: true, lead, history });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

function getUserIgSessionPath(username, userId) {
  const cleanUser = String(username).replace(/[^a-zA-Z0-9._-]/g, '_');
  const userDir = path.join(settings.paths.sessionsDir, `user_${Number(userId)}`);
  const userStd = path.join(userDir, `${cleanUser}.json`);
  const userOld = path.join(userDir, `${cleanUser}_storage.json`);
  if (fs.existsSync(userStd)) return userStd;
  if (fs.existsSync(userOld)) return userOld;

  if (Number(userId) === db.getAdminUserId()) {
    const rootStd = path.join(settings.paths.sessionsDir, `${cleanUser}.json`);
    const rootOld = path.join(settings.paths.sessionsDir, `${cleanUser}_storage.json`);
    if (fs.existsSync(rootStd)) return rootStd;
    if (fs.existsSync(rootOld)) return rootOld;
  }
  return userStd;
}

app.get('/api/dashboard/accounts', (req, res) => {
  try {
    const accounts = db.getAllInstagramAccounts(req.user.id);
    const mapped = accounts.map(a => {
      const sessionFile = getUserIgSessionPath(a.username, req.user.id);
      const hasSession = fs.existsSync(sessionFile);
      const sentToday = db.getDailySentCount(a.username, req.user.id);

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

function saveSessionCookiesForAccount(account, { sessionid, storageState, cookies }, userId) {
  const cleanUser = String(account.username).replace(/[^a-zA-Z0-9._-]/g, '_');
  const userDir = path.join(settings.paths.sessionsDir, `user_${Number(userId)}`);
  const sessionPath = path.join(userDir, `${cleanUser}.json`);

  let finalStorageState = null;

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

  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  fs.writeFileSync(sessionPath, JSON.stringify(finalStorageState, null, 2), 'utf8');
  db.updateInstagramAccountStatus(account.id, 'active', null, userId);
  appendLog('outbound', `Sessão @${account.username} importada com sucesso!`, 'success', userId);

  return { success: true, sessionPath };
}

app.post('/api/dashboard/accounts', (req, res) => {
  try {
    const { username, password, role, proxy, daily_limit, sessionid, storageState, cookies } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, error: 'O nome de usuário é obrigatório.' });
    }

    const hasSessionInput = Boolean(sessionid || storageState || cookies);
    if (!password && !hasSessionInput) {
      return res.status(400).json({ success: false, error: 'Informe a senha ou o cookie de sessão.' });
    }

    let finalRole = role;
    if (!finalRole || (finalRole !== 'sender' && finalRole !== 'scraper')) {
      const stats = db.getDashboardStats(req.user.id);
      finalRole = (stats.scrapersCount <= stats.sendersCount) ? 'scraper' : 'sender';
    }

    const account = db.createInstagramAccount({
      username,
      password: password || '',
      role: finalRole,
      proxy,
      daily_limit: parseInt(daily_limit || '25', 10) || 25,
      userId: req.user.id
    });

    let sessionSaved = false;
    if (hasSessionInput) {
      const sessionRes = saveSessionCookiesForAccount(account, { sessionid, storageState, cookies }, req.user.id);
      sessionSaved = sessionRes.success;
      if (sessionSaved) {
        account.status = 'active';
        account.has_session = true;
      }
    }

    return res.status(201).json({ success: true, account, sessionSaved });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/dashboard/accounts/batch', (req, res) => {
  try {
    const { rawList } = req.body || {};
    if (!rawList || typeof rawList !== 'string') {
      return res.status(400).json({ success: false, error: 'Lista de contas não informada.' });
    }

    const lines = rawList.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhuma linha válida encontrada.' });
    }

    const created = [];
    const errors = [];
    const stats = db.getDashboardStats(req.user.id);
    let currentScrapers = stats.scrapersCount;
    let currentSenders = stats.sendersCount;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length < 2) {
        errors.push(`Linha inválida: "${line}"`);
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
          daily_limit: 25,
          userId: req.user.id
        });

        if (sess) {
          saveSessionCookiesForAccount(account, { sessionid: sess }, req.user.id);
          account.status = 'active';
          account.has_session = true;
        }
        created.push(account);
      } catch (err) {
        errors.push(`@${cleanUser}: ${err.message}`);
      }
    }

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

app.delete('/api/dashboard/accounts/:id', (req, res) => {
  try {
    const account = db.getInstagramAccountById(req.params.id, req.user.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada.' });
    }

    const cleanUser = String(account.username).replace(/[^a-zA-Z0-9._-]/g, '_');
    const userDir = path.join(settings.paths.sessionsDir, `user_${req.user.id}`);
    const userStd = path.join(userDir, `${cleanUser}.json`);
    const userOld = path.join(userDir, `${cleanUser}_storage.json`);
    if (fs.existsSync(userStd)) fs.unlinkSync(userStd);
    if (fs.existsSync(userOld)) fs.unlinkSync(userOld);

    db.deleteInstagramAccount(account.id, req.user.id);
    return res.status(200).json({ success: true, message: 'Conta removida com sucesso.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/dashboard/accounts/:id/session', async (req, res) => {
  const account = db.getInstagramAccountById(req.params.id, req.user.id);
  if (!account) {
    return res.status(404).json({ success: false, error: 'Conta não encontrada.' });
  }

  try {
    const sessionRes = saveSessionCookiesForAccount(account, req.body || {}, req.user.id);
    if (!sessionRes.success) {
      return res.status(400).json({ success: false, error: sessionRes.error });
    }
    return res.status(200).json({
      success: true,
      message: `Cookies salvos para @${account.username}!`,
      sessionPath: sessionRes.sessionPath
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/dashboard/accounts/:id/login', async (req, res) => {
  const account = db.getInstagramAccountById(req.params.id, req.user.id);
  if (!account) {
    return res.status(404).json({ success: false, error: 'Conta não encontrada.' });
  }

  let browser = null;
  try {
    const isHeadless = process.env.NODE_ENV === 'production' || process.env.HEADLESS_BROWSER !== 'false';
    const launchOptions = {
      headless: isHeadless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-blink-features=AutomationControlled']
    };

    if (account.proxy) {
      try {
        const url = new URL(account.proxy);
        launchOptions.proxy = { server: `${url.protocol}//${url.host}`, username: url.username || undefined, password: url.password || undefined };
      } catch {}
    }

    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      viewport: null,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 45000 });
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
        if (submitBtn) await submitBtn.click();
      }
    }

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

    if (!loggedIn) throw new Error('Tempo limite de 120s esgotado sem confirmação de login.');

    const cleanUser = String(account.username).replace(/[^a-zA-Z0-9._-]/g, '_');
    const userDir = path.join(settings.paths.sessionsDir, `user_${req.user.id}`);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    const sessionPath = path.join(userDir, `${cleanUser}.json`);
    await context.storageState({ path: sessionPath });

    db.updateInstagramAccountStatus(account.id, 'active', null, req.user.id);
    await browser.close();

    return res.status(200).json({ success: true, message: `Conta @${account.username} conectada!`, sessionPath });
  } catch (err) {
    if (browser) await browser.close().catch(() => null);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/dashboard/crm-destinations
 * Lista os funis internos da Legado somente para Admin; outros clientes configuram seu próprio Webhook
 */
app.get('/api/dashboard/crm-destinations', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(200).json({ success: true, destinations: [] });
  }

  const defaultDestinations = [
    {
      token: '72504a54-a2c1-4098-ac5d-038dfba26139',
      name: 'Legado Performance (Principal)',
      title: 'Legado Performance (Principal)',
      profile_name: 'Legado Performance - Leads',
      email: 'atendimento@legadomidia.com',
      webhook_name: 'Legado performance',
      label: 'Legado Performance (Principal) — atendimento@legadomidia.com'
    },
    {
      token: '7715dfeb-16ae-4e17-982d-62a9a6848dd3',
      name: 'Funil LEGADO 50K',
      title: 'Funil LEGADO 50K',
      profile_name: 'Legado Performance - Leads',
      email: 'atendimento@legadomidia.com',
      webhook_name: 'LEGADO 50K',
      label: 'Funil LEGADO 50K — atendimento@legadomidia.com'
    },
    {
      token: 'a366107c-8851-4389-acdd-7c65cfe24c4b',
      name: 'Funil LEGADO 20K A 50K',
      title: 'Funil LEGADO 20K A 50K',
      profile_name: 'Legado Performance - Leads',
      email: 'atendimento@legadomidia.com',
      webhook_name: 'LEGADO DE 20K A 50K',
      label: 'Funil LEGADO 20K A 50K — atendimento@legadomidia.com'
    },
    {
      token: '56fc43d8-961b-44b1-9153-1979ae9fb1ba',
      name: 'Funil LEGADO 10K A 20K',
      title: 'Funil LEGADO 10K A 20K',
      profile_name: 'Legado Performance - Leads',
      email: 'atendimento@legadomidia.com',
      webhook_name: 'LEGADO 10K A 20K',
      label: 'Funil LEGADO 10K A 20K — atendimento@legadomidia.com'
    }
  ];

  try {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://xndcrwpnwfmwxmulziwo.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceKey) {
      return res.status(200).json({ success: true, destinations: defaultDestinations });
    }

    const [usersRes, webhooksRes] = await Promise.all([
      axios.get(`${supabaseUrl}/auth/v1/admin/users?per_page=100`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        timeout: 4000
      }).catch(() => ({ data: { users: [] } })),
      axios.get(`${supabaseUrl}/rest/v1/capture_webhooks?select=*`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        timeout: 4000
      }).catch(() => ({ data: [] }))
    ]);

    const userMap = {};
    (usersRes.data?.users || []).forEach(u => { userMap[u.id] = (u.email || '').toLowerCase().trim(); });

    const webhooks = webhooksRes.data || [];
    const dynamicDestinations = [];
    for (const w of webhooks) {
      if (!w.token) continue;
      const email = userMap[w.user_id] || '';
      if (email !== 'atendimento@legadomidia.com') continue;

      let name = 'Legado Performance';
      if (w.token === '72504a54-a2c1-4098-ac5d-038dfba26139') name = 'Legado Performance (Principal)';
      else if (w.token === '7715dfeb-16ae-4e17-982d-62a9a6848dd3') name = 'Funil LEGADO 50K';
      else if (w.token === 'a366107c-8851-4389-acdd-7c65cfe24c4b') name = 'Funil LEGADO 20K A 50K';
      else if (w.token === '56fc43d8-961b-44b1-9153-1979ae9fb1ba') name = 'Funil LEGADO 10K A 20K';
      else if (w.name) name = `Funil ${w.name}`;

      dynamicDestinations.push({
        token: w.token,
        name,
        title: name,
        profile_name: 'Legado Performance - Leads',
        email: 'atendimento@legadomidia.com',
        webhook_name: w.name,
        label: `${name} — atendimento@legadomidia.com`
      });
    }

    if (dynamicDestinations.length > 0) {
      const orderPriority = {
        '72504a54-a2c1-4098-ac5d-038dfba26139': 1,
        '7715dfeb-16ae-4e17-982d-62a9a6848dd3': 2,
        'a366107c-8851-4389-acdd-7c65cfe24c4b': 3,
        '56fc43d8-961b-44b1-9153-1979ae9fb1ba': 4
      };
      dynamicDestinations.sort((a, b) => (orderPriority[a.token] || 99) - (orderPriority[b.token] || 99));
      return res.status(200).json({ success: true, destinations: dynamicDestinations });
    }

    return res.status(200).json({ success: true, destinations: defaultDestinations });
  } catch {
    return res.status(200).json({ success: true, destinations: defaultDestinations });
  }
});

/**
 * GET /api/dashboard/config
 * Lê estritamente as configurações de app_settings WHERE user_id = req.user.id
 */
app.get('/api/dashboard/config', (req, res) => {
  try {
    const uid = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const dispatcher = getDispatcherForUser(uid);

    const rawOpenAiKey = db.getSetting('openai_api_key', null, uid) || (isAdmin ? process.env.OPENAI_API_KEY || '' : '');
    const maskedOpenAiKey = rawOpenAiKey && rawOpenAiKey.length > 8
      ? (rawOpenAiKey.slice(0, 7) + '...' + rawOpenAiKey.slice(-4))
      : rawOpenAiKey;

    const currentColdPitch = db.getSetting('whatsapp_cold_pitch_template', null, uid) || db.getSetting('whatsapp_pitch_template', null, uid) || settings.defaults.whatsappColdPitchTemplate;
    const currentInstaPitch = db.getSetting('instagram_cold_pitch_template', null, uid) || settings.defaults.instagramColdPitchTemplate;
    const currentAmandaInbound = db.getSetting('amanda_inbound_instructions', null, uid) || settings.defaults.amandaInboundInstructions;
    const currentAmandaOutbound = db.getSetting('amanda_outbound_instructions', null, uid) || settings.defaults.amandaOutboundInstructions;
    const currentIcpMinRevenue = Number(db.getSetting('icp_min_revenue', null, uid)) || settings.defaults.icpMinRevenue || 30000;
    const currentDestinationToken = db.getSetting('crm_destination_token', null, uid) || (isAdmin ? settings.defaults.crmDestinationToken : '');

    const currentMinDelay = Number(db.getSetting('whatsapp_min_delay', null, uid)) || dispatcher.minDelaySeconds || 60;
    const currentMaxDelay = Number(db.getSetting('whatsapp_max_delay', null, uid)) || dispatcher.maxDelaySeconds || 120;
    const sdrPhone = db.getSetting('sdr_notification_phone', null, uid) || (isAdmin ? process.env.SDR_NOTIFICATION_PHONE || '' : '');
    const crmUrl = db.getSetting('crm_webhook_url', null, uid) || (isAdmin ? process.env.CRM_WEBHOOK_URL || `https://central.legadomidia.com/api/capture/${currentDestinationToken}` : '');
    const crmKey = db.getSetting('crm_api_key', null, uid) || (isAdmin ? process.env.CRM_API_BEARER_TOKEN || '' : '');

    const officialUser = db.getSetting('official_instagram_user', null, uid) || '';
    const officialAiActive = db.getSetting('official_ai_enabled', '1', uid) !== '0' ? '1' : '0';
    const officialIcpCriteria = db.getSetting('official_icp_criteria', null, uid) || `Faturamento mensal mínimo a partir de R$ ${currentIcpMinRevenue.toLocaleString('pt-BR')}/mês.`;

    let inboundToken = db.getSetting('inbound_webhook_token', null, uid);
    if (!inboundToken) {
      inboundToken = 'wh_' + crypto.randomBytes(12).toString('hex');
      db.setSetting('inbound_webhook_token', inboundToken, uid);
    }

    return res.status(200).json({
      success: true,
      config: {
        OPENAI_API_KEY: maskedOpenAiKey,
        SDR_NOTIFICATION_PHONE: sdrPhone,
        CRM_WEBHOOK_URL: crmUrl,
        CRM_API_KEY: crmKey,
        CRM_DESTINATION_TOKEN: currentDestinationToken,
        ICP_MIN_REVENUE: currentIcpMinRevenue,
        WHATSAPP_COLD_PITCH_TEMPLATE: currentColdPitch,
        WHATSAPP_PITCH_TEMPLATE: currentColdPitch,
        INSTAGRAM_COLD_PITCH_TEMPLATE: currentInstaPitch,
        AMANDA_INBOUND_INSTRUCTIONS: currentAmandaInbound,
        AMANDA_OUTBOUND_INSTRUCTIONS: currentAmandaOutbound,
        WHATSAPP_MIN_DELAY: currentMinDelay,
        WHATSAPP_MAX_DELAY: currentMaxDelay,
        OFFICIAL_INSTAGRAM_USER: officialUser,
        OFFICIAL_AI_ENABLED: officialAiActive,
        OFFICIAL_ICP_CRITERIA: officialIcpCriteria,
        INBOUND_WEBHOOK_PATH: `/api/inbound/webhook/${uid}?token=${inboundToken}`
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dashboard/config
 * Grava configurações estritamente no tenant req.user.id
 */
app.post('/api/dashboard/config', (req, res) => {
  try {
    const uid = req.user.id;
    const {
      OPENAI_API_KEY,
      SDR_NOTIFICATION_PHONE,
      CRM_WEBHOOK_URL,
      CRM_API_KEY,
      CRM_DESTINATION_TOKEN,
      ICP_MIN_REVENUE,
      WHATSAPP_COLD_PITCH_TEMPLATE,
      WHATSAPP_PITCH_TEMPLATE,
      INSTAGRAM_COLD_PITCH_TEMPLATE,
      AMANDA_INBOUND_INSTRUCTIONS,
      AMANDA_OUTBOUND_INSTRUCTIONS,
      WHATSAPP_MIN_DELAY,
      WHATSAPP_MAX_DELAY,
      OFFICIAL_INSTAGRAM_USER,
      OFFICIAL_AI_ENABLED,
      OFFICIAL_ICP_CRITERIA
    } = req.body || {};

    if (OPENAI_API_KEY && !String(OPENAI_API_KEY).includes('...')) {
      db.setSetting('openai_api_key', OPENAI_API_KEY.trim(), uid);
    }
    if (SDR_NOTIFICATION_PHONE !== undefined) {
      db.setSetting('sdr_notification_phone', String(SDR_NOTIFICATION_PHONE).trim(), uid);
    }
    if (CRM_DESTINATION_TOKEN !== undefined && String(CRM_DESTINATION_TOKEN).trim() !== '') {
      const cleanToken = String(CRM_DESTINATION_TOKEN).trim();
      db.setSetting('crm_destination_token', cleanToken, uid);
      db.setSetting('crm_webhook_url', `https://central.legadomidia.com/api/capture/${cleanToken}`, uid);
    } else if (CRM_WEBHOOK_URL !== undefined) {
      db.setSetting('crm_webhook_url', String(CRM_WEBHOOK_URL).trim(), uid);
    }
    if (CRM_API_KEY !== undefined) {
      db.setSetting('crm_api_key', String(CRM_API_KEY).trim(), uid);
    }

    if (ICP_MIN_REVENUE !== undefined) {
      const parsedRev = parseInt(String(ICP_MIN_REVENUE).replace(/\D/g, '') || '30000', 10);
      db.setSetting('icp_min_revenue', parsedRev, uid);
    }

    const activeColdPitch = WHATSAPP_COLD_PITCH_TEMPLATE !== undefined ? WHATSAPP_COLD_PITCH_TEMPLATE : WHATSAPP_PITCH_TEMPLATE;
    if (activeColdPitch !== undefined) {
      db.setSetting('whatsapp_cold_pitch_template', String(activeColdPitch).trim(), uid);
      db.setSetting('whatsapp_pitch_template', String(activeColdPitch).trim(), uid);
    }

    if (INSTAGRAM_COLD_PITCH_TEMPLATE !== undefined) {
      db.setSetting('instagram_cold_pitch_template', String(INSTAGRAM_COLD_PITCH_TEMPLATE).trim(), uid);
    }
    if (AMANDA_INBOUND_INSTRUCTIONS !== undefined) {
      db.setSetting('amanda_inbound_instructions', String(AMANDA_INBOUND_INSTRUCTIONS).trim(), uid);
    }
    if (AMANDA_OUTBOUND_INSTRUCTIONS !== undefined) {
      db.setSetting('amanda_outbound_instructions', String(AMANDA_OUTBOUND_INSTRUCTIONS).trim(), uid);
    }

    if (WHATSAPP_MIN_DELAY !== undefined) {
      db.setSetting('whatsapp_min_delay', parseInt(WHATSAPP_MIN_DELAY, 10), uid);
    }
    if (WHATSAPP_MAX_DELAY !== undefined) {
      db.setSetting('whatsapp_max_delay', parseInt(WHATSAPP_MAX_DELAY, 10), uid);
    }
    if (OFFICIAL_INSTAGRAM_USER !== undefined) {
      db.setSetting('official_instagram_user', String(OFFICIAL_INSTAGRAM_USER).replace(/^@/, '').trim(), uid);
    }
    if (OFFICIAL_AI_ENABLED !== undefined) {
      db.setSetting('official_ai_enabled', String(OFFICIAL_AI_ENABLED) === '1' || OFFICIAL_AI_ENABLED === true ? '1' : '0', uid);
    }
    if (OFFICIAL_ICP_CRITERIA !== undefined) {
      db.setSetting('official_icp_criteria', String(OFFICIAL_ICP_CRITERIA).trim(), uid);
    }

    getDispatcherForUser(uid).updateConfig({
      minDelaySeconds: WHATSAPP_MIN_DELAY,
      maxDelaySeconds: WHATSAPP_MAX_DELAY,
      pitchTemplate: activeColdPitch
    });

    return res.status(200).json({
      success: true,
      message: 'Configurações da sua conta salvas com sucesso!'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/dashboard/config/reset-templates', (req, res) => {
  try {
    const uid = req.user.id;
    const templates = {
      WHATSAPP_COLD_PITCH_TEMPLATE: settings.defaults.whatsappColdPitchTemplate,
      INSTAGRAM_COLD_PITCH_TEMPLATE: settings.defaults.instagramColdPitchTemplate,
      AMANDA_INBOUND_INSTRUCTIONS: settings.defaults.amandaInboundInstructions,
      AMANDA_OUTBOUND_INSTRUCTIONS: settings.defaults.amandaOutboundInstructions,
      ICP_MIN_REVENUE: settings.defaults.icpMinRevenue || 30000,
      whatsapp_cold_pitch_template: settings.defaults.whatsappColdPitchTemplate,
      instagram_cold_pitch_template: settings.defaults.instagramColdPitchTemplate,
      amanda_inbound_instructions: settings.defaults.amandaInboundInstructions,
      amanda_outbound_instructions: settings.defaults.amandaOutboundInstructions,
      icp_min_revenue: settings.defaults.icpMinRevenue || 30000
    };

    db.setSetting('whatsapp_cold_pitch_template', templates.WHATSAPP_COLD_PITCH_TEMPLATE, uid);
    db.setSetting('instagram_cold_pitch_template', templates.INSTAGRAM_COLD_PITCH_TEMPLATE, uid);
    db.setSetting('amanda_inbound_instructions', templates.AMANDA_INBOUND_INSTRUCTIONS, uid);
    db.setSetting('amanda_outbound_instructions', templates.AMANDA_OUTBOUND_INSTRUCTIONS, uid);
    db.setSetting('icp_min_revenue', templates.ICP_MIN_REVENUE, uid);

    return res.status(200).json({
      success: true,
      message: 'Textos padrão restaurados com sucesso.',
      templates
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/dashboard/leads/:id/sync-crm', async (req, res) => {
  try {
    const lead = db.getLeadById(req.params.id, req.user.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead não encontrado no banco.' });
    }

    const result = await crmClient.sendLeadToCrm(lead);
    if (result.success) {
      db.markLeadCrmSynced(lead.id, req.user.id);
      return res.status(200).json({ success: true, message: 'Lead enviado e Dossiê injetado no CRM com sucesso!', result });
    }
    return res.status(400).json({ success: false, error: result.error });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// ROTAS DE WHATSAPP BAILEYS MULTI-TENANT (ISOLADAS POR req.user.id & max_chips)
// ============================================================================
app.get('/api/whatsapp/sessions', (req, res) => {
  try {
    const status = getNativeStatusForUser(req.user.id);
    return res.status(200).json({
      success: true,
      sessions: status.sessions,
      maxChips: status.maxChips
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/sessions', (req, res) => {
  try {
    const { session_name } = req.body || {};
    const created = db.createWaSession(req.user.id, session_name);
    return res.status(201).json({ success: true, session: created });
  } catch (err) {
    const code = err.message.includes('Limite máximo') ? 403 : 400;
    return res.status(code).json({ success: false, error: err.message });
  }
});

app.delete('/api/whatsapp/sessions/:id', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    const existing = db.getWaSessionById(sid, req.user.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Sessão não encontrada.' });
    }
    await disconnectNativeWhatsAppForSession(req.user.id, sid);
    db.deleteWaSession(sid, req.user.id);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/whatsapp/status', (req, res) => {
  try {
    const sessionId = req.query.sessionId ? Number(req.query.sessionId) : null;
    const status = getNativeStatusForUser(req.user.id, sessionId);
    return res.status(200).json({ success: true, ...status });
  } catch (err) {
    return res.status(404).json({ success: false, error: err.message });
  }
});

app.get('/api/whatsapp/qr', (req, res) => {
  try {
    const sessionId = req.query.sessionId ? Number(req.query.sessionId) : null;
    const status = getNativeStatusForUser(req.user.id, sessionId);
    const qr = getNativeQrCodeForUser(req.user.id, sessionId);
    return res.status(200).json({
      success: true,
      qr,
      state: status.state,
      connected: status.connected,
      user: status.user,
      activeSession: status.activeSession,
      sessions: status.sessions,
      maxChips: status.maxChips
    });
  } catch (err) {
    return res.status(404).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/reconnect', async (req, res) => {
  try {
    const sessionId = req.body?.sessionId || req.query.sessionId || null;
    initNativeWhatsAppForSession(req.user.id, sessionId).catch(err => {
      console.warn(`⚠️ [WhatsApp User #${req.user.id}] Aviso ao reinicializar: ${err.message}`);
    });
    return res.status(200).json({
      success: true,
      message: 'Reconexão iniciada com sucesso. Verifique o QR Code.'
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    const sessionId = req.body?.sessionId || req.query.sessionId || null;
    const result = await disconnectNativeWhatsAppForSession(req.user.id, sessionId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ============================================================================
// FILA DE DISPARO WHATSAPP, VALIDAÇÃO, MINERADOR E OUTBOUND (POR TENANT)
// ============================================================================
app.get('/api/dashboard/whatsapp-dispatcher/status', (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      status: getDispatcherForUser(req.user.id).getStatus()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/dashboard/whatsapp-dispatcher/toggle', (req, res) => {
  try {
    const status = getDispatcherForUser(req.user.id).toggle();
    return res.status(200).json({ success: true, status });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/dashboard/whatsapp-dispatcher/config', (req, res) => {
  try {
    const status = getDispatcherForUser(req.user.id).updateConfig(req.body);
    return res.status(200).json({ success: true, status });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post(['/api/dashboard/validate-leads-wa', '/api/dashboard/revalidate-whatsapp'], async (req, res) => {
  try {
    const uid = req.user.id;
    if (!isNativeConnectedForUser(uid)) {
      return res.status(400).json({
        success: false,
        error: 'Seu WhatsApp Baileys não está conectado. Conecte pelo QR Code primeiro.'
      });
    }

    const unverifiedLeads = db.db.prepare(`
      SELECT id, phone, phone_type, status
      FROM leads
      WHERE user_id = ?
        AND phone IS NOT NULL
        AND (is_whatsapp_active IS NULL OR is_whatsapp_active = -1 OR is_whatsapp_active = 0 OR status = 'no_whatsapp')
    `).all(uid);

    if (unverifiedLeads.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Todos os seus leads com telefone já estão validados.',
        checkedCount: 0,
        activeCount: 0
      });
    }

    const phoneList = unverifiedLeads.map(l => l.phone);
    const waResults = await waChecker.validateNumbers(phoneList, 10, uid);

    let activeCount = 0;
    let noWaCount = 0;
    const updateActiveStmt = db.db.prepare(`
      UPDATE leads
      SET is_whatsapp_active = 1,
          status = CASE WHEN status = 'no_whatsapp' OR status = 'new' THEN 'in_qualification' ELSE status END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);
    const updateNoWaStmt = db.db.prepare(`
      UPDATE leads
      SET is_whatsapp_active = 0,
          status = 'no_whatsapp',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    for (const lead of unverifiedLeads) {
      const resItem = waResults.get(lead.phone);
      if (resItem && resItem.exists) {
        updateActiveStmt.run(lead.id, uid);
        activeCount++;
      } else if (resItem && !resItem.exists && !resItem.isOffline) {
        updateNoWaStmt.run(lead.id, uid);
        noWaCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Validação concluída: ${activeCount} ativos e ${noWaCount} sem WhatsApp.`,
      checkedCount: unverifiedLeads.length,
      activeCount,
      noWaCount
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/dashboard/miner', async (req, res) => {
  try {
    const uid = req.user.id;
    const state = getMinerState(uid);
    if (state.status === 'running') {
      return res.status(409).json({
        success: false,
        error: 'Uma mineração no Google Maps já está em execução para sua conta.'
      });
    }

    const query = req.body.query?.trim() || 'Clinica Odontologica Barueri SP';
    const limit = parseInt(req.body.limit || '5', 10);

    Object.assign(state, {
      status: 'running',
      query,
      limit,
      startedAt: new Date().toISOString(),
      completedAt: null,
      lastResult: null,
      error: null
    });

    appendLog('miner', `Iniciando varredura no Google Maps para "${query}" (${limit} alvos)...`, 'info', uid);

    runGmnPipeline({ query, limit, fromApi: true, userId: uid })
      .then(result => {
        state.status = 'completed';
        state.completedAt = new Date().toISOString();
        state.lastResult = result;
        appendLog('miner', `Mineração concluída! ${result.total} empresas salvas.`, 'success', uid);
      })
      .catch(err => {
        state.status = 'error';
        state.completedAt = new Date().toISOString();
        state.error = err.message;
        appendLog('miner', `Falha na mineração: ${err.message}`, 'error', uid);
      });

    return res.status(200).json({
      success: true,
      message: `Mineração iniciada para "${query}" (${limit} estabelecimentos).`,
      task: state
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/dashboard/outbound', async (req, res) => {
  try {
    const uid = req.user.id;
    const state = getOutboundState(uid);
    if (state.status === 'running') {
      return res.status(409).json({
        success: false,
        error: 'Um disparo de Outbound Instagram já está em execução para sua conta.'
      });
    }

    const accounts = db.getAllInstagramAccounts(uid);
    const scrapersCount = accounts.filter(a => a.role === 'scraper').length;
    const sendersCount = accounts.filter(a => a.role === 'sender').length;

    if (scrapersCount === 0 || sendersCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma conta Scraper/Sender conectada na sua conta.'
      });
    }

    const target = req.body.target ? req.body.target.replace('@', '').trim() : null;
    const limit = parseInt(req.body.limit || '10', 10);

    Object.assign(state, {
      status: 'running',
      target,
      limit,
      startedAt: new Date().toISOString(),
      completedAt: null,
      lastResult: null,
      error: null
    });

    appendLog('outbound', `Iniciando Outbound para @${target || 'leads pendentes'} (${limit} alvos)...`, 'info', uid);

    runOutboundPipeline({ target, limit, fromApi: true, userId: uid })
      .then(result => {
        state.status = 'completed';
        state.completedAt = new Date().toISOString();
        state.lastResult = result;
        appendLog('outbound', `Outbound concluído com sucesso: ${result.sent} DMs enviadas.`, 'success', uid);
      })
      .catch(err => {
        state.status = 'error';
        state.completedAt = new Date().toISOString();
        state.error = err.message;
        appendLog('outbound', `Falha no Outbound: ${err.message}`, 'error', uid);
      });

    return res.status(200).json({
      success: true,
      message: `Fluxo de Outbound iniciado para @${target || 'leads pendentes'}.`,
      task: state
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/dashboard/exports', (req, res) => {
  try {
    const uid = req.user.id;
    const userDir = path.join(settings.paths.exportsDir, `user_${uid}`);
    const files = [];

    const collectFromDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const fileName of fs.readdirSync(dir)) {
        if (!fileName.endsWith('.xlsx')) continue;
        const fullPath = path.join(dir, fileName);
        if (!fs.statSync(fullPath).isFile()) continue;
        const stat = fs.statSync(fullPath);
        files.push({
          name: fileName,
          sizeBytes: stat.size,
          sizeFormatted: `${(stat.size / 1024).toFixed(1)} KB`,
          createdAt: stat.birthtime,
          downloadUrl: `/api/dashboard/exports/${encodeURIComponent(fileName)}`
        });
      }
    };

    collectFromDir(userDir);
    if (req.user.role === 'admin') {
      collectFromDir(settings.paths.exportsDir);
    }

    files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ success: true, count: files.length, files });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/dashboard/exports/:filename', (req, res) => {
  try {
    const safeFileName = path.basename(req.params.filename);
    const userPath = path.join(settings.paths.exportsDir, `user_${req.user.id}`, safeFileName);
    const legacyAdminPath = req.user.role === 'admin'
      ? path.join(settings.paths.exportsDir, safeFileName)
      : null;

    if (fs.existsSync(userPath)) {
      return res.download(userPath, safeFileName);
    }
    if (legacyAdminPath && fs.existsSync(legacyAdminPath)) {
      return res.download(legacyAdminPath, safeFileName);
    }
    return res.status(404).json({ success: false, error: 'Planilha não encontrada.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get(['/', '/dashboard'], (req, res) => {
  const dashboardHtml = path.resolve('public', 'index.html');
  if (fs.existsSync(dashboardHtml)) {
    return res.sendFile(dashboardHtml);
  }
  return res.send('Dashboard Web Carregando...');
});

const PORT = settings.server.port;
const server = app.listen(PORT, () => {
  console.log(`🚀 [Legado SDR SaaS] Servidor multi-tenant ativo na porta ${PORT}`);
  initPersistedWhatsAppSessions().catch(err => {
    console.warn(`⚠️ [WhatsApp Baileys] Inicialização em background: ${err.message}`);
  });
});

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
