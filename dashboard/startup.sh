#!/bin/sh
set -e

echo "=> Running Prisma migrations..."
prisma db push --accept-data-loss
npm run db:seed

echo "=> Starting application..."
exec node server.js