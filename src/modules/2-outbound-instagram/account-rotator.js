import fs from 'fs';
import path from 'path';
import { settings } from '../../../config/settings.js';
import db from '../../database/db.js';

class AccountRotator {
  constructor() {
    this.currentScraperIndex = 0;
    this.currentSenderIndex = 0;
  }

  /**
   * Retorna a lista atualizada de contas Scrapers lendo diretamente do SQLite
   */
  getScraperAccounts() {
    try {
      const dbAccounts = db.getAllInstagramAccounts().filter(a => a.role === 'scraper' && a.status !== 'challenged');
      return dbAccounts.map(a => ({
        id: a.id,
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

  /**
   * Retorna a lista atualizada de contas Senders lendo diretamente do SQLite
   */
  getSenderAccounts() {
    try {
      const dbAccounts = db.getAllInstagramAccounts().filter(a => a.role === 'sender' && a.status !== 'challenged');
      return dbAccounts.map(a => ({
        id: a.id,
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

  /**
   * Retorna o caminho do arquivo de sessão storageState da conta
   * Suporta {username}.json ou {username}_storage.json
   */
  getSessionFilePath(username) {
    const cleanUser = String(username).replace(/[^a-zA-Z0-9._-]/g, '_');
    const pathStandard = path.join(settings.paths.sessionsDir, `${cleanUser}.json`);
    const pathLegacy = path.join(settings.paths.sessionsDir, `${cleanUser}_storage.json`);

    if (fs.existsSync(pathStandard)) return pathStandard;
    if (fs.existsSync(pathLegacy)) return pathLegacy;
    return pathStandard;
  }

  /**
   * Verifica se a sessão em JSON existe no disco
   */
  hasSavedSession(username) {
    const sessionFile = this.getSessionFilePath(username);
    return fs.existsSync(sessionFile);
  }

  /**
   * Retorna a próxima conta Scraper ativa (rotação circular simples)
   */
  getNextScraperAccount() {
    const activeScrapers = this.getScraperAccounts();

    if (activeScrapers.length === 0) {
      throw new Error('Nenhuma conta Scraper cadastrada ou ativa no sistema.');
    }

    const account = activeScrapers[this.currentScraperIndex % activeScrapers.length];
    this.currentScraperIndex++;

    return {
      ...account,
      sessionFile: this.getSessionFilePath(account.username)
    };
  }

  /**
   * Retorna a próxima conta Sender ativa que ainda não atingiu a cota diária
   */
  getNextAvailableSenderAccount() {
    const activeSenders = this.getSenderAccounts();

    if (activeSenders.length === 0) {
      throw new Error('Nenhuma conta Sender cadastrada ou ativa no sistema.');
    }

    const maxAttempts = activeSenders.length;
    let checked = 0;

    while (checked < maxAttempts) {
      const candidate = activeSenders[this.currentSenderIndex % activeSenders.length];
      this.currentSenderIndex++;
      checked++;

      // Consulta no SQLite quantas DMs esta conta já enviou hoje
      const sentToday = db.getDailySentCount(candidate.username);
      const limit = candidate.dailyLimit || settings.outbound.maxDailyDmsPerSender;

      if (sentToday < limit) {
        return {
          ...candidate,
          sentToday,
          dailyLimit: limit,
          remainingDms: limit - sentToday,
          sessionFile: this.getSessionFilePath(candidate.username)
        };
      } else {
        console.warn(`⚠️ [AccountRotator] Conta @${candidate.username} atingiu a cota diária (${sentToday}/${limit} DMs). Rotacionando...`);
      }
    }

    throw new Error('Todas as contas Sender cadastradas atingiram o limite diário de disparos hoje.');
  }

  /**
   * Marca uma conta como temporariamente inativa caso receba desafio/bloqueio
   */
  markAccountChallenged(accountType, username, reason = 'Challenge detectado') {
    console.error(`🚨 [AccountRotator] Conta ${accountType} @${username} sinalizada com bloqueio/challenge: ${reason}`);
    try {
      const dbAcc = db.getInstagramAccountByUsername(username);
      if (dbAcc) {
        db.updateInstagramAccountStatus(dbAcc.id, 'challenged');
      }
    } catch (err) {
      console.warn(`[AccountRotator] Não foi possível atualizar status no SQLite: ${err.message}`);
    }
  }
}

export const accountRotator = new AccountRotator();
export default accountRotator;
