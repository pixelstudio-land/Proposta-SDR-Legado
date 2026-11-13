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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const authDir = path.join(rootDir, 'data', 'whatsapp-auth');

let sock = null;
let connectionState = 'DISCONNECTED'; // 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED'
let currentQrCodeDataUrl = null;
let currentQrRaw = null;
let connectedUserNumber = null;
let reconnectAttempts = 0;
let isInitializing = false;

/**
 * Inicializa a conexão com o WhatsApp via Baileys Nativo (Zero Evolution API)
 */
export async function initNativeWhatsApp() {
  if (isInitializing) {
    return sock;
  }
  isInitializing = true;

  try {
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    let version = [2, 3000, 1015901307];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v?.version) version = v.version;
    } catch (_) {}

    connectionState = 'CONNECTING';
    console.log('====================================================');
    console.log('📱 [WhatsApp Nativo Baileys] Inicializando motor local...');
    console.log(`👉 Diretório de autenticação: ${authDir}`);
    console.log('====================================================');

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
      auth: state,
      browser: ['Legado SDR Engine', 'Chrome', '124.0.0'],
      generateHighQualityLinkPreview: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionState = 'QR_READY';
        currentQrRaw = qr;
        try {
          currentQrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
        } catch (err) {
          console.warn('⚠️ [WhatsApp Baileys] Erro ao converter QR Code para DataURL:', err.message);
          currentQrCodeDataUrl = null;
        }
        console.log('====================================================');
        console.log('📱 [WhatsApp Nativo] QR CODE PRONTO PARA LEITURA NO PAINEL!');
        console.log('👉 Acesse o dashboard e escaneie o código na tela.');
        console.log('====================================================');
      }

      if (connection === 'open') {
        connectionState = 'CONNECTED';
        currentQrCodeDataUrl = null;
        currentQrRaw = null;
        connectedUserNumber = sock.user?.id ? sock.user.id.split(':')[0].replace(/\D/g, '') : 'Conectado';
        reconnectAttempts = 0;
        console.log('====================================================');
        console.log('✅ [WhatsApp Nativo] CONEXÃO ESTABELECIDA COM SUCESSO!');
        console.log(`👉 Número Conectado: +${connectedUserNumber}`);
        console.log('👉 Alertas de SDR e Validações Baileys 100% OPERACIONAIS');
        console.log('====================================================');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        connectionState = 'DISCONNECTED';
        currentQrCodeDataUrl = null;
        currentQrRaw = null;
        connectedUserNumber = null;

        console.warn(`⚠️ [WhatsApp Nativo] Conexão fechada (Status: ${statusCode}). Reconectando? ${shouldReconnect}`);

        if (shouldReconnect) {
          if (reconnectAttempts < 10) {
            reconnectAttempts++;
            console.log(`🔄 [WhatsApp Nativo] Tentativa de reconexão (${reconnectAttempts}/10) em 4 segundos...`);
            setTimeout(() => {
              isInitializing = false;
              initNativeWhatsApp();
            }, 4000);
          } else {
            console.warn('⚠️ [WhatsApp Nativo] Tentativas rápidas esgotadas. Tentando novamente em 30 segundos...');
            setTimeout(() => {
              isInitializing = false;
              initNativeWhatsApp();
            }, 30000);
          }
        } else {
          console.warn('⚠️ [WhatsApp Nativo] Sessão encerrada (Logout). Limpando credenciais para novo QR Code...');
          try {
            fs.rmSync(authDir, { recursive: true, force: true });
          } catch (_) {}
          setTimeout(() => {
            isInitializing = false;
            initNativeWhatsApp();
          }, 2000);
        }
      }
    });

    isInitializing = false;
    return sock;
  } catch (error) {
    isInitializing = false;
    connectionState = 'DISCONNECTED';
    console.error(`❌ [WhatsApp Nativo] Erro ao inicializar Baileys: ${error.message}`);
    throw error;
  }
}

/**
 * Desconecta a sessão ativa e remove os arquivos de credenciais
 */
