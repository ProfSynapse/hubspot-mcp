# Technical Specifications: Railway MCP HTTP Deployment

## Executive Summary

This document provides detailed technical specifications for implementing HTTP transport, authentication, session management, and Railway deployment for the HubSpot MCP server. All specifications include code examples, configuration templates, and implementation guidelines to ensure consistent development practices.

## MCP HTTP Transport Specifications

### 1. Protocol Implementation

#### 1.1 HTTP Streamable Transport

**Specification**: Implementation must use MCP SDK v1.9.0+ with StreamableHTTPServerTransport

```typescript
// Required Transport Implementation
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface TransportConfig {
  maxRequestSize: number;          // 10MB default
  sessionTimeout: number;          // 30 minutes default
  compressionEnabled: boolean;     // true for production
  keepAlive: boolean;             // true for production
}

class MCPTransportManager {
  private sessions = new Map<string, SessionTransport>();
  
  constructor(private config: TransportConfig) {}
  
  async createTransport(sessionId: string): Promise<StreamableHTTPServerTransport> {
    const transport = new StreamableHTTPServerTransport({
      maxRequestSize: this.config.maxRequestSize,
      compression: this.config.compressionEnabled
    });
    
    return transport;
  }
}
```

#### 1.2 Protocol Message Handling

**Request Format Validation**:
```typescript
import { z } from 'zod';

const MCPRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  method: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_/]*$/),
  params: z.any().optional()
});

const MCPResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  result: z.any().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.any().optional()
  }).optional()
});
```

**Error Code Specifications**:
```typescript
enum MCPErrorCodes {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  
  // Custom error codes
  AUTHENTICATION_FAILED = -32001,
  AUTHORIZATION_FAILED = -32002,
  INSUFFICIENT_PERMISSIONS = -32003,
  RATE_LIMIT_EXCEEDED = -32000,
  SESSION_INVALID = -32004
}
```

### 2. Endpoint Specifications

#### 2.1 MCP Protocol Endpoint

**Path**: `/mcp`
**Methods**: `POST`, `GET`
**Headers**: 
- `Content-Type: application/json` (POST)
- `Authorization: Bearer <token>` (required)
- `Mcp-Session-Id: <uuid>` (optional, generated if not provided)

```typescript
// Endpoint Implementation Specification
app.all('/mcp', [
  authenticate,
  validateMCPRequest,
  rateLimit,
  sessionManager.middleware
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string || 
                     res.locals.sessionId;
    
    res.setHeader('Mcp-Session-Id', sessionId);
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'POST') {
      await handleMCPRequest(req, res, sessionId);
    } else if (req.method === 'GET') {
      await handleMCPStream(req, res, sessionId);
    }
  } catch (error) {
    handleMCPError(error, req, res);
  }
});
```

#### 2.2 Health Check Endpoint

**Path**: `/health`
**Method**: `GET`
**Response Format**:

```typescript
interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  memory: {
    used: number;
    free: number;
    total: number;
  };
  sessions: {
    total: number;
    active: number;
  };
  dependencies: {
    hubspot: 'healthy' | 'unhealthy';
    auth: 'healthy' | 'unhealthy';
  };
}

// Implementation
app.get('/health', async (req: Request, res: Response) => {
  const health: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: {
      used: process.memoryUsage().heapUsed,
      free: process.memoryUsage().heapTotal - process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal
    },
    sessions: sessionManager.getStats(),
    dependencies: await checkDependencies()
  };
  
  res.json(health);
});
```

#### 2.3 Metrics Endpoint

**Path**: `/metrics`
**Method**: `GET`
**Format**: Prometheus format

```typescript
app.get('/metrics', (req: Request, res: Response) => {
  const metrics = `
# HELP mcp_requests_total Total number of MCP requests
# TYPE mcp_requests_total counter
mcp_requests_total{method="initialize"} ${metricsCollector.getCounter('initialize')}
mcp_requests_total{method="tools/call"} ${metricsCollector.getCounter('tools_call')}

