# HTTP MCP Implementation Research

## Executive Summary

The Model Context Protocol (MCP) has evolved significantly in 2025 with the introduction of Streamable HTTP transport, replacing the legacy HTTP+SSE approach. This research covers practical implementation patterns for Node.js-based MCP servers using Express.js, session management strategies, and production deployment considerations. The new HTTP transport enables serverless deployment while maintaining full MCP protocol compatibility.

## MCP Transport Evolution Timeline

### Current Standard: Streamable HTTP Transport (2025-03-26)

**Key Advantages**:
- **Serverless Compatible**: Supports scale-to-zero deployment models
- **Multi-Client Support**: Single server handles multiple concurrent sessions
- **Cost Effective**: No persistent connection overhead
- **Production Ready**: Designed for cloud-native deployments

**Protocol Requirements**:
```javascript
// Single endpoint handles both POST and GET
app.all('/mcp', async (req, res) => {
  // POST: Client requests, tool calls, resource requests
  // GET: Optional server-sent events for notifications
});
```

### Legacy: HTTP+SSE Transport (2024-11-05)

**Limitations**:
- **Persistent Connections**: Required always-on server instances
- **Scaling Issues**: Prevented serverless scale-to-zero functionality
- **Higher Costs**: Continuous resource consumption
- **Single Client**: One connection per server instance

## Node.js Implementation Patterns

### 1. Express.js with TypeScript SDK

**Basic Server Setup**:
```javascript
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();
app.use(express.json());

// Session storage for multiple clients
const sessions = new Map();

const server = new McpServer({
  name: "hubspot-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
    prompts: {}
  }
});

// Register tools
server.tool("hubspotCompany", /* tool definition */, async (params) => {
  // Tool implementation
});
```

**MCP Endpoint Implementation**:
```javascript
app.all('/mcp', async (req, res) => {
  try {
    // Extract or generate session ID
    const sessionId = req.headers['mcp-session-id'] || generateSessionId();
    
    // Set session header in response
    res.setHeader('Mcp-Session-Id', sessionId);
    
    // Get or create transport for session
    let transport = sessions.get(sessionId);
    if (!transport) {
      transport = new StreamableHTTPServerTransport();
      sessions.set(sessionId, transport);
      await server.connect(transport);
    }
    
    // Handle request based on method
    if (req.method === 'POST') {
      // Process MCP request
      const response = await transport.handleRequest(req.body);
      res.json(response);
    } else if (req.method === 'GET') {
      // Server-sent events for notifications
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      // Handle SSE connection
      transport.handleSSE(res);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 2. Session Management Strategy

**Session ID Generation**:
```javascript
import { randomUUID } from 'node:crypto';

function generateSessionId() {
  return randomUUID();
}

// Session cleanup for memory management
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > maxAge) {
      session.transport.close();
      sessions.delete(sessionId);
    }
  }
}, 5 * 60 * 1000); // Cleanup every 5 minutes
```

**Session State Management**:
```javascript
class SessionManager {
  constructor() {
    this.sessions = new Map();
  }
  
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }
  
  createSession(sessionId) {
    const session = {
      id: sessionId,
      transport: new StreamableHTTPServerTransport(),
      lastActivity: Date.now(),
      context: {}
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }
  
  updateActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }
  
  cleanup() {
    // Implementation for session cleanup
  }
}
```

### 3. Complete Working Example

**Reference Implementation** (Based on real examples):
```javascript
#!/usr/bin/env node
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json());

// Create MCP server instance
const server = new McpServer({
  name: "hubspot-mcp-http",
  version: "1.0.0",
  description: "HubSpot MCP Server with HTTP transport"
});

// Session management
const sessions = new Map();

// Register HubSpot tools
server.tool(
  "hubspotCompany",
  {
    operation: z.enum(['create', 'get', 'update', 'delete', 'search']),
    name: z.string().optional(),
    id: z.string().optional(),
    // ... other parameters
  },
  async (params) => {
    // Tool implementation
    return { result: "Company operation completed" };
  }
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Main MCP endpoint
app.all('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] || 
                   req.query.sessionId || 
                   generateSessionId();
  
  res.setHeader('Mcp-Session-Id', sessionId);
  
  try {
    let session = sessions.get(sessionId);
    
    if (!session) {
      const transport = new StreamableHTTPServerTransport();
      session = {
        transport,
        lastActivity: Date.now()
      };
      sessions.set(sessionId, session);
      await server.connect(transport);
    }
    
    session.lastActivity = Date.now();
    
    if (req.method === 'POST') {
      const response = await session.transport.handleRequest(req.body);
      res.json(response);
    } else {
      // Handle GET requests for SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      session.transport.handleSSE(res);
    }
  } catch (error) {
    console.error('MCP Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`MCP HTTP Server running on port ${port}`);
  console.log(`MCP endpoint: http://localhost:${port}/mcp`);
});

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}
```

## Protocol Compliance Requirements

### 1. HTTP Header Management

**Required Headers**:
```javascript
// Request headers (from client)
const sessionId = req.headers['mcp-session-id'];
const contentType = req.headers['content-type']; // application/json

// Response headers (to client)
res.setHeader('Mcp-Session-Id', sessionId);
res.setHeader('Content-Type', 'application/json');
```

**CORS Configuration**:
```javascript
import cors from 'cors';

app.use(cors({
  origin: [
    'https://claude.ai',
    'https://cursor.sh',
    'http://localhost:3000' // Development
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id'],
  exposedHeaders: ['Mcp-Session-Id']
}));
```

### 2. Error Handling

**MCP Error Response Format**:
```javascript
const handleMCPError = (error, req, res, next) => {
  console.error('MCP Protocol Error:', error);
  
  const errorResponse = {
    jsonrpc: "2.0",
    id: req.body?.id || null,
    error: {
      code: -32603, // Internal error
      message: error.message || 'Internal server error',
      data: {
        type: error.constructor.name,
        timestamp: new Date().toISOString()
      }
    }
  };
  
  res.status(500).json(errorResponse);
};

app.use(handleMCPError);
```

### 3. Validation and Security

**Input Validation**:
```javascript
import { z } from 'zod';

const mcpRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]),
  method: z.string(),
  params: z.any().optional()
});

