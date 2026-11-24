import db from '../../database/db.js';
import openaiClient from '../../ai/openai-client.js';

class ProfileFilterEngine {
  /**
   * Varre os leads pendentes de outbound do tenant e aplica auditoria cognitiva via IA
   */
  async filterPendingLeads(userId = null) {
    const uid = Number(userId) || db.getAdminUserId();
    const pendingLeads = db.db.prepare(`
      SELECT * FROM leads
      WHERE user_id = ?
        AND (source = 'outbound_instagram' OR (instagram IS NOT NULL AND instagram != ''))
        AND status IN ('new', 'no_whatsapp')
      ORDER BY id ASC
    `).all(uid);

    console.log(`🧠 [ProfileFilter] (User #${uid}) Iniciando auditoria cognitiva de ${pendingLeads.length} leads pendentes...`);

    const results = {
      total: pendingLeads.length,
      approved: [],
      disqualified: []
    };

    for (const lead of pendingLeads) {
      const targetHandle = (lead.instagram || lead.identifier || '').replace('@', '').trim();
      const bioText = lead.ai_summary || '';

      if (!bioText || bioText.length < 5 || bioText === 'Sem bio informada') {
        db.updateLeadStatus(lead.id, 'disqualified', 'Descartado: biografia ausente ou insuficiente', null, uid);
        results.disqualified.push({ id: lead.id, identifier: targetHandle, reason: 'Sem bio' });
        continue;
      }

      try {
        const audit = await openaiClient.auditProfileBio(bioText, targetHandle, uid);

        if (audit.isCommercialDecisionMaker && audit.confidenceScore >= 60) {
          const summary = `ICP Aprovado (${audit.confidenceScore}% conf.): ${audit.reasoning}`;
          db.db.prepare(`
            UPDATE leads SET
              status = 'in_qualification',
              niche = ?,
              ai_summary = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
          `).run(audit.detectedNiche, summary, lead.id, uid);

          results.approved.push({
            id: lead.id,
            identifier: lead.identifier,
            niche: audit.detectedNiche,
            confidence: audit.confidenceScore,
            reasoning: audit.reasoning
          });
        } else {
          const summary = `Descarte (${audit.confidenceScore}% conf.): ${audit.reasoning}`;
          db.updateLeadStatus(lead.id, 'disqualified', summary, null, uid);
          results.disqualified.push({
            id: lead.id,
            identifier: lead.identifier,
            reason: audit.reasoning
          });
        }
      } catch (err) {
        console.warn(`⚠️ [ProfileFilter] Falha ao auditar ${lead.identifier}: ${err.message}`);
      }
    }

    return results;
  }
}

export const profileFilter = new ProfileFilterEngine();
export default profileFilter;
