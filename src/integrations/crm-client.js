import axios from 'axios';
import { settings } from '../../config/settings.js';
import db from '../database/db.js';

class CrmIntegrationClient {
  constructor() {
    this.webhookUrl = settings.crm.webhookUrl;
    this.bearerToken = settings.crm.bearerToken;
  }

  /**
   * Envia o lead qualificado em tempo real para o CRM configurado via Webhook HTTP POST
   */
  async sendLeadToCrm(leadData) {
    const targetUrl = db.getSetting('crm_webhook_url') || this.webhookUrl || settings.crm.webhookUrl;
    const targetToken = db.getSetting('crm_api_key') || this.bearerToken || settings.crm.bearerToken;

    if (!targetUrl) {
      return {
        success: false,
        error: 'CRM_WEBHOOK_URL não configurada nas Configurações do painel ou .env'
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

    if (targetToken) {
      headers['Authorization'] = `Bearer ${targetToken}`;
    }

    try {
      const response = await axios.post(targetUrl, payload, {
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
