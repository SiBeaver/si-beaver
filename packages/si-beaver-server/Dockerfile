# Build from repo root: docker build -f packages/si-beaver-server/Dockerfile .
# The image only contains node + node_modules — code is mounted via hostPath at runtime.

FROM node:22-alpine

RUN apk add --no-cache python3 make g++ && corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY package.json ./
COPY packages/si-beaver-core/package.json packages/si-beaver-core/
COPY packages/si-beaver-server/package.json packages/si-beaver-server/

RUN pnpm config set registry https://registry.npmmirror.com && pnpm install --frozen-lockfile --prod

COPY packages/si-beaver-server/dev-hot-entrypoint.sh /dev-hot-entrypoint.sh
RUN chmod +x /dev-hot-entrypoint.sh

ENV SI_BEAVER_HOME=/data
ENV SI_BEAVER_PORT=7420
ENV NODE_ENV=production

EXPOSE 7420

ENTRYPOINT ["/dev-hot-entrypoint.sh"]
