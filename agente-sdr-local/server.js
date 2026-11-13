const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const { initDb, dbAsync, addLog } = require('./src/database');
const { initWhatsApp, logoutWhatsApp, getConnectionStatus, onStateChange, sendHumanizedMessage } = require('./src/whatsapp');
const { 
  startWorkerLoop, 
  getWorkerStatus, 
  toggleManualPause, 
  onWorkerStateChange, 
  autoMineNextBatch,
  getSentCountToday 
} = require('./src/sdr-worker');
const { mineLeadsForNicheAndCity } = require('./src/scraper');
const { auditWebsite, calculateLeadScoreAndPricing, buildShowcaseUrl, generatePitchMessage } = require('./src/auditor');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Broadcast para todos os clientes conectados no WebSocket
function broadcast(type, data) {
  const payload = JSON.stringify({ type, data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Escuta mudanças de estado do WhatsApp e do Worker para avisar o navegador instantaneamente
onStateChange((waState) => {
  broadcast('WHATSAPP_UPDATE', waState);
});

onWorkerStateChange((workerState) => {
  broadcast('WORKER_UPDATE', workerState);
});

// WebSocket Connection Handler
wss.on('connection', async (ws) => {
  // Envia estado atual de imediato
  const wa = getConnectionStatus();
  const worker = getWorkerStatus();
  const sentToday = await getSentCountToday();

  ws.send(JSON.stringify({
    type: 'INITIAL_STATE',
    data: {
      whatsapp: wa,
      worker,
      sentToday
    }
  }));
});

// --- ROTAS DA API ---

// 1. Status Geral
app.get('/api/status', async (req, res) => {
  try {
    const wa = getConnectionStatus();
    const worker = getWorkerStatus();
    const sentToday = await getSentCountToday();

    const counts = await dbAsync.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'PENDENTE' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'ENVIADO' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'RESPONDIDO' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'SEM_WHATSAPP' THEN 1 ELSE 0 END) as no_wa,
        SUM(CASE WHEN status = 'FALHA' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN priority_tier = 'OURO' AND status = 'PENDENTE' THEN 1 ELSE 0 END) as gold_pending
      FROM leads
    `);

    res.json({
      whatsapp: wa,
      worker,
      sentToday,
      stats: {
        total: counts.total || 0,
        pending: counts.pending || 0,
        sent: counts.sent || 0,
        replied: counts.replied || 0,
        no_wa: counts.no_wa || 0,
        failed: counts.failed || 0,
        gold_pending: counts.gold_pending || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Pausar ou Ativar Worker Manualmente
app.post('/api/worker/pause', (req, res) => {
  const { paused } = req.body;
  toggleManualPause(!!paused);
  res.json({ success: true, paused: !!paused });
});

// 3. Disparar Mineração Imediata com Scoring e Vitrine
app.post('/api/worker/mine-now', async (req, res) => {
  try {
    const { niche, city } = req.body;
    const config = await dbAsync.get('SELECT * FROM config WHERE id = 1');
    
    if (niche && city) {
      addLog(`Mineração manual iniciada para "${niche}" em "${city}"...`);
      const rawLeads = await mineLeadsForNicheAndCity(niche, city);
      let count = 0;

      for (const item of rawLeads) {
        // Anti-duplicidade estrita
        const cleanDigits = (item.phone || '').replace(/\D/g, '');
        const last8 = cleanDigits.slice(-8);

        const exists = await dbAsync.get(`
          SELECT id FROM leads 
          WHERE phone = ? OR normalized_phone = ? OR normalized_phone LIKE ?
        `, [item.phone, cleanDigits, `%${last8}`]);

        if (!exists) {
          const audit = await auditWebsite(item.website);
          const evalResult = calculateLeadScoreAndPricing(item, audit);
          const showcaseUrl = buildShowcaseUrl(
            config?.portfolio_base_url,
            item,
            evalResult.validName,
            evalResult.pricingTier
          );

          const message = generatePitchMessage(
            { ...item, audit },
            {
              noSite: config?.custom_pitch_no_site,
              badSite: config?.custom_pitch_bad_site,
              hasSite: config?.custom_pitch_has_site
            },
            showcaseUrl
          );

          await dbAsync.run(`
            INSERT INTO leads (
              name, phone, normalized_phone, niche, city, address, website, 
              has_website, website_status, pitch_type,
              priority_score, priority_tier, pricing_tier, price_setup, price_monthly,
              showcase_url, generated_message, status, times_contacted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE', 0)
          `, [
            evalResult.validName || item.name,
            item.phone,
            cleanDigits,
            item.niche,
            item.city,
            item.address || '',
            item.website || '',
            audit.hasWebsite ? 1 : 0,
            audit.status,
            audit.pitchType,
            evalResult.score,
            evalResult.priorityTier,
            evalResult.pricingTier,
            evalResult.priceSetup,
            evalResult.priceMonthly,
            showcaseUrl,
            message
          ]);
          count++;
        }
      }
      res.json({ success: true, count, message: `${count} novas empresas qualificadas e adicionadas ao catálogo!` });
    } else {
      await autoMineNextBatch(config);
      res.json({ success: true, message: 'Ciclo de mineração automática executado.' });
    }
    broadcast('DATA_UPDATED', {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Configurações
app.get('/api/config', async (req, res) => {
  try {
    const config = await dbAsync.get('SELECT * FROM config WHERE id = 1');
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const {
      work_start,
      work_end,
      min_delay_seconds,
      max_delay_seconds,
      daily_limit,
      auto_pilot,
      personal_whatsapp,
      portfolio_base_url,
      target_niches,
      target_cities,
      custom_pitch_no_site,
      custom_pitch_bad_site,
      custom_pitch_has_site
    } = req.body;

    await dbAsync.run(`
      UPDATE config SET
        work_start = ?,
        work_end = ?,
        min_delay_seconds = ?,
        max_delay_seconds = ?,
        daily_limit = ?,
        auto_pilot = ?,
        personal_whatsapp = ?,
        portfolio_base_url = ?,
        target_niches = ?,
        target_cities = ?,
        custom_pitch_no_site = ?,
        custom_pitch_bad_site = ?,
        custom_pitch_has_site = ?
      WHERE id = 1
    `, [
      work_start, work_end, min_delay_seconds, max_delay_seconds, daily_limit,
      auto_pilot ? 1 : 0, personal_whatsapp, portfolio_base_url, target_niches, target_cities,
      custom_pitch_no_site, custom_pitch_bad_site, custom_pitch_has_site
    ]);

    addLog('Configurações do sistema atualizadas.');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Lista de Leads com Filtro e Ordenação por Prioridade
app.get('/api/leads', async (req, res) => {
  try {
    const { status, tier, search, limit = 100 } = req.query;
    let query = 'SELECT * FROM leads WHERE 1=1';
    const params = [];

    if (status && status !== 'TODOS') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (tier && tier !== 'TODOS') {
      query += ' AND priority_tier = ?';
      params.push(tier);
    }

    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR city LIKE ? OR niche LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ' ORDER BY priority_score DESC, id DESC LIMIT ?';
    params.push(parseInt(limit));

    const leads = await dbAsync.all(query, params);
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Importação manual de contatos (Texto ou CSV colado) com Scoring
app.post('/api/leads/import', async (req, res) => {
  try {
    const { text, defaultNiche = 'Geral', defaultCity = 'Local' } = req.body;
    if (!text) return res.status(400).json({ error: 'Nenhum texto informado.' });

    const lines = text.split('\n');
    let imported = 0;
    const config = await dbAsync.get('SELECT * FROM config WHERE id = 1');

    for (const line of lines) {
      const parts = line.split(/[;,|\t]/).map(p => p.trim());
      if (parts.length >= 2) {
        const name = parts[0];
        const rawPhone = parts[1];
        const website = parts[2] || '';
        const niche = parts[3] || defaultNiche;
        const city = parts[4] || defaultCity;

        const cleanDigits = rawPhone.replace(/\D/g, '');
        if (cleanDigits.length >= 10) {
          const finalPhone = cleanDigits.startsWith('55') ? cleanDigits : '55' + cleanDigits;
          const last8 = cleanDigits.slice(-8);

          const exists = await dbAsync.get(`
            SELECT id FROM leads 
            WHERE phone = ? OR normalized_phone = ? OR normalized_phone LIKE ?
          `, [finalPhone, cleanDigits, `%${last8}`]);
          
          if (!exists) {
            const audit = await auditWebsite(website);
            const evalResult = calculateLeadScoreAndPricing({ name, niche, city, website }, audit);
            const showcaseUrl = buildShowcaseUrl(
              config?.portfolio_base_url,
              { niche, city },
              evalResult.validName || name,
              evalResult.pricingTier
            );

            const message = generatePitchMessage({ name, niche, city, website, audit }, {
              noSite: config?.custom_pitch_no_site,
              badSite: config?.custom_pitch_bad_site,
              hasSite: config?.custom_pitch_has_site
            }, showcaseUrl);

            await dbAsync.run(`
              INSERT INTO leads (
                name, phone, normalized_phone, niche, city, website, 
                has_website, website_status, pitch_type,
                priority_score, priority_tier, pricing_tier, price_setup, price_monthly,
                showcase_url, generated_message, status, times_contacted
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE', 0)
            `, [
              evalResult.validName || name,
              finalPhone,
              cleanDigits,
              niche,
              city,
              website,
              audit.hasWebsite ? 1 : 0,
              audit.status,
              audit.pitchType,
              evalResult.score,
              evalResult.priorityTier,
              evalResult.pricingTier,
              evalResult.priceSetup,
              evalResult.priceMonthly,
              showcaseUrl,
              message
            ]);
            imported++;
          }
        }
      }
    }

    addLog(`${imported} leads importados e qualificados com sucesso!`);
    broadcast('DATA_UPDATED', {});
    res.json({ success: true, count: imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Disparo Manual de Teste ou Forçado para 1 Lead (com suporte a texto customizado do modal)
app.post('/api/leads/dispatch/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { customMessage } = req.body || {};
    const lead = await dbAsync.get('SELECT * FROM leads WHERE id = ?', [id]);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });

    const messageToSend = (customMessage && customMessage.trim() !== '') ? customMessage.trim() : lead.generated_message;

    await sendHumanizedMessage(lead.phone, messageToSend);
    await dbAsync.run(
      'UPDATE leads SET status = "ENVIADO", generated_message = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?',
      [messageToSend, id]
    );
    
    addLog(`Disparo manual executado para ${lead.name} (${lead.phone}).`);
    broadcast('DATA_UPDATED', {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7.1 Regerar Abordagem do Lead com Motor Inteligente IA
app.post('/api/leads/:id/regenerate-pitch', async (req, res) => {
  try {
    const { id } = req.params;
    const lead = await dbAsync.get('SELECT * FROM leads WHERE id = ?', [id]);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });

    const config = await dbAsync.get('SELECT * FROM config WHERE id = 1');
    const newPitch = generatePitchMessage(
      lead,
      {
        noSite: config?.custom_pitch_no_site,
        badSite: config?.custom_pitch_bad_site,
        hasSite: config?.custom_pitch_has_site
      },
      lead.showcase_url
    );

    await dbAsync.run('UPDATE leads SET generated_message = ? WHERE id = ?', [newPitch, id]);
    addLog(`Nova variação de abordagem gerada para ${lead.name}.`);
    broadcast('DATA_UPDATED', {});
    res.json({ success: true, message: newPitch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7.2 Salvar Edição Manual da Mensagem do Lead
app.put('/api/leads/:id/message', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Mensagem não pode ser vazia.' });
    }

    await dbAsync.run('UPDATE leads SET generated_message = ? WHERE id = ?', [message.trim(), id]);
    addLog(`Mensagem do lead #${id} editada manualmente.`);
    broadcast('DATA_UPDATED', {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Teste de Mensagem para o Seu Próprio WhatsApp
app.post('/api/test-message', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone) return res.status(400).json({ error: 'Informe o número com DDD.' });

    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

    await sendHumanizedMessage(cleanPhone, message || 'Ola! Esta e uma mensagem de teste enviada com sucesso pelo seu Agente SDR local.');
    addLog(`Mensagem de teste enviada com sucesso para +${cleanPhone}!`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Deletar Lead
app.delete('/api/leads/:id', async (req, res) => {
  try {
    await dbAsync.run('DELETE FROM leads WHERE id = ?', [req.params.id]);
    broadcast('DATA_UPDATED', {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Limpar Fila
app.post('/api/leads/clear', async (req, res) => {
  try {
    await dbAsync.run('DELETE FROM leads WHERE status = "PENDENTE"');
    addLog('Fila de leads pendentes esvaziada.');
    broadcast('DATA_UPDATED', {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Desconectar WhatsApp
app.post('/api/whatsapp/logout', async (req, res) => {
  try {
    await logoutWhatsApp();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Reconectar WhatsApp
app.post('/api/whatsapp/reconnect', async (req, res) => {
  try {
    await initWhatsApp();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Logs
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await dbAsync.all('SELECT * FROM logs ORDER BY id DESC LIMIT 100');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inicialização do Servidor e dos Motores Locais
const PORT = process.env.PORT || 3001;

async function start() {
  await initDb();
  addLog('Banco de dados SQLite inicializado.');

  try {
    const { recalculateAllLeads } = require('./src/recalc');
    await recalculateAllLeads();
  } catch (e) {
    console.error('Erro ao verificar leads pendentes:', e.message);
  }

  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`[INFO] AGENTE SDR AUTONOMO RODANDO 100% LOCAL`);
    console.log(`[INFO] Painel de Controle: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });

  // Inicia motor WhatsApp
  initWhatsApp().catch(err => {
    console.error('Erro ao inicializar WhatsApp:', err.message);
  });

  // Inicia loop autônomo (Worker com horário 09:00 às 18:00)
  startWorkerLoop().catch(err => {
    console.error('Erro no loop do worker:', err.message);
  });
}

start();
