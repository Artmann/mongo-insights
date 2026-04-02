FROM oven/bun:1 AS deps

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile --production=false

FROM oven/bun:1 AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json vite.config.ts components.json ./
COPY src ./src

RUN bunx vite build

FROM oven/bun:1-slim AS production

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile --production

COPY --from=build /app/dist/client ./dist/client
COPY src ./src
COPY tsconfig.json ./

ENV NODE_ENV=production
ENV PORT=4280

EXPOSE 4280

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || 4280) + '/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["bun", "src/index.ts"]
