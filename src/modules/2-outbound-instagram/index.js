import targetScraper from './target-scraper.js';
import profileFilter from './profile-filter.js';
import outboundMessenger from './messenger.js';
import db from '../../database/db.js';

import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Orquestrador do Módulo Outbound Blindado (Isolado por Tenant)
 */
export async function runOutboundPipeline(options = {}) {
  const isCli = !options.fromApi;
  const userId = Number(options.userId) || db.getAdminUserId();
  const args = process.argv.slice(2);
  const targetArg = options.target !== undefined ? options.target : args.find(a => a.startsWith('--target='))?.split('=')[1];
  const limitArg = options.limit !== undefined ? parseInt(options.limit, 10) : parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '10', 10);
  const skipScrape = options.skipScrape !== undefined ? options.skipScrape : args.includes('--skip-scrape');
  const skipSend = options.skipSend !== undefined ? options.skipSend : args.includes('--skip-send');

  console.log('================================================================');
  console.log(`🤖 INICIANDO PIPELINE: MÓDULO 2 - OUTBOUND INSTAGRAM (USER #${userId})`);
  console.log('================================================================');

  try {
    if (!skipScrape && targetArg) {
      console.log(`\n📌 [ETAPA 1/3] Raspando seguidores de @${targetArg} (Limite: ${limitArg})...`);
      await targetScraper.scrapeFollowers(targetArg, limitArg, userId);
    }

    console.log('\n📌 [ETAPA 2/3] Executando auditoria cognitiva de bios com GPT-4o-mini...');
    const filterResults = await profileFilter.filterPendingLeads(userId);

    let sendResults = { sent: 0, skipped: 0 };
    if (!skipSend) {
      console.log('\n📌 [ETAPA 3/3] Iniciando disparo humanizado de Cold DMs em rodízio...');
      sendResults = await outboundMessenger.sendColdDms(5, userId);
    }

    return {
      success: true,
      target: targetArg,
      approved: filterResults.approved.length,
      sent: sendResults.sent,
      skipped: sendResults.skipped
    };
  } catch (error) {
    console.error(`\n❌ Falha na execução do pipeline Outbound: ${error.message}`);
    throw error;
  } finally {
    if (isCli) {
      db.close();
    }
  }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  runOutboundPipeline({ fromApi: false });
}

export default runOutboundPipeline;