# HELP mcp_request_duration_seconds Request duration in seconds
# TYPE mcp_request_duration_seconds histogram
mcp_request_duration_seconds_bucket{le="0.1"} ${metricsCollector.getHistogram('duration', 0.1)}
mcp_request_duration_seconds_bucket{le="0.5"} ${metricsCollector.getHistogram('duration', 0.5)}
mcp_request_duration_seconds_bucket{le="1.0"} ${metricsCollector.getHistogram('duration', 1.0)}

# HELP mcp_sessions_active Number of active sessions
# TYPE mcp_sessions_active gauge
mcp_sessions_active ${sessionManager.getActiveCount()}
`;
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});
```

## Authentication Specifications

### 1. JWT Token Requirements

#### 1.1 Token Structure

```typescript
interface JWTPayload {
  iss: string;                    // Issuer (auth server URL)
  aud: string;                    // Audience (hubspot-mcp-server)
  sub: string;                    // Subject (user ID)
  exp: number;                    // Expiration timestamp
  iat: number;                    // Issued at timestamp
  jti: string;                    // JWT ID (unique token identifier)
  
  // Custom claims
  permissions: string[];          // Array of permission strings
  role: string;                   // User role
  sessionId?: string;             // Optional session correlation
}
```

#### 1.2 Token Validation Middleware

```typescript
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

interface AuthConfig {
  jwksUri: string;
  issuer: string;
  audience: string;
  algorithms: string[];
  cacheTTL: number;               // JWKS cache TTL in seconds
}

class JWTAuthenticator {
  private client: jwksClient.JwksClient;
  
  constructor(private config: AuthConfig) {
    this.client = jwksClient({
      jwksUri: config.jwksUri,
      cache: true,
      cacheMaxAge: config.cacheTTL * 1000,
      cacheMaxEntries: 5,
      rateLimit: true,
      jwksRequestsPerMinute: 5
    });
  }
  
  private getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
    this.client.getSigningKey(header.kid!, (err, key) => {
      if (err) {
        callback(err);
        return;
      }
      const signingKey = key!.getPublicKey();
      callback(null, signingKey);
    });
  };
  
  async verifyToken(token: string): Promise<JWTPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        this.getKey,
        {
          issuer: this.config.issuer,
          audience: this.config.audience,
          algorithms: this.config.algorithms as jwt.Algorithm[]
        },
        (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded as JWTPayload);
          }
        }
      );
    });
  }
}
```

### 2. Permission System

#### 2.1 Permission Definitions

```typescript
enum MCPPermissions {
  // Core MCP operations
  MCP_INITIALIZE = 'mcp:initialize',
  MCP_LIST_TOOLS = 'mcp:list_tools',
  MCP_CALL_TOOLS = 'mcp:call_tools',
  MCP_LIST_RESOURCES = 'mcp:list_resources',
  MCP_READ_RESOURCES = 'mcp:read_resources',
  
  // HubSpot specific permissions
  HUBSPOT_READ = 'hubspot:read',
  HUBSPOT_WRITE = 'hubspot:write',
  HUBSPOT_DELETE = 'hubspot:delete',
  
  // Domain-specific permissions
  COMPANIES_READ = 'companies:read',
  COMPANIES_WRITE = 'companies:write',
  CONTACTS_READ = 'contacts:read',
  CONTACTS_WRITE = 'contacts:write',
  DEALS_READ = 'deals:read',
  DEALS_WRITE = 'deals:write',
  
  // Administrative permissions
  ADMIN_METRICS = 'admin:metrics',
  ADMIN_HEALTH = 'admin:health',
  ADMIN_SESSIONS = 'admin:sessions'
}

interface PermissionRule {
  permission: MCPPermissions;
  description: string;
  implies?: MCPPermissions[];       // Permissions that this one implies
  conflicts?: MCPPermissions[];     // Mutually exclusive permissions
}

const permissionRules: PermissionRule[] = [
  {
    permission: MCPPermissions.HUBSPOT_WRITE,
    description: 'Write access to HubSpot resources',
    implies: [MCPPermissions.HUBSPOT_READ]
  },
  {
    permission: MCPPermissions.HUBSPOT_DELETE,
    description: 'Delete access to HubSpot resources',
    implies: [MCPPermissions.HUBSPOT_READ, MCPPermissions.HUBSPOT_WRITE]
  }
];
```

