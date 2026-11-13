const axios = require('axios');

/**
 * Classificação de nichos por poder de compra e ticket médio
 */
const HIGH_TICKET_NICHES = [
  'odontologia', 'dentista', 'clinica', 'clinicas', 'clinicas esteticas', 
  'medicina', 'estetica', 'advocacia', 'advogado', 'imobiliaria', 'imobiliarias', 
  'marcenaria', 'engenharia', 'arquitetura', 'cirurgia'
];

const MEDIUM_TICKET_NICHES = [
  'restaurante', 'restaurantes', 'hamburgueria', 'hamburguerias', 
  'pizzaria', 'pizzarias', 'barbearia', 'barbearias', 'salao', 'petshop', 
  'academia', 'academias', 'autopecas', 'mecanica'
];

/**
 * Limpa e valida o nome da empresa para evitar frases robóticas
 */
function cleanBusinessName(rawName, niche, city) {
  if (!rawName) return null;

  let name = rawName.trim();
  const lowerName = name.toLowerCase();
  const lowerNiche = (niche || '').toLowerCase();
  const lowerCity = (city || '').toLowerCase();

  // Se o nome for apenas o nicho + cidade
  if (
    lowerName === lowerNiche ||
    lowerName === `${lowerNiche} em ${lowerCity}` ||
    lowerName === `${lowerNiche} ${lowerCity}` ||
    lowerName.startsWith(`${lowerNiche} em `) ||
    lowerName.includes('whatsapp')
  ) {
    return null;
  }

  // Remove sufixos como "- Campinas", "| Campinas", etc.
  name = name.replace(new RegExp(`\\s*[-|/•]\\s*${city}`, 'gi'), '');
  name = name.replace(new RegExp(`\\s*em\\s+${city}`, 'gi'), '');

  return name.trim();
}

/**
 * Audita o site da empresa (se houver)
 */
async function auditWebsite(websiteUrl) {
  if (!websiteUrl || websiteUrl.trim() === '' || websiteUrl === 'null' || websiteUrl.toLowerCase().includes('facebook.com')) {
    return {
      hasWebsite: false,
      status: 'SEM_SITE',
      pitchType: 'LP_OFFER',
      reason: 'Empresa não possui site oficial registrado.'
    };
  }

  let formattedUrl = websiteUrl.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = 'https://' + formattedUrl;
  }

  const startTime = Date.now();
  try {
    const res = await axios.get(formattedUrl, {
      timeout: 7000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      validateStatus: () => true
    });

    const elapsedMs = Date.now() - startTime;

    if (res.status >= 400 || elapsedMs > 5000) {
      return {
        hasWebsite: true,
        status: 'LENTO_RUIM',
        pitchType: 'REDESIGN_OFFER',
        reason: `Site com lentidão ou erro HTTP ${res.status} (${elapsedMs}ms).`
      };
    }

    const html = (typeof res.data === 'string') ? res.data.toLowerCase() : '';
    const hasWhatsAppButton = html.includes('api.whatsapp.com') || html.includes('wa.me') || html.includes('whatsapp');

    if (!hasWhatsAppButton) {
      // Site ativo e rápido, mas sem botão de WhatsApp — pitch diferente do redesign completo
      return {
        hasWebsite: true,
        status: 'SEM_WHATSAPP_BUTTON',
        pitchType: 'WHATSAPP_OFFER',
        reason: 'Site ativo e responsivo, mas sem botão de captura direta para WhatsApp.'
      };
    }

    return {
      hasWebsite: true,
      status: 'SITE_OK',
      pitchType: 'SAAS_OFFER',
      reason: 'Site responsivo e ativo. Perfeito para venda de CRM, Dashboard ou Sistema.'
    };

  } catch (err) {
    return {
      hasWebsite: true,
      status: 'LENTO_RUIM',
      pitchType: 'REDESIGN_OFFER',
      reason: `Site inacessível ou certificado expirado: ${err.message}`
    };
  }
}

/**
 * Algoritmo de Pontuação de Lead (Score 0-100) e Precificação Dinâmica por Porte
 */
function calculateLeadScoreAndPricing(lead, audit) {
  let score = 0;
  const nicheNormalized = (lead.niche || '').toLowerCase().trim();

  // 1. Diagnóstico do Site (Máximo 40 pontos)
  if (audit.status === 'SEM_SITE') {
    score += 40; // Maior dor de todas
  } else if (audit.status === 'LENTO_RUIM') {
    score += 30; // Tem verba mas site não converte
  } else {
    score += 15; // Site bom, alvo de SaaS
  }

  // 2. Poder de Compra do Nicho e Precificação (Máximo 30 pontos)
  let pricingTier = 'PEQUENO';
  let priceSetup = 50;
  let priceMonthly = 20;

  if (HIGH_TICKET_NICHES.some(n => nicheNormalized.includes(n))) {
    score += 30;
    pricingTier = 'ALTO';
    priceSetup = 350;
    priceMonthly = 49;
  } else if (MEDIUM_TICKET_NICHES.some(n => nicheNormalized.includes(n))) {
    score += 20;
    pricingTier = 'MEDIO';
    priceSetup = 150;
    priceMonthly = 35;
  } else {
    score += 10;
    pricingTier = 'PEQUENO';
    priceSetup = 50;
    priceMonthly = 20;
  }

  // 3. Validação do Contato (Máximo 20 pontos)
  if (lead.phone) score += 15;
  if (lead.address && lead.address.length > 5) score += 5;

  // 4. Personalização do Nome (Máximo 10 pontos)
  const validName = cleanBusinessName(lead.name, lead.niche, lead.city);
  if (validName) {
    score += 10;
  } else {
    score += 3;
  }

  // Tier de Prioridade
  let priorityTier = 'BRONZE';
  if (score >= 80) priorityTier = 'OURO';
  else if (score >= 60) priorityTier = 'PRATA';

  return {
    score,
    priorityTier,
    pricingTier,
    priceSetup,
    priceMonthly,
    validName
  };
}

