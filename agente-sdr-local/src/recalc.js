const { dbAsync } = require('./database');
const { auditWebsite, calculateLeadScoreAndPricing, buildShowcaseUrl, generatePitchMessage } = require('./auditor');

async function recalculateAllLeads(forceAll = false) {
  const config = await dbAsync.get('SELECT * FROM config WHERE id = 1');
  const sql = forceAll 
    ? 'SELECT * FROM leads' 
    : 'SELECT * FROM leads WHERE showcase_url IS NULL OR priority_score = 50';
  const leads = await dbAsync.all(sql);
  console.log(`Encontrados ${leads.length} leads para processar no motor inteligente.`);

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const audit = await auditWebsite(lead.website);
    const evalResult = calculateLeadScoreAndPricing(lead, audit);
    const showcaseUrl = buildShowcaseUrl(
      config?.portfolio_base_url,
      lead,
      evalResult.validName || lead.name,
      evalResult.pricingTier
    );
    const message = generatePitchMessage(
      { ...lead, audit },
      {
        noSite: config?.custom_pitch_no_site,
        badSite: config?.custom_pitch_bad_site,
        hasSite: config?.custom_pitch_has_site
      },
      showcaseUrl,
      lead.id || i
    );
    const cleanDigits = (lead.phone || '').replace(/\D/g, '');

    await dbAsync.run(`
      UPDATE leads SET
        priority_score = ?,
        priority_tier = ?,
        pricing_tier = ?,
        price_setup = ?,
        price_monthly = ?,
        showcase_url = ?,
        generated_message = ?,
        normalized_phone = ?,
        website_status = ?,
        pitch_type = ?,
        has_website = ?
      WHERE id = ?
    `, [
      evalResult.score,
      evalResult.priorityTier,
      evalResult.pricingTier,
      evalResult.priceSetup,
      evalResult.priceMonthly,
      showcaseUrl,
      message,
      cleanDigits,
      audit.status,
      audit.pitchType,
      audit.hasWebsite ? 1 : 0,
      lead.id
    ]);
    console.log(`[ATUALIZADO] ${lead.name} -> Score: ${evalResult.score} (${evalResult.priorityTier}), Porte: ${evalResult.pricingTier}, R$ ${evalResult.priceSetup} + R$ ${evalResult.priceMonthly}/mês`);
  }
}

module.exports = { recalculateAllLeads };

if (require.main === module) {
  recalculateAllLeads()
    .then(() => {
      console.log('Recálculo concluído com sucesso!');
      process.exit(0);
    })
    .catch(err => {
      console.error('Erro no recálculo:', err);
      process.exit(1);
    });
}
