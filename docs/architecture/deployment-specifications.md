# Deployment Specifications and Architecture

## Executive Summary

This document defines the complete deployment architecture for the HubSpot MCP Analytics Dashboard on Railway platform, encompassing multi-service configurations, CI/CD pipelines, environment management, monitoring, and production-ready deployment patterns. The architecture emphasizes scalability, reliability, and automated operations while maintaining cost-effectiveness.

## Railway Platform Architecture

### Multi-Service Deployment Strategy

Railway's containerized deployment model allows for optimal service separation and independent scaling:

```
Railway Project: hubspot-mcp-analytics
├── Services:
│   ├── mcp-server (Enhanced MCP with Analytics)
│   ├── dashboard (Next.js Dashboard)
│   ├── database (Managed PostgreSQL)
│   └── redis (Caching & Sessions)
├── Shared Environment Variables
├── Custom Domains & SSL
└── Monitoring & Logging
```

### Service Specifications

#### 1. MCP Server Service
```json
{
  "serviceName": "mcp-server",
  "dockerImage": "node:18-alpine",
  "buildCommand": "npm ci && npm run build",
  "startCommand": "npm run start:production",
  "port": 3000,
  "healthcheck": {
    "path": "/health",
    "timeout": 30,
    "interval": 30
  },
  "resources": {
    "memory": "1GB",
    "cpu": "1 vCPU",
    "replicas": 1
  },
  "environment": {
    "NODE_ENV": "production",
    "ANALYTICS_ENABLED": "true",
    "LOG_LEVEL": "info"
  }
}
```

#### 2. Dashboard Service
```json
{
  "serviceName": "dashboard",
  "dockerImage": "node:18-alpine",
  "buildCommand": "npm ci && npm run build",
  "startCommand": "npm run start",
  "port": 3001,
  "healthcheck": {
    "path": "/api/health",
    "timeout": 30,
    "interval": 30
  },
  "resources": {
    "memory": "512MB",
    "cpu": "0.5 vCPU",
    "replicas": 1
  },
  "environment": {
    "NODE_ENV": "production",
    "NEXT_TELEMETRY_DISABLED": "1"
  }
}
```

#### 3. Database Service (Managed)
```json
{
  "serviceName": "postgres",
  "type": "managed",
  "version": "15",
  "resources": {
    "memory": "1GB",
    "storage": "10GB",
    "connections": 100
  },
  "backups": {
    "enabled": true,
    "schedule": "daily",
    "retention": "7 days"
  }
}
```

## Project Configuration Files

### Railway Project Configuration

```json
// railway.json (Project Root)
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  },
  "services": {
    "mcp-server": {
      "source": ".",
      "buildCommand": "npm ci && npm run build:server",
      "startCommand": "npm run start:server",
      "variables": {
        "SERVICE_TYPE": "mcp-server",
        "PORT": "3000"
      }
    },
    "dashboard": {
      "source": "./dashboard",
      "buildCommand": "npm ci && npm run build",
      "startCommand": "npm run start",
      "variables": {
        "SERVICE_TYPE": "dashboard",
        "PORT": "3001"
      }
    }
  },
  "environments": {
    "production": {
      "variables": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info",
        "ANALYTICS_ENABLED": "true"
      }
    },
    "staging": {
      "variables": {
        "NODE_ENV": "staging",
        "LOG_LEVEL": "debug",
        "ANALYTICS_ENABLED": "true"
      }
    }
  }
}
```

### MCP Server Package Configuration

