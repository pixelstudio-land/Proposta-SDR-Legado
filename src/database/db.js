import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { settings } from '../../config/settings.js';
import { generateStrongPassword, hashPassword } from '../utils/auth.js';

class AppDatabase {
  constructor() {
    const dbDir = path.dirname(settings.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new DatabaseSync(settings.database.path);

    // Configura alta concorrência 24/7 (leitura e escrita simultâneas via WAL)
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');

    this.initializeSchema();
    this.prepareStatements();
  }

  tableExists(tableName) {
    const row = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
      .get(tableName);
    return Boolean(row);
  }

  hasColumn(tableName, columnName) {
    if (!this.tableExists(tableName)) return false;
    const cols = this.db.prepare(`PRAGMA table_info(${tableName})`).all();
    return cols.some(col => col.name === columnName);
  }

  getTableSql(tableName) {
    const row = this.db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?")
      .get(tableName);
    return row?.sql || '';
  }

  initializeSchema() {
    // 1. Garante tabelas base de usuários, metadados e sessões WhatsApp
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
        max_chips INTEGER NOT NULL DEFAULT 1,
        active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_meta (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wa_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_name TEXT NOT NULL DEFAULT 'Chip Principal',
        phone_number TEXT,
        status TEXT NOT NULL DEFAULT 'DISCONNECTED',
        auth_dir TEXT NOT NULL,
        last_connected_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 2. Garante usuário Admin inicial (e-mail do Léo, senha forte temporária)
    let adminUser = this.db
      .prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1")
      .get();

    if (!adminUser) {
      const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'legadomidia@gmail.com').toLowerCase().trim();
      const tempPassword = process.env.INITIAL_ADMIN_PASSWORD || generateStrongPassword(16);
      const passwordHash = hashPassword(tempPassword);

      const insertRes = this.db.prepare(`
        INSERT INTO users (email, password_hash, role, max_chips, active)
        VALUES (?, ?, 'admin', 999, 1)
      `).run(adminEmail, passwordHash);

      adminUser = this.db.prepare('SELECT * FROM users WHERE id = ?').get(Number(insertRes.lastInsertRowid));

      console.log('================================================================');
      console.log('🔐 [SAAS MIGRATION] USUÁRIO ADMIN INICIAL CRIADO');
      console.log(`📧 E-mail: ${adminEmail}`);
      if (!process.env.INITIAL_ADMIN_PASSWORD) {
        console.log(`🔑 Senha temporária gerada: ${tempPassword}`);
      } else {
        console.log('🔑 Senha temporária definida via INITIAL_ADMIN_PASSWORD.');
      }
      console.log('================================================================');
    }

    const adminId = Number(adminUser.id);

    // 3. Migração segura das tabelas legadas preservando TODOS os registros existentes
    this.runMultiTenantMigration(adminId);

    // 4. Aplica schema.sql completo (garantindo tabelas novas e índices multi-tenant)
    if (fs.existsSync(settings.database.schemaPath)) {
      const schemaSql = fs.readFileSync(settings.database.schemaPath, 'utf8');
      this.db.exec(schemaSql);
    }

    // 5. Garante pelo menos 1 slot de WhatsApp para o Admin e migra sessão legada em disco se houver
    this.ensureDefaultWaSessionForAdmin(adminId);
  }

  runMultiTenantMigration(adminId) {
    this.db.exec('PRAGMA foreign_keys = OFF;');
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      // A. Migra tabela `leads` (adiciona user_id e troca UNIQUE(identifier) para UNIQUE(user_id, identifier))
      if (this.tableExists('leads')) {
        if (!this.hasColumn('leads', 'instagram')) {
          this.db.exec('ALTER TABLE leads ADD COLUMN instagram TEXT;');
        }
        const leadsSql = this.getTableSql('leads');
        const needsLeadsRebuild = !this.hasColumn('leads', 'user_id') || !leadsSql.includes('UNIQUE(user_id, identifier)');
        if (needsLeadsRebuild) {
          const hadUserId = this.hasColumn('leads', 'user_id');
          this.db.exec(`
            CREATE TABLE leads_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              source TEXT NOT NULL,
              identifier TEXT NOT NULL,
              name TEXT,
              company_name TEXT,
              phone TEXT,
              instagram TEXT,
              is_whatsapp_active INTEGER DEFAULT 0,
              phone_type TEXT,
              niche TEXT,
              revenue_range TEXT,
              status TEXT DEFAULT 'new',
              ai_summary TEXT,
              crm_synced INTEGER DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, identifier),
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
          `);
          if (hadUserId) {
            this.db.prepare(`
              INSERT INTO leads_new (
                id, user_id, source, identifier, name, company_name, phone, instagram,
                is_whatsapp_active, phone_type, niche, revenue_range, status, ai_summary,
                crm_synced, created_at, updated_at
              )
              SELECT
                id, COALESCE(user_id, ?), source, identifier, name, company_name, phone, instagram,
                is_whatsapp_active, phone_type, niche, revenue_range, status, ai_summary,
                crm_synced, created_at, updated_at
              FROM leads
            `).run(adminId);
          } else {
            this.db.prepare(`
              INSERT INTO leads_new (
                id, user_id, source, identifier, name, company_name, phone, instagram,
                is_whatsapp_active, phone_type, niche, revenue_range, status, ai_summary,
                crm_synced, created_at, updated_at
              )
              SELECT
                id, ?, source, identifier, name, company_name, phone, instagram,
                is_whatsapp_active, phone_type, niche, revenue_range, status, ai_summary,
                crm_synced, created_at, updated_at
              FROM leads
            `).run(adminId);
          }
          this.db.exec('DROP TABLE leads; ALTER TABLE leads_new RENAME TO leads;');
        }
      }

      // B. Migra tabela `conversation_history`
      if (this.tableExists('conversation_history')) {
        if (!this.hasColumn('conversation_history', 'user_id')) {
          this.db.exec('ALTER TABLE conversation_history ADD COLUMN user_id INTEGER;');
        }
        this.db.prepare(`
          UPDATE conversation_history
          SET user_id = COALESCE(
            (SELECT user_id FROM leads WHERE leads.id = conversation_history.lead_id),
            ?
          )
          WHERE user_id IS NULL
        `).run(adminId);
      }

      // C. Migra tabela `message_logs`
      if (this.tableExists('message_logs')) {
        if (!this.hasColumn('message_logs', 'user_id')) {
          this.db.exec('ALTER TABLE message_logs ADD COLUMN user_id INTEGER;');
        }
        this.db.prepare(`
          UPDATE message_logs
          SET user_id = COALESCE(
            (SELECT user_id FROM leads WHERE leads.id = message_logs.lead_id),
            ?
          )
          WHERE user_id IS NULL
        `).run(adminId);
      }

      // D. Migra tabela `app_settings` (chave primária composta por user_id + key)
      if (this.tableExists('app_settings')) {
        const settingsSql = this.getTableSql('app_settings');
        const needsSettingsRebuild = !this.hasColumn('app_settings', 'user_id') || !settingsSql.includes('UNIQUE(user_id, key)');
        if (needsSettingsRebuild) {
          const hadUserId = this.hasColumn('app_settings', 'user_id');
          this.db.exec(`
            CREATE TABLE app_settings_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              key TEXT NOT NULL,
              value TEXT,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, key),
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
          `);
          if (hadUserId) {
            this.db.prepare(`
              INSERT INTO app_settings_new (user_id, key, value, updated_at)
              SELECT COALESCE(user_id, ?), key, value, updated_at FROM app_settings
            `).run(adminId);
          } else {
            this.db.prepare(`
              INSERT INTO app_settings_new (user_id, key, value, updated_at)
              SELECT ?, key, value, updated_at FROM app_settings
            `).run(adminId);
          }
          this.db.exec('DROP TABLE app_settings; ALTER TABLE app_settings_new RENAME TO app_settings;');
        }
      }

      // E. Migra tabela `instagram_accounts`
      if (this.tableExists('instagram_accounts')) {
        const igSql = this.getTableSql('instagram_accounts');
        const needsIgRebuild = !this.hasColumn('instagram_accounts', 'user_id') || !igSql.includes('UNIQUE(user_id, username)');
        if (needsIgRebuild) {
          const hadUserId = this.hasColumn('instagram_accounts', 'user_id');
          this.db.exec(`
            CREATE TABLE instagram_accounts_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              username TEXT NOT NULL,
              password TEXT NOT NULL,
              role TEXT NOT NULL,
              proxy TEXT,
              daily_limit INTEGER DEFAULT 25,
              status TEXT DEFAULT 'disconnected',
              last_login_at DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, username),
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
          `);
          if (hadUserId) {
            this.db.prepare(`
              INSERT INTO instagram_accounts_new (
                id, user_id, username, password, role, proxy, daily_limit, status, last_login_at, created_at
              )
              SELECT id, COALESCE(user_id, ?), username, password, role, proxy, daily_limit, status, last_login_at, created_at
              FROM instagram_accounts
            `).run(adminId);
          } else {
            this.db.prepare(`
              INSERT INTO instagram_accounts_new (
                id, user_id, username, password, role, proxy, daily_limit, status, last_login_at, created_at
              )
              SELECT id, ?, username, password, role, proxy, daily_limit, status, last_login_at, created_at
              FROM instagram_accounts
            `).run(adminId);
          }
          this.db.exec('DROP TABLE instagram_accounts; ALTER TABLE instagram_accounts_new RENAME TO instagram_accounts;');
        }
      }

      // F. Migra tabela `blacklist`
      if (this.tableExists('blacklist')) {
        const blSql = this.getTableSql('blacklist');
        const needsBlRebuild = !this.hasColumn('blacklist', 'user_id') || !blSql.includes('UNIQUE(user_id, identifier)');
        if (needsBlRebuild) {
          const hadUserId = this.hasColumn('blacklist', 'user_id');
          this.db.exec(`
            CREATE TABLE blacklist_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              identifier TEXT NOT NULL,
              reason TEXT,
              added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, identifier),
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
          `);
          if (hadUserId) {
            this.db.prepare(`
              INSERT INTO blacklist_new (id, user_id, identifier, reason, added_at)
              SELECT id, COALESCE(user_id, ?), identifier, reason, added_at FROM blacklist
            `).run(adminId);
          } else {
            this.db.prepare(`
              INSERT INTO blacklist_new (id, user_id, identifier, reason, added_at)
              SELECT id, ?, identifier, reason, added_at FROM blacklist
            `).run(adminId);
          }
          this.db.exec('DROP TABLE blacklist; ALTER TABLE blacklist_new RENAME TO blacklist;');
        }
      }

      // G. Garante UPDATE explícito vinculando quaisquer registros órfãos ao admin inicial
      const tablesToBackfill = ['leads', 'app_settings', 'instagram_accounts', 'conversation_history', 'message_logs', 'blacklist', 'wa_sessions'];
      for (const tbl of tablesToBackfill) {
        if (this.tableExists(tbl) && this.hasColumn(tbl, 'user_id')) {
          this.db.prepare(`UPDATE ${tbl} SET user_id = ? WHERE user_id IS NULL`).run(adminId);
        }
      }

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      console.error('❌ [DB Migration] Falha na migração multi-tenant:', err.message);
      throw err;
    } finally {
      this.db.exec('PRAGMA foreign_keys = ON;');
    }
  }

