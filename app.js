// ==========================================================================
// Legado Performance — Interactive Simulator & UI Logic
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  const slider = document.getElementById('leadsSlider');
  const sliderValue = document.getElementById('sliderValue');
  const monthlyLeads = document.getElementById('monthlyLeads');
  const qualifiedLeads = document.getElementById('qualifiedLeads');
  const whatsappOpps = document.getElementById('whatsappOpps');
  const sdrMeetings = document.getElementById('sdrMeetings');

  function updateCalculator() {
    if (!slider) return;
    const daily = parseInt(slider.value, 10);
    const monthly = daily * 30;
    const qualified = Math.round(monthly * 0.65);
    const whatsapp = Math.round(monthly * 0.30);
    const meetings = Math.round(whatsapp * 0.20);

    sliderValue.textContent = `${daily} leads/dia`;
    monthlyLeads.textContent = monthly.toLocaleString('pt-BR');
    qualifiedLeads.textContent = qualified.toLocaleString('pt-BR');
    whatsappOpps.textContent = whatsapp.toLocaleString('pt-BR');
    sdrMeetings.textContent = meetings.toLocaleString('pt-BR');
  }

  if (slider) {
    slider.addEventListener('input', updateCalculator);
    updateCalculator(); // Initialize on load
  }

  // Smooth scroll for internal links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
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

  console.log('🚀 Legado Performance AI Engine — Landing Page Carregada com Sucesso.');
});
