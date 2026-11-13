/**
 * AI COPYWRITER LOCAL - MOTOR DE GERAÇÃO CONTEXTUAL DE ABORDAGENS
 * 
 * Gera mensagens 100% humanizadas, sem emojis, com concordância de gênero correta,
 * vocabulário específico do nicho da empresa e variações combinatórias (spin-tax)
 * para garantir que nenhuma mensagem seja idêntica a outra.
 */

// 1. ANÁLISE GRAMATICAL E DE GÊNERO DO ESTABELECIMENTO
function analyzeBusinessEntity(rawName, niche, city) {
  if (!rawName) {
    return {
      hasValidName: false,
      displayName: null,
      preposition: 'em',
      gender: 'm',
      articleDefinite: 'o',
      articleIndefinite: 'um'
    };
  }

  let clean = rawName.trim();
  const lower = clean.toLowerCase();
  const lowerNiche = (niche || '').toLowerCase();
  const lowerCity = (city || '').toLowerCase();

  // Verifica se o nome é apenas genérico ("Restaurante Campinas" ou "Dentista em Campinas")
  if (
    lower === lowerNiche ||
    lower === `${lowerNiche} em ${lowerCity}` ||
    lower === `${lowerNiche} ${lowerCity}` ||
    lower.startsWith(`${lowerNiche} em `) ||
    lower.includes('whatsapp')
  ) {
    return {
      hasValidName: false,
      displayName: null,
      preposition: 'em',
      gender: 'm',
      articleDefinite: 'o',
      articleIndefinite: 'um'
    };
  }

  // Remove sufixos comuns de localização ou separadores
  clean = clean.replace(new RegExp(`\\s*[-|/•]\\s*${city}`, 'gi'), '');
  clean = clean.replace(new RegExp(`\\s*em\\s+${city}`, 'gi'), '').trim();

  // Palavras indicativas de gênero MASCULINO
  const masculineKeywords = [
    'restaurante', 'bar', 'boteco', 'botequim', 'emporio', 'empório', 'espaco', 'espaço',
    'studio', 'estudio', 'estúdio', 'centro', 'escritorio', 'escritório', 'consultorio',
    'consultório', 'salao', 'salão', 'instituto', 'laboratorio', 'laboratório',
    'hospital', 'hotel', 'motel', 'buffet', 'posto', 'mercado', 'supermercado',
    'acougue', 'açougue', 'clube', 'auto posto', 'point', 'pub', 'bistro', 'bistrô',
    'parque', 'quiosque', 'armazem', 'armazém', 'box', 'cantinho', 'rancho', 'atelier',
    'dr.', 'doutor'
  ];

  // Palavras indicativas de gênero FEMININO
  const feminineKeywords = [
    'clinica', 'clínica', 'hamburgueria', 'pizzaria', 'barbearia', 'oficina',
    'imobiliaria', 'imobiliária', 'autopecas', 'autopeças', 'auto peças', 'drogaria',
    'farmacia', 'farmácia', 'padaria', 'confeitaria', 'pastelaria', 'sorveteria',
    'loja', 'otica', 'ótica', 'academia', 'escola', 'papelaria', 'lavanderia',
    'serralheria', 'marcenaria', 'pet shop', 'veterinaria', 'veterinária', 'casa',
    'dra.', 'doutora'
  ];

  const firstWord = clean.split(' ')[0].toLowerCase().replace(/[^a-záàâãéèêíïóôõöúç]/g, '');

  let isFeminine = false;
  let isMasculine = false;

  for (const m of masculineKeywords) {
    if (lower.startsWith(m + ' ') || lower === m || firstWord === m) {
      isMasculine = true;
      break;
    }
  }

  if (!isMasculine) {
    for (const f of feminineKeywords) {
      if (lower.startsWith(f + ' ') || lower === f || firstWord === f) {
        isFeminine = true;
        break;
      }
    }
  }

  // Se ainda neutro, analisa pelo nicho
  if (!isMasculine && !isFeminine) {
    for (const m of masculineKeywords) {
      if (lowerNiche.includes(m)) {
        isMasculine = true;
        break;
      }
    }
    for (const f of feminineKeywords) {
      if (lowerNiche.includes(f)) {
        isFeminine = true;
        break;
      }
    }
  }

  // Preposição padrão ("no" ou "na")
  const gender = isFeminine ? 'f' : 'm';
  const preposition = isFeminine ? 'na' : 'no';
  const articleDefinite = isFeminine ? 'a' : 'o';
  const articleIndefinite = isFeminine ? 'uma' : 'um';

  return {
    hasValidName: true,
    displayName: clean,
    preposition,
    gender,
    articleDefinite,
    articleIndefinite
  };
}

