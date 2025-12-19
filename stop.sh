#!/bin/bash
# Stop all services for async-backend
# Usage: ./stop.sh

echo "🛑 Stopping Async Backend Stack..."

# Kill any running bun processes in this project
pkill -f "bun run index.ts" 2>/dev/null
pkill -f "bun run dev" 2>/dev/null

# Stop Docker containers
docker compose down

echo "✅ All services stopped"
