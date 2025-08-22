# Deployment Configuration: Railway MCP Server

## Executive Summary

This document provides comprehensive deployment configuration for the HubSpot MCP server on Railway, including container setup, environment management, monitoring configuration, and production optimization guidelines. All configurations are designed for production-ready deployment with security, performance, and reliability best practices.

## Railway Platform Configuration

### 1. Project Setup and Basic Configuration

#### 1.1 Railway Project Structure

```json
// railway.json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build",
    "watchPatterns": [
      "src/**",
      "package.json",
      "tsconfig.json"
    ]
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "healthcheckInterval": 60
  },
  "environments": {
    "production": {
      "variables": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info",
        "METRICS_ENABLED": "true"
      }
    },
    "staging": {
      "variables": {
        "NODE_ENV": "staging", 
        "LOG_LEVEL": "debug",
        "METRICS_ENABLED": "true"
      }
    }
  }
}
```

#### 1.2 Package.json Configuration

```json
{
  "name": "hubspot-mcp",
  "version": "1.0.0",
  "description": "HubSpot MCP Server with HTTP transport for Railway deployment",
  "type": "module",
  "main": "build/http-server.js",
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  },
  "scripts": {
    "build": "tsc && npm run copy-assets",
    "copy-assets": "cp -r src/assets build/ 2>/dev/null || :",
    "start": "node build/http-server.js",
    "dev": "tsx watch src/http-server.ts",
    "dev:stdio": "tsx watch src/index.ts",
    "test": "jest --coverage",
    "test:integration": "jest --testPathPattern=integration",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "health-check": "node -e \"require('http').get('http://localhost:3000/health', res => process.exit(res.statusCode === 200 ? 0 : 1))\""
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.9.0",
    "@hubspot/api-client": "^9.0.0",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "jsonwebtoken": "^9.0.2",
    "jwks-rsa": "^3.1.0",
    "zod": "^3.22.4",
    "pino": "^8.17.2",
    "fast-glob": "^3.3.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node": "^20.10.5",
    "typescript": "^5.3.3",
    "tsx": "^4.6.2",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.8",
    "supertest": "^6.3.3",
    "@types/supertest": "^6.0.2",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0"
  }
}
```

### 2. Container Configuration

#### 2.1 Dockerfile (Optional - Railway auto-detects Node.js)

```dockerfile
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
```

#### 2.2 Nixpacks Configuration (Railway Default)

```toml
# nixpacks.toml
[phases.setup]
nixPkgs = ["nodejs-18_x", "npm-9_x"]

[phases.build]
cmds = ["npm ci", "npm run build"]

[phases.start]
cmd = "npm start"

[variables]
NPM_CONFIG_PRODUCTION = "false"
```

### 3. Environment Variables Configuration

#### 3.1 Production Environment Setup

```bash
#!/bin/bash
# Railway environment setup script

echo "Setting up production environment variables..."

# Core Configuration
railway variables set NODE_ENV="production"
railway variables set PORT="3000"
railway variables set HOST="0.0.0.0"

# Authentication - Generate secure secrets
JWT_SECRET=$(openssl rand -base64 64)
railway variables set JWT_SECRET="$JWT_SECRET" --sealed

# Replace with your actual values
railway variables set JWT_ISSUER="https://your-auth-server.com"
railway variables set JWT_AUDIENCE="hubspot-mcp-server"
railway variables set JWKS_URI="https://your-auth-server.com/.well-known/jwks.json"
railway variables set JWKS_CACHE_TTL="3600"

# HubSpot Configuration - Use sealed variables for sensitive data
echo "Please enter your HubSpot access token:"
read -s HUBSPOT_TOKEN
railway variables set HUBSPOT_ACCESS_TOKEN="$HUBSPOT_TOKEN" --sealed

railway variables set HUBSPOT_API_BASE_URL="https://api.hubapi.com"
railway variables set HUBSPOT_RATE_LIMIT="10"

# Security Configuration
railway variables set CORS_ORIGIN="https://claude.ai,https://cursor.sh"
railway variables set RATE_LIMIT_WINDOW_MS="900000"
railway variables set RATE_LIMIT_MAX="1000"
railway variables set SESSION_MAX_AGE="1800000"
railway variables set SESSION_CLEANUP_INTERVAL="300000"

# Monitoring Configuration
railway variables set LOG_LEVEL="info"
railway variables set METRICS_ENABLED="true"
railway variables set HEALTH_CHECK_ENABLED="true"

echo "Environment variables configured successfully!"
```

