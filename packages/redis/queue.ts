/**
 * Redis Job Queue Operations
 * Uses a Redis LIST for FIFO queue (LPUSH + RPOP)
 */
import type { Redis } from "ioredis";

const JOB_QUEUE_KEY = "job_queue";

/**
 * Push a job ID to the queue
 * Jobs are added to the left (LPUSH) and processed from the right (RPOP)
 */
export async function pushJob(redis: Redis, jobId: string): Promise<number> {
  return redis.lpush(JOB_QUEUE_KEY, jobId);
}

/**
 * Push multiple job IDs to the queue
 */
export async function pushJobs(redis: Redis, jobIds: string[]): Promise<number> {
  if (jobIds.length === 0) return 0;
  return redis.lpush(JOB_QUEUE_KEY, ...jobIds);
}

/**
 * Pop a single job ID from the queue (blocking)
 * Waits up to `timeout` seconds for a job
 * Returns null if timeout expires
 */
export async function popJob(redis: Redis, timeout: number = 5): Promise<string | null> {
  const result = await redis.brpop(JOB_QUEUE_KEY, timeout);
  return result ? result[1] : null;
}

/**
 * Pop multiple job IDs from the queue (non-blocking)
 * Returns up to `count` jobs immediately available
 */
export async function popJobs(redis: Redis, count: number): Promise<string[]> {
  const pipeline = redis.pipeline();
  for (let i = 0; i < count; i++) {
    pipeline.rpop(JOB_QUEUE_KEY);
  }
  const results = await pipeline.exec();
  if (!results) return [];
  
  return results
    .map(([err, value]) => (err ? null : value))
    .filter((v): v is string => v !== null);
}

/**
 * Get the number of jobs in the queue
 */
export async function getQueueLength(redis: Redis): Promise<number> {
  return redis.llen(JOB_QUEUE_KEY);
}

/**
 * Clear all jobs from the queue (use with caution!)
 */
export async function clearQueue(redis: Redis): Promise<void> {
  await redis.del(JOB_QUEUE_KEY);
}