#### 2.2 Permission Validation

```typescript
class PermissionValidator {
  constructor(private rules: PermissionRule[]) {}
  
  hasPermission(userPermissions: string[], required: MCPPermissions): boolean {
    // Direct permission check
    if (userPermissions.includes(required)) {
      return true;
    }
    
    // Check for implied permissions
    return this.rules.some(rule => 
      userPermissions.includes(rule.permission) &&
      rule.implies?.includes(required)
    );
  }
  
  validateToolPermission(userPermissions: string[], toolName: string, operation: string): boolean {
    const permissionMap = {
      'hubspotCompany': {
        'get': MCPPermissions.COMPANIES_READ,
        'search': MCPPermissions.COMPANIES_READ,
        'create': MCPPermissions.COMPANIES_WRITE,
        'update': MCPPermissions.COMPANIES_WRITE,
        'delete': MCPPermissions.HUBSPOT_DELETE
      },
      'hubspotContact': {
        'get': MCPPermissions.CONTACTS_READ,
        'search': MCPPermissions.CONTACTS_READ,
        'create': MCPPermissions.CONTACTS_WRITE,
        'update': MCPPermissions.CONTACTS_WRITE,
        'delete': MCPPermissions.HUBSPOT_DELETE
      }
    };
    
    const requiredPermission = permissionMap[toolName]?.[operation];
    if (!requiredPermission) {
      return false;
    }
    
    return this.hasPermission(userPermissions, requiredPermission);
  }
}
```

## Session Management Specifications

### 1. Session Architecture

#### 1.1 Session Context Definition

```typescript
interface SessionContext {
  id: string;                     // Unique session identifier
  transport: StreamableHTTPServerTransport;
  auth: JWTPayload;              // Authentication context
  created: Date;                 // Session creation timestamp
  lastActivity: Date;            // Last activity timestamp
  metadata: SessionMetadata;     // Additional session data
  state: SessionState;           // Current session state
}

interface SessionMetadata {
  userAgent?: string;
  clientIP?: string;
  clientInfo?: {
    name: string;
    version: string;
  };
  protocolVersion?: string;
  capabilities?: any;
}

enum SessionState {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  IDLE = 'idle',
  EXPIRED = 'expired',
  TERMINATED = 'terminated'
}
```

#### 1.2 Session Manager Implementation

