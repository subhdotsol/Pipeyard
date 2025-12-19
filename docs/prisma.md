# Prisma Reference

## Setup

```bash
bun add prisma @prisma/client
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

## Monorepo Setup

When using Prisma in a Turborepo package:

```
packages/database/
├── prisma/
│   └── schema.prisma
├── src/
│   └── index.ts      # Export client
├── package.json
└── tsconfig.json
```

```ts
// packages/database/src/index.ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
export * from "@prisma/client";
```

```json
// packages/database/package.json
{
  "name": "@repo/database",
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev",
    "studio": "prisma studio"
  }
}
```
