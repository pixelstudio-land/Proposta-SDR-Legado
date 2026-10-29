import { chromium } from 'playwright';
import path from 'path';

async function captureScreenshots() {
  console.log('Iniciando captura de screenshots em http://localhost:3000...');
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2 // Alta nitidez (Retina)
  });

  const page = await context.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // 1. Screenshot Geral do Dashboard
  const dashboardPath = path.resolve('assets/print-dashboard-geral.png');
  await page.screenshot({ path: dashboardPath, fullPage: false });
  console.log(`✅ Screenshot geral capturada: ${dashboardPath}`);

  // 2. Localiza o botão Dossiê do lead Dr. Ricardo Mendes (id 23)
  console.log('Localizando botão Dossiê do Dr. Ricardo Mendes (lead 23)...');
  
  // Rola até o botão e clica
  const dossierBtn = page.locator('button.btn-open-modal[data-lead-id="23"]').first();
  await dossierBtn.scrollIntoViewIfNeeded();
  await dossierBtn.click();

  // Aguarda o modal abrir e carregar o histórico de conversa
  await page.waitForSelector('#leadModal:not(.hidden)', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('#modalChatHistory .chat-entry', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000); // aguarda animação e estilos

  // Expande altura do container para exibir os 4 balões reais da conversa sem cortar
  await page.evaluate(() => {
    const thread = document.querySelector('#modalChatHistory');
    if (thread) {
      thread.style.maxHeight = 'none';
      thread.style.overflow = 'visible';
    }
    const box = document.querySelector('#leadModal .modal-box');
    if (box) {
      box.style.maxHeight = 'none';
      box.style.height = 'auto';
    }
    const content = document.querySelector('#leadModal .modal-content');
    if (content) {
      content.style.maxHeight = 'none';
      content.style.overflow = 'visible';
    }
  });

  await page.waitForTimeout(500);

  // Captura o modal aberto de alta resolução com os 4 balões visíveis
  const chatModalPath = path.resolve('assets/print-chat-amanda.png');
  const modalBox = page.locator('#leadModal .modal-box');
  await modalBox.screenshot({ path: chatModalPath });
  console.log(`✅ Screenshot do chat da Amanda SDR capturada: ${chatModalPath}`);

  await browser.close();
  console.log('Finalizado com sucesso!');
}

captureScreenshots().catch(err => {
  console.error('Erro na captura:', err);
  process.exit(1);
});
