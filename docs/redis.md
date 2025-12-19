# Redis Reference

## CLI Commands

```bash
# Connect to Redis CLI
redis-cli

# In Docker
docker compose exec redis redis-cli
```

---

## Queue Operations (LIST)

```bash
# Push to queue (right side)
RPUSH job_queue "job-id-1"
RPUSH job_queue "job-id-2" "job-id-3"

# Pop from queue (left side) - FIFO
LPOP job_queue

# Pop multiple (Redis 6.2+)
LPOP job_queue 5

# View queue without removing
LRANGE job_queue 0 -1    # all items
LRANGE job_queue 0 9     # first 10

# Queue length
LLEN job_queue

# Clear queue
DEL job_queue
```

---

## Pub/Sub

```bash
# Subscribe to channel
SUBSCRIBE job_updates

# Publish message
PUBLISH job_updates '{"jobId":"abc","status":"COMPLETED"}'

# Subscribe to pattern
PSUBSCRIBE job_*
```

---

## Bun/Node Redis Client

```bash
bun add ioredis
```

```ts
import Redis from "ioredis";

// Connection
const redis = new Redis(process.env.REDIS_URL);

// Queue - Push
await redis.rpush("job_queue", jobId);

// Queue - Pop batch
const jobs = await redis.lpop("job_queue", 5);

// Pub/Sub - Publisher
await redis.publish("job_updates", JSON.stringify({ jobId, status }));

// Pub/Sub - Subscriber (separate connection!)
const sub = new Redis(process.env.REDIS_URL);
sub.subscribe("job_updates");
sub.on("message", (channel, message) => {
  const data = JSON.parse(message);
  console.log(data);
});
```

---

## Common Errors & Fixes

### Connection refused

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Fix:**
```bash
# Check if Redis is running
docker compose ps redis

# In Docker, use service name
REDIS_URL=redis://redis:6379
```

---

### WRONGTYPE Operation against a key

```
WRONGTYPE Operation against a key holding the wrong kind of value
```

**Fix:** Key exists as different type. Delete it:
```bash
DEL job_queue
```

---

### Pub/Sub on same connection as commands

```ts
// ❌ Wrong - can't use same connection for pub/sub AND commands
const redis = new Redis();
redis.subscribe("channel");
await redis.get("key");  // ERROR!

// ✅ Correct - separate connections
const redis = new Redis();     // for commands
const sub = new Redis();       // for subscriptions
```

---

### Memory issues

```bash
# Check memory usage
redis-cli INFO memory

# Flush all data (careful!)
redis-cli FLUSHALL
```

---

## Debugging

```bash
# Monitor all commands in real-time
redis-cli MONITOR

# Check all keys
redis-cli KEYS "*"

# Key type
redis-cli TYPE job_queue

# TTL
redis-cli TTL some_key
```
