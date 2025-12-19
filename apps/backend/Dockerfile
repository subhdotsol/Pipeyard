# Backend API Dockerfile
FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
COPY packages/db/package.json ./packages/db/
COPY packages/redis/package.json ./packages/redis/
COPY packages/types/package.json ./packages/types/
COPY apps/backend/package.json ./apps/backend/

# Install dependencies
RUN bun install

# Copy source code
COPY packages/db ./packages/db
COPY packages/redis ./packages/redis
COPY packages/types ./packages/types
COPY apps/backend ./apps/backend

# Generate Prisma client
RUN cd packages/db && bunx prisma generate

# Copy start script
COPY apps/backend/start.sh ./start.sh
RUN chmod +x ./start.sh

# Expose port
EXPOSE 3000

# Start the server (runs migrations first)
CMD ["./start.sh"]
