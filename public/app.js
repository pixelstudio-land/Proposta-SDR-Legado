/**
 * ==============================================================================
 * LEGADO SDR ENGINE — CLIENT DASHBOARD LOGIC (SHADCN / LINEAR DARK UI)
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Estado local
  let allLeads = [];
  let pollInterval = null;

  // Helper de escuta segura de eventos do DOM (previne exceção se elemento for nulo)
  function safeListen(elem, event, handler) {
    if (elem) {
      elem.addEventListener(event, handler);
    }
  }

  // Interceptador Global de Fetch para Autenticação Administrativa
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    let [resource, config] = args;
    config = config ? { ...config } : {};

    let headers = config.headers;
    if (headers instanceof Headers) {
      const token = localStorage.getItem('legado_admin_token');
      if (token) headers.set('x-admin-token', token);
      config.headers = headers;
    } else {
      config.headers = { ...(headers || {}) };
      const token = localStorage.getItem('legado_admin_token');
      if (token) {
        config.headers['x-admin-token'] = token;
      }
    }

    const response = await originalFetch(resource, config);

    // Se a rota exigiu autenticação e falhou
    if (response.status === 401) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        if (data.require_auth) {
          showLoginOverlay();
        }
      } catch {}
    }

    return response;
  };

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
    login: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>`,
    x: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
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
  const btnClearAllLeads = document.getElementById('btnClearAllLeads');

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

  // Modal de Configurações & Conexões
  const settingsModal = document.getElementById('settingsModal');
  const settingsModalClose = document.getElementById('settingsModalClose');
  const settingsModalBtnClose = document.getElementById('settingsModalBtnClose');
  const btnTabAccounts = document.getElementById('btnTabAccounts');
  const btnTabApis = document.getElementById('btnTabApis');
  const tabAccountsContent = document.getElementById('tabAccountsContent');
  const tabApisContent = document.getElementById('tabApisContent');

  // Aba 1 - Bloco 1: Conta Principal Oficial
  const formOfficialSettings = document.getElementById('formOfficialSettings');
  const cfgOfficialInstagram = document.getElementById('cfgOfficialInstagram');
  const cfgOfficialAiActive = document.getElementById('cfgOfficialAiActive');
  const cfgOfficialIcpCriteria = document.getElementById('cfgOfficialIcpCriteria');
  const btnSaveOfficialConfig = document.getElementById('btnSaveOfficialConfig');
  const officialConfigFeedback = document.getElementById('officialConfigFeedback');
  const btnCopyManyChatWebhook = document.getElementById('btnCopyManyChatWebhook');
  const btnCopyManyChatText = document.getElementById('btnCopyManyChatText');

  // Aba 1 - Bloco 2: Contas Secundárias (Individual & Lote)
  const btnToggleBatchMode = document.getElementById('btnToggleBatchMode');
  const btnToggleBatchText = document.getElementById('btnToggleBatchText');
  const formAddAccount = document.getElementById('formAddAccount');
  const formBatchAccounts = document.getElementById('formBatchAccounts');
  const accUsername = document.getElementById('accUsername');
  const accPassword = document.getElementById('accPassword');
  const accRole = document.getElementById('accRole');
  const accLimit = document.getElementById('accLimit');
  const accProxy = document.getElementById('accProxy');
  const accSessionCookie = document.getElementById('accSessionCookie');
  const btnAddAccount = document.getElementById('btnAddAccount');
  const addAccountFeedback = document.getElementById('addAccountFeedback');
  const accBatchInput = document.getElementById('accBatchInput');
  const btnSubmitBatchAccounts = document.getElementById('btnSubmitBatchAccounts');
  const batchAccountFeedback = document.getElementById('batchAccountFeedback');
  const accountsTableBody = document.getElementById('accountsTableBody');
  const accountsBadgeCount = document.getElementById('accountsBadgeCount');
  const btnRefreshAccounts = document.getElementById('btnRefreshAccounts');

  // Aba 2: Mensagens & WhatsApp do Vendedor
  const btnOpenWaModalFromSettingsBig = document.getElementById('btnOpenWaModalFromSettingsBig');
  const settingsWaPulseDot = document.getElementById('settingsWaPulseDot');
  const settingsWaConnectionStatusText = document.getElementById('settingsWaConnectionStatusText');
  const formApiSettings = document.getElementById('formApiSettings');
  const cfgOpenAiKey = document.getElementById('cfgOpenAiKey');
  const cfgSdrPhone = document.getElementById('cfgSdrPhone');
  const cfgCrmWebhook = document.getElementById('cfgCrmWebhook');
  const cfgCrmApiKey = document.getElementById('cfgCrmApiKey');
  const cfgWaMinDelay = document.getElementById('cfgWaMinDelay');
  const cfgWaMaxDelay = document.getElementById('cfgWaMaxDelay');
  const cfgWaPitchTemplate = document.getElementById('cfgWaPitchTemplate');
  const btnSaveConfig = document.getElementById('btnSaveConfig');
  const configFeedback = document.getElementById('configFeedback');
  const btnOpenWaModalFromSettings = document.getElementById('btnOpenWaModalFromSettings');
  const btnValidateLeadsWa = document.getElementById('btnValidateLeadsWa');
  const waValidationFeedback = document.getElementById('waValidationFeedback');

  // Elementos do DOM - Login & Logout
  const loginOverlay = document.getElementById('loginOverlay');
  const formLogin = document.getElementById('formLogin');
  const loginPassword = document.getElementById('loginPassword');
  const btnLoginSubmit = document.getElementById('btnLoginSubmit');
  const btnLoginText = document.getElementById('btnLoginText');
  const loginFeedback = document.getElementById('loginFeedback');
  const btnLogout = document.getElementById('btnLogout');

  // Elementos do DOM - WhatsApp Nativo (Baileys)
  const btnWaIndicator = document.getElementById('btnWaIndicator');
  const waPulseDot = document.getElementById('waPulseDot');
  const waStatusText = document.getElementById('waStatusText');
  const waStatusMeta = document.getElementById('waStatusMeta');
  const waModal = document.getElementById('waModal');
  const waModalClose = document.getElementById('waModalClose');
  const waStatusBanner = document.getElementById('waStatusBanner');
  const waModalPulseDot = document.getElementById('waModalPulseDot');
  const waModalStatusTitle = document.getElementById('waModalStatusTitle');
  const waModalStatusDesc = document.getElementById('waModalStatusDesc');
  const waQrWrapper = document.getElementById('waQrWrapper');
  const waQrImage = document.getElementById('waQrImage');
  const waQrSpinner = document.getElementById('waQrSpinner');
  const waConnectedNotice = document.getElementById('waConnectedNotice');
  const waConnectedPhoneDisplay = document.getElementById('waConnectedPhoneDisplay');
  const btnWaRefreshQr = document.getElementById('btnWaRefreshQr');
  const btnWaDisconnectSession = document.getElementById('btnWaDisconnectSession');
  let waModalPollInterval = null;

  // Elementos do DOM - Fila de Disparo Automático WhatsApp
  const waDispatcherStatusBadge = document.getElementById('waDispatcherStatusBadge');
  const waDispatcherPendingCount = document.getElementById('waDispatcherPendingCount');
  const waDispatcherSentToday = document.getElementById('waDispatcherSentToday');
  const btnToggleWaDispatcher = document.getElementById('btnToggleWaDispatcher');
  const waDispatcherIcon = document.getElementById('waDispatcherIcon');
  const waDispatcherBtnText = document.getElementById('waDispatcherBtnText');
  const waDispatcherFeedback = document.getElementById('waDispatcherFeedback');

  // Elementos do DOM - Modal de Importação de Cookies (Sessão Instagram)
  const sessionCookieModal = document.getElementById('sessionCookieModal');
  const sessionCookieModalClose = document.getElementById('sessionCookieModalClose');
  const sessionCookieModalBtnCancel = document.getElementById('sessionCookieModalBtnCancel');
  const sessionModalUsername = document.getElementById('sessionModalUsername');
  const sessionModalAccountId = document.getElementById('sessionModalAccountId');
  const formSessionCookie = document.getElementById('formSessionCookie');
  const sessionCookieInput = document.getElementById('sessionCookieInput');
  const btnSaveSessionCookie = document.getElementById('btnSaveSessionCookie');
  const sessionCookieFeedback = document.getElementById('sessionCookieFeedback');

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
      if (statusFilter !== 'all') {
        if (statusFilter === 'no_whatsapp') {
          if (lead.status !== 'no_whatsapp' && lead.is_whatsapp_active !== 0) return false;
        } else if (lead.status !== statusFilter) {
          return false;
        }
      }

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

      // 3. WhatsApp Ativo Badge (Diferenciação: Ativo, Sem WhatsApp e Não verificado)
      let waBadge;
      if (lead.is_whatsapp_active === 1 || lead.is_whatsapp_active === '1') {
        waBadge = `<span class="badge-ui wa-active">${icons.check}<span>Ativo</span></span>`;
      } else if (
        lead.is_whatsapp_active === 0 || 
        lead.is_whatsapp_active === '0' || 
        lead.status === 'no_whatsapp' || 
        lead.status === 'invalid'
      ) {
        waBadge = `<span class="badge-ui wa-none">${icons.x}<span>Sem WhatsApp</span></span>`;
      } else {
        waBadge = `<span class="badge-ui wa-inactive"><span>Não verificado</span></span>`;
      }

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

      // 5. Origem & Canais (Google Maps + @instagram unificados sem duplicação)
      let sourceBadges = [];
      if (lead.source === 'miner_gmn') {
        sourceBadges.push(`<span class="badge-ui source-gmn">${icons.mapPin}<span>Google Maps</span></span>`);
      } else if (lead.source === 'outbound_instagram') {
        sourceBadges.push(`<span class="badge-ui source-insta">${icons.instagram}<span>Instagram</span></span>`);
      } else if (lead.source === 'inbound_official') {
        sourceBadges.push(`<span class="badge-ui source-inbound">${icons.message}<span>Inbound IA</span></span>`);
      }

      if (lead.instagram && lead.source !== 'outbound_instagram') {
        const cleanIg = lead.instagram.replace(/^@/, '');
        sourceBadges.push(`
          <a href="https://instagram.com/${cleanIg}" target="_blank" rel="noopener noreferrer" class="badge-ui source-insta" title="Instagram Oficial: @${cleanIg}" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
            ${icons.instagram}
            <span class="font-mono">@${cleanIg}</span>
          </a>
        `);
      }

      const sourceDisplay = `<div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">${sourceBadges.join('')}</div>`;

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
      } else if (lead.status === 'no_whatsapp') {
        statusClass = 'status-disqualified';
        statusText = 'Sem WhatsApp';
      }
      const statusBadge = `<span class="badge-ui ${statusClass}">${statusText}</span>`;

      return `
        <tr data-lead-id="${lead.id}">
          <td class="font-mono" style="color: var(--text-subtle);">${idx + 1}</td>
          <td>${companyCell}</td>
          <td>${phoneDisplay}</td>
          <td>${waBadge}</td>
          <td>${ratingCell}</td>
          <td>${sourceDisplay}</td>
          <td>${statusBadge}</td>
          <td style="text-align: right; white-space: nowrap;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
              <button class="btn btn-secondary btn-sm btn-open-modal" data-lead-id="${lead.id}" type="button" title="Ver dossiê completo">
                ${icons.eye}
                <span>Dossiê</span>
              </button>
              <button class="btn-delete-lead" data-lead-id="${lead.id}" data-name="${escapeHtml(lead.company_name || lead.name || 'Lead')}" type="button" title="Excluir este lead">
                ${icons.trash}
              </button>
            </div>
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

    // Listener para exclusão de lead individual
    document.querySelectorAll('.btn-delete-lead').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const leadId = btn.getAttribute('data-lead-id');
        const name = btn.getAttribute('data-name');
        if (!confirm(`Deseja realmente excluir o lead "${name}"?`)) return;

        try {
          const res = await fetch(`/api/dashboard/leads/${leadId}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok || !data.success) {
            alert(`Erro ao excluir lead: ${data.error || 'Falha no servidor'}`);
            return;
          }
          await loadLeads();
          await loadStats();
        } catch (err) {
          alert(`Falha de conexão: ${err.message}`);
        }
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
  safeListen(formMiner, 'submit', async (e) => {
    e.preventDefault();
    const query = minerQuery ? minerQuery.value.trim() : '';
    const limit = minerLimit ? minerLimit.value : '5';
    if (!query) return;

    if (btnRunMiner) btnRunMiner.disabled = true;
    if (minerSpinner) minerSpinner.classList.remove('hidden');
    if (minerBtnIcon) minerBtnIcon.classList.add('hidden');
    if (minerBtnText) minerBtnText.textContent = 'Iniciando extração...';
    if (minerFeedback) {
      minerFeedback.textContent = 'Enviando comando para o robô...';
      minerFeedback.className = 'feedback-text';
    }

    try {
      const res = await fetch('/api/dashboard/miner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (minerFeedback) {
          minerFeedback.textContent = `Erro: ${data.error || 'Falha ao iniciar mineração'}`;
          minerFeedback.className = 'feedback-text error';
        }
        if (btnRunMiner) btnRunMiner.disabled = false;
        if (minerSpinner) minerSpinner.classList.add('hidden');
        if (minerBtnIcon) minerBtnIcon.classList.remove('hidden');
        if (minerBtnText) minerBtnText.textContent = 'Iniciar Mineração no Maps';
        return;
      }

      if (minerFeedback) {
        minerFeedback.textContent = 'Robô em execução em background...';
        minerFeedback.className = 'feedback-text success';
      }
      startProgressPolling();

    } catch (err) {
      if (minerFeedback) {
        minerFeedback.textContent = `Falha de rede: ${err.message}`;
        minerFeedback.className = 'feedback-text error';
      }
      if (btnRunMiner) btnRunMiner.disabled = false;
      if (minerSpinner) minerSpinner.classList.add('hidden');
      if (minerBtnIcon) minerBtnIcon.classList.remove('hidden');
      if (minerBtnText) minerBtnText.textContent = 'Iniciar Mineração no Maps';
    }
  });

  // ============================================================================
  // 5. SUBMISSÃO DE OUTBOUND COM TRAVA DE SEGURANÇA E BANNER DE ERRO
  // ============================================================================
  safeListen(formOutbound, 'submit', async (e) => {
    e.preventDefault();
    const target = outboundTarget ? outboundTarget.value.trim() : '';
    const limit = outboundLimit ? outboundLimit.value : '25';

    // Reseta banner de erro e feedback anterior
    if (outboundErrorBanner) outboundErrorBanner.classList.add('hidden');
    if (outboundFeedback) {
      outboundFeedback.textContent = 'Verificando contas de Instagram cadastradas...';
      outboundFeedback.className = 'feedback-text';
    }

    // Estado temporário de verificação (NUNCA diz que está disparando antes do backend aprovar)
    if (btnRunOutbound) btnRunOutbound.disabled = true;
    if (outboundBtnText) outboundBtnText.textContent = 'Validando conexões...';

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
        if (outboundFeedback) {
          outboundFeedback.textContent = errorMsg;
          outboundFeedback.className = 'feedback-text error';
        }
        if (outboundErrorMessage) outboundErrorMessage.textContent = errorMsg;
        if (outboundErrorBanner) outboundErrorBanner.classList.remove('hidden');

        // Reseta o botão para o estado pronto (NUNCA mente dizendo que disparou DMs)
        if (btnRunOutbound) btnRunOutbound.disabled = false;
        if (outboundSpinner) outboundSpinner.classList.add('hidden');
        if (outboundBtnIcon) outboundBtnIcon.classList.remove('hidden');
        if (outboundBtnText) outboundBtnText.textContent = 'Disparar Outbound com IA';
        
        // Registra log local no console
        appendConsoleLine(outboundConsoleLines, `[BLOQUEIO DE SEGURANÇA] ${errorMsg}`, 'error');
        return;
      }

      // Sucesso real: Inicia disparo
      if (btnRunOutbound) btnRunOutbound.disabled = true;
      if (outboundSpinner) outboundSpinner.classList.remove('hidden');
      if (outboundBtnIcon) outboundBtnIcon.classList.add('hidden');
      if (outboundBtnText) outboundBtnText.textContent = 'Disparando DMs...';
      if (outboundFeedback) {
        outboundFeedback.textContent = 'Auditoria e envio em andamento...';
        outboundFeedback.className = 'feedback-text';
      }

      appendConsoleLine(outboundConsoleLines, `[OUTBOUND INICIADO] Disparando para @${target} (limite ${limit})`, 'info');
      startProgressPolling();

    } catch (err) {
      if (outboundFeedback) {
        outboundFeedback.textContent = `Falha de rede: ${err.message}`;
        outboundFeedback.className = 'feedback-text error';
      }
      if (btnRunOutbound) btnRunOutbound.disabled = false;
      if (outboundSpinner) outboundSpinner.classList.add('hidden');
      if (outboundBtnIcon) outboundBtnIcon.classList.remove('hidden');
      if (outboundBtnText) outboundBtnText.textContent = 'Disparar Outbound com IA';
    }
  });

  // Ação de clique no banner de erro para conectar contas
  safeListen(btnErrorOpenSettings, 'click', () => {
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
      accountsTableBody.innerHTML = `<tr><td colspan="5" class="table-msg">Nenhuma conta secundária cadastrada. Adicione uma conta individual ou importe em lote acima.</td></tr>`;
      return;
    }

    accountsTableBody.innerHTML = accounts.map(acc => {
      const isScraper = acc.role === 'scraper';
      const roleBadge = isScraper
        ? `<span class="badge-ui badge-role-finder">Busca de Perfis</span>`
        : `<span class="badge-ui badge-role-sender">Disparo de DMs</span>`;

      const isReady = acc.has_session && acc.status === 'active';
      const isRestricted = acc.status === 'challenged';

      let sessionBadge = `<span class="badge-ui session-needs-auth"><span>Pedindo Código / Sessão</span></span>`;
      if (isReady) {
        sessionBadge = `<span class="badge-ui session-active">${icons.check}<span>Ativa e Pronta</span></span>`;
      } else if (isRestricted) {
        sessionBadge = `<span class="badge-ui session-challenged"><span>Restrita pelo Instagram</span></span>`;
      }

      const proxyText = acc.proxy ? `<span class="font-mono text-subtle" title="${escapeHtml(acc.proxy)}" style="display: block; font-size: 0.7rem;">Proxy ativo</span>` : '';
      const cookieBtnClass = isReady ? 'btn btn-secondary btn-xs btn-cookie-acc' : 'btn btn-primary-gold btn-xs btn-cookie-acc';
      const cookieBtnText = isReady ? 'Atualizar Sessão' : 'Colar Sessão';

      return `
        <tr data-acc-id="${acc.id}">
          <td>
            <div style="display: flex; flex-direction: column;">
              <span class="font-mono" style="font-weight: 600; color: var(--text-primary);">@${escapeHtml(acc.username)}</span>
              ${proxyText}
            </div>
          </td>
          <td>${roleBadge}</td>
          <td class="font-mono">${acc.sent_today} de ${acc.daily_limit || 25}</td>
          <td>${sessionBadge}</td>
          <td style="text-align: right;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
              <button class="${cookieBtnClass}" data-id="${acc.id}" data-username="${escapeHtml(acc.username)}" type="button" title="Colar Cookie sessionid ou JSON do StorageState">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
                <span>${cookieBtnText}</span>
              </button>
              <button class="btn btn-secondary btn-xs btn-login-acc" data-id="${acc.id}" data-username="${escapeHtml(acc.username)}" type="button" title="Abrir Chromium e fazer login">
                ${icons.login}
                <span>Navegador</span>
              </button>
              <button class="btn-delete-acc" data-id="${acc.id}" data-username="${escapeHtml(acc.username)}" type="button" title="Remover conta">
                ${icons.trash}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Wire up Cookie Import handlers
    document.querySelectorAll('.btn-cookie-acc').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const username = btn.getAttribute('data-username');
        openSessionCookieModal(id, username);
      });
    });

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
  safeListen(formAddAccount, 'submit', async (e) => {
    e.preventDefault();
    const username = accUsername ? accUsername.value.trim().replace(/^@/, '') : '';
    const password = accPassword ? accPassword.value.trim() : '';
    const sessionCookie = accSessionCookie ? accSessionCookie.value.trim() : '';
    const role = accRole ? accRole.value : undefined;
    const daily_limit = parseInt(accLimit ? accLimit.value : '25', 10) || 25;
    const proxy = accProxy ? accProxy.value.trim() : '';

    if (!username) {
      if (addAccountFeedback) {
        addAccountFeedback.textContent = 'O nome de usuário é obrigatório.';
        addAccountFeedback.className = 'feedback-text error';
      }
      return;
    }

    if (!password && !sessionCookie) {
      if (addAccountFeedback) {
        addAccountFeedback.textContent = 'Informe a senha ou o cookie de sessão para cadastrar.';
        addAccountFeedback.className = 'feedback-text error';
      }
      return;
    }

    if (btnAddAccount) btnAddAccount.disabled = true;
    if (addAccountFeedback) {
      addAccountFeedback.textContent = 'Cadastrando conta no SQLite...';
      addAccountFeedback.className = 'feedback-text';
    }

    try {
      const res = await fetch('/api/dashboard/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password: password || undefined,
          sessionid: sessionCookie || undefined,
          role,
          daily_limit,
          proxy
        })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (addAccountFeedback) {
          addAccountFeedback.textContent = `Erro: ${data.error || 'Falha ao cadastrar conta'}`;
          addAccountFeedback.className = 'feedback-text error';
        }
        if (btnAddAccount) btnAddAccount.disabled = false;
        return;
      }

      if (addAccountFeedback) {
        const msg = data.sessionSaved
          ? 'Conta cadastrada e ativada imediatamente com cookies!'
          : 'Conta cadastrada com sucesso! Clique em "Colar Sessão" ou "Navegador" para ativar.';
        addAccountFeedback.textContent = msg;
        addAccountFeedback.className = 'feedback-text success';
      }
      formAddAccount.reset();
      if (btnAddAccount) btnAddAccount.disabled = false;

      await loadAccounts();
      await loadStats();

    } catch (err) {
      if (addAccountFeedback) {
        addAccountFeedback.textContent = `Falha de conexão: ${err.message}`;
        addAccountFeedback.className = 'feedback-text error';
      }
      if (btnAddAccount) btnAddAccount.disabled = false;
    }
  });

  // Alternar entre Cadastro Individual e Em Lote
  safeListen(btnToggleBatchMode, 'click', () => {
    if (!formBatchAccounts || !formAddAccount) return;
    const isBatchHidden = formBatchAccounts.classList.contains('hidden');
    if (isBatchHidden) {
      formBatchAccounts.classList.remove('hidden');
      formAddAccount.classList.add('hidden');
      if (btnToggleBatchText) btnToggleBatchText.textContent = 'Cadastrar Conta Individual';
      if (accBatchInput) accBatchInput.focus();
    } else {
      formBatchAccounts.classList.add('hidden');
      formAddAccount.classList.remove('hidden');
      if (btnToggleBatchText) btnToggleBatchText.textContent = 'Cadastrar Várias em Lote';
    }
  });

  // Cadastro de Contas em Lote
  safeListen(formBatchAccounts, 'submit', async (e) => {
    e.preventDefault();
    const rawList = accBatchInput ? accBatchInput.value.trim() : '';
    if (!rawList) {
      if (batchAccountFeedback) {
        batchAccountFeedback.textContent = 'Cole ao menos uma conta na lista (uma por linha).';
        batchAccountFeedback.className = 'feedback-text error';
      }
      return;
    }

    if (btnSubmitBatchAccounts) btnSubmitBatchAccounts.disabled = true;
    if (batchAccountFeedback) {
      batchAccountFeedback.textContent = 'Importando contas e distribuindo funções...';
      batchAccountFeedback.className = 'feedback-text';
    }

    try {
      const res = await fetch('/api/dashboard/accounts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawList })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (batchAccountFeedback) {
          batchAccountFeedback.textContent = `Erro: ${data.error || 'Falha ao processar lote'}`;
          batchAccountFeedback.className = 'feedback-text error';
        }
        return;
      }

      if (batchAccountFeedback) {
        const errMsg = data.errorCount > 0 ? ` (${data.errorCount} ignoradas ou com erro)` : '';
        batchAccountFeedback.textContent = `${data.createdCount} contas cadastradas com sucesso!${errMsg}`;
        batchAccountFeedback.className = 'feedback-text success';
      }
      if (accBatchInput) accBatchInput.value = '';
      await loadAccounts();
      await loadStats();

    } catch (err) {
      if (batchAccountFeedback) {
        batchAccountFeedback.textContent = `Erro de conexão: ${err.message}`;
        batchAccountFeedback.className = 'feedback-text error';
      }
    } finally {
      if (btnSubmitBatchAccounts) btnSubmitBatchAccounts.disabled = false;
    }
  });

  // Copiar URL do Webhook do ManyChat para a Conta Oficial
  safeListen(btnCopyManyChatWebhook, 'click', async () => {
    const webhookUrl = `${window.location.origin}/api/inbound/webhook`;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      if (btnCopyManyChatText) btnCopyManyChatText.textContent = 'Link Copiado!';
      setTimeout(() => {
        if (btnCopyManyChatText) btnCopyManyChatText.textContent = 'Ver Link de Integração ManyChat';
      }, 2500);
    } catch (_) {
      prompt('Copie a URL do Webhook do ManyChat abaixo:', webhookUrl);
    }
  });

  // Salvar Configurações da Conta Principal da Agência
  safeListen(formOfficialSettings, 'submit', async (e) => {
    e.preventDefault();
    if (btnSaveOfficialConfig) btnSaveOfficialConfig.disabled = true;
    if (officialConfigFeedback) {
      officialConfigFeedback.textContent = 'Salvando conta principal no SQLite...';
      officialConfigFeedback.className = 'feedback-text';
    }

    const payload = {
      OFFICIAL_INSTAGRAM_USER: cfgOfficialInstagram ? cfgOfficialInstagram.value.trim().replace(/^@/, '') : '',
      OFFICIAL_AI_ENABLED: cfgOfficialAiActive ? cfgOfficialAiActive.value : '1',
      OFFICIAL_ICP_CRITERIA: cfgOfficialIcpCriteria ? cfgOfficialIcpCriteria.value.trim() : ''
    };

    try {
      const res = await fetch('/api/dashboard/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (officialConfigFeedback) {
          officialConfigFeedback.textContent = `Erro ao salvar: ${data.error || 'Falha no servidor'}`;
          officialConfigFeedback.className = 'feedback-text error';
        }
        return;
      }

      if (officialConfigFeedback) {
        officialConfigFeedback.textContent = 'Configurações da conta principal salvas com sucesso!';
        officialConfigFeedback.className = 'feedback-text success';
      }
    } catch (err) {
      if (officialConfigFeedback) {
        officialConfigFeedback.textContent = `Erro de conexão: ${err.message}`;
        officialConfigFeedback.className = 'feedback-text error';
      }
    } finally {
      if (btnSaveOfficialConfig) btnSaveOfficialConfig.disabled = false;
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

  // ============================================================================
  // IMPORTAÇÃO DE COOKIES / SESSIONID (HEADLESS & VPS COMPATIBLE)
  // ============================================================================
  function openSessionCookieModal(accountId, username) {
    if (!sessionCookieModal) return;
    sessionModalAccountId.value = accountId;
    sessionModalUsername.textContent = `@${username}`;
    sessionCookieInput.value = '';
    sessionCookieFeedback.textContent = '';
    sessionCookieFeedback.className = 'feedback-text';
    btnSaveSessionCookie.disabled = false;
    sessionCookieModal.classList.remove('hidden');
    setTimeout(() => sessionCookieInput.focus(), 100);
  }

  function closeSessionCookieModal() {
    if (!sessionCookieModal) return;
    sessionCookieModal.classList.add('hidden');
  }

  if (sessionCookieModalClose) sessionCookieModalClose.addEventListener('click', closeSessionCookieModal);
  if (sessionCookieModalBtnCancel) sessionCookieModalBtnCancel.addEventListener('click', closeSessionCookieModal);
  if (sessionCookieModal) {
    sessionCookieModal.addEventListener('click', (e) => {
      if (e.target === sessionCookieModal) closeSessionCookieModal();
    });
  }

  if (formSessionCookie) {
    formSessionCookie.addEventListener('submit', async (e) => {
      e.preventDefault();
      const accountId = sessionModalAccountId.value;
      const rawInput = sessionCookieInput.value.trim();

      if (!rawInput) {
        sessionCookieFeedback.textContent = 'Cole o cookie sessionid ou o JSON da sessão.';
        sessionCookieFeedback.className = 'feedback-text error';
        return;
      }

      btnSaveSessionCookie.disabled = true;
      sessionCookieFeedback.textContent = 'Salvando e validando sessão...';
      sessionCookieFeedback.className = 'feedback-text';

      try {
        const res = await fetch(`/api/dashboard/accounts/${accountId}/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionid: rawInput })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          sessionCookieFeedback.textContent = `Erro: ${data.error || 'Falha ao salvar sessão'}`;
          sessionCookieFeedback.className = 'feedback-text error';
          btnSaveSessionCookie.disabled = false;
          return;
        }

        sessionCookieFeedback.textContent = 'Sessão salva com sucesso!';
        sessionCookieFeedback.className = 'feedback-text success';
        btnSaveSessionCookie.disabled = false;

        await loadAccounts();
        await loadStats();

        setTimeout(() => {
          closeSessionCookieModal();
        }, 1200);

      } catch (err) {
        sessionCookieFeedback.textContent = `Erro de rede: ${err.message}`;
        sessionCookieFeedback.className = 'feedback-text error';
        btnSaveSessionCookie.disabled = false;
      }
    });
  }

  safeListen(btnRefreshAccounts, 'click', loadAccounts);

  // ============================================================================
  // 7. CONFIGURAÇÕES DE APIS, CRON & TEMPLATES (SQLITE & .ENV)
  // ============================================================================
  async function loadConfig() {
    try {
      const res = await fetch('/api/dashboard/config');
      const data = await res.json();
      if (!data.success || !data.config) return;

      const c = data.config;
      if (c.OPENAI_API_KEY && cfgOpenAiKey) cfgOpenAiKey.value = c.OPENAI_API_KEY;
      if (c.SDR_NOTIFICATION_PHONE && cfgSdrPhone) cfgSdrPhone.value = c.SDR_NOTIFICATION_PHONE;
      if (c.CRM_WEBHOOK_URL && cfgCrmWebhook) cfgCrmWebhook.value = c.CRM_WEBHOOK_URL;
      if (cfgCrmApiKey && c.CRM_API_KEY) cfgCrmApiKey.value = c.CRM_API_KEY;
      if (cfgWaMinDelay && c.WHATSAPP_MIN_DELAY) cfgWaMinDelay.value = c.WHATSAPP_MIN_DELAY;
      if (cfgWaMaxDelay && c.WHATSAPP_MAX_DELAY) cfgWaMaxDelay.value = c.WHATSAPP_MAX_DELAY;
      if (cfgWaPitchTemplate && c.WHATSAPP_PITCH_TEMPLATE) cfgWaPitchTemplate.value = c.WHATSAPP_PITCH_TEMPLATE;

      // Configurações da Conta Principal Oficial (Meta / Inbound)
      if (cfgOfficialInstagram && c.OFFICIAL_INSTAGRAM_USER) cfgOfficialInstagram.value = c.OFFICIAL_INSTAGRAM_USER;
      if (cfgOfficialAiActive && c.OFFICIAL_AI_ENABLED !== undefined) cfgOfficialAiActive.value = String(c.OFFICIAL_AI_ENABLED);
      if (cfgOfficialIcpCriteria && c.OFFICIAL_ICP_CRITERIA) cfgOfficialIcpCriteria.value = c.OFFICIAL_ICP_CRITERIA;
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    }
  }

  safeListen(formApiSettings, 'submit', async (e) => {
    e.preventDefault();
    if (btnSaveConfig) btnSaveConfig.disabled = true;
    if (configFeedback) {
      configFeedback.textContent = 'Gravando parâmetros no SQLite e .env...';
      configFeedback.className = 'feedback-text';
    }

    const payload = {
      OPENAI_API_KEY: cfgOpenAiKey ? cfgOpenAiKey.value.trim() : '',
      SDR_NOTIFICATION_PHONE: cfgSdrPhone ? cfgSdrPhone.value.trim() : '',
      CRM_WEBHOOK_URL: cfgCrmWebhook ? cfgCrmWebhook.value.trim() : '',
      CRM_API_KEY: cfgCrmApiKey ? cfgCrmApiKey.value.trim() : '',
      WHATSAPP_MIN_DELAY: cfgWaMinDelay ? parseInt(cfgWaMinDelay.value, 10) : 60,
      WHATSAPP_MAX_DELAY: cfgWaMaxDelay ? parseInt(cfgWaMaxDelay.value, 10) : 120,
      WHATSAPP_PITCH_TEMPLATE: cfgWaPitchTemplate ? cfgWaPitchTemplate.value.trim() : ''
    };

    try {
      const res = await fetch('/api/dashboard/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (configFeedback) {
          configFeedback.textContent = `Erro ao salvar: ${data.error || 'Falha no servidor'}`;
          configFeedback.className = 'feedback-text error';
        }
        if (btnSaveConfig) btnSaveConfig.disabled = false;
        return;
      }

      if (configFeedback) {
        configFeedback.textContent = 'Configurações salvas no SQLite e .env com sucesso!';
        configFeedback.className = 'feedback-text success';
      }
      if (btnSaveConfig) btnSaveConfig.disabled = false;

      await loadWaDispatcherStatus();

    } catch (err) {
      if (configFeedback) {
        configFeedback.textContent = `Erro de conexão: ${err.message}`;
        configFeedback.className = 'feedback-text error';
      }
      if (btnSaveConfig) btnSaveConfig.disabled = false;
    }
  });

  // Validação Ativa de WhatsApp dos Leads (wa-checker.js Baileys Nativo)
  safeListen(btnValidateLeadsWa, 'click', async () => {
    if (btnValidateLeadsWa) btnValidateLeadsWa.disabled = true;
    if (waValidationFeedback) {
      waValidationFeedback.textContent = 'Consultando o WhatsApp Baileys Nativo para validar leads (fixos e celulares)...';
      waValidationFeedback.className = 'feedback-text';
    }

    try {
      const res = await fetch('/api/dashboard/validate-leads-wa', { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (waValidationFeedback) {
          waValidationFeedback.textContent = `Erro: ${data.error || 'Falha ao validar WhatsApp'}`;
          waValidationFeedback.className = 'feedback-text error';
        }
        if (btnValidateLeadsWa) btnValidateLeadsWa.disabled = false;
        return;
      }

      if (waValidationFeedback) {
        waValidationFeedback.textContent = data.message || 'Leads validados com sucesso!';
        waValidationFeedback.className = 'feedback-text success';
      }
      if (btnValidateLeadsWa) btnValidateLeadsWa.disabled = false;

      await loadLeads();
      await loadStats();

    } catch (err) {
      if (waValidationFeedback) {
        waValidationFeedback.textContent = `Falha de rede: ${err.message}`;
        waValidationFeedback.className = 'feedback-text error';
      }
      if (btnValidateLeadsWa) btnValidateLeadsWa.disabled = false;
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
    if (settingsModal) settingsModal.classList.remove('hidden');
    switchSettingsTab(defaultTab);
    loadAccounts();
    loadConfig();
  }

  function closeSettingsModal() {
    if (settingsModal) settingsModal.classList.add('hidden');
  }

  function switchSettingsTab(tab) {
    if (tab === 'accounts') {
      if (btnTabAccounts) btnTabAccounts.classList.add('active');
      if (btnTabApis) btnTabApis.classList.remove('active');
      if (tabAccountsContent) tabAccountsContent.classList.remove('hidden');
      if (tabApisContent) tabApisContent.classList.add('hidden');
    } else {
      if (btnTabApis) btnTabApis.classList.add('active');
      if (btnTabAccounts) btnTabAccounts.classList.remove('active');
      if (tabApisContent) tabApisContent.classList.remove('hidden');
      if (tabAccountsContent) tabAccountsContent.classList.add('hidden');
    }
  }

  safeListen(btnOpenSettings, 'click', () => openSettingsModal('accounts'));
  safeListen(kpiAccountsCard, 'click', () => openSettingsModal('accounts'));
  safeListen(settingsModalClose, 'click', closeSettingsModal);
  safeListen(settingsModalBtnClose, 'click', closeSettingsModal);
  safeListen(btnTabAccounts, 'click', () => switchSettingsTab('accounts'));
  safeListen(btnTabApis, 'click', () => switchSettingsTab('apis'));
  safeListen(btnOpenWaModalFromSettings, 'click', () => {
    closeSettingsModal();
    openWhatsAppModal();
  });
  safeListen(btnOpenWaModalFromSettingsBig, 'click', () => {
    closeSettingsModal();
    openWhatsAppModal();
  });

  safeListen(settingsModal, 'click', (e) => {
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

  safeListen(modalClose, 'click', closeLeadModal);
  safeListen(modalBtnClose, 'click', closeLeadModal);
  safeListen(leadModal, 'click', (e) => {
    if (e.target === leadModal) closeLeadModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!leadModal.classList.contains('hidden')) closeLeadModal();
      if (!settingsModal.classList.contains('hidden')) closeSettingsModal();
      if (waModal && !waModal.classList.contains('hidden')) closeWhatsAppModal();
    }
  });

  // ============================================================================
  // 9. GERENCIAMENTO DO WHATSAPP BAILEYS NATIVO (MODAL, QR CODE & STATUS)
  // ============================================================================
  async function fetchWhatsAppStatus() {
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      if (!data.success) return null;
      renderWhatsAppStatus(data);
      return data;
    } catch (err) {
      console.warn('Erro ao consultar status WhatsApp:', err.message);
      return null;
    }
  }

  async function fetchWhatsAppQr() {
    try {
      const res = await fetch('/api/whatsapp/qr');
      const data = await res.json();
      if (!data.success) return null;
      renderWhatsAppStatus(data, data.qr);
      return data;
    } catch (err) {
      console.warn('Erro ao obter QR Code do WhatsApp:', err.message);
      return null;
    }
  }

  function renderWhatsAppStatus(status, qrDataUrl = null) {
    if (!status) return;
    const qr = qrDataUrl || status.qrCode;

    // 1. Atualiza indicador da Topbar & Card da Aba de Mensagens
    if (status.connected) {
      if (waPulseDot) {
        waPulseDot.style.backgroundColor = 'var(--emerald)';
        waPulseDot.style.boxShadow = '0 0 6px var(--emerald)';
      }
      if (waStatusText) {
        waStatusText.textContent = 'WhatsApp: Conectado';
        waStatusText.style.color = 'var(--emerald)';
      }
      if (waStatusMeta) {
        waStatusMeta.textContent = status.user ? `+${status.user}` : 'Ativo';
      }
      if (settingsWaPulseDot) {
        settingsWaPulseDot.style.backgroundColor = 'var(--emerald)';
        settingsWaPulseDot.style.boxShadow = '0 0 6px var(--emerald)';
      }
      if (settingsWaConnectionStatusText) {
        settingsWaConnectionStatusText.textContent = status.user
          ? `Conectado ao número +${status.user}. Alertas e disparos operando normalmente.`
          : 'Conectado e ativo para envio de alertas e abordagens.';
        settingsWaConnectionStatusText.style.color = 'var(--emerald)';
      }
    } else if (status.state === 'QR_READY') {
      if (waPulseDot) {
        waPulseDot.style.backgroundColor = 'var(--amber)';
        waPulseDot.style.boxShadow = '0 0 6px var(--amber)';
      }
      if (waStatusText) {
        waStatusText.textContent = 'WhatsApp: Ler QR Code';
        waStatusText.style.color = 'var(--amber)';
      }
      if (waStatusMeta) {
        waStatusMeta.textContent = 'Aguardando';
      }
      if (settingsWaPulseDot) {
        settingsWaPulseDot.style.backgroundColor = 'var(--amber)';
        settingsWaPulseDot.style.boxShadow = '0 0 6px var(--amber)';
      }
      if (settingsWaConnectionStatusText) {
        settingsWaConnectionStatusText.textContent = 'Aguardando leitura do QR Code no celular. Clique no botão ao lado para escanear.';
        settingsWaConnectionStatusText.style.color = 'var(--amber)';
      }
    } else if (status.state === 'CONNECTING') {
      if (waPulseDot) {
        waPulseDot.style.backgroundColor = 'var(--blue)';
        waPulseDot.style.boxShadow = '0 0 6px var(--blue)';
      }
      if (waStatusText) {
        waStatusText.textContent = 'WhatsApp: Conectando...';
        waStatusText.style.color = 'var(--blue)';
      }
      if (waStatusMeta) {
        waStatusMeta.textContent = 'Aguarde';
      }
      if (settingsWaPulseDot) {
        settingsWaPulseDot.style.backgroundColor = 'var(--blue)';
        settingsWaPulseDot.style.boxShadow = '0 0 6px var(--blue)';
      }
      if (settingsWaConnectionStatusText) {
        settingsWaConnectionStatusText.textContent = 'Inicializando socket local Baileys...';
        settingsWaConnectionStatusText.style.color = 'var(--blue)';
      }
    } else {
      if (waPulseDot) {
        waPulseDot.style.backgroundColor = 'var(--red)';
        waPulseDot.style.boxShadow = '0 0 6px var(--red)';
      }
      if (waStatusText) {
        waStatusText.textContent = 'WhatsApp: Desconectado';
        waStatusText.style.color = 'var(--red)';
      }
      if (waStatusMeta) {
        waStatusMeta.textContent = 'Ler QR';
      }
      if (settingsWaPulseDot) {
        settingsWaPulseDot.style.backgroundColor = 'var(--red)';
        settingsWaPulseDot.style.boxShadow = '0 0 6px var(--red)';
      }
      if (settingsWaConnectionStatusText) {
        settingsWaConnectionStatusText.textContent = 'WhatsApp desconectado. Clique no botão ao lado para ler o QR Code.';
        settingsWaConnectionStatusText.style.color = 'var(--text-secondary)';
      }
    }

    // 2. Atualiza Modal se estiver aberto
    if (waModal && !waModal.classList.contains('hidden')) {
      waStatusBanner.className = 'wa-status-box';

      if (status.connected) {
        waStatusBanner.classList.add('connected');
        if (waModalPulseDot) {
          waModalPulseDot.style.backgroundColor = 'var(--emerald)';
          waModalPulseDot.style.boxShadow = '0 0 6px var(--emerald)';
        }
        if (waModalStatusTitle) {
          waModalStatusTitle.textContent = 'Conectado com Sucesso!';
          waModalStatusTitle.style.color = 'var(--emerald)';
        }
        if (waModalStatusDesc) {
          waModalStatusDesc.textContent = `Operando número +${status.user || 'autenticado'}. Disparos e validações ativos.`;
        }

        if (waQrImage) waQrImage.style.display = 'none';
        if (waQrSpinner) waQrSpinner.style.display = 'none';
        if (waConnectedNotice) waConnectedNotice.style.display = 'flex';
        if (waConnectedPhoneDisplay) waConnectedPhoneDisplay.textContent = status.user ? `+${status.user}` : 'Número Conectado';
      } else if (status.state === 'QR_READY' && qr) {
        waStatusBanner.classList.add('qr-ready');
        if (waModalPulseDot) {
          waModalPulseDot.style.backgroundColor = 'var(--amber)';
          waModalPulseDot.style.boxShadow = '0 0 6px var(--amber)';
        }
        if (waModalStatusTitle) {
          waModalStatusTitle.textContent = 'QR Code Pronto para Leitura';
          waModalStatusTitle.style.color = 'var(--amber)';
        }
        if (waModalStatusDesc) {
          waModalStatusDesc.textContent = 'Aponte a câmera do WhatsApp para autenticar.';
        }

        if (waConnectedNotice) waConnectedNotice.style.display = 'none';
        if (waQrSpinner) waQrSpinner.style.display = 'none';
        if (waQrImage) {
          waQrImage.src = qr;
          waQrImage.style.display = 'block';
        }
      } else if (status.state === 'CONNECTING') {
        waStatusBanner.classList.add('connecting');
        if (waModalPulseDot) {
          waModalPulseDot.style.backgroundColor = 'var(--blue)';
          waModalPulseDot.style.boxShadow = '0 0 6px var(--blue)';
        }
        if (waModalStatusTitle) {
          waModalStatusTitle.textContent = 'Conectando ao WhatsApp...';
          waModalStatusTitle.style.color = 'var(--blue)';
        }
        if (waModalStatusDesc) {
          waModalStatusDesc.textContent = 'Inicializando socket local Baileys...';
        }

        if (waConnectedNotice) waConnectedNotice.style.display = 'none';
        if (waQrImage) waQrImage.style.display = 'none';
        if (waQrSpinner) waQrSpinner.style.display = 'flex';
      } else {
        waStatusBanner.classList.add('disconnected');
        if (waModalPulseDot) {
          waModalPulseDot.style.backgroundColor = 'var(--red)';
          waModalPulseDot.style.boxShadow = '0 0 6px var(--red)';
        }
        if (waModalStatusTitle) {
          waModalStatusTitle.textContent = 'Sessão Desconectada';
          waModalStatusTitle.style.color = 'var(--red)';
        }
        if (waModalStatusDesc) {
          waModalStatusDesc.textContent = 'Clique em "Regerar QR / Reconectar" para iniciar nova sessão.';
        }

        if (waConnectedNotice) waConnectedNotice.style.display = 'none';
        if (waQrImage) waQrImage.style.display = 'none';
        if (waQrSpinner) waQrSpinner.style.display = 'flex';
      }
    }
  }

  function openWhatsAppModal() {
    if (!waModal) return;
    waModal.classList.remove('hidden');
    fetchWhatsAppQr();

    if (waModalPollInterval) clearInterval(waModalPollInterval);
    waModalPollInterval = setInterval(fetchWhatsAppQr, 2500);
  }

  function closeWhatsAppModal() {
    if (!waModal) return;
    waModal.classList.add('hidden');
    if (waModalPollInterval) {
      clearInterval(waModalPollInterval);
      waModalPollInterval = null;
    }
  }

  safeListen(btnWaIndicator, 'click', openWhatsAppModal);
  safeListen(btnWaIndicator, 'keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openWhatsAppModal();
    }
  });
  safeListen(waModalClose, 'click', closeWhatsAppModal);
  safeListen(waModal, 'click', (e) => {
    if (e.target === waModal) closeWhatsAppModal();
  });

  safeListen(btnWaRefreshQr, 'click', async () => {
    if (waModalStatusTitle) waModalStatusTitle.textContent = 'Reiniciando motor Baileys...';
    if (waQrImage) waQrImage.style.display = 'none';
    if (waQrSpinner) waQrSpinner.style.display = 'flex';
    try {
      await fetch('/api/whatsapp/reconnect', { method: 'POST' });
      setTimeout(fetchWhatsAppQr, 1000);
    } catch (err) {
      console.error('Erro ao reconectar WhatsApp:', err);
    }
  });

  safeListen(btnWaDisconnectSession, 'click', async () => {
    if (!confirm('Deseja realmente desconectar o WhatsApp e limpar as credenciais salvas?')) {
      return;
    }
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      await fetchWhatsAppQr();
      await fetchWhatsAppStatus();
    } catch (err) {
      console.error('Erro ao desconectar WhatsApp:', err);
    }
  });

  // ============================================================================
  // FILA DE DISPARO AUTOMÁTICO WHATSAPP (BAILEYS NATIVO)
  // ============================================================================
  async function loadWaDispatcherStatus() {
    if (!waDispatcherStatusBadge) return;
    try {
      const res = await fetch('/api/dashboard/whatsapp-dispatcher/status');
      const data = await res.json();
      if (!data.success || !data.status) return;

      const s = data.status;
      if (waDispatcherPendingCount) waDispatcherPendingCount.textContent = s.pendingCount || 0;
      if (waDispatcherSentToday) waDispatcherSentToday.textContent = s.sentToday || 0;

      if (s.isRunning) {
        waDispatcherStatusBadge.className = 'status-pill running';
        waDispatcherStatusBadge.textContent = 'Ativa (Enviando)';
        if (waDispatcherBtnText) waDispatcherBtnText.textContent = 'Pausar Fila de Disparo';
        if (btnToggleWaDispatcher) btnToggleWaDispatcher.className = 'btn btn-secondary-dark btn-sm';
        if (waDispatcherIcon) {
          waDispatcherIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
        }
      } else {
        waDispatcherStatusBadge.className = 'status-pill idle';
        waDispatcherStatusBadge.textContent = 'Pausada';
        if (waDispatcherBtnText) waDispatcherBtnText.textContent = 'Ligar Fila de Disparo';
        if (btnToggleWaDispatcher) btnToggleWaDispatcher.className = 'btn btn-secondary btn-sm';
        if (waDispatcherIcon) {
          waDispatcherIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
        }
      }

      if (s.lastError) {
        waDispatcherFeedback.textContent = s.lastError;
        waDispatcherFeedback.className = 'feedback-text error';
      } else if (s.isRunning) {
        waDispatcherFeedback.textContent = s.currentLead ? `Abordando: ${s.currentLead.company_name || s.currentLead.phone}...` : 'Aguardando próximo ciclo seguro...';
        waDispatcherFeedback.className = 'feedback-text success';
      } else {
        waDispatcherFeedback.textContent = '';
      }
    } catch (err) {
      console.error('Erro ao consultar status da fila WhatsApp:', err);
    }
  }

  safeListen(btnToggleWaDispatcher, 'click', async () => {
    if (btnToggleWaDispatcher) btnToggleWaDispatcher.disabled = true;
    try {
      const res = await fetch('/api/dashboard/whatsapp-dispatcher/toggle', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.status) {
        await loadWaDispatcherStatus();
      }
    } catch (err) {
      console.error('Erro ao alternar fila WhatsApp:', err);
    } finally {
      if (btnToggleWaDispatcher) btnToggleWaDispatcher.disabled = false;
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
      await loadWaDispatcherStatus();
    }, 2500);
  }

  safeListen(filterSearch, 'input', renderLeadsTable);
  safeListen(filterSource, 'change', renderLeadsTable);
  safeListen(filterStatus, 'change', renderLeadsTable);

  safeListen(btnClearAllLeads, 'click', async () => {
    if (!confirm('Deseja realmente LIMPAR TODOS os leads cadastrados e seus históricos de conversa? Esta ação não pode ser desfeita.')) {
      return;
    }
    try {
      const res = await fetch('/api/dashboard/leads', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(`Erro ao limpar leads: ${data.error || 'Falha no servidor'}`);
        return;
      }
      await loadLeads();
      await loadStats();
    } catch (err) {
      alert(`Falha de conexão: ${err.message}`);
    }
  });

  safeListen(btnRefreshAll, 'click', async () => {
    if (btnRefreshAll) btnRefreshAll.style.opacity = '0.5';
    await loadStats();
    await loadLeads();
    await loadExports();
    await pollLogs();
    await fetchWhatsAppStatus();
    await loadWaDispatcherStatus();
    if (btnRefreshAll) btnRefreshAll.style.opacity = '1';
  });

  safeListen(btnRefreshExports, 'click', loadExports);

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ============================================================================
  // AUTENTICAÇÃO DO PAINEL OPERACIONAL (ADMIN_PASSWORD)
  // ============================================================================
  function showLoginOverlay() {
    if (!loginOverlay) return;
    loginOverlay.classList.remove('hidden');
    if (loginPassword) {
      loginPassword.value = '';
      setTimeout(() => loginPassword.focus(), 150);
    }
  }

  function hideLoginOverlay() {
    if (!loginOverlay) return;
    loginOverlay.classList.add('hidden');
  }

  safeListen(formLogin, 'submit', async (e) => {
    e.preventDefault();
    const password = loginPassword ? loginPassword.value.trim() : '';
    if (!password) return;

    if (btnLoginSubmit) btnLoginSubmit.disabled = true;
    if (loginFeedback) {
      loginFeedback.textContent = 'Verificando credenciais...';
      loginFeedback.className = 'feedback-text';
    }

    try {
      const res = await originalFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (loginFeedback) {
          loginFeedback.textContent = data.error || 'Senha incorreta.';
          loginFeedback.className = 'feedback-text error';
        }
        if (btnLoginSubmit) btnLoginSubmit.disabled = false;
        return;
      }

      if (loginFeedback) {
        loginFeedback.textContent = 'Autenticado com sucesso!';
        loginFeedback.className = 'feedback-text success';
      }
      localStorage.setItem('legado_admin_token', data.token);

      setTimeout(() => {
        hideLoginOverlay();
        if (btnLoginSubmit) btnLoginSubmit.disabled = false;
        if (loginFeedback) loginFeedback.textContent = '';
        // Carrega painel
        loadStats();
        loadLeads();
        loadExports();
        pollLogs();
        fetchWhatsAppStatus();
        loadWaDispatcherStatus();
      }, 400);

    } catch (err) {
      if (loginFeedback) {
        loginFeedback.textContent = `Erro de conexão: ${err.message}`;
        loginFeedback.className = 'feedback-text error';
      }
      if (btnLoginSubmit) btnLoginSubmit.disabled = false;
    }
  });

  safeListen(btnLogout, 'click', async () => {
    if (!confirm('Deseja encerrar a sessão do painel operacional?')) return;
    try {
      await originalFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('legado_admin_token');
    showLoginOverlay();
  });

  // Inicialização com Verificação de Autenticação
  async function checkInitialAuth() {
    const token = localStorage.getItem('legado_admin_token');
    if (!token) {
      showLoginOverlay();
      return;
    }

    try {
      const res = await originalFetch('/api/auth/verify', {
        headers: { 'x-admin-token': token }
      });
      const data = await res.json();
      if (!res.ok || !data.authenticated) {
        showLoginOverlay();
        return;
      }

      // Autenticado com sucesso
      hideLoginOverlay();
      loadStats();
      loadLeads();
      loadExports();
      pollLogs();
      fetchWhatsAppStatus();
      loadWaDispatcherStatus();

      // Loop de polling de heartbeat a cada 3s (somente se autenticado)
      setInterval(() => {
        if (loginOverlay && !loginOverlay.classList.contains('hidden')) return;
        loadStats();
        pollLogs();
        fetchWhatsAppStatus();
        loadWaDispatcherStatus();
      }, 3000);

    } catch {
      showLoginOverlay();
    }
  }

  checkInitialAuth();
});

