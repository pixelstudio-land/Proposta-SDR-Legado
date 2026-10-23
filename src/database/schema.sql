-- ==============================================================================
-- SCHEMA DO BANCO RELACIONAL: LEGADO SDR ENGINE (SQLITE WAL)
-- ==============================================================================

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- 1. Cadastro Unificado de Leads (Inbound, Outbound e Minerador)
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,                -- 'inbound_official', 'outbound_instagram', 'miner_gmn'
    identifier TEXT UNIQUE NOT NULL,     -- @handle do Instagram ou telefone E.164 (ex: 551130001234)
    name TEXT,
    company_name TEXT,
    phone TEXT,
    is_whatsapp_active INTEGER DEFAULT 0,-- 1 se validado na API de WhatsApp, 0 caso contrário
    phone_type TEXT,                     -- 'landline' (fixo) ou 'mobile' (celular)
    niche TEXT,
    revenue_range TEXT,
    status TEXT DEFAULT 'new',           -- 'new', 'in_qualification', 'qualified', 'disqualified', 'converted'
    ai_summary TEXT,
    crm_synced INTEGER DEFAULT 0,        -- 1 se injetado no CRM com sucesso
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Memória Contínua da Conversa (Elimina a amnésia entre turnos do ManyChat/WhatsApp)
CREATE TABLE IF NOT EXISTS conversation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    role TEXT NOT NULL,                  -- 'system', 'assistant', 'user'
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- 3. Histórico de Disparos e Proteção Anti-Duplicação do Outbound
CREATE TABLE IF NOT EXISTS message_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    sender_account TEXT NOT NULL,        -- Qual conta SENDER realizou o envio
    message_content TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(lead_id) REFERENCES leads(id)
);

-- 4. Lista Negra (Opt-out / Bloqueios)
CREATE TABLE IF NOT EXISTS blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT UNIQUE NOT NULL,
    reason TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Gerenciamento de Contas do Instagram (Scrapers e Senders)
CREATE TABLE IF NOT EXISTS instagram_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,       -- usuário do Instagram (sem @)
    password TEXT NOT NULL,              -- senha para autenticação automática
    role TEXT NOT NULL,                  -- 'scraper' (fantasma) ou 'sender' (aquecida)
    proxy TEXT,                          -- formato opcional http://user:pass@ip:port
    daily_limit INTEGER DEFAULT 25,      -- teto de DMs diárias
    status TEXT DEFAULT 'disconnected',  -- 'disconnected', 'active', 'challenged'
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_leads_identifier ON leads(identifier);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_history_lead ON conversation_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_logs_sender ON message_logs(sender_account, sent_at);
CREATE INDEX IF NOT EXISTS idx_accounts_username ON instagram_accounts(username);
CREATE INDEX IF NOT EXISTS idx_accounts_role ON instagram_accounts(role);
