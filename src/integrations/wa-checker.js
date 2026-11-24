import {
  checkWhatsappNumbersForUser,
  checkNumberOnWhatsAppForUser
} from './whatsapp-client.js';

export class WhatsAppValidationEngine {
  /**
   * Valida em lote se números telefônicos possuem conta ativa no WhatsApp usando estritamente o chip do tenant
   */
  async validateNumbers(phoneNumbers = [], batchSize = 10, userId) {
    if (!userId) {
      throw new Error('userId obrigatório para validar números no WhatsApp.');
    }

    const resultsMap = new Map();
    const cleanList = phoneNumbers
      .map(p => String(p).replace(/\D/g, ''))
      .filter(p => p.length >= 8);

    if (cleanList.length === 0) {
      return resultsMap;
    }

    console.log(`🔍 [WhatsAppChecker] (User #${userId}) Validando ${cleanList.length} números via Baileys Nativo...`);

    for (let i = 0; i < cleanList.length; i += batchSize) {
      const batch = cleanList.slice(i, i + batchSize);

      try {
        const batchResults = await checkWhatsappNumbersForUser(userId, batch);

        for (const item of batchResults) {
          resultsMap.set(item.phone, {
            exists: Boolean(item.exists),
            jid: item.jid || null,
            error: item.error || null,
            isOffline: Boolean(item.isOffline)
          });
        }
      } catch (err) {
        console.warn(`⚠️ [WhatsAppChecker] (User #${userId}) Erro ao validar lote: ${err.message}`);
        for (const phone of batch) {
          resultsMap.set(phone, {
            exists: false,
            jid: null,
            error: err.message,
            isOffline: true
          });
        }
      }

      if (i + batchSize < cleanList.length) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    return resultsMap;
  }

  async validateSingle(phone, userId) {
    return checkNumberOnWhatsAppForUser(userId, phone);
  }
}

export const waChecker = new WhatsAppValidationEngine();
export default waChecker;
