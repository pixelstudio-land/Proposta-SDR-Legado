import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import EventEmitter from 'events';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { settings } from '../../config/settings.js';
import db from '../database/db.js';

const dataRoot = path.dirname(settings.database.path);
const baseWaSessionsDir = path.join(dataRoot, 'wa_sessions');

if (!fs.existsSync(baseWaSessionsDir)) {
  fs.mkdirSync(baseWaSessionsDir, { recursive: true });
}

/**
 * Gerenciador de Sessões Baileys Multi-Tenant (SessionPool)
 * Chave estrita no Map: `${user_id}:${chip_id}`
 * Diretório estrito no disco: `/data/wa_sessions/user_${user_id}/chip_${chip_id}`
 */
export const sessions = new Map();
export const waEventBus = new EventEmitter();
waEventBus.setMaxListeners(500);

export function getSessionKey(userId, chipId) {
  return `${Number(userId)}:${Number(chipId)}`;
}

export function getSessionEventChannel(userId, chipId) {
  return `session:${Number(userId)}:${Number(chipId)}`;
}

export function getSessionFullAuthDir(userId, chipId) {
  return path.join(baseWaSessionsDir, `user_${Number(userId)}`, `chip_${Number(chipId)}`);
}

function getOrCreateRuntime(sessionRow) {
  const uid = Number(sessionRow.user_id);
  const sid = Number(sessionRow.id);
  const key = getSessionKey(uid, sid);

  let rt = sessions.get(key);
  if (!rt) {
    const initialState = sessionRow.status === 'RESTRITO'
      ? 'RESTRITO'
      : 'DISCONNECTED';

    rt = {
      key,
      sessionId: sid,
      chipId: sid,
      userId: uid,
      sessionName: sessionRow.session_name,
      sock: null,
      state: initialState,
      qrCodeDataUrl: null,
      qrRaw: null,
      connectedUserNumber: sessionRow.phone_number || null,
      wasConnected: false,
      reconnectAttempts: 0,
      reconnectTimer: null,
      isInitializing: false
    };
    sessions.set(key, rt);
  } else {
    rt.sessionName = sessionRow.session_name;
  }
  return rt;
}

function emitSessionUpdate(userId, chipId, extra = {}) {
  const uid = Number(userId);
  const sid = Number(chipId);
  const payload = {
    ...getNativeStatusForUser(uid, sid),
    userId: uid,
    chipId: sid,
    sessionKey: getSessionKey(uid, sid),
    timestamp: Date.now(),
    ...extra
  };
  waEventBus.emit(getSessionEventChannel(uid, sid), payload);
  return payload;
}

export function subscribeSessionEvents(userId, chipId, listener) {
  const channel = getSessionEventChannel(userId, chipId);
  waEventBus.on(channel, listener);
  return () => {
    waEventBus.off(channel, listener);
  };
}

export const SessionPool = {
  map: sessions,
  key: getSessionKey,
  get(userId, chipId) {
    return sessions.get(getSessionKey(userId, chipId)) || null;
  },
  getByKey(sessionKey) {
    return sessions.get(sessionKey) || null;
  },
  set(userId, chipId, runtime) {
    sessions.set(getSessionKey(userId, chipId), runtime);
  },
  delete(userId, chipId) {
    return sessions.delete(getSessionKey(userId, chipId));
  },
  getAuthDir: getSessionFullAuthDir,
  subscribe: subscribeSessionEvents
};

/**
 * Resolve o chip (wa_sessions) alvo pertencente exclusivamente ao userId informado
 */
