import axios from 'axios';
import { settings } from '../../config/settings.js';

class CrmIntegrationClient {
  constructor() {
    this.webhookUrl = settings.crm.webhookUrl;
    this.bearerToken = settings.crm.bearerToken;
  }

  /**
   * Envia o lead qualificado em tempo real para o CRM configurado via Webhook HTTP POST
   */
  async sendLeadToCrm(leadData) {
    if (!this.webhookUrl) {
      return {
        success: false,
        error: 'CRM_WEBHOOK_URL não configurada no .env'
      };
    }

    const payload = {
      event: 'lead_qualified',
      source: leadData.source || 'inbound_official',
      lead_id: leadData.id,
      identifier: leadData.identifier,
      name: leadData.name || 'Não informado',
      company_name: leadData.company_name || 'Não informada',
      phone: leadData.phone || null,
      phone_type: leadData.phone_type || null,
      is_whatsapp_active: Boolean(leadData.is_whatsapp_active),
      niche: leadData.niche || 'Geral',
      revenue_range: leadData.revenue_range || 'Não informado',
      ai_summary: leadData.ai_summary || '',
      created_at: leadData.created_at || new Date().toISOString()
    };

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Legado-SDR-Engine/1.0'
    };

    if (this.bearerToken) {
      headers['Authorization'] = `Bearer ${this.bearerToken}`;
    }

    try {
      const response = await axios.post(this.webhookUrl, payload, {
        headers,
        timeout: 8000
      });

      return {
        success: true,
        statusCode: response.status,
        data: response.data
      };
    } catch (error) {
      const errorMessage = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;

      return {
        success: false,
        statusCode: error.response?.status || 500,
        error: `Erro ao enviar lead para o CRM: ${errorMessage}`
      };
    }
  }
}

export const crmClient = new CrmIntegrationClient();
export default crmClient;
