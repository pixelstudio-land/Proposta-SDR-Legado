import db from '../../database/db.js';
import { sendNativeTextMessage, isNativeConnected } from '../../integrations/whatsapp-client.js';

/**
 * Formata dinamicamente o template de disparo frio de WhatsApp substituindo todas as variáveis contextuais
 */
export function formatTemplateMessage(template, lead) {
  if (!template) return '';

  const company = lead.company_name || lead.name || 'sua empresa';
  const name = lead.name || 'tudo bem';
  
  // Nicho limpo
  let niche = lead.niche || 'seu segmento';
  if (niche.includes(',')) niche = niche.split(',')[0].trim();

  // Extração de Cidade, Endereço, Nota e Avaliações do ai_summary
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
    const parts = address.split('-');
    if (parts.length >= 2) {
      city = parts[parts.length - 2].trim().split(',').pop().trim();
    }
  } else if (lead.niche && lead.niche.includes('cidade')) {
    city = lead.niche.split('cidade')[1].trim();
  }

  // Saudação de acordo com o horário de Brasília (UTC-3)
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

class WhatsAppAutoDispatcher {
  constructor() {
    this.isRunning = false;
    this.timerId = null;

    const savedMinDelay = db.getSetting('whatsapp_min_delay');
    const savedMaxDelay = db.getSetting('whatsapp_max_delay');
    this.minDelaySeconds = savedMinDelay ? parseInt(savedMinDelay, 10) : 60;
    this.maxDelaySeconds = savedMaxDelay ? parseInt(savedMaxDelay, 10) : 120;
    this.dailyLimit = 50;
    this.lastSentAt = null;
    this.nextRunAt = null;
    this.currentLead = null;
    this.lastError = null;

    this.defaultTemplate = 
`{saudacao}, tudo bem? Vi a {empresa} aqui no Google ({nota} ★ com {avaliacoes} avaliações) em {cidade} e achei o posicionamento de vocês excelente.

Acompanho o mercado de {nicho} e desenvolvemos uma operação comercial com IA para acelerar o fechamento de orçamentos e agendamentos diretamente no WhatsApp.

Vocês teriam 2 minutinhos para ver uma demonstração rápida de como ficaria para a {empresa}?`;

    const savedTemplate = db.getSetting('whatsapp_cold_pitch_template') || db.getSetting('whatsapp_pitch_template');
    this.pitchTemplate = savedTemplate || this.defaultTemplate;
  }