export function resolveSessionForUser(userId, sessionId = null) {
  const uid = Number(userId);
  if (!uid) throw new Error('userId obrigatório para operar sessões WhatsApp.');

  if (sessionId) {
    const specific = db.getWaSessionById(Number(sessionId), uid);
    if (!specific) {
      throw new Error('Sessão de WhatsApp não encontrada para este usuário.');
    }
    return specific;
  }

  let userSessions = db.getWaSessionsByUser(uid);
  if (userSessions.length === 0) {
    const created = db.createWaSession(uid, 'Chip Principal');
    userSessions = [created];
  }

  // Prefere sessão conectada em memória e não restrita
  for (const s of userSessions) {
    if (s.status === 'RESTRITO') continue;
    const rt = sessions.get(getSessionKey(uid, s.id));
    if (rt && rt.state === 'CONNECTED' && rt.sock) {
      return s;
    }
  }
  return userSessions.find(s => s.status !== 'RESTRITO') || userSessions[0];
}

function clearRuntimeReconnectTimer(rt) {
  if (rt?.reconnectTimer) {
    clearTimeout(rt.reconnectTimer);
    rt.reconnectTimer = null;
  }
}

function closeSocketSafely(sock) {
  if (!sock) return;
  try {
    sock.ev?.removeAllListeners?.('connection.update');
    sock.ev?.removeAllListeners?.('creds.update');
    sock.end(undefined);
  } catch (_) {}
}

/**
 * Inicializa em background apenas sessões com credenciais salvas, dono ativo e não restritas
 */
export async function initPersistedWhatsAppSessions() {
  try {
    const allSessions = db.getAllWaSessions();
    for (const s of allSessions) {
      if (!s.user_active || s.status === 'RESTRITO') continue;
      const fullDir = getSessionFullAuthDir(s.user_id, s.id);
      if (fs.existsSync(path.join(fullDir, 'creds.json'))) {
        initNativeWhatsAppForSession(s.user_id, s.id).catch(err => {
          console.warn(`⚠️ [SessionPool] Reconexão automática ${getSessionKey(s.user_id, s.id)}: ${err.message}`);
        });
      }
    }
  } catch (err) {
    console.warn(`⚠️ [SessionPool] Erro ao inicializar sessões persistidas: ${err.message}`);
  }
}

/**
 * Marca um chip como RESTRITO no SQLite e encerra seu socket na SessionPool
 */
export function markSessionRestricted(userId, chipId, reason = 'Restrição detectada pela Meta/WhatsApp') {
  const uid = Number(userId);
  const sid = Number(chipId);
  const key = getSessionKey(uid, sid);
  const rt = sessions.get(key);

  if (rt) {
    clearRuntimeReconnectTimer(rt);
    if (rt.sock) {
      const activeSock = rt.sock;
      rt.sock = null;
      closeSocketSafely(activeSock);
    }
    rt.state = 'RESTRITO';
    rt.qrCodeDataUrl = null;
    rt.qrRaw = null;
    rt.isInitializing = false;
  }

  db.updateWaSession(sid, uid, { status: 'RESTRITO' });
  console.warn(`⛔ [SessionPool] Chip ${key} marcado como RESTRITO: ${reason}`);
  emitSessionUpdate(uid, sid, { restrictedReason: reason });
}

/**
 * Inicializa uma instância Baileys isolada em /data/wa_sessions/user_{user_id}/chip_{chip_id}
 */
