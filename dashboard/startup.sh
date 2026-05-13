#!/bin/sh
set -e

echo "=> Running Prisma migrations..."
npx --no-install prisma db push --accept-data-loss
npm run db:seed

echo "=> Starting application..."
exec node server.js