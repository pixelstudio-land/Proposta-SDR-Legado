import express from 'express';
import path from 'path';
import fs from 'fs';
import { settings } from '../../../config/settings.js';
import db from '../../database/db.js';
import openaiClient from '../../ai/openai-client.js';
import memoryManager from './memory-manager.js';
import qualification from './qualification.js';
import transbordo from './transbordo.js';
import { runGmnPipeline } from '../3-miner-gmn/index.js';
import { runOutboundPipeline } from '../2-outbound-instagram/index.js';

const app = express();

// Servir arquivos estáticos da pasta public/ (Dashboard Web Local)
const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use(express.static(publicDir));

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

// ==============================================================================
// ROTAS DA API DO DASHBOARD WEB LOCAL
// ==============================================================================

// Estado em memória das tarefas em background
let minerTaskState = {
  status: 'idle',
  query: null,
  limit: 0,
  startedAt: null,
  completedAt: null,
  lastResult: null,
  error: null
};

let outboundTaskState = {
  status: 'idle',
  target: null,
  limit: 0,
  startedAt: null,
  completedAt: null,
  lastResult: null,
  error: null
};

/**
 * GET /api/dashboard/stats
 * Retorna contadores reais do banco de dados e estado das tarefas
 */
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const stats = db.getDashboardStats();
    return res.status(200).json({
      success: true,
      stats: {
        ...stats,
        miner: minerTaskState,
        outbound: outboundTaskState
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/dashboard/leads
 * Retorna a lista completa de leads do SQLite com suporte a filtros opcionais
 */
app.get('/api/dashboard/leads', (req, res) => {
  try {
    const { source, status } = req.query;
    const leads = db.getAllLeads({ source, status });
    return res.status(200).json({
      success: true,
      count: leads.length,
      leads
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/dashboard/leads/:id/history
 * Retorna a memória contínua de turnos (conversation_history) do lead para auditoria
 */
app.get('/api/dashboard/leads/:id/history', (req, res) => {
  try {
    const leadId = req.params.id;
    const lead = db.getLeadById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead não encontrado.' });
    }
    const history = db.getLeadHistory(leadId);
    return res.status(200).json({
      success: true,
      lead,
      history
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dashboard/miner
 * Inicia execução real do Módulo 3 (Minerador Google Maps) em background
 */
app.post('/api/dashboard/miner', async (req, res) => {
  try {
    if (minerTaskState.status === 'running') {
      return res.status(409).json({
        success: false,
        error: 'Uma mineração no Google Maps já está em execução no momento.'
      });
    }

    const query = req.body.query?.trim() || 'Clinica Odontologica Barueri SP';
    const limit = parseInt(req.body.limit || '5', 10);

    minerTaskState = {
      status: 'running',
      query,
      limit,
      startedAt: new Date().toISOString(),
      completedAt: null,
      lastResult: null,
      error: null
    };

    // Executa em segundo plano de forma assíncrona sem travar a resposta
    runGmnPipeline({ query, limit, fromApi: true })
      .then(result => {
        minerTaskState.status = 'completed';
        minerTaskState.completedAt = new Date().toISOString();
        minerTaskState.lastResult = result;
        console.log(`🎉 [Dashboard Miner] Concluído: ${result.total} empresas mineradas.`);
      })
      .catch(err => {
        minerTaskState.status = 'error';
        minerTaskState.completedAt = new Date().toISOString();
        minerTaskState.error = err.message;
        console.error(`❌ [Dashboard Miner] Erro na execução: ${err.message}`);
      });

    return res.status(200).json({
      success: true,
      message: `Mineração iniciada para "${query}" (${limit} estabelecimentos).`,
      task: minerTaskState
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dashboard/outbound
 * Dispara o fluxo real do Módulo 2 (Outbound Instagram) em background
 */
app.post('/api/dashboard/outbound', async (req, res) => {
  try {
    if (outboundTaskState.status === 'running') {
      return res.status(409).json({
        success: false,
        error: 'Um disparo de Outbound Instagram já está em execução no momento.'
      });
    }

    const target = req.body.target ? req.body.target.replace('@', '').trim() : null;
    const limit = parseInt(req.body.limit || '10', 10);

    outboundTaskState = {
      status: 'running',
      target,
      limit,
      startedAt: new Date().toISOString(),
      completedAt: null,
      lastResult: null,
      error: null
    };

    runOutboundPipeline({ target, limit, fromApi: true })
      .then(result => {
        outboundTaskState.status = 'completed';
        outboundTaskState.completedAt = new Date().toISOString();
        outboundTaskState.lastResult = result;
        console.log(`🎉 [Dashboard Outbound] Concluído para @${target || 'pendentes'}.`);
      })
      .catch(err => {
        outboundTaskState.status = 'error';
        outboundTaskState.completedAt = new Date().toISOString();
        outboundTaskState.error = err.message;
        console.error(`❌ [Dashboard Outbound] Erro na execução: ${err.message}`);
      });

    return res.status(200).json({
      success: true,
      message: `Fluxo de Outbound iniciado para @${target || 'leads pendentes'} (${limit} alvos).`,
      task: outboundTaskState
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/dashboard/exports
 * Lista as planilhas .xlsx reais disponíveis em data/exports/
 */
app.get('/api/dashboard/exports', (req, res) => {
  try {
    const exportsDir = settings.paths.exportsDir;
    if (!fs.existsSync(exportsDir)) {
      return res.status(200).json({ success: true, count: 0, files: [] });
    }

    const fileNames = fs.readdirSync(exportsDir).filter(f => f.endsWith('.xlsx'));
    const files = fileNames.map(fileName => {
      const fullPath = path.join(exportsDir, fileName);
      const stat = fs.statSync(fullPath);
      return {
        name: fileName,
        sizeBytes: stat.size,
        sizeFormatted: `${(stat.size / 1024).toFixed(1)} KB`,
        createdAt: stat.birthtime,
        downloadUrl: `/api/dashboard/exports/${encodeURIComponent(fileName)}`
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      success: true,
      count: files.length,
      files
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/dashboard/exports/:filename
 * Download da planilha Excel com 1 clique direto pelo navegador
 */
app.get('/api/dashboard/exports/:filename', (req, res) => {
  try {
    const safeFileName = path.basename(req.params.filename);
    const filePath = path.join(settings.paths.exportsDir, safeFileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Planilha não encontrada.' });
    }
    return res.download(filePath, safeFileName);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Redirecionamento da raiz e rota dashboard para o painel em public/index.html
app.get(['/', '/dashboard'], (req, res) => {
  const dashboardHtml = path.resolve('public', 'index.html');
  if (fs.existsSync(dashboardHtml)) {
    return res.sendFile(dashboardHtml);
  }
  return res.send('Dashboard Web Carregando... por favor atualize em instantes.');
});

// Inicialização do Servidor Express Unificado
const PORT = settings.server.port;
const server = app.listen(PORT, () => {
  console.log(`🚀 [Legado SDR Engine] Servidor unificado ativo na porta ${PORT}`);
  console.log(`🖥️ Dashboard Web: http://localhost:${PORT}`);
  console.log(`🔗 Healthcheck: http://localhost:${PORT}/health`);
  console.log(`📥 Inbound Webhook: http://localhost:${PORT}/api/inbound/webhook`);
});

// Encerramento gracioso
function gracefulShutdown() {
  console.log('\n🛑 Encerrando servidor graciosamente...');
  server.close(() => {
    db.close();
    console.log('✅ Banco de dados fechado e servidor finalizado.');
    process.exit(0);
  });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default app;
