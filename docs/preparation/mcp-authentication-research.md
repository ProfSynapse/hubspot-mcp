# MCP Authentication Research

## Executive Summary

MCP server authentication has evolved significantly in 2025 with the introduction of dedicated authentication libraries, OAuth 2.0 integration, and production-ready security frameworks. Research reveals critical vulnerabilities in early MCP implementations, leading to robust authentication patterns including the MCP Auth library, Bearer token middleware, and role-based access control (RBAC) systems. This research provides practical implementation guides for securing MCP servers with various authentication strategies.

## Authentication Landscape in 2025

### MCP Auth Library (Official)

**Primary Authentication Framework**: The MCP Auth library supports the MCP authorization specification (version 2025-06-18) and provides Express.js middleware for protecting MCP routes.

**Key Features**:
- **OAuth 2.0 Compliance**: Full OAuth 2.0 authorization server support
- **Bearer Token Middleware**: Automatic token validation and user context
- **Resource Protection**: Granular endpoint protection with audience validation
- **Express Integration**: Native Express.js middleware patterns

**Installation and Setup**:
```bash
npm install @mcp/auth
```

**Basic Implementation**:
```javascript
import { createMCPAuth } from '@mcp/auth';
import express from 'express';

const app = express();
const mcpAuth = createMCPAuth({
  audience: 'hubspot-mcp-server',
  issuer: 'https://your-auth-server.com',
  jwksUri: 'https://your-auth-server.com/.well-known/jwks.json'
});

// Protect MCP endpoint
app.use('/mcp', mcpAuth.authenticate);

// Protected resource metadata router
app.use('/.well-known', mcpAuth.protectedResourceRouter);
```

### Security Vulnerabilities and Lessons Learned

**Critical Vulnerability Research (2025)**:
Security research by Invariantlabs discovered a significant vulnerability in the official GitHub MCP server that allowed attackers to access private repository data, highlighting the importance of proper authentication implementation.

**Common Security Issues Identified**:
1. **Broad Access Tokens**: Tokens with excessive permissions causing widespread access if leaked
2. **Lack of Tenant Isolation**: Multi-user setups with cross-access vulnerabilities
3. **Missing OAuth Discovery**: Silent failures without proper OAuth discovery endpoints
4. **Insufficient Rate Limiting**: No protection against abuse or DoS attacks

## Authentication Patterns and Implementation

### 1. Bearer Token Authentication

**Express Middleware Implementation**:
```javascript
import jwt from 'jsonwebtoken';

const authenticateBearer = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Missing or invalid authorization header"
      }
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Invalid or expired token"
      }
    });
  }
};

// Apply to MCP endpoints
app.use('/mcp', authenticateBearer);
```

**Token Validation with Scopes**:
```javascript
const validateTokenScopes = (requiredScopes) => {
  return (req, res, next) => {
    const userScopes = req.user?.scopes || [];
    
    const hasRequiredScope = requiredScopes.some(scope => 
      userScopes.includes(scope)
    );
    
    if (!hasRequiredScope) {
      return res.status(403).json({
        jsonrpc: "2.0",
        error: {
          code: -32003,
          message: "Insufficient permissions",
          data: { requiredScopes, userScopes }
        }
      });
    }
    
    next();
  };
};

// Apply scope validation
app.use('/mcp', validateTokenScopes(['mcp:read', 'mcp:write']));
```

### 2. OAuth 2.0 Implementation

**OAuth Discovery Endpoints**:
```javascript
// OAuth protected resource metadata
app.get('/.well-known/oauth-protected-resource', (req, res) => {
  res.json({
    resource: 'hubspot-mcp-server',
    authorization_servers: ['https://your-auth-server.com'],
    jwks_uri: 'https://your-auth-server.com/.well-known/jwks.json',
    bearer_methods_supported: ['header'],
    resource_documentation: 'https://docs.your-mcp-server.com',
    revocation_endpoint: 'https://your-auth-server.com/revoke',
    introspection_endpoint: 'https://your-auth-server.com/introspect'
  });
});

// OAuth authorization server metadata
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  res.json({
    issuer: 'https://your-auth-server.com',
    authorization_endpoint: 'https://your-auth-server.com/authorize',
    token_endpoint: 'https://your-auth-server.com/token',
    jwks_uri: 'https://your-auth-server.com/.well-known/jwks.json',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    scopes_supported: ['mcp:read', 'mcp:write', 'hubspot:all']
  });
});
```