```json
// package.json (MCP Server)
{
  "name": "hubspot-mcp-analytics-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "npm run build:server",
    "build:server": "tsc && npm run db:migrate",
    "start": "npm run start:production",
    "start:production": "node dist/src/index.js",
    "start:dev": "railway run tsx watch src/index.ts",
    "db:migrate": "npx prisma migrate deploy",
    "db:generate": "npx prisma generate",
    "db:seed": "tsx src/scripts/seed.ts",
    "health:check": "tsx src/scripts/health-check.ts",
    "test": "jest",
    "test:integration": "jest --config jest.integration.config.js",
    "lint": "eslint src --ext .ts",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.18.2",
    "@prisma/client": "^5.6.0",
    "prisma": "^5.6.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.22.4",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5",
    "ws": "^8.14.2",
    "redis": "^4.6.10",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/node": "^20.8.10",
    "@types/express": "^4.17.20",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/ws": "^8.5.8",
    "typescript": "^5.2.2",
    "tsx": "^4.1.4",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.8",
    "supertest": "^6.3.3",
    "eslint": "^8.53.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

### Dashboard Package Configuration

```json
// dashboard/package.json
{
  "name": "hubspot-mcp-analytics-dashboard",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "next build",
    "start": "next start",
    "dev": "railway run next dev",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.0.3",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tanstack/react-query": "^5.8.4",
    "zustand": "^4.4.6",
    "react-hook-form": "^7.48.2",
    "@hookform/resolvers": "^3.3.2",
    "recharts": "^2.8.0",
    "@tanstack/react-table": "^8.10.7",
    "zod": "^3.22.4",
    "tailwindcss": "^3.3.5",
    "lucide-react": "^0.294.0",
    "next-themes": "^0.2.1",
    "react-hot-toast": "^2.4.1"
  },
  "devDependencies": {
    "@types/node": "^20.8.10",
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "typescript": "^5.2.2",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "eslint": "^8.53.0",
    "eslint-config-next": "^14.0.3"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

## Environment Variable Management

### Shared Environment Variables

```bash
# railway.env (Managed via Railway Dashboard)

# Database Configuration (Auto-generated by Railway)
DATABASE_URL=postgresql://postgres:password@hostname:5432/database
DATABASE_PUBLIC_URL=postgresql://postgres:password@public-hostname:5432/database

# Redis Configuration (If using Redis add-on)
REDIS_URL=redis://hostname:6379

# Security Secrets (Generate with strong entropy)
JWT_ACCESS_SECRET=<64-char-hex-string>
JWT_REFRESH_SECRET=<64-char-hex-string>
PASSWORD_PEPPER=<32-char-hex-string>
DATA_ENCRYPTION_KEY=<32-char-hex-string>
ANONYMIZATION_SALT=<32-char-hex-string>

# Application Configuration
NODE_ENV=production
LOG_LEVEL=info
PORT=3000

# Analytics Configuration
ANALYTICS_ENABLED=true
DASHBOARD_ENABLED=true
ANALYTICS_BATCH_SIZE=50
ANALYTICS_FLUSH_INTERVAL=5000
WEBSOCKET_ENABLED=true

# Security Configuration
CORS_ORIGINS=https://your-dashboard-domain.railway.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring and Observability
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
DATADOG_API_KEY=your-datadog-api-key (optional)

# External Integrations
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
```

### Environment-Specific Configurations

#### Production Environment
```bash
# Production-specific variables
NODE_ENV=production
LOG_LEVEL=info
DEBUG=false
ANALYTICS_ENABLED=true
DASHBOARD_ENABLED=true
SSL_REDIRECT=true
COOKIE_SECURE=true
CORS_CREDENTIALS=true
SESSION_TIMEOUT=28800000  # 8 hours
RATE_LIMIT_STRICT=true
```

#### Staging Environment
```bash
# Staging-specific variables
NODE_ENV=staging
LOG_LEVEL=debug
DEBUG=true
ANALYTICS_ENABLED=true
DASHBOARD_ENABLED=true
SSL_REDIRECT=false
COOKIE_SECURE=false
CORS_CREDENTIALS=true
SESSION_TIMEOUT=3600000   # 1 hour
RATE_LIMIT_STRICT=false
```

## Build and Deployment Process

### Automated Build Pipeline

```dockerfile
# Dockerfile.mcp-server
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs && adduser -S appuser -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package*.json ./
COPY --from=builder --chown=appuser:nodejs /app/prisma ./prisma

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node dist/src/scripts/health-check.js

# Start application
CMD ["npm", "run", "start:production"]
```

```dockerfile
# Dockerfile.dashboard
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY dashboard/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY dashboard/ .

# Build Next.js application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "server.js"]
```

### Database Migration Strategy

```typescript
// src/scripts/migrate.ts
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

async function runMigrations() {
  console.log('🔄 Starting database migrations...')
  
  try {
    // Check database connectivity
    await prisma.$connect()
    console.log('✅ Database connection established')
    
    // Run Prisma migrations
    console.log('📦 Applying Prisma migrations...')
    execSync('npx prisma migrate deploy', { stdio: 'inherit' })
    
    // Run custom data migrations if needed
    console.log('🔧 Running custom data migrations...')
    await runCustomMigrations()
    
    // Verify migration success
    console.log('🔍 Verifying migration results...')
    await verifyMigrations()
    
    console.log('✅ Database migrations completed successfully')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

async function runCustomMigrations() {
  // Create default admin user if not exists
  const adminExists = await prisma.user.findUnique({
    where: { username: 'admin' }
  })
  
  if (!adminExists) {
    const bcrypt = await import('bcryptjs')
    const hashedPassword = await bcrypt.hash(
      process.env.DEFAULT_ADMIN_PASSWORD || 'admin123!',
      12
    )
    
    await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        email: 'admin@example.com'
      }
    })
    
    console.log('👤 Default admin user created')
  }
  
  // Insert default configuration
  await prisma.systemConfiguration.upsert({
    where: { configKey: 'analytics.retention_days' },
    update: {},
    create: {
      configKey: 'analytics.retention_days',
      configValue: '90',
      description: 'Data retention period in days',
      configType: 'system'
    }
  })
}

async function verifyMigrations() {
  // Verify key tables exist
  const tableChecks = [
    prisma.user.count(),
    prisma.toolUsageLogs.count(),
    prisma.errorLogs.count(),
    prisma.performanceMetrics.count()
  ]
  
  await Promise.all(tableChecks)
  console.log('✅ All required tables verified')
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations()
}

export { runMigrations }
```

### Health Check Implementation

```typescript
// src/scripts/health-check.ts
import { PrismaClient } from '@prisma/client'
import express from 'express'

const prisma = new PrismaClient()

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  services: {
    database: 'healthy' | 'unhealthy'
    redis?: 'healthy' | 'unhealthy'
    analytics: 'healthy' | 'unhealthy'
  }
  metrics?: {
    memoryUsage: NodeJS.MemoryUsage
    responseTime: number
  }
}

export async function performHealthCheck(): Promise<HealthCheckResult> {
  const startTime = Date.now()
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: 'healthy',
      analytics: 'healthy'
    }
  }
  
  try {
    // Database health check
    await prisma.$queryRaw`SELECT 1`
    result.services.database = 'healthy'
  } catch (error) {
    console.error('Database health check failed:', error)
    result.services.database = 'unhealthy'
    result.status = 'unhealthy'
  }
  
  try {
    // Redis health check (if enabled)
    if (process.env.REDIS_URL) {
      // Implement Redis health check
      result.services.redis = 'healthy'
    }
  } catch (error) {
    console.error('Redis health check failed:', error)
    result.services.redis = 'unhealthy'
    result.status = 'unhealthy'
  }
  
  try {
    // Analytics service health check
    const recentLogs = await prisma.toolUsageLogs.count({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      }
    })
    
    result.services.analytics = 'healthy'
  } catch (error) {
    console.error('Analytics health check failed:', error)
    result.services.analytics = 'unhealthy'
    result.status = 'unhealthy'
  }
  
  // Add performance metrics
  result.metrics = {
    memoryUsage: process.memoryUsage(),
    responseTime: Date.now() - startTime
  }
  
  return result
}

// Express health check endpoint
export function createHealthCheckRouter() {
  const router = express.Router()
  
  router.get('/health', async (req, res) => {
    try {
      const health = await performHealthCheck()
      const statusCode = health.status === 'healthy' ? 200 : 503
      res.status(statusCode).json(health)
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      })
    }
  })
  
  router.get('/ready', async (req, res) => {
    try {
      // Readiness check - can the service handle requests?
      await prisma.$queryRaw`SELECT 1`
      res.status(200).json({ status: 'ready' })
    } catch (error) {
      res.status(503).json({ status: 'not ready' })
    }
  })
  
  router.get('/live', (req, res) => {
    // Liveness check - is the service running?
    res.status(200).json({ status: 'alive' })
  })
  
  return router
}
```

## CI/CD Pipeline Configuration

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Railway

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    name: Test Suite
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Generate Prisma client
        run: npx prisma generate
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
      
      - name: Run database migrations
        run: npx prisma migrate dev --name init
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
      
      - name: Run type checking
        run: npm run type-check
      
      - name: Run linting
        run: npm run lint
      
      - name: Run unit tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          ANALYTICS_ENABLED: true

  security:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: test
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Run security audit
        run: npm audit --audit-level high
      
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  build-and-deploy:
    name: Build and Deploy
    runs-on: ubuntu-latest
    needs: [test, security]
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      
      - name: Deploy to Railway
        run: railway up --service mcp-server
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
      
      - name: Deploy Dashboard to Railway
        run: railway up --service dashboard
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        working-directory: ./dashboard
      
      - name: Run post-deployment health check
        run: |
          sleep 30  # Wait for deployment to complete
          curl -f ${{ secrets.RAILWAY_APP_URL }}/health || exit 1
      
      - name: Notify deployment status
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

  lighthouse:
    name: Lighthouse Performance Audit
    runs-on: ubuntu-latest
    needs: build-and-deploy
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            ${{ secrets.RAILWAY_DASHBOARD_URL }}
          configPath: ./.lighthouserc.json
          uploadArtifacts: true
```

### Railway Deployment Hooks

```bash
#!/bin/bash
# scripts/railway-prebuild.sh

echo "🔧 Pre-build setup starting..."

# Validate environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set"
  exit 1
fi

if [ -z "$JWT_ACCESS_SECRET" ]; then
  echo "❌ JWT_ACCESS_SECRET not set"
  exit 1
fi

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Validate database connectivity
echo "🔍 Testing database connection..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect()
  .then(() => {
    console.log('✅ Database connection successful');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  });
"

echo "✅ Pre-build setup completed"
```

```bash
#!/bin/bash
# scripts/railway-postdeploy.sh

echo "🚀 Post-deployment setup starting..."

# Run database migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy

# Run database seeding
echo "🌱 Seeding initial data..."
npm run db:seed

# Validate deployment health
echo "🔍 Running health check..."
node dist/src/scripts/health-check.js

# Warm up application
echo "🔥 Warming up application..."
curl -f $RAILWAY_PUBLIC_DOMAIN/health || echo "⚠️ Health check failed"

# Clear any caches
echo "🧹 Clearing application caches..."
# Implementation depends on caching strategy

echo "✅ Post-deployment setup completed"
```

## Monitoring and Observability

### Application Performance Monitoring

```typescript
// src/monitoring/apm.ts
import { Request, Response, NextFunction } from 'express'

export class ApplicationMonitoring {
  private static metrics: Map<string, MetricData[]> = new Map()
  
  static setupMonitoring(app: any): void {
    // Request timing middleware
    app.use(this.requestTimingMiddleware())
    
    // Error tracking middleware
    app.use(this.errorTrackingMiddleware())
    
    // Performance metrics endpoint
    app.get('/metrics', this.metricsEndpoint())
    
    // Start periodic reporting
    this.startPeriodicReporting()
  }
  
  private static requestTimingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now()
      
      res.on('finish', () => {
        const duration = Date.now() - startTime
        this.recordMetric('http_request_duration', duration, {
          method: req.method,
          path: req.path,
          status: res.statusCode.toString()
        })
        
        this.recordMetric('http_request_count', 1, {
          method: req.method,
          path: req.path,
          status: res.statusCode.toString()
        })
      })
      
      next()
    }
  }
  
  private static errorTrackingMiddleware() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      this.recordMetric('application_errors', 1, {
        error: error.name,
        path: req.path,
        method: req.method
      })
      
      console.error('Application error:', {
        error: error.message,
        stack: error.stack,
        request: {
          method: req.method,
          path: req.path,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      })
      
      next(error)
    }
  }
  
  private static recordMetric(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = `${name}_${Object.values(labels).join('_')}`
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    
    const metrics = this.metrics.get(key)!
    metrics.push({
      name,
      value,
      labels,
      timestamp: Date.now()
    })
    
    // Keep only recent metrics to prevent memory leaks
    if (metrics.length > 1000) {
      metrics.shift()
    }
  }
  
  private static metricsEndpoint() {
    return (req: Request, res: Response) => {
      const formattedMetrics = this.formatMetricsForPrometheus()
      res.set('Content-Type', 'text/plain')
      res.send(formattedMetrics)
    }
  }
  
  private static formatMetricsForPrometheus(): string {
    let output = ''
    
    for (const [key, metrics] of this.metrics.entries()) {
      if (metrics.length === 0) continue
      
      const latestMetric = metrics[metrics.length - 1]
      const sum = metrics.reduce((acc, m) => acc + m.value, 0)
      const avg = sum / metrics.length
      
      const labelsStr = Object.entries(latestMetric.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',')
      
      output += `# HELP ${latestMetric.name} Application metric\n`
      output += `# TYPE ${latestMetric.name} gauge\n`
      output += `${latestMetric.name}{${labelsStr}} ${latestMetric.value}\n`
      output += `${latestMetric.name}_avg{${labelsStr}} ${avg}\n`
      output += `${latestMetric.name}_sum{${labelsStr}} ${sum}\n`
      output += '\n'
    }
    
    return output
  }
  
  private static startPeriodicReporting(): void {
    setInterval(() => {
      this.reportSystemMetrics()
    }, 60000) // Every minute
  }
  
  private static reportSystemMetrics(): void {
    const memUsage = process.memoryUsage()
    
    this.recordMetric('node_memory_heap_used', memUsage.heapUsed)
    this.recordMetric('node_memory_heap_total', memUsage.heapTotal)
    this.recordMetric('node_memory_external', memUsage.external)
    this.recordMetric('node_uptime_seconds', process.uptime())
    
    // CPU usage (approximate)
    const cpuUsage = process.cpuUsage()
    this.recordMetric('node_cpu_user_seconds', cpuUsage.user / 1000000)
    this.recordMetric('node_cpu_system_seconds', cpuUsage.system / 1000000)
  }
}