  /**
   * Retorna contagem de envios de hoje pelo dispatcher
   */
  getSentTodayCount() {
    try {
      const row = db.db.prepare(`
        SELECT COUNT(*) as count 
        FROM message_logs 
        WHERE sender_account = 'whatsapp_dispatcher' 
          AND date(sent_at) = date('now')
      `).get();
      return row ? Number(row.count) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Retorna a quantidade de leads com WhatsApp ativo prontos para envio
   */
  getPendingLeadsCount() {
    try {
      const row = db.db.prepare(`
        SELECT COUNT(*) as count 
        FROM leads 
        WHERE is_whatsapp_active = 1 
          AND phone IS NOT NULL 
          AND length(phone) >= 10
          AND id NOT IN (
            SELECT DISTINCT lead_id 
            FROM message_logs 
            WHERE sender_account = 'whatsapp_dispatcher'
          )
      `).get();
      return row ? Number(row.count) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Retorna o próximo lead elegível para abordagem
   */
  getNextPendingLead() {
    try {
      return db.db.prepare(`
        SELECT * 
        FROM leads 
        WHERE is_whatsapp_active = 1 
          AND phone IS NOT NULL 
          AND length(phone) >= 10
          AND id NOT IN (
            SELECT DISTINCT lead_id 
            FROM message_logs 
            WHERE sender_account = 'whatsapp_dispatcher'
          )
        ORDER BY id ASC 
        LIMIT 1
      `).get() || null;
    } catch {
      return null;
    }
  }

  /**
   * Retorna o estado completo da fila para exibição no painel
   */
  getStatus() {
    const sentToday = this.getSentTodayCount();
    const pendingCount = this.getPendingLeadsCount();

    // Sincroniza dinamicamente com SQLite caso tenha sido alterado via painel
    const savedTemplate = db.getSetting('whatsapp_pitch_template');
    if (savedTemplate) this.pitchTemplate = savedTemplate;
    const savedMinDelay = db.getSetting('whatsapp_min_delay');
    if (savedMinDelay) this.minDelaySeconds = parseInt(savedMinDelay, 10);
    const savedMaxDelay = db.getSetting('whatsapp_max_delay');
    if (savedMaxDelay) this.maxDelaySeconds = parseInt(savedMaxDelay, 10);

    return {
      isRunning: this.isRunning,
      isWhatsappConnected: isNativeConnected(),
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

  /**
   * Atualiza as configurações de delay, teto e template (com persistência no SQLite)
   */
  updateConfig({ minDelaySeconds, maxDelaySeconds, dailyLimit, pitchTemplate } = {}) {
    if (minDelaySeconds !== undefined) {
      this.minDelaySeconds = Math.max(10, parseInt(minDelaySeconds, 10));
      db.setSetting('whatsapp_min_delay', this.minDelaySeconds);
    }
    if (maxDelaySeconds !== undefined) {
      this.maxDelaySeconds = Math.max(this.minDelaySeconds, parseInt(maxDelaySeconds, 10));
      db.setSetting('whatsapp_max_delay', this.maxDelaySeconds);
    }
    if (dailyLimit !== undefined) {
      this.dailyLimit = Math.max(1, parseInt(dailyLimit, 10));
    }
    if (pitchTemplate && typeof pitchTemplate === 'string') {
      this.pitchTemplate = pitchTemplate;
      db.setSetting('whatsapp_pitch_template', this.pitchTemplate);
    }
    return this.getStatus();
  }

  /**
   * Inicia o processamento contínuo da fila
   */
  start() {
    if (this.isRunning) return this.getStatus();
    this.isRunning = true;
    this.lastError = null;
    console.log('🚀 [WhatsApp Dispatcher] Fila de prospecção iniciada.');
    this.scheduleNextTick(1000);
    return this.getStatus();
  }

  /**
   * Pausa a fila
   */
  pause() {
    this.isRunning = false;
    this.currentLead = null;
    this.nextRunAt = null;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    console.log('⏸️ [WhatsApp Dispatcher] Fila de prospecção pausada.');
    return this.getStatus();
  }

  /**
   * Alterna estado entre Ligado / Pausado
   */
  toggle() {
    if (this.isRunning) {
      return this.pause();
    } else {
      return this.start();
    }
  }

  /**
   * Agenda o próximo envio com delay randômico anti-ban
   */
  scheduleNextTick(delayMs) {
    if (this.timerId) clearTimeout(this.timerId);
    this.nextRunAt = Date.now() + delayMs;

    this.timerId = setTimeout(() => {
      this.executeTick().catch(err => {
        console.error('❌ [WhatsApp Dispatcher] Erro no tick da fila:', err.message);
        if (this.isRunning) {
          this.scheduleNextTick(15000);
        }
      });
    }, delayMs);
  }

  /**
   * Executa um ciclo de envio
   */
  async executeTick() {
    if (!this.isRunning) return;

    // 1. Checa se o WhatsApp está conectado
    if (!isNativeConnected()) {
      this.lastError = 'WhatsApp local não conectado. Conecte pelo QR Code para iniciar os envios.';
      console.warn(`⚠️ [WhatsApp Dispatcher] ${this.lastError}`);
      this.scheduleNextTick(15000);
      return;
    }

    // 2. Checa limite diário de segurança
    const sentToday = this.getSentTodayCount();
    if (sentToday >= this.dailyLimit) {
      this.lastError = `Limite diário atingido (${sentToday}/${this.dailyLimit} envios). Fila pausada por segurança.`;
      console.warn(`⚠️ [WhatsApp Dispatcher] ${this.lastError}`);
      this.pause();
      return;
    }

    // 3. Resgata próximo lead
    const lead = this.getNextPendingLead();
    if (!lead) {
      console.log('ℹ️ [WhatsApp Dispatcher] Nenhum lead pendente com WhatsApp ativo no momento. Aguardando novos leads...');
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

    // 4. Monta a mensagem personalizada com substituição de variáveis
    const company = lead.company_name || lead.name || 'sua empresa';
    const activeTemplate = db.getSetting('whatsapp_cold_pitch_template') || db.getSetting('whatsapp_pitch_template') || this.pitchTemplate;
    const messageText = formatTemplateMessage(activeTemplate, lead);

    console.log(`📤 [WhatsApp Dispatcher] Disparando prospecção para ${company} (${lead.phone})...`);

    try {
      const sendResult = await sendNativeTextMessage(lead.phone, messageText);

      if (sendResult.success) {
        this.lastSentAt = new Date().toISOString();
        this.lastError = null;

        // Registra histórico no banco
        db.logSentMessage(lead.id, 'whatsapp_dispatcher', messageText);
        db.addConversationMessage(lead.id, 'assistant', messageText);
        db.updateLead(lead.id, { status: 'in_qualification' });

        console.log(`✅ [WhatsApp Dispatcher] Mensagem enviada com sucesso para ${company}! Message ID: ${sendResult.messageId}`);
      } else {
        this.lastError = sendResult.error || 'Falha ao entregar mensagem';
        console.warn(`⚠️ [WhatsApp Dispatcher] Falha ao enviar para ${lead.phone}: ${this.lastError}`);
      }
    } catch (err) {
      this.lastError = err.message;
      console.error(`❌ [WhatsApp Dispatcher] Exceção no envio: ${err.message}`);
    }

    // 5. Calcula delay randômico anti-ban para o próximo envio
    if (this.isRunning) {
      const randomSeconds = Math.floor(
        Math.random() * (this.maxDelaySeconds - this.minDelaySeconds + 1)
      ) + this.minDelaySeconds;

      console.log(`⏱️ [WhatsApp Dispatcher] Próximo disparo em ${randomSeconds} segundos (delay anti-ban)...`);
      this.scheduleNextTick(randomSeconds * 1000);
    }
  }
}

export const whatsappDispatcher = new WhatsAppAutoDispatcher();
export default whatsappDispatcher;

