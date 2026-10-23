import db from '../../database/db.js';
import { parser } from '../../ai/parser.js';

class LeadQualificationEngine {
  /**
   * Avalia os dados extraídos pelo modelo de IA e consolida os campos no banco de dados
   */
  evaluateAndSaveLead(leadId, extractedData = {}, newStatus = 'in_qualification') {
    if (!leadId) {
      throw new Error('leadId obrigatório para salvar qualificação.');
    }

    const currentLead = db.getLeadById(leadId);
    if (!currentLead) {
      throw new Error(`Lead #${leadId} não encontrado no banco.`);
    }

    // Se o lead já havia sido qualificado previamente, preserva o status para não regredir
    const finalStatus = currentLead.status === 'qualified' && newStatus !== 'qualified'
      ? 'qualified'
      : newStatus;

    // Higieniza telefone se fornecido no turno
    let formattedPhone = currentLead.phone;
    let phoneType = currentLead.phone_type;
    let isWhatsappActive = currentLead.is_whatsapp_active;

    if (extractedData.phone) {
      const sanitized = parser.cleanAndFormatPhone(extractedData.phone);
      if (sanitized.isValid) {
        formattedPhone = sanitized.phone;
        phoneType = sanitized.type;
      }
    }

    const updatePayload = {
      identifier: currentLead.identifier,
      name: extractedData.name || currentLead.name,
      company_name: extractedData.company_name || currentLead.company_name,
      phone: formattedPhone,
      phone_type: phoneType,
      is_whatsapp_active: isWhatsappActive,
      niche: extractedData.niche || currentLead.niche,
      revenue_range: extractedData.revenue_range || currentLead.revenue_range,
      status: finalStatus,
      ai_summary: extractedData.ai_summary || currentLead.ai_summary
    };

    return db.createOrUpdateLead(updatePayload);
  }

  isLeadQualified(lead) {
    return lead && lead.status === 'qualified';
  }
}

export const qualification = new LeadQualificationEngine();
export default qualification;
