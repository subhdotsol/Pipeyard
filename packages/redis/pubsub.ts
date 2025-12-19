/**
 * Redis Pub/Sub for Real-time Job Updates
 * Uses separate Redis connections for pub and sub (required by ioredis)
 */
import Redis from "ioredis";

const JOB_UPDATES_CHANNEL = "job_updates";

export interface JobUpdateMessage {
  tenantId: string;
  jobId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  error?: string | null;
}

export type JobUpdateHandler = (message: JobUpdateMessage) => void;

/**
 * Publish a job status update
 * @param redis - Redis client (can be shared with other operations)
 * @param message - Job update details
 */
export async function publishJobUpdate(
  redis: Redis,
  message: JobUpdateMessage
): Promise<number> {
  return redis.publish(JOB_UPDATES_CHANNEL, JSON.stringify(message));
}

/**
 * Subscribe to job updates
 * @param redisUrl - Redis connection URL (creates dedicated subscriber connection)
 * @param handler - Callback for each job update
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToJobUpdates(
  redisUrl: string,
  handler: JobUpdateHandler
): () => void {
  // Create dedicated connection for subscriber (ioredis requirement)
  const subscriber = new Redis(redisUrl);

  subscriber.subscribe(JOB_UPDATES_CHANNEL, (err) => {
    if (err) {
      console.error("[Redis] Failed to subscribe:", err);
    } else {
      console.log(`[Redis] Subscribed to ${JOB_UPDATES_CHANNEL}`);
    }
  });

  subscriber.on("message", (channel, message) => {
    if (channel === JOB_UPDATES_CHANNEL) {
      try {
        const parsed = JSON.parse(message) as JobUpdateMessage;
        handler(parsed);
      } catch (err) {
        console.error("[Redis] Failed to parse message:", err);
      }
    }
  });

  // Return cleanup function
  return () => {
    subscriber.unsubscribe(JOB_UPDATES_CHANNEL);
    subscriber.quit();
  };
}

/**
 * Create a pub/sub helper with shared publisher
 */
export function createPubSub(redisUrl: string) {
  const publisher = new Redis(redisUrl);

  return {
    /**
     * Publish a job update
     */
    publish: (message: JobUpdateMessage) => publishJobUpdate(publisher, message),

    /**
     * Subscribe to job updates
     */
    subscribe: (handler: JobUpdateHandler) => subscribeToJobUpdates(redisUrl, handler),

    /**
     * Close the publisher connection
     */
    close: () => publisher.quit(),
  };
}
