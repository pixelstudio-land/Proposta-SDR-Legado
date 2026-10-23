import db from '../../database/db.js';
import openaiClient from '../../ai/openai-client.js';

class ProfileFilterEngine {
  /**
   * Varre os leads pendentes de outbound coletados no SQLite e aplica auditoria cognitiva via IA
   */
  async filterPendingLeads() {
    // Busca leads com status 'new' da fonte outbound_instagram
    const pendingLeads = db.db.prepare(`
      SELECT * FROM leads 
      WHERE source = 'outbound_instagram' AND status = 'new'
      ORDER BY id ASC
    `).all();

    console.log(`🧠 [ProfileFilter] Iniciando auditoria cognitiva de ${pendingLeads.length} leads pendentes...`);

    const results = {
      total: pendingLeads.length,
      approved: [],
      disqualified: []
    };

    for (const lead of pendingLeads) {
      const username = lead.identifier.replace('@', '');
      const bioText = lead.ai_summary || '';

      // 1. Filtro rápido de sanidade: bio vazia ou muito curta
      if (!bioText || bioText.length < 5 || bioText === 'Sem bio informada') {
        db.updateLeadStatus(lead.id, 'disqualified', 'Descartado: biografia ausente ou insuficiente');
        results.disqualified.push({ id: lead.id, identifier: lead.identifier, reason: 'Sem bio' });
        console.log(`❌ [ProfileFilter] ${lead.identifier}: Desqualificado (sem bio)`);
        continue;
      }

      // 2. Auditoria Cognitiva com GPT-4o-mini
      try {
        console.log(`🤖 [ProfileFilter] Auditando bio de ${lead.identifier} via GPT-4o-mini: "${bioText.slice(0, 50)}..."`);
        const audit = await openaiClient.auditProfileBio(bioText, username);

        if (audit.isCommercialDecisionMaker && audit.confidenceScore >= 60) {
          // Aprovado para abordagem fria
          const summary = `ICP Aprovado (${audit.confidenceScore}% conf.): ${audit.reasoning}`;
          db.db.prepare(`
            UPDATE leads SET 
              status = 'in_qualification', 
              niche = ?, 
              ai_summary = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(audit.detectedNiche, summary, lead.id);

          results.approved.push({
            id: lead.id,
            identifier: lead.identifier,
            niche: audit.detectedNiche,
            confidence: audit.confidenceScore,
            reasoning: audit.reasoning
          });

          console.log(`🎯 [ProfileFilter] ${lead.identifier}: APROVADO [${audit.detectedNiche}] - ${audit.reasoning}`);
        } else {
          // Desqualificado
          const summary = `Descarte (${audit.confidenceScore}% conf.): ${audit.reasoning}`;
          db.updateLeadStatus(lead.id, 'disqualified', summary);
          results.disqualified.push({
            id: lead.id,
            identifier: lead.identifier,
            reason: audit.reasoning
          });

          console.log(`🚫 [ProfileFilter] ${lead.identifier}: REPROVADO - ${audit.reasoning}`);
        }
      } catch (err) {
        console.warn(`⚠️ [ProfileFilter] Falha ao auditar ${lead.identifier}: ${err.message}`);
      }
    }

    console.log(`🏁 [ProfileFilter] Concluído: ${results.approved.length} aprovados | ${results.disqualified.length} descartados.`);
    return results;
  }
}

export const profileFilter = new ProfileFilterEngine();
export default profileFilter;
