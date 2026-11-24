import db from '../../database/db.js';

class ConversationMemoryManager {
  getOrCreateLead(identifier, initialMetadata = {}, userId = null) {
    if (!identifier) {
      throw new Error('Identificador obrigatório para inicializar memória de conversa.');
    }
    const uid = userId || initialMetadata.user_id || db.getAdminUserId();
    const cleanIdentifier = String(identifier).trim();
    let lead = db.getLeadByIdentifier(cleanIdentifier, uid);

    if (!lead) {
      lead = db.createOrUpdateLead({
        source: initialMetadata.source || 'inbound_official',
        identifier: cleanIdentifier,
        name: initialMetadata.name || null,
        phone: initialMetadata.phone || null,
        status: 'new'
      }, uid);
    }

    return lead;
  }

  getConversationHistory(leadId, limit = 15, userId = null) {
    if (!leadId) return [];
    const uid = userId || db.getAdminUserId();
    return db.getConversationHistory(leadId, limit, uid);
  }

  saveTurn(leadId, userMessage, assistantReply, userId = null) {
    if (!leadId) return;
    const uid = userId || db.getAdminUserId();

    if (userMessage && String(userMessage).trim()) {
      db.addConversationMessage(leadId, 'user', String(userMessage).trim(), uid);
    }

    if (assistantReply && String(assistantReply).trim()) {
      db.addConversationMessage(leadId, 'assistant', String(assistantReply).trim(), uid);
    }
  }
}

export const memoryManager = new ConversationMemoryManager();
export default memoryManager;
