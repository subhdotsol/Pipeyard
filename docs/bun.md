# Bun Reference

## Basic Commands

```bash
# Run a file
bun run src/index.ts

# Install dependencies
bun install

# Add package
bun add ioredis zod

# Add dev dependency
bun add -d typescript @types/node

# Run script from package.json
bun run dev
```

---

## HTTP Server

```ts
const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    // POST /jobs
    if (req.method === "POST" && url.pathname === "/jobs") {
      const body = await req.json();
      // ... create job
      return Response.json({ jobId: "..." }, { status: 201 });
    }

    // GET /jobs?tenantId=xxx
    if (req.method === "GET" && url.pathname === "/jobs") {
      const tenantId = url.searchParams.get("tenantId");
      // ... fetch jobs
      return Response.json(jobs);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running on port ${server.port}`);
```

---

## WebSocket Server

```ts
const server = Bun.serve({
  port: 3000,
  fetch(req, server) {
    // Upgrade to WebSocket
    if (new URL(req.url).pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }
    return new Response("Not Found", { status: 404 });
  },
  websocket: {
    open(ws) {
      console.log("Client connected");
    },
    message(ws, message) {
      const data = JSON.parse(message.toString());
      if (data.type === "SUBSCRIBE") {
        ws.subscribe(data.tenantId);  // Subscribe to topic
      }
    },
    close(ws) {
      console.log("Client disconnected");
    },
  },
});

// Publish to all subscribers of a topic
server.publish("tenant-1", JSON.stringify({ jobId: "...", status: "COMPLETED" }));
```

---

## Environment Variables

```ts
// Access env vars
const port = process.env.PORT || 3000;
const redisUrl = process.env.REDIS_URL;

// Or use Bun.env
const dbUrl = Bun.env.DATABASE_URL;
```

---

## File Reading/Writing

```ts
// Read file
const content = await Bun.file("config.json").text();
const json = await Bun.file("data.json").json();

// Write file
await Bun.write("output.txt", "Hello World");
```

---

## Common Errors & Fixes

### Module not found

```
error: Cannot find module "ioredis"
```

**Fix:**
```bash
bun install
# or
bun add ioredis
```

---

### Port already in use

```
error: Failed to start server. Port 3000 is already in use
```

**Fix:**
```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>
```

---

### TypeScript errors

```
Property 'x' does not exist on type 'unknown'
```

**Fix:** Bun runs TypeScript but still type-checks. Add proper types:
```ts
const body = await req.json() as { tenantId: string };
```

---

### Bun.serve not returning Response

```
error: fetch() must return a Response object
```

**Fix:** Always return a Response (except for WebSocket upgrades):
```ts
fetch(req, server) {
  if (server.upgrade(req)) return undefined;  // OK for WS
  return new Response("...");  // Required for HTTP
}
```

---

## Zod Validation

```bash
bun add zod
```

```ts
import { z } from "zod";

const CreateJobSchema = z.object({
  tenantId: z.string().min(1),
  type: z.string(),
  payload: z.record(z.unknown()),
});

// In handler
const result = CreateJobSchema.safeParse(await req.json());
if (!result.success) {
  return Response.json({ error: result.error.issues }, { status: 400 });
}
const { tenantId, type, payload } = result.data;
```
