FROM node:22-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci --omit=dev

COPY dev-hot-entrypoint.sh /dev-hot-entrypoint.sh
RUN chmod +x /dev-hot-entrypoint.sh

ENV SI_BEAVER_HOME=/data
ENV SI_BEAVER_PORT=7420
ENV NODE_ENV=production

EXPOSE 7420

ENTRYPOINT ["/dev-hot-entrypoint.sh"]
