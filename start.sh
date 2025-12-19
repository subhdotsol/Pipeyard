#!/bin/bash
# Start all services for async-backend
# Usage: ./start.sh

set -e

echo "🚀 Starting Async Backend Stack..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start PostgreSQL and Redis
echo "📦 Starting PostgreSQL + Redis..."
docker compose up -d
sleep 2

# Check Redis
if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis failed to start"
    exit 1
fi

# Check Postgres
if docker compose exec -T postgres pg_isready > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "⏳ Waiting for PostgreSQL..."
    sleep 3
fi

echo ""
echo "🔧 Starting services..."
echo ""

# Function to run in background with output
run_service() {
    local name=$1
    local dir=$2
    local cmd=$3
    
    echo "Starting $name..."
    cd "$dir"
    $cmd &
    cd - > /dev/null
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start Backend
echo "📡 Starting Backend API (port 3000)..."
(cd "$SCRIPT_DIR/apps/backend" && bun run index.ts) &
BACKEND_PID=$!
sleep 2

# Start Worker
echo "⚙️  Starting Worker..."
(cd "$SCRIPT_DIR/apps/worker" && bun run index.ts) &
WORKER_PID=$!
sleep 1

# Start Frontend
echo "🖥️  Starting Frontend (port 3001)..."
(cd "$SCRIPT_DIR/apps/web" && bun run dev) &
FRONTEND_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All services started!"
echo ""
echo "   📡 API:      http://localhost:3000"
echo "   🖥️  Frontend: http://localhost:3001"
echo "   📊 Prisma:   bunx prisma studio (from packages/db)"
echo ""
echo "   Press Ctrl+C to stop all services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Trap Ctrl+C to cleanup
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID $WORKER_PID $FRONTEND_PID 2>/dev/null
    docker compose down
    echo "✅ All services stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for any process to exit
wait
