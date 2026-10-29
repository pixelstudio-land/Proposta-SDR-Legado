import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function generatePdf() {
  const outputPath = path.resolve('PROPOSTA_COMERCIAL_LEGADO_LEONARDO.pdf');

  // Converte imagem em base64 para garantir renderização perfeita no PDF
  function getBase64Image(relPath) {
    const fullPath = path.resolve(relPath);
    if (!fs.existsSync(fullPath)) return '';
    const ext = path.extname(fullPath).replace('.', '');
    const data = fs.readFileSync(fullPath).toString('base64');
    return `data:image/${ext};base64,${data}`;
  }

  const imgDashboard = getBase64Image('assets/print-dashboard-geral.png');
  const imgChat = getBase64Image('assets/print-chat-amanda.png');

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Proposta Comercial — Máquina Comercial Legado 360°</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

    @page {
      size: A4;
      margin: 11mm 12mm 13mm 12mm;
      @bottom-right {
        content: "Página " counter(page) " de " counter(pages);
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 7.5pt;
        color: #94a3b8;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: 8.5pt;
      line-height: 1.48;
      -webkit-font-smoothing: antialiased;
    }

    .page-break {
      page-break-before: always;
      break-before: page;
    }

    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Header Superior */
    .doc-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .brand-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      font-weight: 700;
      color: #059669;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 3px;
    }

    .doc-title {
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }

    .doc-subtitle {
      font-size: 8.5pt;
      color: #64748b;
      margin-top: 2px;
    }

    .meta-box {
      text-align: right;
      font-size: 7.5pt;
      color: #475569;
      line-height: 1.35;
      border-left: 2px solid #e2e8f0;
      padding-left: 10px;
    }

    .meta-box strong {
      color: #0f172a;
    }

    /* Tipografia de Seções */
    h2 {
      font-size: 10.5pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.01em;
      margin: 12px 0 6px 0;
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }

    h2 .section-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 17px;
      height: 17px;
      background: #0f172a;
      color: #ffffff;
      border-radius: 4px;
      font-size: 7.5pt;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
    }

    h3 {
      font-size: 9pt;
      font-weight: 700;
      color: #1e293b;
      margin: 8px 0 3px 0;
    }

    p {
      margin-bottom: 6px;
      color: #334155;
    }

    /* Grids e Cards */
    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin: 8px 0;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 8px 0;
    }

    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
    }

    .card-title {
      font-weight: 700;
      font-size: 9pt;
      color: #0f172a;
      margin-bottom: 3px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .card-badge {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 5px;
      border-radius: 3px;
      letter-spacing: 0.04em;
    }

    .badge-official {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }

    .badge-outbound {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }

    .badge-miner {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }

    .card ul {
      margin-left: 12px;
      margin-top: 4px;
      color: #475569;
      font-size: 8pt;
    }

    .card ul li {
      margin-bottom: 2px;
    }

    /* Diagrama Visual */
    .diagram-box {
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 7pt;
      line-height: 1.3;
      white-space: pre;
      margin: 8px 0;
      border: 1px solid #1e293b;
    }

    /* Tabelas */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 8pt;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      font-size: 8pt;
      letter-spacing: 0.02em;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    .table-price {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
    }

    .price-highlight {
      background: #ecfdf5 !important;
      color: #047857;
      font-weight: 700;
    }

    /* Box de Investimento em Destaque */
    .investment-container {
      background: #ffffff;
      border: 2px solid #0f172a;
      border-radius: 8px;
      padding: 12px 14px;
      margin: 10px 0;
    }

    .investment-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }

    .investment-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #0f172a;
    }

    .investment-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5pt;
      font-weight: 700;
      color: #059669;
    }

    .item-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 8pt;
    }

    .item-row.total-row {
      border-bottom: none;
      border-top: 2px solid #0f172a;
      margin-top: 8px;
      padding-top: 8px;
      font-size: 10pt;
      font-weight: 800;
      color: #0f172a;
    }

    .item-desc {
      color: #334155;
      padding-right: 12px;
    }

    .item-val {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #0f172a;
      text-align: right;
      white-space: nowrap;
    }

    /* Destaque Callout */
    .callout {
      border-left: 3px solid #059669;
      background: #f0fdf4;
      padding: 8px 10px;
      border-radius: 0 6px 6px 0;
      margin: 8px 0;
      font-size: 8pt;
    }

    .callout-title {
      font-weight: 700;
      color: #065f46;
      margin-bottom: 2px;
    }

    .callout-warning {
      border-left-color: #d97706;
      background: #fffbeb;
    }

    .callout-warning .callout-title {
      color: #92400e;
    }

    /* Galeria de Telas Reais */
    .preview-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 10px;
      margin: 10px 0;
    }

    .preview-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      background: #09090b;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .preview-img {
      width: 100%;
      height: 195px;
      object-fit: cover;
      display: block;
      border-bottom: 1px solid #27272a;
    }

    .preview-caption {
      padding: 7px 9px;
      font-size: 7.5pt;
      color: #cbd5e1;
      background: #09090b;
      line-height: 1.35;
    }

    .preview-caption strong {
      color: #f4f4f5;
      display: block;
      margin-bottom: 2px;
      font-size: 8pt;
    }
  </style>
