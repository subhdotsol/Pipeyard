# Building an Async Job Queue Backend - Step by Step

A complete guide to building a real-time multi-tenant job queue system with TypeScript.

---

## Phase 1: Foundation Setup

### 1.1 Initialize Turborepo Monorepo

```bash
bunx create-turbo@latest async-backend
cd async-backend
```

### 1.2 Create Shared Database Package

```bash
cd packages/db
bun add prisma @prisma/client @prisma/adapter-pg pg dotenv
bun add -d @types/pg
bunx prisma init
```

**Configure `prisma/schema.prisma`:**
```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model Job {
  id        String    @id @default(uuid())
  tenantId  String
  type      String
  payload   Json
  status    JobStatus @default(PENDING)
  attempts  Int       @default(0)
  error     String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([tenantId])
  @@index([status])
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

**Create `prisma.config.ts`:**
```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

**Create `index.ts` (singleton with pg adapter):**
```ts
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "./generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "./generated/prisma/client.ts";
```

**Update `package.json`:**
```json
{
  "name": "@repo/db",
  "main": "./index.ts",
  "exports": { ".": { "types": "./index.ts", "default": "./index.ts" } }
}
```

---

### 1.3 Create Shared Types Package

```bash
cd packages/types
bun add zod
```

**Create `enums.ts`:**
```ts
export const JobStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const JobType = {
  EMAIL: "email",
  WEBHOOK: "webhook",
  SLEEP: "sleep",
  DATA_PROCESSING: "data_processing",
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];
```

**Create `schemas.ts`:**
```ts
import { z } from "zod/v4";
import { JobStatus, JobType } from "./enums.ts";

export const CreateJobSchema = z.object({
  tenantId: z.string().min(1).max(100),
  type: z.enum([JobType.EMAIL, JobType.WEBHOOK, JobType.SLEEP, JobType.DATA_PROCESSING]),
  payload: z.record(z.string(), z.unknown()),
});

export const ListJobsQuerySchema = z.object({
  tenantId: z.string().min(1),
  status: z.enum([JobStatus.PENDING, JobStatus.RUNNING, JobStatus.COMPLETED, JobStatus.FAILED]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type ListJobsQuery = z.infer<typeof ListJobsQuerySchema>;
```

**Create `index.ts`:**
```ts
export * from "./enums.ts";
export * from "./schemas.ts";
```

---

## Phase 2: Backend API

### 2.1 Set Up Express + WebSocket Server

```bash
cd apps/backend
bun add express cors ws @repo/db @repo/types
bun add -d @types/express @types/cors @types/ws
```

**Create `index.ts`:**
```ts
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { prisma, Prisma } from "@repo/db";
import { CreateJobSchema, ListJobsQuerySchema, JobStatus } from "@repo/types";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

// WebSocket connection handling
const subscriptions = new Map<string, Set<WebSocket>>();

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "CONNECTED", message: "Connected to job updates" }));
  
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === "SUBSCRIBE") {
      if (!subscriptions.has(msg.tenantId)) subscriptions.set(msg.tenantId, new Set());
      subscriptions.get(msg.tenantId)!.add(ws);
    }
  });
  
  ws.on("close", () => subscriptions.forEach((clients) => clients.delete(ws)));
});

// POST /jobs - Create job
app.post("/jobs", async (req, res) => {
  const result = CreateJobSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Validation failed" });

  const { tenantId, type, payload } = result.data;
  const job = await prisma.job.create({
    data: { tenantId, type, payload: payload as Prisma.InputJsonValue, status: JobStatus.PENDING },
  });
  res.status(201).json({ jobId: job.id });
});

// GET /jobs - List jobs
app.get("/jobs", async (req, res) => {
  const result = ListJobsQuerySchema.safeParse(req.query);
  if (!result.success) return res.status(400).json({ error: "Validation failed" });

  const { tenantId, status, limit, offset } = result.data;
  const [jobs, total] = await Promise.all([
    prisma.job.findMany({ where: { tenantId, ...(status && { status }) }, take: limit, skip: offset }),
    prisma.job.count({ where: { tenantId, ...(status && { status }) } }),
  ]);
  res.json({ jobs, total });
});

// GET /health
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

httpServer.listen(3000, () => console.log("🚀 Server running on http://localhost:3000"));
```

---

## Phase 3: Docker PostgreSQL

### 3.1 Create docker-compose.yml

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

### 3.2 Create .env file

**`packages/db/.env`:**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jobs"
```

### 3.3 Start Database & Run Migrations

```bash
# Start PostgreSQL
docker compose up -d

# Generate Prisma client
cd packages/db
bunx prisma generate

# Run migrations
bunx prisma migrate dev --name init

# Start backend
cd apps/backend
bun run index.ts
```

---

## Phase 4: Redis Queue

### 4.1 Add Redis to docker-compose.yml

```yaml
services:
  postgres:
    # ... existing postgres config

  redis:
    image: redis:7-alpine
    container_name: async-backend-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    command: redis-server --appendonly yes

volumes:
  postgres_data:
  redis_data:
```

```bash
# Start Redis
docker compose up -d redis

