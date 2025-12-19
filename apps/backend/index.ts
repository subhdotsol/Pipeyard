// Example: Using @repo/db in your backend
import { prisma, Job, JobStatus } from "@repo/db";

// Create a new job
async function createJob() {
  const job = await prisma.job.create({
    data: {
      tenantId: "tenant-1",
      type: "email",
      payload: { to: "user@example.com", subject: "Hello!" },
      status: "PENDING",
    },
  });
  console.log("Created job:", job);
  return job;
}

// Find pending jobs
async function getPendingJobs(tenantId: string): Promise<Job[]> {
  return prisma.job.findMany({
    where: {
      tenantId,
      status: JobStatus.PENDING,
    },
    orderBy: { createdAt: "desc" },
  });
}

// Update job status
async function markJobRunning(jobId: string) {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      attempts: { increment: 1 },
    },
  });
}

console.log("Hello via Bun!");