import db from '../../database/db.js';
import {
  sendNativeTextMessageForUser,
  isNativeConnectedForUser,
  getConnectedSessionsForUser,
  markSessionRestricted
} from '../../integrations/whatsapp-client.js';

/**
 * Formata dinamicamente o template de disparo frio de WhatsApp substituindo todas as variáveis contextuais
 */
export function formatTemplateMessage(template, lead) {
  if (!template) return '';

  const company = lead.company_name || lead.name || 'sua empresa';
  const name = lead.name || 'tudo bem';

  let niche = lead.niche || 'seu segmento';
  if (niche.includes(',')) niche = niche.split(',')[0].trim();

  let address = '';
  let city = 'sua região';
  let rating = '5.0';
  let reviews = 'várias';

  if (lead.ai_summary) {
    const matchAddr = lead.ai_summary.match(/Minerado GMN:\s*([^|]+)/i);
    if (matchAddr && matchAddr[1]) address = matchAddr[1].trim();

    const matchRating = lead.ai_summary.match(/Avaliação:\s*([\d,\.]+)\s*★?(?:\s*\(([\d\.]+)\s*avaliações\))?/i);
    if (matchRating) {
      if (matchRating[1]) rating = matchRating[1].trim();
      if (matchRating[2]) reviews = matchRating[2].trim();
    }
  }

  if (address) {
    const matchUf = address.match(/(?:,\s*|\s+)([^,0-9\-\n]+?)\s*-\s*([A-Za-z]{2})\b/);
    if (matchUf && matchUf[1] && matchUf[2]) {
      city = `${matchUf[1].trim()} - ${matchUf[2].toUpperCase()}`;
    } else {
      const cepMatch = address.match(/(?:,\s*|\s+)([^,0-9]+?)(?:,\s*|\s+)\d{5}-\d{3}/);
      if (cepMatch && cepMatch[1]) {
        city = cepMatch[1].trim();
      }
    }
  } else if (lead.niche && lead.niche.includes('cidade')) {
    city = lead.niche.split('cidade')[1].trim();
  }

  const now = new Date();
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  let saudacao = 'Olá';
  if (brHour >= 5 && brHour < 12) {
    saudacao = 'Bom dia';
  } else if (brHour >= 12 && brHour < 18) {
    saudacao = 'Boa tarde';
  } else {
    saudacao = 'Boa noite';
  }

  return template
    .replace(/{empresa}/gi, company)
    .replace(/{nome}/gi, name)
    .replace(/{cidade}/gi, city)
    .replace(/{nicho}/gi, niche)
    .replace(/{nota}/gi, rating)
    .replace(/{avaliacoes}/gi, reviews)
    .replace(/{saudacao}/gi, saudacao);
}

class TenantWhatsAppDispatcher {
  constructor(userId) {
    this.userId = Number(userId);
    this.isRunning = false;
    this.timerId = null;

    const savedMinDelay = db.getSetting('whatsapp_min_delay', null, this.userId);
    const savedMaxDelay = db.getSetting('whatsapp_max_delay', null, this.userId);
    this.minDelaySeconds = savedMinDelay ? parseInt(savedMinDelay, 10) : 60;
    this.maxDelaySeconds = savedMaxDelay ? parseInt(savedMaxDelay, 10) : 120;
    this.dailyLimit = 50;
    this.lastSentAt = null;
    this.nextRunAt = null;
    this.currentLead = null;
    this.lastError = null;
    this.roundRobinCursor = 0;
    this.lastChipUsed = null;

    this.defaultTemplate =
`{saudacao}, tudo bem? Vi a {empresa} aqui no Google ({nota} ★ com {avaliacoes} avaliações) em {cidade} e achei o posicionamento de vocês excelente.

Acompanho o mercado de {nicho} e desenvolvemos uma operação comercial com IA para acelerar o fechamento de orçamentos e agendamentos diretamente no WhatsApp.

Vocês teriam 2 minutinhos para ver uma demonstração rápida de como ficaria para a {empresa}?`;

    const savedTemplate =
      db.getSetting('whatsapp_cold_pitch_template', null, this.userId) ||
      db.getSetting('whatsapp_pitch_template', null, this.userId);
    this.pitchTemplate = savedTemplate || this.defaultTemplate;
  }

  getSentTodayCount() {
    try {
      const row = db.db.prepare(`
        SELECT COUNT(*) as count
        FROM message_logs
        WHERE user_id = ?
          AND sender_account = 'whatsapp_dispatcher'
          AND date(sent_at) = date('now')
      `).get(this.userId);
      return row ? Number(row.count) : 0;
    } catch {
      return 0;
    }
  }

