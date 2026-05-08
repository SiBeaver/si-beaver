# ---- Build stage ----
FROM node:22-alpine AS build

WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
# Rebuild native modules (better-sqlite3)
RUN npm rebuild better-sqlite3

# Build backend
COPY tsup.config.ts tsconfig.json ./
COPY src/ src/
RUN npx tsup

# Build frontend
COPY web/package.json web/package-lock.json web/
RUN cd web && npm ci
COPY web/ web/
RUN cd web && npx vite build

# ---- Runtime stage ----
FROM node:22-alpine

WORKDIR /app

# Only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm rebuild better-sqlite3

COPY --from=build /app/dist/ dist/
COPY --from=build /app/web/dist/ web/dist/

ENV SI_BEAVER_HOME=/data
ENV SI_BEAVER_PORT=7420
ENV NODE_ENV=production

EXPOSE 7420

CMD ["node", "dist/api/server.js"]
