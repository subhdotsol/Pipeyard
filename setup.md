# Pipeyard - Setup Guide

Complete guide to set up, run, and test the job queue system.

---

## Prerequisites

- **Docker** - [Install Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Bun** - [Install Bun](https://bun.sh/) (`curl -fsSL https://bun.sh/install | bash`)
- **Node.js** - v18+ (optional, for some tools)

---

## Quick Start (Docker - Recommended)

### 1. Clone and Enter Directory

```bash
git clone https://github.com/subhdotsol/Pipeyard.git
cd Pipeyard
```

### 2. Start Production Stack

```bash
docker compose -f docker-compose.prod.yml up --build
```

This starts:
- ✅ PostgreSQL (database)
- ✅ Redis (queue + pub/sub)
- ✅ API Server (2 replicas)
- ✅ Worker (3 replicas)
- ✅ NGINX (load balancer)

### 3. Test the API

```bash
# Health check
curl http://localhost:8080/health

# Create a job
curl -X POST http://localhost:8080/jobs \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"tenant-1","type":"sleep","payload":{"delayMs":3000}}'

# List jobs
curl "http://localhost:8080/jobs?tenantId=tenant-1"
```

### 4. Stop Everything

```bash
docker compose -f docker-compose.prod.yml down
```

---

## Local Development

### 1. Install Dependencies

```bash
bun install
```

### 2. Set Up Database

```bash
# Start PostgreSQL + Redis
docker compose up -d

# Run migrations
cd packages/db
bunx prisma migrate dev --name init
bunx prisma generate
cd ../..
```

### 3. Start All Services

```bash
./start.sh
```

Opens:
- API: http://localhost:3000
- Frontend: http://localhost:3001

### 4. Stop All Services

```bash
./stop.sh
```

---

## Testing

### Test API with curl

```bash
# Health check
curl http://localhost:3000/health

# Create a sleep job
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"tenant-1","type":"sleep","payload":{"delayMs":3000}}'

# Create an email job
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"tenant-1","type":"email","payload":{"to":"test@example.com","subject":"Hello"}}'

# Create a webhook job
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"tenant-1","type":"webhook","payload":{"url":"https://httpbin.org/post","method":"POST"}}'

# List jobs
curl "http://localhost:3000/jobs?tenantId=tenant-1"
```

### Test WebSocket

```bash
# Install websocat
brew install websocat

# Connect to WebSocket
websocat ws://localhost:3000/ws

# After connected, send:
{"type":"SUBSCRIBE","tenantId":"tenant-1"}

# Create a job in another terminal and watch updates arrive
```

### Test Horizontal Scaling (Docker)

```bash
# Create 10 jobs at once
for i in {1..10}; do
  curl -X POST http://localhost:8080/jobs \
    -H "Content-Type: application/json" \
    -d '{"tenantId":"tenant-1","type":"sleep","payload":{"delayMs":5000}}'
done

# Watch workers process in parallel
docker compose -f docker-compose.prod.yml logs -f worker
```

---

## Scaling

### Scale Workers

```bash
# Run 5 workers
docker compose -f docker-compose.prod.yml up -d --scale worker=5
```

### Scale API Servers

```bash
# Run 4 API servers
docker compose -f docker-compose.prod.yml up -d --scale api=4
```

### View Running Containers

```bash
docker compose -f docker-compose.prod.yml ps
```

---

## Database Management

### View Database (GUI)

```bash
cd packages/db
bunx prisma studio
# Opens at http://localhost:5555
```

### Reset Database

```bash
# Stop services
./stop.sh

# Delete all data
docker compose down -v

# Start fresh
./start.sh

# Run migrations
cd packages/db
bunx prisma migrate dev --name init
```

### View Redis Queue

```bash
docker compose exec redis redis-cli
LLEN job_queue           # Queue length
LRANGE job_queue 0 -1    # See all queued jobs
```

---

## Project Structure

```
Pipeyard/
├── apps/
│   ├── backend/         # Express API + WebSocket
│   ├── worker/          # Background job processor
│   └── web/             # Next.js dashboard
├── packages/
│   ├── db/              # Prisma database
│   ├── redis/           # Queue + Pub/Sub
│   └── types/           # Shared schemas
├── nginx/               # Load balancer config
├── docker-compose.yml   # Local dev (DB + Redis only)
├── docker-compose.prod.yml  # Full production stack
├── start.sh             # Start local development
└── stop.sh              # Stop local development
```

---

## Ports

| Service | Local Dev | Docker Prod |
|---------|-----------|-------------|
| API | 3000 | 8080 (via NGINX) |
| Frontend | 3001 | - |
| PostgreSQL | 5432 | 5432 (internal) |
| Redis | 6379 | 6379 (internal) |
| Prisma Studio | 5555 | - |

---

## Troubleshooting

### Port already in use

```bash
# Find what's using the port
lsof -i :3000

# Kill it
kill -9 <PID>
```

### Docker build fails

```bash
# Clean Docker cache
docker system prune -a

# Rebuild
docker compose -f docker-compose.prod.yml up --build
```

### Database connection error

```bash
# Check if PostgreSQL is running
docker compose ps

# Check logs
docker compose logs postgres
```

### Worker not processing jobs

```bash
# Check Redis connection
docker compose exec redis redis-cli ping

# Check queue
docker compose exec redis redis-cli LLEN job_queue
```
