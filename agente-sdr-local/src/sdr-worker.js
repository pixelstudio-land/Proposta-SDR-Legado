const { dbAsync, addLog } = require('./database');
const { getConnectionStatus, sendHumanizedMessage, checkNumberOnWhatsApp } = require('./whatsapp');
const { mineLeadsForNicheAndCity } = require('./scraper');
const { auditWebsite, calculateLeadScoreAndPricing, buildShowcaseUrl, generatePitchMessage } = require('./auditor');

let isLoopRunning = false;
let manualPause = false;
let nextDispatchTime = null;
let currentWorkerState = 'INICIANDO'; // 'EXPEDIENTE_ATIVO' | 'FORA_EXPEDIENTE' | 'AGUARDANDO_WHATSAPP' | 'PAUSADO' | 'LIMITE_ATINGIDO' | 'MINERANDO'
let statusMessage = 'Iniciando agente SDR...';
let workerListeners = [];
let lastKnownConfig = null;
let isMining = false;

function onWorkerStateChange(fn) {
  workerListeners.push(fn);
}

function notifyWorkerState() {
  workerListeners.forEach(fn => {
    try {
      fn(getWorkerStatus());
    } catch (e) {
      console.error('Erro no listener do worker:', e);
    }
  });
}

function getWorkerStatus() {
  return {
    state: currentWorkerState,
    message: statusMessage,
    manualPause,
    nextDispatchTime,
    isShiftOpen: isInsideShiftNow(lastKnownConfig)
  };
}

/**
 * Checa se a hora atual do computador está dentro do horário de expediente
 */
