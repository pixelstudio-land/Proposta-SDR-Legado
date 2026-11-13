const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { dbAsync, addLog } = require('./database');

let sock = null;
let currentQrCodeDataUrl = null;
let connectionState = 'DISCONNECTED'; // 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED'
let connectedUserNumber = null;
let eventListeners = [];
let reconnectAttempts = 0;

function onStateChange(listener) {
  eventListeners.push(listener);
}

function notifyStateChange() {
  eventListeners.forEach(fn => {
    try {
      fn({
        state: connectionState,
        qrCode: currentQrCodeDataUrl,
        connectedUser: connectedUserNumber
      });
    } catch (e) {
      console.error('Erro no listener de estado WhatsApp:', e);
    }
  });
}

/**
 * Inicializa ou reinicia a conexão com o WhatsApp
 */
async function initWhatsApp() {
  const authPath = path.join(__dirname, '..', 'auth_info_baileys');
  if (!fs.existsSync(authPath)) {
    fs.mkdirSync(authPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  addLog(`Iniciando motor WhatsApp local (Baileys v${version.join('.')}, isLatest: ${isLatest})...`);
  connectionState = 'CONNECTING';
  notifyStateChange();

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    browser: ['Agente SDR Local', 'Chrome', '120.0.0']
  });

  // Salva credenciais atualizadas
  sock.ev.on('creds.update', saveCreds);

  // Monitora conexão
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      connectionState = 'QR_READY';
      currentQrCodeDataUrl = await QRCode.toDataURL(qr);
      addLog('Novo QR Code gerado! Aponte o WhatsApp da sua funcionária IA para conectar.', 'INFO');
      notifyStateChange();
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      connectionState = 'DISCONNECTED';
      currentQrCodeDataUrl = null;
      connectedUserNumber = null;
      notifyStateChange();

      addLog(`Conexão com WhatsApp encerrada (Status: ${statusCode}). Reconectando? ${shouldReconnect}`, 'WARN');

      if (shouldReconnect) {
        if (reconnectAttempts >= 5) {
          addLog('Limite de tentativas de reconexão atingido (5/5). O WhatsApp não conseguiu se reconectar.', 'ERROR');
        } else {
          reconnectAttempts++;
          setTimeout(initWhatsApp, 5000);
        }
      } else {
        addLog('Sessão encerrada (Logout). O QR Code precisará ser lido novamente.', 'WARN');
      }
    } else if (connection === 'open') {
      connectionState = 'CONNECTED';
      currentQrCodeDataUrl = null;
      connectedUserNumber = sock.user ? sock.user.id.split(':')[0] : 'Conectado';
      reconnectAttempts = 0; // Reseta as tentativas após sucesso
      addLog(`WhatsApp da funcionária IA conectado com sucesso! Número: +${connectedUserNumber}`, 'INFO');
      notifyStateChange();
    }
  });

  // Escuta mensagens recebidas (Respostas dos Leads)
  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (m.type !== 'notify') return;
      
      for (const msg of m.messages) {
        if (msg.key.fromMe) continue; // Ignora mensagens enviadas por nós

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') {
          continue; // Ignora grupos e status
        }

        const senderPhone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
        const messageText = msg.message?.conversation || 
                            msg.message?.extendedTextMessage?.text || 
                            'Mensagem de mídia/áudio';

        // Verifica se é um lead nosso
        const lead = await dbAsync.get('SELECT * FROM leads WHERE phone = ? OR phone LIKE ?', [
          senderPhone,
          `%${senderPhone.slice(-8)}%`
        ]);

        if (lead) {
          addLog(`[RESPOSTA RECEBIDA] de ${lead.name} (${lead.phone}): "${messageText}"`, 'INFO');
          
          await dbAsync.run(`
            UPDATE leads 
            SET status = 'RESPONDIDO', 
                replied_at = CURRENT_TIMESTAMP, 
                last_reply_text = ? 
            WHERE id = ?
          `, [messageText, lead.id]);

          // Notifica no WhatsApp pessoal do usuário se configurado
          const config = await dbAsync.get('SELECT personal_whatsapp FROM config WHERE id = 1');
          if (config && config.personal_whatsapp && config.personal_whatsapp.trim() !== '') {
            await forwardLeadAlertToPersonal(config.personal_whatsapp, lead, messageText);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao processar mensagem recebida:', err);
    }
  });

  return sock;
}

