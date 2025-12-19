# Prisma Reference

## Setup

```bash
# Core Prisma dependencies
bun add prisma @prisma/client

# Prisma 7 requires a database adapter
bun add @prisma/adapter-pg pg
bun add -d @types/pg

# Initialize Prisma
bunx prisma init
```

---

## Essential Commands

```bash
# Generate client after schema changes
bunx prisma generate

# Create migration and apply
bunx prisma migrate dev --name init

# Apply migrations in production
bunx prisma migrate deploy

# Reset database (drops all data!)
bunx prisma migrate reset

# Open Prisma Studio (GUI)
bunx prisma studio

# Format schema file
bunx prisma format

# Validate schema
bunx prisma validate
```

---

## Schema Example

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Job {
  id        String    @id @default(uuid())
  tenantId  String
  type      String
  payload   Json
  status    JobStatus
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

---

## Client Usage

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Create
const job = await prisma.job.create({
  data: {
    tenantId: "tenant-1",
    type: "email",
    payload: { to: "user@example.com" },
    status: "PENDING",
  },
});

// Find one
const job = await prisma.job.findUnique({
  where: { id: "..." },
});

// Find many
const jobs = await prisma.job.findMany({
  where: { tenantId: "tenant-1" },
  orderBy: { createdAt: "desc" },
});

// Update one
await prisma.job.update({
  where: { id: "..." },
  data: { status: "RUNNING" },
});

// Update many
await prisma.job.updateMany({
  where: { id: { in: ["id1", "id2"] } },
  data: { status: "RUNNING" },
});

// Delete
await prisma.job.delete({
  where: { id: "..." },
});
```

---

## Common Errors & Fixes

### Can't reach database server

```
Can't reach database server at `localhost:5432`
```

**Fix:**
```bash
# Check DATABASE_URL in .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jobs"

# In Docker, use service name
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/jobs"

# Make sure Postgres is running
docker compose ps postgres
```

---

### Prisma Client not generated

```
@prisma/client did not initialize yet
```

**Fix:**
```bash
bunx prisma generate
```

---

### Schema drift / migration issues

```
Drift detected: Your database schema is not in sync
```

**Fix:**
```bash
# Dev: reset and reapply
bunx prisma migrate reset

# Or: create new migration from current state
bunx prisma migrate dev --name fix_drift
```

---

### P2002: Unique constraint violation

```
Unique constraint failed on the fields: (`id`)
```

**Fix:** You're trying to create a record with duplicate unique field.

---

### P2025: Record not found

```
An operation failed because it depends on records that were not found
```

**Fix:** Check the `where` clause - record doesn't exist.

---

## Monorepo Setup (Prisma 7)

> [!IMPORTANT]
> Prisma 7 has breaking changes. The `url` property is no longer supported in `schema.prisma` - use `prisma.config.ts` instead.

### Directory Structure

```
packages/db/
├── prisma/
│   └── schema.prisma      # Models only, no url
├── generated/
│   └── prisma/            # Auto-generated client
├── prisma.config.ts       # Database URL config
├── index.ts               # Singleton client export
└── package.json
```

---

### prisma.config.ts

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

---

### schema.prisma

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
  // No url here in Prisma 7!
}

model Job {
  id        String    @id @default(uuid())
  tenantId  String
  type      String
  payload   Json
  status    JobStatus @default(PENDING)
  // ... other fields
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

---

### index.ts (Singleton Pattern with Adapter)

> [!IMPORTANT]
> Prisma 7 requires a database adapter. You must use `@prisma/adapter-pg` for PostgreSQL.

```ts
import { PrismaClient } from "./generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

// Prevent multiple instances in development (hot reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create connection pool for PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create adapter (required in Prisma 7)
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export types for consumers
export * from "./generated/prisma/client.ts";
```

---

### package.json

```json
{
  "name": "@repo/db",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": {
      "types": "./index.ts",
      "default": "./index.ts"
    }
  },
  "scripts": {
    "generate": "bunx prisma generate",
    "migrate": "bunx prisma migrate dev",
    "studio": "bunx prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^7.2.0",
    "@prisma/adapter-pg": "^7.2.0",
    "pg": "^8.16.0",
    "prisma": "^7.2.0"
  },
  "devDependencies": {
    "@types/pg": "^8.16.0"
  }
}
```

---

### Using in Other Packages

```json
// apps/backend/package.json
{
  "dependencies": {
    "@repo/db": "*"
  }
}
```

```ts
// apps/backend/index.ts
import { prisma, JobStatus } from "@repo/db";
import type { Job } from "@repo/db";  // Use type-only import for types

// Use the client
const jobs = await prisma.job.findMany({
  where: { status: JobStatus.PENDING },
});

// Types are available
function processJob(job: Job) {
  console.log(job.id, job.status);
}
```

---

### Commands

```bash
# From packages/db directory:
bunx prisma generate     # Generate client after schema changes
bunx prisma migrate dev  # Create and apply migrations
bunx prisma studio       # Open database GUI
```

