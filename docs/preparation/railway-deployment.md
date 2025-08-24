# Railway Deployment Research

## Executive Summary

Railway provides a modern, developer-friendly platform for deploying full-stack applications with managed PostgreSQL databases. Key findings indicate excellent support for Node.js/TypeScript applications with automatic environment variable injection, zero-config deployments, and seamless PostgreSQL integration. Railway's containerized deployment approach with Nixpacks builder offers optimal performance and reliability for MCP server deployments.

**Primary Recommendations:**
- Use Railway's managed PostgreSQL service for zero-maintenance database operations
- Implement proper environment variable management for secure configuration
- Configure automated deployments from Git repositories
- Utilize Railway CLI for local development environment parity

## Railway Platform Overview

### Core Features

| Feature | Benefit | Implementation |
|---------|---------|----------------|
| Auto-Deploy | Git-based CI/CD | Connect repository, automatic builds |
| Managed PostgreSQL | Zero maintenance | One-click database provisioning |
| Environment Variables | Secure configuration | Automatic injection across services |
| Nixpacks Builder | Optimized builds | Automatic detection and optimization |
| Custom Domains | Production-ready URLs | SSL certificates included |
| Monitoring | Built-in observability | Logs, metrics, resource usage |

### Service Architecture

Railway organizes applications into **Projects** containing multiple **Services**:
- **Web Service**: Your Node.js MCP server + dashboard
- **Database Service**: Managed PostgreSQL instance
- **Environment Variables**: Shared across all services in project

## Database Configuration

### PostgreSQL Service Setup

**Automatic Environment Variables:**
```bash
# Railway automatically provides these
DATABASE_URL=postgresql://postgres:password@host:5432/railway
DATABASE_PUBLIC_URL=postgresql://postgres:password@public-host:5432/railway
POSTGRES_HOST=containers-us-west-host.railway.app
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=generated_password
POSTGRES_DB=railway
```

**Connection String Format:**
```
postgresql://[user[:password]@][host][:port][,...][/dbname][?param1=value1&...]
```

### Database Migration Strategy

**railway.json Configuration:**
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm run start:production",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  },
  "variables": {
    "NODE_ENV": "production"
  }
}
```

**package.json Build Scripts:**
```json
{
  "scripts": {
    "build": "npm run db:migrate && npm run compile",
    "compile": "tsc",
    "db:migrate": "npx prisma migrate deploy",
    "db:generate": "npx prisma generate",
    "start:production": "node build/src/index.js",
    "dev": "railway run npm run dev:local",
    "dev:local": "ts-node-dev src/index.ts"
  }
}
```

### Database Connection Patterns

**Production-Ready Connection:**
```typescript
// src/config/database.ts
import { PrismaClient } from '@prisma/client'

const createPrismaClient = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`)
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
```

**Health Check Implementation:**
```typescript
// src/health/railway-health.ts
import { Request, Response } from 'express'
import { prisma } from '../config/database.js'

export const healthCheck = async (req: Request, res: Response) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    services: {
      database: 'unknown',
      server: 'healthy'
    }
  }

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`
    healthcheck.services.database = 'healthy'
    
    res.status(200).json(healthcheck)
  } catch (error) {
    healthcheck.message = 'Database connection failed'
    healthcheck.services.database = 'unhealthy'
    
    console.error('Health check failed:', error)
    res.status(503).json(healthcheck)
  }
}
```

## Environment Configuration

### Environment Variable Management

**Development Environment (.env.local):**
```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/hubspot_mcp_dev"

# Authentication
JWT_SECRET="your-development-secret-key"
SESSION_SECRET="your-session-secret"

# HubSpot
HUBSPOT_CLIENT_ID="your-client-id"
HUBSPOT_CLIENT_SECRET="your-client-secret"

# Application
NODE_ENV="development"
PORT=3000
FRONTEND_URL="http://localhost:3001"

