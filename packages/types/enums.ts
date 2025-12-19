/**
 * Shared enums for the job queue system
 */

/**
 * Job status enum - matches Prisma schema
 */
export const JobStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

/**
 * Job types supported by the system
 */
export const JobType = {
  EMAIL: "email",
  WEBHOOK: "webhook",
  SLEEP: "sleep",
  DATA_PROCESSING: "data_processing",
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];

/**
 * WebSocket message types
 */
export const WSMessageType = {
  SUBSCRIBE: "SUBSCRIBE",
  UNSUBSCRIBE: "UNSUBSCRIBE",
  JOB_UPDATE: "JOB_UPDATE",
  ERROR: "ERROR",
  CONNECTED: "CONNECTED",
} as const;

export type WSMessageType = (typeof WSMessageType)[keyof typeof WSMessageType];