**JWT Token Verification**:
```javascript
import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';

const client = jwksClient({
  jwksUri: 'https://your-auth-server.com/.well-known/jwks.json',
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
  cacheMaxEntries: 5
});

const getKey = (header, callback) => {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
};

const verifyJWT = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      audience: 'hubspot-mcp-server',
      issuer: 'https://your-auth-server.com',
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
};
```

### 3. Role-Based Access Control (RBAC)

**User Role Definition**:
```javascript
const roles = {
  admin: {
    permissions: ['mcp:*', 'hubspot:*', 'system:*'],
    description: 'Full system access'
  },
  user: {
    permissions: ['mcp:read', 'mcp:write', 'hubspot:read', 'hubspot:write'],
    description: 'Standard user access'
  },
  readonly: {
    permissions: ['mcp:read', 'hubspot:read'],
    description: 'Read-only access'
  }
};

const checkPermission = (userRole, requiredPermission) => {
  const userPermissions = roles[userRole]?.permissions || [];
  
  return userPermissions.some(permission => {
    if (permission.endsWith('*')) {
      const prefix = permission.slice(0, -1);
      return requiredPermission.startsWith(prefix);
    }
    return permission === requiredPermission;
  });
};
```

**RBAC Middleware**:
```javascript
const requirePermission = (permission) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    
    if (!userRole || !checkPermission(userRole, permission)) {
      return res.status(403).json({
        jsonrpc: "2.0",
        error: {
          code: -32003,
          message: "Insufficient permissions",
          data: {
            required: permission,
            userRole: userRole
          }
        }
      });
    }
    
    next();
  };
};

// Apply to specific tool operations
server.tool("hubspotCompany", {}, async (params, context) => {
  // Check permissions within tool handler
  if (params.operation === 'delete' && 
      !checkPermission(context.user.role, 'hubspot:delete')) {
    throw new Error('Insufficient permissions for delete operation');
  }
  
  // Proceed with operation
});
```

## Session-Based Authentication

### Session Management for HTTP MCP

**Session Store Implementation**:
```javascript
import session from 'express-session';
import MongoStore from 'connect-mongo';

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URL,
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});

app.use(sessionMiddleware);
```

**MCP Session Correlation**:
```javascript
// Correlate Express sessions with MCP sessions
const mcpSessionAuth = (req, res, next) => {
  const mcpSessionId = req.headers['mcp-session-id'];
  const expressSessionId = req.sessionID;
  
  // Store correlation
  if (mcpSessionId && req.session) {
    req.session.mcpSessionId = mcpSessionId;
    
    // Store user context for MCP session
    if (req.session.user) {
      mcpSessions.set(mcpSessionId, {
        user: req.session.user,
        permissions: req.session.permissions,
        created: Date.now(),
        lastActivity: Date.now()
      });
    }
  }
  
  next();
};

app.use('/mcp', mcpSessionAuth);
```

## API Key Authentication

### Simple API Key Implementation

**API Key Middleware**:
```javascript
const apiKeys = new Map([
  ['ak_prod_123abc', { name: 'Production Client', permissions: ['mcp:*'] }],
  ['ak_dev_456def', { name: 'Development Client', permissions: ['mcp:read'] }]
]);

const authenticateAPIKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || 
                 req.query.apiKey ||
                 req.headers.authorization?.replace('ApiKey ', '');
  
  if (!apiKey) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "API key required"
      }
    });
  }
  
  const keyData = apiKeys.get(apiKey);
  if (!keyData) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Invalid API key"
      }
    });
  }
  
  req.apiKey = keyData;
  next();
};
```

