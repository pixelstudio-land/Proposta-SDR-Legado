import fs from 'fs';
import path from 'path';
import { settings } from '../../../config/settings.js';
import db from '../../database/db.js';

class AccountRotator {
  constructor() {
    this.scraperIndexByUser = new Map();
    this.senderIndexByUser = new Map();
  }

  getScraperAccounts(userId) {
    const uid = Number(userId);
    try {
      const dbAccounts = db
        .getAllInstagramAccounts(uid)
        .filter(a => a.role === 'scraper' && a.status !== 'challenged' && a.status !== 'needs_auth');
      return dbAccounts.map(a => ({
        id: a.id,
        userId: a.user_id,
        username: a.username,
        password: a.password,
        proxy: a.proxy,
        dailyLimit: a.daily_limit,
        status: a.status
      }));
    } catch {
      return [];
    }
  }

  getSenderAccounts(userId) {
    const uid = Number(userId);
    try {
      const dbAccounts = db
        .getAllInstagramAccounts(uid)
        .filter(a => a.role === 'sender' && a.status !== 'challenged' && a.status !== 'needs_auth');
      return dbAccounts.map(a => ({
        id: a.id,
        userId: a.user_id,
        username: a.username,
        password: a.password,
        proxy: a.proxy,
        dailyLimit: a.daily_limit,
        status: a.status
      }));
    } catch {
      return [];
    }
  }

  getSessionFilePath(username, userId) {
    const uid = Number(userId);
    const cleanUser = String(username).replace(/[^a-zA-Z0-9._-]/g, '_');
    const userDir = path.join(settings.paths.sessionsDir, `user_${uid}`);
    const pathStandard = path.join(userDir, `${cleanUser}.json`);
    const pathLegacyUser = path.join(userDir, `${cleanUser}_storage.json`);

    if (fs.existsSync(pathStandard)) return pathStandard;
    if (fs.existsSync(pathLegacyUser)) return pathLegacyUser;

    // Fallback legado apenas para o usuário Admin inicial
    if (uid === db.getAdminUserId()) {
      const legacyRootStd = path.join(settings.paths.sessionsDir, `${cleanUser}.json`);
      const legacyRootOld = path.join(settings.paths.sessionsDir, `${cleanUser}_storage.json`);
      if (fs.existsSync(legacyRootStd)) return legacyRootStd;
      if (fs.existsSync(legacyRootOld)) return legacyRootOld;
    }

    return pathStandard;
  }

  hasSavedSession(username, userId) {
    const sessionFile = this.getSessionFilePath(username, userId);
    return fs.existsSync(sessionFile);
  }

  getNextScraperAccount(userId) {
    const uid = Number(userId);
    const activeScrapers = this.getScraperAccounts(uid);

    if (activeScrapers.length === 0) {
      throw new Error('Nenhuma conta Scraper cadastrada ou ativa para este usuário.');
    }

    let idx = this.scraperIndexByUser.get(uid) || 0;
    const maxAttempts = activeScrapers.length;
    let checked = 0;

    while (checked < maxAttempts) {
      const candidate = activeScrapers[idx % activeScrapers.length];
      idx++;
      this.scraperIndexByUser.set(uid, idx);
      checked++;

      const sessionFile = this.getSessionFilePath(candidate.username, uid);
      if (fs.existsSync(sessionFile)) {
        return { ...candidate, sessionFile };
      } else {
        try {
          db.updateInstagramAccountStatus(candidate.id, 'needs_auth', null, uid);
        } catch (_) {}
      }
    }

    throw new Error('Nenhuma conta Scraper possui sessão autenticada válida (todas requerem cookie sessionid).');
  }

  getNextAvailableSenderAccount(userId) {
    const uid = Number(userId);
    const activeSenders = this.getSenderAccounts(uid);

    if (activeSenders.length === 0) {
      throw new Error('Nenhuma conta Sender cadastrada ou ativa para este usuário.');
    }

    let idx = this.senderIndexByUser.get(uid) || 0;
    const maxAttempts = activeSenders.length;
    let checked = 0;

    while (checked < maxAttempts) {
      const candidate = activeSenders[idx % activeSenders.length];
      idx++;
      this.senderIndexByUser.set(uid, idx);
      checked++;

      const sessionFile = this.getSessionFilePath(candidate.username, uid);
      if (!fs.existsSync(sessionFile)) {
        try {
          db.updateInstagramAccountStatus(candidate.id, 'needs_auth', null, uid);
        } catch (_) {}
        continue;
      }

      const sentToday = db.getDailySentCount(candidate.username, uid);
      const limit = candidate.dailyLimit || settings.outbound.maxDailyDmsPerSender;

      if (sentToday < limit) {
        return {
          ...candidate,
          sentToday,
          dailyLimit: limit,
          remainingDms: limit - sentToday,
          sessionFile
        };
      }
    }

    throw new Error('Todas as contas Sender cadastradas atingiram o limite diário de disparos hoje ou requerem autenticação.');
  }

  markAccountChallenged(accountType, username, reason = 'Challenge detectado', userId = null) {
    const uid = Number(userId) || db.getAdminUserId();
    console.error(`🚨 [AccountRotator] Conta ${accountType} @${username} (User #${uid}) sinalizada: ${reason}`);
    try {
      const dbAcc = db.getInstagramAccountByUsername(username, uid);
      if (dbAcc) {
        db.updateInstagramAccountStatus(dbAcc.id, 'challenged', null, uid);
      }
    } catch (err) {
      console.warn(`[AccountRotator] Erro ao atualizar status no SQLite: ${err.message}`);
    }
  }
}

export const accountRotator = new AccountRotator();
export default accountRotator;
