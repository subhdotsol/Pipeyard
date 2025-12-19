#!/bin/sh
# Start script for API container
# Runs migrations then starts the server

echo "🔄 Running database migrations..."
cd /app/packages/db && bunx prisma migrate deploy

echo "🚀 Starting API server..."
cd /app && bun run apps/backend/index.ts
