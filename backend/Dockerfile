# ── Base ─────────────────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl

# ── Dependencies ──────────────────────────────────────────────────
FROM base AS deps
COPY package.json ./
RUN npm install --frozen-lockfile

# ── Development ───────────────────────────────────────────────────
FROM deps AS development
COPY . .
RUN npx prisma generate --schema=../database/prisma/schema.prisma || true
EXPOSE 3001
CMD ["npm", "run", "start:dev"]

# ── Builder ───────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN npx prisma generate --schema=../database/prisma/schema.prisma || true
RUN npm run build

# ── Production ────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["node", "dist/main"]