interface MetricData {
  name: string
  value: number
  labels: Record<string, string>
  timestamp: number
}
```

### Logging Configuration

```typescript
// src/config/logging.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        service: 'hubspot-mcp-analytics',
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
        serviceId: process.env.RAILWAY_SERVICE_ID,
        ...meta
      })
    })
  ),
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    }),
    // Add file transport for production if needed
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: '/tmp/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: '/tmp/app.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ] : [])
  ]
})

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - startTime
    
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user?.id,
      responseSize: res.get('Content-Length')
    })
  })
  
  next()
}
```

## Resource Optimization

### Railway Resource Configuration

```typescript
// src/config/railway-optimization.ts
export class RailwayOptimization {
  static configureForEnvironment(): void {
    const isProduction = process.env.NODE_ENV === 'production'
    const memoryLimit = this.getMemoryLimit()
    
    // Configure garbage collection
    if (memoryLimit < 1024) {
      // Low memory environment
      process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + 
        ' --max-old-space-size=512 --optimize-for-size'
    } else {
      // Higher memory environment
      process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + 
        ' --max-old-space-size=1024'
    }
    
    // Configure connection pooling based on available resources
    this.configureConnectionPooling(memoryLimit)
    
    // Configure analytics batching based on resources
    this.configureAnalyticsBatching(memoryLimit)
  }
  
