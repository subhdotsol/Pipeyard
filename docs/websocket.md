# WebSocket Reference

This project uses the `ws` library with Express to handle real-time job updates via WebSocket connections.

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Browser     │ ←── │  WebSocket      │ ←── │  Redis Pub/Sub  │
│    (Client)     │     │    Server       │     │   (Optional)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │
         │ SUBSCRIBE            │ broadcastJobUpdate()
         │ tenantId             │
         ▼                      ▼
  Real-time               Worker publishes
  job updates             status changes
```

---

## Server-Side Setup (Express + ws)

### Installation

```bash
bun add ws
bun add -d @types/ws
```

### Initializing WebSocket Server

```ts
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const httpServer = createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ 
  server: httpServer, 
  path: "/ws"  // WebSocket endpoint
});

// Track subscriptions: tenantId -> Set of WebSocket connections
const subscriptions = new Map<string, Set<WebSocket>>();
```

### Handling Connections & Messages

```ts
import { WSClientMessageSchema } from "@repo/types";
import type { WSConnected, WSError, WSJobUpdate } from "@repo/types";

wss.on("connection", (ws) => {
  console.log("[WS] Client connected");

  // Send confirmation on connect
  const connectedMsg: WSConnected = {
    type: "CONNECTED",
    message: "Connected to job updates",
  };
  ws.send(JSON.stringify(connectedMsg));

  // Handle incoming messages
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Validate message using Zod schema
      const result = WSClientMessageSchema.safeParse(message);
      
      if (!result.success) {
        const errorMsg: WSError = {
          type: "ERROR",
          message: "Invalid message format",
        };
        ws.send(JSON.stringify(errorMsg));
        return;
      }

      const parsed = result.data;

      if (parsed.type === "SUBSCRIBE") {
        // Track subscription
        if (!subscriptions.has(parsed.tenantId)) {
          subscriptions.set(parsed.tenantId, new Set());
        }
        subscriptions.get(parsed.tenantId)!.add(ws);
        console.log(`[WS] Subscribed to tenant: ${parsed.tenantId}`);
      }

      if (parsed.type === "UNSUBSCRIBE") {
        subscriptions.get(parsed.tenantId)?.delete(ws);
        console.log(`[WS] Unsubscribed from tenant: ${parsed.tenantId}`);
      }
    } catch {
      ws.send(JSON.stringify({ type: "ERROR", message: "Failed to parse" }));
    }
  });

  // Cleanup on disconnect
  ws.on("close", () => {
    subscriptions.forEach((clients) => clients.delete(ws));
    console.log("[WS] Client disconnected");
  });
});
```

### Broadcasting Job Updates

```ts
/**
 * Broadcast job update to all subscribers of a tenant
 * Call this when job status changes (from worker or API)
 */
export function broadcastJobUpdate(
  tenantId: string,
  jobId: string,
  status: string,
  error: string | null = null
) {
  const clients = subscriptions.get(tenantId);
  if (!clients) return;

  const message: WSJobUpdate = {
    type: "JOB_UPDATE",
    jobId,
    status: status as WSJobUpdate["status"],
    error,
  };

  const payload = JSON.stringify(message);
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Usage example (in worker or after job status change):
broadcastJobUpdate("tenant-1", "job-uuid", "COMPLETED");
```

---

## Client-Side (Browser)

### Basic Connection

```js
const ws = new WebSocket("ws://localhost:3000/ws");

ws.onopen = () => {
  console.log("Connected to WebSocket");
  
  // Subscribe to a tenant's job updates
  ws.send(JSON.stringify({ 
    type: "SUBSCRIBE", 
    tenantId: "tenant-1" 
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case "CONNECTED":
      console.log("Server confirmed connection");
      break;
    case "JOB_UPDATE":
      console.log(`Job ${data.jobId}: ${data.status}`);
      if (data.error) console.error("Error:", data.error);
      break;
    case "ERROR":
      console.error("WebSocket error:", data.message);
      break;
  }
};

ws.onerror = (error) => console.error("Connection error:", error);
ws.onclose = () => console.log("Disconnected");
```

### React Hook

```tsx
import { useEffect, useState, useCallback } from "react";

interface JobUpdate {
  type: "JOB_UPDATE";
  jobId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  error: string | null;
}

export function useJobUpdates(tenantId: string) {
  const [updates, setUpdates] = useState<JobUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: "SUBSCRIBE", tenantId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "JOB_UPDATE") {
        setUpdates((prev) => [...prev, data]);
      }
    };

    ws.onclose = () => setIsConnected(false);

    return () => {
      ws.send(JSON.stringify({ type: "UNSUBSCRIBE", tenantId }));
      ws.close();
    };
  }, [tenantId]);

  const clearUpdates = useCallback(() => setUpdates([]), []);

  return { updates, isConnected, clearUpdates };
}
```

---

## Message Types

### Client → Server

| Type | Fields | Description |
|------|--------|-------------|
| `SUBSCRIBE` | `tenantId: string` | Subscribe to job updates for tenant |
| `UNSUBSCRIBE` | `tenantId: string` | Unsubscribe from tenant updates |

### Server → Client

| Type | Fields | Description |
|------|--------|-------------|
| `CONNECTED` | `message?: string` | Connection confirmed |
| `JOB_UPDATE` | `jobId`, `status`, `error?` | Job status changed |
| `ERROR` | `message: string` | Error occurred |

---

## Testing with websocat

```bash
# Install
brew install websocat

# Connect
websocat ws://localhost:3000/ws

# After connected, type and press Enter:
{"type":"SUBSCRIBE","tenantId":"tenant-1"}

# You'll receive job updates for tenant-1
```

---

## Redis Pub/Sub Integration (For Scaling)

When running multiple API instances, use Redis Pub/Sub to broadcast updates across all servers:

```ts
import Redis from "ioredis";

const pub = new Redis(process.env.REDIS_URL);
const sub = new Redis(process.env.REDIS_URL);

// Worker publishes to Redis
async function publishJobUpdate(tenantId: string, jobId: string, status: string) {
  await pub.publish("job_updates", JSON.stringify({ tenantId, jobId, status }));
}

// API subscribes and broadcasts to WebSocket clients
sub.subscribe("job_updates");
sub.on("message", (channel, message) => {
  const { tenantId, jobId, status, error } = JSON.parse(message);
  broadcastJobUpdate(tenantId, jobId, status, error);
});
```

---

## Common Issues & Fixes

### Connection Failed

```
WebSocket connection to 'ws://localhost:3000/ws' failed
```

**Fix:**
- Ensure server is running
- Check port matches
- Verify `/ws` path is correct

### CORS / Mixed Content

```
Mixed Content: wss:// from https://
```

**Fix:** Auto-detect protocol:
```js
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
```

### NGINX Configuration

```nginx
location /ws {
    proxy_pass http://api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;  # 24 hours
}
```
