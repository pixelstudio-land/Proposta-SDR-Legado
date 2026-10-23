import { chromium } from 'playwright';
import fs from 'fs';
import { settings } from '../../../config/settings.js';
import db from '../../database/db.js';
import accountRotator from './account-rotator.js';

class TargetScraper {
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  randomDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Inicializa o navegador e restaura a sessão salva (storageState)
   */
  async initBrowser(account) {
    const launchOptions = {
      headless: settings.outbound.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1280,800'
      ]
    };

    if (account.proxy) {
      launchOptions.proxy = { server: account.proxy };
    }

    const browser = await chromium.launch(launchOptions);
    const contextOptions = {
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    };

    if (fs.existsSync(account.sessionFile)) {
      contextOptions.storageState = account.sessionFile;
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    return { browser, context, page };
  }

  /**
   * Realiza login no Instagram caso a sessão não exista ou tenha expirado
   */
  async ensureAuthenticated(page, context, account) {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.sleep(this.randomDelay(2000, 3500));

    // Se encontrar campo de login, preenche
    const loginField = await page.$('input[name="username"]');
    if (loginField) {
      console.log(`🔑 [TargetScraper] Efetuando login orgânico para @${account.username}...`);

      await page.fill('input[name="username"]', account.username);
      await this.sleep(this.randomDelay(500, 1200));
      await page.fill('input[name="password"]', account.password);
      await this.sleep(this.randomDelay(800, 1500));

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {}),
        page.click('button[type="submit"]')
      ]);

      await this.sleep(this.randomDelay(3000, 5000));

      // Salva a nova sessão no disco
      await context.storageState({ path: account.sessionFile });
      console.log(`💾 [TargetScraper] Sessão salva com sucesso em: ${account.sessionFile}`);
    }
  }

  /**
   * Raspa os seguidores de um perfil de referência/concorrente e salva novos leads no SQLite
   */
  async scrapeFollowers(targetProfile, limit = 20) {
    const cleanTarget = String(targetProfile).replace('@', '').trim();
    const account = accountRotator.getNextScraperAccount();

    console.log(`🚀 [TargetScraper] Iniciando extração do perfil @${cleanTarget} usando Scraper @${account.username}`);

    const { browser, context, page } = await this.initBrowser(account);
    const collectedLeads = [];

    try {
      await this.ensureAuthenticated(page, context, account);

      // 1. Acessa a página do concorrente
      const targetUrl = `https://www.instagram.com/${cleanTarget}/`;
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.sleep(this.randomDelay(2500, 4000));

      // 2. Abre a modal de seguidores
      const followersLinkSelector = `a[href*="/followers/"]`;
      await page.waitForSelector(followersLinkSelector, { timeout: 15000 });
      await page.click(followersLinkSelector);
      await this.sleep(this.randomDelay(3000, 4500));

      // 3. Rola a lista modal coletando usernames
      const modalScrollSelector = 'div[class*="x1dm5hii"], div[role="dialog"] div[style*="overflow"]';
      const userHandles = new Set();

      let scrollAttempts = 0;
      while (userHandles.size < limit && scrollAttempts < 15) {
        scrollAttempts++;

        const anchors = await page.$$('div[role="dialog"] a[role="link"] span, div[role="dialog"] a[href^="/"]');
        for (const el of anchors) {
          const href = await el.getAttribute('href').catch(() => null);
          const text = await el.innerText().catch(() => null);
          const handle = (href ? href.replace(/\//g, '') : text || '').trim();

          if (handle && !handle.includes('explore') && !handle.includes('direct') && handle !== cleanTarget) {
            userHandles.add(handle);
          }
        }

        // Simula rolagem com mouse na modal
        await page.mouse.wheel(0, 600);
        await this.sleep(this.randomDelay(1500, 2800));
      }

      console.log(`📊 [TargetScraper] ${userHandles.size} perfis brutos encontrados na modal. Iniciando inspeção detalhada...`);

      // 4. Visita cada perfil para coletar Bio, Nome e verificar se é privado
      for (const username of Array.from(userHandles).slice(0, limit)) {
        const identifier = `@${username}`;

        // Checagem anti-duplicação no SQLite WAL
        if (db.isBlacklisted(identifier) || db.getLeadByIdentifier(identifier)) {
          console.log(`⏭️ [TargetScraper] Pulando ${identifier} (já cadastrado ou na blacklist).`);
          continue;
        }

        try {
          await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await this.sleep(this.randomDelay(1800, 3200));

          // Extração de bio e cabeçalho
          const bioElement = await page.$('header section div:nth-child(3), header section h1 + div, header div.-vDIg span');
          const bioText = bioElement ? (await bioElement.innerText()).trim() : '';

          const nameElement = await page.$('header section h2, header section h1');
          const fullName = nameElement ? (await nameElement.innerText()).trim() : username;

          const isPrivateText = await page.content();
          const isPrivate = isPrivateText.includes('Esta conta é privada') || isPrivateText.includes('This account is private');

          // Salva no SQLite
          const savedLead = db.createOrUpdateLead({
            source: 'outbound_instagram',
            identifier,
            name: fullName,
            status: isPrivate ? 'disqualified' : 'new',
            ai_summary: isPrivate ? 'Conta privada descartada automaticamente' : (bioText || 'Sem bio informada')
          });

          collectedLeads.push(savedLead);
          console.log(`✅ [TargetScraper] Salvo no banco: ${identifier} | Privado: ${isPrivate ? 'Sim' : 'Não'}`);

          await this.sleep(this.randomDelay(1000, 2000));
        } catch (err) {
          console.warn(`⚠️ [TargetScraper] Falha ao inspecionar @${username}: ${err.message}`);
        }
      }

    } catch (error) {
      console.error(`❌ [TargetScraper] Erro durante raspagem: ${error.message}`);
      accountRotator.markAccountChallenged('scraper', account.username, error.message);
      throw error;
    } finally {
      await browser.close();
    }

    return collectedLeads;
  }
}

export const targetScraper = new TargetScraper();
export default targetScraper;