#### 3.2 Environment Variable Validation

```typescript
// src/config/environment.ts
import { z } from 'zod';

const environmentSchema = z.object({
  // Core Configuration
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('0.0.0.0'),
  
  // Authentication
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ISSUER: z.string().url(),
  JWT_AUDIENCE: z.string().min(1),
  JWKS_URI: z.string().url(),
  JWKS_CACHE_TTL: z.string().transform(Number).default('3600'),
  
  // HubSpot Configuration
  HUBSPOT_ACCESS_TOKEN: z.string().min(20),
  HUBSPOT_API_BASE_URL: z.string().url().default('https://api.hubapi.com'),
  HUBSPOT_RATE_LIMIT: z.string().transform(Number).default('10'),
  
  // Security
  CORS_ORIGIN: z.string().transform(origins => origins.split(',')),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('1000'),
  SESSION_MAX_AGE: z.string().transform(Number).default('1800000'),
  SESSION_CLEANUP_INTERVAL: z.string().transform(Number).default('300000'),
  
  // Monitoring
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  METRICS_ENABLED: z.string().transform(v => v === 'true').default('true'),
  HEALTH_CHECK_ENABLED: z.string().transform(v => v === 'true').default('true'),
  
  // Optional Redis Configuration
  REDIS_URL: z.string().url().optional(),
  REDIS_SESSION_PREFIX: z.string().default('mcp:session:'),
  
  // Deployment Metadata
  RAILWAY_DEPLOYMENT_ID: z.string().optional(),
  RAILWAY_ENVIRONMENT: z.string().optional(),
  RAILWAY_SERVICE_NAME: z.string().optional()
});

export type EnvironmentConfig = z.infer<typeof environmentSchema>;

export const loadConfig = (): EnvironmentConfig => {
  try {
    const config = environmentSchema.parse(process.env);
    console.log('✅ Environment configuration loaded successfully');
    return config;
  } catch (error) {
    console.error('❌ Environment configuration validation failed:');
    
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    
    process.exit(1);
  }
};

// Configuration validation on startup
export const validateConfiguration = (config: EnvironmentConfig): void => {
  const issues: string[] = [];
  
  // Production-specific validations
  if (config.NODE_ENV === 'production') {
    if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
      issues.push('JWT_SECRET must be at least 32 characters in production');
    }
    
    if (config.CORS_ORIGIN.includes('*')) {
      issues.push('CORS_ORIGIN should not include wildcards in production');
    }
    
    if (config.LOG_LEVEL === 'debug') {
      issues.push('LOG_LEVEL should not be debug in production');
    }
  }
  
  // Security validations
  if (config.HUBSPOT_ACCESS_TOKEN.length < 40) {
    issues.push('HUBSPOT_ACCESS_TOKEN appears to be invalid (too short)');
  }
  
  if (config.SESSION_MAX_AGE < 300000) { // 5 minutes
    issues.push('SESSION_MAX_AGE should be at least 5 minutes');
  }
  
  if (issues.length > 0) {
    console.error('❌ Configuration validation failed:');
    issues.forEach(issue => console.error(`  ${issue}`));
    process.exit(1);
  }
  
  console.log('✅ Configuration validation passed');
};
```

### 4. Health Check Configuration

#### 4.1 Comprehensive Health Check Implementation

