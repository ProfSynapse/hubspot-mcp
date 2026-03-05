# Implementation Plan: STDIO to HTTP Migration

## Executive Summary

This implementation plan provides a detailed, phase-by-phase approach to migrating the HubSpot MCP server from STDIO transport to HTTP deployment on Railway. The plan prioritizes maintaining system stability, ensuring zero downtime for development workflows, and implementing robust testing at each phase.

## Migration Strategy Overview

### Approach: Blue-Green Deployment Pattern

1. **Build New HTTP Implementation** alongside existing STDIO version
2. **Test HTTP Version** thoroughly in isolated environment  
3. **Deploy to Railway** with comprehensive monitoring
4. **Gradual Migration** of client connections
5. **Deprecate STDIO** version after validation

### Success Criteria

- [ ] 100% feature parity between STDIO and HTTP implementations
- [ ] Sub-200ms response time for 95% of requests
- [ ] Zero data loss during migration
- [ ] Successful integration with Claude Desktop/Phone apps
- [ ] Production-ready monitoring and alerting

## Phase 1: HTTP Transport Foundation (Week 1)

### 1.1 Project Setup and Dependencies

**Timeline**: 1-2 days

**Tasks**:
- [ ] Install HTTP transport dependencies
- [ ] Update TypeScript configuration for new modules
- [ ] Create development environment configuration
- [ ] Set up local testing infrastructure

**Implementation**:

```bash
# Install required packages
npm install express cors helmet express-rate-limit
npm install @types/express @types/cors --save-dev

# Update package.json scripts
{
  "scripts": {
    "dev:stdio": "tsx watch src/index.ts",
    "dev:http": "tsx watch src/http-server.ts", 
    "build": "tsc",
    "start": "node build/http-server.js",
    "test:http": "jest --testPathPattern=http"
  }
}
```

**Deliverables**:
- Updated `package.json` with HTTP dependencies
- New TypeScript build configuration
- Development scripts for both STDIO and HTTP modes

### 1.2 Core HTTP Server Implementation

**Timeline**: 2-3 days

**Tasks**:
- [ ] Create Express.js application structure
- [ ] Implement HTTP Streamable transport integration
- [ ] Add basic health check endpoints
- [ ] Set up request/response logging

**Implementation**:

```typescript
// src/http-server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './core/server.js';

const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id'],
  exposedHeaders: ['Mcp-Session-Id']
}));

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV
  });
});

// Session management
const sessions = new Map();

// MCP endpoint
app.all('/mcp', async (req, res) => {
  // Implementation details in Phase 1.3
});

app.listen(port, () => {
  console.log(`HubSpot MCP HTTP Server running on port ${port}`);
});
```

**Deliverables**:
- Basic Express.js server with middleware
- Health check endpoint
- MCP endpoint stub
- Request logging infrastructure

### 1.3 Session Management Implementation

**Timeline**: 2-3 days

**Tasks**:
- [ ] Implement session ID generation and validation
- [ ] Create session context storage
- [ ] Add session cleanup mechanisms
- [ ] Implement connection state management

**Implementation**:

