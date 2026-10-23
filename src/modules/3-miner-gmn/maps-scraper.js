import { chromium } from 'playwright';
import { settings } from '../../../config/settings.js';

class GoogleMapsScraper {
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  randomDelay(min = 1000, max = 2500) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Executa a raspagem de empresas no Google Maps por termo de busca
   * @param {string} searchQuery - Ex: 'Clinica Odontologica Barueri SP'
   * @param {number} limit - Quantidade máxima de estabelecimentos para extrair
   */
  async scrape(searchQuery, limit = 5) {
    console.log(`🌐 [MapsScraper] Iniciando extração no Google Maps para: "${searchQuery}" (Limite: ${limit})`);

    const launchOptions = {
      headless: settings.outbound.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1366,768'
      ]
    };

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: 'pt-BR',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    const extractedBusinesses = [];

    try {
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}?hl=pt-BR`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await this.sleep(this.randomDelay(3000, 5000));

      // 1. Trata modais de cookies e consentimento do Google
      try {
        const acceptButton = await page.$('button[aria-label*="Aceitar tudo"], form[action*="consent"] button, button:has-text("Aceitar tudo"), button:has-text("Concordo")');
        if (acceptButton) {
          await acceptButton.click();
          await this.sleep(1500);
        }
      } catch (_) {}

      // 2. Aguarda a lista de resultados
      const feedSelector = 'div[role="feed"], div[aria-label*="Resultados para"], div.m6QErb[aria-label]';
      await page.waitForSelector(feedSelector, { timeout: 20000 }).catch(() => null);

      let scrollAttempts = 0;
      const maxScrollAttempts = Math.max(8, Math.ceil(limit / 2));

      // 3. Rola a listagem lateral para carregar cards suficientes
      while (scrollAttempts < maxScrollAttempts) {
        scrollAttempts++;

        const currentAnchors = await page.$$('div[role="feed"] a[href*="/maps/place/"], a.hfpxzc, a[href*="/maps/place/"]');
        if (currentAnchors.length >= limit) {
          break;
        }

        await page.evaluate(selector => {
          const feed = document.querySelector(selector) || document.querySelector('div[role="feed"]');
          if (feed) feed.scrollTop += 1200;
        }, feedSelector);

        await this.sleep(this.randomDelay(1800, 2600));

        const bodyContent = await page.content();
        if (bodyContent.includes('Você chegou ao final da lista') || bodyContent.includes('fim dos resultados')) {
          break;
        }
      }

      // 4. Coleta os cards e metadados visíveis diretamente no feed da lista lateral
      const feedCardsData = await page.evaluate(maxLimit => {
        const feed = document.querySelector('div[role="feed"]') || document.body;
        const cards = Array.from(feed.querySelectorAll('div.Nv2PK, div.THOPZb'));
        const results = [];
        const seenUrls = new Set();

        for (const card of cards) {
          if (results.length >= maxLimit) break;

          const anchor = card.querySelector('a.hfpxzc, a[href*="/maps/place/"]');
          const href = anchor ? anchor.getAttribute('href') : null;
          if (!href || seenUrls.has(href)) continue;
          seenUrls.add(href);

          const name = card.querySelector('div.qBF1Pd')?.innerText?.trim() || null;
          const ratingText = card.querySelector('span.MW4etd')?.innerText?.trim() || null;

          // Procura contagem real de avaliações no próprio card da listagem
          let cardReviews = null;

          // 1. span.UY7F9 ou span com classe de avaliações
          const uySpan = card.querySelector('span.UY7F9');
          if (uySpan) {
            const digits = uySpan.innerText.replace(/\D/g, '');
            if (digits) cardReviews = parseInt(digits, 10);
          }

          // 2. Span com aria-label contendo avaliações
          if (!cardReviews) {
            const ariaSpan = card.querySelector('span[aria-label*="avaliaç" i], span[aria-label*="comentário" i]');
            if (ariaSpan) {
              const match = (ariaSpan.getAttribute('aria-label') || '').match(/([\d\.]+)\s*(?:avalia|coment)/i);
              if (match) cardReviews = parseInt(match[1].replace(/\./g, ''), 10);
            }
          }

          // 3. Span entre parênteses logo ao lado da nota/estrela (ex: (142))
          if (!cardReviews) {
            const ratingSub = card.querySelector('div.AJB7ye, div.W4Efsd, span.e4rVHe');
            if (ratingSub) {
              const textSub = ratingSub.innerText || '';
              const matchParen = textSub.match(/\(([\d\.]+)\)/);
              if (matchParen) {
                const parsed = parseInt(matchParen[1].replace(/\./g, ''), 10);
                if (parsed && parsed !== 11) cardReviews = parsed;
              }
            }
          }

          results.push({
            placeUrl: href,
            cardName: name,
            cardRating: ratingText,
            cardReviews: cardReviews
          });
        }

        return results;
      }, limit);

      console.log(`📍 [MapsScraper] ${feedCardsData.length} estabelecimentos mapeados no feed. Extraindo dados completos...`);

      // 5. Visita cada estabelecimento para extrair detalhes cadastrais (Telefone, Endereço, Site, etc.)
      for (let i = 0; i < feedCardsData.length; i++) {
        const itemMeta = feedCardsData[i];
        const placeUrl = itemMeta.placeUrl;

        try {
          await page.goto(placeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await this.sleep(this.randomDelay(2000, 3200));

          // Nome da Empresa
          const nameEl = await page.$('h1.DUwDvf, div[role="main"] h1, h1');
          const companyName = nameEl ? (await nameEl.innerText()).trim() : (itemMeta.cardName || null);

          if (!companyName) continue;

          // Telefone: Seletores múltiplos e inspeção de data-item-id
          let rawPhone = null;
          const phoneEl = await page.$(
            'button[data-tooltip*="telefone" i], button[data-item-id*="phone:"], a[data-item-id*="phone:"], button[aria-label*="Telefone:" i], [data-item-id^="phone:"]'
          );

          if (phoneEl) {
            const dataItemId = await phoneEl.getAttribute('data-item-id');
            const ariaLabel = await phoneEl.getAttribute('aria-label');
            const innerText = (await phoneEl.innerText()).trim();

            if (dataItemId && dataItemId.includes('phone:')) {
              rawPhone = dataItemId.replace('phone:tel:', '').replace('phone:', '').trim();
            } else if (ariaLabel && /telefone:/i.test(ariaLabel)) {
              rawPhone = ariaLabel.replace(/.*telefone:\s*/i, '').trim();
            } else if (innerText && /\d{4,}/.test(innerText)) {
              rawPhone = innerText;
            }
          }

          // Endereço
          let address = null;
          const addressEl = await page.$(
            'button[data-item-id="address"], button[data-item-id*="address"], button[aria-label*="Endereço:" i], button[data-tooltip*="endereço" i]'
          );
          if (addressEl) {
            const ariaLabel = await addressEl.getAttribute('aria-label');
            const innerText = (await addressEl.innerText()).trim();
            address = (ariaLabel ? ariaLabel.replace(/.*endereço:\s*/i, '') : innerText).trim();
          }

          // Website
          let website = null;
          const websiteEl = await page.$(
            'a[data-item-id="authority"], a[data-tooltip*="site" i], a[aria-label*="Website:" i], a[aria-label*="Site:" i]'
          );
          if (websiteEl) {
            website = await websiteEl.getAttribute('href');
          }

          // Avaliação (Estrelas): Prioriza o valor extraído da página ou do card
          let rating = itemMeta.cardRating || null;
          const f7 = await page.$('div.F7nice');
          if (f7) {
            const ariaSpan = await f7.$('span[aria-label*="estrela" i], span.ceNzKf');
            if (ariaSpan) {
              const aria = await ariaSpan.getAttribute('aria-label');
              const match = aria ? aria.match(/([\d,\.]+)/) : null;
              if (match) rating = match[1];
            }
            if (!rating) {
              const hiddenSpan = await f7.$('span[aria-hidden="true"]');
              if (hiddenSpan) {
                const text = (await hiddenSpan.innerText()).trim();
                if (text && /^\d+([,\.]\d+)?$/.test(text)) rating = text;
              }
            }
          }

          // Quantidade de Avaliações: Extração 100% autêntica sem números artificiais
          let reviewsCount = itemMeta.cardReviews || null;

          if (!reviewsCount && f7) {
            const reviewSpan = await f7.$('span[aria-label*="avalia" i], span:has-text("("), span:nth-child(2)');
            if (reviewSpan) {
              const aria = (await reviewSpan.getAttribute('aria-label')) || '';
              const txt = (await reviewSpan.innerText()) || '';
              const match = (aria + ' ' + txt).match(/([\d\.]+)/);
              if (match) {
                reviewsCount = parseInt(match[1].replace(/\./g, ''), 10);
              }
            }
          }

          if (!reviewsCount) {
            const reviewsEl = await page.$(
              'button[aria-label*="avaliaç" i], button[aria-label*="comentário" i], span[aria-label*="avaliaç" i], span.UY7F9, div.F7nice + span'
            );
            if (reviewsEl) {
              const reviewsRaw = (await reviewsEl.innerText()) || (await reviewsEl.getAttribute('aria-label')) || '';
              const match = reviewsRaw.match(/([\d\.]+)\s*(?:avaliaç|comentário|\))/i);
              if (match) {
                reviewsCount = parseInt(match[1].replace(/\./g, ''), 10);
              }
            }
          }

          const businessData = {
            companyName,
            rawPhone,
            address,
            website,
            rating,
            reviewsCount, // null se não houver no Maps (sem valores fictícios)
            niche: searchQuery,
            mapsUrl: placeUrl
          };

          extractedBusinesses.push(businessData);
          const reviewDisplay = reviewsCount ? `(${reviewsCount} reviews)` : '(sem reviews visíveis)';
          console.log(`🏢 [MapsScraper] [${i + 1}/${feedCardsData.length}] ${companyName} | Fone: ${rawPhone || 'S/N'} | Nota: ${rating ? rating + ' ★' : 'S/N'} ${reviewDisplay}`);

        } catch (itemErr) {
          console.warn(`⚠️ [MapsScraper] Erro ao extrair item [${i + 1}]: ${itemErr.message}`);
        }
      }

    } catch (error) {
      console.error(`❌ [MapsScraper] Erro durante a raspagem do Google Maps: ${error.message}`);
      throw error;
    } finally {
      await browser.close();
    }

    return extractedBusinesses;
  }
}

export const mapsScraper = new GoogleMapsScraper();
export default mapsScraper;
