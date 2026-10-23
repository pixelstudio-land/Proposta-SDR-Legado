/**
 * ==============================================================================
 * LEGADO SDR ENGINE — CLIENT DASHBOARD LOGIC (SHADCN / LINEAR DARK UI)
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Estado local
  let allLeads = [];
  let pollInterval = null;

  // Iconografia SVG Inline Oficial (Lucide Style - Strict Zero Emojis)
  const icons = {
    star: `<svg class="icon-star-gold" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    landline: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    mobile: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`,
    download: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
    eye: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    file: `<svg class="file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`,
    check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    mapPin: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`,
    instagram: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>`,
    message: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    user: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    bot: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M12 8V4H8"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`,
    trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
    login: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>`
  };

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
  const kpiAccountsCard = document.getElementById('kpiAccountsCard');
  const btnOpenSettings = document.getElementById('btnOpenSettings');

  // Elementos do DOM - Minerador
  const formMiner = document.getElementById('formMiner');
  const minerQuery = document.getElementById('minerQuery');
  const minerLimit = document.getElementById('minerLimit');
  const btnRunMiner = document.getElementById('btnRunMiner');
  const minerSpinner = document.getElementById('minerSpinner');
  const minerBtnIcon = document.getElementById('minerBtnIcon');
  const minerBtnText = document.getElementById('minerBtnText');
  const minerStatusTag = document.getElementById('minerStatusTag');
  const minerFeedback = document.getElementById('minerFeedback');
  const exportsList = document.getElementById('exportsList');
  const btnRefreshExports = document.getElementById('btnRefreshExports');
  const minerConsoleLines = document.getElementById('minerConsoleLines');
  const minerConsoleStatus = document.getElementById('minerConsoleStatus');

  // Elementos do DOM - Outbound
  const formOutbound = document.getElementById('formOutbound');
  const outboundTarget = document.getElementById('outboundTarget');
  const outboundLimit = document.getElementById('outboundLimit');
  const btnRunOutbound = document.getElementById('btnRunOutbound');
  const outboundSpinner = document.getElementById('outboundSpinner');
  const outboundBtnIcon = document.getElementById('outboundBtnIcon');
  const outboundBtnText = document.getElementById('outboundBtnText');
  const outboundStatusTag = document.getElementById('outboundStatusTag');
  const outboundFeedback = document.getElementById('outboundFeedback');
  const outboundErrorBanner = document.getElementById('outboundErrorBanner');
  const outboundErrorMessage = document.getElementById('outboundErrorMessage');
  const btnErrorOpenSettings = document.getElementById('btnErrorOpenSettings');
  const outboundConsoleLines = document.getElementById('outboundConsoleLines');
  const outboundConsoleStatus = document.getElementById('outboundConsoleStatus');

  // Elementos do DOM - Tabela de Leads & Filtros
  const leadsTableBody = document.getElementById('leadsTableBody');
  const tableCounter = document.getElementById('tableCounter');
  const filterSearch = document.getElementById('filterSearch');
  const filterSource = document.getElementById('filterSource');
  const filterStatus = document.getElementById('filterStatus');
  const btnRefreshAll = document.getElementById('btnRefreshAll');

  // Elementos do DOM - Modal do Lead
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

  // Elementos do DOM - Modal de Configurações & Conexões
  const settingsModal = document.getElementById('settingsModal');
  const settingsModalClose = document.getElementById('settingsModalClose');
  const settingsModalBtnClose = document.getElementById('settingsModalBtnClose');
  const btnTabAccounts = document.getElementById('btnTabAccounts');
  const btnTabApis = document.getElementById('btnTabApis');
  const tabAccountsContent = document.getElementById('tabAccountsContent');
  const tabApisContent = document.getElementById('tabApisContent');

  // Aba 1: Contas
  const formAddAccount = document.getElementById('formAddAccount');
  const accUsername = document.getElementById('accUsername');
  const accPassword = document.getElementById('accPassword');
  const accRole = document.getElementById('accRole');
  const accLimit = document.getElementById('accLimit');
  const accProxy = document.getElementById('accProxy');
  const btnAddAccount = document.getElementById('btnAddAccount');
  const addAccountFeedback = document.getElementById('addAccountFeedback');
  const accountsTableBody = document.getElementById('accountsTableBody');
  const accountsBadgeCount = document.getElementById('accountsBadgeCount');
  const btnRefreshAccounts = document.getElementById('btnRefreshAccounts');

  // Aba 2: APIs
  const formApiSettings = document.getElementById('formApiSettings');
  const cfgOpenAiKey = document.getElementById('cfgOpenAiKey');
  const cfgWaUrl = document.getElementById('cfgWaUrl');
  const cfgWaKey = document.getElementById('cfgWaKey');
  const cfgWaInstance = document.getElementById('cfgWaInstance');
  const cfgSdrPhone = document.getElementById('cfgSdrPhone');
  const cfgCrmWebhook = document.getElementById('cfgCrmWebhook');
  const btnSaveConfig = document.getElementById('btnSaveConfig');
  const configFeedback = document.getElementById('configFeedback');
  const btnValidateLeadsWa = document.getElementById('btnValidateLeadsWa');
  const waValidationFeedback = document.getElementById('waValidationFeedback');

  // ============================================================================
  // FUNÇÃO DE FORMATAÇÃO DE TELEFONE (MÁSCARA BRASIL E.164)
  // ============================================================================
  function formatPhoneBR(raw) {
    if (!raw) return 'Não informado';
    const digits = String(raw).replace(/\D/g, '');

    // Formato internacional com DDI 55
    if (digits.startsWith('55')) {
      const rest = digits.slice(2);
      if (rest.length === 10) {
        return `(${rest.slice(0, 2)}) ${rest.slice(2, 6)}-${rest.slice(6)}`;
      }
      if (rest.length === 11) {
        return `(${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7)}`;
      }
    }

    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    return raw;
  }

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
      valInQualLeads.textContent = `${s.inQualificationCount ?? 0} triagem`;
      valQualifiedLeads.textContent = s.qualifiedLeads ?? 0;
      valLandline.textContent = s.landlineCount ?? 0;
      valMobile.textContent = s.mobileCount ?? 0;
      valAccounts.textContent = s.totalAccounts ?? 0;
      valAccountsDetail.textContent = `${s.scrapersCount ?? 0} Scrapers • ${s.sendersCount ?? 0} Senders`;
      valSentToday.textContent = s.sentToday ?? 0;

      if (s.miner) updateMinerUiStatus(s.miner);
      if (s.outbound) updateOutboundUiStatus(s.outbound);

    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    }
  }

  function updateMinerUiStatus(state) {
    if (state.status === 'running') {
      minerStatusTag.className = 'status-pill running';
      minerStatusTag.textContent = 'Em Execução';
      if (minerConsoleStatus) minerConsoleStatus.textContent = 'RUNNING';
      btnRunMiner.disabled = true;
      minerSpinner.classList.remove('hidden');
      if (minerBtnIcon) minerBtnIcon.classList.add('hidden');
      minerBtnText.textContent = 'Processando no Maps...';
      minerFeedback.textContent = `Varrendo "${state.query}"...`;
      minerFeedback.className = 'feedback-text';
    } else if (state.status === 'completed') {
      minerStatusTag.className = 'status-pill completed';
      minerStatusTag.textContent = 'Concluído';
      if (minerConsoleStatus) minerConsoleStatus.textContent = 'IDLE';
      btnRunMiner.disabled = false;
      minerSpinner.classList.add('hidden');
      if (minerBtnIcon) minerBtnIcon.classList.remove('hidden');
      minerBtnText.textContent = 'Iniciar Mineração no Maps';
      if (state.lastResult) {
        minerFeedback.textContent = `Sucesso: ${state.lastResult.total} empresas mineradas.`;
        minerFeedback.className = 'feedback-text success';
      }
    } else if (state.status === 'error') {
      minerStatusTag.className = 'status-pill error';
      minerStatusTag.textContent = 'Falha';
      if (minerConsoleStatus) minerConsoleStatus.textContent = 'ERROR';
      btnRunMiner.disabled = false;
      minerSpinner.classList.add('hidden');
      if (minerBtnIcon) minerBtnIcon.classList.remove('hidden');
      minerBtnText.textContent = 'Tentar Novamente';
      minerFeedback.textContent = `Erro: ${state.error || 'Falha na extração'}`;
      minerFeedback.className = 'feedback-text error';
    } else {
      minerStatusTag.className = 'status-pill idle';
      minerStatusTag.textContent = 'Pronto';
      if (minerConsoleStatus) minerConsoleStatus.textContent = 'IDLE';
      btnRunMiner.disabled = false;
      minerSpinner.classList.add('hidden');
      if (minerBtnIcon) minerBtnIcon.classList.remove('hidden');
      minerBtnText.textContent = 'Iniciar Mineração no Maps';
    }
  }

  function updateOutboundUiStatus(state) {
    if (state.status === 'running') {
      outboundStatusTag.className = 'status-pill running';
      outboundStatusTag.textContent = 'Disparando';
      if (outboundConsoleStatus) outboundConsoleStatus.textContent = 'RUNNING';
      btnRunOutbound.disabled = true;
      outboundSpinner.classList.remove('hidden');
      if (outboundBtnIcon) outboundBtnIcon.classList.add('hidden');
      outboundBtnText.textContent = 'Disparando DMs...';
      outboundFeedback.textContent = `Auditoria e envio em andamento...`;
      outboundFeedback.className = 'feedback-text';
    } else if (state.status === 'completed') {
      outboundStatusTag.className = 'status-pill completed';
      outboundStatusTag.textContent = 'Concluído';
      if (outboundConsoleStatus) outboundConsoleStatus.textContent = 'IDLE';
      btnRunOutbound.disabled = false;
      outboundSpinner.classList.add('hidden');
      if (outboundBtnIcon) outboundBtnIcon.classList.remove('hidden');
      outboundBtnText.textContent = 'Disparar Outbound com IA';
      outboundFeedback.textContent = 'Disparos humanizados finalizados.';
      outboundFeedback.className = 'feedback-text success';
    } else if (state.status === 'error') {
      outboundStatusTag.className = 'status-pill error';
      outboundStatusTag.textContent = 'Falha';
      if (outboundConsoleStatus) outboundConsoleStatus.textContent = 'ERROR';
      btnRunOutbound.disabled = false;
      outboundSpinner.classList.add('hidden');
      if (outboundBtnIcon) outboundBtnIcon.classList.remove('hidden');
      outboundBtnText.textContent = 'Disparar Outbound com IA';
      outboundFeedback.textContent = `Erro: ${state.error || 'Falha no outbound'}`;
      outboundFeedback.className = 'feedback-text error';
    } else {
      outboundStatusTag.className = 'status-pill idle';
      outboundStatusTag.textContent = 'Pronto';
      if (outboundConsoleStatus) outboundConsoleStatus.textContent = 'IDLE';
      btnRunOutbound.disabled = false;
      outboundSpinner.classList.add('hidden');
      if (outboundBtnIcon) outboundBtnIcon.classList.remove('hidden');
      outboundBtnText.textContent = 'Disparar Outbound com IA';
    }
  }

  // ============================================================================
  // 2. CARREGAMENTO E RENDERIZAÇÃO DA TABELA DE LEADS
  // ============================================================================
  async function loadLeads() {
    try {
      const res = await fetch('/api/dashboard/leads');
      const data = await res.json();
      if (!data.success) {
        leadsTableBody.innerHTML = `<tr><td colspan="8" class="table-msg">Erro ao carregar leads: ${data.error}</td></tr>`;
        return;
      }

      allLeads = data.leads || [];
      renderLeadsTable();
    } catch (err) {
      console.error('Erro ao buscar leads:', err);
      leadsTableBody.innerHTML = `<tr><td colspan="8" class="table-msg">Falha na conexão com o servidor.</td></tr>`;
    }
  }

  function renderLeadsTable() {
    const searchTerm = (filterSearch.value || '').toLowerCase().trim();
    const sourceFilter = filterSource.value;
    const statusFilter = filterStatus.value;

    const filtered = allLeads.filter(lead => {
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

      if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false;
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false;

      return true;
    });

    tableCounter.textContent = `${filtered.length} registros`;

    if (filtered.length === 0) {
      leadsTableBody.innerHTML = `<tr><td colspan="8" class="table-msg">Nenhum registro encontrado para os critérios selecionados.</td></tr>`;
      return;
    }

    leadsTableBody.innerHTML = filtered.map((lead, idx) => {
      // 1. Telefone Formatado com Máscara e Badge
      let phoneDisplay = '<span style="color: var(--text-subtle);">Sem telefone</span>';
      if (lead.phone) {
        const formatted = formatPhoneBR(lead.phone);
        const isLandline = lead.phone_type === 'landline';
        const typeClass = isLandline ? 'phone-landline' : 'phone-mobile';
        const typeIcon = isLandline ? icons.landline : icons.mobile;
        const typeLabel = isLandline ? 'Fixo Comercial' : 'Celular';

        phoneDisplay = `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span class="font-mono" style="font-weight: 500; font-size: 0.85rem;">${formatted}</span>
            <span class="badge-ui ${typeClass}">
              ${typeIcon}
              <span>${typeLabel}</span>
            </span>
          </div>
        `;
      }

      // 2. Coluna Empresa / Contato: NÃO repete o telefone embaixo
      let subtext = lead.niche || lead.identifier || '';
      if (lead.ai_summary) {
        if (lead.ai_summary.includes('Minerado GMN:')) {
          const parts = lead.ai_summary.split('|');
          subtext = parts[0].replace('Minerado GMN:', '').trim();
        } else if (lead.ai_summary.includes('Direct/Anúncio:')) {
          subtext = lead.niche || 'Inbound Direct';
        }
      }

      const companyCell = `
        <div class="company-cell">
          <span class="company-name">${escapeHtml(lead.company_name || lead.name || 'Empresa')}</span>
          <span class="company-sub" title="${escapeHtml(subtext)}">${escapeHtml(subtext)}</span>
        </div>
      `;

      // 3. WhatsApp Ativo Badge
      const waBadge = lead.is_whatsapp_active
        ? `<span class="badge-ui wa-active">${icons.check}<span>Ativo</span></span>`
        : `<span class="badge-ui wa-inactive">Não verificado</span>`;

      // 4. Avaliação Google (Uma única estrela SVG em linha)
      let ratingCell = `<span style="color: var(--text-subtle);">—</span>`;
      if (lead.ai_summary && lead.ai_summary.includes('Avaliação:')) {
        const match = lead.ai_summary.match(/Avaliação:\s*([\d,\.]+)\s*★?(?:\s*\(([\d\.]+)\s*avaliações\))?/i);
        if (match && match[1]) {
          const score = match[1].trim();
          const reviews = match[2] ? `(${match[2].trim()})` : '';
          ratingCell = `
            <div class="rating-cell">
              ${icons.star}
              <span class="rating-score">${score}</span>
              ${reviews ? `<span class="rating-reviews">${reviews}</span>` : ''}
            </div>
          `;
        }
      }

      // 5. Origem Badge
      let sourceBadge = `<span class="badge-ui">${lead.source}</span>`;
      if (lead.source === 'miner_gmn') {
        sourceBadge = `<span class="badge-ui source-gmn">${icons.mapPin}<span>Google Maps</span></span>`;
      } else if (lead.source === 'outbound_instagram') {
        sourceBadge = `<span class="badge-ui source-insta">${icons.instagram}<span>Instagram</span></span>`;
      } else if (lead.source === 'inbound_official') {
        sourceBadge = `<span class="badge-ui source-inbound">${icons.message}<span>Inbound IA</span></span>`;
      }

      // 6. Status Badge
      let statusClass = 'status-new';
      let statusText = 'Novo';
      if (lead.status === 'qualified') {
        statusClass = 'status-qualified';
        statusText = 'Qualificado (ICP)';
      } else if (lead.status === 'in_qualification') {
        statusClass = 'status-in-qualification';
        statusText = 'Em Triagem';
      } else if (lead.status === 'disqualified') {
        statusClass = 'status-disqualified';
        statusText = 'Desqualificado';
      }
      const statusBadge = `<span class="badge-ui ${statusClass}">${statusText}</span>`;

      return `
        <tr data-lead-id="${lead.id}">
          <td class="font-mono" style="color: var(--text-subtle);">${idx + 1}</td>
          <td>${companyCell}</td>
          <td>${phoneDisplay}</td>
          <td>${waBadge}</td>
          <td>${ratingCell}</td>
          <td>${sourceBadge}</td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm btn-open-modal" data-lead-id="${lead.id}" type="button">
              ${icons.eye}
              <span>Dossiê</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Listener para o modal
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
        exportsList.innerHTML = `<div class="empty-placeholder">Nenhuma planilha gerada ainda.</div>`;
        return;
      }

      exportsList.innerHTML = data.files.map(file => {
        const formattedDate = new Date(file.createdAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });

        return `
          <div class="file-row">
            <div class="file-meta-group">
              ${icons.file}
              <span class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
              <span class="file-info-sub font-mono">${file.sizeFormatted} &bull; ${formattedDate}</span>
            </div>
            <a href="${file.downloadUrl}" class="btn btn-secondary btn-sm" download style="display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;">
              ${icons.download}
              <span>Baixar</span>
            </a>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('Erro ao carregar exports:', err);
      exportsList.innerHTML = `<div class="empty-placeholder">Erro ao listar planilhas.</div>`;
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
    if (minerBtnIcon) minerBtnIcon.classList.add('hidden');
    minerBtnText.textContent = 'Iniciando extração...';
    minerFeedback.textContent = 'Enviando comando para o robô...';
    minerFeedback.className = 'feedback-text';

    try {
      const res = await fetch('/api/dashboard/miner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        minerFeedback.textContent = `Erro: ${data.error || 'Falha ao iniciar mineração'}`;
        minerFeedback.className = 'feedback-text error';
        btnRunMiner.disabled = false;
        minerSpinner.classList.add('hidden');
        if (minerBtnIcon) minerBtnIcon.classList.remove('hidden');
        minerBtnText.textContent = 'Iniciar Mineração no Maps';
        return;
      }

      minerFeedback.textContent = 'Robô em execução em background...';
      minerFeedback.className = 'feedback-text success';
      startProgressPolling();

    } catch (err) {
      minerFeedback.textContent = `Falha de rede: ${err.message}`;
      minerFeedback.className = 'feedback-text error';
      btnRunMiner.disabled = false;
      minerSpinner.classList.add('hidden');
      if (minerBtnIcon) minerBtnIcon.classList.remove('hidden');
      minerBtnText.textContent = 'Iniciar Mineração no Maps';
    }
  });

  // ============================================================================
  // 5. SUBMISSÃO DE OUTBOUND COM TRAVA DE SEGURANÇA E BANNER DE ERRO
  // ============================================================================
  formOutbound.addEventListener('submit', async (e) => {
    e.preventDefault();
    const target = outboundTarget.value.trim();
    const limit = outboundLimit.value;

    // Reseta banner de erro e feedback anterior
    outboundErrorBanner.classList.add('hidden');
    outboundFeedback.textContent = 'Verificando contas de Instagram cadastradas...';
    outboundFeedback.className = 'feedback-text';

    // Estado temporário de verificação (NUNCA diz que está disparando antes do backend aprovar)
    btnRunOutbound.disabled = true;
    outboundBtnText.textContent = 'Validando conexões...';

    try {
      const res = await fetch('/api/dashboard/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, limit })
      });
      const data = await res.json();

      // Trava de segurança: Se o servidor rejeitar (HTTP 400 ou sem contas)
      if (!res.ok || !data.success) {
        const errorMsg = data.error || 'Nenhuma conta Scraper/Sender conectada. Cadastre e autentique suas contas primeiro.';
        
        // Exibe erro em vermelho vivo e abre banner de alerta
        outboundFeedback.textContent = errorMsg;
        outboundFeedback.className = 'feedback-text error';
        outboundErrorMessage.textContent = errorMsg;
        outboundErrorBanner.classList.remove('hidden');

        // Reseta o botão para o estado pronto (NUNCA mente dizendo que disparou DMs)
        btnRunOutbound.disabled = false;
        outboundSpinner.classList.add('hidden');
        if (outboundBtnIcon) outboundBtnIcon.classList.remove('hidden');
        outboundBtnText.textContent = 'Disparar Outbound com IA';
        
        // Registra log local no console
        appendConsoleLine(outboundConsoleLines, `[BLOQUEIO DE SEGURANÇA] ${errorMsg}`, 'error');
        return;
      }

      // Sucesso real: Inicia disparo
      btnRunOutbound.disabled = true;
      outboundSpinner.classList.remove('hidden');
      if (outboundBtnIcon) outboundBtnIcon.classList.add('hidden');
      outboundBtnText.textContent = 'Disparando DMs...';
      outboundFeedback.textContent = 'Auditoria e envio em andamento...';
      outboundFeedback.className = 'feedback-text';

      appendConsoleLine(outboundConsoleLines, `[OUTBOUND INICIADO] Disparando para @${target} (limite ${limit})`, 'info');
      startProgressPolling();

    } catch (err) {
      outboundFeedback.textContent = `Falha de rede: ${err.message}`;
      outboundFeedback.className = 'feedback-text error';
      btnRunOutbound.disabled = false;
      outboundSpinner.classList.add('hidden');
      if (outboundBtnIcon) outboundBtnIcon.classList.remove('hidden');
      outboundBtnText.textContent = 'Disparar Outbound com IA';
    }
  });

  // Ação de clique no banner de erro para conectar contas
  btnErrorOpenSettings.addEventListener('click', () => {
    openSettingsModal('accounts');
  });

  // ============================================================================
  // 6. GERENCIAMENTO DE CONEXÕES & CONTAS INSTAGRAM (MODAL)
  // ============================================================================
  async function loadAccounts() {
    try {
      const res = await fetch('/api/dashboard/accounts');
      const data = await res.json();
      if (!data.success) {
        accountsTableBody.innerHTML = `<tr><td colspan="5" class="table-msg">Erro ao listar contas: ${data.error}</td></tr>`;
        return;
      }

      const accounts = data.accounts || [];
      accountsBadgeCount.textContent = `${accounts.length} ${accounts.length === 1 ? 'conta' : 'contas'}`;
      renderAccounts(accounts);
    } catch (err) {
      console.error('Erro ao carregar contas:', err);
      accountsTableBody.innerHTML = `<tr><td colspan="5" class="table-msg">Falha na conexão com o banco.</td></tr>`;
    }
  }

  function renderAccounts(accounts) {
    if (accounts.length === 0) {
      accountsTableBody.innerHTML = `<tr><td colspan="5" class="table-msg">Nenhuma conta cadastrada no SQLite. Adicione uma conta no formulário acima.</td></tr>`;
      return;
    }

    accountsTableBody.innerHTML = accounts.map(acc => {
      const isScraper = acc.role === 'scraper';
      const roleBadge = isScraper
        ? `<span class="badge-ui badge-role-scraper">Scraper Fantasma</span>`
        : `<span class="badge-ui badge-role-sender">Sender Aquecida</span>`;

      let sessionBadge = `<span class="badge-ui session-disconnected">Desconectada</span>`;
      if (acc.has_session && acc.status === 'active') {
        sessionBadge = `<span class="badge-ui session-active">${icons.check}<span>Ativa (Cookies)</span></span>`;
      } else if (acc.status === 'challenged') {
        sessionBadge = `<span class="badge-ui session-challenged"><span>Desafio 2FA</span></span>`;
      }

      const proxyText = acc.proxy ? `<span class="font-mono text-subtle" title="${escapeHtml(acc.proxy)}" style="display: block; font-size: 0.7rem;">Proxy configurado</span>` : '';

      return `
        <tr data-acc-id="${acc.id}">
          <td>
            <div style="display: flex; flex-direction: column;">
              <span class="font-mono" style="font-weight: 600; color: var(--text-primary);">@${escapeHtml(acc.username)}</span>
              ${proxyText}
            </div>
          </td>
          <td>${roleBadge}</td>
          <td class="font-mono">${acc.sent_today} / ${acc.daily_limit}</td>
          <td>${sessionBadge}</td>
          <td style="text-align: right;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
              <button class="btn btn-secondary btn-xs btn-login-acc" data-id="${acc.id}" data-username="${escapeHtml(acc.username)}" type="button" title="Abrir Chromium visível e fazer login no Instagram">
                ${icons.login}
                <span>Autenticar no Navegador</span>
              </button>
              <button class="btn-delete-acc" data-id="${acc.id}" data-username="${escapeHtml(acc.username)}" type="button" title="Remover conta e apagar cookies">
                ${icons.trash}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Wire up Login handlers
    document.querySelectorAll('.btn-login-acc').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const username = btn.getAttribute('data-username');
        handleAccountLogin(id, username, btn);
      });
    });

    // Wire up Delete handlers
    document.querySelectorAll('.btn-delete-acc').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const username = btn.getAttribute('data-username');
        handleAccountDelete(id, username);
      });
    });
  }

  // Formulário de Cadastro de Conta
  formAddAccount.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = accUsername.value.trim().replace(/^@/, '');
    const password = accPassword.value.trim();
    const role = accRole.value;
    const daily_limit = parseInt(accLimit.value, 10) || 25;
    const proxy = accProxy.value.trim();

    if (!username || !password) return;

    btnAddAccount.disabled = true;
    addAccountFeedback.textContent = 'Cadastrando conta no SQLite...';
    addAccountFeedback.className = 'feedback-text';

    try {
      const res = await fetch('/api/dashboard/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, daily_limit, proxy })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        addAccountFeedback.textContent = `Erro: ${data.error || 'Falha ao cadastrar conta'}`;
        addAccountFeedback.className = 'feedback-text error';
        btnAddAccount.disabled = false;
        return;
      }

      addAccountFeedback.textContent = 'Conta cadastrada com sucesso! Clique em "Autenticar no Navegador" para salvar os cookies.';
      addAccountFeedback.className = 'feedback-text success';
      formAddAccount.reset();
      accRole.value = role;
      accLimit.value = 25;
      btnAddAccount.disabled = false;

      await loadAccounts();
      await loadStats();

    } catch (err) {
      addAccountFeedback.textContent = `Falha de conexão: ${err.message}`;
      addAccountFeedback.className = 'feedback-text error';
      btnAddAccount.disabled = false;
    }
  });

  // Login Interativo Playwright (Modo Visível com preenchimento automático)
  async function handleAccountLogin(id, username, btn) {
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="btn-spinner"></span><span>Abrindo Chromium...</span>`;
    addAccountFeedback.textContent = `Chromium aberto para @${username}. Digite ou aprove 2FA se solicitado na janela...`;
    addAccountFeedback.className = 'feedback-text';

    try {
      const res = await fetch(`/api/dashboard/accounts/${id}/login`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        addAccountFeedback.textContent = `Erro de login: ${data.error || 'Falha ao autenticar'}`;
        addAccountFeedback.className = 'feedback-text error';
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        await loadAccounts();
        return;
      }

      addAccountFeedback.textContent = `Sucesso! Sessão salva para @${username} em data/sessions/${username}.json.`;
      addAccountFeedback.className = 'feedback-text success';
      btn.disabled = false;
      btn.innerHTML = originalHtml;

      await loadAccounts();
      await loadStats();

    } catch (err) {
      addAccountFeedback.textContent = `Erro: ${err.message}`;
      addAccountFeedback.className = 'feedback-text error';
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }

  // Remoção de Conta
  async function handleAccountDelete(id, username) {
    if (!confirm(`Deseja remover a conta @${username}? A sessão de cookies também será excluída.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/dashboard/accounts/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(`Erro ao remover conta: ${data.error}`);
        return;
      }

      addAccountFeedback.textContent = `Conta @${username} removida com sucesso.`;
      addAccountFeedback.className = 'feedback-text';
      await loadAccounts();
      await loadStats();
    } catch (err) {
      alert(`Erro de conexão: ${err.message}`);
    }
  }

  btnRefreshAccounts.addEventListener('click', loadAccounts);

  // ============================================================================
  // 7. CONFIGURAÇÕES DE APIS & INTEGRAÇÕES (.ENV)
  // ============================================================================
  async function loadConfig() {
    try {
      const res = await fetch('/api/dashboard/config');
      const data = await res.json();
      if (!data.success || !data.config) return;

      const c = data.config;
      if (c.OPENAI_API_KEY) cfgOpenAiKey.value = c.OPENAI_API_KEY;
      if (c.WA_API_URL) cfgWaUrl.value = c.WA_API_URL;
      if (c.WA_API_KEY) cfgWaKey.value = c.WA_API_KEY;
      if (c.WA_INSTANCE_NAME) cfgWaInstance.value = c.WA_INSTANCE_NAME;
      if (c.SDR_NOTIFICATION_PHONE) cfgSdrPhone.value = c.SDR_NOTIFICATION_PHONE;
      if (c.CRM_WEBHOOK_URL) cfgCrmWebhook.value = c.CRM_WEBHOOK_URL;
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    }
  }

  formApiSettings.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnSaveConfig.disabled = true;
    configFeedback.textContent = 'Gravando variáveis no arquivo .env...';
    configFeedback.className = 'feedback-text';

    const payload = {
      OPENAI_API_KEY: cfgOpenAiKey.value.trim(),
      WA_API_URL: cfgWaUrl.value.trim(),
      WA_API_KEY: cfgWaKey.value.trim(),
      WA_INSTANCE_NAME: cfgWaInstance.value.trim(),
      SDR_NOTIFICATION_PHONE: cfgSdrPhone.value.trim(),
      CRM_WEBHOOK_URL: cfgCrmWebhook.value.trim()
    };

    try {
      const res = await fetch('/api/dashboard/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        configFeedback.textContent = `Erro ao salvar: ${data.error || 'Falha no servidor'}`;
        configFeedback.className = 'feedback-text error';
        btnSaveConfig.disabled = false;
        return;
      }

      configFeedback.textContent = 'Configurações salvas no .env e atualizadas em memória com sucesso!';
      configFeedback.className = 'feedback-text success';
      btnSaveConfig.disabled = false;

    } catch (err) {
      configFeedback.textContent = `Erro de conexão: ${err.message}`;
      configFeedback.className = 'feedback-text error';
      btnSaveConfig.disabled = false;
    }
  });

  // Validação Ativa de WhatsApp dos Leads (wa-checker.js)
  btnValidateLeadsWa.addEventListener('click', async () => {
    btnValidateLeadsWa.disabled = true;
    waValidationFeedback.textContent = 'Consultando a Evolution API para validar os leads não verificados...';
    waValidationFeedback.className = 'feedback-text';

    try {
      const res = await fetch('/api/dashboard/validate-leads-wa', { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        waValidationFeedback.textContent = `Erro: ${data.error || 'Falha ao validar WhatsApp'}`;
        waValidationFeedback.className = 'feedback-text error';
        btnValidateLeadsWa.disabled = false;
        return;
      }

      waValidationFeedback.textContent = data.message || 'Leads validados com sucesso!';
      waValidationFeedback.className = 'feedback-text success';
      btnValidateLeadsWa.disabled = false;

      await loadLeads();
      await loadStats();

    } catch (err) {
      waValidationFeedback.textContent = `Falha de rede: ${err.message}`;
      waValidationFeedback.className = 'feedback-text error';
      btnValidateLeadsWa.disabled = false;
    }
  });

  // ============================================================================
  // 8. LOGS EM TEMPO REAL (MINI-CONSOLES)
  // ============================================================================
  async function pollLogs() {
    try {
      const res = await fetch('/api/dashboard/logs?limit=50');
      const data = await res.json();
      if (!data.success || !data.logs) return;

      const logs = data.logs;
      const minerLogs = logs.filter(l => l.module === 'miner');
      const outboundLogs = logs.filter(l => l.module === 'outbound');

      if (minerLogs.length > 0 && minerConsoleLines) {
        renderConsole(minerConsoleLines, minerLogs);
      }
      if (outboundLogs.length > 0 && outboundConsoleLines) {
        renderConsole(outboundConsoleLines, outboundLogs);
      }
    } catch (err) {
      // Falha silenciosa no log polling
    }
  }

  function renderConsole(container, logs) {
    container.innerHTML = logs.map(l => {
      let cls = 'text-muted';
      if (l.level === 'error') cls = 'text-error';
      else if (l.level === 'warn') cls = 'text-warn';
      else if (l.level === 'success') cls = 'text-success';
      else if (l.level === 'info') cls = 'text-info';

      const timeStr = l.timestamp || '';
      return `<div class="console-line ${cls}">[${timeStr}] ${escapeHtml(l.message)}</div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }

  function appendConsoleLine(container, message, level = 'info') {
    if (!container) return;
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    let cls = 'text-muted';
    if (level === 'error') cls = 'text-error';
    else if (level === 'success') cls = 'text-success';
    else if (level === 'info') cls = 'text-info';

    const div = document.createElement('div');
    div.className = `console-line ${cls}`;
    div.textContent = `[${time}] ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // ============================================================================
  // 9. NAVEGAÇÃO DE ABAS E CONTROLE DOS MODAIS
  // ============================================================================
  function openSettingsModal(defaultTab = 'accounts') {
    settingsModal.classList.remove('hidden');
    switchSettingsTab(defaultTab);
    loadAccounts();
    loadConfig();
  }

  function closeSettingsModal() {
    settingsModal.classList.add('hidden');
  }

  function switchSettingsTab(tab) {
    if (tab === 'accounts') {
      btnTabAccounts.classList.add('active');
      btnTabApis.classList.remove('active');
      tabAccountsContent.classList.remove('hidden');
      tabApisContent.classList.add('hidden');
    } else {
      btnTabApis.classList.add('active');
      btnTabAccounts.classList.remove('active');
      tabApisContent.classList.remove('hidden');
      tabAccountsContent.classList.add('hidden');
    }
  }

  btnOpenSettings.addEventListener('click', () => openSettingsModal('accounts'));
  kpiAccountsCard.addEventListener('click', () => openSettingsModal('accounts'));
  settingsModalClose.addEventListener('click', closeSettingsModal);
  settingsModalBtnClose.addEventListener('click', closeSettingsModal);
  btnTabAccounts.addEventListener('click', () => switchSettingsTab('accounts'));
  btnTabApis.addEventListener('click', () => switchSettingsTab('apis'));

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });

  // Modal do Lead
  async function openLeadModal(leadId) {
    leadModal.classList.remove('hidden');
    modalCompanyName.textContent = 'Carregando...';
    modalIdentifier.textContent = '';
    modalPhone.textContent = '-';
    modalPhoneType.textContent = '-';
    modalNiche.textContent = '-';
    modalRevenue.textContent = '-';
    modalSummary.textContent = '-';
    modalChatHistory.innerHTML = `<div class="table-msg">Resgatando histórico no SQLite WAL...</div>`;

    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/history`);
      const data = await res.json();

      if (!data.success || !data.lead) {
        modalCompanyName.textContent = 'Erro ao carregar';
        modalChatHistory.innerHTML = `<div class="empty-placeholder">Lead não encontrado no banco.</div>`;
        return;
      }

      const lead = data.lead;
      modalCompanyName.textContent = lead.company_name || lead.name || 'Lead Cadastrado';
      modalIdentifier.textContent = lead.identifier || '';
      modalPhone.textContent = formatPhoneBR(lead.phone);
      modalPhoneType.textContent = lead.phone_type === 'landline' ? 'Fixo Comercial (B2B)' : (lead.phone_type === 'mobile' ? 'Celular Móvel' : 'Não classificado');
      modalNiche.textContent = lead.niche || 'Geral';
      modalRevenue.textContent = lead.revenue_range || 'Não informado';
      modalSummary.textContent = lead.ai_summary || 'Sem resumo cadastrado';

      const history = data.history || [];
      if (history.length === 0) {
        modalChatHistory.innerHTML = `
          <div class="empty-placeholder">
            Nenhuma conversa de chat iniciada ainda.<br>
            <span style="font-size: 0.74rem; color: var(--text-muted); margin-top: 4px; display: inline-block;">
              Lead de origem <strong>${lead.source}</strong> cadastrado e pronto para abordagem.
            </span>
          </div>
        `;
      } else {
        modalChatHistory.innerHTML = history.map(msg => {
          const isAssistant = msg.role === 'assistant';
          const author = isAssistant ? `${icons.bot} Amanda (SDR IA)` : `${icons.user} Lead`;
          const time = new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          return `
            <div class="chat-entry ${isAssistant ? 'assistant' : 'user'}">
              <span class="entry-sender">${author}</span>
              <span class="entry-content">${escapeHtml(msg.content)}</span>
              <span class="entry-time">${time}</span>
            </div>
          `;
        }).join('');
      }

    } catch (err) {
      console.error('Erro ao abrir modal do lead:', err);
      modalCompanyName.textContent = 'Erro de Conexão';
      modalChatHistory.innerHTML = `<div class="empty-placeholder">Falha ao resgatar histórico.</div>`;
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
    if (e.key === 'Escape') {
      if (!leadModal.classList.contains('hidden')) closeLeadModal();
      if (!settingsModal.classList.contains('hidden')) closeSettingsModal();
    }
  });

  // ============================================================================
  // 10. POLLING & ATUALIZAÇÕES PERIÓDICAS
  // ============================================================================
  function startProgressPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      await loadStats();
      await loadLeads();
      await loadExports();
      await pollLogs();
    }, 2500);
  }

  filterSearch.addEventListener('input', renderLeadsTable);
  filterSource.addEventListener('change', renderLeadsTable);
  filterStatus.addEventListener('change', renderLeadsTable);

  btnRefreshAll.addEventListener('click', async () => {
    btnRefreshAll.style.opacity = '0.5';
    await loadStats();
    await loadLeads();
    await loadExports();
    await pollLogs();
    btnRefreshAll.style.opacity = '1';
  });

  btnRefreshExports.addEventListener('click', loadExports);

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Inicialização do Painel
  loadStats();
  loadLeads();
  loadExports();
  pollLogs();

  // Loop de polling de heartbeat (logs e stats a cada 3s)
  setInterval(() => {
    loadStats();
    pollLogs();
  }, 3000);
});

