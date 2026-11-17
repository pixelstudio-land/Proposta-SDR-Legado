import whatsappClient, {
  checkWhatsappNumbers,
  checkNumberOnWhatsApp,
  isNativeConnected,
  normalizePhoneForWhatsApp
} from './whatsapp-client.js';

export class WhatsAppValidationEngine {
  /**
   * Valida em lote se números telefônicos (fixos de 8 dígitos ou celulares de 9 dígitos) possuem conta ativa no WhatsApp
   * @param {Array<string>} phoneNumbers - Lista de telefones no formato E.164 ou formato bruto
   * @param {number} batchSize - Tamanho de cada bloco de consulta
   */
  async validateNumbers(phoneNumbers = [], batchSize = 10) {
    const resultsMap = new Map();

    // Filtra e limpa a lista.
    // REGRA CRÍTICA: NÃO descarta fixos comerciais de 8 dígitos locais (ou 10 com DDD / 12 com 55).
    // Qualquer número com 8 ou mais dígitos é preservado para consulta real no Baileys.
    const cleanList = phoneNumbers
      .map(p => String(p).replace(/\D/g, ''))
      .filter(p => p.length >= 8);

    if (cleanList.length === 0) {
      return resultsMap;
    }

    console.log(`🔍 [WhatsAppChecker] Validando ${cleanList.length} números via Baileys Nativo (preservando fixos de 8 dígitos e celulares de 9 dígitos)...`);

    for (let i = 0; i < cleanList.length; i += batchSize) {
      const batch = cleanList.slice(i, i + batchSize);

      try {
        const batchResults = await checkWhatsappNumbers(batch);

        for (const item of batchResults) {
          resultsMap.set(item.phone, {
            exists: Boolean(item.exists),
            jid: item.jid || null,
            error: item.error || null,
            isOffline: Boolean(item.isOffline)
          });
        }
      } catch (err) {
        console.warn(`⚠️ [WhatsAppChecker] Aviso: Erro ao validar lote via Baileys (${err.message}). Prosseguindo com status padrão.`);
        for (const phone of batch) {
          resultsMap.set(phone, {
            exists: false,
            jid: null,
            error: err.message,
            isOffline: true
          });
        }
      }

      // Pequena pausa entre lotes para manter cadência saudável de requisições
      if (i + batchSize < cleanList.length) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    return resultsMap;
  }

  /**
   * Validação de um número individual (fixo ou móvel)
   */
  async validateSingle(phone) {
    return checkNumberOnWhatsApp(phone);
  }
}

export const waChecker = new WhatsAppValidationEngine();
export default waChecker;
