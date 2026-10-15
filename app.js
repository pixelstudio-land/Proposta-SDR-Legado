// ==========================================================================
// Máquina Comercial Legado — Lógica do Simulador e Interações da Apresentação
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Simulador de Funil Sequencial (Lógica de Performance Comercial)
  const slider = document.getElementById('leadsSlider');
  const sliderValue = document.getElementById('sliderValue');
  const monthlyLeads = document.getElementById('monthlyLeads');
  const engagedLeads = document.getElementById('engagedLeads');
  const whatsappOpps = document.getElementById('whatsappOpps');
  const sdrMeetings = document.getElementById('sdrMeetings');

  function updateCalculator() {
    if (!slider) return;
    const daily = parseInt(slider.value, 10);
    
    // Etapa 1: Volume Total de Contatos no Direct
    const monthly = daily * 30;
    
    // Etapa 2: Triagem Concluída pela IA (70% engajam e respondem às perguntas)
    const engaged = Math.round(monthly * 0.70);
    
    // Etapa 3: Aprovados no ICP & Disparados via Webhook ao WhatsApp (35% dos triados)
    const qualified = Math.round(engaged * 0.35);
    
    // Etapa 4: Reuniões Agendadas pelo SDR Humano (25% dos leads aprovados)
    const meetings = Math.round(qualified * 0.25);

    sliderValue.textContent = `${daily} contatos/dia`;
    monthlyLeads.textContent = monthly.toLocaleString('pt-BR');
    engagedLeads.textContent = engaged.toLocaleString('pt-BR');
    whatsappOpps.textContent = qualified.toLocaleString('pt-BR');
    sdrMeetings.textContent = meetings.toLocaleString('pt-BR');
  }

  if (slider) {
    slider.addEventListener('input', updateCalculator);
    updateCalculator();
  }

  // 2. Modal de Especificação Técnica (Substituição de arquivo .md bruto)
  const openSpecBtn = document.getElementById('openSpecBtn');
  const closeSpecBtn = document.getElementById('closeSpecBtn');
  const specModal = document.getElementById('specModal');

  if (openSpecBtn && specModal) {
    openSpecBtn.addEventListener('click', (e) => {
      e.preventDefault();
      specModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  }

  if (closeSpecBtn && specModal) {
    closeSpecBtn.addEventListener('click', () => {
      specModal.classList.remove('active');
      document.body.style.overflow = '';
    });

    specModal.addEventListener('click', (e) => {
      if (e.target === specModal) {
        specModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  // 3. Scroll suave para links internos
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '') return;
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  console.log('Máquina Comercial Legado carregada com sucesso.');
});
