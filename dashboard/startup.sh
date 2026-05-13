#!/bin/sh
set -e

echo "=> Running Prisma migrations..."
npx prisma@6.16.3 generate
npx prisma@6.16.3 db push --accept-data-loss
npm run db:seed

echo "=> Starting application..."
exec node server.js