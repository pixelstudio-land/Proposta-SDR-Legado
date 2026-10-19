import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

pdf_path = "DOCUMENTO_DECISAO_COMERCIAL_IA.pdf"
doc = SimpleDocTemplate(
    pdf_path,
    pagesize=letter,
    rightMargin=36,
    leftMargin=36,
    topMargin=32,
    bottomMargin=32
)

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    "DocTitle",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=16,
    leading=20,
    textColor=colors.HexColor("#0F172A"),
    spaceAfter=3
)

subtitle_style = ParagraphStyle(
    "DocSubTitle",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.5,
    leading=12,
    textColor=colors.HexColor("#64748B"),
    spaceAfter=10
)

h1_style = ParagraphStyle(
    "SectionH1",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=11,
    leading=14,
    textColor=colors.HexColor("#0F172A"),
    spaceBefore=8,
    spaceAfter=4
)

h2_style = ParagraphStyle(
    "SectionH2",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=9.5,
    leading=13,
    textColor=colors.HexColor("#1E293B"),
    spaceBefore=6,
    spaceAfter=3
)

body_style = ParagraphStyle(
    "Body",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8,
    leading=11,
    textColor=colors.HexColor("#334155"),
    spaceAfter=4
)

caption_style = ParagraphStyle(
    "Caption",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=7,
    leading=9,
    textColor=colors.HexColor("#64748B"),
    alignment=1
)

bullet_style = ParagraphStyle(
    "Bullet",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8,
    leading=11,
    textColor=colors.HexColor("#334155"),
    leftIndent=8,
    spaceAfter=3
)

callout_style = ParagraphStyle(
    "Callout",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8,
    leading=11,
    textColor=colors.HexColor("#0F172A"),
    backColor=colors.HexColor("#F8FAFC"),
    borderColor=colors.HexColor("#CBD5E1"),
    borderWidth=1,
    borderPadding=6,
    spaceBefore=4,
    spaceAfter=6
)

story = []

# Cabeçalho
story.append(Paragraph("PIXEL STUDIO / DOSSIÊ TÉCNICO E COMERCIAL", ParagraphStyle("Meta", fontName="Helvetica-Bold", fontSize=7.5, textColor=colors.HexColor("#059669"))))
story.append(Paragraph("Dossiê Comercial: Máquina Comercial Legado", title_style))
story.append(Paragraph("Análise do vídeo de referência, mapeamento do influenciador, investimentos e pré-requisitos para a Legado Performance.", subtitle_style))

# Seção 1: Identificação do Autor e Narrativa
story.append(Paragraph("1. Quem é o Autor do Vídeo e Qual é o Real Objetivo Dele?", h1_style))
story.append(Paragraph("O autor do vídeo é <b>Matheus Gomes</b> (Matheus de Oliveira Gomes), empresário e fundador da <b>Swapo Finance</b> (fintech de operações e pagamentos globais) e do ecossistema <b>Notyped</b>.", body_style))
story.append(Paragraph("No vídeo gravado em San Salvador, ele apresenta um suposto caso de <i>Operação Comercial Autônoma</i> na Swapo Finance prometendo faturamento de mais de R$ 1 milhão na semana seguinte e afirmando que <i>está ensinando tudo de graça para copiar e colar</i>.", body_style))
story.append(Paragraph("No entanto, a análise técnica das telas comprova que <b>o vídeo é uma isca comercial clássica de topo de funil</b> para atrair empresários para as soluções e mentorias privadas dele:", body_style))

# Tabela de Imagens
img1 = RLImage("assets/influenciador_video.jpg", width=105, height=180)
img2 = RLImage("assets/relatorio_video.jpg", width=105, height=180)
img3 = RLImage("assets/cta_video.jpg", width=105, height=180)

cap1 = Paragraph("<b>Matheus Gomes (Swapo)</b><br/>Promessa de R$ 1M para prender atenção.", caption_style)
cap2 = Paragraph("<b>Tela da Swapo Finance</b><br/>41 empresas abordadas e 13 no WhatsApp.", caption_style)
cap3 = Paragraph("<b>A Contradição (01:14)</b><br/>Ele pede <i>Comentar CODEX</i> via API oficial.", caption_style)

