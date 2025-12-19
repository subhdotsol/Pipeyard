# @repo/types

Shared Zod schemas and TypeScript types for the async-backend monorepo.

## Usage

```ts
import { 
  // Enums
  JobStatus, JobType, WSMessageType,
  
  // Zod Schemas
  CreateJobSchema, ListJobsQuerySchema,
  WSClientMessageSchema, WSServerMessageSchema,
  
  // Types (inferred from schemas)
  CreateJobInput, JobResponse, WSJobUpdate
} from "@repo/types";

// Validate request body
const result = CreateJobSchema.safeParse(req.body);
if (!result.success) {
  return { error: result.error };
}
```

## Exports

| Category | Exports |
|----------|---------|
| **Enums** | `JobStatus`, `JobType`, `WSMessageType` |
| **Job Schemas** | `CreateJobSchema`, `ListJobsQuerySchema`, `JobResponseSchema` |
| **Payload Schemas** | `EmailPayloadSchema`, `WebhookPayloadSchema`, `SleepPayloadSchema` |
| **WS Schemas** | `WSClientMessageSchema`, `WSServerMessageSchema`, `WSJobUpdateSchema` |
