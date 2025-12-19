# Real-Time Multi-Tenant Job Queue + Dashboard

A small but realistic background job processing system built with TypeScript.
Users can submit jobs, workers process them asynchronously **in batches**, and job
status updates are streamed live to the frontend using WebSockets.

This project focuses on **infrastructure fundamentals**, not UI polish.

---

## 🧠 What This Project Is

In simple terms:

> Users create jobs → jobs are queued → workers process them in batches →
> users see live status updates.

This mimics how real systems handle:

* email sending
* webhook delivery
* async data processing
* background workflows

---

## 🧩 Tech Stack

* **Monorepo**: Turborepo
* **Backend API**: Bun
* **Worker**: Bun
* **Database**: Postgres + Prisma
* **Queue / PubSub**: Redis
* **Realtime**: WebSockets
* **Validation**: Zod
* **Frontend**: Next.js (minimal dashboard)
* **Infra**: Docker Compose + NGINX load balancer

---

## 🏗️ Architecture Overview

```
Browser
  ↓
NGINX (Load Balancer)
  ↓
API (Bun)
  ↓               ↘
Postgres         Redis Queue
                      ↓
                Worker (Batch Processor)
                      ↓
               Redis Pub/Sub
                      ↓
                 API (WS)
                      ↓
                  Browser
```

---

## 🔁 Job Lifecycle

1. Client sends a **Create Job** request
2. API validates input using Zod
3. Job is saved in Postgres with `PENDING` status
4. Job ID is pushed to Redis queue
5. Worker pulls jobs **in batches**
6. Worker marks jobs as `RUNNING`
7. Worker processes jobs
8. Worker marks jobs `COMPLETED` or `FAILED`
9. Status updates are published via Redis Pub/Sub
10. API streams updates to connected WebSocket clients

---

## 🧱 Database Schema

```prisma
model Job {
  id        String   @id @default(uuid())
  tenantId  String
  type      String
  payload   Json
  status    JobStatus
  attempts  Int      @default(0)
  error     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

---

## 🌐 API Routes

### Create Job

```
POST /jobs
```

**Body**

```json
{
  "tenantId": "tenant-1",
  "type": "sleep",
  "payload": {
    "delayMs": 3000
  }
}
```

**Response**

```json
{
  "jobId": "uuid"
}
```

---

### List Jobs

```
GET /jobs?tenantId=tenant-1
```

---

### Health Check

```
GET /health
```

Used by Docker / load balancer.

---

## 📡 WebSocket API

### Connect

```
GET /ws
```

### Client → Server

```json
{
  "type": "SUBSCRIBE",
  "tenantId": "tenant-1"
}
```

### Server → Client

```json
{
  "jobId": "uuid",
  "status": "COMPLETED"
}
```

---

## 🧠 Redis Design

### Queue (Batching Enabled)

* **Key**: `job_queue`
* **Type**: LIST

Workers pull up to `BATCH_SIZE` jobs per loop.

---

### Pub/Sub

* **Channel**: `job_updates`

Used to broadcast job status changes to WebSocket clients.

---

## ⚙️ Worker Batching

Workers consume jobs in **small batches** to simulate real production systems.

Example flow:

```
pull up to 5 jobs
mark all RUNNING
process jobs
publish updates
```

Batching improves throughput and reduces Redis overhead.

---

## 🐳 Running Without AWS (Local-First Setup)

This project **does NOT require AWS or any cloud provider**.

All infrastructure is simulated locally using **Docker Compose**, which replaces:

* EC2 → Docker containers
* RDS → Postgres container
* ElastiCache → Redis container
* ALB → NGINX

### Start Everything Locally

```bash
docker compose up --build
```

### Simulate Scaling

```bash
docker compose up --scale api=2 --scale worker=3
```

This allows you to test:

* load balancing
* multiple workers
* concurrent job processing

The architecture is **cloud-agnostic** and can later be deployed anywhere.

---

## 🎯 Learning Goals

* Background job queues
* Batched worker processing
* Redis pub/sub
* WebSocket fan-out
* Monorepo architecture
* Containerized local infra
* Load-balanced APIs

---

## 🚫 Out of Scope (Intentionally)

* Authentication
* Billing
* Cron scheduling
* Exactly-once guarantees
* UI polish

This project focuses on **core system design**, not SaaS features.

---

## 📌 Why This Project Exists

This repository demonstrates how real-world async systems work using simple,
understandable building blocks.

Small scope. Real concepts.
