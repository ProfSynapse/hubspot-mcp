# Multi-stage build for optimal production image
FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Builder stage
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 mcpuser

# Copy built application
COPY --from=deps --chown=mcpuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mcpuser:nodejs /app/build ./build
COPY --from=builder --chown=mcpuser:nodejs /app/package*.json ./

USER mcpuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { \
    let body = ''; \
    res.on('data', chunk => body += chunk); \
    res.on('end', () => { \
      try { \
        const health = JSON.parse(body); \
        process.exit(health.status === 'healthy' ? 0 : 1); \
      } catch (e) { \
        process.exit(1); \
      } \
    }); \
  }).on('error', () => process.exit(1))"

# Start command
CMD ["npm", "start"]