  private static getMemoryLimit(): number {
    // Railway provides memory information via container limits
    const memInfo = process.env.RAILWAY_MEMORY_LIMIT || '1024'
    return parseInt(memInfo)
  }
  
  private static configureConnectionPooling(memoryMB: number): void {
    const maxConnections = Math.max(5, Math.min(20, Math.floor(memoryMB / 50)))
    
    process.env.DATABASE_POOL_MIN = '2'
    process.env.DATABASE_POOL_MAX = maxConnections.toString()
    process.env.DATABASE_POOL_ACQUIRE_TIMEOUT = '30000'
    process.env.DATABASE_POOL_IDLE_TIMEOUT = '10000'
  }
  
  private static configureAnalyticsBatching(memoryMB: number): void {
    const batchSize = Math.max(10, Math.min(100, Math.floor(memoryMB / 10)))
    const flushInterval = memoryMB < 512 ? 3000 : 5000
    
    process.env.ANALYTICS_BATCH_SIZE = batchSize.toString()
    process.env.ANALYTICS_FLUSH_INTERVAL = flushInterval.toString()
  }
}
```

### Cost Optimization Strategies

```typescript
// src/config/cost-optimization.ts
export class CostOptimization {
  static implementOptimizations(): void {
    // Connection pooling to reduce database costs
    this.setupEfficientDatabaseConnections()
    
    // Request deduplication
    this.setupRequestDeduplication()
    
    // Efficient caching
    this.setupIntelligentCaching()
    
    // Sleep mode configuration
    this.configureSleepMode()
  }
  
