import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { settings } from '../../config/settings.js';

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

  initializeSchema() {
    if (fs.existsSync(settings.database.schemaPath)) {
      const schemaSql = fs.readFileSync(settings.database.schemaPath, 'utf8');
      this.db.exec(schemaSql);
    }
  }

  prepareStatements() {
    this.stmtGetLeadByIdentifier = this.db.prepare(
      'SELECT * FROM leads WHERE identifier = ?'
    );

    this.stmtGetLeadById = this.db.prepare(
      'SELECT * FROM leads WHERE id = ?'
    );

    this.stmtInsertLead = this.db.prepare(`
      INSERT INTO leads (
        source, identifier, name, company_name, phone, is_whatsapp_active, 
        phone_type, niche, revenue_range, status, ai_summary, crm_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.stmtUpdateLead = this.db.prepare(`
      UPDATE leads SET
        name = COALESCE(?, name),
        company_name = COALESCE(?, company_name),
        phone = COALESCE(?, phone),
        is_whatsapp_active = COALESCE(?, is_whatsapp_active),
        phone_type = COALESCE(?, phone_type),
        niche = COALESCE(?, niche),
        revenue_range = COALESCE(?, revenue_range),
        status = COALESCE(?, status),
        ai_summary = COALESCE(?, ai_summary),
        crm_synced = COALESCE(?, crm_synced),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    this.stmtUpdateLeadStatus = this.db.prepare(`
      UPDATE leads SET 
        status = ?, 
        ai_summary = COALESCE(?, ai_summary),
        crm_synced = COALESCE(?, crm_synced),
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);

    this.stmtAddMessage = this.db.prepare(`
      INSERT INTO conversation_history (lead_id, role, content)
      VALUES (?, ?, ?)
    `);

    this.stmtGetHistory = this.db.prepare(`
      SELECT role, content, created_at 
      FROM conversation_history 
      WHERE lead_id = ? 
      ORDER BY id ASC 
      LIMIT ?
    `);

    this.stmtLogMessage = this.db.prepare(`
      INSERT INTO message_logs (lead_id, sender_account, message_content)
      VALUES (?, ?, ?)
    `);

    this.stmtCountDailySent = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM message_logs 
      WHERE sender_account = ? 
        AND date(sent_at) = date('now', 'localtime')
    `);

    this.stmtIsBlacklisted = this.db.prepare(
      'SELECT id FROM blacklist WHERE identifier = ?'
    );

    this.stmtAddToBlacklist = this.db.prepare(`
      INSERT OR IGNORE INTO blacklist (identifier, reason)
      VALUES (?, ?)
    `);

    this.stmtGetUnsyncedQualifiedLeads = this.db.prepare(`
      SELECT * FROM leads 
      WHERE status = 'qualified' AND crm_synced = 0
    `);

    this.stmtMarkCrmSynced = this.db.prepare(`
      UPDATE leads SET crm_synced = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
  }

  getLeadByIdentifier(identifier) {
    if (!identifier) return null;
    return this.stmtGetLeadByIdentifier.get(String(identifier).trim()) || null;
  }

  getLeadById(id) {
    if (!id) return null;
    return this.stmtGetLeadById.get(Number(id)) || null;
  }

  createOrUpdateLead(leadData) {
    const identifier = String(leadData.identifier || '').trim();
    if (!identifier) {
      throw new Error('Campo identifier é obrigatório para cadastrar ou atualizar o lead.');
    }

    const existing = this.getLeadByIdentifier(identifier);

    if (existing) {
      this.stmtUpdateLead.run(
        leadData.name !== undefined ? leadData.name : null,
        leadData.company_name !== undefined ? leadData.company_name : null,
        leadData.phone !== undefined ? leadData.phone : null,
        leadData.is_whatsapp_active !== undefined ? (leadData.is_whatsapp_active ? 1 : 0) : null,
        leadData.phone_type !== undefined ? leadData.phone_type : null,
        leadData.niche !== undefined ? leadData.niche : null,
        leadData.revenue_range !== undefined ? leadData.revenue_range : null,
        leadData.status !== undefined ? leadData.status : null,
        leadData.ai_summary !== undefined ? leadData.ai_summary : null,
        leadData.crm_synced !== undefined ? (leadData.crm_synced ? 1 : 0) : null,
        existing.id
      );
      return this.getLeadById(existing.id);
    } else {
      const result = this.stmtInsertLead.run(
        leadData.source || 'inbound_official',
        identifier,
        leadData.name || null,
        leadData.company_name || null,
        leadData.phone || null,
        leadData.is_whatsapp_active ? 1 : 0,
        leadData.phone_type || null,
        leadData.niche || null,
        leadData.revenue_range || null,
        leadData.status || 'new',
        leadData.ai_summary || null,
        leadData.crm_synced ? 1 : 0
      );
      return this.getLeadById(Number(result.lastInsertRowid));
    }
  }

  updateLeadStatus(leadId, status, aiSummary = null, crmSynced = null) {
    this.stmtUpdateLeadStatus.run(
      status,
      aiSummary,
      crmSynced !== null ? (crmSynced ? 1 : 0) : null,
      Number(leadId)
    );
    return this.getLeadById(Number(leadId));
  }

  addConversationMessage(leadId, role, content) {
    if (!leadId || !role || !content) {
      throw new Error('Parâmetros leadId, role e content são obrigatórios para registrar mensagem.');
    }
    const result = this.stmtAddMessage.run(Number(leadId), role, String(content));
    return Number(result.lastInsertRowid);
  }

  getConversationHistory(leadId, limit = 15) {
    if (!leadId) return [];
    return this.stmtGetHistory.all(Number(leadId), Number(limit));
  }

  logSentMessage(leadId, senderAccount, messageContent) {
    const result = this.stmtLogMessage.run(Number(leadId), senderAccount, String(messageContent));
    return Number(result.lastInsertRowid);
  }

  getDailySentCount(senderAccount) {
    const row = this.stmtCountDailySent.get(senderAccount);
    return row ? Number(row.count) : 0;
  }

  isBlacklisted(identifier) {
    if (!identifier) return false;
    const row = this.stmtIsBlacklisted.get(String(identifier).trim());
    return !!row;
  }

  addToBlacklist(identifier, reason = 'Opt-out manual') {
    if (!identifier) return false;
    this.stmtAddToBlacklist.run(String(identifier).trim(), reason);
    return true;
  }

  getUnsyncedQualifiedLeads() {
    return this.stmtGetUnsyncedQualifiedLeads.all();
  }

  markLeadCrmSynced(leadId) {
    return this.stmtMarkCrmSynced.run(Number(leadId));
  }

  getAllLeads({ source, status } = {}) {
    let sql = 'SELECT * FROM leads WHERE 1=1';
    const params = [];
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

  getLeadHistory(leadId) {
    if (!leadId) return [];
    return this.db.prepare(
      'SELECT id, role, content, created_at FROM conversation_history WHERE lead_id = ? ORDER BY id ASC'
    ).all(Number(leadId));
  }

  getDashboardStats() {
    const totalLeads = this.db.prepare('SELECT COUNT(*) as count FROM leads').get()?.count || 0;
    const qualifiedLeads = this.db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'qualified'").get()?.count || 0;
    const inQualificationCount = this.db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'in_qualification'").get()?.count || 0;
    const newCount = this.db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'new'").get()?.count || 0;
    const landlineCount = this.db.prepare("SELECT COUNT(*) as count FROM leads WHERE phone_type = 'landline'").get()?.count || 0;
    const mobileCount = this.db.prepare("SELECT COUNT(*) as count FROM leads WHERE phone_type = 'mobile'").get()?.count || 0;
    const sentToday = this.db.prepare("SELECT COUNT(*) as count FROM message_logs WHERE date(sent_at) = date('now', 'localtime')").get()?.count || 0;

    const scrapersCount = settings.accounts?.scrapers?.length || 0;
    const sendersCount = settings.accounts?.senders?.length || 0;

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

  close() {
    this.db.close();
  }
}

export const db = new AppDatabase();
export default db;