```typescript
interface SessionConfig {
  maxAge: number;                // Session TTL in milliseconds
  cleanupInterval: number;       // Cleanup interval in milliseconds
  maxSessions: number;          // Maximum concurrent sessions
  idleTimeout: number;          // Idle timeout in milliseconds
}

class SessionManager {
  private sessions = new Map<string, SessionContext>();
  private cleanupTimer: NodeJS.Timeout;
  
  constructor(private config: SessionConfig) {
    this.startCleanup();
  }
  
  createSession(auth: JWTPayload, metadata: Partial<SessionMetadata> = {}): SessionContext {
    if (this.sessions.size >= this.config.maxSessions) {
      throw new Error('Maximum session limit reached');
    }
    
    const sessionId = this.generateSessionId();
    const now = new Date();
    
    const session: SessionContext = {
      id: sessionId,
      transport: new StreamableHTTPServerTransport(),
      auth,
      created: now,
      lastActivity: now,
      metadata: {
        ...metadata,
        protocolVersion: '2025-03-26'
      },
      state: SessionState.INITIALIZING
    };
    
    this.sessions.set(sessionId, session);
    
    // Log session creation
    console.log(`Session created: ${sessionId} for user ${auth.sub}`);
    
    return session;
  }
  
  getSession(sessionId: string): SessionContext | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    // Check if session is expired
    if (this.isExpired(session)) {
      this.terminateSession(sessionId);
      return null;
    }
    
    // Update activity timestamp
    session.lastActivity = new Date();
    session.state = SessionState.ACTIVE;
    
    return session;
  }
  
  terminateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    try {
      session.transport.close();
      session.state = SessionState.TERMINATED;
    } catch (error) {
      console.warn(`Error closing transport for session ${sessionId}:`, error);
    }
    
    this.sessions.delete(sessionId);
    console.log(`Session terminated: ${sessionId}`);
    return true;
  }
  
  private generateSessionId(): string {
    return require('crypto').randomUUID();
  }
  
  private isExpired(session: SessionContext): boolean {
    const now = Date.now();
    const maxAge = this.config.maxAge;
    const idleTimeout = this.config.idleTimeout;
    
    return (
      now - session.created.getTime() > maxAge ||
      now - session.lastActivity.getTime() > idleTimeout
    );
  }
  
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }
  
  private cleanup(): void {
    const expiredSessions: string[] = [];
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (this.isExpired(session)) {
        expiredSessions.push(sessionId);
      }
    }
    
    expiredSessions.forEach(sessionId => {
      this.terminateSession(sessionId);
    });
    
    if (expiredSessions.length > 0) {
      console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }
  
  getStats() {
    const states = Object.values(SessionState);
    const stats = {
      total: this.sessions.size,
      byState: {} as Record<SessionState, number>
    };
    
    states.forEach(state => {
      stats.byState[state] = Array.from(this.sessions.values())
        .filter(s => s.state === state).length;
    });
    
    return stats;
  }
}
```

### 2. Session Middleware

```typescript
interface SessionMiddlewareConfig {
  sessionManager: SessionManager;
  authenticator: JWTAuthenticator;
  requiredPermissions: MCPPermissions[];
}

const createSessionMiddleware = (config: SessionMiddlewareConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract session ID from headers or generate new one
      let sessionId = req.headers['mcp-session-id'] as string;
      let session: SessionContext | null = null;
      
      if (sessionId) {
        session = config.sessionManager.getSession(sessionId);
      }
      
      // If no valid session exists, create a new one
      if (!session) {
        const token = extractBearerToken(req);
        if (!token) {
          return res.status(401).json({
            jsonrpc: '2.0',
            error: {
              code: MCPErrorCodes.AUTHENTICATION_FAILED,
              message: 'Missing authentication token'
            }
          });
        }
        
        const auth = await config.authenticator.verifyToken(token);
        
        // Check required permissions
        const hasPermissions = config.requiredPermissions.every(
          perm => auth.permissions.includes(perm)
        );
        
        if (!hasPermissions) {
          return res.status(403).json({
            jsonrpc: '2.0',
            error: {
              code: MCPErrorCodes.INSUFFICIENT_PERMISSIONS,
              message: 'Insufficient permissions'
            }
          });
        }
        
        session = config.sessionManager.createSession(auth, {
          userAgent: req.headers['user-agent'],
          clientIP: req.ip
        });
        
        sessionId = session.id;
      }
      
      // Set session ID in response header
      res.setHeader('Mcp-Session-Id', sessionId);
      
      // Attach session to request
      req.session = session;
      req.auth = session.auth;
      
      next();
    } catch (error) {
      console.error('Session middleware error:', error);
      return res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: MCPErrorCodes.INTERNAL_ERROR,
          message: 'Session management error'
        }
      });
    }
  };
};
```

## API Endpoint Specifications

### 1. Request/Response Formats

#### 1.1 MCP Initialize Request

```typescript
interface InitializeRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'initialize';
  params: {
    protocolVersion: '2025-03-26';
    capabilities: {
      roots?: {
        listChanged?: boolean;
      };
      sampling?: {};
    };
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

interface InitializeResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    protocolVersion: '2025-03-26';
    capabilities: {
      logging?: {};
      tools?: {
        listChanged?: boolean;
      };
      resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
      };
      prompts?: {
        listChanged?: boolean;
      };
    };
    serverInfo: {
      name: 'hubspot-mcp';
      version: string;
    };
  };
}
```

