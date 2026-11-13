// ==========================================================================
// AGENTE SDR LOCAL - CONTROLADOR FRONT-END REAL-TIME
// ==========================================================================

let state = {
  whatsapp: { state: 'DISCONNECTED', qrCode: null, connectedUser: null },
  worker: { state: 'INICIANDO', message: '', manualPause: false, nextDispatchTime: null, isShiftOpen: false },
  sentToday: 0,
  leads: [],
  config: null,
  activePreviewLeadId: null
};

let ws = null;
let countdownInterval = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initClock();
  initWebSocket();
  loadInitialData();
  attachEventListeners();
});

// --- 1. RELÓGIO DIGITAL AO VIVO ---
function initClock() {
  const clockEl = document.getElementById('live-clock');
  function updateTime() {
    const now = new Date();
    clockEl.innerText = now.toLocaleTimeString('pt-BR');
  }
  updateTime();
  setInterval(updateTime, 1000);
}

// --- 2. CONTROLE DE ABAS ---
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const panel = document.getElementById(targetId);
      if (panel) panel.classList.add('active');

      if (targetId === 'tab-leads') loadLeads();
      if (targetId === 'tab-config') loadConfig();
    });
  });
}

// --- 3. CONEXÃO WEBSOCKET REAL-TIME ---
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    appendLog('[WEBSOCKET] Conexão em tempo real estabelecida com o PC.', 'success');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'INITIAL_STATE') {
        state.whatsapp = msg.data.whatsapp;
        state.worker = msg.data.worker;
        state.sentToday = msg.data.sentToday;
        updateUI();
      } else if (msg.type === 'WHATSAPP_UPDATE') {
        state.whatsapp = msg.data;
        updateWhatsAppUI();
      } else if (msg.type === 'WORKER_UPDATE') {
        state.worker = msg.data;
        updateWorkerUI();
      } else if (msg.type === 'DATA_UPDATED') {
        loadStatus();
        loadLeads();
      }
    } catch (e) {
      console.error('Erro ao processar mensagem WS:', e);
    }
  };

  ws.onclose = () => {
    appendLog('[WEBSOCKET] Desconectado. Tentando reconectar em 3s...', 'warn');
    setTimeout(initWebSocket, 3000);
  };
}

// --- 4. CARREGAMENTO INICIAL DA API ---
async function loadInitialData() {
  await loadStatus();
  await loadConfig();
  await loadLeads();
  await loadLogs();
}

async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.whatsapp = data.whatsapp;
    state.worker = data.worker;
    state.sentToday = data.sentToday;

    // Atualiza KPIs
    document.getElementById('stat-sent-today').innerText = data.sentToday;
    document.getElementById('stat-pending').innerText = data.stats.pending;
    document.getElementById('stat-replied').innerText = data.stats.replied;
    document.getElementById('tab-lead-count').innerText = data.stats.total;

    // Limite diário barra
    const limit = state.config?.daily_limit || 40;
    document.getElementById('stat-daily-limit').innerText = `/${limit}`;
    const fillPercent = Math.min(100, Math.round((data.sentToday / limit) * 100));
    document.getElementById('stat-progress-fill').style.width = `${fillPercent}%`;

    updateUI();
  } catch (err) {
    console.error('Erro ao carregar status:', err);
  }
}

async function loadLeads() {
  try {
    const status = document.getElementById('lead-status-filter').value;
    const tier = document.getElementById('lead-tier-filter') ? document.getElementById('lead-tier-filter').value : 'TODOS';
    const search = document.getElementById('lead-search-input').value;
    const url = `/api/leads?status=${encodeURIComponent(status)}&tier=${encodeURIComponent(tier)}&search=${encodeURIComponent(search)}`;

    const res = await fetch(url);
    state.leads = await res.json();
    renderLeadsTable(state.leads);
  } catch (err) {
    console.error('Erro ao carregar leads:', err);
  }
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    state.config = await res.json();
    fillConfigForm(state.config);
  } catch (err) {
    console.error('Erro ao carregar configurações:', err);
  }
}