# Analytics
ANALYTICS_ENABLED=true
LOG_LEVEL="debug"
```

**Production Environment (Railway Variables):**
```bash
# Set via Railway dashboard or CLI
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=$(openssl rand -base64 32)
railway variables set SESSION_SECRET=$(openssl rand -base64 32)
railway variables set HUBSPOT_CLIENT_ID=your-production-client-id
railway variables set HUBSPOT_CLIENT_SECRET=your-production-client-secret
railway variables set ANALYTICS_ENABLED=true
railway variables set LOG_LEVEL=info
```

**Environment Validation:**
```typescript
// src/config/environment.ts
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  HUBSPOT_CLIENT_ID: z.string().min(1),
  HUBSPOT_CLIENT_SECRET: z.string().min(1),
  FRONTEND_URL: z.string().url().optional(),
  ANALYTICS_ENABLED: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export type Environment = z.infer<typeof envSchema>

export const validateEnvironment = (): Environment => {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid environment configuration:')
    console.error(error.errors)
    process.exit(1)
  }
}

export const env = validateEnvironment()
```

## Deployment Configuration

### Multi-Service Architecture

**Project Structure:**
```
hubspot-mcp-analytics/
├── services/
│   ├── api/                 # MCP Server + API
│   │   ├── src/
│   │   ├── package.json
│   │   ├── railway.json
│   │   └── Dockerfile
│   ├── dashboard/           # Next.js Dashboard
│   │   ├── app/
│   │   ├── components/
│   │   ├── package.json
│   │   └── railway.json
│   └── database/           # PostgreSQL (managed)
├── shared/
│   └── types/              # Shared TypeScript types
└── railway.json           # Root configuration
```

**API Service Configuration (services/api/railway.json):**
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  },
  "variables": {
    "NODE_ENV": "production"
  }
}
```

**Dashboard Service Configuration (services/dashboard/railway.json):**
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE"
  },
  "variables": {
    "NODE_ENV": "production"
  }
}
```

### Custom Domain Configuration

**Domain Setup Steps:**
1. Add custom domain in Railway dashboard
2. Configure DNS CNAME record
3. SSL certificate auto-provisioned
4. Environment-specific URLs

**Multi-Environment Setup:**
```bash
# Production
DOMAIN=analytics.yourdomain.com
API_URL=https://api.analytics.yourdomain.com
DASHBOARD_URL=https://analytics.yourdomain.com

# Staging
DOMAIN=staging-analytics.yourdomain.com
API_URL=https://staging-api.analytics.yourdomain.com
DASHBOARD_URL=https://staging-analytics.yourdomain.com
```

## Development Workflow

### Railway CLI Integration

**Installation and Setup:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to existing project
railway link [project-id]

# Or create new project
railway init
```

**Local Development Commands:**
```bash
# Run with Railway environment variables
railway run npm run dev

# View logs
railway logs

# Open database shell
railway connect

# Deploy manually
railway up

# View service status
railway status

# Manage environment variables
railway variables
railway variables set KEY=value
railway variables delete KEY
```

### Database Management

**Schema Management:**
```bash
# Generate Prisma client
railway run npx prisma generate

# Create and apply migrations
railway run npx prisma migrate dev --name initial_schema

# Deploy migrations to production
railway run npx prisma migrate deploy

# Seed database
railway run npx prisma db seed

# Studio for database inspection
railway run npx prisma studio
```

**Backup Strategy:**
```bash
# Database backup script
#!/bin/bash
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
railway run pg_dump $DATABASE_URL > $BACKUP_FILE
echo "Backup created: $BACKUP_FILE"

# Restore from backup
railway run psql $DATABASE_URL < backup_file.sql
```

## Performance and Monitoring

### Resource Configuration

**Service Resource Limits:**
```json
{
  "deploy": {
    "numReplicas": 1,
    "sleepApplication": false,
    "resourceLimits": {
      "memoryLimitMB": 1024,
      "cpuLimitMillicores": 1000
    }
  }
}
```

**Database Configuration:**
- **Starter Plan**: Shared resources, 1GB storage
- **Developer Plan**: Dedicated resources, 8GB storage  
- **Team Plan**: Higher limits, automated backups

### Monitoring and Logging