#### 1.2 Tool Call Request

```typescript
interface ToolCallRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'tools/call';
  params: {
    name: string;                 // Tool name (e.g., 'hubspotCompany')
    arguments: Record<string, any>; // Tool-specific arguments
  };
}

interface ToolCallResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    content: Array<{
      type: 'text' | 'resource';
      text?: string;
      resource?: string;
    }>;
    isError?: boolean;
  };
}
```

### 2. Error Response Specifications

```typescript
interface MCPErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;                 // Error code from MCPErrorCodes
    message: string;              // Human-readable error message
    data?: {                      // Optional additional error data
      type?: string;              // Error type classification
      details?: any;              // Implementation-specific details
      timestamp?: string;         // ISO timestamp
      traceId?: string;           // Request correlation ID
    };
  };
}

// Error handler implementation
const handleMCPError = (error: Error, req: Request, res: Response) => {
  let code = MCPErrorCodes.INTERNAL_ERROR;
  let message = 'Internal server error';
  
  if (error instanceof ValidationError) {
    code = MCPErrorCodes.INVALID_PARAMS;
    message = error.message;
  } else if (error instanceof AuthenticationError) {
    code = MCPErrorCodes.AUTHENTICATION_FAILED;
    message = 'Authentication failed';
  } else if (error instanceof AuthorizationError) {
    code = MCPErrorCodes.AUTHORIZATION_FAILED;
    message = 'Authorization failed';
  }
  
  const errorResponse: MCPErrorResponse = {
    jsonrpc: '2.0',
    id: req.body?.id || null,
    error: {
      code,
      message,
      data: {
        type: error.constructor.name,
        timestamp: new Date().toISOString(),
        traceId: req.headers['x-trace-id'] as string
      }
    }
  };
  
  res.status(getHttpStatusFromMCPError(code)).json(errorResponse);
};
```

## Environment Variable Specifications

### 1. Required Environment Variables

```typescript
interface EnvironmentConfig {
  // Server Configuration
  NODE_ENV: 'development' | 'staging' | 'production';
  PORT: number;                   // Default: 3000
  HOST?: string;                  // Default: '0.0.0.0'
  
  // Authentication
  JWT_SECRET?: string;            // For HMAC algorithms
  JWT_ISSUER: string;             // Token issuer URL
  JWT_AUDIENCE: string;           // Token audience
  JWKS_URI: string;              // JWKS endpoint URL
  JWKS_CACHE_TTL: number;        // JWKS cache TTL (seconds)
  
  // HubSpot Integration
  HUBSPOT_ACCESS_TOKEN: string;   // HubSpot private app token
  HUBSPOT_API_BASE_URL?: string; // Default: 'https://api.hubapi.com'
  HUBSPOT_RATE_LIMIT?: number;   // Requests per second
  
  // Security
  CORS_ORIGIN: string;           // Comma-separated allowed origins
  RATE_LIMIT_WINDOW_MS: number;  // Rate limit window
  RATE_LIMIT_MAX: number;        // Max requests per window
  SESSION_MAX_AGE: number;       // Session TTL (milliseconds)
  SESSION_CLEANUP_INTERVAL: number; // Cleanup interval (milliseconds)
  
  // Monitoring
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  METRICS_ENABLED: boolean;
  HEALTH_CHECK_ENABLED: boolean;
  
  // Redis (Optional for production session storage)
  REDIS_URL?: string;
  REDIS_SESSION_PREFIX?: string; // Default: 'mcp:session:'
}
```

### 2. Environment Validation

