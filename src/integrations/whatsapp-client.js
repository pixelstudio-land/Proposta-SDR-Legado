import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { settings } from '../../config/settings.js';
import db from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const baseAuthDir = path.join(rootDir, 'data', 'whatsapp-auth');

// Mapa em memória de sessões Baileys isoladas por wa_sessions.id
const sessionRuntimes = new Map();

function getSessionFullAuthDir(sessionRow) {
  return path.join(baseAuthDir, sessionRow.auth_dir);
}

function getOrCreateRuntime(sessionRow) {
  const sid = Number(sessionRow.id);
  let rt = sessionRuntimes.get(sid);
  if (!rt) {
    rt = {
      sessionId: sid,
      userId: Number(sessionRow.user_id),
      sock: null,
      state: sessionRow.status === 'CONNECTED' ? 'DISCONNECTED' : (sessionRow.status || 'DISCONNECTED'),
      qrCodeDataUrl: null,
      qrRaw: null,
      connectedUserNumber: sessionRow.phone_number || null,
      reconnectAttempts: 0,
      isInitializing: false
    };
    sessionRuntimes.set(sid, rt);
  }
  return rt;
}

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

  let sessions = db.getWaSessionsByUser(uid);
  if (sessions.length === 0) {
    const created = db.createWaSession(uid, 'Chip Principal');
    sessions = [created];
  }

  // Prefere sessão conectada em memória
  for (const s of sessions) {
    const rt = sessionRuntimes.get(Number(s.id));
    if (rt && rt.state === 'CONNECTED' && rt.sock) {
      return s;
    }
  }
  return sessions[0];
}

/**
 * Inicializa em background apenas sessões que já possuem credenciais salvas e dono ativo
 */
export async function initPersistedWhatsAppSessions() {
  try {
    const allSessions = db.getAllWaSessions();
    for (const s of allSessions) {
      if (!s.user_active) continue;
      const fullDir = getSessionFullAuthDir(s);
      if (fs.existsSync(path.join(fullDir, 'creds.json'))) {
        initNativeWhatsAppForSession(s.user_id, s.id).catch(err => {
          console.warn(`⚠️ [WhatsApp Baileys] Reconexão automática sessão #${s.id} (user #${s.user_id}): ${err.message}`);
        });
      }
    }
  } catch (err) {
    console.warn(`⚠️ [WhatsApp Baileys] Erro ao inicializar sessões persistidas: ${err.message}`);
  }
}

/**
 * Inicializa a conexão Baileys isolada para uma sessão específica do usuário
 */
