# @repo/db

Shared database package for the async-backend monorepo. Uses **Prisma 7** with PostgreSQL adapter.

## Setup

```bash
# Install dependencies
bun install

# Generate Prisma client (required after schema changes)
bunx prisma generate

# Run migrations
bunx prisma migrate dev
```

## Environment Variables

Create a `.env` file in this directory:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jobs"
```

## Usage

```ts
import { prisma, JobStatus } from "@repo/db";
import type { Job } from "@repo/db";

// Create a job
const job = await prisma.job.create({
  data: {
    tenantId: "tenant-1",
    type: "email",
    payload: { to: "user@example.com" },
    status: "PENDING",
  },
});

// Query jobs
const pendingJobs = await prisma.job.findMany({
  where: { status: JobStatus.PENDING },
});
```

## Commands

| Command | Description |
|---------|-------------|
| `bunx prisma generate` | Generate client after schema changes |
| `bunx prisma migrate dev` | Create and apply migrations |
| `bunx prisma studio` | Open database GUI |
| `bunx prisma validate` | Validate schema |

## Architecture

```
packages/db/
├── prisma/
│   └── schema.prisma      # Database models
├── generated/prisma/      # Auto-generated client (gitignored)
├── prisma.config.ts       # Prisma 7 config (DATABASE_URL)
├── index.ts               # Singleton client + adapter setup
└── .env                   # Environment variables (gitignored)
```

## Prisma 7 Notes

> [!IMPORTANT]
> Prisma 7 requires a database adapter. This package uses `@prisma/adapter-pg` with the `pg` driver.

See [docs/prisma.md](../../docs/prisma.md) for more details.
