import fs from 'fs';
import path from 'path';
import { settings } from '../../../config/settings.js';
import db from '../../database/db.js';

class AccountRotator {
  constructor() {
    this.scraperAccounts = [...settings.outbound.scraperAccounts];
    this.senderAccounts = [...settings.outbound.senderAccounts];
    this.currentScraperIndex = 0;
    this.currentSenderIndex = 0;
  }

  /**
   * Retorna o caminho do arquivo de sessão storageState da conta
   */
  getSessionFilePath(username) {
    const cleanUser = String(username).replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(settings.paths.sessionsDir, `${cleanUser}_storage.json`);
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
    const activeScrapers = this.scraperAccounts.filter(acc => acc.active !== false);

    if (activeScrapers.length === 0) {
      throw new Error('Nenhuma conta do pool SCRAPER_ACCOUNTS está ativa ou configurada.');
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
    const activeSenders = this.senderAccounts.filter(acc => acc.active !== false);

    if (activeSenders.length === 0) {
      throw new Error('Nenhuma conta do pool SENDER_ACCOUNTS está ativa ou configurada.');
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

    throw new Error('Todas as contas do pool SENDER_ACCOUNTS atingiram o limite diário de disparos hoje.');
  }

  /**
   * Marca uma conta como temporariamente inativa caso receba desafio/bloqueio
   */
  markAccountChallenged(accountType, username, reason = 'Challenge detectado') {
    console.error(`🚨 [AccountRotator] Conta ${accountType} @${username} sinalizada com bloqueio/challenge: ${reason}`);

    if (accountType === 'scraper') {
      const acc = this.scraperAccounts.find(a => a.username === username);
      if (acc) acc.active = false;
    } else if (accountType === 'sender') {
      const acc = this.senderAccounts.find(a => a.username === username);
      if (acc) acc.active = false;
    }
  }
}

export const accountRotator = new AccountRotator();
export default accountRotator;