async function loadLogs() {
  try {
    const res = await fetch('/api/logs');
    const logs = await res.json();
    const terminal = document.getElementById('live-terminal');
    terminal.innerHTML = '';
    logs.reverse().forEach(log => {
      appendLog(`[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`, log.level.toLowerCase());
    });
  } catch (e) {}
}

// --- 5. ATUALIZAÇÃO GERAL DA INTERFACE ---
function updateUI() {
  updateWorkerUI();
  updateWhatsAppUI();
}

function updateWorkerUI() {
  const w = state.worker;
  const badge = document.getElementById('shift-badge');
  const badgeText = document.getElementById('shift-text');
  const statePill = document.getElementById('worker-state-pill');
  const activityBox = document.getElementById('worker-live-activity');
  const btnPause = document.getElementById('btn-toggle-pause');

  // Atualiza badge de expediente
  if (w.isShiftOpen) {
    badge.className = 'badge badge-active';
    badgeText.innerText = 'EXPEDIENTE ABERTO (09h às 18h)';
  } else {
    badge.className = 'badge badge-offline';
    badgeText.innerText = 'FORA DO EXPEDIENTE (Pausa até 09:00)';
  }

  // Atualiza pill e botões
  if (w.manualPause) {
    statePill.className = 'pill pill-paused';
    statePill.innerText = 'PAUSADO';
    btnPause.innerText = 'Retomar Expediente';
  } else {
    btnPause.innerText = 'Pausar Expediente';
    if (w.state === 'EXPEDIENTE_ATIVO') {
      statePill.className = 'pill pill-active';
      statePill.innerText = 'TRABALHANDO';
    } else if (w.state === 'MINERANDO') {
      statePill.className = 'pill pill-waiting';
      statePill.innerText = 'MINERANDO';
    } else if (w.state === 'AGUARDANDO_WHATSAPP') {
      statePill.className = 'pill pill-waiting';
      statePill.innerText = 'AGUARDANDO QR';
    } else {
      statePill.className = 'pill pill-offline';
      statePill.innerText = 'INATIVO';
    }
  }

  activityBox.innerText = w.message || 'Funcionário operando em segundo plano.';

  handleCountdown(w.nextDispatchTime);
}