```typescript
// src/core/session-manager.ts
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

interface SessionContext {
  id: string;
  transport: StreamableHTTPServerTransport;
  created: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
}

export class SessionManager {
  private sessions = new Map<string, SessionContext>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private config = { maxAge: 30 * 60 * 1000, cleanupInterval: 5 * 60 * 1000 }) {
    this.startCleanup();
  }

  createSession(sessionId?: string): SessionContext {
    const id = sessionId || this.generateSessionId();
    const session: SessionContext = {
      id,
      transport: new StreamableHTTPServerTransport(),
      created: new Date(),
      lastActivity: new Date(),
      metadata: {}
    };

    this.sessions.set(id, session);
    return session;
  }

  getSession(sessionId: string): SessionContext | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
    return session;
  }

  private generateSessionId(): string {
    return randomUUID();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > this.config.maxAge) {
        try {
          session.transport.close();
        } catch (error) {
          console.warn(`Error closing session ${id}:`, error);
        }
        this.sessions.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired sessions`);
    }
  }

  getStats() {
    return {
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(
        s => Date.now() - s.lastActivity.getTime() < 5 * 60 * 1000
      ).length
    };
  }
}
```

**Deliverables**:
- Session management class with full lifecycle
- Automatic cleanup mechanism
- Session statistics for monitoring
- Connection state tracking

### 1.4 Testing Infrastructure

**Timeline**: 1-2 days

**Tasks**:
- [ ] Set up Jest testing framework for HTTP endpoints
- [ ] Create MCP protocol test utilities
- [ ] Implement integration test suite
- [ ] Add performance benchmarking tests

**Implementation**:

```typescript
// tests/http-server.test.ts
import request from 'supertest';
import { app } from '../src/http-server';

describe('MCP HTTP Server', () => {
  test('Health check endpoint', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('healthy');
    expect(response.body.timestamp).toBeDefined();
  });

  test('MCP initialize request', async () => {
    const response = await request(app)
      .post('/mcp')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      })
      .expect(200);

    expect(response.body.result).toBeDefined();
    expect(response.headers['mcp-session-id']).toBeDefined();
  });
});
```

**Deliverables**:
- Comprehensive test suite for HTTP endpoints
- MCP protocol compliance tests
- Performance benchmarking framework
- CI/CD integration tests

## Phase 2: Authentication and Security (Week 2)

### 2.1 Bearer Token Authentication

**Timeline**: 2-3 days

**Tasks**:
- [ ] Implement JWT token validation middleware
- [ ] Create authentication configuration system
- [ ] Add token expiration and refresh handling
- [ ] Implement permission-based access control

**Implementation**:

```typescript
// src/middleware/auth.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface AuthConfig {
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  requiredPermissions: string[];
}

interface AuthContext {
  userId: string;
  permissions: string[];
  sessionId: string;
  exp: number;
}

export const createAuthMiddleware = (config: AuthConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Missing authorization token'
          }
        });
      }

      const decoded = jwt.verify(token, config.jwtSecret, {
        issuer: config.jwtIssuer,
        audience: config.jwtAudience
      }) as AuthContext;

      // Check required permissions
      const hasPermission = config.requiredPermissions.every(
        perm => decoded.permissions.includes(perm)
      );

      if (!hasPermission) {
        return res.status(403).json({
          jsonrpc: '2.0',
          error: {
            code: -32003,
            message: 'Insufficient permissions'
          }
        });
      }

      req.auth = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Invalid or expired token'
        }
      });
    }
  };
};

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}
```

**Deliverables**:
- JWT authentication middleware
- Permission validation system
- Token extraction utilities
- Authentication error handling

### 2.2 Rate Limiting and Security Hardening

**Timeline**: 1-2 days

**Tasks**:
- [ ] Implement rate limiting per session/IP
- [ ] Add input validation and sanitization
- [ ] Configure security headers
- [ ] Set up audit logging

**Implementation**:

```typescript
// src/middleware/security.ts
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

export const createRateLimit = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    keyGenerator: (req) => {
      return req.auth?.userId || 
             req.headers['mcp-session-id'] as string || 
             req.ip;
    },
    message: {
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Rate limit exceeded'
      }
    }
  });
};

const mcpRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  method: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_/]*$/),
  params: z.any().optional()
});