**Structured Logging:**
```typescript
// src/utils/logger.ts
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'hubspot-mcp-analytics',
    environment: process.env.NODE_ENV,
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
    serviceId: process.env.RAILWAY_SERVICE_ID
  },
  transports: [
    new winston.transports.Console(),
    // Railway automatically captures console output
  ],
})

export { logger }
```

**Metrics Collection:**
```typescript
// src/middleware/metrics.ts
import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    
    logger.info('http_request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    })
  })
  
  next()
}
```

## Security Configuration

### Production Security Headers

```typescript
// src/middleware/security.ts
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { Request } from 'express'

// Rate limiting
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip || 'unknown'
  }
})

// Security headers
export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
})
```

### Environment-Based Configuration

```typescript
// src/config/railway.ts
export interface RailwayConfig {
  environment: string
  deploymentId?: string
  serviceId?: string
  projectId?: string
  isDevelopment: boolean
  isProduction: boolean
}

export const getRailwayConfig = (): RailwayConfig => {
  const environment = process.env.RAILWAY_ENVIRONMENT || 'development'
  
  return {
    environment,
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
    serviceId: process.env.RAILWAY_SERVICE_ID,
    projectId: process.env.RAILWAY_PROJECT_ID,
    isDevelopment: environment === 'development',
    isProduction: environment === 'production'
  }
}
```

## Troubleshooting Common Issues

### Build Failures

**Common Build Issues:**
```bash
# Missing build command
"scripts": {
  "build": "tsc && npm run db:generate"
}

# Memory issues during build
export NODE_OPTIONS="--max-old-space-size=4096"

# Prisma generation issues
"postinstall": "prisma generate"
```

**Build Debug Commands:**
```bash
# View build logs
railway logs --deployment [deployment-id]

# Check build environment
railway run env

# Test build locally
railway run npm run build
```

### Connection Issues

**Database Connection Troubleshooting:**
```typescript
// Connection health check with detailed error info
export const debugConnection = async () => {
  try {
    console.log('Database URL format check:', {
      hasUrl: !!process.env.DATABASE_URL,
      urlLength: process.env.DATABASE_URL?.length,
      urlStart: process.env.DATABASE_URL?.substring(0, 20)
    })

    await prisma.$queryRaw`SELECT version()`
    console.log('✅ Database connection successful')
    
    const result = await prisma.$queryRaw`SELECT current_setting('server_version')`
    console.log('PostgreSQL version:', result)
    
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    console.error('Environment variables:', {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'MISSING',
      POSTGRES_HOST: process.env.POSTGRES_HOST,
      POSTGRES_PORT: process.env.POSTGRES_PORT
    })
  }
}
```

## Cost Optimization

### Resource Usage Patterns

**Development Workflow:**
- Use `railway run` for local development
- Enable sleep mode for non-production services
- Implement connection pooling to reduce database load

**Production Optimization:**
```typescript
// Efficient connection management
const dbConfig = {
  pool: {
    min: 5,
    max: process.env.NODE_ENV === 'production' ? 20 : 10,
    createTimeoutMillis: 8000,
    acquireTimeoutMillis: 8000,
    idleTimeoutMillis: 8000,
    reapIntervalMillis: 1000,
  }
}
```

## Resource Links

- [Railway Documentation](https://docs.railway.com/)
- [Railway PostgreSQL Guide](https://docs.railway.com/guides/postgresql)
- [Railway CLI Reference](https://docs.railway.com/reference/cli-api)
- [Nixpacks Builder](https://nixpacks.com/)
- [Railway Templates](https://railway.app/templates)

## Recommendations

1. **Use Railway's managed PostgreSQL** for zero-maintenance database operations
2. **Implement proper health checks** for reliable deployments and monitoring
3. **Set up automated migrations** in the build process for seamless deployments  
4. **Use environment variable validation** to catch configuration errors early
5. **Implement structured logging** for better debugging and monitoring
6. **Configure proper security headers** and rate limiting for production
7. **Set up multi-environment workflows** for staging and production separation
8. **Use Railway CLI** for local development environment parity