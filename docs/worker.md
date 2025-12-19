# Worker Reference

## Quick Start

```bash
# Terminal 1: Start infrastructure
docker compose up -d

# Terminal 2: Start API
cd apps/backend
bun run index.ts

# Terminal 3: Start Worker
cd apps/worker
bun run index.ts
```

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │ ──▶ │   API       │ ──▶ │   Database  │
└─────────────┘     │ POST /jobs  │     │   Postgres  │
                    └──────┬──────┘     └─────────────┘
                           │
                           │ LPUSH
                           ▼
                    ┌─────────────┐
                    │   Redis     │
                    │   Queue     │
                    └──────┬──────┘
                           │
                           │ BRPOP
                           ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Worker    │ ──▶ │   Process   │
                    │             │     │   Job       │
                    └──────┬──────┘     └─────────────┘
                           │
                           │ PUBLISH
                           ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Redis     │ ──▶ │   API       │
                    │   Pub/Sub   │     │ (WebSocket) │
                    └─────────────┘     └─────────────┘
```

---

## Job Lifecycle

```
PENDING → RUNNING → COMPLETED
                  ↘ FAILED (after max retries)
```

| Status | Description |
|--------|-------------|
| `PENDING` | Job created, waiting in queue |
| `RUNNING` | Worker is processing the job |
| `COMPLETED` | Job finished successfully |
| `FAILED` | Job failed after max retries |

---

## Configuration

**`apps/worker/index.ts`:**
```ts
const POLL_INTERVAL_MS = 1000;  // How often to check for jobs
const MAX_ATTEMPTS = 3;         // Maximum retry attempts
const BATCH_SIZE = 5;           // Future: concurrent processing
```

---

## Retry Logic

1. Worker pops job from queue
2. Increments `attempts` counter
3. Processes job
4. **On success:** Mark as `COMPLETED`
5. **On failure:**
   - If `attempts < MAX_ATTEMPTS`: Requeue as `PENDING`
   - If `attempts >= MAX_ATTEMPTS`: Mark as `FAILED`

```ts
// Retry flow
if (newAttempts >= MAX_ATTEMPTS) {
  await markJobFailed(jobId, tenantId, errorMessage);
} else {
  await prisma.job.update({ status: "PENDING", error: errorMessage });
  await redis.lpush("job_queue", jobId);  // Requeue
}
```

---

## Job Processors

**`apps/worker/processor.ts`:**

| Type | Handler | Description |
|------|---------|-------------|
| `email` | `processEmailJob` | Send email (simulated) |
| `webhook` | `processWebhookJob` | HTTP request to URL |
| `sleep` | `processSleepJob` | Wait for delayMs |
| `data_processing` | `processDataJob` | Process data (simulated) |

### Adding a New Job Type

1. Add to `packages/types/enums.ts`:
```ts
export const JobType = {
  // ...existing
  MY_NEW_TYPE: "my_new_type",
} as const;
```

2. Add processor in `apps/worker/processor.ts`:
```ts
async function processMyNewTypeJob(payload: Record<string, unknown>): Promise<ProcessResult> {
  // Your logic here
  return { success: true };
}
```

3. Add to dispatcher switch:
```ts
case "my_new_type":
  return processMyNewTypeJob(payload);
```

---

## Pub/Sub Updates

Worker publishes status updates to Redis:
```ts
await publishJobUpdate(redis, {
  tenantId: "tenant-1",
  jobId: "job-uuid",
  status: "COMPLETED",
  error: null,
});
```

API subscribes and broadcasts to WebSocket clients.

---

## Graceful Shutdown

Worker handles SIGINT and SIGTERM:
```ts
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});
```

Press `Ctrl+C` to stop the worker cleanly.

---

## Scaling Workers

Run multiple worker instances:
```bash
# Terminal 1
cd apps/worker && bun run index.ts

# Terminal 2
cd apps/worker && bun run index.ts
```

Each worker competes for jobs from the same Redis queue.

---

## Common Issues

### Worker not processing jobs

1. Check Redis is running: `docker compose ps`
2. Check queue has jobs: `docker compose exec redis redis-cli LLEN job_queue`
3. Check worker is connected: Look for `[Redis] Connected` log

### Jobs stuck in RUNNING

Database shows RUNNING but worker crashed. Reset:
```sql
UPDATE "Job" SET status = 'PENDING', attempts = 0 WHERE status = 'RUNNING';
```

### Retry loop

Jobs failing repeatedly will be requeued until `MAX_ATTEMPTS`. Check:
- Error message in database `error` column
- Worker logs for failure reason
