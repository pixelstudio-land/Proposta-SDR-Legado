import express from 'express';
import { settings } from '../../../config/settings.js';
import db from '../../database/db.js';
import openaiClient from '../../ai/openai-client.js';
import memoryManager from './memory-manager.js';
import qualification from './qualification.js';
import transbordo from './transbordo.js';

const app = express();

// Middlewares essenciais
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * Middleware de Validação de Segurança do Webhook
 */
function validateWebhookSecret(req, res, next) {
  const secretFromHeader = req.headers['x-webhook-secret'] || req.headers['x-api-key'];
  const secretFromQuery = req.query.secret;
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const providedSecret = secretFromHeader || secretFromQuery || bearerToken;
  const configuredSecret = settings.server.webhookSecret;

  if (!configuredSecret || configuredSecret === 'default_secret' || providedSecret === configuredSecret) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Acesso não autorizado: WEBHOOK_SECRET inválido ou ausente.'
  });
}

/**
 * Rota de Healthcheck do Servidor
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'legado-sdr-inbound',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: settings.server.nodeEnv
  });
});

/**
 * Rota Principal: Receptor de Webhook do ManyChat / Direct Oficial
 */
app.post('/api/inbound/webhook', validateWebhookSecret, async (req, res) => {
  const startTime = Date.now();
  let lead = null;
  const body = req.body || {};

  try {
    // 1. Extração flexível dos dados enviados pelo ManyChat
    const rawIdentifier = body.instagram_username || body.ig_username || body.user_id || body.subscriber_id || body.phone;
    const userMessage = body.message || body.last_input_text || body.text || body.content || '';
    const userName = body.name || [body.first_name, body.last_name].filter(Boolean).join(' ') || null;
    const userPhone = body.phone || null;

    if (!rawIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'Identificador do usuário ausente no payload (necessário instagram_username, user_id ou phone).'
      });
    }

    // Normaliza identificador: se for usuário de Instagram, garante prefixo '@'
    const identifier = String(rawIdentifier).trim().startsWith('@') || !isNaN(rawIdentifier)
      ? String(rawIdentifier).trim()
      : `@${String(rawIdentifier).trim()}`;

    // 2. Resgata ou cria o Lead no banco SQLite WAL
    lead = memoryManager.getOrCreateLead(identifier, {
      source: 'inbound_official',
      name: userName,
      phone: userPhone
    });

    // 3. Grava imediatamente a mensagem do usuário na memória contínua
    if (userMessage) {
      db.addConversationMessage(lead.id, 'user', userMessage);
    }

    // 4. Resgata histórico completo para manter contexto com a IA
    const history = memoryManager.getConversationHistory(lead.id, 15);

    // 5. Processamento Cognitivo via OpenAI (GPT-4o-mini com prompt Amanda SDR)
    const aiResult = await openaiClient.processInboundConversation(history, lead);

    // 6. Grava a resposta da IA na memória do banco
    if (aiResult.reply_message) {
      db.addConversationMessage(lead.id, 'assistant', aiResult.reply_message);
    }

    // 7. Atualiza a ficha e status de qualificação do lead
    const updatedLead = qualification.evaluateAndSaveLead(
      lead.id,
      aiResult.extracted_data,
      aiResult.status
    );

    // 8. Se atingiu o ICP ('qualified'), executa o transbordo duplo imediato (WhatsApp + CRM)
    let transbordoResult = null;
    if (updatedLead.status === 'qualified') {
      transbordoResult = await transbordo.executeTransbordo(updatedLead);
    }

    const elapsedMs = Date.now() - startTime;

    // 9. Resposta estruturada retornada ao ManyChat para envio direto no chat
    return res.status(200).json({
      success: true,
      lead_id: updatedLead.id,
      reply_message: aiResult.reply_message,
      status: updatedLead.status,
      transbordo_executed: Boolean(transbordoResult?.transbordoExecuted),
      elapsed_ms: elapsedMs
    });

  } catch (error) {
    console.warn(`⚠️ [Inbound Webhook] Aviso na inferência de IA (${error.message}). Ativando resposta de contingência amigável.`);

    const fallbackReply = 'Perfeito! Poderia me informar qual é o nicho da sua empresa e a média de faturamento mensal para direcionarmos ao especialista correto?';

    // Grava a resposta de contingência na memória para manter o diálogo consistente
    if (lead?.id) {
      db.addConversationMessage(lead.id, 'assistant', fallbackReply);
    }

    return res.status(200).json({
      success: true,
      is_fallback: true,
      reply_message: fallbackReply,
      status: 'in_qualification',
      warning: error.message
    });
  }
});

// Inicialização do Servidor Express
const PORT = settings.server.port;
const server = app.listen(PORT, () => {
  console.log(`🚀 [Inbound Server] Rodando com sucesso na porta ${PORT}`);
  console.log(`🔗 Healthcheck: http://localhost:${PORT}/health`);
  console.log(`📥 Webhook endpoint: http://localhost:${PORT}/api/inbound/webhook`);
});

// Encerramento gracioso
function gracefulShutdown() {
  console.log('\n🛑 Encerrando servidor Inbound graciosamente...');
  server.close(() => {
    db.close();
    console.log('✅ Banco de dados fechado e servidor finalizado.');
    process.exit(0);
  });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default app;
