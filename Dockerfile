# Hello Club Event Attendance Auto-Print
# Docker image for production deployment

FROM node:18-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY .env.example ./.env.example

# Create volume mount points
VOLUME ["/app/data", "/app/logs"]

# Expose dashboard port
EXPOSE 3030

# Health check
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=3 \
  CMD node src/index.js health-check || exit 1

# Default command
CMD ["node", "src/index.js", "start-service"]
