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
      created_at: leadData.created_at || new Date().toISOString(),

      // Campos compatíveis com o Capture Webhook do CRM Legado
      nome: leadData.name || leadData.company_name || 'Lead SDR IA',
      numero: leadData.phone || null,
      telefone: leadData.phone || null,
      instagram: leadData.identifier || '',
      faturamento: leadData.revenue_range || 'Não informado',
      instalam: 'Sim'
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

      // Após o webhook criar o lead com sucesso, garantir que a origem seja atualizada de 'Outros' para a real ('Instagram', 'Google Maps' ou 'WhatsApp')
      await this.ensureCorrectOrigin(leadData);

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

  /**
   * Força a origem correta no Supabase do CRM (já que a rota /api/capture do chat-legado grava hardcoded 'Outros')
   */
  async ensureCorrectOrigin(leadData) {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || 'https://xndcrwpnwfmwxmulziwo.supabase.co';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceKey || !leadData.phone) return;

      let cleanPhone = String(leadData.phone).replace(/\D/g, '');
      if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
        cleanPhone = cleanPhone.slice(2);
      }

      let realOrigin = 'Instagram';
      if (leadData.source === 'miner_gmn' || leadData.source === 'google_maps') {
        realOrigin = 'Google Maps';
      } else if (leadData.source === 'whatsapp') {
        realOrigin = 'WhatsApp';
      }

      await axios.patch(
        `${supabaseUrl}/rest/v1/leads?whatsapp=eq.${cleanPhone}`,
        { origin: realOrigin },
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          timeout: 4000
        }
      );
    } catch (err) {
      console.warn(`[CRM] Aviso ao forçar origem do lead no Supabase: ${err.message}`);
    }
  }
}

export const crmClient = new CrmIntegrationClient();
export default crmClient;
