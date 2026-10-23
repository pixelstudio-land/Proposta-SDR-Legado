/**
 * ==============================================================================
 * LEGADO SDR ENGINE - CLIENT DASHBOARD LOGIC (VANILLA JS)
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Estado local da aplicação
  let allLeads = [];
  let pollInterval = null;

  // Elementos do DOM - KPIs
  const valTotalLeads = document.getElementById('valTotalLeads');
  const valNewLeads = document.getElementById('valNewLeads');
  const valInQualLeads = document.getElementById('valInQualLeads');
  const valQualifiedLeads = document.getElementById('valQualifiedLeads');
  const valLandline = document.getElementById('valLandline');
  const valMobile = document.getElementById('valMobile');
  const valAccounts = document.getElementById('valAccounts');
  const valAccountsDetail = document.getElementById('valAccountsDetail');
  const valSentToday = document.getElementById('valSentToday');

  // Elementos do DOM - Minerador
  const formMiner = document.getElementById('formMiner');
  const minerQuery = document.getElementById('minerQuery');
  const minerLimit = document.getElementById('minerLimit');
  const btnRunMiner = document.getElementById('btnRunMiner');
  const minerSpinner = document.getElementById('minerSpinner');
  const minerBtnText = document.getElementById('minerBtnText');
  const minerStatusTag = document.getElementById('minerStatusTag');
  const minerFeedback = document.getElementById('minerFeedback');
  const exportsList = document.getElementById('exportsList');
  const btnRefreshExports = document.getElementById('btnRefreshExports');

  // Elementos do DOM - Outbound
  const formOutbound = document.getElementById('formOutbound');
  const outboundTarget = document.getElementById('outboundTarget');
  const outboundLimit = document.getElementById('outboundLimit');
  const btnRunOutbound = document.getElementById('btnRunOutbound');
  const outboundSpinner = document.getElementById('outboundSpinner');
  const outboundBtnText = document.getElementById('outboundBtnText');
  const outboundStatusTag = document.getElementById('outboundStatusTag');
  const outboundFeedback = document.getElementById('outboundFeedback');

  // Elementos do DOM - Tabela de Leads & Filtros
  const leadsTableBody = document.getElementById('leadsTableBody');
  const tableCounter = document.getElementById('tableCounter');
  const filterSearch = document.getElementById('filterSearch');
  const filterSource = document.getElementById('filterSource');
  const filterStatus = document.getElementById('filterStatus');
  const btnRefreshAll = document.getElementById('btnRefreshAll');

  // Elementos do DOM - Modal
  const leadModal = document.getElementById('leadModal');
  const modalClose = document.getElementById('modalClose');
  const modalBtnClose = document.getElementById('modalBtnClose');
  const modalCompanyName = document.getElementById('modalCompanyName');
  const modalIdentifier = document.getElementById('modalIdentifier');
  const modalPhone = document.getElementById('modalPhone');
  const modalPhoneType = document.getElementById('modalPhoneType');
  const modalNiche = document.getElementById('modalNiche');
  const modalRevenue = document.getElementById('modalRevenue');
  const modalSummary = document.getElementById('modalSummary');
  const modalChatHistory = document.getElementById('modalChatHistory');

  // ============================================================================
  // 1. CARREGAMENTO DE ESTATÍSTICAS E KPIS
  // ============================================================================
  async function loadStats() {
    try {
      const res = await fetch('/api/dashboard/stats');
      const data = await res.json();
      if (!data.success) return;

      const s = data.stats;
      valTotalLeads.textContent = s.totalLeads ?? 0;
      valNewLeads.textContent = `${s.newCount ?? 0} novos`;
      valInQualLeads.textContent = `${s.inQualificationCount ?? 0} em triagem`;
      valQualifiedLeads.textContent = s.qualifiedLeads ?? 0;
      valLandline.textContent = s.landlineCount ?? 0;
      valMobile.textContent = s.mobileCount ?? 0;
      valAccounts.textContent = s.totalAccounts ?? 0;
      valAccountsDetail.textContent = `${s.scrapersCount ?? 0} Scrapers • ${s.sendersCount ?? 0} Senders`;
      valSentToday.textContent = s.sentToday ?? 0;

      // Atualiza status do minerador
      if (s.miner) {
        updateMinerUiStatus(s.miner);
      }

      // Atualiza status do outbound
      if (s.outbound) {
        updateOutboundUiStatus(s.outbound);
      }

    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    }
  }

  function updateMinerUiStatus(state) {
    if (state.status === 'running') {
      minerStatusTag.className = 'badge-status running';
      minerStatusTag.textContent = 'Minerando...';
      btnRunMiner.disabled = true;
      minerSpinner.classList.remove('hidden');
      minerBtnText.textContent = 'Processando no Maps...';
      minerFeedback.textContent = `Varrendo "${state.query}"...`;
      minerFeedback.className = 'action-feedback';
    } else if (state.status === 'completed') {
      minerStatusTag.className = 'badge-status completed';
      minerStatusTag.textContent = 'Concluído';
      btnRunMiner.disabled = false;
      minerSpinner.classList.add('hidden');
      minerBtnText.textContent = '⚡ Minerar no Google Maps';
      if (state.lastResult) {
        minerFeedback.textContent = `✅ ${state.lastResult.total} empresas mineradas com sucesso!`;
        minerFeedback.className = 'action-feedback success';
      }
    } else if (state.status === 'error') {
      minerStatusTag.className = 'badge-status error';
      minerStatusTag.textContent = 'Erro';
      btnRunMiner.disabled = false;
      minerSpinner.classList.add('hidden');
      minerBtnText.textContent = '⚡ Tentar Novamente';
      minerFeedback.textContent = `❌ ${state.error || 'Falha na extração'}`;
      minerFeedback.className = 'action-feedback error';
    } else {
      minerStatusTag.className = 'badge-status idle';
      minerStatusTag.textContent = 'Pronto';
      btnRunMiner.disabled = false;
      minerSpinner.classList.add('hidden');
      minerBtnText.textContent = '⚡ Minerar no Google Maps';
    }
  }

  function updateOutboundUiStatus(state) {
    if (state.status === 'running') {
      outboundStatusTag.className = 'badge-status running';
      outboundStatusTag.textContent = 'Disparando...';
      btnRunOutbound.disabled = true;
      outboundSpinner.classList.remove('hidden');
      outboundBtnText.textContent = 'Executando Outbound...';
      outboundFeedback.textContent = `Auditoria e envio em andamento...`;
      outboundFeedback.className = 'action-feedback';
    } else if (state.status === 'completed') {
      outboundStatusTag.className = 'badge-status completed';
      outboundStatusTag.textContent = 'Concluído';
      btnRunOutbound.disabled = false;
      outboundSpinner.classList.add('hidden');
      outboundBtnText.textContent = '🎯 Iniciar Disparo Outbound';
      outboundFeedback.textContent = '✅ Disparos humanizados finalizados.';
      outboundFeedback.className = 'action-feedback success';
    } else if (state.status === 'error') {
      outboundStatusTag.className = 'badge-status error';
      outboundStatusTag.textContent = 'Erro';
      btnRunOutbound.disabled = false;
      outboundSpinner.classList.add('hidden');
      outboundBtnText.textContent = '🎯 Iniciar Disparo Outbound';
      outboundFeedback.textContent = `❌ ${state.error || 'Falha no outbound'}`;
      outboundFeedback.className = 'action-feedback error';
    } else {
      outboundStatusTag.className = 'badge-status idle';
      outboundStatusTag.textContent = 'Pronto';
      btnRunOutbound.disabled = false;
      outboundSpinner.classList.add('hidden');
      outboundBtnText.textContent = '🎯 Iniciar Disparo Outbound';
    }
  }

  // ============================================================================
  // 2. CARREGAMENTO E RENDERIZAÇÃO DE LEADS
  // ============================================================================
  async function loadLeads() {
    try {
      const res = await fetch('/api/dashboard/leads');
      const data = await res.json();
      if (!data.success) {
        leadsTableBody.innerHTML = `<tr><td colspan="8" class="table-empty">Erro ao carregar leads: ${data.error}</td></tr>`;
        return;
      }

      allLeads = data.leads || [];
      renderLeadsTable();
    } catch (err) {
      console.error('Erro ao buscar leads:', err);
      leadsTableBody.innerHTML = `<tr><td colspan="8" class="table-empty">Falha na conexão com o servidor.</td></tr>`;
    }
  }

  function renderLeadsTable() {
    const searchTerm = (filterSearch.value || '').toLowerCase().trim();
    const sourceFilter = filterSource.value;
    const statusFilter = filterStatus.value;

    const filtered = allLeads.filter(lead => {
      // Filtro de texto
      if (searchTerm) {
        const textToSearch = [
          lead.name,
          lead.company_name,
          lead.phone,
          lead.niche,
          lead.identifier,
          lead.ai_summary
        ].filter(Boolean).join(' ').toLowerCase();

        if (!textToSearch.includes(searchTerm)) return false;
      }

      // Filtro de Origem
      if (sourceFilter !== 'all' && lead.source !== sourceFilter) {
        return false;
      }

      // Filtro de Status
      if (statusFilter !== 'all' && lead.status !== statusFilter) {
        return false;
      }

      return true;
    });

    tableCounter.textContent = `${filtered.length} leads`;

    if (filtered.length === 0) {
      leadsTableBody.innerHTML = `<tr><td colspan="8" class="table-empty">Nenhum lead encontrado para os filtros selecionados.</td></tr>`;
      return;
    }

    leadsTableBody.innerHTML = filtered.map((lead, idx) => {
      // Formatação do telefone e tipo
      let phoneBadge = '<span class="text-dim">Sem telefone</span>';
      if (lead.phone) {
        const isLandline = lead.phone_type === 'landline';
        const typeLabel = isLandline ? '📞 Fixo Comercial' : '📱 Celular';
        const typeClass = isLandline ? 'landline' : 'mobile';
        phoneBadge = `
          <div>
            <div style="font-family: var(--font-mono); font-weight: 600;">${lead.phone}</div>
            <span class="badge-phone ${typeClass}">${typeLabel}</span>
          </div>
        `;
      }

      // WhatsApp badge
      const waBadge = lead.is_whatsapp_active
        ? '<span class="badge-wa active">🟢 SIM</span>'
        : '<span class="badge-wa inactive">⚪ NÃO</span>';

      // Avaliação Google
      let ratingDisplay = '<span class="text-dim">S/N</span>';
      if (lead.ai_summary && lead.ai_summary.includes('Avaliação:')) {
        const match = lead.ai_summary.match(/Avaliação:\s*([^|]+)/i);
        if (match && match[1]) {
          ratingDisplay = `<span class="rating-display">⭐ ${match[1].trim()}</span>`;
        }
      }

      // Origem
      let sourceBadge = `<span class="badge-source">${lead.source}</span>`;
      if (lead.source === 'miner_gmn') {
        sourceBadge = '<span class="badge-source gmn">🗺️ Google Maps</span>';
      } else if (lead.source === 'outbound_instagram') {
        sourceBadge = '<span class="badge-source insta">📸 Instagram</span>';
      } else if (lead.source === 'inbound_official') {
        sourceBadge = '<span class="badge-source inbound">💬 Inbound Direct</span>';
      }

      // Status
      let statusClass = 'new';
      let statusText = 'Novo';
      if (lead.status === 'qualified') {
        statusClass = 'qualified';
        statusText = '⭐ Qualificado (ICP)';
      } else if (lead.status === 'in_qualification') {
        statusClass = 'in_qualification';
        statusText = '⏳ Em Triagem';
      } else if (lead.status === 'disqualified') {
        statusClass = 'disqualified';
        statusText = '🚫 Desqualificado';
      }

      const statusBadge = `<span class="badge-lead-status ${statusClass}">${statusText}</span>`;

      return `
        <tr data-lead-id="${lead.id}">
          <td style="color: var(--text-dim); font-family: var(--font-mono);">${idx + 1}</td>
          <td>
            <div style="font-weight: 700; color: #fff;">${escapeHtml(lead.company_name || lead.name || 'Empresa')}</div>
            <div style="font-size: 0.76rem; color: var(--text-dim);">${escapeHtml(lead.identifier || '')}</div>
          </td>
          <td>${phoneBadge}</td>
          <td>${waBadge}</td>
          <td>${ratingDisplay}</td>
          <td>${sourceBadge}</td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm btn-open-modal" data-lead-id="${lead.id}">
              👁️ Dossiê
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Adiciona listener nos botões de modal
    document.querySelectorAll('.btn-open-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        const leadId = btn.getAttribute('data-lead-id');
        openLeadModal(leadId);
      });
    });
  }

  // ============================================================================
  // 3. CARREGAMENTO DE EXPORTS (.XLSX)
  // ============================================================================
  async function loadExports() {
    try {
      const res = await fetch('/api/dashboard/exports');
      const data = await res.json();
      if (!data.success || !data.files || data.files.length === 0) {
        exportsList.innerHTML = `<div class="empty-state">Nenhuma planilha gerada ainda.</div>`;
        return;
      }

      exportsList.innerHTML = data.files.map(file => {
        const formattedDate = new Date(file.createdAt).toLocaleString('pt-BR');
        return `
          <div class="export-item">
            <div class="export-info">
              <span class="export-name">${escapeHtml(file.name)}</span>
              <span class="export-meta">${file.sizeFormatted} • Criado em ${formattedDate}</span>
            </div>
            <a href="${file.downloadUrl}" class="btn btn-secondary btn-sm" download>
              📥 Baixar
            </a>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('Erro ao carregar exports:', err);
      exportsList.innerHTML = `<div class="empty-state">Erro ao listar planilhas.</div>`;
    }
  }

  // ============================================================================
  // 4. SUBMISSÃO DE MINERAÇÃO NO GOOGLE MAPS
  // ============================================================================
  formMiner.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = minerQuery.value.trim();
    const limit = minerLimit.value;

    if (!query) return;

    btnRunMiner.disabled = true;
    minerSpinner.classList.remove('hidden');
    minerBtnText.textContent = 'Iniciando extração...';
    minerFeedback.textContent = 'Enviando comando para o robô...';
    minerFeedback.className = 'action-feedback';

    try {
      const res = await fetch('/api/dashboard/miner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        minerFeedback.textContent = `❌ ${data.error || 'Erro ao iniciar mineração'}`;
        minerFeedback.className = 'action-feedback error';
        btnRunMiner.disabled = false;
        minerSpinner.classList.add('hidden');
        minerBtnText.textContent = '⚡ Minerar no Google Maps';
        return;
      }

      minerFeedback.textContent = '🚀 Robô iniciado! Monitorando em tempo real...';
      minerFeedback.className = 'action-feedback success';

      // Inicia polling para acompanhar término
      startProgressPolling();

    } catch (err) {
      minerFeedback.textContent = `❌ Falha de rede: ${err.message}`;
      minerFeedback.className = 'action-feedback error';
      btnRunMiner.disabled = false;
      minerSpinner.classList.add('hidden');
      minerBtnText.textContent = '⚡ Minerar no Google Maps';
    }
  });

  // ============================================================================
  // 5. SUBMISSÃO DE OUTBOUND INSTAGRAM
  // ============================================================================
  formOutbound.addEventListener('submit', async (e) => {
    e.preventDefault();
    const target = outboundTarget.value.trim();
    const limit = outboundLimit.value;

    btnRunOutbound.disabled = true;
    outboundSpinner.classList.remove('hidden');
    outboundBtnText.textContent = 'Iniciando disparo...';
    outboundFeedback.textContent = 'Disparando robô Outbound...';
    outboundFeedback.className = 'action-feedback';

    try {
      const res = await fetch('/api/dashboard/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, limit })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        outboundFeedback.textContent = `❌ ${data.error || 'Erro ao iniciar Outbound'}`;
        outboundFeedback.className = 'action-feedback error';
        btnRunOutbound.disabled = false;
        outboundSpinner.classList.add('hidden');
        outboundBtnText.textContent = '🎯 Iniciar Disparo Outbound';
        return;
      }

      outboundFeedback.textContent = '🚀 Robô Outbound ativo! Monitorando rodízio...';
      outboundFeedback.className = 'action-feedback success';

      startProgressPolling();

    } catch (err) {
      outboundFeedback.textContent = `❌ Falha de rede: ${err.message}`;
      outboundFeedback.className = 'action-feedback error';
      btnRunOutbound.disabled = false;
      outboundSpinner.classList.add('hidden');
      outboundBtnText.textContent = '🎯 Iniciar Disparo Outbound';
    }
  });

  // ============================================================================
  // 6. MODAL DO LEAD (DOSSIÊ & CHAT DA IA)
  // ============================================================================
  async function openLeadModal(leadId) {
    leadModal.classList.remove('hidden');
    modalCompanyName.textContent = 'Carregando...';
    modalIdentifier.textContent = '';
    modalPhone.textContent = '-';
    modalPhoneType.textContent = '-';
    modalNiche.textContent = '-';
    modalRevenue.textContent = '-';
    modalSummary.textContent = '-';
    modalChatHistory.innerHTML = `<div class="chat-loading">Resgatando histórico no SQLite WAL...</div>`;

    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/history`);
      const data = await res.json();

      if (!data.success || !data.lead) {
        modalCompanyName.textContent = 'Erro ao carregar';
        modalChatHistory.innerHTML = `<div class="chat-empty">Lead não encontrado no banco.</div>`;
        return;
      }

      const lead = data.lead;
      modalCompanyName.textContent = lead.company_name || lead.name || 'Lead Sem Nome';
      modalIdentifier.textContent = lead.identifier || '';
      modalPhone.textContent = lead.phone || 'Sem telefone';
      modalPhoneType.textContent = lead.phone_type === 'landline' ? 'Fixo Comercial (B2B)' : (lead.phone_type === 'mobile' ? 'Celular Móvel' : 'Não classificado');
      modalNiche.textContent = lead.niche || 'Geral';
      modalRevenue.textContent = lead.revenue_range || 'Não declarado';
      modalSummary.textContent = lead.ai_summary || 'Sem resumo cadastrado';

      // Renderiza histórico de chat
      const history = data.history || [];
      if (history.length === 0) {
        modalChatHistory.innerHTML = `
          <div class="chat-empty">
            ℹ️ Nenhuma conversa de chat iniciada ainda.<br>
            <span style="font-size: 0.78rem; color: var(--text-muted);">
              Lead proveniente de <strong>${lead.source}</strong> cadastrado e pronto para abordagem ativa.
            </span>
          </div>
        `;
      } else {
        modalChatHistory.innerHTML = history.map(msg => {
          const isAssistant = msg.role === 'assistant';
          const author = isAssistant ? '🤖 Amanda (SDR IA)' : '👤 Lead';
          const time = new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          return `
            <div class="chat-bubble ${isAssistant ? 'assistant' : 'user'}">
              <span class="bubble-author">${author}</span>
              <span class="bubble-content">${escapeHtml(msg.content)}</span>
              <span class="bubble-time">${time}</span>
            </div>
          `;
        }).join('');
      }

    } catch (err) {
      console.error('Erro ao abrir modal do lead:', err);
      modalCompanyName.textContent = 'Erro de Conexão';
      modalChatHistory.innerHTML = `<div class="chat-empty">Falha ao resgatar histórico.</div>`;
    }
  }

  function closeLeadModal() {
    leadModal.classList.add('hidden');
  }

  modalClose.addEventListener('click', closeLeadModal);
  modalBtnClose.addEventListener('click', closeLeadModal);
  leadModal.addEventListener('click', (e) => {
    if (e.target === leadModal) closeLeadModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !leadModal.classList.contains('hidden')) {
      closeLeadModal();
    }
  });

  // ============================================================================
  // 7. POLLING & ATUALIZAÇÕES PERIÓDICAS
  // ============================================================================
  function startProgressPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      await loadStats();
      await loadLeads();
      await loadExports();
    }, 3000);
  }

  // Filtros dinâmicos da tabela
  filterSearch.addEventListener('input', renderLeadsTable);
  filterSource.addEventListener('change', renderLeadsTable);
  filterStatus.addEventListener('change', renderLeadsTable);

  // Botões de refresh manual
  btnRefreshAll.addEventListener('click', async () => {
    btnRefreshAll.style.opacity = '0.5';
    await loadStats();
    await loadLeads();
    await loadExports();
    btnRefreshAll.style.opacity = '1';
  });

  btnRefreshExports.addEventListener('click', loadExports);

  // Utilitário para evitar XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Inicialização no carregamento
  loadStats();
  loadLeads();
  loadExports();

  // Heartbeat a cada 15 segundos para atualizar stats
  setInterval(loadStats, 15000);
});
