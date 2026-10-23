import OpenAI from 'openai';
import { settings } from '../../config/settings.js';
import { parser } from './parser.js';
import { getSdrInboundSystemPrompt } from './prompts/sdr-inbound.prompt.js';
import { getProfileAuditorPrompt } from './prompts/profile-auditor.prompt.js';
import { getColdCopywriterPrompt } from './prompts/cold-copywriter.prompt.js';

class OpenAiEngine {
  constructor() {
    this.client = new OpenAI({
      apiKey: settings.openai.apiKey || 'sk-dummy-key-for-init'
    });
    this.model = settings.openai.model;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Executa chamada com retries automáticos e backoff exponencial
   */
  async generateChatCompletion(messages, customOptions = {}) {
    const maxRetries = 3;
    let attempt = 0;

    const requestPayload = {
      model: customOptions.model || this.model,
      messages,
      temperature: customOptions.temperature !== undefined ? customOptions.temperature : settings.openai.temperature,
      max_tokens: customOptions.maxTokens || settings.openai.maxTokens,
      response_format: customOptions.responseFormat || undefined
    };

    while (attempt < maxRetries) {
      try {
        const response = await this.client.chat.completions.create(requestPayload);
        const choice = response.choices?.[0];
        if (!choice || !choice.message) {
          throw new Error('Resposta vazia da OpenAI.');
        }
        return choice.message.content.trim();
      } catch (error) {
        attempt++;
        const isRateLimitOrTimeout = error?.status === 429 || error?.code === 'ETIMEDOUT' || error?.status >= 500;
        
        if (attempt >= maxRetries || !isRateLimitOrTimeout) {
          throw new Error(`Falha na chamada OpenAI (${attempt}/${maxRetries}): ${error.message}`);
        }

        const backoffMs = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500);
        await this.sleep(backoffMs);
      }
    }
  }

  /**
   * Processa a conversa do Inbound com retenção de histórico completo
   * Retorna objeto estruturado com { reply_message, status, extracted_data }
   */
  async processInboundConversation(historyMessages = [], leadContext = {}) {
    const systemPromptText = getSdrInboundSystemPrompt(leadContext);

    // Formata o histórico garantindo alternância correta de turnos
    const conversationPayload = [
      { role: 'system', content: systemPromptText },
      ...historyMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: String(msg.content)
      }))
    ];

    const rawResponse = await this.generateChatCompletion(conversationPayload, {
      temperature: 0.4,
      maxTokens: 600,
      responseFormat: { type: 'json_object' }
    });

    try {
      const parsed = parser.extractJson(rawResponse);
      return {
        reply_message: String(parsed.reply_message || 'Olá! Como posso te ajudar hoje na escala da sua empresa?'),
        status: ['in_qualification', 'qualified', 'disqualified'].includes(parsed.status) ? parsed.status : 'in_qualification',
        extracted_data: {
          name: parsed.extracted_data?.name || null,
          company_name: parsed.extracted_data?.company_name || null,
          phone: parsed.extracted_data?.phone || null,
          niche: parsed.extracted_data?.niche || null,
          revenue_range: parsed.extracted_data?.revenue_range || null,
          ai_summary: parsed.extracted_data?.ai_summary || null
        }
      };
    } catch (parseError) {
      // Fallback de segurança se houver anomalia no JSON retornado
      return {
        reply_message: 'Perfeito, me conta um pouco mais: qual o nicho da sua empresa e como está sua estrutura de vendas atualmente?',
        status: 'in_qualification',
        extracted_data: {}
      };
    }
  }

  /**
   * Realiza auditoria cognitiva na bio de um perfil de Instagram
   */
  async auditProfileBio(bioText, username = '') {
    const { systemPrompt, userPrompt } = getProfileAuditorPrompt(username, bioText);

    try {
      const rawResponse = await this.generateChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { 
        temperature: 0.1,
        responseFormat: { type: 'json_object' }
      });

      const parsed = parser.extractJson(rawResponse);
      return {
        isCommercialDecisionMaker: Boolean(parsed.isCommercialDecisionMaker),
        confidenceScore: Number(parsed.confidenceScore) || 0,
        detectedNiche: String(parsed.detectedNiche || 'desconhecido'),
        reasoning: String(parsed.reasoning || '')
      };
    } catch (error) {
      return {
        isCommercialDecisionMaker: false,
        confidenceScore: 0,
        detectedNiche: 'erro_auditoria',
        reasoning: `Erro ao auditar bio: ${error.message}`
      };
    }
  }

  /**
   * Gera cold DM personalizada para disparo no Outbound
   */
  async generateColdDM(targetData) {
    const { systemPrompt, userPrompt } = getColdCopywriterPrompt(targetData);

    const message = await this.generateChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.7 });

    return message.replace(/^["']|["']$/g, '').trim();
  }
}

export const openaiClient = new OpenAiEngine();
export default openaiClient;
