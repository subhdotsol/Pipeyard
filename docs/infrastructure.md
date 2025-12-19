# Infrastructure Documentation

## Docker Compose Production Setup

### Architecture

```
                    ┌─────────────────────────────────────────┐
                    │              NGINX (port 8080)          │
                    │           Load Balancer                 │
                    └───────────────────┬─────────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
              ▼                         ▼                         ▼
       ┌────────────┐            ┌────────────┐            ┌────────────┐
       │  API #1    │            │  API #2    │            │  API #3    │
       │ (port 3000)│            │ (port 3000)│            │ (port 3000)│
       └─────┬──────┘            └─────┬──────┘            └─────┬──────┘
             │                         │                         │
             └─────────────────────────┼─────────────────────────┘
                                       │
                    ┌──────────────────┴───────────────────┐
                    │                                      │
                    ▼                                      ▼
             ┌────────────┐                         ┌────────────┐
             │ PostgreSQL │                         │   Redis    │
             │  (Database)│                         │  (Queue)   │
             └────────────┘                         └─────┬──────┘
                                                          │
                    ┌─────────────────────────────────────┼───────────┐
                    │                    │                │           │
                    ▼                    ▼                ▼           │
             ┌────────────┐       ┌────────────┐   ┌────────────┐    │
             │ Worker #1  │       │ Worker #2  │   │ Worker #3  │    │
             └────────────┘       └────────────┘   └────────────┘    │
                    │                    │                │           │
                    └────────────────────┴────────────────┘           │
                                         │                            │
                                         ▼                            │
                                  ┌────────────┐                      │
                                  │  Pub/Sub   │──────────────────────┘
                                  └────────────┘
```

---

## Quick Start

### Start Production Stack

```bash
# Build and start all services
docker compose -f docker-compose.prod.yml up --build

# Run in background
docker compose -f docker-compose.prod.yml up -d --build
```

### Stop Production Stack

```bash
docker compose -f docker-compose.prod.yml down

# Remove volumes (delete data)
docker compose -f docker-compose.prod.yml down -v
```

---

## Scaling

### Scale Workers

```bash
# Run 5 workers instead of 3
docker compose -f docker-compose.prod.yml up -d --scale worker=5
```

### Scale API Servers

```bash
# Run 4 API servers
docker compose -f docker-compose.prod.yml up -d --scale api=4
```

### Check Running Instances

```bash
docker compose -f docker-compose.prod.yml ps
```

---

## Accessing Services

| Service | URL | Description |
|---------|-----|-------------|
| NGINX (Load Balancer) | http://localhost:8080 | Entry point for API |
| API Health | http://localhost:8080/health | Health check |
| Create Job | POST http://localhost:8080/jobs | Create a job |
| List Jobs | GET http://localhost:8080/jobs?tenantId=X | List jobs |
| WebSocket | ws://localhost:8080/ws | Real-time updates |

---

## Viewing Logs

```bash
# All logs
docker compose -f docker-compose.prod.yml logs -f

# API logs only
docker compose -f docker-compose.prod.yml logs -f api

# Worker logs only
docker compose -f docker-compose.prod.yml logs -f worker

# NGINX logs
docker compose -f docker-compose.prod.yml logs -f nginx
```

---

## Testing Horizontal Scaling

### 1. Start the stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 2. Check instances

```bash
docker compose -f docker-compose.prod.yml ps
```

### 3. Create multiple jobs

```bash
# Create 10 jobs quickly
for i in {1..10}; do
  curl -X POST http://localhost:8080/jobs \
    -H "Content-Type: application/json" \
    -d '{"tenantId":"tenant-1","type":"sleep","payload":{"delayMs":5000}}'
done
```

### 4. Watch workers process in parallel

```bash
docker compose -f docker-compose.prod.yml logs -f worker
```

You should see different workers picking up different jobs!

---

## Running Migrations (First Time)

After starting the stack, run migrations:

```bash
# Connect to a running API container
docker compose -f docker-compose.prod.yml exec api sh

# Inside the container
cd packages/db
bunx prisma migrate deploy
exit
```

Or run directly:

```bash
docker compose -f docker-compose.prod.yml exec api bunx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
```

---

## Troubleshooting

### API can't connect to database

```bash
# Check postgres is healthy
docker compose -f docker-compose.prod.yml ps postgres

# Check logs
docker compose -f docker-compose.prod.yml logs postgres
```

### Workers not processing jobs

```bash
# Check redis is healthy
docker compose -f docker-compose.prod.yml exec redis redis-cli ping

# Check queue
docker compose -f docker-compose.prod.yml exec redis redis-cli LLEN job_queue
```

### Rebuild after code changes

```bash
docker compose -f docker-compose.prod.yml up -d --build
```
