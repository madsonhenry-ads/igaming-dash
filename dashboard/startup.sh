#!/bin/sh
set -e

echo "=> Running Prisma migrations..."
npx prisma generate
npx prisma db push --accept-data-loss

echo "=> Starting application..."
exec node server.js