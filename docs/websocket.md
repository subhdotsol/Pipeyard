# WebSocket Reference

## Bun Server-Side

```ts
const clients = new Map<string, Set<WebSocket>>();  // tenantId -> connections

const server = Bun.serve({
  port: 3000,
  fetch(req, server) {
    if (new URL(req.url).pathname === "/ws") {
      if (server.upgrade(req)) return undefined;
      return new Response("Upgrade failed", { status: 400 });
    }
    return new Response("Not Found", { status: 404 });
  },
  websocket: {
    open(ws) {
      console.log("Connected");
    },
    message(ws, message) {
      const data = JSON.parse(message.toString());
      
      if (data.type === "SUBSCRIBE") {
        ws.subscribe(data.tenantId);  // Built-in pub/sub
        ws.data = { tenantId: data.tenantId };
      }
    },
    close(ws) {
      console.log("Disconnected");
    },
  },
});

// Broadcast to tenant subscribers
function broadcastToTenant(tenantId: string, data: object) {
  server.publish(tenantId, JSON.stringify(data));
}
```

---

## Browser Client

```js
const ws = new WebSocket("ws://localhost:3000/ws");

ws.onopen = () => {
  console.log("Connected");
  ws.send(JSON.stringify({ type: "SUBSCRIBE", tenantId: "tenant-1" }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Update:", data);
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = () => {
  console.log("Disconnected");
};
```

---

## React Hook

```tsx
import { useEffect, useState } from "react";

function useJobUpdates(tenantId: string) {
  const [updates, setUpdates] = useState([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000/ws");

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "SUBSCRIBE", tenantId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setUpdates((prev) => [...prev, data]);
    };

    return () => ws.close();
  }, [tenantId]);

  return updates;
}
```

---

## Common Errors & Fixes

### WebSocket connection failed

```
WebSocket connection to 'ws://localhost:3000/ws' failed
```

**Fix:**
- Check server is running
- Check correct port
- Check `/ws` path matches

---

### CORS / Mixed content

```
Mixed Content: wss:// from https:// page
```

**Fix:** Use `wss://` for HTTPS sites:
```js
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
```

---

### Connection drops behind NGINX

**Fix:** Add to nginx.conf:
```nginx
location /ws {
    proxy_pass http://api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;  # 24h
}
```

---

### Message not JSON

```ts
// Always wrap in try-catch
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
  } catch (e) {
    console.error("Invalid JSON:", event.data);
  }
};
```

---

## Testing with websocat

```bash
# Install
brew install websocat

# Connect
websocat ws://localhost:3000/ws

# Send message (type and press Enter)
{"type":"SUBSCRIBE","tenantId":"tenant-1"}
```

---

## Redis Pub/Sub to WebSocket Bridge

```ts
import Redis from "ioredis";

const sub = new Redis(process.env.REDIS_URL);

sub.subscribe("job_updates");

sub.on("message", (channel, message) => {
  const { tenantId, ...update } = JSON.parse(message);
  server.publish(tenantId, JSON.stringify(update));
});
```
