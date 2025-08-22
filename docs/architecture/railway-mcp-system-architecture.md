# Railway MCP System Architecture

## Executive Summary

This document defines the comprehensive system architecture for migrating the HubSpot MCP server from STDIO transport to HTTP deployment on Railway. The architecture maintains the existing BCP (Bounded Context Packs) structure while introducing HTTP Streamable transport, authentication, session management, and cloud-native deployment patterns.

## High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Desktop/Phone Apps                    │
│                     (MCP Protocol Clients)                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTPS/WSS
                      │ Bearer Token Auth
                      │ MCP Protocol
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Railway Platform                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                Load Balancer / CDN                       │  │
│  │           (Auto-scaling, SSL Termination)                │  │
│  └─────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│  ┌─────────────────────▼─────────────────────────────────────┐  │
│  │              HubSpot MCP HTTP Server                     │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │            Express.js Application                   │ │  │
│  │  │                                                     │ │  │
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │ │  │
│  │  │  │   Auth      │  │   Session    │  │   Rate      │ │ │  │
│  │  │  │ Middleware  │  │  Manager     │  │  Limiter    │ │ │  │
│  │  │  └─────────────┘  └──────────────┘  └─────────────┘ │ │  │
│  │  │                                                     │ │  │
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │ │  │
│  │  │  │    MCP      │  │   Health     │  │   Metrics   │ │ │  │
│  │  │  │  Endpoint   │  │   Check      │  │ Collection  │ │ │  │
│  │  │  │  /mcp       │  │  /health     │  │             │ │ │  │
│  │  │  └─────────────┘  └──────────────┘  └─────────────┘ │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │           HubspotBCPServer (Core)                   │ │  │
│  │  │                                                     │ │  │
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │ │  │
│  │  │  │ Companies   │  │   Contacts   │  │    Deals    │ │ │  │
│  │  │  │    BCP      │  │     BCP      │  │     BCP     │ │ │  │
│  │  │  └─────────────┘  └──────────────┘  └─────────────┘ │ │  │
│  │  │                                                     │ │  │
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │ │  │
│  │  │  │    Notes    │  │   Tickets    │  │   Emails    │ │ │  │
│  │  │  │     BCP     │  │     BCP      │  │     BCP     │ │ │  │
│  │  │  └─────────────┘  └──────────────┘  └─────────────┘ │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │           HubSpot API Client                        │ │  │
│  │  │         (Rate Limited, Cached)                      │ │  │
│  │  └─────────────────────┬───────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS API Calls
                          │ OAuth 2.0 Bearer Token
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HubSpot API Platform                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   Companies     │ │    Contacts     │ │     Deals       │   │
│  │      API        │ │       API       │ │      API        │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │     Notes       │ │    Tickets      │ │     Emails      │   │
│  │      API        │ │       API       │ │      API        │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Transport Layer

#### Current State (STDIO)
```typescript
// Current STDIO Implementation
const transport = new StdioServerTransport();
await server.connect(transport);
```

#### Target State (HTTP Streamable)
```typescript
// HTTP Streamable Implementation
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const sessions = new Map<string, SessionContext>();

app.all('/mcp', async (req, res) => {
  const sessionId = extractSessionId(req);
  const session = getOrCreateSession(sessionId);
  
  if (req.method === 'POST') {
    const response = await session.transport.handleRequest(req.body);
    res.json(response);
  } else if (req.method === 'GET') {
    // Handle Server-Sent Events for notifications
    session.transport.handleSSE(res);
  }
});
```

### 2. Authentication Layer

#### Bearer Token Authentication
```typescript
interface AuthContext {
  userId: string;
  permissions: string[];
  tokenExp: number;
  sessionId: string;
}

const authenticateBearer = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractBearerToken(req);
  const authContext = await validateToken(token);
  
  req.auth = authContext;
  next();
};
```

#### Permission System
```typescript
enum Permissions {
  MCP_READ = 'mcp:read',
  MCP_WRITE = 'mcp:write',
  HUBSPOT_READ = 'hubspot:read',
  HUBSPOT_WRITE = 'hubspot:write',
  HUBSPOT_DELETE = 'hubspot:delete'
}

const checkPermission = (required: Permissions) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth.permissions.includes(required)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
```

### 3. Session Management

#### Session Context
```typescript
interface SessionContext {
  id: string;
  transport: StreamableHTTPServerTransport;
  auth: AuthContext;
  created: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
}

class SessionManager {
  private sessions = new Map<string, SessionContext>();
  
  createSession(sessionId: string, auth: AuthContext): SessionContext {
    const session: SessionContext = {
      id: sessionId,
      transport: new StreamableHTTPServerTransport(),
      auth,
      created: new Date(),
      lastActivity: new Date(),
      metadata: {}
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }
  
  getSession(sessionId: string): SessionContext | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
    return session;
  }
  
  cleanup(): void {
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();
    
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > maxAge) {
        session.transport.close();
        this.sessions.delete(id);
      }
    }
  }
}
```

