FROM node:22-bookworm-slim

# Dependências de sistema para utilitários e Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia dependências npm
COPY package*.json ./

# Instala dependências do projeto
RUN npm install

# Instala o Chromium e suas bibliotecas do sistema
RUN npx playwright install --with-deps chromium

# Copia código-fonte
COPY . .

# Garante existência das pastas de persistência
RUN mkdir -p data/logs data/sessions data/whatsapp-auth data/exports config

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "src/modules/1-inbound-official/webhook-server.js"]
