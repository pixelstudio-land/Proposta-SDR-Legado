const axios = require('axios');

async function checkLeads() {
  try {
    const res = await axios.get('http://localhost:3001/api/leads');
    console.log('Total de leads retornados pela API:', res.data.length);
    console.log('\n--- ÚLTIMOS LEADS ADICIONADOS (HAMBURGUERIAS) ---');
    const burgers = res.data.filter(l => l.niche.toLowerCase().includes('hamburg') || l.niche.toLowerCase().includes('restaurante'));
    burgers.slice(0, 5).forEach((l, i) => {
      console.log((i + 1) + '. [Score ' + l.priority_score + ' - ' + l.priority_tier + '] ' + l.name);
      console.log('   Telefone: ' + l.phone + ' | Cidade/Nicho: ' + l.city + ' / ' + l.niche);
      console.log('   Porte: ' + l.pricing_tier + ' -> Setup R$ ' + l.price_setup + ' + R$ ' + l.price_monthly + '/mês');
      console.log('   Link Vitrine: ' + l.showcase_url);
      console.log('   Prévia Mensagem:\n   "' + l.generated_message.split('\n')[0] + '..."\n');
    });
  } catch (e) {
    console.error('Erro na API:', e.message);
  }
}

checkLeads();
