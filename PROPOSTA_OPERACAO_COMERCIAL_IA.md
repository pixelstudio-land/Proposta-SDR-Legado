# Dossiê Comercial: Máquina Comercial Legado 360°
**Operação Comercial Autônoma de Alta Performance: Inbound Oficial, Outbound Blindado e Mineração B2B**

* **Para:** Leo (Legado Performance)  
* **Desenvolvimento e Engenharia:** Pixel Studio  
* **Versão:** 2.0 — Arquitetura Unificada de Alta Escala  

---

## 1. Visão Geral da Operação 360°

A **Máquina Comercial Legado 360°** é um ecossistema proprietário de aquisição de clientes projetado para operar 24 horas por dia, 7 dias por semana. Em vez de depender de métodos isolados ou arriscados, a operação integra **três motores complementares de geração de reuniões qualificadas**:

```
                       ┌──────────────────────────────────────────────┐
                       │       MÁQUINA COMERCIAL LEGADO 360°          │
                       └──────────────────────────────────────────────┘
                                /               |              \
                               /                |               \
                              v                 v                v
                      [ MOTOR 1 ]          [ MOTOR 2 ]      [ MOTOR 3 ]
                    INBOUND OFICIAL      OUTBOUND BLINDADO  MINERADOR B2B
                    Meta Ads + Reels     Instagram Satélite Google Maps
                    ManyChat Pro + IA    Scrapers + Senders Validador WhatsApp
                              \                 |                /
                               \                |               /
                                └───────────────┼──────────────┘
                                                │
                                                ▼
                                    [ NÚCLEO DE QUALIFICAÇÃO ]
                                      Memória Contínua (WAL)
                                      Triagem por Critérios ICP
                                                │
                                                ▼
                                    [ TRANSBORDO DUPLO ]
                             ┌──────────────────┴──────────────────┐
                             ▼                                     ▼
                    WhatsApp do SDR / Leo                  Injeção Automática
                     (Alerta Imediato)                      no CRM da Legado
```

---

## 2. Os Três Motores do Ecossistema

### Motor 1: Inbound Oficial Blindado (Meta Ads + ManyChat Pro + IA)
* **Canal:** Perfil oficial `@legadoperformance`.
* **Mecanismo:** Anúncios institucionais ou convites para análise comercial gratuita direcionados para o Direct + gatilhos em posts e Reels.
* **Memória Contínua:** Diferente de chatbots simples que "esquecem" o que o cliente disse a cada nova mensagem, o sistema grava o histórico completo da conversa no banco de dados. A IA retoma o contexto com perfeição a cada resposta.
* **Qualificação Dinâmica:** A IA atua como pré-vendedora da Legado, extraindo:
  1. Nicho e modelo de negócio da empresa.
  2. Faturamento médio mensal.
  3. Principais gargalos no comercial atual.
* **Risco:** Zero. 100% homologado nas diretrizes oficiais da Meta.

### Motor 2: Outbound Instagram com Blindagem Anti-Ban
* **Canal:** 100% isolado da conta oficial da Legado, operando com arquitetura de contas satélites segmentadas em dois papéis:
  * **Contas Scrapers (Fantasmas):** Perfis dedicados exclusivamente a varrer seguidores e curtidas de concorrentes e referências de mercado. Se houver qualquer bloqueio de visualização, a operação de disparo não para.
  * **Contas Senders (Aquecidas e Humanizadas):** Perfis de consultores da Legado que recebem apenas os perfis já aprovados pela IA e realizam o envio cirúrgico da DM (máximo 20 a 25 DMs/dia por conta), com intervalos orgânicos de 2 a 5 minutos.
* **Auditoria de Bio por IA:** Antes de qualquer disparo, o modelo avalia a bio do alvo. Perfis pessoais, adolescentes ou sem relação com empresas são descartados automaticamente, poupando a cota diária de envios.
* **Objetivo:** Trazer o empresário abordado na DM fria para um diagnóstico no WhatsApp oficial da Legado.

