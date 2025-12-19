/**
 * @repo/redis - Redis Queue and Pub/Sub Package
 *
 * Exports:
 * - Queue operations: pushJob, popJob, popJobs
 * - Pub/Sub: publishJobUpdate, subscribeToJobUpdates, createPubSub
 * - Redis client factory
 */
import Redis from "ioredis";

// Environment variable for Redis URL
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Singleton Redis client for general operations
let redisClient: Redis | null = null;

/**
 * Get or create a Redis client singleton
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL);
    redisClient.on("error", (err) => console.error("[Redis] Connection error:", err));
    redisClient.on("connect", () => console.log("[Redis] Connected to", REDIS_URL));
  }
  return redisClient;
}

/**
 * Create a new Redis client (for when you need multiple connections)
 */
export function createRedisClient(url?: string): Redis {
  return new Redis(url || REDIS_URL);
}

/**
 * Close the singleton Redis client
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

// Re-export queue operations
export {
  pushJob,
  pushJobs,
  popJob,
  popJobs,
  getQueueLength,
  clearQueue,
} from "./queue.ts";

// Re-export pub/sub operations
export {
  publishJobUpdate,
  subscribeToJobUpdates,
  createPubSub,
  type JobUpdateMessage,
  type JobUpdateHandler,
} from "./pubsub.ts";

// Re-export Redis type for convenience
export { Redis };