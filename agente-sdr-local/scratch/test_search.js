const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('public/vitrine/app.js', 'utf8')
  .replace('const MODELS_CATALOG =', 'global.MODELS_CATALOG =')
  .replace('function normalizeText', 'global.normalizeText = function');

global.window = { location: { search: '' } };
global.document = { getElementById: () => ({ innerText: '', style: {} }), querySelectorAll: () => [], addEventListener: () => {} };

vm.runInThisContext(code);

const queries = ['pet', 'hamburguer', 'advogado', 'dentista', 'estetica', 'pizza'];

for (const q of queries) {
  const norm = normalizeText(q);
  const matches = MODELS_CATALOG.filter(m => {
    const textPool = [m.title, m.desc, m.tag, m.category, m.id, ...(m.highlights || [])].join(' ');
    return normalizeText(textPool).includes(norm);
  });
  console.log(`Query "${q}": found ${matches.length} models ->`, matches.map(m => m.title));
}