export async function initNativeWhatsAppForSession(userId, sessionId = null, { forceRestart = false } = {}) {
  const sessionRow = resolveSessionForUser(userId, sessionId);
  const uid = Number(sessionRow.user_id);
  const sid = Number(sessionRow.id);
  const rt = getOrCreateRuntime(sessionRow);

  clearRuntimeReconnectTimer(rt);

  if (sessionRow.status === 'RESTRITO' && !forceRestart) {
    rt.state = 'RESTRITO';
    emitSessionUpdate(uid, sid);
    return rt.sock;
  }

  if (forceRestart && rt.sock) {
    const oldSock = rt.sock;
    rt.sock = null;
    closeSocketSafely(oldSock);
    rt.isInitializing = false;
    rt.qrCodeDataUrl = null;
    rt.qrRaw = null;
    rt.reconnectAttempts = 0;
  }

  if (!forceRestart && rt.sock && (rt.state === 'CONNECTED' || rt.state === 'QR_READY' || rt.state === 'CONNECTING')) {
    return rt.sock;
  }

  if (rt.isInitializing) {
    return rt.sock;
  }
  rt.isInitializing = true;

  const fullAuthDir = getSessionFullAuthDir(uid, sid);

  try {
    if (!fs.existsSync(fullAuthDir)) {
      fs.mkdirSync(fullAuthDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(fullAuthDir);
    let version = [2, 3000, 1015901307];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v?.version) version = v.version;
    } catch (_) {}

    rt.state = 'CONNECTING';
    rt.qrCodeDataUrl = null;
    rt.qrRaw = null;
    db.updateWaSession(sid, uid, { status: 'CONNECTING' });
    emitSessionUpdate(uid, sid);

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: [`Legado SDR #${sid}`, 'Chrome', '124.0.0'],
      generateHighQualityLinkPreview: true
    });

    rt.sock = sock;
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      if (rt.sock !== sock) return;

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        rt.state = 'QR_READY';
        rt.qrRaw = qr;
        try {
          rt.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 3, scale: 8 });
        } catch {
          rt.qrCodeDataUrl = null;
        }
        db.updateWaSession(sid, uid, { status: 'QR_READY' });
        console.log(`📱 [SessionPool] QR Code pronto para chip ${rt.key} (${rt.sessionName})`);
        emitSessionUpdate(uid, sid);
      }

      if (connection === 'open') {
        rt.state = 'CONNECTED';
        rt.wasConnected = true;
        rt.qrCodeDataUrl = null;
        rt.qrRaw = null;
        rt.connectedUserNumber = sock.user?.id ? sock.user.id.split(':')[0].replace(/\D/g, '') : 'Conectado';
        rt.reconnectAttempts = 0;

        db.updateWaSession(sid, uid, {
          status: 'CONNECTED',
          phone_number: rt.connectedUserNumber,
          last_connected_at: new Date().toISOString()
        });

        console.log(`✅ [SessionPool] Chip ${rt.key} (${rt.sessionName}) conectado: +${rt.connectedUserNumber}`);
        emitSessionUpdate(uid, sid);

        setTimeout(() => {
          revalidateOfflineLeadsForUser(uid, sid).catch(err => {
            console.warn(`⚠️ [SessionPool] Aviso revalidação ${rt.key}: ${err.message}`);
          });
        }, 3500);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const wasConnectedBefore = rt.wasConnected;

        rt.sock = null;
        rt.qrCodeDataUrl = null;
        rt.qrRaw = null;
        rt.isInitializing = false;

        // Se o chip já estava em uso ou recebeu 403/401/428 crítico de restrição/sessão revogada
        if (statusCode === 403 || (wasConnectedBefore && (statusCode === 401 || statusCode === 428))) {
          markSessionRestricted(uid, sid, `Desconexão crítica código ${statusCode}`);
          return;
        }

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        rt.state = 'DISCONNECTED';
        rt.connectedUserNumber = null;
        rt.wasConnected = false;
        db.updateWaSession(sid, uid, { status: 'DISCONNECTED', phone_number: null });
        emitSessionUpdate(uid, sid);

        const currentUser = db.getUserById(uid);
        const currentChip = db.getWaSessionById(sid, uid);
        if (!currentUser || !currentUser.active || !currentChip || currentChip.status === 'RESTRITO') {
          return;
        }

        if (shouldReconnect) {
          if (rt.reconnectAttempts < 8) {
            rt.reconnectAttempts++;
            clearRuntimeReconnectTimer(rt);
            rt.reconnectTimer = setTimeout(() => {
              rt.reconnectTimer = null;
              if (db.getWaSessionById(sid, uid)) {
                initNativeWhatsAppForSession(uid, sid).catch(() => {});
              }
            }, statusCode === DisconnectReason.restartRequired ? 1000 : 3500);
          }
        } else {
          try {
            fs.rmSync(fullAuthDir, { recursive: true, force: true });
          } catch (_) {}
        }
      }
    });

    rt.isInitializing = false;
    return sock;
  } catch (error) {
    rt.isInitializing = false;
    rt.state = 'DISCONNECTED';
    db.updateWaSession(sid, uid, { status: 'DISCONNECTED' });
    emitSessionUpdate(uid, sid, { error: error.message });
    throw error;
  }
}

