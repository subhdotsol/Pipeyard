/**
 * Worker - Batch Job Processor
 *
 * Features:
 * - Polls Redis queue for jobs
 * - Processes jobs with retry logic
 * - Updates job status in database
 * - Publishes status updates via Redis Pub/Sub
 */
import { prisma } from "@repo/db";
import {
  getRedisClient,
  popJob,
  publishJobUpdate,
  type JobUpdateMessage,
} from "@repo/redis";
import { processJob } from "./processor.ts";

// Configuration
const POLL_INTERVAL_MS = 1000; // How often to check for jobs
const MAX_ATTEMPTS = 3; // Maximum retry attempts
const BATCH_SIZE = 5; // Jobs to process concurrently (future enhancement)

const redis = getRedisClient();

/**
 * Process a single job with full lifecycle management
 */
async function processJobWithLifecycle(jobId: string): Promise<void> {
  console.log(`\n[Worker] Processing job: ${jobId}`);

  // 1. Fetch job from database
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job) {
    console.error(`[Worker] Job not found: ${jobId}`);
    return;
  }

  // 2. Check if already completed or max attempts reached
  if (job.status === "COMPLETED") {
    console.log(`[Worker] Job already completed: ${jobId}`);
    return;
  }

  if (job.attempts >= MAX_ATTEMPTS) {
    console.log(`[Worker] Max attempts reached for: ${jobId}`);
    await markJobFailed(jobId, job.tenantId, "Max retry attempts exceeded");
    return;
  }

  // 3. Mark job as RUNNING
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      attempts: { increment: 1 },
    },
  });

  await publishUpdate(job.tenantId, jobId, "RUNNING");
  console.log(`[Worker] Job ${jobId} → RUNNING (attempt ${job.attempts + 1}/${MAX_ATTEMPTS})`);

  // 4. Process the job
  try {
    const payload = job.payload as Record<string, unknown>;
    const result = await processJob(job.type, payload);

    if (result.success) {
      // 5a. Mark as COMPLETED
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "COMPLETED", error: null },
      });

      await publishUpdate(job.tenantId, jobId, "COMPLETED");
      console.log(`[Worker] Job ${jobId} → COMPLETED ✓`);
    } else {
      throw new Error(result.error || "Job processing failed");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Worker] Job ${jobId} failed: ${errorMessage}`);

    // 5b. Check retry logic
    const newAttempts = job.attempts + 1;

    if (newAttempts >= MAX_ATTEMPTS) {
      await markJobFailed(jobId, job.tenantId, errorMessage);
    } else {
      // Requeue for retry
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "PENDING", error: errorMessage },
      });

      // Push back to queue for retry (with delay in real implementation)
      await redis.lpush("job_queue", jobId);
      console.log(`[Worker] Job ${jobId} requeued for retry (${newAttempts}/${MAX_ATTEMPTS})`);
    }
  }
}

/**
 * Mark a job as permanently failed
 */
async function markJobFailed(
  jobId: string,
  tenantId: string,
  error: string
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "FAILED", error },
  });

  await publishUpdate(tenantId, jobId, "FAILED", error);
  console.log(`[Worker] Job ${jobId} → FAILED ✗`);
}

/**
 * Publish status update via Redis Pub/Sub
 */
async function publishUpdate(
  tenantId: string,
  jobId: string,
  status: JobUpdateMessage["status"],
  error: string | null = null
): Promise<void> {
  await publishJobUpdate(redis, { tenantId, jobId, status, error });
}

/**
 * Main worker loop
 */
async function runWorker(): Promise<void> {
  console.log("🔧 Worker started");
  console.log(`   Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`   Max attempts: ${MAX_ATTEMPTS}`);
  console.log("");

  while (true) {
    try {
      // Blocking pop - waits up to 5 seconds for a job
      const jobId = await popJob(redis, 5);

      if (jobId) {
        await processJobWithLifecycle(jobId);
      }
    } catch (error) {
      console.error("[Worker] Error:", error);
      // Wait before retrying on error
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

/**
 * Graceful shutdown
 */
process.on("SIGINT", async () => {
  console.log("\n[Worker] Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[Worker] Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

// Start the worker
runWorker();