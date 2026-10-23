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
    manychatApiKey: process.env.MANYCHAT_API_KEY || ''
  },

  // Motor OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 500
  },

  // Gateway de WhatsApp
  whatsapp: {
    apiUrl: (process.env.WA_API_URL || 'http://localhost:8080').replace(/\/$/, ''),
    apiKey: process.env.WA_API_KEY || '',
    instanceName: process.env.WA_INSTANCE_NAME || 'legado_sdr',
    sdrNotificationPhone: (process.env.SDR_NOTIFICATION_PHONE || '').replace(/\D/g, '')
  },

  // CRM
  crm: {
    webhookUrl: process.env.CRM_WEBHOOK_URL || '',
    bearerToken: process.env.CRM_API_BEARER_TOKEN || ''
  },

  // Banco de Dados SQLite (WAL)
  database: {
    path: path.join(rootDir, 'config', 'database.sqlite'),
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