### Motor 3: Mineração B2B de Alta Conversão (Google Meu Negócio)
* **Canal:** Extração em massa de empresas diretamente do Google Maps por nicho e região geográfica (ex: *"Clínicas Médicas em Alphaville"*, *"Construtoras no Paraná"*).
* **Aproveitamento de Telefones Comerciais Fixos:** Clínicas e médias empresas utilizam amplamente números fixos (8 dígitos) registrados no **WhatsApp Business**. O sistema higieniza tanto fixos quanto celulares e consulta o servidor de mensageria para validar quais números realmente possuem conta de WhatsApp ativa.
* **Entrega:** Base de dados enriquecida com Nome da Empresa, Endereço, Telefones com WhatsApp confirmado, Site e Volume de Avaliações, pronta para prospecção ativa da equipe de vendas ou disparo direcionado.

---

## 3. O Núcleo Tecnológico: Concorrência e Transbordo Duplo

1. **Concorrência Máxima 24/7 (SQLite WAL):**
   * Configuração de banco com escrita antecipada (`PRAGMA journal_mode = WAL;`). Permite que o raspador do Google Maps, os robôs do Instagram e o servidor de mensagens operem simultaneamente no mesmo banco sem causar travamento (*database lock*).

2. **Transbordo Duplo Automático:**
   * **No WhatsApp:** O SDR e o Leo recebem um alerta instantâneo com a ficha completa do lead qualificado (dados da empresa, faturamento declarado e link de conversa direta).
   * **No CRM da Legado:** O sistema dispara um webhook alimentando o CRM Legado em tempo real, criando o negócio no funil de vendas sem trabalho manual de digitação.

---

## 4. Comparativo de Investimento e Infraestrutura

| Componente | Opção Vídeo / Terceiros | Máquina Comercial Legado 360° |
| :--- | :--- | :--- |
| **Arquitetura** | Software caixa-preta fechado | Código proprietário 100% da Legado |
| **Risco de Ban no @legadoperformance** | Alto (disparo frio no perfil oficial) | **Zero** (disparo frio isolado em contas satélites) |
| **Retenção de Contexto** | Chatbot de árvore simples | **Memória contínua via banco relacional** |
| **Aproveitamento B2B** | Descarte de telefones fixos | **Validação ativa de WhatsApp fixo e móvel** |
| **Integração Comercial** | Notificação manual por planilha | **Transbordo duplo: WhatsApp + CRM** |
| **Custo de Ferramentas** | R$ 1.500+ / mês em plataformas terceiras | **Menos de R$ 250 / mês** (OpenAI + ManyChat Pro) |
| **Potencial de Revenda** | Nenhum (apenas usuário) | **Produto próprio para vender por R$ 3k a R$ 5k/setup** |

---

## 5. Pré-requisitos Técnicos Fornecidos pela Legado

Para liberação e conexão dos módulos:
1. Acesso de administrador ao Gerenciador de Negócios da Meta (BM) para conectar o ManyChat Pro à página e Instagram oficiais.
2. Chave de API da OpenAI (modelo `gpt-4o-mini`).
3. Instância de WhatsApp conectada (Evolution API / Z-API) para envio de notificações e checagem de números ativos.
4. URL de Webhook do CRM da agência (para recepção direta dos negócios gerados).
5. Definição do ICP: faturamento mínimo desejado, nichos prioritários e perguntas de corte.

---

## 6. Conclusão Executiva

A Legado passa a ter em mãos uma operação completa: atrai empresários com interesse imediato via canais oficiais, caça ativamente tomadores de decisão no Instagram sem arriscar a conta institucional e minera milhares de empresas locais com WhatsApp comercial verificado. É uma infraestrutura corporativa pronta para gerar receita recorrente para a agência e se tornar um produto de prateleira para a carteira de clientes.
