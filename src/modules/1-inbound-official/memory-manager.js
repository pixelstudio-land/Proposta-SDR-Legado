import db from '../../database/db.js';

class ConversationMemoryManager {
  /**
   * Obtém um lead existente ou cria um novo registro garantindo o histórico
   */
  getOrCreateLead(identifier, initialMetadata = {}) {
    if (!identifier) {
      throw new Error('Identificador obrigatório para inicializar memória de conversa.');
    }

    const cleanIdentifier = String(identifier).trim();
    let lead = db.getLeadByIdentifier(cleanIdentifier);

    if (!lead) {
      lead = db.createOrUpdateLead({
        source: initialMetadata.source || 'inbound_official',
        identifier: cleanIdentifier,
        name: initialMetadata.name || null,
        phone: initialMetadata.phone || null,
        status: 'new'
      });
    }

    return lead;
  }

  /**
   * Resgata as últimas N interações da conversa para alimentar o contexto da IA
   */
  getConversationHistory(leadId, limit = 15) {
    if (!leadId) return [];
    return db.getConversationHistory(leadId, limit);
  }

  /**
   * Grava atomicamente o turno da conversa (pergunta do usuário + resposta da IA)
   */
  saveTurn(leadId, userMessage, assistantReply) {
    if (!leadId) return;

    if (userMessage && String(userMessage).trim()) {
      db.addConversationMessage(leadId, 'user', String(userMessage).trim());
    }

    if (assistantReply && String(assistantReply).trim()) {
      db.addConversationMessage(leadId, 'assistant', String(assistantReply).trim());
    }
  }
}

export const memoryManager = new ConversationMemoryManager();
export default memoryManager;