// 2. IDENTIFICADOR DE SEGMENTO DE MERCADO
function detectMarketSegment(niche = '', name = '') {
  const text = `${niche} ${name}`.toLowerCase();

  if (
    text.includes('restaurante') || text.includes('hamburg') || text.includes('pizza') ||
    text.includes('bar') || text.includes('delivery') || text.includes('lanche') ||
    text.includes('comida') || text.includes('churrasc') || text.includes('sushi') ||
    text.includes('acai') || text.includes('açaí') || text.includes('bistro')
  ) {
    return 'GASTRONOMIA';
  }

  if (
    text.includes('odonto') || text.includes('dentista') || text.includes('sorriso') ||
    text.includes('clinica') || text.includes('clínica') || text.includes('saude') ||
    text.includes('saúde') || text.includes('medico') || text.includes('médic')
  ) {
    return 'ODONTOLOGIA';
  }

  if (
    text.includes('barbearia') || text.includes('salao') || text.includes('salão') ||
    text.includes('cabelo') || text.includes('estetica') || text.includes('estética') ||
    text.includes('sobrancelha') || text.includes('lash') || text.includes('beleza')
  ) {
    return 'BELEZA';
  }

  if (
    text.includes('advocacia') || text.includes('advogad') || text.includes('juridic') ||
    text.includes('direito') || text.includes('oab')
  ) {
    return 'ADVOCACIA';
  }

  if (
    text.includes('imobiliaria') || text.includes('imobiliária') || text.includes('imovel') ||
    text.includes('imóveis') || text.includes('corretor')
  ) {
    return 'IMOBILIARIA';
  }

  if (
    text.includes('mecanica') || text.includes('mecânica') || text.includes('autopecas') ||
    text.includes('autopeças') || text.includes('pneu') || text.includes('oficina') ||
    text.includes('carro') || text.includes('veiculo') || text.includes('automot')
  ) {
    return 'AUTOMOTIVO';
  }

  return 'GERAL';
}

