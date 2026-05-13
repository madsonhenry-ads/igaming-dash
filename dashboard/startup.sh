#!/bin/sh
set -e

echo "=> Running Prisma migrations..."
# Define a cache local para evitar erros de permissão
export PRISMA_GENERATE_SKIP_CACHE=1
./node_modules/.bin/prisma db push --accept-data-loss --skip-generate
./node_modules/.bin/tsx scripts/seed.ts

echo "=> Starting application..."
exec node server.js