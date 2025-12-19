/**
 * Job Processors
 * Define how each job type is processed
 */

export interface ProcessResult {
  success: boolean;
  error?: string;
}

/**
 * Email job processor
 */
async function processEmailJob(payload: Record<string, unknown>): Promise<ProcessResult> {
  const { to, subject, body } = payload as { to: string; subject: string; body?: string };
  
  console.log(`[Email] Sending to: ${to}`);
  console.log(`[Email] Subject: ${subject}`);
  
  // Simulate email sending (replace with actual email service)
  await sleep(500);
  
  // Simulate occasional failures for testing retry logic
  if (Math.random() < 0.1) {
    throw new Error("SMTP connection failed");
  }
  
  console.log(`[Email] ✓ Sent successfully`);
  return { success: true };
}

/**
 * Webhook job processor
 */
async function processWebhookJob(payload: Record<string, unknown>): Promise<ProcessResult> {
  const { url, method, headers, body } = payload as {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
  
  console.log(`[Webhook] ${method} ${url}`);
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log(`[Webhook] ✓ Response: ${response.status}`);
    return { success: true };
  } catch (error) {
    throw new Error(`Webhook failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Sleep job processor (for testing)
 */
async function processSleepJob(payload: Record<string, unknown>): Promise<ProcessResult> {
  const { delayMs } = payload as { delayMs: number };
  
  console.log(`[Sleep] Sleeping for ${delayMs}ms`);
  await sleep(delayMs);
  console.log(`[Sleep] ✓ Done`);
  
  return { success: true };
}

/**
 * Data processing job processor
 */
async function processDataJob(payload: Record<string, unknown>): Promise<ProcessResult> {
  const { dataId, operation } = payload as { dataId: string; operation: string };
  
  console.log(`[Data] Processing ${dataId} with operation: ${operation}`);
  
  // Simulate data processing
  await sleep(1000);
  
  console.log(`[Data] ✓ Completed`);
  return { success: true };
}

/**
 * Main processor dispatcher
 */
export async function processJob(
  type: string,
  payload: Record<string, unknown>
): Promise<ProcessResult> {
  switch (type) {
    case "email":
      return processEmailJob(payload);
    case "webhook":
      return processWebhookJob(payload);
    case "sleep":
      return processSleepJob(payload);
    case "data_processing":
      return processDataJob(payload);
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}

/**
 * Utility: sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
