import whatsappClient from '../../integrations/whatsapp-client.js';

class WhatsAppValidationEngine {
  /**
   * Valida em lote se números telefônicos (fixos ou celulares) possuem conta ativa no WhatsApp
   * @param {Array<string>} phoneNumbers - Lista de telefones no formato E.164 (ex: '551130001234')
   * @param {number} batchSize - Tamanho de cada bloco de consulta à API
   */
  async validateNumbers(phoneNumbers = [], batchSize = 25) {
    const resultsMap = new Map();

    const cleanList = phoneNumbers
      .map(p => String(p).replace(/\D/g, ''))
      .filter(p => p.length >= 10);

    if (cleanList.length === 0) {
      return resultsMap;
    }

    console.log(`🔍 [WhatsAppChecker] Iniciando checagem de ${cleanList.length} números via Evolution API...`);

    for (let i = 0; i < cleanList.length; i += batchSize) {
      const batch = cleanList.slice(i, i + batchSize);

      try {
        const batchResults = await whatsappClient.checkWhatsappNumbers(batch);

        for (const item of batchResults) {
          resultsMap.set(item.phone, {
            exists: Boolean(item.exists),
            jid: item.jid || null,
            error: item.error || null
          });
        }
      } catch (err) {
        // Fallback Resiliente: se a Evolution API estiver offline ou inacessível,
        // não interrompe o fluxo do minerador. Marca exists = false e segue em frente.
        console.warn(`⚠️ [WhatsAppChecker] Aviso: Instância WhatsApp inacessível para o lote (${err.message}). Prosseguindo com status padrão (is_whatsapp_active = 0).`);

        for (const phone of batch) {
          resultsMap.set(phone, {
            exists: false,
            jid: null,
            error: 'Evolution API offline ou não configurada'
          });
        }
      }
    }

    return resultsMap;
  }
}

export const waChecker = new WhatsAppValidationEngine();
export default waChecker;
