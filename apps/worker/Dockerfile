# Worker Dockerfile
FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
COPY packages/db/package.json ./packages/db/
COPY packages/redis/package.json ./packages/redis/
COPY packages/types/package.json ./packages/types/
COPY apps/worker/package.json ./apps/worker/

# Install dependencies
RUN bun install

# Copy source code
COPY packages/db ./packages/db
COPY packages/redis ./packages/redis
COPY packages/types ./packages/types
COPY apps/worker ./apps/worker

# Generate Prisma client
RUN cd packages/db && bunx prisma generate

# Start the worker
CMD ["bun", "run", "apps/worker/index.ts"]
