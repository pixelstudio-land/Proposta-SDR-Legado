# 🚀 Legado SDR Engine (Máquina Comercial 360°)

> **Ecossistema de Aquisição Comercial Autônoma com Inteligência Artificial**  
> Desenvolvido por **Pixel Studio** para **Legado Performance**  
> Arquitetura: Node.js (ESM), SQLite (WAL), OpenAI (GPT-4o-mini), Playwright e Evolution API.

---

## 📋 Visão Geral dos 3 Motores

1. **Módulo 1: Inbound Oficial (ManyChat + IA + Transbordo Duplo)**
   * Recepciona leads de anúncios e posts orgânicos no Direct da `@legadoperformance`.
   * Mantém memória contínua de turnos no SQLite WAL para evitar perda de contexto.
   * Qualifica faturamento e nicho com a consultora Amanda (GPT-4o-mini).
   * Dispara alerta imediato no WhatsApp do SDR e injeta o lead no **CRM Legado**.

2. **Módulo 2: Outbound Instagram Blindado (Playwright Anti-Ban)**
   * Arquitetura com separação estrita de contas: `SCRAPER_ACCOUNTS` (extração de seguidores de concorrentes) vs `SENDER_ACCOUNTS` (disparo humanizado).
   * Triagem cognitiva de bio com IA: descarta perfis pessoais e aprova tomadores de decisão B2B.
   * Digitação tecla por tecla (80ms a 200ms) com pausas orgânicas e teto estrito de 20 a 25 DMs/dia por conta.
   * Proteção anti-duplicação de 90 dias.

3. **Módulo 3: Minerador B2B Google Meu Negócio**
   * Varredura automatizada no Google Maps por nicho e cidade.
   * Sanitização para formato E.164 preservando fixos comerciais (8 dígitos) e celulares (9 dígitos).
   * Validação em lote de WhatsApp ativo via Evolution API com fallback resiliente.
   * Exportação automática em planilha Excel (`.xlsx`) estruturada na pasta `data/exports/`.

---

## ⚙️ Pré-requisitos e Instalação

* **Node.js**: Versão 18.0.0 ou superior
* **Gerenciador**: npm

```bash
# 1. Copie o arquivo de variáveis de ambiente
cp .env.example .env

# 2. Instale as dependências do ecossistema
npm install

# 3. (Opcional) Instale os navegadores do Playwright se for rodar em ambiente limpo
npx playwright install chromium
```

---

## 🔐 Configuração do Arquivo `.env`

Abra o arquivo `.env` e preencha suas credenciais:

```env
# Servidor Webhook Inbound
PORT=3000
NODE_ENV=production
WEBHOOK_SECRET=sua_chave_secreta_aqui

# ManyChat Oficial
MANYCHAT_API_KEY=mc_live_sua_chave_aqui

# Inteligência Artificial (OpenAI)
OPENAI_API_KEY=sk-proj-sua_chave_openai_aqui
OPENAI_MODEL=gpt-4o-mini

# WhatsApp Gateway (Evolution API)
WA_API_URL=http://localhost:8080
WA_API_KEY=sua_chave_de_instancia
WA_INSTANCE_NAME=legado_sdr
SDR_NOTIFICATION_PHONE=5511999999999

# CRM Legado
CRM_WEBHOOK_URL=https://api.crmlegado.com.br/v1/leads/webhook_receiver
CRM_API_BEARER_TOKEN=seu_token_opcional

# Parâmetros de Disparo Frio do Instagram
MAX_DAILY_DMS_PER_SENDER=25
MIN_DELAY_SECONDS=120
MAX_DELAY_SECONDS=300
HEADLESS_BROWSER=true
```

---

## 🖥️ Comandos de Execução

### 1️⃣ Rodar o Servidor Inbound Oficial (ManyChat)
```bash
# Modo de produção
npm start

# Modo de desenvolvimento (com auto-reload)
npm run dev
```
* **Endpoint do Webhook:** `POST http://localhost:3000/api/inbound/webhook`
* **Healthcheck:** `GET http://localhost:3000/health`
* **Headers obrigatórios:** `x-webhook-secret: seu_secret`

---

### 2️⃣ Rodar o Outbound Instagram Blindado
```bash
# Executa o pipeline completo (Raspar concorrente -> Filtrar com IA -> Disparar DMs)
npm run outbound -- --target=perfil_concorrente --limit=15

# Apenas filtrar leads já salvos e enviar DMs (sem raspar novamente)
npm run outbound -- --skip-scrape

# Apenas raspar e filtrar sem enviar DMs
npm run outbound -- --target=perfil_concorrente --limit=20 --skip-send
```

---

### 3️⃣ Rodar o Minerador Google Meu Negócio
```bash
# Minera estabelecimentos, valida WhatsApp ativo e exporta para Excel
npm run miner -- --query="Clinica Odontologica Campinas SP" --limit=25

# Outro exemplo de nicho B2B
npm run miner -- --query="Empresas de Energia Solar Belo Horizonte MG" --limit=30
```
* As planilhas geradas são salvas automaticamente em: `data/exports/mineracao_gmn_*.xlsx`.

---

## 🗄️ Estrutura do Banco de Dados (SQLite WAL)

O banco é criado automaticamente no primeiro arranque em `config/database.sqlite`:
* `leads`: Cadastro consolidado de todos os canais (Inbound, Outbound e Minerador).
* `conversation_history`: Histórico de mensagens para retenção contínua de contexto da IA.
* `message_logs`: Registro de cada DM fria enviada (com conta remetente e data).
* `blacklist`: Controle de opt-out e contatos bloqueados.

---

## 🛡️ Suporte & Engenharia
Desenvolvido por **Pixel Studio**.
