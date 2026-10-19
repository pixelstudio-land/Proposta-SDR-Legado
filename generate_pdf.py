import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

pdf_path = "DOCUMENTO_DECISAO_COMERCIAL_IA.pdf"
doc = SimpleDocTemplate(
    pdf_path,
    pagesize=letter,
    rightMargin=36,
    leftMargin=36,
    topMargin=36,
    bottomMargin=36
)

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    "DocTitle",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=18,
    leading=22,
    textColor=colors.HexColor("#0F172A"),
    spaceAfter=4
)

subtitle_style = ParagraphStyle(
    "DocSubTitle",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=9.5,
    leading=14,
    textColor=colors.HexColor("#64748B"),
    spaceAfter=14
)

h1_style = ParagraphStyle(
    "SectionH1",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=12,
    leading=15,
    textColor=colors.HexColor("#0F172A"),
    spaceBefore=10,
    spaceAfter=6
)

body_style = ParagraphStyle(
    "Body",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.5,
    leading=12,
    textColor=colors.HexColor("#334155"),
    spaceAfter=5
)

caption_style = ParagraphStyle(
    "Caption",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=7.5,
    leading=10,
    textColor=colors.HexColor("#64748B"),
    alignment=1
)

bullet_style = ParagraphStyle(
    "Bullet",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.5,
    leading=12,
    textColor=colors.HexColor("#334155"),
    leftIndent=10,
    spaceAfter=4
)

callout_style = ParagraphStyle(
    "Callout",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.5,
    leading=12,
    textColor=colors.HexColor("#0F172A"),
    backColor=colors.HexColor("#F8FAFC"),
    borderColor=colors.HexColor("#CBD5E1"),
    borderWidth=1,
    borderPadding=7,
    spaceBefore=5,
    spaceAfter=8
)

story = []

# Cabeçalho
story.append(Paragraph("PIXEL STUDIO / DOSSIÊ TÉCNICO E COMERCIAL", ParagraphStyle("Meta", fontName="Helvetica-Bold", fontSize=8, textColor=colors.HexColor("#059669"))))
story.append(Paragraph("Dossiê Comercial: Máquina Comercial Legado", title_style))
story.append(Paragraph("Análise do vídeo de referência, riscos operacionais e os dois caminhos de implementação para a Legado Performance.", subtitle_style))

# Seção 1
story.append(Paragraph("1. A Verdade Sobre o Vídeo: Quem é o autor e qual o objetivo real?", h1_style))
story.append(Paragraph("O vídeo analisado apresenta um caso sob o título <b>Swapq Finance: Operação Comercial Autônoma</b>, prometendo faturamento milionário e dizendo que <i>é só copiar e colar tudo de graça</i>.", body_style))
story.append(Paragraph("No entanto, a análise técnica das telas comprova que <b>o vídeo é apenas uma isca comercial de topo de funil</b> para atrair empresários para o produto dele.", body_style))

# Tabela com as 3 evidências
img1 = RLImage("assets/influenciador_video.jpg", width=115, height=200)
img2 = RLImage("assets/relatorio_video.jpg", width=115, height=200)
img3 = RLImage("assets/cta_video.jpg", width=115, height=200)

cap1 = Paragraph("<b>Isca de Conteúdo</b><br/>Promessa de R$ 1M e discurso de cópia gratuita para reter a atenção.", caption_style)
cap2 = Paragraph("<b>Relatório do Vídeo</b><br/>41 empresas abordadas e 13 oportunidades no WhatsApp.", caption_style)
cap3 = Paragraph("<b>A Prova Real (01:14)</b><br/>Ele não faz disparo frio: pede para <i>Comentar CODEX</i> via API oficial.", caption_style)