export const validateMCPRequest = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST') {
    try {
      mcpRequestSchema.parse(req.body);
      next();
    } catch (error) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: error.errors
        }
      });
    }
  } else {
    next();
  }
};
```

**Deliverables**:
- Rate limiting middleware with multiple strategies
- Input validation for MCP requests
- Security headers configuration
- Audit logging system

### 2.3 Security Testing

**Timeline**: 1-2 days

**Tasks**:
- [ ] Penetration testing for authentication endpoints
- [ ] Rate limiting verification tests
- [ ] Input validation security tests
- [ ] Token security analysis

**Deliverables**:
- Security test suite
- Penetration testing results
- Security vulnerability assessment
- Authentication flow validation

## Phase 3: Railway Deployment Configuration (Week 3)

### 3.1 Container Configuration

**Timeline**: 1-2 days

**Tasks**:
- [ ] Create optimized Dockerfile
- [ ] Configure Railway deployment settings
- [ ] Set up environment variable management
- [ ] Implement health checks

**Implementation**:

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS runtime

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S mcpuser -u 1001

WORKDIR /app

# Copy dependencies and built application
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY build/ ./build/

# Set ownership
RUN chown -R mcpuser:nodejs /app
USER mcpuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["npm", "start"]
```

```json
// railway.json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build",
    "watchPatterns": ["src/**"]
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "environmentVariables": {
      "NODE_ENV": "production",
      "PORT": "3000"
    }
  }
}
```

**Deliverables**:
- Optimized Docker configuration
- Railway deployment configuration
- Health check implementation
- Environment variable setup

### 3.2 Environment and Secrets Management

**Timeline**: 1 day

**Tasks**:
- [ ] Configure production environment variables
- [ ] Set up secure HubSpot token storage
- [ ] Implement secrets rotation strategy
- [ ] Create environment validation

**Implementation**:

```typescript
// src/config/environment.ts
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.string().transform(Number).default('3000'),
  
  // Authentication
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().url(),
  JWT_AUDIENCE: z.string(),
  
  // HubSpot
  HUBSPOT_ACCESS_TOKEN: z.string().min(20),
  
  // Security
  CORS_ORIGIN: z.string(),
  RATE_LIMIT_MAX: z.string().transform(Number).default('1000'),
  
  // Session
  SESSION_MAX_AGE: z.string().transform(Number).default('1800000'),
  SESSION_CLEANUP_INTERVAL: z.string().transform(Number).default('300000')
});

export const config = environmentSchema.parse(process.env);

export const validateEnvironment = () => {
  try {
    environmentSchema.parse(process.env);
    console.log('Environment validation successful');
    return true;
  } catch (error) {
    console.error('Environment validation failed:', error.errors);
    return false;
  }
};
```

**Deliverables**:
- Environment validation system
- Secure secrets management setup
- Configuration documentation
- Railway environment configuration

### 3.3 Monitoring and Logging

**Timeline**: 1-2 days

**Tasks**:
- [ ] Implement structured logging
- [ ] Set up performance metrics collection
- [ ] Create monitoring dashboards
- [ ] Configure alerting rules

**Implementation**:

```typescript
// src/utils/logger.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['req.headers.authorization', 'hubspot_token']
});

export const createRequestLogger = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      logger.info({
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        userAgent: req.headers['user-agent'],
        sessionId: req.headers['mcp-session-id'],
        userId: req.auth?.userId
      }, 'HTTP Request');
    });
    
    next();
  };
};

// src/utils/metrics.ts
class MetricsCollector {
  private metrics = {
    requestCount: 0,
    errorCount: 0,
    averageResponseTime: 0,
    activeSessions: 0
  };

  incrementRequest() {
    this.metrics.requestCount++;
  }

  incrementError() {
    this.metrics.errorCount++;
  }

  recordResponseTime(duration: number) {
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime + duration) / 2;
  }

  setActiveSessions(count: number) {
    this.metrics.activeSessions = count;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

export const metrics = new MetricsCollector();
```

**Deliverables**:
- Structured logging system
- Performance metrics collection
- Health monitoring setup
- Error tracking and alerting

## Phase 4: Integration and Testing (Week 4)

### 4.1 BCP Integration Testing

**Timeline**: 2-3 days

**Tasks**:
- [ ] Test all existing BCP functionality over HTTP
- [ ] Verify tool parameter validation
- [ ] Test error handling and responses
- [ ] Validate session persistence across requests