  getPendingLeadsCount() {
    try {
      const row = db.db.prepare(`
        SELECT COUNT(*) as count
        FROM leads
        WHERE user_id = ?
          AND is_whatsapp_active = 1
          AND phone IS NOT NULL
          AND length(phone) >= 10
          AND id NOT IN (
            SELECT DISTINCT lead_id
            FROM message_logs
            WHERE user_id = ?
              AND sender_account = 'whatsapp_dispatcher'
          )
      `).get(this.userId, this.userId);
      return row ? Number(row.count) : 0;
    } catch {
      return 0;
    }
  }

  getNextPendingLead() {
    try {
      return db.db.prepare(`
        SELECT *
        FROM leads
        WHERE user_id = ?
          AND is_whatsapp_active = 1
          AND phone IS NOT NULL
          AND length(phone) >= 10
          AND id NOT IN (
            SELECT DISTINCT lead_id
            FROM message_logs
            WHERE user_id = ?
              AND sender_account = 'whatsapp_dispatcher'
          )
        ORDER BY id ASC
        LIMIT 1
      `).get(this.userId, this.userId) || null;
    } catch {
      return null;
    }
  }

  getStatus() {
    const sentToday = this.getSentTodayCount();
    const pendingCount = this.getPendingLeadsCount();

    const savedTemplate =
      db.getSetting('whatsapp_cold_pitch_template', null, this.userId) ||
      db.getSetting('whatsapp_pitch_template', null, this.userId);
    if (savedTemplate) this.pitchTemplate = savedTemplate;

    const savedMinDelay = db.getSetting('whatsapp_min_delay', null, this.userId);
    if (savedMinDelay) this.minDelaySeconds = parseInt(savedMinDelay, 10);
    const savedMaxDelay = db.getSetting('whatsapp_max_delay', null, this.userId);
    if (savedMaxDelay) this.maxDelaySeconds = parseInt(savedMaxDelay, 10);

    return {
      isRunning: this.isRunning,
      isWhatsappConnected: isNativeConnectedForUser(this.userId),
      sentToday,
      dailyLimit: this.dailyLimit,
      pendingCount,
      minDelaySeconds: this.minDelaySeconds,
      maxDelaySeconds: this.maxDelaySeconds,
      lastSentAt: this.lastSentAt,
      nextRunAt: this.nextRunAt,
      currentLead: this.currentLead,
      lastError: this.lastError,
      pitchTemplate: this.pitchTemplate
    };
  }

  updateConfig({ minDelaySeconds, maxDelaySeconds, dailyLimit, pitchTemplate } = {}) {
    if (minDelaySeconds !== undefined) {
      this.minDelaySeconds = Math.max(10, parseInt(minDelaySeconds, 10));
      db.setSetting('whatsapp_min_delay', this.minDelaySeconds, this.userId);
    }
    if (maxDelaySeconds !== undefined) {
      this.maxDelaySeconds = Math.max(this.minDelaySeconds, parseInt(maxDelaySeconds, 10));
      db.setSetting('whatsapp_max_delay', this.maxDelaySeconds, this.userId);
    }
    if (dailyLimit !== undefined) {
      this.dailyLimit = Math.max(1, parseInt(dailyLimit, 10));
    }
    if (pitchTemplate && typeof pitchTemplate === 'string') {
      this.pitchTemplate = pitchTemplate;
      db.setSetting('whatsapp_pitch_template', this.pitchTemplate, this.userId);
      db.setSetting('whatsapp_cold_pitch_template', this.pitchTemplate, this.userId);
    }
    return this.getStatus();
  }

  start() {
    if (this.isRunning) return this.getStatus();
    this.isRunning = true;
    this.lastError = null;
    this.scheduleNextTick(1000);
    return this.getStatus();
  }

  pause() {
    this.isRunning = false;
    this.currentLead = null;
    this.nextRunAt = null;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    return this.getStatus();
  }

  toggle() {
    if (this.isRunning) {
      return this.pause();
    }
    return this.start();
  }

  scheduleNextTick(delayMs) {
    if (this.timerId) clearTimeout(this.timerId);
    this.nextRunAt = Date.now() + delayMs;

    this.timerId = setTimeout(() => {
      this.executeTick().catch(err => {
        console.error(`❌ [WhatsApp Dispatcher User #${this.userId}] Erro no tick:`, err.message);
        if (this.isRunning) {
          this.scheduleNextTick(15000);
        }
      });
    }, delayMs);
  }