function handleCountdown(nextTime) {
  const wrapper = document.getElementById('countdown-wrapper');
  const display = document.getElementById('countdown-display');

  if (countdownInterval) clearInterval(countdownInterval);

  if (!nextTime || Date.now() >= nextTime) {
    wrapper.style.display = 'none';
    return;
  }

  wrapper.style.display = 'block';

  function update() {
    const diff = Math.max(0, Math.round((nextTime - Date.now()) / 1000));
    if (diff <= 0) {
      wrapper.style.display = 'none';
      clearInterval(countdownInterval);
      return;
    }
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    display.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  update();
  countdownInterval = setInterval(update, 1000);
}

function updateWhatsAppUI() {
  const wa = state.whatsapp;
  const pill = document.getElementById('wa-state-pill');
  const statStatus = document.getElementById('stat-wa-status');
  const statPhone = document.getElementById('stat-wa-phone');
  const area = document.getElementById('wa-display-area');

  if (wa.state === 'CONNECTED') {
    pill.className = 'pill pill-active';
    pill.innerText = 'CONECTADO';
    statStatus.innerText = 'Ativo';
    statStatus.style.color = '#34d399';
    statPhone.innerText = `+${wa.connectedUser || 'Chip Conectado'}`;

    area.innerHTML = `
      <div class="wa-connected-box">
        <div class="wa-connected-phone">+${wa.connectedUser || ''}</div>
        <p class="text-muted">Funcionária IA conectada e pronta para operações.</p>
        <button class="btn btn-danger btn-sm mt-3" onclick="logoutWhatsApp()">Desconectar Chip</button>
      </div>
    `;
  } else if (wa.state === 'QR_READY' && wa.qrCode) {
    pill.className = 'pill pill-waiting';
    pill.innerText = 'LER QR CODE';
    statStatus.innerText = 'Aguardando Leitura';
    statStatus.style.color = '#fbbf24';
    statPhone.innerText = 'Escaneie abaixo';

    area.innerHTML = `
      <img src="${wa.qrCode}" class="qr-image" alt="QR Code WhatsApp" />
      <p class="qr-caption">Abra o WhatsApp > Aparelhos Conectados > Conectar Aparelho</p>
      <button class="btn btn-secondary btn-sm mt-2" onclick="reconnectWhatsApp()">Novo QR Code</button>
    `;
  } else {
    pill.className = 'pill pill-offline';
    pill.innerText = 'DESCONECTADO';
    statStatus.innerText = 'Desconectado';
    statStatus.style.color = '#94a3b8';
    statPhone.innerText = 'Iniciando módulo...';

    area.innerHTML = `
      <div class="qr-placeholder">
        <div class="spinner"></div>
        <p>Iniciando conexão local com WhatsApp...</p>
        <button class="btn btn-primary btn-sm mt-3" onclick="reconnectWhatsApp()">Gerar Conexão</button>
      </div>
    `;
  }
}

// --- 6. RENDERIZAÇÃO DA TABELA DE LEADS ---
function renderLeadsTable(leads) {
  const tbody = document.getElementById('leads-table-body');
  if (!leads || leads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Nenhum lead encontrado com os filtros selecionados.</td></tr>`;
    return;
  }

  tbody.innerHTML = leads.map(l => {
    const isHot = l.status === 'RESPONDIDO';
    const rowClass = isHot ? 'row-hot-lead' : '';

    // Prioridade e Score
    const score = l.priority_score || 50;
    let priorityBadge = `<span class="badge-tag tag-ok-site">Ouro (${score})</span>`;
    if (score < 80 && score >= 60) priorityBadge = `<span class="badge-tag tag-bad-site">Prata (${score})</span>`;
    if (score < 60) priorityBadge = `<span class="badge-tag" style="background:rgba(148,163,184,0.15); color:#94a3b8;">Bronze (${score})</span>`;

    // Status
    let statusBadge = '<span class="pill pill-offline">Pendente</span>';
    if (l.status === 'ENVIADO') statusBadge = '<span class="pill pill-active">Enviado</span>';
    if (l.status === 'RESPONDIDO') statusBadge = '<span class="pill" style="background:#2563eb; color:#fff;">Respondeu</span>';
    if (l.status === 'SEM_WHATSAPP') statusBadge = '<span class="pill" style="background:rgba(244,63,94,0.15); color:#fb7185;">Sem WhatsApp</span>';
    if (l.status === 'FALHA') statusBadge = '<span class="pill pill-paused">Falha</span>';

    // Diagnóstico
    let siteBadge = '<span class="badge-tag tag-no-site">Sem Site</span>';
    if (l.website_status === 'LENTO_RUIM') siteBadge = '<span class="badge-tag tag-bad-site">Site Lento / Instável</span>';
    if (l.website_status === 'SITE_OK') siteBadge = '<span class="badge-tag tag-ok-site">Site Operacional</span>';

    // Preço Sugerido por Porte
    const setup = l.price_setup || 50;
    const monthly = l.price_monthly || 20;
    const priceText = `R$ ${setup} + R$ ${monthly}/m`;

    return `
      <tr class="${rowClass}">
        <td>${priorityBadge}</td>
        <td>${statusBadge}</td>
        <td>
          <div class="lead-name">${escapeHtml(l.name)}</div>
          <span class="text-muted" style="font-size:0.75rem;">${escapeHtml(l.niche || '')} em ${escapeHtml(l.city || '')}</span>
        </td>
        <td>
          <a href="https://wa.me/${l.phone}" target="_blank" class="lead-phone">+${l.phone}</a>
        </td>
        <td>
          <span style="font-weight:700; color:#34d399; font-size:0.82rem;">${priceText}</span>
        </td>
        <td>${siteBadge}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm btn-secondary" onclick="openLeadPreview(${l.id})" title="Ver Mensagem">Ver Mensagem</button>
            ${l.showcase_url ? `<a href="${l.showcase_url}" target="_blank" class="btn btn-sm btn-outline" style="text-decoration:none;" title="Ver Vitrine Personalizada">Vitrine</a>` : ''}
            <button class="btn btn-sm btn-danger" onclick="deleteLead(${l.id})" title="Excluir">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// --- 7. EVENTOS E FORMULÁRIOS ---
function attachEventListeners() {
  // Filtros da Tabela
  document.getElementById('lead-status-filter').addEventListener('change', loadLeads);
  if (document.getElementById('lead-tier-filter')) {
    document.getElementById('lead-tier-filter').addEventListener('change', loadLeads);
  }
  document.getElementById('lead-search-input').addEventListener('input', debounce(loadLeads, 300));
  document.getElementById('btn-refresh-leads').addEventListener('click', loadLeads);

  // Pausar/Retomar
  document.getElementById('btn-toggle-pause').addEventListener('click', async () => {
    const newPause = !state.worker.manualPause;
    await fetch('/api/worker/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: newPause })
    });
  });

  // Minerar Manualmente Form
  document.getElementById('form-mine-manual').addEventListener('submit', async (e) => {
    e.preventDefault();
    const niche = document.getElementById('mine-niche').value;
    const city = document.getElementById('mine-city').value;
    const btn = document.getElementById('btn-start-mine');
    const resultBox = document.getElementById('mine-result-box');

    btn.disabled = true;
    btn.innerHTML = 'Buscando empresas e calculando scores...';
    resultBox.style.display = 'none';

    try {
      const res = await fetch('/api/worker/mine-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, city })
      });
      const data = await res.json();

      resultBox.style.display = 'block';
      resultBox.innerText = data.message || 'Busca concluída!';
      loadLeads();
      loadStatus();
    } catch (err) {
      alert('Erro na busca: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Iniciar Busca & Auditar Leads';
    }
  });

  // Minerar Lote Rápido no Dashboard
  document.getElementById('btn-quick-mine').addEventListener('click', async () => {
    appendLog('Iniciando ciclo rápido de mineração automática...', 'info');
    await fetch('/api/worker/mine-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
  });

  // Importar Contatos
  document.getElementById('form-import-leads').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = document.getElementById('import-text').value;
    const defaultNiche = document.getElementById('import-default-niche').value;
    const defaultCity = document.getElementById('import-default-city').value;

    if (!text.trim()) return alert('Cole ao menos 1 contato.');

    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, defaultNiche, defaultCity })
      });
      const data = await res.json();
      alert(`Sucesso! ${data.count} contatos importados e qualificados.`);
      document.getElementById('import-text').value = '';
      loadLeads();
      loadStatus();
    } catch (err) {
      alert('Erro na importação: ' + err.message);
    }
  });

  // Esvaziar Fila
  document.getElementById('btn-clear-queue').addEventListener('click', async () => {
    if (confirm('Tem certeza que deseja apagar todos os leads PENDENTES da fila?')) {
      await fetch('/api/leads/clear', { method: 'POST' });
      loadLeads();
      loadStatus();
    }
  });

  // Salvar Configurações
  document.getElementById('btn-save-config').addEventListener('click', saveConfig);

  // Limpar Logs
  document.getElementById('btn-clear-logs').addEventListener('click', () => {
    document.getElementById('live-terminal').innerHTML = '';
  });

  // Modais
  document.getElementById('btn-open-test-modal').addEventListener('click', () => {
    openModal('modal-test-send');
  });

  document.getElementById('btn-execute-test').addEventListener('click', async () => {
    const phone = document.getElementById('test-phone').value;
    const message = document.getElementById('test-message').value;
    if (!phone) return alert('Informe o número de telefone com DDD.');

    const btn = document.getElementById('btn-execute-test');
    btn.disabled = true;
    btn.innerText = 'Enviando...';

    try {
      const res = await fetch('/api/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message })
      });
      const data = await res.json();
      if (data.success) {
        alert('Mensagem enviada com sucesso! Verifique seu WhatsApp.');
        closeModal('modal-test-send');
      } else {
        alert('Erro: ' + (data.error || 'Falha no envio'));
      }
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerText = 'Enviar Teste';
    }
  });

  document.getElementById('btn-modal-dispatch').addEventListener('click', async () => {
    if (!state.activePreviewLeadId) return;
    const btn = document.getElementById('btn-modal-dispatch');
    const textarea = document.getElementById('modal-lead-text');
    const customMessage = textarea ? textarea.value : '';

    btn.disabled = true;
    btn.innerText = 'Disparando...';

    try {
      const res = await fetch(`/api/leads/dispatch/${state.activePreviewLeadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customMessage })
      });
      const data = await res.json();
      if (data.success) {
        alert('Disparo enviado com sucesso!');
        closeModal('modal-lead-preview');
        loadLeads();
        loadStatus();
      } else {
        alert('Erro: ' + (data.error || 'Falha no disparo'));
      }
    } catch (err) {
      alert('Erro ao disparar: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerText = 'Disparar Agora';
    }
  });
}

// --- 8. PREVIEW E EDIÇÃO DE LEAD ---
function openLeadPreview(leadId) {
  const lead = state.leads.find(l => l.id === leadId);
  if (!lead) return;

  state.activePreviewLeadId = leadId;
  const meta = document.getElementById('modal-lead-meta');
  const text = document.getElementById('modal-lead-text');
  const feedback = document.getElementById('modal-lead-feedback');
  if (feedback) feedback.style.display = 'none';

  meta.innerHTML = `
    <strong>Empresa:</strong> ${escapeHtml(lead.name)} | 
    <strong>WhatsApp:</strong> +${lead.phone} | 
    <strong>Nicho:</strong> ${escapeHtml(lead.niche || '')} | 
    <strong>Diagnóstico:</strong> ${lead.website_status || 'SEM_SITE'} | 
    <strong>Preço:</strong> R$ ${lead.price_setup || 50} + R$ ${lead.price_monthly || 20}/mês
  `;
  text.value = lead.generated_message || '';

  openModal('modal-lead-preview');
}

// Regerar nova variação inteligente da mensagem
async function regenerateActiveLeadPitch() {
  if (!state.activePreviewLeadId) return;
  const btn = document.getElementById('btn-modal-regen');
  const text = document.getElementById('modal-lead-text');
  const feedback = document.getElementById('modal-lead-feedback');

  btn.disabled = true;
  btn.innerText = 'Gerando variação...';

  try {
    const res = await fetch(`/api/leads/${state.activePreviewLeadId}/regenerate-pitch`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success && data.message) {
      text.value = data.message;
      
      // Atualiza no estado local
      const lead = state.leads.find(l => l.id === state.activePreviewLeadId);
      if (lead) lead.generated_message = data.message;

      if (feedback) {
        feedback.innerText = 'Nova variação contextual gerada com sucesso pelo motor inteligente!';
        feedback.style.display = 'block';
        setTimeout(() => { feedback.style.display = 'none'; }, 4000);
      }
    } else {
      alert('Erro ao regerar: ' + (data.error || 'Falha na resposta'));
    }
  } catch (e) {
    alert('Erro de conexão ao regerar: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerText = 'Regerar com IA';
  }
}

// Salvar texto editado manualmente
async function saveActiveLeadMessage() {
  if (!state.activePreviewLeadId) return;
  const text = document.getElementById('modal-lead-text');
  const btn = document.getElementById('btn-modal-save');
  const feedback = document.getElementById('modal-lead-feedback');
  const val = text.value.trim();

  if (!val) {
    alert('A mensagem não pode ficar vazia.');
    return;
  }

  btn.disabled = true;
  btn.innerText = 'Salvando...';

  try {
    const res = await fetch(`/api/leads/${state.activePreviewLeadId}/message`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: val })
    });
    const data = await res.json();
    if (data.success) {
      // Atualiza no estado local
      const lead = state.leads.find(l => l.id === state.activePreviewLeadId);
      if (lead) lead.generated_message = val;

      if (feedback) {
        feedback.innerText = 'Mensagem salva com sucesso no banco de dados!';
        feedback.style.display = 'block';
        setTimeout(() => { feedback.style.display = 'none'; }, 3000);
      }
    } else {
      alert('Erro ao salvar: ' + (data.error || 'Falha'));
    }
  } catch (e) {
    alert('Erro ao salvar: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerText = 'Salvar Alteração';
  }
}

async function deleteLead(id) {
  if (confirm('Excluir este lead?')) {
    await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    loadLeads();
    loadStatus();
  }
}

// --- 9. CONFIGURAÇÕES FORM ---
function fillConfigForm(cfg) {
  if (!cfg) return;
  document.getElementById('cfg-work-start').value = cfg.work_start || '09:00';
  document.getElementById('cfg-work-end').value = cfg.work_end || '18:00';
  document.getElementById('cfg-min-delay').value = cfg.min_delay_seconds || 240;
  document.getElementById('cfg-max-delay').value = cfg.max_delay_seconds || 480;
  document.getElementById('cfg-daily-limit').value = cfg.daily_limit || 40;
  document.getElementById('cfg-auto-pilot').checked = !!cfg.auto_pilot;
  document.getElementById('cfg-personal-whatsapp').value = cfg.personal_whatsapp || '';
  if (document.getElementById('cfg-portfolio-url')) {
    document.getElementById('cfg-portfolio-url').value = cfg.portfolio_base_url || 'http://localhost:3001/vitrine/';
  }
  document.getElementById('cfg-target-niches').value = cfg.target_niches || '';
  document.getElementById('cfg-target-cities').value = cfg.target_cities || '';
  document.getElementById('cfg-pitch-no-site').value = cfg.custom_pitch_no_site || '';
  document.getElementById('cfg-pitch-bad-site').value = cfg.custom_pitch_bad_site || '';
  document.getElementById('cfg-pitch-has-site').value = cfg.custom_pitch_has_site || '';
}

async function saveConfig() {
  const payload = {
    work_start: document.getElementById('cfg-work-start').value,
    work_end: document.getElementById('cfg-work-end').value,
    min_delay_seconds: parseInt(document.getElementById('cfg-min-delay').value),
    max_delay_seconds: parseInt(document.getElementById('cfg-max-delay').value),
    daily_limit: parseInt(document.getElementById('cfg-daily-limit').value),
    auto_pilot: document.getElementById('cfg-auto-pilot').checked ? 1 : 0,
    personal_whatsapp: document.getElementById('cfg-personal-whatsapp').value,
    portfolio_base_url: document.getElementById('cfg-portfolio-url') ? document.getElementById('cfg-portfolio-url').value : 'http://localhost:3001/vitrine/',
    target_niches: document.getElementById('cfg-target-niches').value,
    target_cities: document.getElementById('cfg-target-cities').value,
    custom_pitch_no_site: document.getElementById('cfg-pitch-no-site').value,
    custom_pitch_bad_site: document.getElementById('cfg-pitch-bad-site').value,
    custom_pitch_has_site: document.getElementById('cfg-pitch-has-site').value
  };

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('Configurações salvas com sucesso!');
      loadConfig();
    }
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  }
}

// --- 10. WHATSAPP AÇÕES ---
async function logoutWhatsApp() {
  if (confirm('Deseja realmente desconectar o chip do WhatsApp?')) {
    await fetch('/api/whatsapp/logout', { method: 'POST' });
  }
}

async function reconnectWhatsApp() {
  await fetch('/api/whatsapp/reconnect', { method: 'POST' });
}

// --- UTILS ---
function appendLog(text, level = 'info') {
  const terminal = document.getElementById('live-terminal');
  const line = document.createElement('div');
  line.className = `log-line ${level}`;
  line.innerText = text;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
