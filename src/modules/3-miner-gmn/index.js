import mapsScraper from './maps-scraper.js';
import phoneSanitizer from './phone-sanitizer.js';
import waChecker from './wa-checker.js';
import leadExporter from './exporter.js';
import db from '../../database/db.js';

/**
 * Orquestrador CLI do Módulo 3: Mineração B2B no Google Meu Negócio
 * Executa o fluxo: Varredura Google Maps -> Sanitização de Fixos e Móveis -> Validação de WhatsApp Ativo -> Gravação SQLite -> Exportação Excel
 */
async function runGmnPipeline() {
  console.log('================================================================');
  console.log('🗺️ INICIANDO PIPELINE: MÓDULO 3 - MINERADOR GOOGLE MEU NEGÓCIO');
  console.log('================================================================');

  // Argumentos da linha de comando
  // Exemplo: node src/modules/3-miner-gmn/index.js --query="Clinica Odontologica Campinas" --limit=20
  const args = process.argv.slice(2);
  const queryArg = args.find(a => a.startsWith('--query='))?.split('=')[1] || 'Clinica Odontologica Campinas SP';
  const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '15', 10);

  try {
    // 1. Extração no Google Maps
    console.log(`\n📌 [PASSO 1/4] Extraindo estabelecimentos para "${queryArg}" (Limite: ${limitArg})...`);
    const rawBusinesses = await mapsScraper.scrape(queryArg, limitArg);

    if (rawBusinesses.length === 0) {
      console.log('⚠️ Nenhum estabelecimento foi encontrado para o termo especificado.');
      return;
    }

    // 2. Sanitização de Telefones (Classificação de Fixos vs Celulares)
    console.log(`\n📌 [PASSO 2/4] Higienizando telefones e classificando fixos e móveis...`);
    const processedList = [];
    const phonesToValidate = [];

    for (const b of rawBusinesses) {
      const sanitized = phoneSanitizer.sanitize(b.rawPhone);

      const item = {
        ...b,
        sanitizedPhone: sanitized.isValid ? sanitized.formatted : null,
        phoneType: sanitized.type, // 'landline' ou 'mobile'
        isPhoneValid: sanitized.isValid
      };

      if (sanitized.isValid) {
        phonesToValidate.push(sanitized.formatted);
      }

      processedList.push(item);
    }

    // 3. Validação de WhatsApp em Lote (Fixos comerciais e Celulares)
    console.log(`\n📌 [PASSO 3/4] Validando WhatsApp ativo para ${phonesToValidate.length} números higienizados...`);
    const waStatusMap = await waChecker.validateNumbers(phonesToValidate);

    // 4. Gravação no Banco SQLite WAL e Preparação da Lista para Exportação
    console.log(`\n📌 [PASSO 4/4] Salvando leads no banco relacional e gerando planilha Excel...`);
    const finalLeadsForExport = [];

    for (const item of processedList) {
      const phone = item.sanitizedPhone;
      const waStatus = phone ? waStatusMap.get(phone) : null;
      const isWhatsappActive = Boolean(waStatus?.exists);

      // O identificador único será o telefone (se válido) ou o próprio nome normalizado da empresa
      const identifier = phone || `gmn_${item.companyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      const ratingSummary = item.rating 
        ? `${item.rating} ★${item.reviewsCount ? ` (${item.reviewsCount} avaliações)` : ''}`
        : 'S/N';

      // Persiste no SQLite WAL
      const savedLead = db.createOrUpdateLead({
        source: 'miner_gmn',
        identifier,
        name: item.companyName,
        company_name: item.companyName,
        phone,
        phone_type: item.phoneType,
        is_whatsapp_active: isWhatsappActive ? 1 : 0,
        niche: queryArg,
        status: isWhatsappActive ? 'in_qualification' : 'new',
        ai_summary: `Minerado GMN: ${item.address || 'Sem endereço'} | Avaliação: ${ratingSummary} | Site: ${item.website || 'Sem site'}`
      });

      finalLeadsForExport.push({
        ...savedLead,
        address: item.address,
        website: item.website,
        rating: item.rating,
        reviews_count: item.reviewsCount
      });
    }

    // Exporta para Planilha XLSX
    const exportResult = leadExporter.exportToExcel(finalLeadsForExport, queryArg);

    console.log('\n================================================================');
    console.log('🎉 MINERAÇÃO B2B CONCLUÍDA COM SUCESSO');
    console.log(`🏢 Total de Empresas: ${finalLeadsForExport.length}`);
    console.log(`📱 Com Telefone Válido: ${finalLeadsForExport.filter(l => l.phone).length}`);
    console.log(`🟢 Com WhatsApp Ativo Confirmado: ${finalLeadsForExport.filter(l => l.is_whatsapp_active).length}`);
    console.log(`📁 Arquivo Gerado: ${exportResult.filePath}`);
    console.log('================================================================');

  } catch (error) {
    console.error(`\n❌ Falha na execução do pipeline do Minerador GMN: ${error.message}`);
  } finally {
    db.close();
  }
}

runGmnPipeline();