  async executeTick() {
    if (!this.isRunning) return;

    const owner = db.getUserById(this.userId);
    if (!owner || !owner.active) {
      this.pause();
      return;
    }

    // Busca todos os chips ATIVOS e não restritos pertencentes ao tenant
    const activeChips = getConnectedSessionsForUser(this.userId);
    if (!activeChips || activeChips.length === 0) {
      this.lastError = 'Nenhum chip WhatsApp conectado (ou todos estão RESTRITOS). Conecte um chip pelo QR Code.';
      this.scheduleNextTick(15000);
      return;
    }

    const sentToday = this.getSentTodayCount();
    if (sentToday >= this.dailyLimit) {
      this.lastError = `Limite diário atingido (${sentToday}/${this.dailyLimit} envios). Fila pausada por segurança.`;
      this.pause();
      return;
    }

    const lead = this.getNextPendingLead();
    if (!lead) {
      this.currentLead = null;
      this.scheduleNextTick(30000);
      return;
    }

    this.currentLead = {
      id: lead.id,
      name: lead.name,
      company: lead.company_name,
      phone: lead.phone
    };

    const company = lead.company_name || lead.name || 'sua empresa';
    const activeTemplate =
      db.getSetting('whatsapp_cold_pitch_template', null, this.userId) ||
      db.getSetting('whatsapp_pitch_template', null, this.userId) ||
      this.pitchTemplate;
    const messageText = formatTemplateMessage(activeTemplate, lead);

    // Rotação Round-Robin: Lead 1 -> Chip A, Lead 2 -> Chip B...
    const startIdx = this.roundRobinCursor % activeChips.length;
    this.roundRobinCursor = (startIdx + 1) % activeChips.length;

    let delivered = false;
    for (let attempt = 0; attempt < activeChips.length; attempt++) {
      const chip = activeChips[(startIdx + attempt) % activeChips.length];

      try {
        const sendResult = await sendNativeTextMessageForUser(
          this.userId,
          lead.phone,
          messageText,
          chip.id
        );

        if (sendResult.success) {
          this.lastSentAt = new Date().toISOString();
          this.lastError = null;
          this.lastChipUsed = { id: chip.id, name: chip.session_name };

          db.logSentMessage(lead.id, 'whatsapp_dispatcher', messageText, this.userId);
          db.addConversationMessage(lead.id, 'assistant', messageText, this.userId);
          db.updateLead(lead.id, { status: 'in_qualification' }, this.userId);

          console.log(`✅ [WhatsApp Dispatcher User #${this.userId}] Enviado para ${company} via Chip #${chip.id} (${chip.session_name})`);
          delivered = true;
          break;
        }

        const isMetaRestriction =
          sendResult.isRestriction ||
          [401, 403, 428].includes(Number(sendResult.statusCode));

        if (isMetaRestriction) {
          markSessionRestricted(
            this.userId,
            chip.id,
            sendResult.error || `Restrição HTTP ${sendResult.statusCode || 'Meta'}`
          );
          this.lastError = `Chip "${chip.session_name}" recebeu restrição (${sendResult.statusCode || 'Meta'}) e foi isolado; tentando próximo chip.`;
          continue;
        }

        this.lastError = sendResult.error || `Falha no envio pelo chip ${chip.session_name}`;
      } catch (err) {
        const errCode = Number(err?.output?.statusCode || err?.statusCode || 0);
        const isMetaRestriction =
          [401, 403, 428].includes(errCode) ||
          /\b(401|403|428)\b/.test(String(err.message || ''));

        if (isMetaRestriction) {
          markSessionRestricted(this.userId, chip.id, err.message);
          this.lastError = `Chip "${chip.session_name}" marcado como RESTRITO; alternando automaticamente para próximo chip.`;
          continue;
        }
        this.lastError = err.message;
      }
    }

    if (!delivered && !this.lastError) {
      this.lastError = 'Nenhum chip ativo conseguiu concluir o envio neste ciclo.';
    }

    if (this.isRunning) {
      const randomSeconds = Math.floor(
        Math.random() * (this.maxDelaySeconds - this.minDelaySeconds + 1)
      ) + this.minDelaySeconds;
      this.scheduleNextTick(randomSeconds * 1000);
    }
  }
}

const dispatchersByUser = new Map();

export function getDispatcherForUser(userId) {
  const uid = Number(userId);
  if (!uid) throw new Error('userId obrigatório para acessar fila de disparos.');
  let instance = dispatchersByUser.get(uid);
  if (!instance) {
    instance = new TenantWhatsAppDispatcher(uid);
    dispatchersByUser.set(uid, instance);
  }
  return instance;
}

export function stopDispatcherForUser(userId) {
  const uid = Number(userId);
  const instance = dispatchersByUser.get(uid);
  if (instance) {
    instance.pause();
  }
}

export default { getDispatcherForUser, stopDispatcherForUser, formatTemplateMessage };
