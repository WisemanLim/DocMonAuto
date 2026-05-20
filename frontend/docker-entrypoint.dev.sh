#!/bin/sh
set -eu
if [ ! -d node_modules/next ]; then
  echo "Installing frontend dependencies (first run / empty node_modules volume)..."
  npm ci
fi
exec npm run dev
