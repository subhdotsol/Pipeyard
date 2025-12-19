# Docker Reference

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
docker compose logs -f api      # specific service

# Scale services
docker compose up --scale api=2 --scale worker=3

# Restart a single service
docker compose restart api

# Rebuild single service
docker compose up --build api
```

---

## Debugging

```bash
# Shell into container
docker compose exec api sh

# View running containers
docker compose ps

# Check resource usage
docker stats
```

---

## Common Errors & Fixes

### Port already in use

```
Error: bind: address already in use
```

**Fix:**
```bash
# Find what's using the port
lsof -i :5432    # or whatever port
kill -9 <PID>
```

---

### Container can't connect to another service

```
Error: ECONNREFUSED 127.0.0.1:5432
```

**Fix:** Use **service name**, not `localhost`:
```ts
// ❌ Wrong
host: "localhost"

// ✅ Correct
host: "postgres"  // matches service name in docker-compose
```

---

### Volume permission issues

```
Error: EACCES: permission denied
```

**Fix:**
```bash
docker compose down -v
docker volume prune
docker compose up --build
```

---

### Build cache issues

```bash
# Nuclear option - full rebuild
docker compose build --no-cache
docker compose up
```

---

### Container keeps restarting

```bash
# Check logs for crash reason
docker compose logs api --tail 50

# Common causes:
# - Missing env vars
# - Database not ready yet (use healthcheck + depends_on)
# - Syntax error in code
```

---

## Dockerfile Template (Bun)

```dockerfile
FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

CMD ["bun", "run", "src/index.ts"]
```

---

## docker-compose.yml Template

```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: jobs
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  api:
    build: ./apps/api
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/jobs
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started

volumes:
  postgres_data:
```