evidence_table = Table([
    [img1, img2, img3],
    [cap1, cap2, cap3]
], colWidths=[180, 180, 180])
evidence_table.setStyle(TableStyle([
    ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("TOPPADDING", (0,1), (-1,1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 2),
]))
story.append(evidence_table)
story.append(Spacer(1, 4))

story.append(Paragraph("<b>A Narrativa Real do Mercado:</b> Nenhum criador entrega de graça um funil funcional. Ele usa o gancho do <i>copia e cola</i> para que as pessoas o procurem na DM, onde ele vende a mentoria dele, comunidade fechada ou uma ferramenta SaaS de revenda com assinatura recorrente.", callout_style))

# Seção 2
story.append(Paragraph("2. Resposta Pronta: E se eu pagar a estrutura do cara e você implementar?", h1_style))
story.append(Paragraph("Se o Leo levantar essa hipótese, aqui está a resposta técnica e comercial:", body_style))

table_data = [
    [Paragraph("<b>Critério</b>", body_style), Paragraph("<b>Estrutura do Influenciador</b>", body_style), Paragraph("<b>Estrutura Proprietária Legado</b>", body_style)],
    [Paragraph("Custo do Acesso", body_style), Paragraph("Mensalidade alta em dólar ou assinatura recorrente permanente.", body_style), Paragraph("Zero royalties. Apenas ferramentas oficiais (< R$ 250/mês).", body_style)],
    [Paragraph("Propriedade", body_style), Paragraph("Você aluga uma caixa-preta. Se ele cancelar o serviço, você perde tudo.", body_style), Paragraph("A Legado é dona de 100% da tecnologia e dos dados.", body_style)],
    [Paragraph("Revenda a Clientes", body_style), Paragraph("Margem baixa. Você vira apenas um afiliado pagando pedágio por cliente.", body_style), Paragraph("Você vende a Máquina de Orçamentos por R$ 3k a R$ 5k com 100% de margem.", body_style)],
    [Paragraph("Trabalho Técnico", body_style), Paragraph("O software dele não sabe as regras da Legado. A parametrização precisa ser feita igual.", body_style), Paragraph("A IA já nasce configurada sob medida para o público e o SDR da Legado.", body_style)]
]
t = Table(table_data, colWidths=[110, 215, 215])
t.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#F8FAFC")),
    ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
    ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
]))
story.append(t)
story.append(Spacer(1, 6))

# Seção 3
story.append(Paragraph("3. As Duas Opções de Projeto na Mesa", h1_style))
story.append(Paragraph("Duas opções claras com base em risco, custo e retorno:", body_style))

opt_mvp_text = (
    "<b>OPÇÃO 1: MVP Experimental com Riscos</b><br/>"
    "<font color=\"#B45309\"><b>R$ 500 (Setup Único)</b></font><br/><br/>"
    "• Scripts não oficiais de raspagem e envio<br/>"
    "• Limite de 20 a 25 disparos/dia por conta<br/>"
    "• <b>Risco Alto de Bloqueio:</b> Meta derruba contas que fazem spam<br/>"
    "• <b>Exige conta descartável:</b> Nunca rodar no @legadoperformance<br/>"
    "• Instável e sem suporte oficial"
)

opt_pro_text = (
    "<b>OPÇÃO 2: Máquina Comercial Legado (Oficial)</b><br/>"
    "<font color=\"#047857\"><b>Valor a Combinar (Alinhamento Direto)</b></font><br/><br/>"
    "• <b>Zero Risco de Banimento:</b> 100% API Oficial da Meta<br/>"
    "• Alinhado com o core da Legado: Tráfego pago direto para Direct<br/>"
    "• Triagem em tempo real com GPT-4o-mini (nicho, faturamento, verba)<br/>"
    "• Webhook entrega leads qualificados no WhatsApp do SDR<br/>"
    "• <b>Ativo Replicável:</b> Base para vender a clientes por R$ 3k a R$ 5k"
)

opt_table = Table([[Paragraph(opt_mvp_text, body_style), Paragraph(opt_pro_text, body_style)]], colWidths=[270, 270])
opt_table.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (0,0), colors.HexColor("#FFFBEB")),
    ("BACKGROUND", (1,0), (1,0), colors.HexColor("#ECFDF5")),
    ("BOX", (0,0), (0,0), 1, colors.HexColor("#FDE68A")),
    ("BOX", (1,0), (1,0), 1, colors.HexColor("#A7F3D0")),
    ("TOPPADDING", (0,0), (-1,-1), 6),
    ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ("LEFTPADDING", (0,0), (-1,-1), 8),
    ("RIGHTPADDING", (0,0), (-1,-1), 8),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
]))
story.append(opt_table)
story.append(Spacer(1, 6))

# Seção 4
story.append(Paragraph("4. O Racional por Trás de Cada Decisão Técnica", h1_style))
story.append(Paragraph("• <b>Por que não arriscar a conta principal com disparo frio?</b> O @legadoperformance é a autoridade da empresa. Se for bloqueado, perdem-se o histórico e os acessos de tráfego. O caminho oficial garante operação 24/7 segura.", bullet_style))
story.append(Paragraph("• <b>Por que anúncios para o Direct em vez de adivinhação de perfis?</b> Quando o lead clica no anúncio, ele manifestou interesse primeiro. A conversa começa receptiva e a qualificação da IA é muito superior ao disparo frio.", bullet_style))
story.append(Paragraph("• <b>Por que transbordo para o WhatsApp?</b> Contratos consultivos da Legado não fecham no Direct. A IA filtra os curiosos e entrega o contato quente mastigado para o SDR ligar e fechar.", bullet_style))

doc.build(story)
print("PDF gerado com sucesso em:", pdf_path)