```typescript
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().optional().default('0.0.0.0'),
  
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ISSUER: z.string().url(),
  JWT_AUDIENCE: z.string().min(1),
  JWKS_URI: z.string().url(),
  JWKS_CACHE_TTL: z.string().transform(Number).default('3600'),
  
  HUBSPOT_ACCESS_TOKEN: z.string().min(20),
  HUBSPOT_API_BASE_URL: z.string().url().optional().default('https://api.hubapi.com'),
  HUBSPOT_RATE_LIMIT: z.string().transform(Number).optional().default('10'),
  
  CORS_ORIGIN: z.string(),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('1000'),
  SESSION_MAX_AGE: z.string().transform(Number).default('1800000'),
  SESSION_CLEANUP_INTERVAL: z.string().transform(Number).default('300000'),
  
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  METRICS_ENABLED: z.string().transform(v => v === 'true').default('true'),
  HEALTH_CHECK_ENABLED: z.string().transform(v => v === 'true').default('true'),
  
  REDIS_URL: z.string().url().optional(),
  REDIS_SESSION_PREFIX: z.string().optional().default('mcp:session:')
});

export const validateEnvironment = (): EnvironmentConfig => {
  try {
    return environmentSchema.parse(process.env);
  } catch (error) {
    console.error('Environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
};
```

### 3. Railway Environment Setup

```bash
# Production Environment Variables
railway variables set NODE_ENV="production"
railway variables set PORT="3000"

# Authentication (use Railway's sealed variables for secrets)
railway variables set JWT_SECRET="$(openssl rand -base64 32)"
railway variables set JWT_ISSUER="https://your-auth-server.com"
railway variables set JWT_AUDIENCE="hubspot-mcp-server"
railway variables set JWKS_URI="https://your-auth-server.com/.well-known/jwks.json"

# HubSpot (sealed variable)
railway variables set HUBSPOT_ACCESS_TOKEN="your-hubspot-token" --sealed

# Security
railway variables set CORS_ORIGIN="https://claude.ai,https://cursor.sh"
railway variables set RATE_LIMIT_MAX="1000"
railway variables set SESSION_MAX_AGE="1800000"

# Monitoring
railway variables set LOG_LEVEL="info"
railway variables set METRICS_ENABLED="true"
```

## Data Schemas and Validation

### 1. BCP Tool Parameter Schemas

```typescript
// Company BCP Schema
const CompanyOperationSchema = z.object({
  operation: z.enum(['get', 'create', 'update', 'delete', 'search']),
  id: z.string().optional(),
  name: z.string().optional(),
  domain: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  industry: z.string().optional(),
  description: z.string().optional(),
  website: z.string().url().optional(),
  numberOfEmployees: z.number().optional(),
  annualRevenue: z.number().optional(),
  query: z.string().optional(),
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0),
  properties: z.array(z.string()).optional()
});

// Contact BCP Schema
const ContactOperationSchema = z.object({
  operation: z.enum(['get', 'create', 'update', 'delete', 'search']),
  id: z.string().optional(),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  website: z.string().url().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0),
  properties: z.array(z.string()).optional()
});

// Deal BCP Schema
const DealOperationSchema = z.object({
  operation: z.enum(['get', 'create', 'update', 'delete', 'search']),
  id: z.string().optional(),
  dealName: z.string().optional(),
  amount: z.number().optional(),
  dealStage: z.string().optional(),
  pipeline: z.string().optional(),
  closeDate: z.string().optional(),
  dealType: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  associatedCompanyId: z.string().optional(),
  associatedContactIds: z.array(z.string()).optional(),
  query: z.string().optional(),
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0),
  properties: z.array(z.string()).optional()
});
```

### 2. Response Validation Schemas

```typescript
// HubSpot API Response Schemas
const HubSpotObjectSchema = z.object({
  id: z.string(),
  properties: z.record(z.any()),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean().optional()
});

const HubSpotSearchResponseSchema = z.object({
  total: z.number(),
  results: z.array(HubSpotObjectSchema),
  paging: z.object({
    next: z.object({
      after: z.string(),
      link: z.string().optional()
    }).optional()
  }).optional()
});

// MCP Tool Response Schema
const MCPToolResponseSchema = z.object({
  content: z.array(z.object({
    type: z.enum(['text', 'resource']),
    text: z.string().optional(),
    resource: z.string().optional()
  })),
  isError: z.boolean().optional()
});
```

