#!/bin/sh
set -eu

# Compose 익명 볼륨(/app/node_modules)에 호스트·이전 이미지 잔여물이 있으면 의존성 불일치 발생
if [ ! -f node_modules/.package-lock.json ] || ! cmp -s package-lock.json node_modules/.package-lock.json 2>/dev/null; then
  echo "Syncing backend dependencies (package-lock changed or stale node_modules volume)..."
  npm ci
  cp package-lock.json node_modules/.package-lock.json 2>/dev/null || true
fi

SCHEMA="./prisma/schema.prisma"
if [ -f "$SCHEMA" ]; then
  echo "Generating Prisma client from $SCHEMA ..."
  if ! ./node_modules/.bin/prisma generate --schema="$SCHEMA"; then
    echo "WARN: prisma generate failed; continuing (client may already exist in node_modules)" >&2
  fi
else
  echo "WARN: $SCHEMA not found (compose volume: ../database/prisma:/app/prisma)" >&2
fi
exec npm run start:dev