export async function initNativeWhatsAppForSession(userId, sessionId = null) {
  const sessionRow = resolveSessionForUser(userId, sessionId);
  const uid = Number(sessionRow.user_id);
  const sid = Number(sessionRow.id);
  const rt = getOrCreateRuntime(sessionRow);

  if (rt.isInitializing) {
    return rt.sock;
  }
  rt.isInitializing = true;

  const fullAuthDir = getSessionFullAuthDir(sessionRow);

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
    db.updateWaSession(sid, uid, { status: 'CONNECTING' });

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: [`Legado SDR (${sessionRow.session_name})`, 'Chrome', '124.0.0'],
      generateHighQualityLinkPreview: true
    });

    rt.sock = sock;
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      // Garante que este evento ainda pertence ao socket ativo desta sessão
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
      }

      if (connection === 'open') {
        rt.state = 'CONNECTED';
        rt.qrCodeDataUrl = null;
        rt.qrRaw = null;
        rt.connectedUserNumber = sock.user?.id ? sock.user.id.split(':')[0].replace(/\D/g, '') : 'Conectado';
        rt.reconnectAttempts = 0;

        db.updateWaSession(sid, uid, {
          status: 'CONNECTED',
          phone_number: rt.connectedUserNumber,
          last_connected_at: new Date().toISOString()
        });

        console.log(`✅ [WhatsApp Nativo] Sessão #${sid} (user #${uid}) conectada: +${rt.connectedUserNumber}`);

        // Revalida leads pendentes EXCLUSIVAMENTE deste tenant
        setTimeout(() => {
          revalidateOfflineLeadsForUser(uid, sid).catch(err => {
            console.warn(`⚠️ [WhatsApp Nativo] Aviso revalidação user #${uid}: ${err.message}`);
          });
        }, 3500);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        rt.state = 'DISCONNECTED';
        rt.qrCodeDataUrl = null;
        rt.qrRaw = null;
        rt.connectedUserNumber = null;
        rt.sock = null;
        db.updateWaSession(sid, uid, { status: 'DISCONNECTED', phone_number: null });

        const currentUser = db.getUserById(uid);
        if (!currentUser || !currentUser.active) {
          rt.isInitializing = false;
          return;
        }

        if (shouldReconnect) {
          if (rt.reconnectAttempts < 8) {
            rt.reconnectAttempts++;
            setTimeout(() => {
              rt.isInitializing = false;
              if (db.getWaSessionById(sid, uid)) {
                initNativeWhatsAppForSession(uid, sid).catch(() => {});
              }
            }, 4000);
          } else {
            rt.isInitializing = false;
          }
        } else {
          try {
            fs.rmSync(fullAuthDir, { recursive: true, force: true });
          } catch (_) {}
          rt.isInitializing = false;
        }
      }
    });

    rt.isInitializing = false;
    return sock;
  } catch (error) {
    rt.isInitializing = false;
    rt.state = 'DISCONNECTED';
    db.updateWaSession(sid, uid, { status: 'DISCONNECTED' });
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
  const fullAuthDir = getSessionFullAuthDir(sessionRow);

  try {
    if (rt.sock) {
      const activeSock = rt.sock;
      rt.sock = null;
      activeSock.end(undefined);
    }
    rt.state = 'DISCONNECTED';
    rt.qrCodeDataUrl = null;
    rt.qrRaw = null;
    rt.connectedUserNumber = null;
    rt.reconnectAttempts = 0;
    rt.isInitializing = false;

    db.updateWaSession(sid, uid, { status: 'DISCONNECTED', phone_number: null });

    if (fs.existsSync(fullAuthDir)) {
      fs.rmSync(fullAuthDir, { recursive: true, force: true });
    }
    return { success: true, message: 'WhatsApp desconectado e credenciais removidas.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function isNativeConnectedForUser(userId, sessionId = null) {
  try {
    const sessionRow = resolveSessionForUser(userId, sessionId);
    const rt = sessionRuntimes.get(Number(sessionRow.id));
    return Boolean(rt && rt.state === 'CONNECTED' && rt.sock);
  } catch {
    return false;
  }
}

export function getNativeStatusForUser(userId, sessionId = null) {
  const uid = Number(userId);
  const user = db.getUserById(uid);
  const sessions = db.getWaSessionsByUser(uid).map(s => {
    const rt = sessionRuntimes.get(Number(s.id));
    return {
      id: s.id,
      session_name: s.session_name,
      phone_number: rt?.connectedUserNumber || s.phone_number,
      state: rt?.state || 'DISCONNECTED',
      connected: Boolean(rt && rt.state === 'CONNECTED' && rt.sock)
    };
  });

  let target = null;
  if (sessionId) {
    target = sessions.find(s => Number(s.id) === Number(sessionId)) || null;
  }
  if (!target) {
    target = sessions.find(s => s.connected) || sessions[0] || null;
  }

  const targetRt = target ? sessionRuntimes.get(Number(target.id)) : null;

  return {
    state: targetRt?.state || 'DISCONNECTED',
    connected: Boolean(targetRt && targetRt.state === 'CONNECTED' && targetRt.sock),
    qrCode: targetRt?.qrCodeDataUrl || null,
    user: targetRt?.connectedUserNumber || target?.phone_number || null,
    activeSession: target,
    sessions,
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

  const rt = sessionRuntimes.get(Number(sessionRow.id));
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

export async function sendNativeTextMessageForUser(userId, phone, text, sessionId = null) {
  const sessionRow = resolveSessionForUser(userId, sessionId);
  const rt = sessionRuntimes.get(Number(sessionRow.id));

  if (!rt || !rt.sock || rt.state !== 'CONNECTED') {
    return {
      success: false,
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
      const check = await checkNumberOnWhatsAppForUser(userId, clean, sessionRow.id).catch(() => null);
      jid = check?.exists && check.jid ? check.jid : `${clean}@s.whatsapp.net`;
    }

    const result = await rt.sock.sendMessage(jid, { text });
    return {
      success: true,
      data: result,
      recipient: phone,
      jid,
      messageId: result?.key?.id
    };
  } catch (error) {
    return {
      success: false,
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

  initForUser(userId, sessionId = null) {
    return initNativeWhatsAppForSession(userId, sessionId);
  }

  disconnectForUser(userId, sessionId = null) {
    return disconnectNativeWhatsAppForSession(userId, sessionId);
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
