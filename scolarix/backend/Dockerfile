# ─────────────────────────────────────────────────────────────
#  API Scolarix (Node.js + Express + Prisma + Chromium pour les PDF)
#  Construite depuis la racine du dépôt : voir docker-compose.prod.yml
# ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim

# Chromium (génération PDF), polices, OpenSSL (Prisma)
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-dejavu-core fonts-liberation openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    CHROMIUM_PATH=/usr/bin/chromium \
    UPLOAD_DIR=/data/uploads \
    PORT=4000

WORKDIR /app
# Dépendances (couche mise en cache tant que les package.json ne changent pas)
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --workspace packages/shared --no-audit --no-fund

# Code
COPY packages/shared packages/shared
COPY backend backend
WORKDIR /app/backend
RUN npx prisma generate \
 && mkdir -p /data/uploads && chown -R node:node /data /app/backend

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Au démarrage : migrations, données minimales (institut + administrateur), puis serveur
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npx tsx src/server.ts"]
