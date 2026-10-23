class AiResponseParser {
  /**
   * Extrai e faz o parse de JSON mesmo se a resposta contiver blocos de código Markdown ou texto extra
   */
  extractJson(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Conteúdo inválido para extração de JSON.');
    }

    const trimmed = rawText.trim();

    // 1. Tenta parse direto
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      // continua para tentativas com regex
    }

    // 2. Extrai de blocos ```json ... ``` ou ``` ... ```
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch (_) {
        // continua
      }
    }

    // 3. Procura o primeiro '{' e o último '}' no texto
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = trimmed.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (err) {
        throw new Error(`Falha ao decodificar JSON extraído: ${err.message}. Texto original: ${trimmed.slice(0, 150)}...`);
      }
    }

    throw new Error(`Nenhum objeto JSON válido foi encontrado na resposta: ${trimmed.slice(0, 100)}...`);
  }

  /**
   * Valida e sanitiza os dados de qualificação de lead extraídos pela IA no Inbound
   */
  parseQualificationData(rawText) {
    const data = this.extractJson(rawText);

    return {
      isQualified: Boolean(data.isQualified),
      companyName: data.companyName ? String(data.companyName).trim() : null,
      niche: data.niche ? String(data.niche).trim() : null,
      revenueRange: data.revenueRange ? String(data.revenueRange).trim() : null,
      painPoints: Array.isArray(data.painPoints) ? data.painPoints : (data.painPoints ? [String(data.painPoints)] : []),
      summary: data.summary ? String(data.summary).trim() : '',
      confidenceScore: Number(data.confidenceScore) || 0,
      nextAction: data.nextAction || (data.isQualified ? 'transbordo_whatsapp' : 'encerrar_amigavelmente')
    };
  }

  /**
   * Higieniza e padroniza números de telefone (fixos e móveis) para o formato internacional E.164
   * Exemplo: (11) 3456-7890 -> 551134567890 (fixo)
   *          (11) 98765-4321 -> 5511987654321 (móvel)
   */
  cleanAndFormatPhone(rawPhone, defaultDdd = '11') {
    if (!rawPhone) return { isValid: false, phone: null, type: null };

    let cleaned = String(rawPhone).replace(/\D/g, '');

    // Se começar com 0, remove o zero inicial
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    // Se já tiver DDI do Brasil (55)
    if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
      const ddd = cleaned.substring(2, 4);
      const number = cleaned.substring(4);
      const type = number.length === 9 ? 'mobile' : 'landline';
      return { isValid: true, phone: cleaned, ddd, number, type };
    }

    // Se vier com DDD (10 ou 11 dígitos)
    if (cleaned.length === 10 || cleaned.length === 11) {
      const ddd = cleaned.substring(0, 2);
      const number = cleaned.substring(2);
      const type = number.length === 9 ? 'mobile' : 'landline';
      return { isValid: true, phone: `55${cleaned}`, ddd, number, type };
    }

    // Se vier sem DDD (8 ou 9 dígitos locais)
    if (cleaned.length === 8 || cleaned.length === 9) {
      const type = cleaned.length === 9 ? 'mobile' : 'landline';
      return { isValid: true, phone: `55${defaultDdd}${cleaned}`, ddd: defaultDdd, number: cleaned, type };
    }

    return { isValid: false, phone: cleaned, type: 'unknown' };
  }
}

export const parser = new AiResponseParser();
export default parser;