/**
 * Constrói a URL personalizada da Vitrine (o "iFood de LPs")
 */
function buildShowcaseUrl(baseUrl, lead, validName, pricingTier) {
  let base = (baseUrl && baseUrl.trim() && baseUrl.trim() !== 'http://localhost:3001/vitrine/')
    ? baseUrl.trim()
    : 'https://pixelstudio-land.github.io/ifood-de-LP/cartao.html';

  // Se terminar em pasta sem barra, adiciona barra. Se já apontar para arquivo html, preserva.
  if (!base.endsWith('.html') && !base.endsWith('/')) {
    base += '/cartao.html';
  } else if (base.endsWith('/')) {
    base += 'cartao.html';
  }

  const params = new URLSearchParams();
  if (lead.niche) params.set('nicho', lead.niche);
  if (lead.city) params.set('cidade', lead.city);
  if (validName) params.set('empresa', validName);

  return `${base}?${params.toString()}`;
}

const { generateSmartPitch, analyzeBusinessEntity } = require('./ai-copywriter');

/**
 * Gera mensagem humanizada com link do portfólio dinâmico, concordância gramatical e ZERO emojis
 */
function generatePitchMessage(lead, customTemplates = {}, showcaseUrl = '', seed = null) {
  const audit = lead.audit || { pitchType: lead.pitch_type || 'LP_OFFER' };
  
  // Se o usuário configurou templates manuais específicos nas configurações, respeita
  if (audit.pitchType === 'LP_OFFER' && customTemplates.noSite && customTemplates.noSite.trim() !== '') {
    const validName = cleanBusinessName(lead.name, lead.niche, lead.city);
    const hora = new Date().getHours();
    const saudacao = (hora >= 5 && hora < 12) ? 'Bom dia' : (hora >= 12 && hora < 18) ? 'Boa tarde' : 'Olá';
    return customTemplates.noSite
      .replace(/{{saudacao}}/g, saudacao)
      .replace(/{{empresa}}/g, validName || `empresa de ${(lead.niche || '').toLowerCase()}`)
      .replace(/{{nicho}}/g, (lead.niche || '').toLowerCase())
      .replace(/{{cidade}}/g, lead.city || '')
      .replace(/{{link_portfolio}}/g, showcaseUrl);
  }

  if (audit.pitchType === 'REDESIGN_OFFER' && customTemplates.badSite && customTemplates.badSite.trim() !== '') {
    const validName = cleanBusinessName(lead.name, lead.niche, lead.city);
    const hora = new Date().getHours();
    const saudacao = (hora >= 5 && hora < 12) ? 'Bom dia' : (hora >= 12 && hora < 18) ? 'Boa tarde' : 'Olá';
    return customTemplates.badSite
      .replace(/{{saudacao}}/g, saudacao)
      .replace(/{{empresa}}/g, validName || `empresa de ${(lead.niche || '').toLowerCase()}`)
      .replace(/{{nicho}}/g, (lead.niche || '').toLowerCase())
      .replace(/{{cidade}}/g, lead.city || '')
      .replace(/{{link_portfolio}}/g, showcaseUrl);
  }

  if (audit.pitchType === 'SAAS_OFFER' && customTemplates.hasSite && customTemplates.hasSite.trim() !== '') {
    const validName = cleanBusinessName(lead.name, lead.niche, lead.city);
    const hora = new Date().getHours();
    const saudacao = (hora >= 5 && hora < 12) ? 'Bom dia' : (hora >= 12 && hora < 18) ? 'Boa tarde' : 'Olá';
    return customTemplates.hasSite
      .replace(/{{saudacao}}/g, saudacao)
      .replace(/{{empresa}}/g, validName || `empresa de ${(lead.niche || '').toLowerCase()}`)
      .replace(/{{nicho}}/g, (lead.niche || '').toLowerCase())
      .replace(/{{cidade}}/g, lead.city || '')
      .replace(/{{link_portfolio}}/g, showcaseUrl);
  }

  // WHATSAPP_OFFER: site bom mas sem botão de WhatsApp — pitch cirúrgico
  // (não há template manual para este caso, vai direto para o motor inteligente)

  // Motor Inteligente Quase IA por padrão
  // Deriva o seed do id único do lead para garantir variação entre mensagens de leads diferentes
  const leadSeed = lead.id ? lead.id : null;
  return generateSmartPitch(lead, {
    customTemplates,
    showcaseUrl,
    seed: leadSeed
  });
}

module.exports = {
  cleanBusinessName,
  auditWebsite,
  calculateLeadScoreAndPricing,
  buildShowcaseUrl,
  generatePitchMessage
};
