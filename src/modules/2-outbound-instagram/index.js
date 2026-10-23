import targetScraper from './target-scraper.js';
import profileFilter from './profile-filter.js';
import outboundMessenger from './messenger.js';
import db from '../../database/db.js';

/**
 * Orquestrador CLI do Módulo Outbound Blindado
 * Executa o pipeline completo: Raspar Alvos -> Filtrar com IA -> Disparar Cold DMs
 */
async function runOutboundPipeline() {
  console.log('================================================================');
  console.log('🤖 INICIANDO PIPELINE: MÓDULO 2 - OUTBOUND INSTAGRAM BLINDADO');
  console.log('================================================================');

  // Leitura de argumentos da linha de comando
  // Exemplo: node src/modules/2-outbound-instagram/index.js --target=agencia_exemplo --limit=15 --send=true
  const args = process.argv.slice(2);
  const targetArg = args.find(a => a.startsWith('--target='))?.split('=')[1];
  const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '10', 10);
  const skipScrape = args.includes('--skip-scrape');
  const skipSend = args.includes('--skip-send');

  try {
    // ETAPA 1: Raspagem de Alvos
    if (!skipScrape && targetArg) {
      console.log(`\n📌 [ETAPA 1/3] Raspando seguidores de @${targetArg} (Limite: ${limitArg})...`);
      await targetScraper.scrapeFollowers(targetArg, limitArg);
    } else if (!skipScrape && !targetArg) {
      console.log('\nℹ️ [ETAPA 1/3] Nenhum --target informado. Pulando raspagem e processando leads já salvos no banco.');
    }

    // ETAPA 2: Filtragem e Auditoria Cognitiva via IA
    console.log('\n📌 [ETAPA 2/3] Executando auditoria cognitiva de bios com GPT-4o-mini...');
    const filterResults = await profileFilter.filterPendingLeads();
    console.log(`📊 Auditoria concluída: ${filterResults.approved.length} perfis aprovados para abordagem.`);

    // ETAPA 3: Envio de Cold DMs Humanizadas
    if (!skipSend) {
      console.log('\n📌 [ETAPA 3/3] Iniciando disparo humanizado de Cold DMs em rodízio...');
      const sendResults = await outboundMessenger.sendColdDms(5);
      console.log(`🚀 Disparos finalizados: ${sendResults.sent} enviados | ${sendResults.skipped} pulados.`);
    } else {
      console.log('\nℹ️ [ETAPA 3/3] Disparo ignorado (--skip-send ativo).');
    }

    console.log('\n================================================================');
    console.log('✅ PIPELINE OUTBOUND CONCLUÍDO COM SUCESSO');
    console.log('================================================================');
  } catch (error) {
    console.error(`\n❌ Falha na execução do pipeline Outbound: ${error.message}`);
  } finally {
    db.close();
  }
}

runOutboundPipeline();
