#!/bin/sh
set -e

echo "=> Running Prisma migrations..."
# Define a cache local para evitar erros de permissão
export PRISMA_GENERATE_SKIP_CACHE=1
npx -y prisma@6.16.3 db push --accept-data-loss
npm run db:seed

echo "=> Starting application..."
exec node server.js