evidence_table = Table([
    [img1, img2, img3],
    [cap1, cap2, cap3]
], colWidths=[180, 180, 180])
evidence_table.setStyle(TableStyle([
    ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("TOPPADDING", (0,1), (-1,1), 2),
    ("BOTTOMPADDING", (0,0), (-1,-1), 2),
]))
story.append(evidence_table)
story.append(Spacer(1, 3))

story.append(Paragraph("<b>A Prova Flagrante no Minuto 01:14:</b> Se o método dele fosse disparo frio puro, ele estaria prospectando ativamente no Direct. Mas ele encerra mandando as pessoas comentarem <b>CODEX</b> no post. Isso é o ManyChat rodando na API oficial da Meta. Ele não corre o risco de tomar banimento no próprio perfil.", callout_style))

# Seção 2: Resposta Armada
story.append(Paragraph("2. Resposta Armada: 'E se eu pagar a estrutura do Matheus Gomes e você implementar?'", h1_style))
story.append(Paragraph("Se o Leo sugerir assinar a plataforma ou mentoria dele, aqui estão os quatro contra-argumentos objetivos:", body_style))

table_data = [
    [Paragraph("<b>Critério</b>", body_style), Paragraph("<b>Estrutura do Matheus Gomes</b>", body_style), Paragraph("<b>Estrutura Proprietária Legado</b>", body_style)],
    [Paragraph("Custo Contínuo", body_style), Paragraph("Mensalidade alta em dólar ou anuidade pesada para a plataforma dele.", body_style), Paragraph("Zero royalties. Apenas ferramentas oficiais (< R$ 250/mês).", body_style)],
    [Paragraph("Propriedade", body_style), Paragraph("Software caixa-preta de terceiro. Se a conta dele cair, você perde tudo.", body_style), Paragraph("A Legado é dona de 100% da tecnologia, dos dados e prompts.", body_style)],
    [Paragraph("Revenda a Clientes", body_style), Paragraph("Margem baixa. Você vira apenas um afiliado pagando pedágio por cliente.", body_style), Paragraph("Você vende a Máquina de Orçamentos por R$ 3k a R$ 5k com 100% de lucro.", body_style)],
    [Paragraph("Trabalho Técnico", body_style), Paragraph("A ferramenta dele não sabe as regras da Legado. A parametrização terá que ser feita igual.", body_style), Paragraph("A IA já nasce configurada sob medida para o SDR da Legado.", body_style)]
]
t = Table(table_data, colWidths=[105, 217, 218])
t.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#F8FAFC")),
    ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
    ("TOPPADDING", (0,0), (-1,-1), 3),
    ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
]))
story.append(t)
story.append(Spacer(1, 4))

story.append(PageBreak())

# Seção 3: Requisitos e Investimentos para Cada Nível
story.append(Paragraph("3. O que Vamos Precisar e Quanto Investir em Cada Nível de Projeto", h1_style))
story.append(Paragraph("Comparativo detalhado de escopo, pré-requisitos técnicos e investimento financeiro de cada opção:", body_style))