/**
 * Envia alerta de Lead Quente para o WhatsApp pessoal do usuário
 */
async function forwardLeadAlertToPersonal(personalPhone, lead, replyText) {
  if (!sock || connectionState !== 'CONNECTED') return;

  try {
    let cleanPhone = personalPhone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;
    const jid = `${cleanPhone}@s.whatsapp.net`;

    const alertMsg = `[AVISO: RESPOSTA DE LEAD]

Empresa: ${lead.name}
Cidade/Nicho: ${lead.city || 'N/A'} - ${lead.niche || 'N/A'}
WhatsApp do Lead: https://wa.me/${lead.phone}

Mensagem recebida:
"${replyText}"

Abra o link acima para responder e fechar a proposta com o cliente.`;

    await sock.sendMessage(jid, { text: alertMsg });
    addLog(`Alerta de lead quente encaminhado para seu WhatsApp pessoal (+${cleanPhone})!`, 'INFO');
  } catch (err) {
    console.error('Erro ao encaminhar alerta para WhatsApp pessoal:', err.message);
  }
}

/**
 * Verifica se um número possui conta ativa no WhatsApp antes de disparar
 */
async function checkNumberOnWhatsApp(phone) {
  if (!sock || connectionState !== 'CONNECTED') {
    throw new Error('WhatsApp não está conectado.');
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const jid = `${cleanPhone}@s.whatsapp.net`;

  try {
    const results = await sock.onWhatsApp(jid);
    if (!results || results.length === 0 || !results[0].exists) {
      return { exists: false, jid: null };
    }
    return { exists: true, jid: results[0].jid };
  } catch (err) {
    console.warn(`Erro ao checar número no WhatsApp (${phone}):`, err.message);
    return { exists: false, error: err.message };
  }
}

/**
 * Envia uma mensagem para o lead de forma humanizada (com indicador de digitando...).
 * Recebe o JID já validado por checkNumberOnWhatsApp para evitar checagem dupla.
 * @param {string} jid - JID do destinatário (ex: '5511999999999@s.whatsapp.net')
 * @param {string} text - Texto da mensagem
 */
async function sendHumanizedMessage(jid, text) {
  if (!sock || connectionState !== 'CONNECTED') {
    throw new Error('WhatsApp não está conectado. Escaneie o QR Code primeiro.');
  }

  if (!jid) {
    throw new Error('NUMERO_SEM_WHATSAPP');
  }

  try {
    // 1. Simula presença "Digitando..." por 3 a 6 segundos para parecer humano
    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate('composing', jid);

    const typingDelay = Math.floor(Math.random() * 3000) + 3000;
    await new Promise(r => setTimeout(r, typingDelay));

    await sock.sendPresenceUpdate('paused', jid);

    // 2. Envia a mensagem
    const result = await sock.sendMessage(jid, { text });
    return result;
  } catch (err) {
    throw err;
  }
}

/**
 * Desconecta a sessão e limpa os arquivos de autenticação
 */
async function logoutWhatsApp() {
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {}
  }
  const authPath = path.join(__dirname, '..', 'auth_info_baileys');
  if (fs.existsSync(authPath)) {
    fs.rmSync(authPath, { recursive: true, force: true });
  }
  connectionState = 'DISCONNECTED';
  currentQrCodeDataUrl = null;
  connectedUserNumber = null;
  notifyStateChange();
  addLog('Sessão do WhatsApp desconectada e limpa.', 'INFO');
}

module.exports = {
  initWhatsApp,
  checkNumberOnWhatsApp,
  sendHumanizedMessage,
  logoutWhatsApp,
  onStateChange,
  getConnectionStatus: () => ({
    state: connectionState,
    qrCode: currentQrCodeDataUrl,
    connectedUser: connectedUserNumber
  })
};