  ensureDefaultWaSessionForAdmin(adminId) {
    const existing = this.db
      .prepare('SELECT id, auth_dir FROM wa_sessions WHERE user_id = ? ORDER BY id ASC LIMIT 1')
      .get(adminId);

    const dataRoot = path.dirname(settings.database.path);
    const waSessionsRoot = path.join(dataRoot, 'wa_sessions');
    const legacyBaseWaDir = path.join(dataRoot, 'whatsapp-auth');

    if (!existing) {
      const insertRes = this.db.prepare(`
        INSERT INTO wa_sessions (user_id, session_name, status, auth_dir)
        VALUES (?, 'Chip Principal', 'DISCONNECTED', ?)
      `).run(adminId, `user_${adminId}/chip_pending`);

      const chipId = Number(insertRes.lastInsertRowid);
      const canonicalAuthDir = `user_${adminId}/chip_${chipId}`;
      this.db.prepare('UPDATE wa_sessions SET auth_dir = ? WHERE id = ?').run(canonicalAuthDir, chipId);

      // Se houver credenciais legadas diretamente na raiz de data/whatsapp-auth/, move para /data/wa_sessions/user_{id}/chip_{id}
      const targetAuthDir = path.join(waSessionsRoot, canonicalAuthDir);
      if (fs.existsSync(legacyBaseWaDir)) {
        const legacyCreds = path.join(legacyBaseWaDir, 'creds.json');
        if (fs.existsSync(legacyCreds)) {
          fs.mkdirSync(targetAuthDir, { recursive: true });
          for (const entry of fs.readdirSync(legacyBaseWaDir)) {
            if (entry.startsWith('user_')) continue;
            const src = path.join(legacyBaseWaDir, entry);
            const dest = path.join(targetAuthDir, entry);
            if (fs.statSync(src).isFile()) {
              fs.renameSync(src, dest);
            }
          }
        }
      }
    }

    // Normaliza todas as sessões existentes para o padrão canônico user_{user_id}/chip_{chip_id}
    const allRows = this.db.prepare('SELECT id, user_id, auth_dir FROM wa_sessions').all();
    for (const row of allRows) {
      const expectedDir = `user_${Number(row.user_id)}/chip_${Number(row.id)}`;
      if (row.auth_dir !== expectedDir) {
        const oldPathInLegacy = path.join(legacyBaseWaDir, row.auth_dir || '');
        const oldPathInNew = path.join(waSessionsRoot, row.auth_dir || '');
        const targetPath = path.join(waSessionsRoot, expectedDir);
        try {
          if (row.auth_dir && fs.existsSync(oldPathInNew) && !fs.existsSync(targetPath)) {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.renameSync(oldPathInNew, targetPath);
          } else if (row.auth_dir && fs.existsSync(oldPathInLegacy) && !fs.existsSync(targetPath)) {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.renameSync(oldPathInLegacy, targetPath);
          }
        } catch (_) {}
        this.db.prepare('UPDATE wa_sessions SET auth_dir = ? WHERE id = ?').run(expectedDir, row.id);
      }
    }
  }

