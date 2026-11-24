import db from '../../database/db.js';
import { parser } from '../../ai/parser.js';

class LeadQualificationEngine {
  evaluateAndSaveLead(leadId, extractedData = {}, newStatus = 'in_qualification', userId = null) {
    if (!leadId) {
      throw new Error('leadId obrigatório para salvar qualificação.');
    }
    const uid = userId || db.getAdminUserId();
    const currentLead = db.getLeadById(leadId, uid);
    if (!currentLead) {
      throw new Error(`Lead #${leadId} não encontrado no banco para este usuário.`);
    }

    const finalStatus = currentLead.status === 'qualified' && newStatus !== 'qualified'
      ? 'qualified'
      : newStatus;

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

    return db.createOrUpdateLead(updatePayload, uid);
  }

  isLeadQualified(lead) {
    return lead && lead.status === 'qualified';
  }
}

export const qualification = new LeadQualificationEngine();
export default qualification;