export async function disconnectNativeWhatsApp() {
  console.log('🛑 [WhatsApp Nativo] Desconectando e limpando sessão local...');
  try {
    if (sock) {
      sock.end(undefined);
      sock = null;
    }
    connectionState = 'DISCONNECTED';
    currentQrCodeDataUrl = null;
    currentQrRaw = null;
    connectedUserNumber = null;
    reconnectAttempts = 0;
    isInitializing = false;

    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
    return { success: true, message: 'WhatsApp desconectado e credenciais removidas.' };
  } catch (err) {
    console.error(`❌ [WhatsApp Nativo] Erro ao desconectar: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Retorna se o motor Baileys está conectado
 */
export function isNativeConnected() {
  return connectionState === 'CONNECTED' && Boolean(sock);
}

/**
 * Retorna o status atual do motor Baileys
 */
export function getNativeStatus() {
  return {
    state: connectionState,
    connected: isNativeConnected(),
    qrCode: currentQrCodeDataUrl,
    user: connectedUserNumber
  };
}

/**
 * Retorna o DataURL do QR Code
 */
export function getNativeQrCode() {
  return currentQrCodeDataUrl;
}

/**
 * Retorna a instância atual do socket Baileys
 */
export function getSocket() {
  return sock;
}

/**
 * Normaliza número para validação preservando Fixos (8 dígitos) e Celulares (9 dígitos)
 * Retorna formato E.164 brasileiro (com 55)
 */
export function normalizePhoneForWhatsApp(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');

  if (digits.length < 8) return null;

  // Se inicia com 0, remove
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // Se não tem DDI 55, adiciona
  if (!digits.startsWith('55')) {
    // Se tem 8 ou 9 dígitos (número local sem DDD), usa DDD 11 por padrão
    if (digits.length === 8 || digits.length === 9) {
      digits = `5511${digits}`;
    } else if (digits.length === 10 || digits.length === 11) {
      digits = `55${digits}`;
    }
  }

  return digits;
}

/**
 * Consulta se o número é registrado no WhatsApp real via sock.onWhatsApp
 * IMPORTANTE: NÃO descarta fixos comerciais de 8 dígitos locais (12 dígitos com 55).
 * Ambos (fixos e celulares) são submetidos à checagem real dos servidores do WhatsApp.
 */
export async function checkNumberOnWhatsApp(phone) {
  if (!sock || connectionState !== 'CONNECTED') {
    return {
      exists: false,
      connected: false,
      error: 'WhatsApp local não conectado. Conecte pelo QR Code primeiro.'
    };
  }

  const clean = normalizePhoneForWhatsApp(phone);
  if (!clean || clean.length < 10) {
    return { exists: false, error: 'Telefone inválido ou curto demais' };
  }

  const jid1 = `${clean}@s.whatsapp.net`;
  try {
    const res1 = await sock.onWhatsApp(jid1);
    if (res1 && res1.length > 0 && res1[0].exists) {
      return { exists: true, number: clean, jid: res1[0].jid };
    }

    // Heurística de Resolução para o Brasil (DDI 55):
    // 1. Se for celular de 13 dígitos (55 + DDD + 9 dígitos) iniciando com '9',
    // testa a variação sem o 9º dígito (muitas contas históricas ainda usam JID sem 9)
    if (clean.startsWith('55') && clean.length === 13 && clean[4] === '9') {
      const without9 = clean.slice(0, 4) + clean.slice(5);
      const res2 = await sock.onWhatsApp(`${without9}@s.whatsapp.net`);
      if (res2 && res2.length > 0 && res2[0].exists) {
        return { exists: true, number: without9, jid: res2[0].jid };
      }
    } 
    // 2. Se for 12 dígitos (55 + DDD + 8 dígitos) e o dígito inicial local for 6, 7, 8 ou 9,
    // pode ser um celular cadastrado sem o nono dígito; testa a variação com o 9
    else if (clean.startsWith('55') && clean.length === 12 && ['6', '7', '8', '9'].includes(clean[4])) {
      const with9 = clean.slice(0, 4) + '9' + clean.slice(4);
      const res3 = await sock.onWhatsApp(`${with9}@s.whatsapp.net`);
      if (res3 && res3.length > 0 && res3[0].exists) {
        return { exists: true, number: with9, jid: res3[0].jid };
      }
    }

    // Caso seja Fixo Comercial puro (ex: local iniciando em 2, 3, 4, 5) ou número sem WhatsApp:
    // O teste real já foi feito em jid1 acima sem ser descartado!
    return { exists: false, number: clean, jid: null };
  } catch (err) {
    console.warn(`⚠️ [WhatsApp Baileys onWhatsApp Error] (${clean}): ${err.message}`);
    return { exists: false, error: err.message, number: clean, jid: null };
  }
}

/**
 * Consulta em lote se uma lista de telefones (fixos ou móveis) está ativa no WhatsApp
 */
export async function checkWhatsappNumbers(phonesArray = []) {
  if (!sock || connectionState !== 'CONNECTED') {
    return phonesArray.map(phone => ({
      phone: String(phone).replace(/\D/g, ''),
      exists: false,
      error: 'WhatsApp local não conectado'
    }));
  }

  const results = [];
  for (const phone of phonesArray) {
    const check = await checkNumberOnWhatsApp(phone);
    results.push({
      phone: String(phone).replace(/\D/g, ''),
      exists: Boolean(check.exists),
      jid: check.jid || null,
      error: check.error || null
    });
  }

  return results;
}

/**
 * Resolve o JID exato no WhatsApp para envio de mensagens
 */
export async function resolveWhatsAppJid(phone) {
  if (!sock || connectionState !== 'CONNECTED') {
    throw new Error('WhatsApp não está conectado. Escaneie o QR Code no painel.');
  }

  if (typeof phone === 'string' && phone.includes('@')) {
    return phone;
  }

  const clean = normalizePhoneForWhatsApp(phone);
  if (!clean || clean.length < 10) {
    throw new Error(`Número de WhatsApp inválido: "${phone}"`);
  }

  try {
    const check = await checkNumberOnWhatsApp(clean);
    if (check.exists && check.jid) {
      return check.jid;
    }
  } catch (_) {}

  return `${clean}@s.whatsapp.net`;
}

/**
 * Envia mensagem de texto nativa via Baileys sock.sendMessage
 */
export async function sendNativeTextMessage(phone, text) {
  if (!sock || connectionState !== 'CONNECTED') {
    return {
      success: false,
      error: 'WhatsApp não está conectado. Escaneie o QR Code no painel.'
    };
  }

  try {
    const jid = await resolveWhatsAppJid(phone);
    console.log(`📤 [WhatsApp Nativo] Enviando mensagem de texto para ${jid}...`);

    const result = await sock.sendMessage(jid, { text });
    console.log(`✅ [WhatsApp Nativo] Mensagem entregue! Message ID: ${result?.key?.id}`);

    return {
      success: true,
      data: result,
      recipient: phone,
      jid,
      messageId: result?.key?.id
    };
  } catch (error) {
    console.error(`❌ [WhatsApp Nativo] Erro ao enviar mensagem para ${phone}: ${error.message}`);
    return {
      success: false,
      error: `Falha ao enviar mensagem WhatsApp: ${error.message}`
    };
  }
}

/**
 * Envia a ficha executiva do lead qualificado diretamente para o WhatsApp do SDR / Leo
 */
export async function sendSdrAlert(leadData) {
  const sdrPhone = settings.whatsapp.sdrNotificationPhone;
  if (!sdrPhone) {
    return {
      success: false,
      error: 'SDR_NOTIFICATION_PHONE não configurado no .env'
    };
  }

  const leadPhone = leadData.phone ? `+${leadData.phone}` : 'Não informado no chat';
  const directLink = leadData.source === 'inbound_official' && String(leadData.identifier).startsWith('@')
    ? `https://instagram.com/${String(leadData.identifier).replace('@', '')}`
    : (leadData.phone ? `https://wa.me/${String(leadData.phone).replace(/\D/g, '')}` : 'N/A');

  const alertMessage = 
`🚨 *NOVO LEAD QUALIFICADO — MÁQUINA LEGADO* 🚨

👤 *Nome:* ${leadData.name || 'Em aberto'}
🏢 *Empresa:* ${leadData.company_name || 'Em aberto'}
🎯 *Nicho:* ${leadData.niche || 'Geral'}
💰 *Faturamento Declarado:* ${leadData.revenue_range || 'Em validação'}
📱 *Contato:* ${leadPhone}
🌐 *Origem:* ${leadData.source} (${leadData.identifier})

📝 *Diagnóstico da IA:*
_${leadData.ai_summary || 'Lead pronto para fechamento e agendamento de call estratégica.'}_

🔗 *Abrir Conversa Direta:*
${directLink}

⚡ _Transbordo automático executado com sucesso (Baileys Nativo)._`;

  return sendNativeTextMessage(sdrPhone, alertMessage);
}

/**
 * Classe adaptadora para manter compatibilidade com chamadas legado do whatsappClient
 */
class WhatsAppBaileysClient {
  constructor() {
    this.sdrNotificationPhone = settings.whatsapp.sdrNotificationPhone;
  }

  async sendTextMessage(recipientPhone, messageText) {
    return sendNativeTextMessage(recipientPhone, messageText);
  }

  async sendSdrAlert(leadData) {
    return sendSdrAlert(leadData);
  }

  async checkWhatsappNumbers(phonesArray = []) {
    return checkWhatsappNumbers(phonesArray);
  }

  initNativeWhatsApp() {
    return initNativeWhatsApp();
  }

  disconnectNativeWhatsApp() {
    return disconnectNativeWhatsApp();
  }

  getNativeStatus() {
    return getNativeStatus();
  }

  getNativeQrCode() {
    return getNativeQrCode();
  }

  isNativeConnected() {
    return isNativeConnected();
  }

  getSocket() {
    return getSocket();
  }
}

export const whatsappClient = new WhatsAppBaileysClient();
export default whatsappClient;