# Verify it's running
docker compose exec redis redis-cli ping
# → PONG
```

### 4.2 Create Redis Package

```bash
mkdir -p packages/redis
cd packages/redis
bun init -y
bun add ioredis
```

**Create `package.json`:**
```json
{
  "name": "@repo/redis",
  "main": "./index.ts",
  "exports": { ".": { "types": "./index.ts", "default": "./index.ts" } },
  "dependencies": { "ioredis": "^5.8.2" }
}
```

### 4.3 Queue Operations (queue.ts)

```ts
import type { Redis } from "ioredis";

const JOB_QUEUE_KEY = "job_queue";

// Push job to queue
export async function pushJob(redis: Redis, jobId: string): Promise<number> {
  return redis.lpush(JOB_QUEUE_KEY, jobId);
}

// Pop job (blocking, waits up to timeout seconds)
export async function popJob(redis: Redis, timeout: number = 5): Promise<string | null> {
  const result = await redis.brpop(JOB_QUEUE_KEY, timeout);
  return result ? result[1] : null;
}

// Pop multiple jobs (non-blocking)
export async function popJobs(redis: Redis, count: number): Promise<string[]> {
  const pipeline = redis.pipeline();
  for (let i = 0; i < count; i++) {
    pipeline.rpop(JOB_QUEUE_KEY);
  }
  const results = await pipeline.exec();
  return results?.map(([_, v]) => v).filter((v): v is string => v !== null) ?? [];
}

// Queue length
export async function getQueueLength(redis: Redis): Promise<number> {
  return redis.llen(JOB_QUEUE_KEY);
}
```

### 4.4 Pub/Sub Operations (pubsub.ts)

```ts
import Redis from "ioredis";

const JOB_UPDATES_CHANNEL = "job_updates";

export interface JobUpdateMessage {
  tenantId: string;
  jobId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  error?: string | null;
}

// Publish job status update
export async function publishJobUpdate(redis: Redis, message: JobUpdateMessage): Promise<number> {
  return redis.publish(JOB_UPDATES_CHANNEL, JSON.stringify(message));
}

// Subscribe to job updates (creates dedicated connection)
export function subscribeToJobUpdates(
  redisUrl: string,
  handler: (message: JobUpdateMessage) => void
): () => void {
  const subscriber = new Redis(redisUrl);

  subscriber.subscribe(JOB_UPDATES_CHANNEL);
  subscriber.on("message", (channel, message) => {
    if (channel === JOB_UPDATES_CHANNEL) {
      handler(JSON.parse(message));
    }
  });

  return () => {
    subscriber.unsubscribe(JOB_UPDATES_CHANNEL);
    subscriber.quit();
  };
}
```

### 4.5 Main Export (index.ts)

```ts
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL);
  }
  return redisClient;
}

export * from "./queue.ts";
export * from "./pubsub.ts";
```

---

## Testing

### Test API with curl

```bash
# Health check
curl http://localhost:3000/health

# Create job
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"tenant-1","type":"sleep","payload":{"delayMs":1000}}'

# List jobs
curl "http://localhost:3000/jobs?tenantId=tenant-1"
```

### Test WebSocket with websocat

```bash
brew install websocat
websocat ws://localhost:3000/ws
# Type: {"type":"SUBSCRIBE","tenantId":"tenant-1"}
```

### Test Redis with CLI

```bash
# Connect to Redis CLI
docker compose exec redis redis-cli

# View queue
LRANGE job_queue 0 -1

# Queue length
LLEN job_queue

# Test pub/sub (terminal 1)
SUBSCRIBE job_updates

# Test pub/sub (terminal 2)
PUBLISH job_updates '{"tenantId":"t1","jobId":"j1","status":"COMPLETED"}'
```

---

## Quick Reference Commands

| Command | Purpose |
|---------|---------|
| `docker compose up -d` | Start PostgreSQL + Redis |
| `docker compose down` | Stop all |
| `docker compose down -v` | Stop + delete data |
| `docker compose exec redis redis-cli` | Redis CLI |
| `bunx prisma generate` | Regenerate Prisma client |
| `bunx prisma migrate dev` | Create/apply migrations |
| `bunx prisma studio` | Open database GUI |
| `bun run index.ts` | Start backend server |

---

## Project Structure

```
async-backend/
├── apps/
│   └── backend/
│       └── index.ts          # Express + WebSocket server
├── packages/
│   ├── db/
│   │   ├── index.ts          # Prisma singleton
│   │   ├── prisma/
│   │   │   └── schema.prisma # Database schema
│   │   └── .env              # DATABASE_URL
│   ├── redis/
│   │   ├── index.ts          # Redis client factory
│   │   ├── queue.ts          # Push/pop operations
│   │   └── pubsub.ts         # Publish/subscribe
│   └── types/
│       ├── enums.ts          # JobStatus, JobType
│       └── schemas.ts        # Zod validation
├── docker-compose.yml        # PostgreSQL + Redis
└── docs/
    ├── prisma.md
    ├── docker.md
    ├── redis.md
    ├── websocket.md
    └── api-test.md
```
