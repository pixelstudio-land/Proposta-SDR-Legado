const axios = require('axios');

/**
 * Mapeamento de nichos comuns para filtros OpenStreetMap
 */
const OSM_NICHE_MAP = {
  'dentista': ['amenity=dentist', 'healthcare=dentist'],
  'odontologia': ['amenity=dentist', 'healthcare=dentist'],
  'restaurante': ['amenity=restaurant'],
  'restaurantes': ['amenity=restaurant'],
  'hamburgueria': ['amenity=fast_food', 'amenity=restaurant'],
  'hamburguerias': ['amenity=fast_food', 'amenity=restaurant'],
  'barbearia': ['shop=hairdresser'],
  'barbearias': ['shop=hairdresser'],
  'salao': ['shop=beauty', 'shop=hairdresser'],
  'clinica': ['amenity=clinic', 'healthcare=clinic'],
  'clinicas': ['amenity=clinic', 'healthcare=clinic'],
  'clinicas esteticas': ['shop=beauty', 'amenity=clinic'],
  'estetica': ['shop=beauty', 'amenity=clinic'],
  'advocacia': ['office=lawyer'],
  'advogado': ['office=lawyer'],
  'imobiliaria': ['office=estate_agent'],
  'imobiliarias': ['office=estate_agent'],
  'mecanica': ['shop=car_repair'],
  'autopecas': ['shop=car_repair', 'shop=car_parts'],
  'academia': ['leisure=fitness_centre'],
  'academias': ['leisure=fitness_centre'],
  'petshop': ['shop=pet', 'amenity=veterinary']
};

/**
 * Normaliza número de telefone brasileiro para o formato internacional WhatsApp: 55DDD9XXXXXXXX
 */
function normalizeBrazilianPhone(rawPhone) {
  if (!rawPhone) return null;
  
  const first = rawPhone.toString().split(/[,;/]/)[0].trim();
  let digits = first.replace(/\D/g, '');

  if (digits.length < 10) return null;

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const num = digits.slice(2); // 8 dígitos
    // Só insere o 9 se o número NÃO começa com 9 (fixo ou celular antigo sem o dígito extra)
    // Celulares modernos de SP/RJ com 10 dígitos JÁ têm o 9 incluso no DDD+número
    if (!num.startsWith('9') && ['8', '7', '6'].includes(num[0])) {
      digits = ddd + '9' + num; // Insere o 9 apenas para cel. sem o dígito extra
    }
    return '55' + digits;
  }

  if (digits.length === 11) {
    return '55' + digits;
  }

  return null;
}

/**
 * Limpa títulos de resultados web para obter o nome real da empresa
 */
function cleanScrapedTitle(rawTitle, niche, city) {
  if (!rawTitle) return null;
  let title = rawTitle.replace(/<[^>]*>/g, '').trim();

  // Remove sufixos como "| Instagram", "- Facebook", "no TripAdvisor", etc.
  title = title.split(/[|\-–•]/)[0].trim();
  title = title.replace(/(no|no app|no site|em|cardápio)\s+.*$/i, '').trim();

  // Se o título resultante for muito curto ou puramente o nicho
  if (title.length < 3 || title.toLowerCase() === niche.toLowerCase()) {
    return null;
  }

  return title;
}

/**
 * Busca estabelecimentos locais via OpenStreetMap Overpass API
 */
async function searchOverpass(niche, city) {
  const normalizedNiche = niche.toLowerCase().trim();
  const searchTags = OSM_NICHE_MAP[normalizedNiche] || ['shop=*', 'amenity=*'];

  const tagFilters = searchTags.map(t => {
    const [k, v] = t.split('=');
    if (v === '*') {
      return `node["${k}"](area.a);\nway["${k}"](area.a);`;
    }
    return `node["${k}"="${v}"](area.a);\nway["${k}"="${v}"](area.a);`;
  }).join('\n');

  const query = `
    [out:json][timeout:15];
    area["name"="${city}"]->.a;
    (
      ${tagFilters}
    );
    out body 30;
  `;

  const endpoints = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter'
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await axios.post(
        endpoint,
        'data=' + encodeURIComponent(query),
        {
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'AgenteSDR/2.5 (contact lead finder)'
          },
          timeout: 16000
        }
      );

      const elements = res.data && res.data.elements ? res.data.elements : [];
      const leads = [];

      for (const el of elements) {
        const tags = el.tags || {};
        const name = tags.name || tags['name:pt'];
        const rawPhone = tags['contact:whatsapp'] || tags['contact:phone'] || tags.phone;
        const website = tags['contact:website'] || tags.website;
        const street = tags['addr:street'] ? `${tags['addr:street']}, ${tags['addr:housenumber'] || ''}` : '';

        if (name && rawPhone) {
          const phone = normalizeBrazilianPhone(rawPhone);
          if (phone && !leads.some(l => l.phone === phone)) {
            leads.push({
              name: name.trim(),
              phone,
              niche,
              city,
              address: street,
              website: website || null,
              source: 'OpenStreetMap'
            });
          }
        }
      }

      if (leads.length > 0) return leads;
    } catch (err) {
        console.warn(`[Overpass] Falha no endpoint ${endpoint}: ${err.message}`);
      }

  return [];
}

/**
 * Busca estabelecimentos complementares via Web Search com extração do nome real do resultado
 */
async function searchDuckDuckGo(niche, city) {
  const leads = [];
  const searchTerm = `site:instagram.com "${niche}" "${city}" "wa.me" OR "whatsapp"`;
  
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchTerm)}`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9'
      },
      timeout: 10000
    });

    const html = res.data || '';
    
    // Divide em blocos de resultado
    const resultBlocks = html.split('<div class="result results_links');

    for (const block of resultBlocks) {
      // Extrai título real
      const titleMatch = /<a class="result__a[^>]*>([\s\S]*?)<\/a>/i.exec(block);
      const rawTitle = titleMatch ? titleMatch[1] : null;
      const cleanTitle = cleanScrapedTitle(rawTitle, niche, city);

      // Extrai snippet text para evitar falsos positivos
      const snippetMatch = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/i.exec(block);
      const snippet = snippetMatch ? snippetMatch[1] : '';

      // Extrai telefone apenas do snippet para maior precisão
      const phonePattern = /(?:\+?55\s?)?(?:\(?([1-9][0-9])\)?\s?)?(?:9\s?)?([0-9]{4})[-.\s]?([0-9]{4})/g;
      let pMatch = phonePattern.exec(snippet);

      if (pMatch) {
        const phone = normalizeBrazilianPhone(pMatch[0]);
        if (phone && !leads.some(l => l.phone === phone)) {
          leads.push({
            name: cleanTitle || `${niche} ${city}`,
            phone,
            niche,
            city,
            address: city,
            website: null,
            source: 'WebSearch'
          });
        }
      }

      if (leads.length >= 10) break;
    }
  } catch (e) {
    console.warn(`[DuckDuckGo] Falha na busca:`, e.message);
  }

  return leads;
}

/**
 * Minera leads combinando as fontes
 */
async function mineLeadsForNicheAndCity(niche, city) {
  let results = await searchOverpass(niche, city);
  
  // Se Overpass trouxe poucos leads, complementa com WebSearch
  if (results.length < 5) {
    const webResults = await searchDuckDuckGo(niche, city);
    for (const wr of webResults) {
      if (!results.some(r => r.phone === wr.phone)) {
        results.push(wr);
      }
    }
  }

  return results;
}

module.exports = {
  mineLeadsForNicheAndCity,
  normalizeBrazilianPhone,
  cleanScrapedTitle,
  searchOverpass,
  searchDuckDuckGo
};
