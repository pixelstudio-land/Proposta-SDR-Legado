-- ==============================================================================
-- SCHEMA DO BANCO RELACIONAL: LEGADO SDR ENGINE (SAAS MULTI-TENANT SQLITE WAL)
-- ==============================================================================

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- 0. Usuários (Multi-Tenant SaaS)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
    max_chips INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 0.1 Metadados Internos do Sistema (ex: jwt_secret persistente)
CREATE TABLE IF NOT EXISTS system_meta (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 1. Cadastro Unificado de Leads (Isolado por user_id)
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    source TEXT NOT NULL,                -- 'inbound_official', 'outbound_instagram', 'miner_gmn'
    identifier TEXT NOT NULL,            -- @handle do Instagram ou telefone E.164
    name TEXT,
    company_name TEXT,
    phone TEXT,
    instagram TEXT,                      -- @perfil oficial do Instagram
    is_whatsapp_active INTEGER DEFAULT 0,-- 1 se validado no Baileys, 0 se sem whatsapp, null/-1 se não verificado
    phone_type TEXT,                     -- 'landline' (fixo) ou 'mobile' (celular)
    niche TEXT,
    revenue_range TEXT,
    status TEXT DEFAULT 'new',           -- 'new', 'in_qualification', 'qualified', 'disqualified', 'converted', 'no_whatsapp', 'invalid'
    ai_summary TEXT,
    crm_synced INTEGER DEFAULT 0,        -- 1 se injetado no CRM com sucesso
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, identifier),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Memória Contínua da Conversa (Isolado por user_id)
CREATE TABLE IF NOT EXISTS conversation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    lead_id INTEGER NOT NULL,
    role TEXT NOT NULL,                  -- 'system', 'assistant', 'user'
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Histórico de Disparos e Proteção Anti-Duplicação (Isolado por user_id)
CREATE TABLE IF NOT EXISTS message_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    lead_id INTEGER NOT NULL,
    sender_account TEXT NOT NULL,        -- Qual conta SENDER ou whatsapp_dispatcher realizou o envio
    message_content TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Lista Negra (Opt-out / Bloqueios - Isolado por user_id)
CREATE TABLE IF NOT EXISTS blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    identifier TEXT NOT NULL,
    reason TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, identifier),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Gerenciamento de Contas do Instagram (Scrapers e Senders - Isolado por user_id)
CREATE TABLE IF NOT EXISTS instagram_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,              -- usuário do Instagram (sem @)
    password TEXT NOT NULL,              -- senha para autenticação automática
    role TEXT NOT NULL,                  -- 'scraper' (fantasma) ou 'sender' (aquecida)
    proxy TEXT,                          -- formato opcional http://user:pass@ip:port
    daily_limit INTEGER DEFAULT 25,      -- teto de DMs diárias
    status TEXT DEFAULT 'disconnected',  -- 'disconnected', 'active', 'challenged'
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, username),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Configurações Dinâmicas da Operação por Tenant (Persistência no SQLite)
CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, key),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Sessões WhatsApp Baileys Multi-Tenant (Chips por usuário)
CREATE TABLE IF NOT EXISTS wa_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_name TEXT NOT NULL DEFAULT 'Chip Principal',
    phone_number TEXT,
    status TEXT NOT NULL DEFAULT 'DISCONNECTED', -- 'DISCONNECTED', 'CONNECTING', 'QR_READY', 'CONNECTED'
    auth_dir TEXT NOT NULL,
    last_connected_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices de Alta Performance Multi-Tenant
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_identifier ON leads(user_id, identifier);
CREATE INDEX IF NOT EXISTS idx_leads_user_status ON leads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_history_user_lead ON conversation_history(user_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_sender ON message_logs(user_id, sender_account, sent_at);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON instagram_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_role ON instagram_accounts(user_id, role);
CREATE INDEX IF NOT EXISTS idx_settings_user_key ON app_settings(user_id, key);
CREATE INDEX IF NOT EXISTS idx_wa_sessions_user_id ON wa_sessions(user_id);
