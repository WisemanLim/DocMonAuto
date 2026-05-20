# Build context: repository root (see ops/docker-compose.yml)
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl openssl

FROM base AS deps
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM deps AS development
COPY backend/ .
COPY database/prisma ./prisma
RUN chmod +x docker-entrypoint.dev.sh
EXPOSE 3001
CMD ["sh", "docker-entrypoint.dev.sh"]

FROM deps AS builder
COPY backend/ .
COPY database/prisma ./prisma
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["node", "dist/main"]
