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

# ---- Runtime stage ----
FROM node:22-alpine

WORKDIR /app

# Only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm rebuild better-sqlite3

COPY --from=build /app/dist/ dist/

ENV SI_BEAVER_HOME=/data
ENV SI_BEAVER_PORT=7420
ENV NODE_ENV=production

EXPOSE 7420

CMD ["node", "dist/api/server.js"]