```typescript
// src/health/health-check.ts
import { Request, Response } from 'express';
import { HubspotApiClient } from '@hubspot/api-client';
import jwt from 'jsonwebtoken';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  sessions: {
    total: number;
    active: number;
    idle: number;
  };
  dependencies: {
    hubspot: DependencyHealth;
    auth: DependencyHealth;
    database?: DependencyHealth;
  };
  metrics: {
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
  };
}

interface DependencyHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  lastChecked: string;
}

class HealthChecker {
  constructor(
    private hubspotClient: HubspotApiClient,
    private sessionManager: any,
    private metricsCollector: any
  ) {}
  
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    const [hubspotHealth, authHealth] = await Promise.allSettled([
      this.checkHubSpotHealth(),
      this.checkAuthHealth()
    ]);
    
    const memory = process.memoryUsage();
    const sessionStats = this.sessionManager.getStats();
    
    const overallStatus = this.determineOverallStatus([
      hubspotHealth.status === 'fulfilled' ? hubspotHealth.value : { status: 'unhealthy' as const },
      authHealth.status === 'fulfilled' ? authHealth.value : { status: 'unhealthy' as const }
    ]);
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used: memory.heapUsed,
        free: memory.heapTotal - memory.heapUsed,
        total: memory.heapTotal,
        percentage: Math.round((memory.heapUsed / memory.heapTotal) * 100)
      },
      sessions: {
        total: sessionStats.total,
        active: sessionStats.byState?.active || 0,
        idle: sessionStats.byState?.idle || 0
      },
      dependencies: {
        hubspot: hubspotHealth.status === 'fulfilled' ? hubspotHealth.value : {
          status: 'unhealthy',
          error: hubspotHealth.reason?.message,
          lastChecked: new Date().toISOString()
        },
        auth: authHealth.status === 'fulfilled' ? authHealth.value : {
          status: 'unhealthy',
          error: authHealth.reason?.message,
          lastChecked: new Date().toISOString()
        }
      },
      metrics: this.metricsCollector.getMetrics()
    };
  }
  
  private async checkHubSpotHealth(): Promise<DependencyHealth> {
    const startTime = Date.now();
    
    try {
      // Test HubSpot API connectivity with a lightweight request
      await this.hubspotClient.crm.companies.basicApi.getPage(1);
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      };
    }
  }
  
  private async checkAuthHealth(): Promise<DependencyHealth> {
    const startTime = Date.now();
    
    try {
      // Test JWT configuration by creating a test token
      const testPayload = {
        sub: 'health-check',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60
      };
      
      if (process.env.JWT_SECRET) {
        jwt.sign(testPayload, process.env.JWT_SECRET);
      } else {
        // For production with JWKS, verify JWKS URI is accessible
        const response = await fetch(process.env.JWKS_URI!);
        if (!response.ok) {
          throw new Error(`JWKS endpoint returned ${response.status}`);
        }
      }
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      };
    }
  }
  
  private determineOverallStatus(dependencies: Array<{ status: string }>): 'healthy' | 'unhealthy' | 'degraded' {
    const unhealthyCount = dependencies.filter(d => d.status === 'unhealthy').length;
    const degradedCount = dependencies.filter(d => d.status === 'degraded').length;
    
    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }
}

// Health check endpoint handler
export const createHealthCheckHandler = (healthChecker: HealthChecker) => {
  return async (req: Request, res: Response) => {
    try {
      const health = await healthChecker.performHealthCheck();
      
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed'
      });
    }
  };
};
```

#### 4.2 Railway Health Check Configuration

```typescript
// src/health/railway-health.ts
// Simplified health check specifically for Railway's health check system

export const railwayHealthCheck = (req: Request, res: Response) => {
  // Railway expects a simple 200 response for healthy status
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  
  // Basic health indicators
  const isHealthy = (
    uptime > 5 &&                           // Server has been running for at least 5 seconds
    memory.heapUsed < memory.heapTotal * 0.9 // Memory usage below 90%
  );
  
  if (isHealthy) {
    res.status(200).json({
      status: 'healthy',
      uptime: Math.floor(uptime),
      memory: Math.round((memory.heapUsed / memory.heapTotal) * 100)
    });
  } else {
    res.status(503).json({
      status: 'unhealthy',
      uptime: Math.floor(uptime),
      memory: Math.round((memory.heapUsed / memory.heapTotal) * 100)
    });
  }
};
```

### 5. Monitoring and Logging Configuration

#### 5.1 Structured Logging Setup

