const fs = require('fs');
const path = require('path');

const modelsData = [
  // 1. ODONTOLOGIA & SAÚDE
  {
    id: 'odonto-estetica',
    category: 'odontologia',
    title: 'Odonto Prime (Estética & Implantes)',
    desc: 'Estrutura premium focada em procedimentos de alto ticket: clareamento a laser, facetas em resina, lentes de porcelana e implantes guiados.',
    tag: 'Mais Pedido',
    previewImg: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/odonto-prime/index.html',
    highlights: ['Agendamento no WhatsApp', 'Galeria de Casos Reais', 'Carregamento em 0.8s', 'Depoimentos em Destaque'],
    demoContent: {
      headline: 'Transforme o seu sorriso com estética dental avançada',
      sub: 'Atendimento humanizado, tecnologia de ponta e especialistas prontos para cuidar do seu sorriso.',
      ctaText: 'Agendar Consulta de Avaliação no WhatsApp',
      services: [
        { title: 'Lentes e Facetas de Contato', desc: 'Harmonia perfeita e naturalidade para o seu sorriso.' },
        { title: 'Implantes Dentários Guiados', desc: 'Recuperação estética e mastigatória sem dor.' },
        { title: 'Clareamento Dental a Laser', desc: 'Resultados visíveis e seguros desde a primeira sessão.' }
      ]
    }
  },
  {
    id: 'odonto-clinica-geral',
    category: 'odontologia',
    title: 'Clínica Odontológica & Família',
    desc: 'Ideal para clínicas com equipe multidisciplinar: odontopediatria, ortodontia, próteses e prevenção bucal.',
    tag: 'Alta Conversão',
    previewImg: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Apresentação do Corpo Clínico', 'Convênios & Formas de Pagamento', 'Localização com Mapa', 'Atendimento Humanizado'],
    demoContent: {
      headline: 'Cuidado odontológico completo para toda a sua família',
      sub: 'Clínica multidisciplinar com horários flexíveis e atendimento emergencial.',
      ctaText: 'Falar com a Recepção no WhatsApp',
      services: [
        { title: 'Ortodontia & Alinhadores', desc: 'Correção rápida e discreta para adultos e jovens.' },
        { title: 'Odontopediatria Acolhedora', desc: 'Cuidado lúdico e sem traumas para os pequenos.' },
        { title: 'Tratamento de Canal & Restaurações', desc: 'Alívio imediato e máxima conservação dental.' }
      ]
    }
  },
  {
    id: 'odonto-alinhadores',
    category: 'odontologia',
    title: 'Ortodontia Digital & Alinhadores Invisíveis',
    desc: 'Página moderna focada em tratamentos ortodônticos estéticos, escaneamento intraoral e comparação antes e depois.',
    tag: 'Tecnologia',
    previewImg: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Simulador 3D do Sorriso', 'Foco em Discrição & Conforto', 'Depoimentos de Pacientes', 'Parcelamento Facilitado'],
    demoContent: {
      headline: 'Alinhe seus dentes com total discrição e conforto',
      sub: 'Sem peças metálicas, sem dor e com tecnologia de escaneamento 3D.',
      ctaText: 'Solicitar Simulação 3D no WhatsApp',
      services: [
        { title: 'Alinhadores Invisíveis Removíveis', desc: 'Liberdade para comer e higienizar sem incômodos.' },
        { title: 'Escaneamento Digital em 15 Minutos', desc: 'Veja a previsão do seu novo sorriso na primeira consulta.' },
        { title: 'Aparelhos Autoligados Estéticos', desc: 'Movimentação rápida e porcelana transparente.' }
      ]
    }
  },
  {
    id: 'odonto-pediatria',
    category: 'odontologia',
    title: 'Odontopediatria & Espaço Kids',
    desc: 'Visual acolhedor e reconfortante para mães e pais agendarem a consulta dos filhos com tranquilidade e sem medo.',
    tag: 'Público Família',
    previewImg: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Ambiente Sem Estresse', 'Orientações para os Pais', 'Sala Temática Infantil', 'Agendamento Flexível'],
    demoContent: {
      headline: 'O primeiro dentinho do seu filho cuidado com carinho e amor',
      sub: 'Dentistas especializados em odontopediatria com atendimento acolhedor.',
      ctaText: 'Agendar Consulta Infantil no WhatsApp',
      services: [
        { title: 'Check-up Preventivo Baby & Kids', desc: 'Prevenção de cáries e orientação precoce para os pais.' },
        { title: 'Aplicação de Flúor & Selantes', desc: 'Proteção reforçada para os dentes de leite e permanentes.' },
        { title: 'Tratamento de Traumas e Emergências', desc: 'Atendimento calmo e rápido para quedas e acidentes.' }
      ]
    }
  },
  {
    id: 'clinica-medica-integrada',
    category: 'odontologia',
    title: 'Policlínica Médica & Exames',
    desc: 'Apresentação de especialidades médicas (cardiologia, ginecologia, dermatologia, ultrassom e exames laboratoriais).',
    tag: 'Alta Demanda',
    previewImg: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Múltiplas Especialidades', 'Agendamento Unificado', 'Resultados de Exames', 'Estrutura Completa'],
    demoContent: {
      headline: 'Consultas médicas e exames em um só lugar com agilidade',
      sub: 'Mais de 15 especialidades com preços acessíveis e agendamento sem filas.',
      ctaText: 'Consultar Horários Disponíveis no WhatsApp',
      services: [
        { title: 'Consultas Médicas Especializadas', desc: 'Cardiologia, ginecologia, ortopedia, clínico geral e mais.' },
        { title: 'Ultrassonografia & Eletrocardiograma', desc: 'Equipamentos modernos com laudos rápidos e precisos.' },
        { title: 'Exames Laboratoriais Completos', desc: 'Coletas de sangue, urina e hormonais com entrega online.' }
      ]
    }
  },
  {
    id: 'fisioterapia-pilates',
    category: 'odontologia',
    title: 'Studio de Pilates & Fisioterapia',
    desc: 'Alívio de dores nas costas, reabilitação postural, fisioterapia esportiva e pilates clínico com avaliação individual.',
    tag: 'Saúde & Bem-Estar',
    previewImg: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Avaliação Postural Gratuita', 'Turmas de até 3 Alunos', 'Reabilitação de Coluna', 'Fisioterapeutas Dedicados'],
    demoContent: {
      headline: 'Viva sem dores na coluna e recupere sua mobilidade e postura',
      sub: 'Aulas personalizadas de Pilates com fisioterapeutas pós-graduados.',
      ctaText: 'Agendar Aula Experimental no WhatsApp',
      services: [
        { title: 'Pilates Clínico em Aparelhos', desc: 'Exercícios orientados para fortalecimento lombar e flexibilidade.' },
        { title: 'Fisioterapia Traumato-Ortopédica', desc: 'Tratamento de hérnia de disco, tendinites e recuperação pós-cirúrgica.' },
        { title: 'Liberação Miofascial & Dry Needling', desc: 'Alívio imediato de tensões musculares, nódulos e contraturas.' }
      ]
    }
  },
  {
    id: 'psicologia-terapia',
    category: 'odontologia',
    title: 'Clínica de Psicologia & Psicoterapia',
    desc: 'Ambiente seguro e acolhedor para terapia individual, de casal e online, com foco em ansiedade, burnout e autoconhecimento.',
    tag: 'Acolhimento',
    previewImg: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/psicologia-clinica/index.html',
    highlights: ['Atendimento Online e Presencial', 'Sigilo Ético Absoluto', 'Terapia Cognitivo-Comportamental', 'Primeira Sessão Acessível'],
    demoContent: {
      headline: 'Um espaço seguro e sigiloso para cuidar da sua saúde mental',
      sub: 'Psicólogos clínicos especialistas em ansiedade, depressão e relacionamentos.',
      ctaText: 'Agendar Primeira Sessão no WhatsApp',
      services: [
        { title: 'Psicoterapia Individual para Adultos', desc: 'Abordagens modernas para lidar com estresse, ansiedade e tomada de decisões.' },
        { title: 'Terapia de Casal e Conflitos', desc: 'Mediação de comunicação, superação de crises e fortalecimento do vínculo.' },
        { title: 'Atendimento Psicológico Online', desc: 'Sessões confortáveis por videochamada com a mesma eficácia presencial.' }
      ]
    }
  },

  // 2. GASTRONOMIA & DELIVERY
  {
    id: 'burger-delivery',
    category: 'gastronomia',
    title: 'Burger Artesanal & Smash Burger',
    desc: 'Página moderna focada em fotos apetitosas e recepção de pedidos no WhatsApp com cardápio interativo e sem taxas de app.',
    tag: 'Mais Pedido',
    previewImg: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/burger-artesanal/index.html',
    highlights: ['Cardápio Interativo com Fotos', 'Pedido Direto no WhatsApp', 'Cálculo de Entrega por Bairro', 'Zero Comissão de Apps'],
    demoContent: {
      headline: 'O melhor smash burger artesanal da cidade na sua casa',
      sub: 'Pão brioche selado, blend de carnes frescas e queijo derretido de verdade.',
      ctaText: 'Fazer Pedido no WhatsApp',
      services: [
        { title: 'Smash Duplo Cheddar Bacon', desc: 'Dois discos de 90g ultra esmagados com crosta perfeita e muito bacon.' },
        { title: 'Clássico Artesanal da Casa', desc: 'Blend 160g suculento, cebola caramelizada e maionese secreta.' },
        { title: 'Batata Rústica com Páprica', desc: 'Crocante por fora e macia por dentro com molho especial.' }
      ]
    }
  },
  {
    id: 'pizzaria-tradicional',
    category: 'gastronomia',
    title: 'Pizzaria Forno a Lenha & Delivery',
    desc: 'Cardápio visual com escolha de 2 sabores, bordas recheadas, refrigerantes e fechamento direto no WhatsApp.',
    tag: 'Alta Conversão',
    previewImg: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/pizzaria-forno/index.html',
    highlights: ['Montagem Meio a Meio', 'Seletor de Borda Recheada', 'Promoções Diárias', 'Tempo Médio de Entrega'],
    demoContent: {
      headline: 'Pizzas artesanais de fermentação lenta assadas no forno a lenha',
      sub: 'Massa crocante, molho de tomate pelado italiano e queijo de verdade.',
      ctaText: 'Ver Cardápio e Pedir no WhatsApp',
      services: [
        { title: 'Pizzas Tradicionais e Especiais', desc: 'Mais de 30 sabores clássicos com ingredientes selecionados.' },
        { title: 'Bordas Vulcão e Recheadas', desc: 'Catupiry original, cheddar cremoso e chocolate belga.' },
        { title: 'Combos Família com Refrigerante', desc: 'Pizza grande + broto doce + guaraná com super desconto.' }
      ]
    }
  },
  {
    id: 'sushi-bar',
    category: 'gastronomia',
    title: 'Sushi Contemporâneo & Comida Japonesa',
    desc: 'Design refinado e sofisticado com foco em combinados de salmão fresco, hot rolls e festivais orientais.',
    tag: 'Gourmet',
    previewImg: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/sushi-contemporaneo/index.html',
    highlights: ['Embalagens Térmicas Premium', 'Salmão Fresco do Dia', 'Combinados para Casal e Família', 'Opções Vegetarianas'],
    demoContent: {
      headline: 'A melhor experiência da culinária japonesa na sua mesa',
      sub: 'Peixes frescos selecionados diariamente, cortes precisos e sabor inigualável.',
      ctaText: 'Pedir Combinado Japonês no WhatsApp',
      services: [
        { title: 'Combinado do Chef 40 Peças', desc: 'Variedade impecável de sashimis, uramakis, niguiris e jows especiais.' },
        { title: 'Hot Rolls Crocantes com Cream Cheese', desc: 'Empanados na hora com molho tarê artesanal e cebolinha.' },
        { title: 'Temakis Especiais sem Arroz', desc: 'Puro salmão em cubos com cream cheese e amêndoas laminadas.' }
      ]
    }
  },
  {
    id: 'churrascaria-espetaria',
    category: 'gastronomia',
    title: 'Churrascaria, Espetaria & Carnes Nobres',
    desc: 'Fotos de picanha na brasa, cortes nobres, marmitex executivas de churrasco e acompanhamentos caprichados.',
    tag: 'Sucesso Local',
    previewImg: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Cortes de Carnes Selecionados', 'Espetos Assados na Hora', 'Marmitex Executiva de Churrasco', 'Farofa e Vinagrete da Casa'],
    demoContent: {
      headline: 'Churrasco no ponto certo entregue quentinho na sua casa',
      sub: 'Cortes premium, espetos artesanais e acompanhamentos tradicionais.',
      ctaText: 'Pedir Churrasco no WhatsApp',
      services: [
        { title: 'Espetos Artesanais Variados', desc: 'Mais de 15 opções de espetos assados na brasa na hora.' },
        { title: 'Marmita Churrasco Picanha', desc: 'Arroz, feijão tropeiro, vinagrete, mandioca na manteiga e picanha suculenta.' },
        { title: 'Kits Churrasco para Fim de Semana', desc: 'Carnes temperadas prontas para assar com carvão e acompanhamentos.' }
      ]
    }
  },
  {
    id: 'marmitaria-fit',
    category: 'gastronomia',
    title: 'Marmitaria Saudável & Comida Fit Congelada',
    desc: 'Cardápio semanal de marmitas fitness ultracongeladas, cálculo de calorias e kits de 10, 14 ou 28 refeições práticas.',
    tag: 'Alta Recorrência',
    previewImg: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/marmitaria-fit/index.html',
    highlights: ['Kits Semanais e Mensais', 'Ingredientes 100% Naturais', 'Congelamento Ultrarrápido', 'Entrega Programada'],
    demoContent: {
      headline: 'Alimentação saudável, prática e deliciosa para a sua semana',
      sub: 'Marmitas fit elaboradas por nutricionistas sem conservantes artificiais.',
      ctaText: 'Ver Cardápio da Semana no WhatsApp',
      services: [
        { title: 'Kits Low Carb & Emagrecimento', desc: 'Combinações leves ricas em fibras e proteínas selecionadas.' },
        { title: 'Linha Hipertrofia & Ganho de Massa', desc: 'Porções generosas de frango, carne magra, batata doce e arroz integral.' },
        { title: 'Opções Vegetarianas & Veganas', desc: 'Cores, nutrientes e sabores equilibrados com grão-de-bico e lentilha.' }
      ]
    }
  },
  {
    id: 'confeitaria-doces',
    category: 'gastronomia',
    title: 'Doceria Gourmet, Bolos & Festas',
    desc: 'Vitrine visual para bolos decorados de aniversário, fatias gourmet, brigadeiros artesanais e encomendas de eventos.',
    tag: 'Visual Encantador',
    previewImg: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Encomenda de Bolos Personalizados', 'Docinhos Finos para Festas', 'Cardápio de Pronta-Entrega', 'Embalagens para Presente'],
    demoContent: {
      headline: 'Bolos e doces artesanais que transformam qualquer momento em festa',
      sub: 'Ingredientes de alta qualidade, recheios fartos e acabamento impecável.',
      ctaText: 'Fazer Encomenda no WhatsApp',
      services: [
        { title: 'Bolos Decorados sob Medida', desc: 'Massa fofinha, recheios nobres e decoração artística personalizada.' },
        { title: 'Cento de Brigadeiros Gourmet', desc: 'Pistache, ninho com nutella, belga ao leite e churros artesanal.' },
        { title: 'Fatias Supremas e Sobremesas', desc: 'Disponíveis diariamente para pronta-entrega rápida na sua casa.' }
      ]
    }
  },
  {
    id: 'cafeteria-brunch',
    category: 'gastronomia',
    title: 'Cafeteria Especial & Brunch',
    desc: 'Cardápio de cafés especiais, métodos de extração, croissants folhados e ambiente agradável para encontros e trabalho.',
    tag: 'Experiência',
    previewImg: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Grãos 100% Arábica Premiados', 'Croissants e Toast Artesanais', 'Ambiente com Wi-Fi Rápido', 'Opções Veganas e Sem Lactose'],
    demoContent: {
      headline: 'O café perfeito para desacelerar o seu dia com aconchego',
      sub: 'Grãos especiais de pequenos produtores e confeitaria artesanal diária.',
      ctaText: 'Ver Cardápio Completo no WhatsApp',
      services: [
        { title: 'Métodos de Extração Filtrados', desc: 'V60, Chemex, Prensa Francesa e Aeropress com notas sensoriais únicas.' },
        { title: 'Croissants Folhados na Manteiga', desc: 'Massa leve e crocante com opções doces e salgadas recheadas na hora.' },
        { title: 'Combos de Café da Manhã e Brunch', desc: 'Toast de avocado com ovos mexidos, suco natural e cappuccino cremoso.' }
      ]
    }
  },
  {
    id: 'acai-sorveteria',
    category: 'gastronomia',
    title: 'Açaíterias, Sorvetes & Taças Recheadas',
    desc: 'Montador interativo de copo de açaí (tamanho, acompanhamentos e caldas) com pedido calculado direto no WhatsApp.',
    tag: 'Jovem & Refrescante',
    previewImg: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Açaí Puro Sem Xarope', 'Mais de 30 Acompanhamentos', 'Copos de 300ml a 1 Litro', 'Entrega Rápida Sem Derreter'],
    demoContent: {
      headline: 'O açaí mais cremoso e recheado do seu bairro no WhatsApp',
      sub: 'Monte do seu jeito com frutas frescas, cremes artesanais e coberturas crocantes.',
      ctaText: 'Montar Meu Copo no WhatsApp',
      services: [
        { title: 'Copo Tradicional de Açaí', desc: 'Escolha seu tamanho e adicione leite condensado, paçoca e granola crocante.' },
        { title: 'Taças Vulcão Especiais', desc: 'Nutella pura, morangos selecionados, leite ninho e bombons triturados.' },
        { title: 'Sorvetes Artesanais por Quilo', desc: 'Potes de 1 litro e 2 litros com sabores clássicos e exclusivos da casa.' }
      ]
    }
  },

  // 3. BARBEARIA, BELEZA & ESTÉTICA
  {
    id: 'barbearia-premium',
    category: 'beleza',
    title: 'Barbearia Vintage & Espaço Masculino',
    desc: 'Ambiente clássico masculino com foco em corte degradê, barba na toalha quente, cerveja artesanal e agendamento sem espera.',
    tag: 'Mais Pedido',
    previewImg: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/barbearia-vintage/index.html',
    highlights: ['Agendamento em 2 Cliques', 'Tabela de Serviços & Valores', 'Barba Terapia com Toalha Quente', 'Avaliações de Clientes'],
    demoContent: {
      headline: 'O cuidado que seu visual merece com estilo, cerveja e tradição',
      sub: 'Barbeiros experientes, navalha afiada e ambiente exclusivo para você relaxar.',
      ctaText: 'Agendar Meu Horário no WhatsApp',
      services: [
        { title: 'Corte Cabelo Degradê Navalhado', desc: 'Acabamento milimétrico, fade moderno e finalização com pomada modeladora.' },
        { title: 'Barboterapia com Toalha Quente', desc: 'Esfoliação, óleo nutritivo, massagem facial e navalha tradicional.' },
        { title: 'Combo Cabelo + Barba + Sobrancelha', desc: 'Visual completo alinhado com desconto especial no pacote.' }
      ]
    }
  },
  {
    id: 'estetica-facial',
    category: 'beleza',
    title: 'Clínica de Estética & Harmonização Facial',
    desc: 'Visual refinado com foco em procedimentos como botox, preenchimento labial, bioestimuladores e limpeza de pele profunda.',
    tag: 'Alta Conversão',
    previewImg: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/clinica-estetica/index.html',
    highlights: ['Antes e Depois com Alta Resolução', 'Exclusividade e Privacidade', 'Produtos Originais Certificados', 'Avaliação Individualizada'],
    demoContent: {
      headline: 'Realce sua beleza natural com segurança, elegância e sutileza',
      sub: 'Procedimentos estéticos avançados realizados por profissionais biomédicos e dermatologistas.',
      ctaText: 'Agendar Consulta Estética no WhatsApp',
      services: [
        { title: 'Toxina Botulínica Preventiva e Reparadora', desc: 'Suavização de rugas de expressão na testa, glabela e pés de galinha.' },
        { title: 'Preenchimento Labial com Ácido Hialurônico', desc: 'Volume, contorno definido e hidratação sem perder a naturalidade.' },
        { title: 'Bioestimuladores de Colágeno', desc: 'Firmeza e rejuvenescimento profundo da pele com durabilidade de até 2 anos.' }
      ]
    }
  },
  {
    id: 'studio-beleza',
    category: 'beleza',
    title: 'Studio Hair, Loiras & Mega Hair',
    desc: 'Ideal para cabeleireiros especialistas em mechas, loiro platinado, morena iluminada, cronograma capilar e mega hair.',
    tag: 'Público Feminino',
    previewImg: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/studio-hair/index.html',
    highlights: ['Galeria de Loiras e Mechas', 'Avaliação de Saúde do Fio', 'Tratamentos de Reconstrução', 'Equipe de Cabeleireiros'],
    demoContent: {
      headline: 'O loiro dos seus sonhos com máxima saúde capilar e brilho',
      sub: 'Técnicas exclusivas de mechas sem quebra com produtos internacionais de ponta.',
      ctaText: 'Solicitar Teste de Mecha no WhatsApp',
      services: [
        { title: 'Mechas Criativas & Morena Iluminada', desc: 'Degradê suave que valoriza o tom de pele sem marcas grosseiras.' },
        { title: 'Alisamento Orgânico Sem Formol', desc: 'Cabelos lisos com brilho espelhado, balanço natural e zero agressão.' },
        { title: 'Mega Hair Fita Invisível', desc: 'Volume e comprimento instantâneos com acabamento imperceptível ao toque.' }
      ]
    }
  },
  {
    id: 'lash-sobrancelhas',
    category: 'beleza',
    title: 'Lash Designer & Micropigmentação',
    desc: 'Foco na extensão de cílios (volume russo, fio a fio, híbrido), design de sobrancelhas e nanoblading natural.',
    tag: 'Mais Vendido',
    previewImg: 'https://images.unsplash.com/photo-1512290900672-1f55a1532f6a?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/lash-sobrancelhas/index.html',
    highlights: ['Técnicas de Alta Durabilidade', 'Fios Leves de Seda', 'Design Personalizado para seu Rosto', 'Cuidados Pós-Aplicação'],
    demoContent: {
      headline: 'Olhar marcante, prático e acordar pronta todos os dias',
      sub: 'Extensão de cílios com isolamento perfeito e nanoblading hiper-realista.',
      ctaText: 'Agendar Meus Cílios no WhatsApp',
      services: [
        { title: 'Extensão de Cílios Volume Russo', desc: 'Fans montados à mão com leveza e densidade na medida certa.' },
        { title: 'Nanoblading Fio a Fio Realista', desc: 'Desenho de fios ultrafinos que preenchem falhas com total naturalidade.' },
        { title: 'Lash Lifting & Hidratação de Fios', desc: 'Curvatura e coloração dos próprios cílios naturais sem necessidade de cola.' }
      ]
    }
  },
  {
    id: 'esmalteria-unhas',
    category: 'beleza',
    title: 'Esmalteria & Spa dos Pés',
    desc: 'Unhas em gel, fibra de vidro, blindagem de diamante, nail art e spa dos pés com esfoliação e hidratação profunda.',
    tag: 'Sucesso Local',
    previewImg: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Alongamento em Fibra de Vidro', 'Materiais Esterilizados em Autoclave', 'Coleção de Esmaltes Importados', 'Horários Flexíveis'],
    demoContent: {
      headline: 'Unhas longas, resistentes e impecáveis por semanas a fio',
      sub: 'Alongamento em fibra de vidro e esmaltação em gel sem descascar.',
      ctaText: 'Agendar Horário de Manicure no WhatsApp',
      services: [
        { title: 'Alongamento em Fibra de Vidro', desc: 'Resistência incomparável, curvatura natural e formato impecável.' },
        { title: 'Blindagem de Diamante', desc: 'Camada protetora para unhas naturais crescerem sem quebras constantes.' },
        { title: 'Spa dos Pés com Parafina', desc: 'Remoção de calosidades, esfoliação relaxante e hidratação profunda.' }
      ]
    }
  },
  {
    id: 'depilacao-laser',
    category: 'beleza',
    title: 'Clínica de Depilação a Laser & LED',
    desc: 'Livre-se dos pelos e da foliculite com ponteira resfriada sem dor para mulheres e homens.',
    tag: 'Tecnologia',
    previewImg: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Ponteira Ultrarresfriada Sem Dor', 'Pacotes para Axilas, Pernas e Barba', 'Atendimento Masculino e Feminino', 'Fim da Foliculite'],
    demoContent: {
      headline: 'Pele lisa e livre de pelos definitivamente sem dor',
      sub: 'Laser com tecnologia de resfriamento duplo seguro para todos os fototipos.',
      ctaText: 'Garantir Pacote Promocional no WhatsApp',
      services: [
        { title: 'Depilação a Laser Axilas e Virilha', desc: 'Redução progressiva de 90% dos pelos já nas primeiras sessões.' },
        { title: 'Barba Masculina e Contorno de Pescoço', desc: 'Fim dos pelos encravados, vermelhidão e irritações de gilete.' },
        { title: 'Pacote Pernas Inteiras', desc: 'Liberdade total em viagens e no dia a dia com pele acetinada.' }
      ]
    }
  },
  {
    id: 'spa-massoterapia',
    category: 'beleza',
    title: 'Spa Urbano, Drenagem & Massagens',
    desc: 'Experiência de relaxamento profundo, drenagem linfática pós-operatória, massagem relaxante com pedras quentes e reflexologia.',
    tag: 'Relaxamento',
    previewImg: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Ambiente com Cromoterapia e Aromas', 'Drenagem Linfática Certificada', 'Day Spa para Casais e Noivas', 'Vale-Presente Disponível'],
    demoContent: {
      headline: 'Desconecte da rotina e renove suas energias corporais',
      sub: 'Massoterapeutas qualificadas em ambiente silencioso, aromatizado e acolhedor.',
      ctaText: 'Agendar Sessão de Massagem no WhatsApp',
      services: [
        { title: 'Massagem Relaxante com Pedras Quentes', desc: 'Alívio instantâneo de dores musculares, estresse mental e insônia.' },
        { title: 'Drenagem Linfática Método Renata França', desc: 'Eliminação imediata de retenção de líquidos e sensação de inchaço.' },
        { title: 'Day Spa Individual ou Casal', desc: 'Ritual completo com esfoliação corporal, banho de imersão e massagem.' }
      ]
    }
  },

  // 4. ADVOCACIA, IMÓVEIS & SERVIÇOS
  {
    id: 'advocacia-corporativa',
    category: 'servicos',
    title: 'Escritório de Advocacia Corporativa & Cível',
    desc: 'Design sóbrio e imponente de alto padrão com foco em consultoria empresarial, contratos, compliance e causas estratégicas.',
    tag: 'Mais Pedido',
    previewImg: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/advocacia-corporativa/index.html',
    highlights: ['Conformidade com Provimento OAB', 'Atendimento Rápido e Sigiloso', 'Especialistas por Área de Atuação', 'Consultoria Preventiva'],
    demoContent: {
      headline: 'Soluções jurídicas estratégicas para proteger sua empresa e patrimônio',
      sub: 'Assessoria jurídica com rigor técnico, ética e foco em resultados concretos.',
      ctaText: 'Agendar Consulta com Advogado no WhatsApp',
      services: [
        { title: 'Direito Empresarial & Contratos Comerciais', desc: 'Blindagem de sócios, elaboração e revisão segura de contratos complexos.' },
        { title: 'Contencioso Cível Estratégico', desc: 'Defesa vigorosa de interesses em litígios e cobranças empresariais.' },
        { title: 'Planejamento Sucessório e Patrimonial', desc: 'Proteção de bens e transmissão de patrimônio com economia tributária.' }
      ]
    }
  },
  {
    id: 'advocacia-trabalhista',
    category: 'servicos',
    title: 'Advocacia Trabalhista & Previdenciária',
    desc: 'Página voltada para orientação sobre direitos do trabalhador, horas extras, rescisão indireta, acidentes de trabalho e INSS.',
    tag: 'Alta Conversão',
    previewImg: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Tira-Dúvidas Rápido no WhatsApp', 'Atendimento Online para todo o Brasil', 'Cálculo de Rescisão Trabalhista', 'Planejamento de Aposentadoria'],
    demoContent: {
      headline: 'Defenda seus direitos trabalhistas e previdenciários com quem entende',
      sub: 'Análise detalhada do seu caso com agilidade e transparência total.',
      ctaText: 'Analisar Meu Caso no WhatsApp',
      services: [
        { title: 'Ações Trabalhistas & Rescisão de Contrato', desc: 'Cálculo exato de horas extras, adicionais de insalubridade e verbas rescisórias.' },
        { title: 'Aposentadorias e Benefícios do INSS', desc: 'Concessão, revisão de benefício negado e planejamento previdenciário seguro.' },
        { title: 'Indenização por Acidente de Trabalho', desc: 'Suporte completo para estabilidade profissional e reparações financeiras.' }
      ]
    }
  },
  {
    id: 'imobiliaria-vitrine',
    category: 'servicos',
    title: 'Imobiliária Prime & Corretores de Luxo',
    desc: 'Catálogo de imóveis residenciais e comerciais de alto padrão com galeria fotográfica, tour em vídeo e botão de visita.',
    tag: 'Alto Padrão',
    previewImg: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/imobiliaria-prime/index.html',
    highlights: ['Filtro por Faixa de Preço e Bairro', 'Fotos em Altíssima Definição', 'Tour Virtual e Vídeos do Imóvel', 'Agendamento Direto de Visita'],
    demoContent: {
      headline: 'Os melhores imóveis de alto padrão na região mais nobre da cidade',
      sub: 'Casas em condomínio fechado, coberturas exclusivas e apartamentos de luxo.',
      ctaText: 'Falar com Corretor Especialista no WhatsApp',
      services: [
        { title: 'Casas em Condomínio Fechado', desc: 'Segurança armada 24h, lazer completo e projetos arquitetônicos assinados.' },
        { title: 'Apartamentos & Coberturas Duplex', desc: 'Varanda gourmet, vista panorâmica e acabamento de alto padrão construtivo.' },
        { title: 'Avaliação Mercadológica de Imóveis', desc: 'Precificação precisa para venda rápida e segura com assessoria jurídica.' }
      ]
    }
  },
  {
    id: 'arquitetura-interiores',
    category: 'servicos',
    title: 'Studio de Arquitetura & Interiores',
    desc: 'Projetos residenciais e comerciais com maquetes 3D foto-realistas, gerenciamento de obras e design de interiores refinado.',
    tag: 'Criativo & Luxo',
    previewImg: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/arquitetura-interiores/index.html',
    highlights: ['Imagens 3D Foto-Realistas', 'Acompanhamento do Início ao Fim da Obra', 'Otimização de Espaço e Iluminação', 'Orçamento Detalhado Sem Surpresas'],
    demoContent: {
      headline: 'Projetos arquitetônicos inteligentes que transformam sonhos em realidade',
      sub: 'Design de interiores moderno, funcionalidade e harmonia para seu lar ou empresa.',
      ctaText: 'Solicitar Projeto Arquitetônico no WhatsApp',
      services: [
        { title: 'Projeto Arquitetônico Completo 3D', desc: 'Plantas executivas, aprovação na prefeitura e imagens realistas do espaço.' },
        { title: 'Design de Interiores Residencial', desc: 'Escolha de paleta de cores, mobiliário, iluminação cênica e marcenaria sob medida.' },
        { title: 'Gerenciamento e Reforma sem Estresse', desc: 'Fiscalização de mão de obra, cumprimento de prazos e controle de custos.' }
      ]
    }
  },
  {
    id: 'marcenaria-fina',
    category: 'servicos',
    title: 'Marcenaria Fina & Móveis Sob Medida',
    desc: 'Móveis planejados 100% MDF para cozinhas gourmet, dormitórios, closets e escritórios com ferragens importadas.',
    tag: 'Artesanal',
    previewImg: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/marcenaria-fina/index.html',
    highlights: ['MDF 100% Tratado Contra Umidade', 'Ferragens com Amortecedores Soft-Close', 'Garantia de 5 Anos de Fábrica', 'Projeto 3D Antes de Fabricar'],
    demoContent: {
      headline: 'Móveis planejados de alto padrão sob medida para cada centímetro',
      sub: 'Acabamentos nobres, precisão milimétrica e pontualidade rigorosa na entrega.',
      ctaText: 'Solicitar Orçamento de Móveis no WhatsApp',
      services: [
        { title: 'Cozinhas Planejadas e Ilhas Gourmet', desc: 'Aproveitamento inteligente de cada canto com torres de eletros integradas.' },
        { title: 'Closets e Dormitórios com LED Embutido', desc: 'Divisões perfeitas para roupas, sapatos e acessórios com portas de vidro.' },
        { title: 'Painéis Ripada e Home Theater', desc: 'Elegância para sala de estar com passagem oculta de fiações e fitas de LED.' }
      ]
    }
  },
  {
    id: 'contabilidade-consultiva',
    category: 'servicos',
    title: 'Contabilidade Consultiva & Abertura de Empresas',
    desc: 'Abertura grátis de CNPJ, transição de MEI para ME, economia de impostos legal e suporte financeiro humanizado.',
    tag: 'Alta Conversão',
    previewImg: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/contabilidade-consultiva/index.html',
    highlights: ['Abertura de Empresa Rápida e Grátis', 'Planejamento Tributário para Pagar Menos', 'Atendimento Direto no WhatsApp Sem Chatbot', 'Emissor de Notas Fiscais Incluso'],
    demoContent: {
      headline: 'A contabilidade descomplicada que faz sua empresa lucrar e crescer',
      sub: 'Reduza impostos dentro da lei e livre-se da burocracia contábil com especialistas.',
      ctaText: 'Abrir CNPJ ou Migrar de Contador no WhatsApp',
      services: [
        { title: 'Abertura de CNPJ em até 48 Horas', desc: 'Processo 100% digital, sem dor de cabeça e com assessoria completa.' },
        { title: 'Redução Legal de Impostos (Simples & Lucro Presumido)', desc: 'Enquadramento tributário cirúrgico para você reter mais lucro na empresa.' },
        { title: 'Gestão de Folha e Rotinas Fiscais', desc: 'Cumprimento rigoroso de obrigações com tranquilidade perante a Receita Federal.' }
      ]
    }
  },
  {
    id: 'energia-solar',
    category: 'servicos',
    title: 'Energia Solar Fotovoltaica & Engenharia',
    desc: 'Simulador interativo de economia na conta de luz (até 95% de redução), financiamento facilitado e instalação homologada.',
    tag: 'Sustentabilidade',
    previewImg: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/energia-solar/index.html',
    highlights: ['Redução de até 95% na Conta de Luz', 'Financiamento que se Paga com a Economia', 'Instalação e Homologação na Concessionária', 'Painéis com 25 Anos de Garantia'],
    demoContent: {
      headline: 'Gere sua própria energia elétrica e economize até 95% todos os meses',
      sub: 'Projetos de energia solar residencial, comercial e rural com engenharia de ponta.',
      ctaText: 'Simular Minha Economia no WhatsApp',
      services: [
        { title: 'Sistemas Solares Residenciais', desc: 'Instalação rápida no telhado com monitoramento da geração em tempo real pelo celular.' },
        { title: 'Usinas Fotovoltaicas para Empresas e Indústrias', desc: 'Redução drástica de custos operacionais com rápido retorno do investimento (ROI).' },
        { title: 'Manutenção e Limpeza de Painéis', desc: 'Aumento da eficiência de geração com inspeção preventiva especializada.' }
      ]
    }
  },
  {
    id: 'limpeza-higienizacao',
    category: 'servicos',
    title: 'Higienização de Estofados & Impermeabilização',
    desc: 'Lavagem a seco de sofás, colchões, tapetes e bancos automotivos, eliminando 99,9% de ácaros, fungos e odores de pets.',
    tag: 'Alta Procura',
    previewImg: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Atendimento a Domicílio com Hora Marcada', 'Secagem Rápida em até 4 Horas', 'Impermeabilização com Laudo de Não Inflamável', 'Produtos Biodegradáveis Seguros para Crianças e Pets'],
    demoContent: {
      headline: 'Seu sofá limpo, cheiroso e livre de ácaros como novo outra vez',
      sub: 'Higienização profunda com extração profissional e produtos certificados pela Anvisa.',
      ctaText: 'Pedir Orçamento com Foto no WhatsApp',
      services: [
        { title: 'Higienização & Lavagem de Sofás', desc: 'Remoção de manchas, odores de pets e ácaros com proteção das fibras.' },
        { title: 'Impermeabilização Anti-Líquidos', desc: 'Barreira protetora que impede a penetração de sucos, café e refrigerantes.' },
        { title: 'Higienização de Colchões e Cabeceiras', desc: 'Desinfecção profunda para garantir noites de sono saudáveis e livres de alergias.' }
      ]
    }
  },

  // 5. COMÉRCIO LOCAL, AUTOMOTIVO & PETS
  {
    id: 'oficina-mecanica',
    category: 'comercio',
    title: 'Oficina Mecânica & AutoCenter com Scanner',
    desc: 'Diagnóstico eletrônico computadorizado, revisão preventiva, freios, suspensão, troca de óleo e SOS emergência mecânica.',
    tag: 'Mais Pedido',
    previewImg: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/oficina-autocenter/index.html',
    highlights: ['Scanner Eletrônico de Última Geração', 'Orçamento Aprovado por Vídeo/WhatsApp', 'Peças com Nota Fiscal e Garantia', 'Mecânicos Certificados'],
    demoContent: {
      headline: 'Mecânica automotiva de confiança com diagnóstico eletrônico preciso',
      sub: 'Revisão preventiva, motor, câmbio e suspensão para você rodar com segurança.',
      ctaText: 'Falar com Mecânico no WhatsApp',
      services: [
        { title: 'Revisão Preventiva & Check-up de Viagem', desc: 'Checagem completa de mais de 40 itens essenciais para segurança na estrada.' },
        { title: 'Troca de Óleo, Filtros e Fluidos', desc: 'Lubrificantes originais recomendados pelo fabricante para longevidade do motor.' },
        { title: 'Diagnóstico de Injeção Eletrônica', desc: 'Localização exata de falhas no painel sem adivinhações ou troca inútil de peças.' }
      ]
    }
  },
  {
    id: 'clinica-veterinaria',
    category: 'comercio',
    title: 'Hospital Veterinário 24h & Pet Care',
    desc: 'Consultas de rotina, vacinação importada, cirurgias, exames laboratoriais, internação monitorada e banho e tosa carinhoso.',
    tag: 'Alta Conversão',
    previewImg: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/pet-veterinaria/index.html',
    highlights: ['Plantão Veterinário de Emergência 24h', 'Equipe de Médicos Veterinários Especialistas', 'Centro Cirúrgico e Exames no Local', 'Táxi Pet com Segurança'],
    demoContent: {
      headline: 'Todo o carinho e medicina de ponta que seu pet merece',
      sub: 'Equipe veterinária qualificada para cuidar da saúde e do bem-estar do seu melhor amigo.',
      ctaText: 'Agendar Consulta Veterinária no WhatsApp',
      services: [
        { title: 'Consultas Clínicas e Vacinação Ética', desc: 'Protocolos vacinais individualizados e prevenção ativa de doenças caninas e felinas.' },
        { title: 'Cirurgias com Anestesia Inalatória', desc: 'Castração segura, cirurgias ortopédicas e monitoramento multiparamétrico contínuo.' },
        { title: 'Banho & Tosa com Produtos Hipoalergênicos', desc: 'Cuidado afetuoso com toalhas esterilizadas individuais e corte de unhas incluso.' }
      ]
    }
  },
  {
    id: 'estetica-automotiva',
    category: 'comercio',
    title: 'Detailing Automotivo & Vitrificação 9H',
    desc: 'Polimento técnico espelhado, vitrificação de pintura cerâmica, lavagem detalhada de chassi e proteção de interiores.',
    tag: 'Alto Padrão',
    previewImg: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/estetica-automotiva/index.html',
    highlights: ['Vitrificação com até 3 Anos de Garantia', 'Estúdio Climatizado com Iluminação LED Grid', 'Remoção de Riscos e Hologramas', 'Proteção Hidrorrepelente de Vidros'],
    demoContent: {
      headline: 'O brilho espelhado e a proteção que seu carro merece',
      sub: 'Estética automotiva de precisão para quem é apaixonado por carros impecáveis.',
      ctaText: 'Pedir Orçamento Detalhado no WhatsApp',
      services: [
        { title: 'Polimento Técnico com Brilho Profundo', desc: 'Eliminação de marcas de lavagem, micro riscos e oxidações na pintura.' },
        { title: 'Vitrificação Cerâmica 9H', desc: 'Camada de quartzo com proteção contra raios UV, fezes de aves e repelência extrema.' },
        { title: 'Higienização Interna & Oxi-Sanitização', desc: 'Limpeza profunda de bancos, carpetes e eliminação de odores desagradáveis.' }
      ]
    }
  },
  {
    id: 'otica-visao',
    category: 'comercio',
    title: 'Ótica Conceito, Armações de Grife & Lentes',
    desc: 'Exames de vista com optometrista, armações internacionais e nacionais, lentes digitais multifocais e garantia de adaptação.',
    tag: 'Estilo & Saúde',
    previewImg: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=700&q=80',
    liveUrl: 'modelos/otica-prime/index.html',
    highlights: ['Armações de Grifes Famosas', 'Lentes Digitais com Antirreflexo', 'Exame de Vista no Local', 'Garantia de Adaptação Total'],
    demoContent: {
      headline: 'Enxergue o mundo com clareza, estilo e conforto visual',
      sub: 'As marcas mais desejadas de armações e a mais alta tecnologia em lentes corretivas.',
      ctaText: 'Consultar Modelos e Preços no WhatsApp',
      services: [
        { title: 'Armações de Grau Modernas', desc: 'Modelos leves em acetato nobre, titânio e metal com design sofisticado.' },
        { title: 'Lentes Multifocais Digitais Personalizadas', desc: 'Transição suave entre perto e longe com campos visuais ampliados.' },
        { title: 'Óculos de Sol com Proteção UV400', desc: 'Modelos clássicos e tendências com lentes polarizadas antirreflexo.' }
      ]
    }
  },
  {
    id: 'loja-roupas-boutique',
    category: 'comercio',
    title: 'Boutique de Moda Feminina & Lookbook',
    desc: 'Catálogo de roupas e tendências, lookbook em carrossel, tabela de medidas e atendimento estilo personal shopper pelo WhatsApp.',
    tag: 'Tendência',
    previewImg: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Coleções Exclusivas por Estação', 'Atendimento Personalizado de Consultoria', 'Envio Rápido para Todo o Brasil', 'Troca Fácil e Descomplicada'],
    demoContent: {
      headline: 'Looks modernos e elegantes selecionados para destacar sua beleza',
      sub: 'Peças com caimento perfeito, tecidos confortáveis e estilo contemporâneo.',
      ctaText: 'Ver Novidades da Semana no WhatsApp',
      services: [
        { title: 'Conjuntos e Vestidos de Alfaiataria', desc: 'Elegância para o trabalho e eventos especiais com tecidos nobres.' },
        { title: 'Moda Casual e Jeans Premium', desc: 'Calças com modelagem empina bumbum, t-shirts em algodão egípcio e blazers.' },
        { title: 'Consultoria de Estilo Online', desc: 'Nossas vendedoras te ajudam a montar composições perfeitas pelo WhatsApp.' }
      ]
    }
  },
  {
    id: 'academia-personal',
    category: 'comercio',
    title: 'Academia & Treinamento Personalizado',
    desc: 'Planos sem taxa de matrícula, musculação climatizada, treinos funcionais, aulas coletivas e acompanhamento por aplicativo.',
    tag: 'Fitness',
    previewImg: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Zero Taxa de Adesão e Matrícula', 'Aparelhos Biomecânicos Importados', 'Horário Estendido de Segunda a Domingo', 'Avaliação Física com Bioimpedância'],
    demoContent: {
      headline: 'Transforme seu corpo e sua energia com o melhor suporte fitness',
      sub: 'Estrutura completa com professores presentes no salão para orientar cada movimento.',
      ctaText: 'Ganhar Free Pass de 3 Dias no WhatsApp',
      services: [
        { title: 'Musculação & Hipertrofia', desc: 'Máquinas de última geração que isolam a musculatura e previnem lesões.' },
        { title: 'Treinamento Funcional e HIIT', desc: 'Aulas dinâmicas que queimam até 800 calorias em 45 minutos.' },
        { title: 'Aulas de Dança, Luta e Spinning', desc: 'Música empolgante, turmas motivadas e professores com energia contagiante.' }
      ]
    }
  },
  {
    id: 'escola-cursos',
    category: 'comercio',
    title: 'Escola de Idiomas & Cursos Profissionalizantes',
    desc: 'Matrículas abertas com bolsa de estudos, método focado em conversação rápida, professores nativos e turmas reduzidas.',
    tag: 'Educação',
    previewImg: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Conversação desde a Primeira Aula', 'Turmas Reduzidas de até 8 Alunos', 'Certificado Válido Nacionalmente', 'Condições Especiais de Matrícula'],
    demoContent: {
      headline: 'Fale um novo idioma com confiança e conquiste novas oportunidades',
      sub: 'Metodologia prática focada em situações reais do cotidiano e do mercado profissional.',
      ctaText: 'Fazer Teste de Nível Gratuito no WhatsApp',
      services: [
        { title: 'Inglês Rápido para Adultos', desc: 'Foco em destravar a conversação para viagens, reuniões e entrevistas de emprego.' },
        { title: 'Cursos de Tecnologia e Gestão', desc: 'Capacitação prática em áreas com alta demanda e vagas abertas no mercado.' },
        { title: 'Aulas Particulares VIP (1 para 1)', desc: 'Cronograma 100% moldado às necessidades e horários individuais do aluno.' }
      ]
    }
  },
  {
    id: 'distribuidora-bebidas',
    category: 'comercio',
    title: 'Adega, Distribuidora & Bebidas Geladas',
    desc: 'Cervejas, destilados, vinhos, gelo e carvão entregues gelados em minutos para festas, churrascos e fins de semana.',
    tag: 'Entrega Rápida',
    previewImg: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=700&q=80',
    liveUrl: null,
    highlights: ['Bebidas Trincando de Geladas', 'Entrega Rápida em até 35 Minutos', 'Preços Competitivos de Distribuidora', 'Barril de Chopp para Eventos'],
    demoContent: {
      headline: 'A bebida trincando de gelada na porta da sua casa em minutos',
      sub: 'Cervejas especiais, destilados importados, gelo e carvão para o seu churrasco.',
      ctaText: 'Pedir Bebidas no WhatsApp',
      services: [
        { title: 'Cervejas Long Neck e Latas Geladas', desc: 'Grandes marcas e cervejas artesanais prontas para consumo imediato.' },
        { title: 'Combos de Gin, Whisky e Vodka', desc: 'Bebidas originais acompanhadas de energéticos e copos descartáveis.' },
        { title: 'Kits para Churrasco de Emergência', desc: 'Carvão selecionado, acendedor, sacos de gelo filtrado e descartáveis.' }
      ]
    }
  }
];