## Performance and Optimization Specifications

### 1. Caching Strategy

```typescript
interface CacheConfig {
  enabled: boolean;
  ttl: number;                   // Time to live in seconds
  maxSize: number;               // Maximum cache entries
  compression: boolean;          // Enable compression for large entries
}

class MCPCache {
  private cache = new Map<string, CacheEntry>();
  
  constructor(private config: CacheConfig) {}
  
  set(key: string, value: any, customTTL?: number): void {
    if (!this.config.enabled) return;
    
    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      ttl: (customTTL || this.config.ttl) * 1000
    };
    
    this.cache.set(key, entry);
    this.evictExpired();
  }
  
  get(key: string): any | null {
    if (!this.config.enabled) return null;
    
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  private evictExpired(): void {
    if (this.cache.size <= this.config.maxSize) return;
    
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toDelete = entries.slice(0, entries.length - this.config.maxSize);
    toDelete.forEach(([key]) => this.cache.delete(key));
  }
}
```

### 2. Connection Pooling

```typescript
interface PoolConfig {
  min: number;                   // Minimum connections
  max: number;                   // Maximum connections
  acquireTimeoutMillis: number;  // Connection acquisition timeout
  idleTimeoutMillis: number;     // Idle connection timeout
}

class HubSpotConnectionPool {
  private pool: HubSpotApiClient[] = [];
  private busy = new Set<HubSpotApiClient>();
  
  constructor(private config: PoolConfig) {
    this.initialize();
  }
  
  private initialize(): void {
    for (let i = 0; i < this.config.min; i++) {
      this.pool.push(this.createClient());
    }
  }
  
  private createClient(): HubSpotApiClient {
    return new HubSpotApiClient({
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
      retryDelayMillis: 5000,
      numberOfApiCallRetries: 3
    });
  }
  
  async acquire(): Promise<HubSpotApiClient> {
    // Try to get an idle client
    const client = this.pool.pop();
    if (client) {
      this.busy.add(client);
      return client;
    }
    
    // Create new client if under max
    if (this.busy.size < this.config.max) {
      const newClient = this.createClient();
      this.busy.add(newClient);
      return newClient;
    }
    
    // Wait for a client to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection pool timeout'));
      }, this.config.acquireTimeoutMillis);
      
      const checkForClient = () => {
        const client = this.pool.pop();
        if (client) {
          clearTimeout(timeout);
          this.busy.add(client);
          resolve(client);
        } else {
          setTimeout(checkForClient, 10);
        }
      };
      
      checkForClient();
    });
  }
  
  release(client: HubSpotApiClient): void {
    this.busy.delete(client);
    this.pool.push(client);
  }
}
```

### 3. Rate Limiting Specifications

```typescript
interface RateLimitConfig {
  windowMs: number;              // Time window in milliseconds
  max: number;                   // Maximum requests per window
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

const createAdaptiveRateLimit = () => {
  const configs = new Map<string, RateLimitConfig>();
  
  // Different limits for different user tiers
  configs.set('admin', {
    windowMs: 15 * 60 * 1000,
    max: 5000,
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
    keyGenerator: (req) => req.auth?.userId || req.ip
  });
  
  configs.set('user', {
    windowMs: 15 * 60 * 1000,
    max: 1000,
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
    keyGenerator: (req) => req.auth?.userId || req.ip
  });
  
  configs.set('guest', {
    windowMs: 15 * 60 * 1000,
    max: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req) => req.ip
  });
  
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.auth?.role || 'guest';
    const config = configs.get(role) || configs.get('guest')!;
    
    const limiter = rateLimit(config);
    limiter(req, res, next);
  };
};
```

This technical specification provides comprehensive implementation guidance for all aspects of the Railway MCP HTTP deployment, ensuring consistent development practices and production-ready implementation.