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

---

## Quick Reference Commands

| Command | Purpose |
|---------|---------|
| `docker compose up -d` | Start PostgreSQL |
| `docker compose down` | Stop PostgreSQL |
| `docker compose down -v` | Stop + delete data |
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
│   └── types/
│       ├── enums.ts          # JobStatus, JobType
│       └── schemas.ts        # Zod validation
├── docker-compose.yml        # PostgreSQL container
└── docs/
    ├── prisma.md
    ├── docker.md
    ├── websocket.md
    └── api-test.md
```