  prepareStatements() {
    this.stmtGetLeadByIdentifier = this.db.prepare(
      'SELECT * FROM leads WHERE user_id = ? AND identifier = ?'
    );

    this.stmtGetLeadById = this.db.prepare(
      'SELECT * FROM leads WHERE id = ? AND user_id = ?'
    );

    this.stmtInsertLead = this.db.prepare(`
      INSERT INTO leads (
        user_id, source, identifier, name, company_name, phone, instagram, is_whatsapp_active,
        phone_type, niche, revenue_range, status, ai_summary, crm_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.stmtUpdateLead = this.db.prepare(`
      UPDATE leads SET
        name = COALESCE(?, name),
        company_name = COALESCE(?, company_name),
        phone = COALESCE(?, phone),
        instagram = COALESCE(?, instagram),
        is_whatsapp_active = COALESCE(?, is_whatsapp_active),
        phone_type = COALESCE(?, phone_type),
        niche = COALESCE(?, niche),
        revenue_range = COALESCE(?, revenue_range),
        status = COALESCE(?, status),
        ai_summary = COALESCE(?, ai_summary),
        crm_synced = COALESCE(?, crm_synced),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    this.stmtUpdateLeadStatus = this.db.prepare(`
      UPDATE leads SET
        status = ?,
        ai_summary = COALESCE(?, ai_summary),
        crm_synced = COALESCE(?, crm_synced),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    this.stmtAddMessage = this.db.prepare(`
      INSERT INTO conversation_history (user_id, lead_id, role, content)
      VALUES (?, ?, ?, ?)
    `);

    this.stmtGetHistory = this.db.prepare(`
      SELECT role, content, created_at
      FROM conversation_history
      WHERE lead_id = ? AND user_id = ?
      ORDER BY id ASC
      LIMIT ?
    `);

    this.stmtLogMessage = this.db.prepare(`
      INSERT INTO message_logs (user_id, lead_id, sender_account, message_content)
      VALUES (?, ?, ?, ?)
    `);

    this.stmtCountDailySent = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM message_logs
      WHERE user_id = ?
        AND sender_account = ?
        AND date(sent_at) = date('now', 'localtime')
    `);

    this.stmtIsBlacklisted = this.db.prepare(
      'SELECT id FROM blacklist WHERE user_id = ? AND identifier = ?'
    );

    this.stmtAddToBlacklist = this.db.prepare(`
      INSERT OR IGNORE INTO blacklist (user_id, identifier, reason)
      VALUES (?, ?, ?)
    `);

    this.stmtGetUnsyncedQualifiedLeads = this.db.prepare(`
      SELECT * FROM leads
      WHERE user_id = ? AND status = 'qualified' AND crm_synced = 0
    `);

    this.stmtMarkCrmSynced = this.db.prepare(`
      UPDATE leads SET crm_synced = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?
    `);

    // Contas Instagram por Tenant
    this.stmtGetAllAccounts = this.db.prepare(`
      SELECT * FROM instagram_accounts WHERE user_id = ? ORDER BY id ASC
    `);

    this.stmtGetAccountById = this.db.prepare(`
      SELECT * FROM instagram_accounts WHERE id = ? AND user_id = ?
    `);

    this.stmtGetAccountByUsername = this.db.prepare(`
      SELECT * FROM instagram_accounts WHERE user_id = ? AND username = ?
    `);

    this.stmtInsertAccount = this.db.prepare(`
      INSERT INTO instagram_accounts (user_id, username, password, role, proxy, daily_limit, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.stmtUpdateAccountStatus = this.db.prepare(`
      UPDATE instagram_accounts
      SET status = ?, last_login_at = COALESCE(?, last_login_at)
      WHERE id = ? AND user_id = ?
    `);

    this.stmtDeleteAccount = this.db.prepare(`
      DELETE FROM instagram_accounts WHERE id = ? AND user_id = ?
    `);

    this.stmtCountAccountsByRole = this.db.prepare(`
      SELECT COUNT(*) as count FROM instagram_accounts WHERE user_id = ? AND role = ?
    `);
  }

  // ============================================================================
  // METADADOS INTERNOS & USUÁRIOS (SAAS MULTI-TENANT)
  // ============================================================================
  getOrCreateJwtSecret() {
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16) {
      return process.env.JWT_SECRET.trim();
    }
    const row = this.db.prepare("SELECT value FROM system_meta WHERE key = 'jwt_secret'").get();
    if (row?.value) return row.value;

    const generated = crypto.randomBytes(48).toString('hex');
    this.db.prepare(`
      INSERT INTO system_meta (key, value, updated_at)
      VALUES ('jwt_secret', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(generated);
    return generated;
  }

  getAdminUser() {
    return this.db.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1").get() || null;
  }

  getAdminUserId() {
    const adm = this.getAdminUser();
    return adm ? Number(adm.id) : 1;
  }

  getUserById(id) {
    if (!id) return null;
    return this.db.prepare('SELECT id, email, role, max_chips, active, created_at FROM users WHERE id = ?').get(Number(id)) || null;
  }

  getUserAuthByEmail(email) {
    if (!email) return null;
    return this.db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(String(email).trim()) || null;
  }

  getAllUsers() {
    return this.db.prepare(`
      SELECT
        u.id, u.email, u.role, u.max_chips, u.active, u.created_at,
        (SELECT COUNT(*) FROM wa_sessions w WHERE w.user_id = u.id) as chips_count,
        (SELECT COUNT(*) FROM wa_sessions w WHERE w.user_id = u.id AND w.status = 'CONNECTED') as connected_chips,
        (SELECT COUNT(*) FROM leads l WHERE l.user_id = u.id) as leads_count
      FROM users u
      ORDER BY u.id ASC
    `).all();
  }

  createUser({ email, password, role = 'user', max_chips = 1, active = 1 }) {
    const cleanEmail = String(email || '').toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Informe um e-mail válido.');
    }
    if (!password || String(password).length < 6) {
      throw new Error('A senha deve ter pelo menos 6 caracteres.');
    }

    const existing = this.getUserAuthByEmail(cleanEmail);
    if (existing) {
      throw new Error(`Já existe um usuário cadastrado com o e-mail ${cleanEmail}.`);
    }

    const safeRole = role === 'admin' ? 'admin' : 'user';
    const safeMaxChips = Math.max(1, parseInt(max_chips, 10) || 1);
    const safeActive = active ? 1 : 0;
    const passwordHash = hashPassword(String(password));

    const res = this.db.prepare(`
      INSERT INTO users (email, password_hash, role, max_chips, active)
      VALUES (?, ?, ?, ?, ?)
    `).run(cleanEmail, passwordHash, safeRole, safeMaxChips, safeActive);

    const newUserId = Number(res.lastInsertRowid);

    // Pré-cria o primeiro chip desconectado se max_chips >= 1
    if (safeMaxChips >= 1) {
      this.createWaSession(newUserId, 'Chip Principal');
    }

    return this.getUserById(newUserId);
  }

  updateUserAccess(userId, { active, max_chips } = {}) {
    const existing = this.getUserById(userId);
    if (!existing) return null;

    if (active !== undefined) {
      this.db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, Number(userId));
    }
    if (max_chips !== undefined) {
      const safeChips = Math.max(1, parseInt(max_chips, 10) || 1);
      this.db.prepare('UPDATE users SET max_chips = ? WHERE id = ?').run(safeChips, Number(userId));
    }
    return this.getUserById(userId);
  }

  // ============================================================================
  // SESSÕES WHATSAPP (CHIPS POR TENANT)
  // ============================================================================
  getWaSessionsByUser(userId) {
    if (!userId) return [];
    return this.db.prepare('SELECT * FROM wa_sessions WHERE user_id = ? ORDER BY id ASC').all(Number(userId));
  }

  getActiveWaSessionsByUser(userId) {
    if (!userId) return [];
    return this.db
      .prepare("SELECT * FROM wa_sessions WHERE user_id = ? AND status != 'RESTRITO' ORDER BY id ASC")
      .all(Number(userId));
  }

  getAllWaSessions() {
    return this.db.prepare(`
      SELECT w.*, u.active as user_active
      FROM wa_sessions w
      JOIN users u ON u.id = w.user_id
      ORDER BY w.id ASC
    `).all();
  }

  getWaSessionById(sessionId, userId) {
    if (!sessionId || !userId) return null;
    return this.db.prepare('SELECT * FROM wa_sessions WHERE id = ? AND user_id = ?').get(Number(sessionId), Number(userId)) || null;
  }

  createWaSession(userId, sessionName = null) {
    const user = this.getUserById(userId);
    if (!user) throw new Error('Usuário não encontrado.');

    const current = this.getWaSessionsByUser(userId);
    if (current.length >= Number(user.max_chips)) {
      throw new Error(`Limite máximo de chips atingido (${current.length}/${user.max_chips}). Solicite upgrade ao administrador.`);
    }

    const slotNumber = current.length + 1;
    const finalName = (sessionName && String(sessionName).trim()) || (slotNumber === 1 ? 'Chip Principal' : `Chip ${slotNumber}`);
    const tempAuthDir = `user_${Number(userId)}/chip_pending_${Date.now()}_${slotNumber}`;

    const res = this.db.prepare(`
      INSERT INTO wa_sessions (user_id, session_name, status, auth_dir)
      VALUES (?, ?, 'DISCONNECTED', ?)
    `).run(Number(userId), finalName, tempAuthDir);

    const chipId = Number(res.lastInsertRowid);
    const canonicalAuthDir = `user_${Number(userId)}/chip_${chipId}`;
    this.db.prepare('UPDATE wa_sessions SET auth_dir = ? WHERE id = ? AND user_id = ?').run(canonicalAuthDir, chipId, Number(userId));

    return this.getWaSessionById(chipId, userId);
  }

  updateWaSession(sessionId, userId, { status, phone_number, last_connected_at } = {}) {
    if (!sessionId || !userId) return null;
    const hasPhoneNumber = phone_number !== undefined ? 1 : 0;
    this.db.prepare(`
      UPDATE wa_sessions SET
        status = COALESCE(?, status),
        phone_number = CASE WHEN ? = 1 THEN ? ELSE phone_number END,
        last_connected_at = COALESCE(?, last_connected_at),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      status !== undefined ? status : null,
      hasPhoneNumber,
      hasPhoneNumber ? phone_number : null,
      last_connected_at !== undefined ? last_connected_at : null,
      Number(sessionId),
      Number(userId)
    );
    return this.getWaSessionById(sessionId, userId);
  }

  deleteWaSession(sessionId, userId) {
    if (!sessionId || !userId) return false;
    const res = this.db.prepare('DELETE FROM wa_sessions WHERE id = ? AND user_id = ?').run(Number(sessionId), Number(userId));
    return res.changes > 0;
  }

  // ============================================================================
  // LEADS (ESTRITAMENTE ISOLADOS POR user_id)
  // ============================================================================
  requireUserId(userId) {
    const uid = Number(userId);
    if (!uid || Number.isNaN(uid)) {
      throw new Error('Isolamento Multi-Tenant: userId obrigatório para esta operação.');
    }
    return uid;
  }

  getLeadByIdentifier(identifier, userId) {
    if (!identifier) return null;
    const uid = this.requireUserId(userId);
    return this.stmtGetLeadByIdentifier.get(uid, String(identifier).trim()) || null;
  }

  getLeadById(id, userId) {
    if (!id) return null;
    const uid = this.requireUserId(userId);
    return this.stmtGetLeadById.get(Number(id), uid) || null;
  }

  createOrUpdateLead(leadData, userId) {
    const uid = this.requireUserId(userId || leadData.user_id);
    const identifier = String(leadData.identifier || '').trim();
    if (!identifier) {
      throw new Error('Campo identifier é obrigatório para cadastrar ou atualizar o lead.');
    }

    let existing = this.getLeadByIdentifier(identifier, uid);
    if (!existing && leadData.phone) {
      existing = this.db.prepare('SELECT * FROM leads WHERE user_id = ? AND phone = ? LIMIT 1').get(uid, leadData.phone);
    }
    if (!existing && leadData.instagram) {
      existing = this.db.prepare('SELECT * FROM leads WHERE user_id = ? AND (instagram = ? OR identifier = ?) LIMIT 1').get(uid, leadData.instagram, leadData.instagram);
    }

    let waActiveVal = null;
    if (leadData.is_whatsapp_active !== undefined && leadData.is_whatsapp_active !== null) {
      if (leadData.is_whatsapp_active === 1 || leadData.is_whatsapp_active === '1' || leadData.is_whatsapp_active === true) {
        waActiveVal = 1;
      } else if (leadData.is_whatsapp_active === 0 || leadData.is_whatsapp_active === '0' || leadData.is_whatsapp_active === false || leadData.is_whatsapp_active === 'no_whatsapp' || leadData.is_whatsapp_active === 'invalid') {
        waActiveVal = 0;
      }
    }

    if (existing) {
      this.stmtUpdateLead.run(
        leadData.name !== undefined ? leadData.name : null,
        leadData.company_name !== undefined ? leadData.company_name : null,
        leadData.phone !== undefined ? leadData.phone : null,
        leadData.instagram !== undefined ? leadData.instagram : null,
        waActiveVal !== null ? waActiveVal : null,
        leadData.phone_type !== undefined ? leadData.phone_type : null,
        leadData.niche !== undefined ? leadData.niche : null,
        leadData.revenue_range !== undefined ? leadData.revenue_range : null,
        leadData.status !== undefined ? leadData.status : null,
        leadData.ai_summary !== undefined ? leadData.ai_summary : null,
        leadData.crm_synced !== undefined ? (leadData.crm_synced ? 1 : 0) : null,
        existing.id,
        uid
      );
      return this.getLeadById(existing.id, uid);
    } else {
      const result = this.stmtInsertLead.run(
        uid,
        leadData.source || 'inbound_official',
        identifier,
        leadData.name || null,
        leadData.company_name || null,
        leadData.phone || null,
        leadData.instagram || null,
        waActiveVal,
        leadData.phone_type || null,
        leadData.niche || null,
        leadData.revenue_range || null,
        leadData.status || 'new',
        leadData.ai_summary || null,
        leadData.crm_synced ? 1 : 0
      );
      return this.getLeadById(Number(result.lastInsertRowid), uid);
    }
  }

  updateLead(leadId, fields, userId) {
    const uid = this.requireUserId(userId);
    const existing = this.getLeadById(leadId, uid);
    if (!existing) return null;
    return this.createOrUpdateLead({ ...fields, identifier: existing.identifier }, uid);
  }

  updateLeadStatus(leadId, status, aiSummary = null, crmSynced = null, userId) {
    const uid = this.requireUserId(userId);
    this.stmtUpdateLeadStatus.run(
      status,
      aiSummary,
      crmSynced !== null ? (crmSynced ? 1 : 0) : null,
      Number(leadId),
      uid
    );
    return this.getLeadById(Number(leadId), uid);
  }

  addConversationMessage(leadId, role, content, userId) {
    if (!leadId || !role || !content) {
      throw new Error('Parâmetros leadId, role e content são obrigatórios para registrar mensagem.');
    }
    const uid = this.requireUserId(userId);
    const lead = this.getLeadById(leadId, uid);
    if (!lead) {
      throw new Error(`Lead #${leadId} não pertence ao usuário autenticado.`);
    }
    const result = this.stmtAddMessage.run(uid, Number(leadId), role, String(content));
    return Number(result.lastInsertRowid);
  }

  getConversationHistory(leadId, limit = 15, userId) {
    if (!leadId) return [];
    const uid = this.requireUserId(userId);
    return this.stmtGetHistory.all(Number(leadId), uid, Number(limit));
  }

  logSentMessage(leadId, senderAccount, messageContent, userId) {
    const uid = this.requireUserId(userId);
    const result = this.stmtLogMessage.run(uid, Number(leadId), senderAccount, String(messageContent));
    return Number(result.lastInsertRowid);
  }

  getDailySentCount(senderAccount, userId) {
    const uid = this.requireUserId(userId);
    const row = this.stmtCountDailySent.get(uid, senderAccount);
    return row ? Number(row.count) : 0;
  }

  isBlacklisted(identifier, userId) {
    if (!identifier) return false;
    const uid = this.requireUserId(userId);
    const row = this.stmtIsBlacklisted.get(uid, String(identifier).trim());
    return !!row;
  }

  addToBlacklist(identifier, reason = 'Opt-out manual', userId) {
    if (!identifier) return false;
    const uid = this.requireUserId(userId);
    this.stmtAddToBlacklist.run(uid, String(identifier).trim(), reason);
    return true;
  }

  getUnsyncedQualifiedLeads(userId) {
    const uid = this.requireUserId(userId);
    return this.stmtGetUnsyncedQualifiedLeads.all(uid);
  }

  markLeadCrmSynced(leadId, userId) {
    const uid = this.requireUserId(userId);
    return this.stmtMarkCrmSynced.run(Number(leadId), uid);
  }

  getAllLeads({ source, status, userId } = {}) {
    const uid = this.requireUserId(userId);
    let sql = 'SELECT * FROM leads WHERE user_id = ?';
    const params = [uid];
    if (source && source !== 'all') {
      sql += ' AND source = ?';
      params.push(source);
    }
    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY id DESC';
    return this.db.prepare(sql).all(...params);
  }

  getLeadHistory(leadId, userId) {
    if (!leadId) return [];
    const uid = this.requireUserId(userId);
    return this.db.prepare(
      'SELECT id, role, content, created_at FROM conversation_history WHERE lead_id = ? AND user_id = ? ORDER BY id ASC'
    ).all(Number(leadId), uid);
  }

  getDashboardStats(userId) {
    const uid = this.requireUserId(userId);
    const totalLeads = this.db.prepare('SELECT COUNT(*) as count FROM leads WHERE user_id = ?').get(uid)?.count || 0;
    const qualifiedLeads = this.db.prepare("SELECT COUNT(*) as count FROM leads WHERE user_id = ? AND status = 'qualified'").get(uid)?.count || 0;
    const inQualificationCount = this.db.prepare("SELECT COUNT(*) as count FROM leads WHERE user_id = ? AND status = 'in_qualification'").get(uid)?.count || 0;
    const newCount = this.db.prepare("SELECT COUNT(*) as count FROM leads WHERE user_id = ? AND status = 'new'").get(uid)?.count || 0;
    const landlineCount = this.db.prepare("SELECT COUNT(*) as count FROM leads WHERE user_id = ? AND phone_type = 'landline'").get(uid)?.count || 0;
    const mobileCount = this.db.prepare("SELECT COUNT(*) as count FROM leads WHERE user_id = ? AND phone_type = 'mobile'").get(uid)?.count || 0;
    const sentToday = this.db.prepare("SELECT COUNT(*) as count FROM message_logs WHERE user_id = ? AND date(sent_at) = date('now', 'localtime')").get(uid)?.count || 0;

    const dbScrapers = this.stmtCountAccountsByRole.get(uid, 'scraper')?.count || 0;
    const dbSenders = this.stmtCountAccountsByRole.get(uid, 'sender')?.count || 0;
    const scrapersCount = Number(dbScrapers);
    const sendersCount = Number(dbSenders);

    return {
      totalLeads: Number(totalLeads),
      qualifiedLeads: Number(qualifiedLeads),
      inQualificationCount: Number(inQualificationCount),
      newCount: Number(newCount),
      landlineCount: Number(landlineCount),
      mobileCount: Number(mobileCount),
      sentToday: Number(sentToday),
      scrapersCount,
      sendersCount,
      totalAccounts: scrapersCount + sendersCount
    };
  }

  getAllInstagramAccounts(userId) {
    const uid = this.requireUserId(userId);
    return this.stmtGetAllAccounts.all(uid);
  }

  getInstagramAccountById(id, userId) {
    if (!id) return null;
    const uid = this.requireUserId(userId);
    return this.stmtGetAccountById.get(Number(id), uid) || null;
  }

  getInstagramAccountByUsername(username, userId) {
    if (!username) return null;
    const uid = this.requireUserId(userId);
    const cleanUser = String(username).replace('@', '').trim();
    return this.stmtGetAccountByUsername.get(uid, cleanUser) || null;
  }

  createInstagramAccount({ username, password, role = 'scraper', proxy = null, daily_limit = 25, userId }) {
    const uid = this.requireUserId(userId);
    const cleanUser = String(username).replace('@', '').trim();
    if (!cleanUser) {
      throw new Error('Nome de usuário é obrigatório.');
    }

    const existing = this.getInstagramAccountByUsername(cleanUser, uid);
    if (existing) {
      throw new Error(`A conta @${cleanUser} já está cadastrada.`);
    }

    const result = this.stmtInsertAccount.run(
      uid,
      cleanUser,
      password ? String(password) : '',
      role === 'sender' ? 'sender' : 'scraper',
      proxy ? String(proxy).trim() : null,
      Number(daily_limit) || 25,
      'disconnected'
    );

    return this.getInstagramAccountById(Number(result.lastInsertRowid), uid);
  }

  deleteLead(id, userId) {
    if (!id) return false;
    const uid = this.requireUserId(userId);
    const leadId = Number(id);
    const existing = this.getLeadById(leadId, uid);
    if (!existing) return false;

    this.db.prepare('DELETE FROM conversation_history WHERE lead_id = ? AND user_id = ?').run(leadId, uid);
    this.db.prepare('DELETE FROM message_logs WHERE lead_id = ? AND user_id = ?').run(leadId, uid);
    this.db.prepare('DELETE FROM leads WHERE id = ? AND user_id = ?').run(leadId, uid);
    return true;
  }

  clearAllLeads(userId) {
    const uid = this.requireUserId(userId);
    this.db.prepare('DELETE FROM conversation_history WHERE user_id = ?').run(uid);
    this.db.prepare('DELETE FROM message_logs WHERE user_id = ?').run(uid);
    this.db.prepare('DELETE FROM leads WHERE user_id = ?').run(uid);
    return true;
  }

  updateInstagramAccountStatus(id, status, lastLoginAt = null, userId) {
    const uid = this.requireUserId(userId);
    this.stmtUpdateAccountStatus.run(
      status,
      lastLoginAt || new Date().toISOString().replace('T', ' ').slice(0, 19),
      Number(id),
      uid
    );
    return this.getInstagramAccountById(Number(id), uid);
  }

  deleteInstagramAccount(id, userId) {
    if (!id) return false;
    const uid = this.requireUserId(userId);
    const res = this.stmtDeleteAccount.run(Number(id), uid);
    return res.changes > 0;
  }

  // ============================================================================
  // CONFIGURAÇÕES DINÂMICAS POR TENANT (PERSISTIDAS NO SQLITE)
  // ============================================================================
  getSetting(key, defaultValue = null, userId) {
    try {
      const uid = this.requireUserId(userId);
      const row = this.db.prepare('SELECT value FROM app_settings WHERE user_id = ? AND key = ?').get(uid, String(key));
      return (row && row.value !== null && row.value !== undefined) ? row.value : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  setSetting(key, value, userId) {
    try {
      const uid = this.requireUserId(userId);
      const valStr = value === null || value === undefined ? '' : String(value);
      this.db.prepare(`
        INSERT INTO app_settings (user_id, key, value, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `).run(uid, String(key), valStr);
      return true;
    } catch (err) {
      console.error(`Erro ao salvar setting [${key}] no SQLite:`, err.message);
      return false;
    }
  }

  getAllSettings(userId) {
    try {
      const uid = this.requireUserId(userId);
      const rows = this.db.prepare('SELECT key, value FROM app_settings WHERE user_id = ?').all(uid);
      const result = {};
      for (const r of rows) {
        result[r.key] = r.value;
      }
      return result;
    } catch {
      return {};
    }
  }

  close() {
    this.db.close();
  }
}

export const db = new AppDatabase();
export default db;
