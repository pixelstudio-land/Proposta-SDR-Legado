import db from '../../database/db.js';
import whatsappClient from '../../integrations/whatsapp-client.js';
import crmClient from '../../integrations/crm-client.js';

class LeadTransbordoEngine {
  /**
   * Executa o transbordo duplo do lead qualificado:
   * 1. Alerta executivo instantâneo no WhatsApp do SDR / Leo.
   * 2. Injeção direta no CRM da agência via Webhook HTTP.
   */
  async executeTransbordo(lead) {
    if (!lead || lead.status !== 'qualified') {
      return {
        transbordoExecuted: false,
        reason: 'Lead não possui status qualificado para transbordo.'
      };
    }

    const results = {
      leadId: lead.id,
      transbordoExecuted: true,
      whatsappAlert: null,
      crmInjection: null
    };

    // 1. Notificação no WhatsApp do SDR
    try {
      const waResponse = await whatsappClient.sendSdrAlert(lead);
      results.whatsappAlert = waResponse;
    } catch (waErr) {
      results.whatsappAlert = { success: false, error: waErr.message };
    }

    // 2. Injeção no CRM (apenas se ainda não estiver sincronizado)
    if (!lead.crm_synced) {
      try {
        const crmResponse = await crmClient.sendLeadToCrm(lead);
        results.crmInjection = crmResponse;

        if (crmResponse.success) {
          db.markLeadCrmSynced(lead.id);
        }
      } catch (crmErr) {
        results.crmInjection = { success: false, error: crmErr.message };
      }
    } else {
      results.crmInjection = { success: true, message: 'Lead já sincronizado anteriormente no CRM.' };
    }

    return results;
  }
}

export const transbordo = new LeadTransbordoEngine();
export default transbordo;