</head>
<body>

  <!-- ========================================================================= -->
  <!-- PÁGINA 1: IDENTIFICAÇÃO E VISÃO GERAL DOS 3 MOTORES                       -->
  <!-- ========================================================================= -->
  <header class="doc-header">
    <div>
      <div class="brand-tag">PIXEL STUDIO • ENGENHARIA DE SOFTWARE &amp; IA</div>
      <h1 class="doc-title">Proposta Comercial &amp; Especificação Técnica</h1>
      <div class="doc-subtitle">Ecossistema de Aquisição Comercial Autônoma: Máquina Comercial Legado 360°</div>
    </div>
    <div class="meta-box">
      <div><strong>Cliente:</strong> Leonardo (Legado Performance)</div>
      <div><strong>Data:</strong> Outubro de 2026</div>
      <div><strong>Versão:</strong> 2.0 (Arquitetura Unificada)</div>
      <div><strong>Status:</strong> Especificação de Entrega</div>
    </div>
  </header>

  <p>
    Esta proposta formaliza a entrega e homologação da <strong>Máquina Comercial Legado 360°</strong>, um ecossistema tecnológico proprietário desenvolvido sob medida para a <strong>Legado Performance</strong>. A solução unifica três motores complementares de prospecção em uma única infraestrutura local de alta escala, eliminando gargalos manuais e gerando fluxo contínuo de reuniões com empresários qualificados.
  </p>

  <h2><span class="section-num">1</span> Arquitetura e Engenharia dos 3 Motores Comerciais</h2>

  <div class="grid-3">
    <!-- Motor 1 -->
    <div class="card">
      <div class="card-title">
        <span>Motor 1: Inbound Oficial</span>
      </div>
      <span class="card-badge badge-official">100% Homologado Meta</span>
      <ul>
        <li><strong>Canal:</strong> Direct @legadoperformance (Meta Ads + Reels orgânicos).</li>
        <li><strong>Triagem por IA:</strong> Consultora Amanda (OpenAI GPT-4o-mini).</li>
        <li><strong>Memória Contínua:</strong> SQLite WAL (sem amnésia entre turnos).</li>
        <li><strong>Transbordo Duplo:</strong> Notificação imediata no WhatsApp do SDR + injeção direta no CRM Legado.</li>
        <li><strong>Risco de Banimento:</strong> Zero (API oficial da Meta).</li>
      </ul>
    </div>

    <!-- Motor 2 -->
    <div class="card">
      <div class="card-title">
        <span>Motor 2: Outbound Blindado</span>
      </div>
      <span class="card-badge badge-outbound">Blindagem Anti-Ban</span>
      <ul>
        <li><strong>Canal:</strong> Perfis satélites isolados da conta oficial da agência.</li>
        <li><strong>Separação de Papéis:</strong> Scrapers (varrem alvos) vs Senders (disparam DMs).</li>
        <li><strong>Auditoria Cognitiva:</strong> IA avalia bios e descarta perfis pessoais.</li>
        <li><strong>Comportamento Humano:</strong> Digitação tecla a tecla e delays de 2 a 5 minutos.</li>
        <li><strong>Teto Diário:</strong> 20 a 25 DMs por perfil satélite.</li>
      </ul>
    </div>

    <!-- Motor 3 -->
    <div class="card">
      <div class="card-title">
        <span>Motor 3: Minerador GMN</span>
      </div>
      <span class="card-badge badge-miner">Validador WhatsApp B2B</span>
      <ul>
        <li><strong>Canal:</strong> Varredura no Google Maps por nicho e cidade em lote.</li>
        <li><strong>Aproveitamento B2B:</strong> Valida WhatsApp em números fixos (8 dígitos) e celulares (9 dígitos).</li>
        <li><strong>Higienização E.164:</strong> Sanitização automática com checagem ativa.</li>
        <li><strong>Exportação 1-Clique:</strong> Planilhas Excel (.xlsx) estruturadas para SDR.</li>
        <li><strong>Entrega de Dados:</strong> Nome, endereço, nota, site e WhatsApp verificado.</li>
      </ul>
    </div>
  </div>

  <div class="diagram-box">
                      MÁQUINA COMERCIAL LEGADO 360° (FLUXO EXECUTIVO)
               ┌─────────────────────────────────────────────────────────────┐
               │    [ MOTOR 1: INBOUND ]    [ MOTOR 2: OUTBOUND ]    [ MOTOR 3: MINERADOR ]    │
               │     Direct Oficial Meta       Instagram Satélites       Google Maps B2B       │
               └───────────────┬──────────────────────┬──────────────────────┬─────────┘
                               │                      │                      │
                               ▼                      ▼                      ▼
               ┌───────────────────────────────────────────────────────────────────────┐
               │         NÚCLEO RELACIONAL E AUDITORIA COGNITIVA (SQLITE WAL + IA)     │
               │  • Memória contínua de turnos  • Triagem de faturamento e ICP         │
               └───────────────────────────────────┬───────────────────────────────────┘
                                                   │
                                                   ▼
               ┌───────────────────────────────────────────────────────────────────────┐
               │                   TRANSBORDO DUPLO INSTANTÂNEO                        │
               │    [1] Alerta Executivo WhatsApp (SDR)    [2] Injeção no CRM Legado   │
               └───────────────────────────────────────────────────────────────────────┘
  </div>

  <div class="callout">
    <div class="callout-title">Painel de Controle Unificado (Dashboard Web Local)</div>
    Acompanha a operação em tempo real através do servidor web embutido na porta 3000: KPIs ao vivo, mini-consoles exibindo os passos dos robôs em tempo real, central de contas do Instagram com login interativo no navegador e download direto das bases mineradas em planilhas Excel.
  </div>

  <!-- ========================================================================= -->
  <!-- PÁGINA 2: VALORES ACORDADOS, PLATAFORMAS E TABELA COMPARATIVA             -->
  <!-- ========================================================================= -->
  <div class="page-break"></div>

  <h2><span class="section-num">2</span> Investimento Acordado e Condições Financeiras</h2>

  <p>
    Conforme alinhamento direto entre a <strong>Pixel Studio</strong> e o <strong>Leonardo</strong>, o modelo de contratação foi estruturado com total transparência: taxa única de engenharia pelo software proprietário + custos operacionais de ferramentas repassados a preço de custo, sem cobrança de mensalidades ou royalties sobre o faturamento da agência.
  </p>

  <div class="investment-container avoid-break">
    <div class="investment-header">
      <span class="investment-title">RESUMO FINANCEIRO CONSOLIDADO</span>
      <span class="investment-tag">VALOR ACORDADO</span>
    </div>

    <div class="item-row">
      <div class="item-desc">
        <strong>1. Honorários de Engenharia e Implementação (Pixel Studio):</strong><br>
        <span style="color: #64748b; font-size: 7.5pt;">Desenvolvimento completo dos 3 motores, automações em Playwright, banco SQLite WAL, integração OpenAI, módulo de transbordo duplo e Dashboard Web unificado.</span>
      </div>
      <div class="item-val">R$ 2.000,00</div>
    </div>

    <div class="item-row">
      <div class="item-desc">
        <strong>2. Plataformas Oficiais e Ferramentas (Custos Diretos da Legado):</strong><br>
        <span style="color: #64748b; font-size: 7.5pt;">• OpenAI API (GPT-4o-mini): Consumo de tokens direto na conta da agência (~R$ 40 a R$ 100/mês)<br>
        • ManyChat Pro Oficial: Licença oficial da Meta (~US$ 15 / ~R$ 85/mês)<br>
        • Evolution API / WhatsApp: Instância local gratuita ou VPS dedicada (~R$ 40 a R$ 80/mês)<br>
        • Proxies Móveis 4G: Somente se necessário para rotação de IP no Outbound (~R$ 60 a R$ 120/mês)</span>
      </div>
      <div class="item-val" style="color: #059669;">Preço de Custo<br><span style="font-size: 7pt; font-weight: 500; color: #64748b;">(< R$ 250/mês)</span></div>
    </div>

    <div class="item-row">
      <div class="item-desc">
        <strong>3. Contas Compradas (Perfis Satélites de Instagram):</strong><br>
        <span style="color: #64748b; font-size: 7.5pt;">Perfis descartáveis/aquecidos adquiridos para a operação satélite (Scrapers e Senders), repassados exatamente pelo custo do fornecedor (em média R$ 15 a R$ 35 por perfil conforme volume desejado).</span>
      </div>
      <div class="item-val" style="color: #059669;">Preço de Custo<br><span style="font-size: 7pt; font-weight: 500; color: #64748b;">(Sob demanda)</span></div>
    </div>

    <div class="item-row total-row">
      <div>TOTAL DO SETUP DE ENGENHARIA (PIXEL STUDIO)</div>
      <div>R$ 2.000,00</div>
    </div>
  </div>

  <h2><span class="section-num">3</span> Comparativo: Solução Terceira Alugada vs. Ativo Proprietário Legado</h2>

  <table>
    <thead>
      <tr>
        <th style="width: 24%;">Critério</th>
        <th style="width: 38%;">Plataformas Alugadas (Terceiros / Mentoria)</th>
        <th style="width: 38%;">Máquina Comercial Legado 360°</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Propriedade Tecnológica</strong></td>
        <td>Software de terceiro (caixa-preta). Se o serviço fechar ou a conta cair, perde-se tudo.</td>
        <td class="price-highlight">100% da tecnologia e dos dados pertencem à Legado Performance.</td>
      </tr>
      <tr>
        <td><strong>Mensalidades e Royalties</strong></td>
        <td>Mensalidade alta em dólar ou pedágio por lead gerado (R$ 1.500+ / mês).</td>
        <td class="price-highlight">Zero mensalidades para a Pixel Studio. Apenas ferramentas oficiais (< R$ 250/mês).</td>
      </tr>
      <tr>
        <td><strong>Risco no Perfil Principal</strong></td>
        <td>Alto risco: disparo frio executado no perfil oficial acarreta banimento do CNPJ.</td>
        <td class="price-highlight">Risco Zero: perfil oficial protegido via API Meta; disparo frio isolado em satélites.</td>
      </tr>
      <tr>
        <td><strong>Aproveitamento Telefônico</strong></td>
        <td>Descarte sumário de números de telefone fixo comercial.</td>
        <td class="price-highlight">Validação em lote de WhatsApp ativo para fixos (8 dígitos) e celulares.</td>
      </tr>
      <tr>
        <td><strong>Potencial de Revenda</strong></td>
        <td>Nenhum. A agência atua apenas como cliente pagador.</td>
        <td class="price-highlight">Produto de prateleira para revender a clientes por R$ 3k a R$ 5k de setup (100% de lucro).</td>
      </tr>
    </tbody>
  </table>

  <div class="callout callout-warning avoid-break">
    <div class="callout-title">Proteção Jurídica e Operacional do CNPJ</div>
    Ao manter o disparo frio exclusivamente em perfis satélites e conduzir o Inbound no canal oficial da Meta, a Legado blinda o perfil institucional @legadoperformance contra restrições ou bloqueios no Gerenciador de Anúncios.
  </div>

  <!-- ========================================================================= -->
  <!-- PÁGINA 3: TELAS REAIS, RETORNO (ROI), ESCOPO E PRÓXIMOS PASSOS            -->
  <!-- ========================================================================= -->
  <div class="page-break"></div>

  <h2><span class="section-num">4</span> Central de Controle e Evidências do Ecossistema</h2>

  <p>
    Capturas reais da interface executiva construída e da triagem investigativa executada pela consultora Amanda SDR:
  </p>

  <div class="preview-grid avoid-break">
    <div class="preview-card">
      <img src="${imgDashboard}" alt="Dashboard Executivo Real Legado" class="preview-img">
      <div class="preview-caption">
        <strong>Visão Geral do Painel Real (Linear Dark UI)</strong>
        Monitoramento dos 6 KPIs em tempo real, módulos de Google Maps e Outbound com trava de segurança, mini-console de streaming ao vivo e tabela de leads.
      </div>
    </div>

    <div class="preview-card">
      <img src="${imgChat}" alt="Chat Real Amanda SDR" class="preview-img">
      <div class="preview-caption">
        <strong>Dossiê Real do Lead Dr. Ricardo Mendes (@clinica.harmonize.alphaville)</strong>
        Memória contínua via SQLite WAL: Amanda SDR investiga nicho e faturamento (R$ 120k/mês), valida o ICP e executa o transbordo no WhatsApp.
      </div>
    </div>
  </div>

  <h2><span class="section-num">5</span> O Retorno do Investimento (ROI) da Legado</h2>

  <p>
    Além de alimentar o time de vendas da própria Legado Performance com reuniões diárias, esta infraestrutura foi projetada para gerar uma nova linha de receita recorrente para a agência:
  </p>
  <div class="grid-2 avoid-break">
    <div class="card">
      <div class="card-title">1. Para a Operação Interna da Legado</div>
      <p style="font-size: 8pt; color: #475569;">Gera de 5 a 15 reuniões comerciais qualificadas por semana sem depender de prospecção manual cansativa de SDR, qualificando ticket e faturamento antes de passar o contato ao consultor.</p>
    </div>
    <div class="card">
      <div class="card-title">2. Como Produto de Prateleira (Revenda)</div>
      <p style="font-size: 8pt; color: #475569;">A Legado pode empacotar este setup e vender para seus clientes de consultoria como <em>"Máquina de Orçamentos Legado"</em> por R$ 3.000 a R$ 5.000 de setup. <strong>Com 1 único cliente vendido, o investimento de R$ 2.000 já se paga com lucro líquido de 50% a 150%.</strong></p>
      <div style="margin-top: 5px; font-size: 7.2pt; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 4px;">
        <strong>Nota de escopo:</strong> O investimento atual de R$ 2.000,00 refere-se à engenharia, desenvolvimento proprietário e implantação da operação matriz da Legado Performance. Novos deploys individuais customizados para clientes finais da carteira contam com uma taxa enxuta e pré-acordada de ativação técnica por unidade implantada.
      </div>
    </div>
  </div>

  <h2><span class="section-num">6</span> Próximos Passos para Ativação em Produção</h2>

  <p>
    O sistema já se encontra codificado, unificado e operacional em ambiente local. A homologação final e subida em produção envolve:
  </p>
  <ul style="margin-left: 16px; margin-bottom: 14px; color: #475569; font-size: 8pt;">
    <li>1. Pagamento do setup de engenharia acordado (<strong>R$ 2.000,00</strong>);</li>
    <li>2. Conexão das credenciais definitivas da Legado (OpenAI, ManyChat e WhatsApp) no painel administrativo;</li>
    <li>3. Fornecimento das contas de Instagram satélites compradas e início da operação de escala.</li>
  </ul>

</body>
</html>
`;

  console.log('Iniciando geração do PDF executivo via Playwright Chromium...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setContent(htmlContent, { waitUntil: 'networkidle' });

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '12mm',
      bottom: '14mm',
      left: '12mm',
      right: '12mm'
    }
  });

  await browser.close();

  const stats = fs.statSync(outputPath);
  console.log(`✅ PDF gerado com sucesso em: ${outputPath}`);
  console.log(`Tamanho: ${(stats.size / 1024).toFixed(1)} KB`);
}

generatePdf().catch(err => {
  console.error('Falha ao gerar PDF:', err);
  process.exit(1);
});
