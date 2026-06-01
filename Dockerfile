# === build: install deps + compile all packages ===
FROM node:22-alpine AS build
RUN apk add --no-cache python3 make g++ && corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Layer 1: package manifests → pnpm install (cached by lockfile)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/si-beaver-core/package.json packages/si-beaver-core/
COPY packages/si-beaver-server/package.json packages/si-beaver-server/
COPY packages/si-beaver-web/package.json packages/si-beaver-web/
COPY packages/si-beaver-cloud-engine/package.json packages/si-beaver-cloud-engine/
COPY packages/si-beaver-cloud-core/package.json packages/si-beaver-cloud-core/
COPY apps/sibs/package.json apps/sibs/
COPY apps/sibs-web/package.json apps/sibs-web/
RUN pnpm config set registry https://registry.npmmirror.com && pnpm install --frozen-lockfile

# Layer 2: source → build (cached by source)
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm -r build

# === sibs: API server runtime ===
FROM node:22-alpine AS sibs
WORKDIR /app
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/sibs/dist/index.js /app/index.js
ENV NODE_ENV=production PORT=7420
EXPOSE 7420
CMD ["node", "/app/index.js"]

# === sibs-web: frontend static server runtime ===
FROM node:22-alpine AS sibs-web
WORKDIR /app
COPY --from=build /app/apps/sibs-web/dist/ /app/web/
EXPOSE 80
CMD ["node", "-e", "const{createServer}=require('http');const{readFile}=require('fs/promises');const{join}=require('path');const m={'html':'text/html','js':'application/javascript','css':'text/css','svg':'image/svg+xml','png':'image/png','ico':'image/x-icon'};createServer(async(_,r)=>{try{const p=join('/app/web',_.url==='/'?'/index.html':_.url);const c=await readFile(p);const e=p.split('.').pop();r.writeHead(200,{'Content-Type':m[e]||'application/octet-stream'});r.end(c)}catch{r.writeHead(200,{'Content-Type':'text/html'});r.end(await readFile('/app/web/index.html'))}}).listen(80)"]
