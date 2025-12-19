# Docker Reference

## Quick Start (PostgreSQL)

```bash
# Start PostgreSQL
docker compose up -d

# Check it's running
docker compose ps

# View logs
docker compose logs -f postgres

# Stop
docker compose down

# Stop and delete data
docker compose down -v
```

---

## Current Setup

### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: async-backend-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: jobs
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

### DATABASE_URL

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jobs"
```

---

## After Starting PostgreSQL

```bash
# 1. Start Postgres
docker compose up -d

# 2. Run migrations
cd packages/db
bunx prisma migrate dev

# 3. Start the backend
cd apps/backend
bun run index.ts
```

---

## Essential Commands

```bash
# Build and start all services
docker compose up --build

# Start in background
docker compose up -d

# Stop all services
docker compose down

# Stop and remove volumes (resets data)
docker compose down -v

# View logs
docker compose logs -f          # all services
docker compose logs -f postgres # specific service

# Scale services
docker compose up --scale api=2 --scale worker=3

# Restart a service
docker compose restart postgres

# Rebuild single service
docker compose up --build api
```

---

## Debugging

```bash
# Shell into container
docker compose exec postgres sh

# Connect to PostgreSQL
docker compose exec postgres psql -U postgres -d jobs

# View running containers
docker compose ps

# Check resource usage
docker stats
```

---

## Common Errors & Fixes

### Port 5432 already in use

```bash
# Find what's using the port
lsof -i :5432
kill -9 <PID>
```

### Connection refused from app

Use **localhost** when running app locally (outside Docker):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jobs"
```

Use **service name** when running app inside Docker:
```env
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/jobs"
```

### Volume permission issues

```bash
docker compose down -v
docker volume prune
docker compose up --build
```

### Full rebuild

```bash
docker compose build --no-cache
docker compose up -d
```

---

## Data Persistence

Data is stored in a Docker volume called `postgres_data`. 

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect async-backend_postgres_data

# Delete volume (DELETES ALL DATA)
docker volume rm async-backend_postgres_data
```

The data persists even after `docker compose down`.
Use `docker compose down -v` to also delete the volume.