/**
 * Desconecta e limpa credenciais apenas da sessão pertencente ao userId
 */
export async function disconnectNativeWhatsAppForSession(userId, sessionId = null) {
  const sessionRow = resolveSessionForUser(userId, sessionId);
  const uid = Number(sessionRow.user_id);
  const sid = Number(sessionRow.id);
  const rt = getOrCreateRuntime(sessionRow);
  const fullAuthDir = getSessionFullAuthDir(uid, sid);

  try {
    clearRuntimeReconnectTimer(rt);
    if (rt.sock) {
      const activeSock = rt.sock;
      rt.sock = null;
      closeSocketSafely(activeSock);
    }
    rt.state = 'DISCONNECTED';
    rt.wasConnected = false;
    rt.qrCodeDataUrl = null;
    rt.qrRaw = null;
    rt.connectedUserNumber = null;
    rt.reconnectAttempts = 0;
    rt.isInitializing = false;

    db.updateWaSession(sid, uid, { status: 'DISCONNECTED', phone_number: null });

    if (fs.existsSync(fullAuthDir)) {
      fs.rmSync(fullAuthDir, { recursive: true, force: true });
    }
    emitSessionUpdate(uid, sid);
    return { success: true, message: 'WhatsApp desconectado e credenciais removidas.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Exclui explicitamente um chip: encerra socket Baileys, faz rm -rf na pasta isolada e remove do SQLite
 */
export async function deleteSessionForUser(userId, sessionId) {
  const uid = Number(userId);
  const sid = Number(sessionId);
  const existing = db.getWaSessionById(sid, uid);
  if (!existing) {
    throw new Error('Sessão de WhatsApp não encontrada para este usuário.');
  }

  const key = getSessionKey(uid, sid);
  const rt = sessions.get(key);
  if (rt) {
    clearRuntimeReconnectTimer(rt);
    if (rt.sock) {
      const activeSock = rt.sock;
      rt.sock = null;
      closeSocketSafely(activeSock);
    }
    sessions.delete(key);
  }

  const fullAuthDir = getSessionFullAuthDir(uid, sid);
  if (fs.existsSync(fullAuthDir)) {
    fs.rmSync(fullAuthDir, { recursive: true, force: true });
  }

  db.deleteWaSession(sid, uid);
  waEventBus.emit(getSessionEventChannel(uid, sid), {
    deleted: true,
    userId: uid,
    chipId: sid,
    sessionKey: key,
    state: 'DELETED',
    connected: false,
    qr: null
  });

  return { success: true, deletedChipId: sid, removedDir: fullAuthDir };
}

export function isNativeConnectedForUser(userId, sessionId = null) {
  try {
    if (sessionId) {
      const sessionRow = resolveSessionForUser(userId, sessionId);
      const rt = sessions.get(getSessionKey(userId, sessionRow.id));
      return Boolean(rt && rt.state === 'CONNECTED' && rt.sock && sessionRow.status !== 'RESTRITO');
    }
    return getConnectedSessionsForUser(userId).length > 0;
  } catch {
    return false;
  }
}

export function getConnectedSessionsForUser(userId) {
  const uid = Number(userId);
  const activeRows = db.getActiveWaSessionsByUser(uid);
  return activeRows.filter(row => {
    const rt = sessions.get(getSessionKey(uid, row.id));
    return Boolean(rt && rt.state === 'CONNECTED' && rt.sock);
  });
}

export function getNativeStatusForUser(userId, sessionId = null) {
  const uid = Number(userId);
  const user = db.getUserById(uid);
  const mappedSessions = db.getWaSessionsByUser(uid).map(s => {
    const rt = sessions.get(getSessionKey(uid, s.id));
    const effectiveState = s.status === 'RESTRITO'
      ? 'RESTRITO'
      : (rt?.state || 'DISCONNECTED');
    return {
      id: s.id,
      session_name: s.session_name,
      auth_dir: s.auth_dir,
      phone_number: rt?.connectedUserNumber || s.phone_number || null,
      state: effectiveState,
      connected: Boolean(rt && effectiveState === 'CONNECTED' && rt.sock)
    };
  });

  let target = null;
  if (sessionId) {
    target = mappedSessions.find(s => Number(s.id) === Number(sessionId)) || null;
  }
  if (!target) {
    target = mappedSessions.find(s => s.connected) || mappedSessions[0] || null;
  }

  const targetRt = target ? sessions.get(getSessionKey(uid, target.id)) : null;
  const targetState = target?.state || targetRt?.state || 'DISCONNECTED';

  return {
    state: targetState,
    connected: Boolean(target?.connected),
    qrCode: targetState === 'QR_READY' ? (targetRt?.qrCodeDataUrl || null) : null,
    user: target?.phone_number || targetRt?.connectedUserNumber || null,
    activeSession: target,
    sessions: mappedSessions,
    maxChips: user ? Number(user.max_chips) : 1
  };
}

export function getNativeQrCodeForUser(userId, sessionId = null) {
  const status = getNativeStatusForUser(userId, sessionId);
  return status.qrCode;
}

export function normalizePhoneForWhatsApp(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.startsWith('0')) digits = digits.substring(1);

  if (!digits.startsWith('55')) {
    if (digits.length === 8 || digits.length === 9) {
      digits = `5511${digits}`;
    } else if (digits.length === 10 || digits.length === 11) {
      digits = `55${digits}`;
    }
  }
  return digits;
}

export async function checkNumberOnWhatsAppForUser(userId, phone, sessionId = null) {
  let sessionRow;
  try {
    sessionRow = resolveSessionForUser(userId, sessionId);
  } catch (err) {
    return { exists: false, connected: false, isOffline: true, error: err.message };
  }

  const rt = sessions.get(getSessionKey(userId, sessionRow.id));
  if (!rt || !rt.sock || rt.state !== 'CONNECTED') {
    return {
      exists: false,
      connected: false,
      isOffline: true,
      error: 'WhatsApp local não conectado. Conecte pelo QR Code primeiro.'
    };
  }

  const sock = rt.sock;
  const clean = normalizePhoneForWhatsApp(phone);
  if (!clean || clean.length < 10) {
    return { exists: false, isOffline: false, error: 'Telefone inválido ou curto demais' };
  }

  const jid1 = `${clean}@s.whatsapp.net`;
  try {
    const res1 = await sock.onWhatsApp(jid1);
    if (res1 && res1.length > 0 && res1[0].exists) {
      return { exists: true, isOffline: false, number: clean, jid: res1[0].jid };
    }

    if (clean.startsWith('55') && clean.length === 13 && clean[4] === '9') {
      const without9 = clean.slice(0, 4) + clean.slice(5);
      const res2 = await sock.onWhatsApp(`${without9}@s.whatsapp.net`);
      if (res2 && res2.length > 0 && res2[0].exists) {
        return { exists: true, isOffline: false, number: without9, jid: res2[0].jid };
      }
    } else if (clean.startsWith('55') && clean.length === 12 && ['6', '7', '8', '9'].includes(clean[4])) {
      const with9 = clean.slice(0, 4) + '9' + clean.slice(4);
      const res3 = await sock.onWhatsApp(`${with9}@s.whatsapp.net`);
      if (res3 && res3.length > 0 && res3[0].exists) {
        return { exists: true, isOffline: false, number: with9, jid: res3[0].jid };
      }
    }

    return { exists: false, isOffline: false, number: clean, jid: null };
  } catch (err) {
    return { exists: false, isOffline: false, error: err.message, number: clean, jid: null };
  }
}

export async function checkWhatsappNumbersForUser(userId, phonesArray = [], sessionId = null) {
  if (!isNativeConnectedForUser(userId, sessionId)) {
    return phonesArray.map(phone => ({
      phone: String(phone).replace(/\D/g, ''),
      exists: false,
      isOffline: true,
      error: 'WhatsApp local não conectado'
    }));
  }

  const results = [];
  for (const phone of phonesArray) {
    const check = await checkNumberOnWhatsAppForUser(userId, phone, sessionId);
    results.push({
      phone: String(phone).replace(/\D/g, ''),
      exists: Boolean(check.exists),
      jid: check.jid || null,
      error: check.error || null,
      isOffline: Boolean(check.isOffline)
    });
  }
  return results;
}

export async function revalidateOfflineLeadsForUser(userId, sessionId = null) {
  const uid = Number(userId);
  if (!isNativeConnectedForUser(uid, sessionId)) {
    return { success: false, error: 'WhatsApp não está conectado' };
  }

  try {
    const leadsToRecheck = db.db.prepare(`
      SELECT id, phone, phone_type, status, is_whatsapp_active
      FROM leads
      WHERE user_id = ?
        AND phone IS NOT NULL
        AND (is_whatsapp_active IS NULL OR is_whatsapp_active = 0 OR status = 'no_whatsapp')
      ORDER BY id DESC
      LIMIT 100
    `).all(uid);

    if (!leadsToRecheck || leadsToRecheck.length === 0) {
      return { success: true, count: 0 };
    }

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

    for (const lead of leadsToRecheck) {
      if (!isNativeConnectedForUser(uid, sessionId)) break;
      try {
        const check = await checkNumberOnWhatsAppForUser(uid, lead.phone, sessionId);
        if (check.exists) {
          updateActiveStmt.run(lead.id, uid);
          activeCount++;
        } else if (!check.isOffline) {
          updateNoWaStmt.run(lead.id, uid);
          noWaCount++;
        }
      } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return { success: true, activeCount, noWaCount, total: leadsToRecheck.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function extractErrorStatusCode(error) {
  return Number(
    error?.output?.statusCode ||
    error?.data?.statusCode ||
    error?.statusCode ||
    error?.status ||
    0
  ) || null;
}

export async function sendNativeTextMessageForUser(userId, phone, text, sessionId = null) {
  const sessionRow = resolveSessionForUser(userId, sessionId);
  const uid = Number(sessionRow.user_id);
  const sid = Number(sessionRow.id);
  const rt = sessions.get(getSessionKey(uid, sid));

  if (sessionRow.status === 'RESTRITO') {
    return {
      success: false,
      statusCode: 403,
      isRestriction: true,
      sessionId: sid,
      sessionName: sessionRow.session_name,
      error: `Chip "${sessionRow.session_name}" está marcado como RESTRITO.`
    };
  }

  if (!rt || !rt.sock || rt.state !== 'CONNECTED') {
    return {
      success: false,
      sessionId: sid,
      sessionName: sessionRow.session_name,
      error: 'WhatsApp não está conectado. Escaneie o QR Code no painel.'
    };
  }

  try {
    let jid;
    if (typeof phone === 'string' && phone.includes('@')) {
      jid = phone;
    } else {
      const clean = normalizePhoneForWhatsApp(phone);
      if (!clean || clean.length < 10) {
        throw new Error(`Número de WhatsApp inválido: "${phone}"`);
      }
      const check = await checkNumberOnWhatsAppForUser(uid, clean, sid).catch(() => null);
      jid = check?.exists && check.jid ? check.jid : `${clean}@s.whatsapp.net`;
    }

    const result = await rt.sock.sendMessage(jid, { text });
    return {
      success: true,
      data: result,
      recipient: phone,
      jid,
      sessionId: sid,
      sessionName: sessionRow.session_name,
      messageId: result?.key?.id
    };
  } catch (error) {
    const statusCode = extractErrorStatusCode(error);
    const msg = String(error?.message || '');
    const isRestriction =
      statusCode === 401 ||
      statusCode === 403 ||
      statusCode === 428 ||
      /\b(401|403|428)\b/.test(msg);

    return {
      success: false,
      statusCode,
      isRestriction,
      sessionId: sid,
      sessionName: sessionRow.session_name,
      error: `Falha ao enviar mensagem WhatsApp: ${error.message}`
    };
  }
}

export async function sendSdrAlert(leadData) {
  const userId = leadData.user_id || db.getAdminUserId();
  const configuredPhone = db.getSetting('sdr_notification_phone', null, userId) || '';
  const sdrPhone = String(configuredPhone).replace(/\D/g, '');
  if (!sdrPhone) {
    return {
      success: false,
      error: 'WhatsApp do SDR não configurado. Defina o número nas Configurações do painel.'
    };
  }

  const leadPhone = leadData.phone ? `+${leadData.phone}` : 'Não informado no chat';
  const directLink = leadData.source === 'inbound_official' && String(leadData.identifier).startsWith('@')
    ? `https://instagram.com/${String(leadData.identifier).replace('@', '')}`
    : (leadData.phone ? `https://wa.me/${String(leadData.phone).replace(/\D/g, '')}` : 'N/A');

  const alertMessage =
`*NOVO LEAD QUALIFICADO — LEGADO SDR*

*Nome:* ${leadData.name || 'Em aberto'}
*Empresa:* ${leadData.company_name || 'Em aberto'}
*Nicho:* ${leadData.niche || 'Geral'}
*Faturamento Declarado:* ${leadData.revenue_range || 'Em validação'}
*Contato:* ${leadPhone}
*Origem:* ${leadData.source} (${leadData.identifier})

*Diagnostico da IA:*
_${leadData.ai_summary || 'Lead pronto para fechamento e agendamento de call estrategica.'}_

*Abrir Conversa Direta:*
${directLink}`;

  return sendNativeTextMessageForUser(userId, sdrPhone, alertMessage);
}

class WhatsAppBaileysClient {
  initPersistedWhatsAppSessions() {
    return initPersistedWhatsAppSessions();
  }

  initForUser(userId, sessionId = null, opts = {}) {
    return initNativeWhatsAppForSession(userId, sessionId, opts);
  }

  disconnectForUser(userId, sessionId = null) {
    return disconnectNativeWhatsAppForSession(userId, sessionId);
  }

  deleteSessionForUser(userId, sessionId) {
    return deleteSessionForUser(userId, sessionId);
  }

  markSessionRestricted(userId, sessionId, reason) {
    return markSessionRestricted(userId, sessionId, reason);
  }

  getStatusForUser(userId, sessionId = null) {
    return getNativeStatusForUser(userId, sessionId);
  }

  getQrCodeForUser(userId, sessionId = null) {
    return getNativeQrCodeForUser(userId, sessionId);
  }

  isConnectedForUser(userId, sessionId = null) {
    return isNativeConnectedForUser(userId, sessionId);
  }

  getConnectedSessionsForUser(userId) {
    return getConnectedSessionsForUser(userId);
  }

  sendTextMessageForUser(userId, recipientPhone, messageText, sessionId = null) {
    return sendNativeTextMessageForUser(userId, recipientPhone, messageText, sessionId);
  }

  sendSdrAlert(leadData) {
    return sendSdrAlert(leadData);
  }

  checkWhatsappNumbersForUser(userId, phonesArray = [], sessionId = null) {
    return checkWhatsappNumbersForUser(userId, phonesArray, sessionId);
  }
}

export const whatsappClient = new WhatsAppBaileysClient();
export default whatsappClient;