```typescript
// src/logging/logger.ts
import pino from 'pino';

interface LogConfig {
  level: string;
  environment: string;
  serviceName: string;
  version: string;
}

export const createLogger = (config: LogConfig) => {
  const pinoConfig: pino.LoggerOptions = {
    level: config.level,
    name: config.serviceName,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
        service: config.serviceName,
        version: config.version,
        environment: config.environment
      })
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers["mcp-session-id"]',
        'hubspot_token',
        'jwt_secret',
        'password',
        'token'
      ],
      censor: '[REDACTED]'
    }
  };
  
  // Production logging optimizations
  if (config.environment === 'production') {
    pinoConfig.level = 'info';
    pinoConfig.serializers = {
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type']
        },
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort
      }),
      res: (res) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type': res.getHeader('content-type'),
          'content-length': res.getHeader('content-length')
        }
      }),
      err: pino.stdSerializers.err
    };
  }
  
  return pino(pinoConfig);
};

// Request logging middleware
export const createRequestLogger = (logger: pino.Logger) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Generate request ID for correlation
    const requestId = require('crypto').randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);
    
    // Log request start
    logger.info({
      req,
      requestId,
      event: 'request_start'
    }, 'HTTP Request Started');
    
    // Log request completion
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      logger.info({
        req,
        res,
        requestId,
        duration,
        event: 'request_complete'
      }, 'HTTP Request Completed');
    });
    
    next();
  };
};
```

#### 5.2 Metrics Collection

```typescript
// src/monitoring/metrics.ts
interface MetricsData {
  httpRequests: {
    total: number;
    byStatus: Record<number, number>;
    byMethod: Record<string, number>;
  };
  mcpRequests: {
    total: number;
    byMethod: Record<string, number>;
    errors: number;
  };
  sessions: {
    created: number;
    terminated: number;
    active: number;
  };
  hubspot: {
    apiCalls: number;
    errors: number;
    rateLimitHits: number;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

class MetricsCollector {
  private metrics: MetricsData = {
    httpRequests: { total: 0, byStatus: {}, byMethod: {} },
    mcpRequests: { total: 0, byMethod: {}, errors: 0 },
    sessions: { created: 0, terminated: 0, active: 0 },
    hubspot: { apiCalls: 0, errors: 0, rateLimitHits: 0 },
    performance: { averageResponseTime: 0, p95ResponseTime: 0, memoryUsage: 0, cpuUsage: 0 }
  };
  
  private responseTimes: number[] = [];
  
  incrementHttpRequest(method: string, statusCode: number): void {
    this.metrics.httpRequests.total++;
    this.metrics.httpRequests.byMethod[method] = (this.metrics.httpRequests.byMethod[method] || 0) + 1;
    this.metrics.httpRequests.byStatus[statusCode] = (this.metrics.httpRequests.byStatus[statusCode] || 0) + 1;
  }
  
  incrementMCPRequest(method: string, isError = false): void {
    this.metrics.mcpRequests.total++;
    this.metrics.mcpRequests.byMethod[method] = (this.metrics.mcpRequests.byMethod[method] || 0) + 1;
    
    if (isError) {
      this.metrics.mcpRequests.errors++;
    }
  }
  
  recordResponseTime(duration: number): void {
    this.responseTimes.push(duration);
    
    // Keep only last 1000 measurements for p95 calculation
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
    
    // Update average
    this.metrics.performance.averageResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    
    // Update p95
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    this.metrics.performance.p95ResponseTime = sorted[p95Index] || 0;
  }
  
  updateSystemMetrics(): void {
    const memory = process.memoryUsage();
    this.metrics.performance.memoryUsage = memory.heapUsed;
    
    // CPU usage would require additional monitoring
    // For now, we'll track it via external monitoring
  }
  
  incrementHubSpotCall(isError = false, isRateLimit = false): void {
    this.metrics.hubspot.apiCalls++;
    
    if (isError) {
      this.metrics.hubspot.errors++;
    }
    
    if (isRateLimit) {
      this.metrics.hubspot.rateLimitHits++;
    }
  }
  
  updateSessionCount(active: number): void {
    this.metrics.sessions.active = active;
  }
  
  incrementSessionCreated(): void {
    this.metrics.sessions.created++;
  }
  
  incrementSessionTerminated(): void {
    this.metrics.sessions.terminated++;
  }
  
  getMetrics(): MetricsData {
    this.updateSystemMetrics();
    return { ...this.metrics };
  }
  
  // Prometheus format for metrics endpoint
  toPrometheusFormat(): string {
    const metrics = this.getMetrics();
    
    return `
# HELP mcp_http_requests_total Total number of HTTP requests
# TYPE mcp_http_requests_total counter
mcp_http_requests_total ${metrics.httpRequests.total}

