import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Carrega variáveis do arquivo .env localizado na raiz
dotenv.config({ path: path.join(rootDir, '.env') });

export const settings = {
  // Configurações do Servidor
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    webhookSecret: process.env.WEBHOOK_SECRET || 'default_secret',
    manychatApiKey: process.env.MANYCHAT_API_KEY || '',
    adminPassword: process.env.PANEL_PASSWORD || process.env.ADMIN_PASSWORD || 'legado123'
  },

  // Motor OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 500
  },

  // Gateway de WhatsApp Nativo Baileys
  whatsapp: {
    sdrNotificationPhone: (process.env.ALERT_WHATSAPP || process.env.SDR_NOTIFICATION_PHONE || '').replace(/\D/g, '')
  },

  // CRM
  crm: {
    webhookUrl: process.env.CRM_WEBHOOK_URL || '',
    bearerToken: process.env.CRM_API_BEARER_TOKEN || '',
    defaultToken: '72504a54-a2c1-4098-ac5d-038dfba26139'
  },

  // Modelos e Padrões da Operação SDR IA
  defaults: {
    icpMinRevenue: 30000,
    crmDestinationToken: '72504a54-a2c1-4098-ac5d-038dfba26139',
    whatsappColdPitchTemplate: `{saudacao}, tudo bem? Vi a {empresa} aqui no Google ({nota} ★ com {avaliacoes} avaliações) em {cidade} e achei o posicionamento de vocês excelente.

Acompanho o mercado de {nicho} e desenvolvemos uma operação comercial com IA para acelerar o fechamento de orçamentos e agendamentos diretamente no WhatsApp.

Vocês teriam 2 minutinhos para ver uma demonstração rápida de como ficaria para a {empresa}?`,

    instagramColdPitchTemplate: `Olá {nome}! Tudo bem? Vi o perfil da {empresa} no segmento de {nicho} e achei o trabalho de vocês de altíssimo nível.

Nós desenvolvemos uma tecnologia de SDR com Inteligência Artificial para converter o tráfego e curiosos do Direct em reuniões e vendas no WhatsApp.

Você teria 2 minutos para ver uma demonstração de como ficaria para a {empresa}?`,

    amandaInboundInstructions: `O lead veio até a Legado pelo Instagram / ManyChat (inbound). Conduza uma triagem consultiva e empática: pergunte o nicho de atuação e valide se o faturamento mensal atual atinge a faixa de corte (R$ {meta_corte}/mês), explicando com naturalidade que essa informação serve para direcionar ao estrategista comercial ideal para o porte dele.`,

    amandaOutboundInstructions: `Nós abordamos essa empresa de forma ativa no WhatsApp / Google Maps. PROIBIDO perguntar sobre faturamento logo no início (seria invasivo). Aja como uma consultora de negócios, gere valor, compreenda a dor no atendimento ou conversão de orçamentos e qualifique o lead pelo interesse na reunião estratégica de demonstração. Pergunte a faixa de faturamento apenas sutilmente no fechamento, ou aprove diretamente empresas já consolidadas e ativas.`
  },

  // Banco de Dados SQLite (WAL)
  database: {
    path: process.env.DATABASE_PATH || path.join(rootDir, 'data', 'database.sqlite'),
    schemaPath: path.join(rootDir, 'src', 'database', 'schema.sql')
  },

  // Caminhos de Dados e Sessões
  paths: {
    rootDir,
    exportsDir: path.join(rootDir, 'data', 'exports'),
    sessionsDir: path.join(rootDir, 'data', 'sessions'),
    proxiesFile: path.join(rootDir, 'config', 'proxies.txt')
  },

  // Outbound Instagram: Blindagem com separação estrita de Scrapers vs Senders
  outbound: {
    maxDailyDmsPerSender: parseInt(process.env.MAX_DAILY_DMS_PER_SENDER || '25', 10),
    minDelaySeconds: parseInt(process.env.MIN_DELAY_SECONDS || '120', 10),
    maxDelaySeconds: parseInt(process.env.MAX_DELAY_SECONDS || '300', 10),
    headless: process.env.HEADLESS_BROWSER !== 'false',

    // Contas Fantasmas (Scrapers): Somente coletam seguidores e bios de concorrentes.
    // Se forem desafiadas, nenhuma conta de envio é impactada.
    scraperAccounts: [
      {
        id: 'scraper_01',
        username: process.env.INSTA_SCRAPER_01_USER || 'scraper_alpha',
        password: process.env.INSTA_SCRAPER_01_PASS || '',
        sessionDir: path.join(rootDir, 'data', 'sessions', 'scraper_01'),
        proxy: process.env.INSTA_SCRAPER_01_PROXY || null,
        active: true
      },
      {
        id: 'scraper_02',
        username: process.env.INSTA_SCRAPER_02_USER || 'scraper_beta',
        password: process.env.INSTA_SCRAPER_02_PASS || '',
        sessionDir: path.join(rootDir, 'data', 'sessions', 'scraper_02'),
        proxy: process.env.INSTA_SCRAPER_02_PROXY || null,
        active: true
      }
    ],

    // Contas de Envio (Senders): Perfis comerciais aquecidos que apenas enviam a DM
    // para leads já pré-auditados e aprovados pela IA.
    senderAccounts: [
      {
        id: 'sender_01',
        username: process.env.INSTA_SENDER_01_USER || 'consultor.legado.01',
        password: process.env.INSTA_SENDER_01_PASS || '',
        sessionDir: path.join(rootDir, 'data', 'sessions', 'sender_01'),
        proxy: process.env.INSTA_SENDER_01_PROXY || null,
        dailyLimit: parseInt(process.env.MAX_DAILY_DMS_PER_SENDER || '25', 10),
        active: true
      },
      {
        id: 'sender_02',
        username: process.env.INSTA_SENDER_02_USER || 'consultor.legado.02',
        password: process.env.INSTA_SENDER_02_PASS || '',
        sessionDir: path.join(rootDir, 'data', 'sessions', 'sender_02'),
        proxy: process.env.INSTA_SENDER_02_PROXY || null,
        dailyLimit: parseInt(process.env.MAX_DAILY_DMS_PER_SENDER || '25', 10),
        active: true
      }
    ]
  }
};

export default settings;
