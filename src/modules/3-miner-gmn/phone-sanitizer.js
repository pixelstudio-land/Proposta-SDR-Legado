/**
 * Módulo de Higienização e Padronização de Telefones B2B
 * Padroniza para E.164 internacional preservando tanto fixos (8 dígitos) quanto celulares (9 dígitos)
 */
class PhoneSanitizer {
  /**
   * Sanitiza e classifica número de telefone
   * @param {string} rawPhone - Telefone em formato bruto
   * @param {string} defaultDdd - DDD padrão de fallback se não for detectado
   */
  sanitize(rawPhone, defaultDdd = '11') {
    if (!rawPhone || typeof rawPhone !== 'string') {
      return {
        isValid: false,
        raw: String(rawPhone || ''),
        formatted: null,
        ddd: null,
        number: null,
        type: 'unknown'
      };
    }

    const clean = rawPhone.replace(/\D/g, '');

    // Ignora números inválidos ou curtos demais
    if (clean.length < 8) {
      return {
        isValid: false,
        raw: rawPhone,
        formatted: null,
        ddd: null,
        number: null,
        type: 'unknown'
      };
    }

    // Remove zero inicial se existir (ex: 011...)
    let digits = clean.startsWith('0') ? clean.substring(1) : clean;

    let ddd = defaultDdd;
    let localNumber = '';
    let type = 'unknown';

    // Caso 1: Com DDI 55 (12 ou 13 dígitos)
    // Ex: 55 19 3871 4500 (12) ou 55 19 99871 4500 (13)
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      ddd = digits.substring(2, 4);
      localNumber = digits.substring(4);
    }
    // Caso 2: Com DDD (10 ou 11 dígitos)
    // Ex: 19 3871 4500 (10) ou 19 99871 4500 (11)
    else if (digits.length === 10 || digits.length === 11) {
      ddd = digits.substring(0, 2);
      localNumber = digits.substring(2);
    }
    // Caso 3: Sem DDD (8 ou 9 dígitos locais)
    else if (digits.length === 8 || digits.length === 9) {
      localNumber = digits;
    } else {
      return {
        isValid: false,
        raw: rawPhone,
        formatted: digits,
        ddd: null,
        number: digits,
        type: 'unknown'
      };
    }

    // Classificação estrita: 8 dígitos = fixo (landline), 9 dígitos = celular (mobile)
    if (localNumber.length === 8) {
      type = 'landline';
    } else if (localNumber.length === 9) {
      type = 'mobile';
    }

    const formatted = `55${ddd}${localNumber}`;

    return {
      isValid: type !== 'unknown',
      raw: rawPhone,
      formatted,
      ddd,
      number: localNumber,
      type
    };
  }

  /**
   * Sanitiza lote de telefones
   */
  sanitizeBatch(phonesArray = [], defaultDdd = '11') {
    return phonesArray.map(p => this.sanitize(p, defaultDdd));
  }
}

export const phoneSanitizer = new PhoneSanitizer();
export default phoneSanitizer;
