import { chromium } from 'playwright';
import fs from 'fs';
import { settings } from '../../../config/settings.js';
import db from '../../database/db.js';
import openaiClient from '../../ai/openai-client.js';
import accountRotator from './account-rotator.js';

class OutboundMessenger {
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Inicializa o navegador com a sessão da conta Sender
   */
  async initBrowser(senderAccount) {
    const launchOptions = {
      headless: settings.outbound.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,800'
      ]
    };

    if (senderAccount.proxy) {
      launchOptions.proxy = { server: senderAccount.proxy };
    }

    const browser = await chromium.launch(launchOptions);
    const contextOptions = {
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    };

    if (fs.existsSync(senderAccount.sessionFile)) {
      contextOptions.storageState = senderAccount.sessionFile;
      console.log(`🔒 [Messenger] Carregando cookies de sessão autenticada da conta Sender: ${senderAccount.sessionFile}`);
    } else {
      console.warn(`⚠️ [Messenger] Sessão não encontrada em ${senderAccount.sessionFile}. Autentique @${senderAccount.username} no Dashboard.`);
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    return { browser, context, page };
  }

  /**
   * Garante autenticação da conta Sender salvando storageState
   */
  async ensureAuthenticated(page, context, senderAccount) {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.sleep(this.randomDelay(2000, 3500));

    const loginInput = await page.$('input[name="username"]');
    if (loginInput) {
      console.log(`🔑 [Messenger] Efetuando login da conta Sender @${senderAccount.username}...`);
      await page.fill('input[name="username"]', senderAccount.username);
      await this.sleep(this.randomDelay(500, 1000));
      await page.fill('input[name="password"]', senderAccount.password);
      await this.sleep(this.randomDelay(800, 1500));

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {}),
        page.click('button[type="submit"]')
      ]);

      await this.sleep(this.randomDelay(3000, 5000));
      await context.storageState({ path: senderAccount.sessionFile });
      console.log(`💾 [Messenger] Sessão da conta Sender salva: ${senderAccount.sessionFile}`);
    }
  }

  /**
   * Digita o texto caractere por caractere com delay randômico humano (80ms a 200ms)
   */
  async humanType(page, selector, text) {
    console.log(`⌨️ [Messenger] Digitando Cold DM humanizadamente tecla por tecla (80-200ms)...`);
    await page.click(selector);
    for (const char of text) {
      await page.keyboard.type(char, { delay: this.randomDelay(80, 200) });
    }
  }

  /**
   * Dispara mensagens frias para os leads aprovados
   */
  async sendColdDms(maxBatch = 5) {
    // 1. Busca leads prontos para envio (status 'in_qualification' da fonte outbound_instagram)
    const approvedLeads = db.db.prepare(`
      SELECT * FROM leads 
      WHERE source = 'outbound_instagram' AND status = 'in_qualification'
      ORDER BY id ASC
      LIMIT ?
    `).all(maxBatch);

    if (approvedLeads.length === 0) {
      console.log('ℹ️ [Messenger] Nenhum lead aprovado aguardando envio no momento.');
      return { sent: 0, skipped: 0 };
    }

    console.log(`📬 [Messenger] Iniciando disparo para lote de ${approvedLeads.length} leads aprovados...`);

    let currentSender = accountRotator.getNextAvailableSenderAccount();
    let { browser, context, page } = await this.initBrowser(currentSender);

    let sentCount = 0;
    let skippedCount = 0;

    try {
      await this.ensureAuthenticated(page, context, currentSender);

      for (const lead of approvedLeads) {
        const username = lead.identifier.replace('@', '').trim();

        // 2. Proteção Anti-Duplicação: checa se recebeu mensagem nos últimos 90 dias
        const recentMessage = db.db.prepare(`
          SELECT id FROM message_logs 
          WHERE lead_id = ? AND sent_at >= datetime('now', '-90 days')
        `).get(lead.id);

        if (recentMessage) {
          console.log(`⏭️ [Messenger] Pulando ${lead.identifier}: já abordado nos últimos 90 dias.`);
          db.updateLeadStatus(lead.id, 'contacted', 'Lead já contatado nos últimos 90 dias');
          skippedCount++;
          continue;
        }

        // 3. Checa cota da conta atual e rotaciona se necessário
        const sentToday = db.getDailySentCount(currentSender.username);
        if (sentToday >= currentSender.dailyLimit) {
          console.warn(`🔄 [Messenger] Cota da conta @${currentSender.username} atingida. Rotacionando...`);
          await browser.close();
          currentSender = accountRotator.getNextAvailableSenderAccount();
          const newSession = await this.initBrowser(currentSender);
          browser = newSession.browser;
          context = newSession.context;
          page = newSession.page;
          await this.ensureAuthenticated(page, context, currentSender);
        }

        // 4. Gera a cópia personalizada usando o GPT-4o-mini
        console.log(`✍️ [Messenger] Gerando mensagem fria para ${lead.identifier}...`);
        const messageText = await openaiClient.generateColdDM({
          username,
          niche: lead.niche,
          bio: lead.ai_summary
        });

        console.log(`💬 [Messenger] Mensagem gerada: "${messageText}"`);

        // 5. Navega até o perfil no Instagram
        await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.sleep(this.randomDelay(2500, 4500));

        // 6. Clica no botão de Mensagem / Direct
        const messageBtnSelector = 'div[role="button"]:has-text("Mensagem"), div[role="button"]:has-text("Message"), header section button:has-text("Mensagem")';
        const messageBtn = await page.$(messageBtnSelector);

        if (!messageBtn) {
          console.warn(`⚠️ [Messenger] Botão de mensagem não encontrado para @${username}. Pode ser perfil privado ou com Direct restrito.`);
          db.updateLeadStatus(lead.id, 'disqualified', 'Direct desabilitado ou restrito');
          skippedCount++;
          continue;
        }

        await messageBtn.click();
        await this.sleep(this.randomDelay(3000, 5000));

        // 7. Encontra a caixa de texto de chat e digita humanizadamente
        const chatInputSelector = 'div[role="textbox"][contenteditable="true"], div[aria-label="Mensagem"], div[aria-label="Message"]';
        await page.waitForSelector(chatInputSelector, { timeout: 15000 });

        await this.humanType(page, chatInputSelector, messageText);
        await this.sleep(this.randomDelay(1000, 2000));

        // 8. Pressiona Enter para enviar
        await page.keyboard.press('Enter');
        await this.sleep(this.randomDelay(2000, 3500));

        // 9. Registra log de envio no SQLite WAL e atualiza lead
        db.logSentMessage(lead.id, currentSender.username, messageText);
        db.updateLeadStatus(lead.id, 'contacted', `Cold DM enviada via @${currentSender.username}`);
        sentCount++;

        console.log(`🚀 [Messenger] DM enviada com sucesso para ${lead.identifier} via @${currentSender.username}! (${sentToday + 1}/${currentSender.dailyLimit} hoje)`);

        // 10. Delay de segurança orgânico obrigatório entre disparos (120s a 300s em produção)
        const delaySeconds = settings.server.nodeEnv === 'development'
          ? this.randomDelay(10, 20) // Em modo dev delay menor para testes
          : this.randomDelay(settings.outbound.minDelaySeconds, settings.outbound.maxDelaySeconds);

        console.log(`⏳ [Messenger] Aguardando pausa de segurança de ${delaySeconds} segundos antes do próximo envio...`);
        await this.sleep(delaySeconds * 1000);
      }

    } catch (error) {
      console.error(`🚨 [Messenger] Erro crítico no envio: ${error.message}`);
      accountRotator.markAccountChallenged('sender', currentSender.username, error.message);
      throw error;
    } finally {
      await browser.close();
    }

    return { sent: sentCount, skipped: skippedCount };
  }
}

export const outboundMessenger = new OutboundMessenger();
export default outboundMessenger;
