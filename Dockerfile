# Use the official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the TypeScript project
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm ci --only=production && npm cache clean --force

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 mcpuser && \
    chown -R mcpuser:nodejs /app

# Switch to non-root user
USER mcpuser

# Expose the port the app runs on
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

# Start the application
CMD ["npm", "start"]