**Implementation**:

```typescript
// tests/integration/bcp-integration.test.ts
describe('BCP Integration Tests', () => {
  let sessionId: string;

  beforeEach(async () => {
    // Initialize session
    const response = await request(app)
      .post('/mcp')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      });
    
    sessionId = response.headers['mcp-session-id'];
  });

  test('Company BCP - Create Operation', async () => {
    const response = await request(app)
      .post('/mcp')
      .set('Mcp-Session-Id', sessionId)
      .set('Authorization', 'Bearer test-token')
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'hubspotCompany',
          arguments: {
            operation: 'create',
            name: 'Test Company',
            domain: 'testcompany.com'
          }
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.result).toBeDefined();
    expect(response.body.result.success).toBe(true);
  });

  // Additional BCP tests for all domains...
});
```

**Deliverables**:
- Complete BCP integration test suite
- Performance benchmarks for each BCP
- Error handling verification
- Session management validation

### 4.2 Load Testing and Performance

**Timeline**: 1-2 days

**Tasks**:
- [ ] Implement load testing with Artillery.io
- [ ] Test concurrent session handling
- [ ] Validate memory usage under load
- [ ] Test auto-scaling behavior

**Implementation**:

```yaml
# load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100

scenarios:
  - name: "MCP Session Creation"
    weight: 30
    flow:
      - post:
          url: "/mcp"
          headers:
            Content-Type: "application/json"
          json:
            jsonrpc: "2.0"
            id: 1
            method: "initialize"
            params:
              protocolVersion: "2025-03-26"
              capabilities: {}
              clientInfo:
                name: "load-test"
                version: "1.0.0"
          capture:
            - header: "mcp-session-id"
              as: "sessionId"

  - name: "Tool Execution"
    weight: 70
    flow:
      - post:
          url: "/mcp"
          headers:
            Content-Type: "application/json"
            Mcp-Session-Id: "{{ sessionId }}"
          json:
            jsonrpc: "2.0"
            id: 2
            method: "tools/call"
            params:
              name: "hubspotCompany"
              arguments:
                operation: "search"
                query: "test"
```

**Deliverables**:
- Load testing configuration and results
- Performance benchmarks
- Scalability analysis
- Memory and CPU usage reports

### 4.3 Client Integration Testing

**Timeline**: 1-2 days

**Tasks**:
- [ ] Test Claude Desktop integration
- [ ] Verify Claude Phone app compatibility
- [ ] Test authentication flow end-to-end
- [ ] Validate real-world usage scenarios

**Deliverables**:
- Client integration test results
- Authentication flow validation
- Real-world usage scenarios
- Performance under production conditions

## Phase 5: Deployment and Monitoring (Week 5)

### 5.1 Production Deployment

**Timeline**: 1-2 days

**Tasks**:
- [ ] Deploy to Railway production environment
- [ ] Configure custom domain and SSL
- [ ] Set up production monitoring
- [ ] Implement backup and recovery procedures

**Implementation**:

```bash
# Railway deployment commands
railway login
railway link your-project-id
railway up --environment production

# Environment variable setup
railway variables set HUBSPOT_ACCESS_TOKEN="your-token" --environment production
railway variables set JWT_SECRET="your-secret" --environment production
railway variables set NODE_ENV="production" --environment production
```

**Deliverables**:
- Production deployment on Railway
- SSL certificate configuration
- Custom domain setup
- Monitoring dashboard configuration

### 5.2 Rollback Strategy

**Timeline**: 1 day

**Tasks**:
- [ ] Create rollback procedures
- [ ] Test rollback scenarios
- [ ] Document recovery processes
- [ ] Set up automated backup systems

**Implementation**:

```bash
# Rollback script
#!/bin/bash
echo "Starting rollback to previous version..."

# Get previous deployment
PREVIOUS_DEPLOYMENT=$(railway deployments list --limit 2 --json | jq -r '.[1].id')

# Rollback
railway rollback $PREVIOUS_DEPLOYMENT

# Verify health
curl -f https://your-domain.com/health || exit 1

echo "Rollback completed successfully"
```

**Deliverables**:
- Automated rollback procedures
- Recovery documentation
- Backup verification system
- Disaster recovery plan

### 5.3 Production Monitoring

**Timeline**: 1 day

**Tasks**:
- [ ] Set up alerting rules
- [ ] Configure error tracking
- [ ] Implement performance monitoring
- [ ] Create operational dashboards

**Deliverables**:
- Production monitoring setup
- Alerting configuration
- Performance dashboards
- Error tracking system

## Risk Mitigation Strategies

### High-Priority Risks

1. **Session State Loss**
   - **Risk**: Memory-based sessions lost during container restarts
   - **Mitigation**: Implement Redis-based session storage for production
   - **Timeline**: Add during Phase 3 if needed

2. **Authentication Bypass**
   - **Risk**: Security vulnerabilities in token validation
   - **Mitigation**: Comprehensive security testing and penetration testing
   - **Timeline**: Phase 2 completion gate

3. **Performance Degradation**
   - **Risk**: HTTP overhead causing unacceptable latency
   - **Mitigation**: Connection pooling, caching, and load testing
   - **Timeline**: Continuous monitoring during Phase 4

### Medium-Priority Risks

1. **Railway Platform Dependencies**
   - **Risk**: Platform-specific issues affecting deployment
   - **Mitigation**: Multi-environment testing and backup deployment options
   - **Timeline**: Phase 3 validation

2. **HubSpot API Rate Limits**
   - **Risk**: Increased API usage due to HTTP overhead
   - **Mitigation**: Enhanced request caching and rate limiting
   - **Timeline**: Monitor during Phase 4

### Low-Priority Risks

1. **Development Workflow Disruption**
   - **Risk**: Developers unable to use new HTTP version locally
   - **Mitigation**: Maintain parallel STDIO support during transition
   - **Timeline**: Remove after Phase 5 completion

## Quality Gates

### Phase Completion Criteria

Each phase must meet these criteria before proceeding:

**Phase 1 Completion**:
- [ ] HTTP server responds to basic MCP requests
- [ ] Session management working correctly
- [ ] All existing BCP tools accessible via HTTP
- [ ] Basic test suite passing

**Phase 2 Completion**:
- [ ] Authentication middleware fully functional
- [ ] Rate limiting effective against abuse
- [ ] Security testing passed
- [ ] No critical security vulnerabilities

**Phase 3 Completion**:
- [ ] Successful deployment to Railway staging
- [ ] All environment variables properly configured
- [ ] Health checks responding correctly
- [ ] Monitoring and logging functional

**Phase 4 Completion**:
- [ ] All BCP integration tests passing
- [ ] Load testing results within acceptable limits
- [ ] Client integration verified
- [ ] Performance benchmarks met

**Phase 5 Completion**:
- [ ] Production deployment successful
- [ ] Monitoring and alerting operational
- [ ] Rollback procedures tested
- [ ] Documentation complete

## Success Metrics

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Response Time | < 200ms (p95) | Load testing |
| Throughput | 1000 req/min | Artillery testing |
| Uptime | 99.9% | Railway monitoring |
| Error Rate | < 0.1% | Application logs |
| Memory Usage | < 512MB | Railway dashboard |

### Functional Targets

| Feature | Target | Verification |
|---------|--------|--------------|
| BCP Compatibility | 100% | Integration testing |
| Authentication | Zero bypasses | Security testing |
| Session Management | No data loss | Stress testing |
| Client Integration | Full compatibility | Manual testing |
| Documentation | Complete coverage | Review process |

This implementation plan provides a comprehensive, risk-aware approach to migrating the HubSpot MCP server to Railway while maintaining system reliability and ensuring production readiness.