**Database-Backed API Keys**:
```javascript
import bcrypt from 'bcrypt';

class APIKeyManager {
  constructor(database) {
    this.db = database;
  }
  
  async createAPIKey(clientName, permissions) {
    const keyValue = this.generateSecureKey();
    const hashedKey = await bcrypt.hash(keyValue, 12);
    
    await this.db.apiKeys.insert({
      hashedKey,
      clientName,
      permissions,
      created: new Date(),
      lastUsed: null,
      active: true
    });
    
    return `ak_${keyValue}`;
  }
  
  async validateAPIKey(providedKey) {
    const keys = await this.db.apiKeys.find({ active: true });
    
    for (const key of keys) {
      if (await bcrypt.compare(providedKey, key.hashedKey)) {
        // Update last used timestamp
        await this.db.apiKeys.update(
          { _id: key._id },
          { $set: { lastUsed: new Date() } }
        );
        
        return {
          clientName: key.clientName,
          permissions: key.permissions
        };
      }
    }
    
    return null;
  }
  
  generateSecureKey() {
    return require('crypto').randomBytes(32).toString('hex');
  }
}
```

## Production Security Hardening

### Rate Limiting and DoS Protection

**Advanced Rate Limiting**:
```javascript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: 'rl:mcp:'
    }),
    windowMs,
    max,
    message: {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message
      }
    },
    keyGenerator: (req) => {
      return req.user?.id || 
             req.apiKey?.clientName || 
             req.headers['mcp-session-id'] || 
             req.ip;
    }
  });
};

// Different limits for different auth types
app.use('/mcp', createRateLimit(
  15 * 60 * 1000, // 15 minutes
  1000, // High limit for authenticated users
  "Rate limit exceeded for authenticated requests"
));

app.use('/mcp', (req, res, next) => {
  if (!req.user && !req.apiKey) {
    // Lower limit for unauthenticated requests
    return createRateLimit(
      15 * 60 * 1000,
      10,
      "Rate limit exceeded for unauthenticated requests"
    )(req, res, next);
  }
  next();
});
```

### Input Validation and Sanitization

**MCP Request Validation**:
```javascript
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

const mcpRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]),
  method: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_/]*$/),
  params: z.any().optional()
});

const sanitizeInput = (obj) => {
  if (typeof obj === 'string') {
    return DOMPurify.sanitize(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeInput);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[DOMPurify.sanitize(key)] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return obj;
};

const validateAndSanitizeMCP = (req, res, next) => {
  try {
    // Validate structure
    const validated = mcpRequestSchema.parse(req.body);
    
    // Sanitize content
    req.body = sanitizeInput(validated);
    
    next();
  } catch (error) {
    res.status(400).json({
      jsonrpc: "2.0",
      id: req.body?.id || null,
      error: {
        code: -32600,
        message: "Invalid Request",
        data: error.errors
      }
    });
  }
};
```

### Audit Logging

**Security Event Logging**:
```javascript
class SecurityLogger {
  constructor(logger) {
    this.logger = logger;
  }
  
  logAuthSuccess(req, user) {
    this.logger.info('Authentication success', {
      event: 'auth_success',
      userId: user.id,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      mcpSessionId: req.headers['mcp-session-id'],
      timestamp: new Date().toISOString()
    });
  }
  
  logAuthFailure(req, reason) {
    this.logger.warn('Authentication failure', {
      event: 'auth_failure',
      reason,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  }
  
  logToolAccess(req, toolName, params) {
    this.logger.info('Tool access', {
      event: 'tool_access',
      tool: toolName,
      userId: req.user?.id,
      mcpSessionId: req.headers['mcp-session-id'],
      params: this.sanitizeLogParams(params),
      timestamp: new Date().toISOString()
    });
  }
  
  sanitizeLogParams(params) {
    // Remove sensitive data from logs
    const sanitized = { ...params };
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.secret;
    return sanitized;
  }
}

const securityLogger = new SecurityLogger(logger);

// Apply logging middleware
app.use('/mcp', (req, res, next) => {
  if (req.user) {
    securityLogger.logAuthSuccess(req, req.user);
  }
  next();
});
```

This comprehensive authentication research provides multiple security approaches for MCP servers, from simple API keys to enterprise-grade OAuth 2.0 implementations, ensuring secure deployment on Railway or any production environment.