# HELP mcp_http_request_duration_seconds HTTP request duration in seconds
# TYPE mcp_http_request_duration_seconds histogram
mcp_http_request_duration_seconds_average ${metrics.performance.averageResponseTime / 1000}
mcp_http_request_duration_seconds_p95 ${metrics.performance.p95ResponseTime / 1000}

# HELP mcp_sessions_active Number of active MCP sessions
# TYPE mcp_sessions_active gauge
mcp_sessions_active ${metrics.sessions.active}

# HELP mcp_sessions_created_total Total number of sessions created
# TYPE mcp_sessions_created_total counter
mcp_sessions_created_total ${metrics.sessions.created}

# HELP mcp_hubspot_api_calls_total Total number of HubSpot API calls
# TYPE mcp_hubspot_api_calls_total counter
mcp_hubspot_api_calls_total ${metrics.hubspot.apiCalls}

# HELP mcp_hubspot_errors_total Total number of HubSpot API errors
# TYPE mcp_hubspot_errors_total counter
mcp_hubspot_errors_total ${metrics.hubspot.errors}

# HELP mcp_memory_usage_bytes Current memory usage in bytes
# TYPE mcp_memory_usage_bytes gauge
mcp_memory_usage_bytes ${metrics.performance.memoryUsage}
    `.trim();
  }
}

export const metricsCollector = new MetricsCollector();

// Metrics collection middleware
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    metricsCollector.incrementHttpRequest(req.method, res.statusCode);
    metricsCollector.recordResponseTime(duration);
    
    // Track MCP-specific requests
    if (req.path === '/mcp') {
      const mcpMethod = req.body?.method || 'unknown';
      const isError = res.statusCode >= 400;
      metricsCollector.incrementMCPRequest(mcpMethod, isError);
    }
  });
  
  next();
};
```

### 6. Auto-scaling Configuration

#### 6.1 Railway Auto-scaling Setup

```typescript
// src/scaling/auto-scaler.ts
interface ScalingConfig {
  minInstances: number;
  maxInstances: number;
  targetCPUPercent: number;
  targetMemoryPercent: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
}

class AutoScaler {
  private lastScaleEvent = 0;
  
  constructor(private config: ScalingConfig) {}
  
  getScalingRecommendation(): 'scale_up' | 'scale_down' | 'no_change' {
    const now = Date.now();
    const memory = process.memoryUsage();
    const memoryPercent = (memory.heapUsed / memory.heapTotal) * 100;
    
    // Railway handles actual scaling, but we can provide recommendations
    if (memoryPercent > this.config.targetMemoryPercent) {
      if (now - this.lastScaleEvent > this.config.scaleUpCooldown) {
        this.lastScaleEvent = now;
        return 'scale_up';
      }
    } else if (memoryPercent < this.config.targetMemoryPercent * 0.5) {
      if (now - this.lastScaleEvent > this.config.scaleDownCooldown) {
        this.lastScaleEvent = now;
        return 'scale_down';
      }
    }
    
    return 'no_change';
  }
  
  getScalingMetrics() {
    const memory = process.memoryUsage();
    
    return {
      memoryUsage: (memory.heapUsed / memory.heapTotal) * 100,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      uptime: process.uptime(),
      activeSessions: 0, // Would be provided by session manager
      recommendation: this.getScalingRecommendation()
    };
  }
}

// Railway-specific scaling webhook (if using Railway's auto-scaling API)
export const scalingWebhookHandler = (req: Request, res: Response) => {
  const metrics = autoScaler.getScalingMetrics();
  
  // Railway can use this data for scaling decisions
  res.json({
    timestamp: new Date().toISOString(),
    metrics,
    recommendations: {
      action: metrics.recommendation,
      reason: `Memory usage: ${metrics.memoryUsage.toFixed(1)}%`
    }
  });
};

const autoScaler = new AutoScaler({
  minInstances: 1,
  maxInstances: 10,
  targetCPUPercent: 70,
  targetMemoryPercent: 80,
  scaleUpCooldown: 300000,   // 5 minutes
  scaleDownCooldown: 600000  // 10 minutes
});
```

### 7. Performance Optimization Configuration

#### 7.1 Production Optimizations