  private static setupEfficientDatabaseConnections(): void {
    // Use connection pooling to minimize database connections
    const poolConfig = {
      min: 2,
      max: process.env.NODE_ENV === 'production' ? 10 : 5,
      acquire: 30000,
      idle: 10000,
      evict: 1000
    }
    
    // Apply to Prisma client
    process.env.DATABASE_POOL_CONFIG = JSON.stringify(poolConfig)
  }
  
  private static setupRequestDeduplication(): void {
    // Implement request deduplication to avoid redundant processing
    const cache = new Map()
    const ttl = 60000 // 1 minute
    
    // Middleware would use this cache to deduplicate similar requests
  }
  
  private static setupIntelligentCaching(): void {
    // Configure Redis or in-memory caching for frequently accessed data
    if (process.env.REDIS_URL) {
      // Use Redis for distributed caching
      process.env.CACHE_STRATEGY = 'redis'
      process.env.CACHE_TTL = '300' // 5 minutes
    } else {
      // Use in-memory caching for single instance
      process.env.CACHE_STRATEGY = 'memory'
      process.env.CACHE_TTL = '120' // 2 minutes
    }
  }
  
  private static configureSleepMode(): void {
    // Configure service to sleep during low usage periods
    if (process.env.NODE_ENV === 'development') {
      process.env.RAILWAY_SLEEP_MODE = 'true'
      process.env.RAILWAY_SLEEP_TIMEOUT = '300' // 5 minutes of inactivity
    }
  }
}
```

This comprehensive deployment specification provides a production-ready, scalable, and cost-effective deployment strategy for the HubSpot MCP Analytics Dashboard on Railway platform, with automated CI/CD, monitoring, and optimization features.