function isInsideShiftNow(config) {
  const now = new Date();
  const currentDay = now.getDay();
  
  const startStr = config?.work_start || '09:00';
  const endStr = config?.work_end || '18:00';
  const workDays = (config?.work_days || '1,2,3,4,5').split(',').map(d => parseInt(d.trim()));

  if (!workDays.includes(currentDay)) {
    return false;
  }

  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Inicia o loop autônomo do funcionário SDR
 */
async function startWorkerLoop() {
  if (isLoopRunning) return;
  isLoopRunning = true;
  addLog('Funcionário SDR Autônomo iniciado no sistema.');

  while (isLoopRunning) {
    try {
      await processWorkerTick();
    } catch (err) {
      console.error('[Worker Tick Error]:', err);
      addLog(`Erro no ciclo do agente: ${err.message}`, 'WARN');
    }

    await new Promise(r => setTimeout(r, 15000));
  }
}

/**
 * Ciclo de execução com fila inteligente ordenada por Prioridade (Score 0-100)
 */
async function processWorkerTick() {
  const config = await dbAsync.get('SELECT * FROM config WHERE id = 1');
  if (!config) return;
  lastKnownConfig = config;

  // 1. Checa se o usuário pausou manualmente no painel
  if (manualPause) {
    currentWorkerState = 'PAUSADO';
    statusMessage = 'Agente pausado manualmente pelo painel de controle.';
    notifyWorkerState();
    return;
  }

  // 2. Checa o horário de expediente (09:00 às 18:00)
  const isShift = isInsideShiftNow(config);
  if (!isShift) {
    currentWorkerState = 'FORA_EXPEDIENTE';
    statusMessage = `Fora do horário de expediente (${config.work_start} às ${config.work_end}). Agente aguardando as 09:00 para bater o ponto.`;
    nextDispatchTime = null;
    notifyWorkerState();
    return;
  }

  // 3. Checa conexão do WhatsApp
  const waStatus = getConnectionStatus();
  if (waStatus.state !== 'CONNECTED') {
    currentWorkerState = 'AGUARDANDO_WHATSAPP';
    statusMessage = 'Expediente aberto, mas aguardando conexão do WhatsApp da funcionária IA (leia o QR Code).';
    nextDispatchTime = null;
    notifyWorkerState();
    return;
  }

  // 4. Checa limite diário de mensagens para proteção
  const todaySentCount = await getSentCountToday();
  if (todaySentCount >= config.daily_limit) {
    currentWorkerState = 'LIMITE_ATINGIDO';
    statusMessage = `Meta de segurança diária atingida (${todaySentCount}/${config.daily_limit} mensagens). Pausando até amanhã para proteger seu chip.`;
    notifyWorkerState();
    return;
  }

  // 5. Verifica se há tempo de espera entre disparos em andamento
  if (nextDispatchTime && Date.now() < nextDispatchTime) {
    const remainingSec = Math.round((nextDispatchTime - Date.now()) / 1000);
    const min = Math.floor(remainingSec / 60);
    const sec = remainingSec % 60;
    currentWorkerState = 'EXPEDIENTE_ATIVO';
    statusMessage = `Em expediente. Próximo envio seguro em ${min}m ${sec}s (cadência humana anti-ban).`;
    notifyWorkerState();
    return;
  }

  // 6. Busca o próximo lead PENDENTE com MAIOR SCORE (Prioriza Leads Ouro e Sem Site!)
  let lead = await dbAsync.get(`
    SELECT * FROM leads 
    WHERE status = 'PENDENTE' 
      AND (times_contacted IS NULL OR times_contacted = 0)
    ORDER BY priority_score DESC, id ASC 
    LIMIT 1
  `);

  // Se não tem leads pendentes e o piloto automático está ativado, minera mais!
  if (!lead && config.auto_pilot) {
    if (!isMining) {
      isMining = true;
      currentWorkerState = 'MINERANDO';
      statusMessage = 'Fila vazia. Minerando novas empresas e calculando score em background...';
      notifyWorkerState();

      // Executa sem await para não travar o loop principal e a UI
      autoMineNextBatch(config).finally(() => {
        isMining = false;
      });
    } else {
      currentWorkerState = 'MINERANDO';
      statusMessage = 'Aguardando mineração em andamento terminar...';
      notifyWorkerState();
    }
    return;
  }

  if (!lead) {
    currentWorkerState = 'EXPEDIENTE_ATIVO';
    statusMessage = 'Nenhum lead pendente na fila no momento. Adicione mais nichos ou cidades na aba de configurações.';
    notifyWorkerState();
    return;
  }

  // 7. Envia a mensagem para o lead
  await executeLeadDispatch(lead, config);
}

/**
 * Dispara a mensagem para um lead e programa o próximo intervalo seguro
 */
async function executeLeadDispatch(lead, config) {
  try {
    currentWorkerState = 'EXPEDIENTE_ATIVO';
    statusMessage = `Verificando WhatsApp de ${lead.name} (${lead.phone})...`;
    notifyWorkerState();

    // 1. Checagem prévia se o número realmente tem WhatsApp
    const check = await checkNumberOnWhatsApp(lead.phone);
    if (!check.exists) {
      addLog(`[AVISO] O número ${lead.phone} (${lead.name}) não possui WhatsApp ativo. Descartando da fila...`, 'WARN');
      
      await dbAsync.run(`
        UPDATE leads 
        SET status = 'SEM_WHATSAPP', 
            dispatch_error = 'Número não possui WhatsApp ativo' 
        WHERE id = ?
      `, [lead.id]);

      // Intervalo curtíssimo (3 segundos) para ir direto para o próximo da fila sem gastar tempo
      nextDispatchTime = Date.now() + 3000;
      notifyWorkerState();
      return;
    }

    // 2. Dispara via WhatsApp com simulação de digitação
    // Passa o jid já validado — sendHumanizedMessage não precisa checar novamente
    statusMessage = `Enviando abordagem para ${lead.name} (Score ${lead.priority_score || 50})...`;
    notifyWorkerState();
    addLog(`Enviando abordagem para ${lead.name} (${lead.niche} - ${lead.city}, Score: ${lead.priority_score || 50})...`);

    await sendHumanizedMessage(check.jid, lead.generated_message);

    // Marca como enviado e incrementa vezes contatado para garantia anti-repetição
    await dbAsync.run(`
      UPDATE leads 
      SET status = 'ENVIADO', 
          times_contacted = COALESCE(times_contacted, 0) + 1,
          sent_at = CURRENT_TIMESTAMP, 
          dispatch_error = NULL 
      WHERE id = ?
    `, [lead.id]);

    addLog(`Mensagem enviada com sucesso para ${lead.name} (${lead.phone}).`);

    // Sorteia intervalo de segurança entre min_delay e max_delay (ex: 240 a 480 segundos)
    const minSec = config.min_delay_seconds || 240;
    const maxSec = config.max_delay_seconds || 480;
    const delaySec = Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;

    nextDispatchTime = Date.now() + delaySec * 1000;
    statusMessage = `Mensagem enviada. Próximo envio em ${Math.round(delaySec / 60)} minutos.`;
    notifyWorkerState();

  } catch (err) {
    console.error('Erro ao disparar para lead:', err);
    const isNoWhatsApp = err.message === 'NUMERO_SEM_WHATSAPP';
    const newStatus = isNoWhatsApp ? 'SEM_WHATSAPP' : 'FALHA';

    await dbAsync.run(`
      UPDATE leads 
      SET status = ?, 
          dispatch_error = ? 
      WHERE id = ?
    `, [newStatus, err.message, lead.id]);

    addLog(`Falha no envio para ${lead.name} (${lead.phone}): ${err.message}`, 'WARN');

    nextDispatchTime = Date.now() + (isNoWhatsApp ? 3000 : 90000);
    notifyWorkerState();
  }
}

/**
 * Minera novos leads com Anti-Duplicidade estrita, Cálculo de Score (0-100), Precificação e Vitrine Dinâmica
 */
async function autoMineNextBatch(config) {
  const niches = (config.target_niches || '').split(',').map(s => s.trim()).filter(Boolean);
  const cities = (config.target_cities || '').split(',').map(s => s.trim()).filter(Boolean);

  if (niches.length === 0 || cities.length === 0) {
    addLog('Nenhum nicho ou cidade configurado para mineração automática.', 'WARN');
    return;
  }

  const randomNiche = niches[Math.floor(Math.random() * niches.length)];
  const randomCity = cities[Math.floor(Math.random() * cities.length)];

  addLog(`Mineração automática iniciada: buscando "${randomNiche}" em "${randomCity}"...`);

  try {
    const rawLeads = await mineLeadsForNicheAndCity(randomNiche, randomCity);
    let addedCount = 0;

    for (const item of rawLeads) {
      // 1. BLINDAGEM ANTI-DUPLICIDADE ESTRITA:
      // Checa pelo número exato ou pelos últimos 8 dígitos em qualquer formato
      const cleanDigits = (item.phone || '').replace(/\D/g, '');
      const last8 = cleanDigits.slice(-8);

      const exists = await dbAsync.get(`
        SELECT id FROM leads 
        WHERE phone = ? 
           OR normalized_phone = ? 
           OR normalized_phone LIKE ?
      `, [item.phone, cleanDigits, `%${last8}`]);

      if (!exists) {
        // 2. Audita o site da empresa
        const audit = await auditWebsite(item.website);

        // 3. Aplica Algoritmo de Score (0-100) e Precificação Dinâmica
        const evalResult = calculateLeadScoreAndPricing(item, audit);

        // 4. Monta a URL dinâmica da vitrine personalizada para o nicho dele
        const showcaseUrl = buildShowcaseUrl(
          config.portfolio_base_url,
          item,
          evalResult.validName,
          evalResult.pricingTier
        );

        // 5. Gera a abordagem personalizada sem emojis
        const message = generatePitchMessage(
          { ...item, audit },
          {
            noSite: config.custom_pitch_no_site,
            badSite: config.custom_pitch_bad_site,
            hasSite: config.custom_pitch_has_site
          },
          showcaseUrl
        );

        // 6. Grava com todas as métricas estruturadas
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

        addedCount++;
      }
    }

    addLog(`Mineração concluída: ${addedCount} novas empresas adicionadas à fila de ${randomCity} com pontuação de prioridade.`);
  } catch (err) {
    addLog(`Erro na mineração automática: ${err.message}`, 'WARN');
  }
}

/**
 * Conta quantos disparos foram feitos hoje (baseado em sent_at, não no status atual)
 * Leads que responderam não inflam o limite — o que importa é quantas mensagens saíram hoje.
 */
async function getSentCountToday() {
  const row = await dbAsync.get(`
    SELECT COUNT(*) as count 
    FROM leads 
    WHERE sent_at IS NOT NULL
      AND date(sent_at, 'localtime') = date('now', 'localtime')
  `);
  return row ? row.count : 0;
}

function toggleManualPause(pauseState) {
  manualPause = pauseState;
  notifyWorkerState();
  addLog(`Pausa manual do agente alterada para: ${manualPause ? 'PAUSADO' : 'ATIVO'}`);
}

module.exports = {
  startWorkerLoop,
  getWorkerStatus,
  toggleManualPause,
  onWorkerStateChange,
  autoMineNextBatch,
  getSentCountToday
};