```typescript
// src/optimization/performance.ts
import compression from 'compression';
import helmet from 'helmet';

export const createPerformanceMiddleware = () => {
  const middleware = [];
  
  // Compression for all responses
  middleware.push(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  
  // Security headers
  middleware.push(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.hubapi.com"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
  
  return middleware;
};

// Connection pooling configuration
export const createConnectionPool = () => {
  const http = require('http');
  const https = require('https');
  
  // Configure HTTP agent for better connection management
  const httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
    freeSocketTimeout: 30000
  });
  
  const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
    freeSocketTimeout: 30000
  });
  
  return { httpAgent, httpsAgent };
};
```

#### 7.2 Caching Configuration

```typescript
// src/caching/cache-config.ts
interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  checkPeriod: number;
}

class ProductionCache {
  private cache = new Map();
  private timers = new Map();
  
  constructor(private config: CacheConfig) {
    // Periodic cleanup
    setInterval(() => this.cleanup(), this.config.checkPeriod);
  }
  
  set(key: string, value: any, ttl?: number): void {
    const expireTime = Date.now() + (ttl || this.config.defaultTTL);
    
    this.cache.set(key, {
      value,
      expireTime
    });
    
    // Set expiration timer
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, ttl || this.config.defaultTTL);
    
    this.timers.set(key, timer);
    
    // Enforce max size
    if (this.cache.size > this.config.maxSize) {
      this.evictOldest();
    }
  }
  
  get(key: string): any | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    if (Date.now() > item.expireTime) {
      this.cache.delete(key);
      const timer = this.timers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
      return null;
    }
    
    return item.value;
  }
  
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expireTime) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => {
      this.cache.delete(key);
      const timer = this.timers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
    });
  }
  
  private evictOldest(): void {
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      this.cache.delete(oldestKey);
      const timer = this.timers.get(oldestKey);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(oldestKey);
      }
    }
  }
}

export const productionCache = new ProductionCache({
  defaultTTL: 300000,  // 5 minutes
  maxSize: 1000,       // 1000 entries
  checkPeriod: 60000   // 1 minute cleanup
});
```

### 8. Deployment Scripts

#### 8.1 Automated Deployment Script

```bash
#!/bin/bash
# deploy.sh - Automated deployment script for Railway

set -e

echo "🚀 Starting deployment to Railway..."

# Validate environment
if [ -z "$RAILWAY_TOKEN" ]; then
    echo "❌ RAILWAY_TOKEN environment variable not set"
    exit 1
fi

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."

# Run tests
npm test

# Run linting
npm run lint

# Build application
echo "🔨 Building application..."
npm run build

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up --environment production

# Wait for deployment to be ready
echo "⏳ Waiting for deployment to be ready..."
sleep 30

# Health check
echo "🏥 Running health check..."
DEPLOY_URL=$(railway status --json | jq -r '.deployments[0].url')

if curl -f "$DEPLOY_URL/health" > /dev/null 2>&1; then
    echo "✅ Deployment successful! Health check passed."
    echo "🌐 Application URL: $DEPLOY_URL"
else
    echo "❌ Deployment failed! Health check failed."
    echo "🔄 Consider rolling back..."
    exit 1
fi

echo "🎉 Deployment completed successfully!"
```

#### 8.2 Rollback Script

```bash
#!/bin/bash
# rollback.sh - Rollback script for Railway deployments

set -e

echo "🔄 Starting rollback process..."

# Get previous deployment
PREVIOUS_DEPLOYMENT=$(railway deployments list --limit 2 --json | jq -r '.[1].id')

if [ "$PREVIOUS_DEPLOYMENT" = "null" ]; then
    echo "❌ No previous deployment found"
    exit 1
fi

echo "📋 Rolling back to deployment: $PREVIOUS_DEPLOYMENT"

# Perform rollback
railway rollback "$PREVIOUS_DEPLOYMENT"

# Wait for rollback to complete
echo "⏳ Waiting for rollback to complete..."
sleep 30

# Verify rollback
echo "🔍 Verifying rollback..."
DEPLOY_URL=$(railway status --json | jq -r '.deployments[0].url')

if curl -f "$DEPLOY_URL/health" > /dev/null 2>&1; then
    echo "✅ Rollback successful! Health check passed."
else
    echo "❌ Rollback verification failed!"
    exit 1
fi

echo "🎉 Rollback completed successfully!"
```

This comprehensive deployment configuration provides production-ready setup for the HubSpot MCP server on Railway, including security, monitoring, performance optimization, and operational procedures.