// Helper para selecionar aleatoriamente de um array
function pickRandom(arr, seed = null) {
  if (!arr || arr.length === 0) return '';
  if (seed !== null && typeof seed === 'number') {
    return arr[Math.abs(seed) % arr.length];
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * MOTOR GERADOR DE MENSAGENS COM SPIN-TAX INTELIGENTE E ZERO EMOJIS
 */
function generateSmartPitch(lead, options = {}) {
  const { customTemplates, showcaseUrl, seed } = options;
  const audit = lead.audit || { pitchType: lead.pitch_type || 'LP_OFFER' };
  const pitchType = audit.pitchType || 'LP_OFFER';

  const niche = lead.niche || 'negócios';
  const city = lead.city || 'sua região';
  const entity = analyzeBusinessEntity(lead.name, niche, city);
  const segment = detectMarketSegment(niche, lead.name);

  // Saudação de acordo com a hora
  const hour = new Date().getHours();
  let timeGreeting = 'Bom dia';
  if (hour >= 12 && hour < 18) timeGreeting = 'Boa tarde';
  else if (hour >= 18 || hour < 5) timeGreeting = 'Olá';

  const greetings = [
    `${timeGreeting}! Tudo bem?`,
    `${timeGreeting}! Como vai?`,
    `Olá! Tudo bem com vocês?`,
    `${timeGreeting}! Espero que esteja tudo bem por aí.`
  ];
  const greeting = pickRandom(greetings, seed);

  // Abertura contextualizada com a empresa
  let intro = '';
  if (entity.hasValidName) {
    const introsWithName = [
      `Acompanho o trabalho de vocês ${entity.preposition} ${entity.displayName} em ${city}.`,
      `Estava conhecendo o perfil e a estrutura de vocês ${entity.preposition} ${entity.displayName} aqui em ${city}.`,
      `Encontrei o contato de vocês ${entity.preposition} ${entity.displayName} pesquisando referências de ${niche.toLowerCase()} em ${city}.`,
      `Vi o atendimento de vocês ${entity.preposition} ${entity.displayName} em ${city} e resolvi entrar em contato.`
    ];
    intro = pickRandom(introsWithName, seed ? seed + 1 : null);
  } else {
    const introsGeneric = [
      `Estava pesquisando referências de ${niche.toLowerCase()} em ${city} e cheguei até o contato de vocês.`,
      `Encontrei o contato de vocês buscando opções de ${niche.toLowerCase()} com bom atendimento em ${city}.`,
      `Pesquisando empresas do segmento de ${niche.toLowerCase()} aqui em ${city}, encontrei o WhatsApp de vocês.`
    ];
    intro = pickRandom(introsGeneric, seed ? seed + 1 : null);
  }

  // Bloco Central do Pitch: Cartão Digital Interativo para Celular e WhatsApp
  let bodyBlock = '';

  if (segment === 'GASTRONOMIA') {
    const gastronomyPitches = [
      `A gente desenvolve aquele Cartão Digital de Bolso para WhatsApp, feito sob medida para o celular: ele reúne o link do seu cardápio, botão de pedidos diretos no WhatsApp, endereço com mapa e chave PIX para o cliente copiar com um clique só.`,

      `A gente cria o Cartão Digital Interativo para restaurantes e delivery. O cliente abre no smartphone e já encontra os botões rápidos para ver o cardápio, pedir no WhatsApp, conferir a localização e copiar o seu PIX sem você precisar ficar digitando.`,

      `Nós montamos um Cartão Digital prático para WhatsApp, perfeito para você enviar para quem pede informações: ele coloca o cardápio, seus contatos, endereço e chave PIX num clique só na tela do celular.`
    ];
    bodyBlock = pickRandom(gastronomyPitches, seed ? seed + 2 : null);

  } else if (segment === 'ODONTOLOGIA' || segment === 'BELEZA') {
    const odontoBelezaPitches = [
      `A gente desenvolve aquele Cartão Digital Interativo para celular que você envia para os pacientes e clientes no WhatsApp: ele reúne o botão de agendamento direto, endereço da clínica com rota no mapa, especialidades e botão para copiar a chave PIX num clique só.`,

      `Nós criamos o Cartão Digital de Bolso para WhatsApp. Em vez de você mandar textões longos ou dados soltos, o cliente recebe um cartão elegante no celular com agendamento, localização e chave PIX integrada.`,

      `A gente monta o Cartão Digital Interativo para atendimento. Ele organiza todas as informações essenciais da clínica (serviços, agendamento no WhatsApp, endereço e PIX) em um visual moderno para celular.`
    ];
    bodyBlock = pickRandom(odontoBelezaPitches, seed ? seed + 2 : null);

  } else if (segment === 'ADVOCACIA' || segment === 'IMOBILIARIA') {
    const corporativoPitches = [
      `A gente desenvolve aquele Cartão Digital Interativo para WhatsApp: um cartão profissional que você envia aos clientes pelo celular com botão direto de consulta, localização do escritório e chave PIX num clique só.`,

      `Nós criamos o Cartão Digital de Bolso para WhatsApp, com apresentação limpa e elegante para celular. Ele reúne seus canais de atendimento, áreas de atuação, endereço e chave PIX num só lugar.`
    ];
    bodyBlock = pickRandom(corporativoPitches, seed ? seed + 2 : null);

  } else {
    // GERAL / COMÉRCIO / OFICINAS / PRESTADORES
    const geralPitches = [
      `A gente desenvolve aquele Cartão Digital Interativo para celular que você envia para os clientes no WhatsApp: ele reúne seus botões diretos de atendimento, endereço com rota no GPS, lista dos seus serviços e chave PIX para copiar com um clique só.`,

      `Nós criamos o Cartão Digital de Bolso para WhatsApp. Em vez de ficar digitando chave PIX ou mandando mensagens soltas, você envia um cartão rápido e profissional com todos os seus botões de contato.`,

      `A gente monta um Cartão Digital prático para celular: ele deixa o seu WhatsApp de atendimento, localização e chave PIX organizados em um toque na tela do cliente.`
    ];
    bodyBlock = pickRandom(geralPitches, seed ? seed + 2 : null);
  }

  // Bloco de Link da Vitrine / Demonstração do Cartão
  let showcaseBlock = '';
  if (showcaseUrl) {
    const showcaseHooks = [
      `\n\nDá uma olhada em como fica prático neste modelo de demonstração:\n${showcaseUrl}`,
      `\n\nVocê pode ver como funciona na prática abrindo este exemplo de teste:\n${showcaseUrl}`,
      `\n\nMontei um modelo de demonstração para você ver no celular como fica:\n${showcaseUrl}`
    ];
    showcaseBlock = pickRandom(showcaseHooks, seed ? seed + 3 : null);
  }

  // Bloco de Oferta Direta (R$ 35 no PIX) e CTA
  const ctas = [
    `A gente monta um personalizado com o seu logo e os seus dados hoje mesmo por R$ 35 no PIX. Se tiver interesse em deixar o seu pronto, me avisa por aqui!`,
    `Faço um personalizado com as suas cores, foto e dados por R$ 35 no PIX, entrego hoje ainda. Se quiser garantir o seu, só me dar um alô!`,
    `A gente cria o seu personalizado com o seu logo e links por apenas R$ 35 no PIX com entrega rápida hoje. Se fizer sentido para vocês, me dá um toque aqui!`
  ];
  const cta = pickRandom(ctas, seed ? seed + 4 : null);

  return `${greeting} ${intro}

${bodyBlock}${showcaseBlock}

${cta}`;
}

module.exports = {
  analyzeBusinessEntity,
  detectMarketSegment,
  generateSmartPitch
};
