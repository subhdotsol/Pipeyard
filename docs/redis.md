# Redis Reference

## Quick Start

```bash
# Start Redis
docker compose up -d redis

# Check Redis is running
docker compose exec redis redis-cli ping
# → PONG

# Stop Redis
docker compose stop redis
```

---

## Docker Setup

**docker-compose.yml:**
```yaml
redis:
  image: redis:7-alpine
  container_name: async-backend-redis
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
```

**Environment Variable:**
```env
REDIS_URL="redis://localhost:6379"
```

---

## @repo/redis Package

### Installation

```bash
cd packages/redis
bun add ioredis
```

### Usage

```ts
import { 
  getRedisClient,
  pushJob, 
  popJob,
  publishJobUpdate,
  createPubSub
} from "@repo/redis";

const redis = getRedisClient();
```

---

## Queue Operations (LIST)

Redis LIST provides a FIFO queue using LPUSH + RPOP.

### Push Jobs

```ts
import { getRedisClient, pushJob, pushJobs } from "@repo/redis";

const redis = getRedisClient();

// Push single job
await pushJob(redis, "job-uuid-1");

// Push multiple jobs
await pushJobs(redis, ["job-uuid-2", "job-uuid-3"]);
```

### Pop Jobs

```ts
import { popJob, popJobs } from "@repo/redis";

// Blocking pop - waits up to 5 seconds
const jobId = await popJob(redis, 5);

// Batch pop - get up to 10 jobs immediately
const jobIds = await popJobs(redis, 10);
```

### Queue Management

```ts
import { getQueueLength, clearQueue } from "@repo/redis";

// Check queue length
const length = await getQueueLength(redis);
console.log(`${length} jobs in queue`);

// Clear queue (careful!)
await clearQueue(redis);
```

---

## Pub/Sub (Real-time Updates)

### Publish Updates

```ts
import { getRedisClient, publishJobUpdate } from "@repo/redis";

const redis = getRedisClient();

// Worker publishes status update
await publishJobUpdate(redis, {
  tenantId: "tenant-1",
  jobId: "job-uuid",
  status: "COMPLETED",
  error: null,
});
```

### Subscribe to Updates

```ts
import { subscribeToJobUpdates } from "@repo/redis";

// Subscribe (creates dedicated connection)
const unsubscribe = subscribeToJobUpdates(
  "redis://localhost:6379",
  (message) => {
    console.log(`Job ${message.jobId}: ${message.status}`);
    // Broadcast to WebSocket clients
    broadcastJobUpdate(message.tenantId, message.jobId, message.status);
  }
);

// Later: cleanup
unsubscribe();
```

### PubSub Helper

```ts
import { createPubSub } from "@repo/redis";

const pubsub = createPubSub("redis://localhost:6379");

// Publish
await pubsub.publish({
  tenantId: "tenant-1",
  jobId: "job-uuid",
  status: "RUNNING",
});

// Subscribe
const unsubscribe = pubsub.subscribe((msg) => {
  console.log(msg);
});

// Cleanup
pubsub.close();
```

---

## Redis CLI Commands

```bash
# Connect to Redis CLI
docker compose exec redis redis-cli

# Queue operations
LLEN job_queue              # Queue length
LRANGE job_queue 0 -1       # View all jobs in queue
LPUSH job_queue "job-id"    # Add job
RPOP job_queue              # Remove job

# Pub/Sub testing
SUBSCRIBE job_updates       # Listen for updates
PUBLISH job_updates '{"tenantId":"t1","jobId":"j1","status":"COMPLETED"}'

# Clear queue
DEL job_queue

# View all keys
KEYS *
```

---

## Architecture

```
┌─────────────┐     LPUSH      ┌─────────────┐     RPOP       ┌─────────────┐
│   API       │ ──────────────▶│   REDIS     │◀───────────────│   WORKER    │
│  (Producer) │                │   LIST      │                │  (Consumer) │
└─────────────┘                └─────────────┘                └──────┬──────┘
                                                                     │
                                     ┌───────────────────────────────┘
                                     │ PUBLISH
                                     ▼
                               ┌─────────────┐     SUBSCRIBE   ┌─────────────┐
                               │   REDIS     │ ───────────────▶│   API       │
                               │   PUB/SUB   │                 │ (WebSocket) │
                               └─────────────┘                 └─────────────┘
```

**Flow:**
1. API creates job in Postgres, pushes job ID to Redis queue
2. Worker pops job IDs, processes jobs
3. Worker publishes status updates to Redis Pub/Sub
4. API subscribes, broadcasts to WebSocket clients

---

## Common Errors

### Connection Refused

```
ECONNREFUSED 127.0.0.1:6379
```

**Fix:**
```bash
docker compose up -d redis
docker compose ps  # verify it's running
```

### Pub/Sub in Same Connection

```
ERR only SUBSCRIBE/UNSUBSCRIBE/PING/QUIT allowed in SUBSCRIBE mode
```

**Fix:** Pub/Sub requires a dedicated connection. Use `subscribeToJobUpdates()` which creates its own connection.
