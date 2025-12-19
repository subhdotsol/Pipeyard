# Turborepo Reference

## Structure

```
async-backend/
├── apps/
│   ├── api/         # Bun API server
│   ├── worker/      # Bun worker
│   └── web/         # Next.js frontend
├── packages/
│   ├── database/    # Prisma client
│   └── shared/      # Shared types/schemas
├── package.json
└── turbo.json
```

---

## Commands

```bash
# Run all dev servers
bun run dev

# Build all
bun run build

# Run specific app
bun run dev --filter=api
bun run dev --filter=web

# Run specific package script
bun run --filter=@repo/database generate
```

---

## Adding a New App

```bash
mkdir -p apps/api/src
```

```json
// apps/api/package.json
{
  "name": "api",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist"
  },
  "dependencies": {
    "@repo/database": "workspace:*",
    "@repo/shared": "workspace:*"
  }
}
```

---

## Adding a New Package

```bash
mkdir -p packages/shared/src
```

```json
// packages/shared/package.json
{
  "name": "@repo/shared",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "check-types": "tsc --noEmit"
  }
}
```

---

## Using Packages in Apps

```ts
// apps/api/src/index.ts
import { prisma } from "@repo/database";
import { CreateJobSchema } from "@repo/shared";
```

---

## turbo.json Config

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "generate": {
      "cache": false
    }
  }
}
```

---

## Common Errors & Fixes

### Package not found

```
Cannot find package '@repo/database'
```

**Fix:**
```bash
# Make sure package.json has workspace dependency
"@repo/database": "workspace:*"

# Reinstall
bun install
```

---

### Circular dependency

```
Detected circular dependency
```

**Fix:** Restructure to avoid. Usually means shared types should be in a separate package.

---

### Cache issues

```bash
# Clear turbo cache
rm -rf .turbo
bun run build
```

---

### Multiple Next.js versions

```bash
# Check for duplicates
bun pm ls next
```

---

## Useful Flags

```bash
# Run with verbose output
turbo run build --verbosity=2

# Continue on error
turbo run build --continue

# Dry run (see what would run)
turbo run build --dry-run
```
