# ─────────────────────────────────────────────────────────────
#  Site Scolarix : construit avec Vite, servi par nginx
#  nginx relaie /api vers le conteneur "api" (même origine → cookie de session OK)
# ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend --workspace packages/shared --no-audit --no-fund
COPY packages/shared packages/shared
COPY frontend frontend
RUN npm run build --workspace frontend

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
