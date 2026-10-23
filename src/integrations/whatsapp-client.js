import axios from 'axios';
import { settings } from '../../config/settings.js';

class WhatsAppEvolutionClient {
  constructor() {
    this.apiUrl = settings.whatsapp.apiUrl;
    this.apiKey = settings.whatsapp.apiKey;
    this.instanceName = settings.whatsapp.instanceName;
    this.sdrNotificationPhone = settings.whatsapp.sdrNotificationPhone;
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'apikey': this.apiKey
    };
  }

  /**
   * Envia mensagem de texto para qualquer número via Evolution API
   */
  async sendTextMessage(recipientPhone, messageText) {
    if (!this.apiUrl || !this.apiKey) {
      return {
        success: false,
        error: 'WhatsApp API credentials (WA_API_URL / WA_API_KEY) não configuradas no .env'
      };
    }

    const cleanNumber = String(recipientPhone).replace(/\D/g, '');
    const endpoint = `${this.apiUrl}/message/sendText/${this.instanceName}`;

    const payload = {
      number: cleanNumber,
      text: messageText,
      delay: 1200,
      linkPreview: false
    };

    try {
      const response = await axios.post(endpoint, payload, {
        headers: this.getHeaders(),
        timeout: 10000
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      const errDetail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      return {
        success: false,
        error: `Falha ao enviar mensagem WhatsApp: ${errDetail}`
      };
    }
  }

  /**
   * Envia a ficha executiva do lead qualificado diretamente para o WhatsApp do SDR / Leo
   */
  async sendSdrAlert(leadData) {
    if (!this.sdrNotificationPhone) {
      return {
        success: false,
        error: 'SDR_NOTIFICATION_PHONE não configurado no .env'
      };
    }

    const leadPhone = leadData.phone ? `+${leadData.phone}` : 'Não informado no chat';
    const directLink = leadData.source === 'inbound_official' && leadData.identifier.startsWith('@')
      ? `https://instagram.com/${leadData.identifier.replace('@', '')}`
      : (leadData.phone ? `https://wa.me/${leadData.phone}` : 'N/A');

    const alertMessage = 
`🚨 *NOVO LEAD QUALIFICADO — MÁQUINA LEGADO* 🚨

👤 *Nome:* ${leadData.name || 'Em aberto'}
🏢 *Empresa:* ${leadData.company_name || 'Em aberto'}
🎯 *Nicho:* ${leadData.niche || 'Geral'}
💰 *Faturamento Declarado:* ${leadData.revenue_range || 'Em validação'}
📱 *Contato:* ${leadPhone}
🌐 *Origem:* ${leadData.source} (${leadData.identifier})

📝 *Diagnóstico da IA:*
_${leadData.ai_summary || 'Lead pronto para fechamento e agendamento de call estratégica.'}_

🔗 *Abrir Conversa Direta:*
${directLink}

⚡ _Transbordo automático executado com sucesso._`;

    return this.sendTextMessage(this.sdrNotificationPhone, alertMessage);
  }

  /**
   * Consulta na Evolution API quais números do lote (fixos ou móveis) têm conta ativa no WhatsApp
   * Utilizado principalmente pelo Módulo 3 (Minerador GMN) para validar números B2B
   */
  async checkWhatsappNumbers(phonesArray = []) {
    if (!this.apiUrl || !this.apiKey) {
      return phonesArray.map(phone => ({
        phone: String(phone),
        exists: false,
        error: 'WhatsApp API credentials ausentes'
      }));
    }

    const cleanNumbers = phonesArray
      .map(p => String(p).replace(/\D/g, ''))
      .filter(p => p.length >= 10);

    if (cleanNumbers.length === 0) {
      return [];
    }

    const endpoint = `${this.apiUrl}/chat/whatsappNumbers/${this.instanceName}`;

    try {
      const response = await axios.post(endpoint, {
        numbers: cleanNumbers
      }, {
        headers: this.getHeaders(),
        timeout: 15000
      });

      // A Evolution API retorna um array de objetos: [{ number: "55...", exists: true, jid: "..." }]
      const results = Array.isArray(response.data) ? response.data : (response.data?.result || []);

      return cleanNumbers.map(originalNum => {
        const found = results.find(r => 
          String(r.number).replace(/\D/g, '') === originalNum || 
          String(r.jid).replace(/\D/g, '').includes(originalNum)
        );

        return {
          phone: originalNum,
          exists: Boolean(found?.exists),
          jid: found?.jid || null
        };
      });
    } catch (error) {
      const errDetail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      // Em caso de falha de conexão com a API, preserva a integridade retornando status falso com o erro
      return cleanNumbers.map(num => ({
        phone: num,
        exists: false,
        error: errDetail
      }));
    }
  }
}

export const whatsappClient = new WhatsAppEvolutionClient();
export default whatsappClient;