// Salva em formato limpo
const outputFile = path.resolve('public/vitrine/app.js');

const jsContent = `// ==========================================================================
// PIXEL STUDIO - MOTOR DINÂMICO DE PERSONALIZAÇÃO CONTEXTUAL & CATÁLOGO
// ==========================================================================

const PERSONAL_WHATSAPP_PHONE = '5511913393797'; // WhatsApp Pessoal para fechamento

// CATÁLOGO COMPLETO DE MODELOS ESTRUTURADOS POR NICHO COM IMAGENS HD
const MODELS_CATALOG = ${JSON.stringify(modelsData, null, 2)};

// 1. EXTRAÇÃO DE PARÂMETROS DA URL
function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    nicho: urlParams.get('nicho') || '',
    cidade: urlParams.get('cidade') || '',
    empresa: urlParams.get('empresa') || '',
    porte: (urlParams.get('porte') || 'PEQUENO').toUpperCase()
  };
}

// 2. FUNÇÃO NORMALIZADORA DE TEXTO PARA BUSCAS INTELIGENTES
function normalizeText(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
}

// 3. APLICAR PERSONALIZAÇÃO CONTEXTUAL NO SITE
function applyContextualPersonalization(params) {
  const { nicho, cidade, empresa, porte } = params;

  // Atualiza Título da Página
  if (nicho) {
    document.getElementById('page-title').innerText = \`Modelos de Sites para \${capitalize(nicho)} | Pixel Studio\`;
  }

  // Hero Badge
  const badgeEl = document.getElementById('hero-badge');
  if (cidade) {
    badgeEl.innerText = \`Modelos Selecionados para Empresas em \${cidade}\`;
  } else {
    badgeEl.innerText = \`Modelos Verificados de Alta Conversão\`;
  }

  // Hero H1
  const titleEl = document.getElementById('hero-title');
  if (nicho && cidade) {
    titleEl.innerText = \`Sites e Landing Pages de Alta Conversão para \${capitalize(nicho)} em \${cidade}\`;
  } else if (nicho) {
    titleEl.innerText = \`Sites e Landing Pages de Alta Conversão para \${capitalize(nicho)}\`;
  } else {
    titleEl.innerText = \`Sites e Landing Pages de Alta Conversão para Pequenas e Médias Empresas\`;
  }

  // Hero Subtítulo
  const subEl = document.getElementById('hero-subtitle');
  if (empresa) {
    subEl.innerText = \`Apresente a \${empresa} com autoridade máxima na internet. Páginas que carregam em menos de 1 segundo no celular e convertem visitantes diretamente em clientes no seu WhatsApp.\`;
  }

  // Catálogo Título
  const catTitleEl = document.getElementById('catalog-section-title');
  const catDescEl = document.getElementById('catalog-section-desc');
  if (nicho) {
    catTitleEl.innerText = \`Modelos Sugeridos para \${capitalize(nicho)}\`;
    catDescEl.innerText = \`Selecione uma demonstração abaixo para interagir em tempo real no simulador mobile.\`;
  }

  // Precificação Dinâmica
  applyDynamicPricing(porte, params);

  // Botão no Header
  const headerWa = document.getElementById('btn-header-wa');
  if (headerWa) {
    headerWa.href = buildWhatsAppUrl(\`Olá! Gostaria de tirar dúvidas sobre os modelos de sites para \${params.nicho || 'meu negócio'}.\`);
  }
}

// 4. TABELA DE PRECIFICAÇÃO CONTEXTUAL
function applyDynamicPricing(porte, params) {
  let tierName = 'Plano Ativação Popular (Micro-Empresas e Autônomos)';
  let setupVal = '50';
  let monthlyVal = '20';

  if (porte === 'ALTO') {
    tierName = 'Plano Estratégico Corporativo';
    setupVal = '150';
    monthlyVal = '35';
  } else if (porte === 'MEDIO') {
    tierName = 'Plano Crescimento Comercial';
    setupVal = '80';
    monthlyVal = '25';
  }

  const tierEl = document.getElementById('pricing-tier-name');
  const setupEl = document.getElementById('pricing-setup-val');
  const monthlyEl = document.getElementById('pricing-monthly-text');
  const ctaEl = document.getElementById('btn-pricing-cta');

  if (tierEl) tierEl.innerText = tierName;
  if (setupEl) setupEl.innerText = setupVal;
  if (monthlyEl) {
    monthlyEl.innerText = \`+ apenas R$ \${monthlyVal}/mês de hospedagem rápida e manutenção técnica\`;
  }

  const msg = \`Olá! Quero ativar a minha página no \${tierName} por R$ \${setupVal} de setup + R$ \${monthlyVal}/mês para \${params.empresa || 'minha empresa'} em \${params.cidade || 'minha cidade'}.\`;
  if (ctaEl) {
    ctaEl.href = buildWhatsAppUrl(msg);
  }
}

// 5. RENDERIZAÇÃO DO CATÁLOGO DE MODELOS
let currentActiveCategory = 'todos';
let currentSearchTerm = '';

function renderCatalog(params, activeCategory = null, searchTerm = '') {
  const grid = document.getElementById('models-grid');
  const counter = document.getElementById('models-counter');

  // Identifica categoria padrão caso nada seja passado
  let targetCategory = activeCategory;
  if (targetCategory === null) {
    if (params.nicho) {
      const n = normalizeText(params.nicho);
      if (n.includes('odonto') || n.includes('dentista') || n.includes('saude') || n.includes('clinica') || n.includes('fisio') || n.includes('psico')) {
        targetCategory = 'odontologia';
      } else if (n.includes('restaurante') || n.includes('hamburg') || n.includes('pizza') || n.includes('delivery') || n.includes('sushi') || n.includes('churrasco') || n.includes('doce') || n.includes('fit') || n.includes('cafe') || n.includes('acai')) {
        targetCategory = 'gastronomia';
      } else if (n.includes('barbearia') || n.includes('salao') || n.includes('estetica') || n.includes('cabelo') || n.includes('lash') || n.includes('unha') || n.includes('spa')) {
        targetCategory = 'beleza';
      } else if (n.includes('advocacia') || n.includes('advogado') || n.includes('imob') || n.includes('arquit') || n.includes('marcenaria') || n.includes('contab') || n.includes('solar') || n.includes('limpeza')) {
        targetCategory = 'servicos';
      } else if (n.includes('mecanica') || n.includes('auto') || n.includes('pet') || n.includes('veterin') || n.includes('otica') || n.includes('curso') || n.includes('loja') || n.includes('bebida') || n.includes('roupa')) {
        targetCategory = 'comercio';
      } else {
        targetCategory = 'todos';
      }
    } else {
      targetCategory = 'todos';
    }
  }

  currentSearchTerm = searchTerm ? searchTerm.trim() : '';

  let filtered = MODELS_CATALOG;

  // SE HOUVER BUSCA POR TEXTO: A BUSCA É GLOBAL EM TODOS OS MODELOS!
  if (currentSearchTerm) {
    const term = normalizeText(currentSearchTerm);
    targetCategory = 'todos'; // Ativa aba Todos
    filtered = MODELS_CATALOG.filter(m => {
      const textPool = [
        m.title,
        m.desc,
        m.tag,
        m.category,
        m.id,
        ...(m.highlights || []),
        ...(m.demoContent && m.demoContent.services ? m.demoContent.services.map(s => s.title + ' ' + s.desc) : [])
      ].join(' ');
      return normalizeText(textPool).includes(term);
    });
  } else if (targetCategory && targetCategory !== 'todos') {
    filtered = filtered.filter(m => m.category === targetCategory);
  }

  currentActiveCategory = targetCategory;

  // Atualiza botões de categoria visualmente
  document.querySelectorAll('.cat-btn').forEach(btn => {
    const btnCat = btn.getAttribute('data-niche');
    if (btnCat === targetCategory) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (counter) {
    counter.innerText = \`\${filtered.length} Modelo\${filtered.length === 1 ? '' : 's'} Disponíve\${filtered.length === 1 ? 'l' : 'is'}\`;
  }

  // Estado Vazio Amigável
  if (filtered.length === 0) {
    grid.innerHTML = \`
      <div class="empty-state-box">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <p class="empty-state-title">Nenhum modelo encontrado para "\${currentSearchTerm}".</p>
        <p class="empty-state-desc">Tente pesquisar por termos como "Dentista", "Hambúrguer", "Advogado", "Pet", "Estética", "Oficina" ou explore as categorias acima.</p>
        <button class="btn btn-secondary" onclick="clearSearchFilter()">Ver Todos os Modelos</button>
      </div>
    \`;
    return;
  }

  const categoryNames = {
    odontologia: 'Odontologia & Saúde',
    gastronomia: 'Gastronomia & Delivery',
    beleza: 'Beleza & Estética',
    servicos: 'Serviços & Advocacia',
    comercio: 'Comércio Local & Pets'
  };

  grid.innerHTML = filtered.map(m => {
    const badgeClass = m.tag === 'Mais Pedido' ? 'model-badge-popular' : '';
    const chooseMsg = \`Olá! Gostei muito do modelo "\${m.title}" da Pixel Studio e quero colocá-lo no ar para \${params.empresa || 'minha empresa'} em \${params.cidade || 'minha cidade'}.\`;
    const waUrl = buildWhatsAppUrl(chooseMsg);

    const liveBadge = m.liveUrl
      ? \`<span class="browser-live-badge"><span class="dot-live-sm"></span> Ao Vivo</span>\`
      : '';

    const catLabel = categoryNames[m.category] || 'Solução Digital';

    return \`
      <div class="model-card">
        <div class="model-preview-box" onclick="openDemoModal('\${m.id}')" title="Clique para testar este modelo no celular">
          
          <!-- BARRA SUPERIOR DO NAVEGADOR -->
          <div class="browser-mockup-header">
            <div class="browser-dots">
              <span class="browser-dot dot-red"></span>
              <span class="browser-dot dot-yellow"></span>
              <span class="browser-dot dot-green"></span>
            </div>
            <div class="browser-url-pill">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <span>\${m.id}.pixelstudio.com.br</span>
            </div>
            \${liveBadge}
          </div>

          <!-- IMAGEM DE CAPA COM PREVIEW REAL -->
          <div class="browser-image-container">
            <img src="\${m.previewImg}" alt="\${m.title}" class="model-cover-image" loading="lazy" />
            <div class="browser-image-overlay">
              <span class="btn-hover-demo">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="5" y="2" width="14" height="20" rx="3"></rect><line x1="12" y1="18" x2="12.01" y2="18" stroke-width="3"></line></svg>
                Testar no Celular
              </span>
            </div>
          </div>
        </div>

        <!-- CORPO DO CARD COM DESIGN BALANCEADO -->
        <div class="model-body">
          <div class="model-meta-line">
            <span class="model-category-label">\${catLabel}</span>
            <span class="model-tag-pill \${badgeClass}">\${m.tag}</span>
          </div>

          <h3 class="model-title">\${m.title}</h3>
          <p class="model-desc">\${m.desc}</p>

          <div class="model-feature-chips">
            \${m.highlights.slice(0, 3).map(h => \`
              <span class="feature-chip">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                \${h}
              </span>
            \`).join('')}
          </div>

          <div class="model-actions-row">
            <button class="btn btn-secondary btn-sm" onclick="openDemoModal('\${m.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Ver Demonstração
            </button>
            <a href="\${waUrl}" target="_blank" class="btn btn-primary btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.974.532 1.831.815 2.796.815 3.183 0 5.769-2.587 5.769-5.767.001-3.18-2.584-5.766-5.769-5.766zm8.969 5.768c0 4.962-4.038 9-9 9-1.554 0-3.003-.396-4.269-1.088l-5.731 1.503 1.529-5.591c-.777-1.328-1.229-2.87-1.229-4.524 0-4.962 4.038-9 9-9s9 4.038 9 9z"/></svg>
              Quero Este Modelo
            </a>
          </div>
        </div>
      </div>
    \`;
  }).join('');
}

function clearSearchFilter() {
  const searchInput = document.getElementById('catalog-search-input');
  const clearBtn = document.getElementById('btn-clear-search');
  if (searchInput) searchInput.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  const params = getUrlParams();
  renderCatalog(params, 'todos', '');
}

// 6. MODAL DE SIMULADOR DE CELULAR AO VIVO COM SUPORTE A IFRAME & TELA CHEIA
function openDemoModal(modelId) {
  const model = MODELS_CATALOG.find(m => m.id === modelId);
  if (!model) return;

  const params = getUrlParams();
  const screen = document.getElementById('phone-screen-content');
  const activateBtn = document.getElementById('btn-phone-activate');
  const fullscreenBtn = document.getElementById('btn-phone-fullscreen');

  const companyName = params.empresa || 'Sua Empresa';
  const city = params.cidade ? \`\${params.cidade}\` : '';
  const citySuffix = city ? \`em \${city}\` : '';

  const activateMsg = \`Olá! Acabei de testar o modelo "\${model.title}" no simulador da Pixel Studio e decidi ativar para a \${companyName} \${citySuffix}. Como procedemos?\`;
  if (activateBtn) {
    activateBtn.href = buildWhatsAppUrl(activateMsg);
  }

  // SE O MODELO TEM UM TEMPLATE HTML REAL EM modelos/
  if (model.liveUrl) {
    const liveTargetUrl = \`\${model.liveUrl}?empresa=\${encodeURIComponent(companyName)}&cidade=\${encodeURIComponent(city || 'Sua Cidade')}&whatsapp=\${encodeURIComponent(PERSONAL_WHATSAPP_PHONE)}\`;
    
    if (fullscreenBtn) {
      fullscreenBtn.style.display = 'inline-flex';
      fullscreenBtn.href = liveTargetUrl;
    }

    screen.innerHTML = \`
      <iframe src="\${liveTargetUrl}" class="phone-iframe" title="\${model.title}"></iframe>
    \`;
  } else {
    if (fullscreenBtn) {
      fullscreenBtn.style.display = 'none';
    }

    const d = model.demoContent;
    screen.innerHTML = \`
      <div class="sim-page-hero">
        <span class="sim-page-badge">Atendimento Rápido \${citySuffix}</span>
        <h3 class="sim-page-title">\${d.headline}</h3>
        <p class="sim-page-sub">\${d.sub}</p>
        <a href="#" class="sim-btn-wa-call" onclick="alert('Na sua página definitiva, este botão abrirá o seu WhatsApp com a mensagem pronta!'); return false;">
          \${d.ctaText}
        </a>
      </div>

      <div class="sim-page-section">
        <h4 class="sim-section-heading">Nossos Principais Serviços:</h4>
        \${d.services.map(s => \`
          <div class="sim-service-item">
            <h5>\${s.title}</h5>
            <p>\${s.desc}</p>
          </div>
        \`).join('')}
      </div>

      <div class="sim-page-section" style="text-align: center;">
        <h4 class="sim-section-heading">Por que escolher a \${companyName}?</h4>
        <p style="font-size: 0.78rem; color:#94a3b8; line-height: 1.5; margin-bottom: 16px;">
          Estrutura de ponta, agilidade no atendimento e compromisso com o melhor resultado para você \${citySuffix}.
        </p>
        <a href="#" class="sim-btn-wa-call" style="background:#4f46e5;" onclick="alert('Na página real, este botão leva o cliente direto pro seu WhatsApp!'); return false;">
          Tirar Dúvidas com Nossa Equipe
        </a>
      </div>

      <div style="padding: 20px; text-align: center; font-size: 0.7rem; color:#64748b;">
        \${companyName} &copy; 2026. Soluções Digitais.
      </div>
    \`;
  }

  const modal = document.getElementById('modal-demo');
  if (modal) modal.style.display = 'flex';
}

function closeDemoModal() {
  const modal = document.getElementById('modal-demo');
  const screen = document.getElementById('phone-screen-content');
  if (modal) modal.style.display = 'none';
  if (screen) screen.innerHTML = '';
}

// 7. EVENTOS & LISTENERS
function attachEventListeners(params) {
  // Abas de categorias
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-niche');
      const searchInput = document.getElementById('catalog-search-input');
      const clearBtn = document.getElementById('btn-clear-search');
      if (searchInput) searchInput.value = '';
      if (clearBtn) clearBtn.style.display = 'none';
      renderCatalog(params, cat, '');
    });
  });

  // Barra de Busca Inteligente
  const searchInput = document.getElementById('catalog-search-input');
  const clearBtn = document.getElementById('btn-clear-search');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (clearBtn) {
        clearBtn.style.display = val.trim() ? 'inline-block' : 'none';
      }
      renderCatalog(params, null, val);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearSearchFilter();
    });
  }

  // Fechar modal ao clicar fora
  const modal = document.getElementById('modal-demo');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeDemoModal();
      }
    });
  }

  // Botões de SaaS Sob Medida
  document.querySelectorAll('.saas-cta').forEach(btn => {
    const saasName = btn.getAttribute('data-saas');
    const msg = \`Olá! Vi na vitrine da Pixel Studio os Sistemas Sob Medida e gostaria de solicitar um projeto personalizado de "\${saasName}" para a \${params.empresa || 'minha empresa'} em \${params.cidade || 'minha cidade'}.\`;
    btn.href = buildWhatsAppUrl(msg);
    btn.target = '_blank';
  });
}

// 8. HELPERS
function buildWhatsAppUrl(text) {
  return \`https://wa.me/\${PERSONAL_WHATSAPP_PHONE}?text=\${encodeURIComponent(text)}\`;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// 9. INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
  const params = getUrlParams();
  applyContextualPersonalization(params);
  renderCatalog(params);
  attachEventListeners(params);
});
`;

fs.writeFileSync(outputFile, jsContent, 'utf8');
console.log('app.js atualizado com sucesso com 37 modelos, UTF-8 e imagens HD!');
