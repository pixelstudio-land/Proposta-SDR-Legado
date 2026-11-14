#!/usr/bin/env bash
# ==============================================================================
# Setup Automatizado - Legado SDR Engine (Ubuntu / Debian)
# ==============================================================================
# Este script prepara o ambiente Linux na VPS, instalando:
# 1. Node.js 20 LTS e PM2
# 2. Dependências de sistema e navegadores do Playwright (Chromium)
# 3. Dependências npm do projeto e estrutura de diretórios data/
# 4. Inicialização do serviço em segundo plano via PM2
# ==============================================================================

set -euo pipefail

echo "===================================================="
echo "🚀 Iniciando Setup da Máquina Comercial Legado 360"
echo "===================================================="

# 1. Garantir permissões de administrador (root ou sudo)
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "❌ Este script precisa de privilégios de root ou sudo para instalar pacotes de sistema."
    exit 1
  fi
fi

# Diretório raiz do projeto (onde está o script)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
echo "📁 Diretório da aplicação: $PROJECT_DIR"

# 2. Atualizar repositórios e instalar utilitários base
echo "📦 [1/6] Atualizando pacotes do sistema..."
$SUDO apt-get update -y
$SUDO apt-get install -y curl wget git gnupg ca-certificates build-essential

# 3. Instalar Node.js 20 LTS (NodeSource)
CURRENT_NODE_MAJOR=""
if command -v node >/dev/null 2>&1; then
  CURRENT_NODE_MAJOR="$(node -v | cut -d'.' -f1 | sed 's/v//')"
fi

if [ "$CURRENT_NODE_MAJOR" != "20" ]; then
  echo "📥 [2/6] Instalando Node.js 20 LTS..."
  $SUDO mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | $SUDO gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | $SUDO tee /etc/apt/sources.list.d/nodesource.list
  $SUDO apt-get update -y
  $SUDO apt-get install -y nodejs
else
  echo "✅ [2/6] Node.js 20 já está instalado ($(node -v))."
fi

# 4. Instalar PM2 globalmente
if ! command -v pm2 >/dev/null 2>&1; then
  echo "⚙️ [3/6] Instalando PM2 globalmente..."
  $SUDO npm install -g pm2
else
  echo "✅ [3/6] PM2 já está instalado ($(pm2 -v))."
fi

# 5. Criar estrutura de dados persistentes
echo "📂 [4/6] Configurando diretórios locais..."
mkdir -p data/logs data/sessions data/whatsapp-auth data/exports config
touch data/logs/.gitkeep data/sessions/.gitkeep data/exports/.gitkeep

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "⚠️ Arquivo .env gerado a partir de .env.example. Verifique suas chaves de API caso necessário."
fi

# 6. Instalar dependências npm e binários do Playwright com dependências do sistema
echo "📦 [5/6] Instalando dependências npm..."
npm install

echo "🌐 Instalando Chromium e dependências Linux para Playwright..."
$SUDO npx playwright install --with-deps chromium

# 7. Iniciar ou recarregar processo com PM2
echo "🚀 [6/6] Iniciando aplicação no PM2..."
pm2 delete legado-sdr-engine 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "===================================================="
echo "🎉 Setup concluído com sucesso!"
echo "===================================================="
echo "📊 Ver status:         pm2 status"
echo "📜 Ver logs em tempo real: pm2 logs legado-sdr-engine"
echo "🔄 Reiniciar serviço:  pm2 restart legado-sdr-engine"
echo "🛑 Parar serviço:      pm2 stop legado-sdr-engine"
echo "🔒 Para iniciar no boot da VPS: pm2 startup"
echo "===================================================="
