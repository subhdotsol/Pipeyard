/**
 * Zod validation schemas for the job queue system
 */
import { z } from "zod/v4";
import { JobStatus, JobType } from "./enums.ts";

// ================================
// Job Schemas
// ================================

/**
 * Schema for job payload - varies by job type
 */
export const EmailPayloadSchema = z.object({
  to: z.email(),
  subject: z.string().min(1).max(200),
  body: z.string().optional(),
});

export const WebhookPayloadSchema = z.object({
  url: z.url(),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("POST"),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
});

export const SleepPayloadSchema = z.object({
  delayMs: z.number().int().min(0).max(60000),
});

export const DataProcessingPayloadSchema = z.object({
  dataId: z.string().uuid(),
  operation: z.string().min(1),
});

/**
 * Union of all payload schemas
 */
export const JobPayloadSchema = z.union([
  EmailPayloadSchema,
  WebhookPayloadSchema,
  SleepPayloadSchema,
  DataProcessingPayloadSchema,
  z.record(z.string(), z.unknown()), // Allow arbitrary JSON for flexibility
]);

// ================================
// API Request Schemas
// ================================

/**
 * Create job request schema
 */
export const CreateJobSchema = z.object({
  tenantId: z.string().min(1).max(100),
  type: z.enum([JobType.EMAIL, JobType.WEBHOOK, JobType.SLEEP, JobType.DATA_PROCESSING]),
  payload: JobPayloadSchema,
});

/**
 * List jobs query schema
 */
export const ListJobsQuerySchema = z.object({
  tenantId: z.string().min(1).max(100),
  status: z.enum([JobStatus.PENDING, JobStatus.RUNNING, JobStatus.COMPLETED, JobStatus.FAILED]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Job ID param schema
 */
export const JobIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ================================
// API Response Schemas
// ================================

/**
 * Job response schema (what clients receive)
 */
export const JobResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  type: z.string(),
  payload: z.unknown(),
  status: z.enum([JobStatus.PENDING, JobStatus.RUNNING, JobStatus.COMPLETED, JobStatus.FAILED]),
  attempts: z.number().int(),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Create job response
 */
export const CreateJobResponseSchema = z.object({
  jobId: z.string().uuid(),
});

/**
 * List jobs response
 */
export const ListJobsResponseSchema = z.object({
  jobs: z.array(JobResponseSchema),
  total: z.number().int(),
});

/**
 * Error response schema
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

// ================================
// WebSocket Message Schemas
// ================================

/**
 * Client → Server: Subscribe to tenant updates
 */
export const WSSubscribeSchema = z.object({
  type: z.literal("SUBSCRIBE"),
  tenantId: z.string().min(1),
});

/**
 * Client → Server: Unsubscribe from tenant updates
 */
export const WSUnsubscribeSchema = z.object({
  type: z.literal("UNSUBSCRIBE"),
  tenantId: z.string().min(1),
});

/**
 * Server → Client: Job status update
 */
export const WSJobUpdateSchema = z.object({
  type: z.literal("JOB_UPDATE"),
  jobId: z.string().uuid(),
  status: z.enum([JobStatus.PENDING, JobStatus.RUNNING, JobStatus.COMPLETED, JobStatus.FAILED]),
  error: z.string().nullable().optional(),
});

/**
 * Server → Client: Error message
 */
export const WSErrorSchema = z.object({
  type: z.literal("ERROR"),
  message: z.string(),
});

/**
 * Server → Client: Connection confirmed
 */
export const WSConnectedSchema = z.object({
  type: z.literal("CONNECTED"),
  message: z.string().optional(),
});

/**
 * All client messages
 */
export const WSClientMessageSchema = z.discriminatedUnion("type", [
  WSSubscribeSchema,
  WSUnsubscribeSchema,
]);

/**
 * All server messages
 */
export const WSServerMessageSchema = z.discriminatedUnion("type", [
  WSJobUpdateSchema,
  WSErrorSchema,
  WSConnectedSchema,
]);

// ================================
// Type Exports (inferred from schemas)
// ================================

export type EmailPayload = z.infer<typeof EmailPayloadSchema>;
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
export type SleepPayload = z.infer<typeof SleepPayloadSchema>;
export type DataProcessingPayload = z.infer<typeof DataProcessingPayloadSchema>;
export type JobPayload = z.infer<typeof JobPayloadSchema>;

export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type ListJobsQuery = z.infer<typeof ListJobsQuerySchema>;
export type JobIdParam = z.infer<typeof JobIdParamSchema>;

export type JobResponse = z.infer<typeof JobResponseSchema>;
export type CreateJobResponse = z.infer<typeof CreateJobResponseSchema>;
export type ListJobsResponse = z.infer<typeof ListJobsResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export type WSSubscribe = z.infer<typeof WSSubscribeSchema>;
export type WSUnsubscribe = z.infer<typeof WSUnsubscribeSchema>;
export type WSJobUpdate = z.infer<typeof WSJobUpdateSchema>;
export type WSError = z.infer<typeof WSErrorSchema>;
export type WSConnected = z.infer<typeof WSConnectedSchema>;
export type WSClientMessage = z.infer<typeof WSClientMessageSchema>;
export type WSServerMessage = z.infer<typeof WSServerMessageSchema>;
