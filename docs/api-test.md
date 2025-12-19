# API Testing Guide

## Base URL
```
http://localhost:3000
```

---

## 1. Health Check

**Method:** `GET`

**URL:**
```
http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-19T15:05:41.000Z"
}
```

---

## 2. Create Job

**Method:** `POST`

**URL:**
```
http://localhost:3000/jobs
```

**Headers:**
```
Content-Type: application/json
```

### Email Job

**Body:**
```json
{
  "tenantId": "tenant-1",
  "type": "email",
  "payload": {
    "to": "user@example.com",
    "subject": "Welcome!",
    "body": "Hello from the job queue"
  }
}
```

### Webhook Job

**Body:**
```json
{
  "tenantId": "tenant-1",
  "type": "webhook",
  "payload": {
    "url": "https://httpbin.org/post",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer token123"
    },
    "body": {
      "event": "user.created"
    }
  }
}
```

### Sleep Job

**Body:**
```json
{
  "tenantId": "tenant-1",
  "type": "sleep",
  "payload": {
    "delayMs": 5000
  }
}
```

### Data Processing Job

**Body:**
```json
{
  "tenantId": "tenant-1",
  "type": "data_processing",
  "payload": {
    "dataId": "550e8400-e29b-41d4-a716-446655440000",
    "operation": "transform"
  }
}
```

**Response (201):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 3. List Jobs

**Method:** `GET`

### All Jobs for Tenant

**URL:**
```
http://localhost:3000/jobs?tenantId=tenant-1
```

### Filter by Status

**URL (PENDING):**
```
http://localhost:3000/jobs?tenantId=tenant-1&status=PENDING
```

**URL (COMPLETED):**
```
http://localhost:3000/jobs?tenantId=tenant-1&status=COMPLETED
```

**URL (RUNNING):**
```
http://localhost:3000/jobs?tenantId=tenant-1&status=RUNNING
```

**URL (FAILED):**
```
http://localhost:3000/jobs?tenantId=tenant-1&status=FAILED
```

### With Pagination

**URL:**
```
http://localhost:3000/jobs?tenantId=tenant-1&limit=10&offset=0
```

**Response (200):**
```json
{
  "jobs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "tenantId": "tenant-1",
      "type": "email",
      "payload": {
        "to": "user@example.com",
        "subject": "Welcome!"
      },
      "status": "PENDING",
      "attempts": 0,
      "error": null,
      "createdAt": "2025-12-19T15:00:00.000Z",
      "updatedAt": "2025-12-19T15:00:00.000Z"
    }
  ],
  "total": 1
}
```

---

## 4. WebSocket

**URL:**
```
ws://localhost:3000/ws
```

### Subscribe Message

```json
{"type":"SUBSCRIBE","tenantId":"tenant-1"}
```

### Unsubscribe Message

```json
{"type":"UNSUBSCRIBE","tenantId":"tenant-1"}
```

### Server Messages

**Connected:**
```json
{"type":"CONNECTED","message":"Connected to job updates"}
```

**Job Update:**
```json
{"type":"JOB_UPDATE","jobId":"uuid","status":"COMPLETED","error":null}
```

**Error:**
```json
{"type":"ERROR","message":"Invalid message format"}
```

---

## Validation Errors

### Missing tenantId

**Body:**
```json
{
  "type": "email",
  "payload": {}
}
```

**Response (400):**
```json
{
  "error": "Validation failed",
  "message": "Invalid request body",
  "details": {
    "tenantId": {
      "_errors": ["Required"]
    }
  }
}
```

### Invalid Job Type

**Body:**
```json
{
  "tenantId": "tenant-1",
  "type": "invalid_type",
  "payload": {}
}
```

**Response (400):**
```json
{
  "error": "Validation failed",
  "message": "Invalid request body",
  "details": {
    "type": {
      "_errors": ["Invalid enum value"]
    }
  }
}
```

---

## Postman Collection Import

Create a new collection and add these requests:

| Name | Method | URL |
|------|--------|-----|
| Health Check | GET | `http://localhost:3000/health` |
| Create Job | POST | `http://localhost:3000/jobs` |
| List Jobs | GET | `http://localhost:3000/jobs?tenantId=tenant-1` |

For WebSocket, use Postman's WebSocket tab with URL: `ws://localhost:3000/ws`