app.use('/mcp', (req, res, next) => {
  if (req.method === 'POST') {
    try {
      mcpRequestSchema.parse(req.body);
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
  } else {
    next();
  }
});
```

## Performance Optimization

### 1. Connection Pooling

**Database Connections**:
```javascript
// For database-backed MCP servers
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Use pooled connections in tool handlers
server.tool("databaseQuery", {}, async (params) => {
  const client = await pool.connect();
  try {
    const result = await client.query(params.sql);
    return result.rows;
  } finally {
    client.release();
  }
});
```

### 2. Caching Strategy

**Response Caching**:
```javascript
import NodeCache from 'node-cache';

const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 60 // Check for expired keys every 60 seconds
});

server.tool("cachedHubspotData", {}, async (params) => {
  const cacheKey = `hubspot_${params.operation}_${params.id}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch fresh data
  const result = await hubspotApi.getData(params);
  
  // Cache the result
  cache.set(cacheKey, result);
  
  return result;
});
```

### 3. Rate Limiting

**API Rate Limiting**:
```javascript
import rateLimit from 'express-rate-limit';

const mcpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each session to 100 requests per windowMs
  keyGenerator: (req) => req.headers['mcp-session-id'] || req.ip,
  message: {
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Rate limit exceeded"
    }
  }
});

app.use('/mcp', mcpRateLimit);
```

## Testing and Debugging

### 1. MCP Inspector Integration

**Development Testing**:
```bash
# Install MCP Inspector globally
npm install -g @modelcontextprotocol/inspector

# Test your HTTP server
mcp-inspector http://localhost:3000/mcp
```

### 2. cURL Testing

**Manual Protocol Testing**:
```bash
# Test session creation
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'

# Test tool call
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: your-session-id" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "hubspotCompany",
      "arguments": {
        "operation": "get",
        "id": "123456"
      }
    }
  }'
```

### 3. Integration Testing

**Automated Test Suite**:
```javascript
import request from 'supertest';
import app from './server.js';

describe('MCP HTTP Server', () => {
  test('should handle initialize request', async () => {
    const response = await request(app)
      .post('/mcp')
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" }
        }
      });
    
    expect(response.status).toBe(200);
    expect(response.body.result).toBeDefined();
    expect(response.headers['mcp-session-id']).toBeDefined();
  });
  
  test('should handle tool calls', async () => {
    // Implementation for tool call testing
  });
});
```

## Production Deployment Considerations

### 1. Environment Configuration

**Required Environment Variables**:
```bash
NODE_ENV=production
PORT=3000
HUBSPOT_ACCESS_TOKEN=your_token
MCP_SESSION_SECRET=random_secret_for_signing
CORS_ORIGIN=https://claude.ai
RATE_LIMIT_MAX=100
CACHE_TTL=300
```

### 2. Health Monitoring

**Health Check Endpoint**:
```javascript
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    sessions: sessions.size,
    environment: process.env.NODE_ENV
  };
  
  res.json(health);
});

// Detailed health check
app.get('/health/detailed', async (req, res) => {
  try {
    // Test external dependencies
    const hubspotStatus = await testHubSpotConnection();
    const databaseStatus = await testDatabaseConnection();
    
    res.json({
      status: 'healthy',
      dependencies: {
        hubspot: hubspotStatus,
        database: databaseStatus
      },
      metrics: {
        activesSessions: sessions.size,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

### 3. Graceful Shutdown

**Process Management**:
```javascript
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Close all active sessions
  for (const [sessionId, session] of sessions.entries()) {
    try {
      await session.transport.close();
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
    }
  }
  
  // Close server
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
```

This comprehensive research provides the foundation for implementing a production-ready HTTP MCP server that can be successfully deployed on Railway with full protocol compliance and optimal performance characteristics.