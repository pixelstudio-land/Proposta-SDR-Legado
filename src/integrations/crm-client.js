import axios from 'axios';
import { settings } from '../../config/settings.js';
import db from '../database/db.js';

/**
 * Constrói o Dossiê Executivo formatado e detalhado do lead para exibição no CRM
 */
export function buildLeadDossier(leadData) {
  const company = leadData.company_name || leadData.name || 'Lead SDR IA';
  const contact = leadData.name || 'Decisor Comercial';
  let niche = leadData.niche || 'Geral / Não informado';
  if (niche.includes(',')) niche = niche.split(',')[0].trim();

  const revenue = leadData.revenue_range || 'Não informado';
  
  // Telefone formatado e tipo
  const phone = leadData.phone || 'Sem telefone';
  const isMobile = leadData.phone_type === 'mobile' || (leadData.phone && String(leadData.phone).length === 13);
  const phoneTypeLabel = isMobile ? 'Celular' : (leadData.phone_type === 'landline' ? 'Fixo com WhatsApp' : 'Comercial');
  
  // Extração de Cidade, Endereço, Site, Nota e Avaliações
  let address = 'Não informado';
  let city = 'Não informada';
  let website = 'Não informado';
  let rating = null;
  let reviews = null;
  
  if (leadData.ai_summary) {
    const matchAddr = leadData.ai_summary.match(/Minerado GMN:\s*([^|]+)/i);
    if (matchAddr && matchAddr[1]) address = matchAddr[1].trim();

    const matchSite = leadData.ai_summary.match(/Site:\s*([^|]+)/i);
    if (matchSite && matchSite[1] && !matchSite[1].includes('Sem site')) website = matchSite[1].trim();

    const matchRating = leadData.ai_summary.match(/Avaliação:\s*([\d,\.]+)\s*★?(?:\s*\(([\d\.]+)\s*avaliações\))?/i);
    if (matchRating) {
      if (matchRating[1]) rating = matchRating[1].trim();
      if (matchRating[2]) reviews = matchRating[2].trim();
    }
  }

  // Extrai cidade com parser inteligente de endereços brasileiros
  if (leadData.city && typeof leadData.city === 'string' && leadData.city.trim().length > 1) {
    city = leadData.city.trim();
  } else if (address && address !== 'Não informado' && address !== 'Sem endereço') {
    // Padrão 1: ", Nome da Cidade - UF" (ex: ", Jundiaí - SP, 13207-140")
    const matchUf = address.match(/(?:,\s*|\s+)([^,0-9\-\n]+?)\s*-\s*([A-Za-z]{2})\b/);
    if (matchUf && matchUf[1] && matchUf[2]) {
      city = `${matchUf[1].trim()} - ${matchUf[2].toUpperCase()}`;
    } else {
      // Padrão 2: antes do CEP ", Cidade, 13207-140"
      const cepMatch = address.match(/(?:,\s*|\s+)([^,0-9]+?)(?:,\s*|\s+)\d{5}-\d{3}/);
      if (cepMatch && cepMatch[1]) {
        city = cepMatch[1].trim();
      }
    }
  }

  if (city === 'Não informada' && leadData.niche) {
    const matchEm = leadData.niche.match(/\b(?:em|de|na|no)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+)$/i);
    if (matchEm && matchEm[1]) {
      city = matchEm[1].trim();
    }
  }

  const ratingSummary = rating ? `${rating} (${reviews || '0'} avaliacoes)` : 'Não aplicável / Não minerado';
  const instagramHandle = leadData.instagram || (leadData.identifier && leadData.identifier.startsWith('@') ? leadData.identifier : null);

  // Resumo da conversa com a Amanda IA
  let aiSummary = leadData.ai_summary || '';
  if (aiSummary.includes('Minerado GMN:')) {
    aiSummary = `Lead qualificado no Google Maps com WhatsApp ativo pronto para atendimento.`;
  }

  return `*DOSSIE COMERCIAL SDR IA — LEGADO PERFORMANCE*
-------------------------------------
*Empresa:* ${company}
*Nicho:* ${niche}
*Telefone:* ${phone} (${phoneTypeLabel})
*Instagram:* ${instagramHandle || 'Não informado'}
*Site:* ${website}
*Endereco:* ${address}
*Cidade:* ${city}
*Avaliacao Google:* ${ratingSummary}
*Faturamento Estimado:* ${revenue}
-------------------------------------
*Resumo da Qualificacao:*
${aiSummary || 'Lead qualificado e pronto para atendimento do consultor.'}`;
}

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

    const dossierText = buildLeadDossier(leadData);

    const payload = {
      event: 'lead_qualified',
      source: leadData.source || 'inbound_official',
      lead_id: leadData.id,
      identifier: leadData.identifier,
      name: leadData.name || leadData.company_name || 'Lead SDR IA',
      company_name: leadData.company_name || leadData.name || 'Não informada',
      phone: leadData.phone || null,
      phone_type: leadData.phone_type || null,
      is_whatsapp_active: Boolean(leadData.is_whatsapp_active),
      niche: leadData.niche || 'Geral',
      revenue_range: leadData.revenue_range || 'Não informado',
      ai_summary: dossierText,
      created_at: leadData.created_at || new Date().toISOString(),

      // Campos compatíveis com o Capture Webhook do CRM Legado
      nome: leadData.company_name || leadData.name || 'Lead SDR IA',
      numero: leadData.phone || null,
      telefone: leadData.phone || null,
      instagram: leadData.instagram || leadData.identifier || '',
      faturamento: leadData.revenue_range || 'Não informado',
      detalhes: dossierText,
      notes: dossierText,
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
        timeout: 9000
      });

      // Pós-processamento rico no Supabase: força origem, notas, detalhes e injeta o Dossiê na primeira mensagem do chat
      await this.enrichLeadAndChatInSupabase(leadData, dossierText);

      return {
        success: true,
        statusCode: response.status,
        data: response.data,
        dossier: dossierText
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
   * Atualiza metadados e injeta a primeira mensagem com o Dossiê Rico no chat do CRM
   */
  async enrichLeadAndChatInSupabase(leadData, dossierText) {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || 'https://xndcrwpnwfmwxmulziwo.supabase.co';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
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

      const headers = {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      };

      // 1. Busca o lead recém-inserido pelo webhook
      const searchRes = await axios.get(
        `${supabaseUrl}/rest/v1/leads?whatsapp=eq.${cleanPhone}&order=created_at.desc&limit=1`,
        { headers, timeout: 6000 }
      );

      const crmLead = searchRes.data?.[0];
      if (!crmLead) {
        console.warn(`[CRM] Lead com whatsapp ${cleanPhone} não localizado no Supabase.`);
        return;
      }

      // 2. Atualiza origem, notas, detalhes, nome da empresa e última mensagem no card do Kanban
      await axios.patch(
        `${supabaseUrl}/rest/v1/leads?id=eq.${crmLead.id}`,
        {
          origin: realOrigin,
          company_name: leadData.company_name || leadData.name || null,
          notes: dossierText,
          detalhes: dossierText,
          last_message: `Dossiê SDR IA: ${leadData.company_name || leadData.name}`
        },
        { headers, timeout: 6000 }
      );

      // 3. Se houver conversa vinculada, injeta o Dossiê completo na primeira mensagem do chat
      if (crmLead.conversation_id) {
        const msgCheck = await axios.get(
          `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${crmLead.conversation_id}&limit=5`,
          { headers, timeout: 6000 }
        );

        const existingMessages = msgCheck.data || [];
        const hasDossier = existingMessages.some(m => m.content && m.content.includes('DOSSIÊ COMERCIAL SDR IA'));

        if (!hasDossier) {
          await axios.post(
            `${supabaseUrl}/rest/v1/messages`,
            {
              conversation_id: crmLead.conversation_id,
              user_id: crmLead.user_id,
              lead_id: crmLead.id,
              content: dossierText,
              from_me: true,
              status: 'sent'
            },
            { headers, timeout: 6000 }
          );

          // Atualiza prévia da conversa
          await axios.patch(
            `${supabaseUrl}/rest/v1/conversations?id=eq.${crmLead.conversation_id}`,
            {
              last_message: `Dossie SDR IA: ${leadData.company_name || leadData.name}`,
              last_message_at: new Date().toISOString()
            },
            { headers, timeout: 6000 }
          );
          console.log(`[CRM] Dossie completo injetado no chat da conversa #${crmLead.conversation_id}`);
        }
      }
    } catch (err) {
      console.warn(`[CRM] Erro ao enriquecer lead e chat no Supabase: ${err.message}`);
    }
  }

  /**
   * Força a origem correta no Supabase do CRM (compatibilidade com chamadas legadas)
   */
  async ensureCorrectOrigin(leadData) {
    const dossier = buildLeadDossier(leadData);
    return this.enrichLeadAndChatInSupabase(leadData, dossier);
  }
}

export const crmClient = new CrmIntegrationClient();
export default crmClient;
