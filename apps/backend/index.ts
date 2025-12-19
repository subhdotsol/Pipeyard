/**
 * Backend API Server
 * Express + WebSocket for real-time job queue updates
 */
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { prisma, Prisma } from "@repo/db";
import {
  CreateJobSchema,
  ListJobsQuerySchema,
  WSClientMessageSchema,
  JobStatus,
  type WSJobUpdate,
  type WSConnected,
  type WSError,
} from "@repo/types";

// ================================
// Express Setup
// ================================

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

// ================================
// WebSocket Setup
// ================================

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

// Track subscriptions: tenantId -> Set of WebSocket connections
const subscriptions = new Map<string, Set<WebSocket>>();

wss.on("connection", (ws) => {
  console.log("[WS] Client connected");

  // Send connected message
  const connectedMsg: WSConnected = {
    type: "CONNECTED",
    message: "Connected to job updates",
  };
  ws.send(JSON.stringify(connectedMsg));

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
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
        // Add to subscriptions
        if (!subscriptions.has(parsed.tenantId)) {
          subscriptions.set(parsed.tenantId, new Set());
        }
        subscriptions.get(parsed.tenantId)!.add(ws);
        console.log(`[WS] Client subscribed to tenant: ${parsed.tenantId}`);
      }

      if (parsed.type === "UNSUBSCRIBE") {
        // Remove from subscriptions
        subscriptions.get(parsed.tenantId)?.delete(ws);
        console.log(`[WS] Client unsubscribed from tenant: ${parsed.tenantId}`);
      }
    } catch {
      const errorMsg: WSError = {
        type: "ERROR",
        message: "Failed to parse message",
      };
      ws.send(JSON.stringify(errorMsg));
    }
  });

  ws.on("close", () => {
    // Remove from all subscriptions
    subscriptions.forEach((clients) => clients.delete(ws));
    console.log("[WS] Client disconnected");
  });
});

/**
 * Broadcast job update to all subscribers of a tenant
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

// ================================
// API Routes
// ================================

/**
 * POST /jobs - Create a new job
 */
app.post("/jobs", async (req, res) => {
  const result = CreateJobSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: "Validation failed",
      message: "Invalid request body",
      details: result.error.format(),
    });
    return;
  }

  const { tenantId, type, payload } = result.data;

  const job = await prisma.job.create({
    data: {
      tenantId,
      type,
      payload: payload as Prisma.InputJsonValue,
      status: JobStatus.PENDING,
    },
  });

  // TODO: Push to Redis queue here
  // await redis.lpush("job_queue", job.id);

  res.status(201).json({ jobId: job.id });
});

/**
 * GET /jobs - List jobs for a tenant
 */
app.get("/jobs", async (req, res) => {
  const result = ListJobsQuerySchema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({
      error: "Validation failed",
      message: "Invalid query parameters",
      details: result.error.format(),
    });
    return;
  }

  const { tenantId, status, limit, offset } = result.data;

  const where = {
    tenantId,
    ...(status && { status }),
  };

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.job.count({ where }),
  ]);

  res.json({
    jobs: jobs.map((job) => ({
      ...job,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    })),
    total,
  });
});

/**
 * GET /health - Health check endpoint
 */
app.get("/health", async (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ================================
// Start Server
// ================================

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket available at ws://localhost:${PORT}/ws`);
});