### 4. BCP Architecture (Unchanged)

The existing BCP structure remains intact:

```typescript
// Existing BCP Structure (No Changes Required)
interface BCP {
  name: string;
  version: string;
  tools: Tool[];
  services: Service[];
}

// Each BCP maintains its current structure:
// - src/bcps/Companies/
//   - index.ts (BCP definition)
//   - companies.service.ts (HubSpot API integration)
//   - companies.tool.ts (MCP tool definitions)
```

## Data Flow Diagrams

### 1. Client Authentication Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │   Railway   │    │     MCP     │    │    Auth     │
│ Application │    │     LB      │    │   Server    │    │  Service    │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │                  │
       │ 1. POST /mcp     │                  │                  │
       │ Bearer: token    │                  │                  │
       ├─────────────────▶│                  │                  │
       │                  │ 2. Forward       │                  │
       │                  │ with headers     │                  │
       │                  ├─────────────────▶│                  │
       │                  │                  │ 3. Validate      │
       │                  │                  │ Bearer Token     │
       │                  │                  ├─────────────────▶│
       │                  │                  │ 4. Auth Context  │
       │                  │                  │ + Permissions    │
       │                  │                  │◀─────────────────┤
       │                  │                  │ 5. Create/Get    │
       │                  │                  │ MCP Session      │
       │                  │                  │                  │
       │                  │ 6. MCP Response  │                  │
       │                  │ + Session ID     │                  │
       │                  │◀─────────────────┤                  │
       │ 7. Response      │                  │                  │
       │ with Session ID  │                  │                  │
       │◀─────────────────┤                  │                  │
```

### 2. Tool Execution Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │     MCP     │    │     BCP     │    │   HubSpot   │
│             │    │   Server    │    │   Service   │    │     API     │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │                  │
       │ 1. tools/call    │                  │                  │
       │ hubspotCompany   │                  │                  │
       ├─────────────────▶│                  │                  │
       │                  │ 2. Validate      │                  │
       │                  │ Permissions      │                  │
       │                  │                  │                  │
       │                  │ 3. Route to      │                  │
       │                  │ Company BCP      │                  │
       │                  ├─────────────────▶│                  │
       │                  │                  │ 4. HubSpot API   │
       │                  │                  │ Call             │
       │                  │                  ├─────────────────▶│
       │                  │                  │ 5. API Response  │
       │                  │                  │◀─────────────────┤
       │                  │ 6. Formatted     │                  │
       │                  │ MCP Response     │                  │
       │                  │◀─────────────────┤                  │
       │ 7. Tool Result   │                  │                  │
       │◀─────────────────┤                  │                  │
```

### 3. Session Lifecycle Flow

```
┌─────────────┐
│   Client    │
│ Connection  │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Generate   │     │   Create    │     │   Store     │
│ Session ID  │────▶│   Session   │────▶│  Context    │
└─────────────┘     │  Transport  │     └─────────────┘
                    └─────────────┘
                           │
                           ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Handle    │◀────│    Route    │◀────│   Process   │
│  Response   │     │   Request   │     │   Request   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                     ▲
       ▼                     │
┌─────────────┐     ┌─────────────┐
│   Update    │     │   Session   │
│  Activity   │────▶│   Active    │
│ Timestamp   │     └─────────────┘
└─────────────┘
       │
       ▼
┌─────────────┐
│   Session   │
│  Cleanup    │
│ (30min TTL) │
└─────────────┘
```

## Security Architecture

### 1. Defense in Depth

```
┌─────────────────────────────────────────────────────────────┐
│                     Security Layers                        │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Railway Platform Security                         │
│   - SSL/TLS Termination                                     │
│   - DDoS Protection                                         │
│   - Network Isolation                                       │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Application Security                              │
│   - Bearer Token Authentication                            │
│   - Request/Response Validation                            │
│   - CORS Configuration                                      │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: API Security                                      │
│   - Rate Limiting (per session/IP)                         │
│   - Input Sanitization                                     │
│   - Permission-based Access Control                        │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Data Security                                     │
│   - Environment Variable Encryption                        │
│   - HubSpot Token Secure Storage                          │
│   - Audit Logging                                          │
└─────────────────────────────────────────────────────────────┘
```

### 2. Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Unauthorized Access | High | High | Bearer token validation, RBAC |
| Token Leakage | Medium | High | Environment encryption, rotation |
| DoS Attacks | Medium | Medium | Rate limiting, Railway auto-scaling |
| Data Injection | Low | High | Input validation, sanitization |
| Session Hijacking | Low | Medium | Secure session management, HTTPS |

