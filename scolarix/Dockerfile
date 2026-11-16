# ─────────────────────────────────────────────────────────────
#  Scolarix « tout-en-un » : API + site dans UN seul conteneur.
#  Utilisé par Render (render.yaml) ; adapté à tout hébergeur qui lance une image Docker.
#  (La variante en 3 conteneurs avec nginx reste disponible : docker-compose.prod.yml)
# ─────────────────────────────────────────────────────────────

# 1) Compilation du site
FROM node:22-bookworm-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend --workspace packages/shared --no-audit --no-fund
COPY packages/shared packages/shared
COPY frontend frontend
RUN npm run build --workspace frontend

# 2) API + site compilé
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-dejavu-core fonts-liberation openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    CHROMIUM_PATH=/usr/bin/chromium \
    UPLOAD_DIR=/data/uploads \
    FRONTEND_DIR=/app/web \
    PORT=10000
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --workspace packages/shared --no-audit --no-fund
COPY packages/shared packages/shared
COPY backend backend
COPY --from=web /app/frontend/dist /app/web
WORKDIR /app/backend
RUN npx prisma generate && mkdir -p /data/uploads && chown -R node:node /data /app/backend

USER node
EXPOSE 10000
# Démarrage : migrations → administrateur initial → (démo si LOAD_DEMO_DATA=true et base vide) → serveur
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && if [ \"$LOAD_DEMO_DATA\" = \"true\" ]; then npx tsx scripts/seed-demo.ts || echo 'Démo non chargée (base déjà remplie)'; fi && npx tsx src/server.ts"]