# Tabela de Comparação de Escopo e Investimento
comparison_data = [
    [
        Paragraph("<b>Nível do Projeto</b>", body_style),
        Paragraph("<b>Opção 1: MVP Experimental com Riscos</b>", body_style),
        Paragraph("<b>Opção 2: Máquina Comercial Legado (Oficial)</b>", body_style)
    ],
    [
        Paragraph("<b>Objetivo</b>", body_style),
        Paragraph("Testar disparo frio em escala reduzida assumindo instabilidade.", body_style),
        Paragraph("Estrutura comercial definitiva, segura e escalável para vendas.", body_style)
    ],
    [
        Paragraph("<b>O que vamos precisar da Legado</b>", body_style),
        Paragraph(
            "• 2 a 3 contas secundárias de Instagram (descartáveis)<br/>"
            "• Contratação de proxy móvel 4G para rotação de IP<br/>"
            "• Lista de perfis concorrentes ou hashtags para raspagem<br/>"
            "• Chip de WhatsApp secundário para teste de recepção", body_style
        ),
        Paragraph(
            "• Acesso de admin ao Gerenciador de Negócios da Meta (BM)<br/>"
            "• Conta oficial @legadoperformance vinculada a Página Facebook<br/>"
            "• Conta no ManyChat Pro (API oficial da Meta)<br/>"
            "• Chave de API da OpenAI (modelo GPT-4o-mini)<br/>"
            "• Número do WhatsApp do SDR para transbordo automático<br/>"
            "• Perguntas de qualificação e critérios de corte (ICP)", body_style
        )
    ],
    [
        Paragraph("<b>Investimento de Setup (Pixel Studio)</b>", body_style),
        Paragraph("<b>R$ 500</b> (Taxa única de implementação do teste)", body_style),
        Paragraph("<b>Valor a Combinar</b> (Alinhamento direto entre nós)", body_style)
    ],
    [
        Paragraph("<b>Custos de Ferramentas e Infraestrutura</b>", body_style),
        Paragraph(
            "• R$ 120 a R$ 200 (compra de contas teste + proxy móvel)<br/>"
            "• Custo recorrente imprevisível por reposição de contas banidas", body_style
        ),
        Paragraph(
            "• OpenAI GPT-4o-mini: R$ 40 a R$ 100/mês<br/>"
            "• ManyChat Pro oficial: ~R$ 85/mês ($15 USD)<br/>"
            "• Gateway de WhatsApp: Zero a R$ 80/mês<br/>"
            "<b>Total de Ferramentas: Menos de R$ 250/mês</b>", body_style
        )
    ],
    [
        Paragraph("<b>Investimento Total Estimado</b>", body_style),
        Paragraph("<font color=\"#B45309\"><b>R$ 620 a R$ 700</b></font> (Setup + descartáveis)", body_style),
        Paragraph("<font color=\"#047857\"><b>Ferramentas < R$ 250/mês + Setup a combinar</b></font>", body_style)
    ],
    [
        Paragraph("<b>Nível de Risco para a Conta</b>", body_style),
        Paragraph("<font color=\"#DC2626\"><b>Alto Risco:</b></font> Viola termos da Meta. A conta cai em dias.", body_style),
        Paragraph("<font color=\"#047857\"><b>Risco Zero:</b></font> 100% homologado pela API oficial da Meta.", body_style)
    ],
    [
        Paragraph("<b>Potencial Comercial</b>", body_style),
        Paragraph("Limitado a testes internos. Não serve para vender a clientes.", body_style),
        Paragraph("Venda da Máquina de Orçamentos a clientes por R$ 3k a R$ 5k.", body_style)
    ]
]

comp_table = Table(comparison_data, colWidths=[105, 217, 218])
comp_table.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#0F172A")),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
    ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("BACKGROUND", (1,1), (1,-1), colors.HexColor("#FFFBEB")),
    ("BACKGROUND", (2,1), (2,-1), colors.HexColor("#ECFDF5")),
]))
story.append(comp_table)
story.append(Spacer(1, 8))

# Seção 4: O Racional Técnico
story.append(Paragraph("4. O Porquê de Cada Decisão Técnica", h1_style))
story.append(Paragraph("• <b>Por que não rodar disparo frio na conta oficial?</b> O perfil @legadoperformance é o patrimônio da agência. Disparar mensagens não solicitadas ativa a proteção antifraude da Meta. O caminho oficial protege o CNPJ e o BM.", bullet_style))
story.append(Paragraph("• <b>Por que anúncios para o Direct em vez de adivinhação de perfis?</b> Anúncios de Direct têm custo por mensagem baixo e atraem quem já sente a dor. O lead chega aberto a conversar, elevando a taxa de triagem para mais de 30%.", bullet_style))
story.append(Paragraph("• <b>Por que entregar no WhatsApp do SDR?</b> A IA atua como recepcionista de elite: elimina curiosos, extrai faturamento e entrega o lead quente na mão do vendedor fechar a reunião.", bullet_style))

# Seção 5: Conclusão
story.append(Spacer(1, 4))
story.append(Paragraph("5. Conclusão Executiva", h1_style))
story.append(Paragraph("Se o objetivo do Leo for testar scripts por curiosidade sem compromisso com escala, o <b>MVP de R$ 500</b> atende com os riscos assumidos em perfis de teste. Se a meta for implementar uma máquina séria que traga clientes para a Legado e gere o produto <b>Máquina de Orçamentos</b> para faturar alto com a carteira de clientes, a <b>Opção 2</b> é o único caminho profissional.", body_style))

doc.build(story)
print("PDF gerado com sucesso em:", pdf_path)
