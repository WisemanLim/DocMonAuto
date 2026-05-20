# Build context: repository root (see ops/docker-compose.yml)
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS development
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN chmod +x docker-entrypoint.dev.sh
EXPOSE 3000
CMD ["sh", "./docker-entrypoint.dev.sh"]