### 3. Authentication Flow

```typescript
interface SecurityConfig {
  tokenValidation: {
    algorithm: 'RS256';
    issuer: string;
    audience: string;
    leeway: number; // seconds
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  session: {
    maxAge: number; // milliseconds
    cleanupInterval: number; // milliseconds
  };
}
```

## Deployment Architecture

### 1. Railway Configuration

```yaml
# railway.json
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
    "healthcheckTimeout": 30
  },
  "environments": {
    "production": {
      "variables": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    },
    "staging": {
      "variables": {
        "NODE_ENV": "staging",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### 2. Container Architecture

```dockerfile
# Multi-stage build for optimal size
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS runtime
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY build/ ./build/

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["npm", "start"]
```

### 3. Environment Management

```bash
# Production Environment Variables
NODE_ENV=production
PORT=3000

# Authentication
JWT_SECRET=your-jwt-secret
JWT_ISSUER=https://your-auth-server.com
JWT_AUDIENCE=hubspot-mcp-server

# HubSpot Integration
HUBSPOT_ACCESS_TOKEN=${{Vault.HUBSPOT_ACCESS_TOKEN}}

# Security
CORS_ORIGIN=https://claude.ai,https://cursor.sh
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW_MS=900000

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true

# Session Management
SESSION_MAX_AGE=1800000
SESSION_CLEANUP_INTERVAL=300000
```

## Technology Stack

### Core Platform
- **Runtime**: Node.js 18+ (Railway auto-detection)
- **Framework**: Express.js 4.18+
- **MCP SDK**: @modelcontextprotocol/sdk v1.9.0
- **Transport**: StreamableHTTPServerTransport

### Security & Authentication
- **JWT**: jsonwebtoken + jwks-rsa
- **Rate Limiting**: express-rate-limit + rate-limit-redis
- **Input Validation**: zod + express-validator
- **CORS**: cors middleware

### Monitoring & Observability
- **Logging**: pino (structured JSON logging)
- **Metrics**: prometheus-client
- **Health Checks**: express-health-check
- **Error Tracking**: Built-in error handling

### Development & Deployment
- **Build**: TypeScript compiler
- **Container**: Docker (Railway Nixpacks)
- **CI/CD**: Railway auto-deployment
- **Testing**: Jest + supertest

## Performance Considerations

### 1. Scalability Targets

| Metric | Target | Monitoring |
|--------|--------|------------|
| Response Time | < 200ms p95 | Health checks |
| Throughput | 1000 req/min | Rate limiting logs |
| Concurrent Sessions | 100+ | Session manager metrics |
| Memory Usage | < 512MB | Railway dashboard |
| CPU Usage | < 70% | Railway auto-scaling |

### 2. Optimization Strategies

#### Caching Layer
```typescript
interface CacheConfig {
  hubspotData: {
    ttl: 300; // 5 minutes
    maxSize: 1000; // entries
  };
  sessionData: {
    ttl: 1800; // 30 minutes
    persistence: 'memory'; // or 'redis'
  };
}
```

#### Connection Pooling
```typescript
// HubSpot API client with connection pooling
const hubspotClient = new HubspotApiClient({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
  retryDelayMillis: 5000,
  numberOfApiCallRetries: 3,
  numberOfRetries: 3
});
```

### 3. Auto-scaling Configuration

Railway's auto-scaling will handle:
- **Horizontal Scaling**: Multiple container instances
- **Vertical Scaling**: Resource allocation per container
- **Scale-to-Zero**: Cost optimization during low usage
- **Cold Start Optimization**: Fast container initialization

## Risk Assessment

### High-Risk Areas

1. **Session State Management**
   - Risk: Memory leaks from uncleaned sessions
   - Mitigation: Automated cleanup with configurable TTL

2. **Authentication Token Validation**
   - Risk: Performance impact of JWT verification
   - Mitigation: Token caching and efficient JWKS fetching

3. **HubSpot API Rate Limits**
   - Risk: Exceeding HubSpot's rate limits
   - Mitigation: Request queuing and exponential backoff

### Medium-Risk Areas

1. **Container Resource Limits**
   - Risk: Memory/CPU exhaustion under load
   - Mitigation: Railway's auto-scaling and resource monitoring

2. **Network Latency**
   - Risk: Increased latency compared to STDIO
   - Mitigation: Connection pooling and response caching

### Low-Risk Areas

1. **BCP Compatibility**
   - Risk: Existing tools breaking during migration
   - Mitigation: BCP architecture remains unchanged

2. **Development Workflow**
   - Risk: Disruption to existing development patterns
   - Mitigation: Backward-compatible local development setup

This architecture provides a robust foundation for migrating the HubSpot MCP server to Railway while maintaining security, performance, and scalability requirements.