# Current Codebase Analysis

## Executive Summary

The current HubSpot MCP server is implemented using **STDIO transport** and is designed as a Desktop Extension (DXT) rather than an HTTP-based service. To deploy on Railway, significant architectural changes are needed to migrate from STDIO transport to HTTP Streamable transport, implement proper authentication, and configure environment variables for cloud deployment.

## Current Architecture Overview

### Transport Implementation
- **Current**: Uses `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`
- **Entry Point**: `src/index.ts` creates server via `createServer()` function
- **Server Class**: `HubspotBCPServer` in `src/core/server.ts`
- **Communication**: JSON-RPC over stdin/stdout for local DXT usage

### Key Components

#### 1. Server Entry Point (`src/index.ts`)
```typescript
import { createServer } from './core/server.js';
// Creates server with HubSpot API key from environment
const server = await createServer(apiKey);
```

#### 2. Core Server (`src/core/server.ts`)
```typescript
export class HubspotBCPServer {
  private server: McpServer;
  private apiClient: HubspotApiClient;
  
  constructor(apiKey: string) {
    this.server = new McpServer({
      name: 'hubspot-mcp',
      version: '0.1.0'
    });
  }
  
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
```

#### 3. BCP Architecture
- **Bounded Context Packs**: Organized by HubSpot objects (Companies, Contacts, Deals, etc.)
- **Service Pattern**: Each BCP extends `HubspotBaseService`
- **Tool Registration**: Tools are combined into domain-specific tools with `operation` parameter
- **API Client**: Centralized HubSpot API client in `src/core/hubspot-client.ts`

### Environment Configuration

#### Current Environment Variables
```json
// manifest.json
"env": {
  "HUBSPOT_ACCESS_TOKEN": "${user_config.hubspot_access_token}",
  "NODE_ENV": "production",
  "DEBUG": "true"
}
```

#### Package Configuration
```json
// package.json
{
  "name": "hubspot-mcp",
  "version": "0.1.0",
  "type": "module",
  "main": "build/index.js",
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Dependencies Analysis
```json
"dependencies": {
  "@hubspot/api-client": "^9.0.0",
  "@modelcontextprotocol/sdk": "^1.9.0",
  "fast-glob": "^3.3.0",
  "zod": "^3.22.4"
}
```

## Required Changes for Railway Deployment

### 1. Transport Layer Migration

**Current Implementation:**
```typescript
// STDIO Transport (Current)
const transport = new StdioServerTransport();
await this.server.connect(transport);
```

**Required Implementation:**
```typescript
// HTTP Streamable Transport (Required for Railway)
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

const app = express();
app.use(express.json());

// Session management for HTTP transport
const transports = new Map();

// MCP endpoint
app.all('/mcp', async (req, res) => {
  // Handle HTTP requests with session management
});

const port = process.env.PORT || 3000;
app.listen(port);
```

### 2. Authentication Implementation

**Current State:** No authentication (local DXT usage)

**Required for Railway:**
- Bearer token authentication
- API key validation middleware
- Session management for HTTP transport
- Request/response header handling

### 3. Environment Variable Updates

**Additional Variables Needed:**
```bash
PORT=3000
NODE_ENV=production
HUBSPOT_ACCESS_TOKEN=your_token_here
MCP_SESSION_SECRET=random_secret_for_sessions
CORS_ORIGIN=https://your-client-domain.com
```

### 4. Package.json Updates

**Required Scripts:**
```json
{
  "scripts": {
    "start": "node build/index.js",
    "build": "tsc",
    "dev": "tsc -w & nodemon build/index.js"
  }
}
```

**Additional Dependencies:**
```json
{
  "express": "^4.18.0",
  "cors": "^2.8.5",
  "helmet": "^7.0.0"
}
```

### 5. Dockerization Requirements

**Dockerfile needed for Railway:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY build/ ./build/
EXPOSE 3000
CMD ["npm", "start"]
```

## File Structure Impact

### Files Requiring Major Changes
1. **`src/index.ts`** - Switch from STDIO to HTTP server setup
2. **`src/core/server.ts`** - Implement HTTP transport and session management
3. **`package.json`** - Add Express dependencies and Railway-specific scripts
4. **`manifest.json`** - Update for HTTP transport configuration

### New Files Required
1. **`Dockerfile`** - Container configuration for Railway
2. **`railway.json`** - Railway-specific deployment configuration
3. **`src/middleware/auth.ts`** - Authentication middleware
4. **`src/routes/mcp.ts`** - MCP HTTP endpoint handlers

### Files Remaining Unchanged
- All BCP implementations (`src/bcps/*`)
- HubSpot API client (`src/core/hubspot-client.ts`)
- Service implementations (`*.service.ts`)
- Tool definitions (`*.tool.ts`)

## Migration Complexity Assessment

### Low Complexity (Minimal Changes)
- **BCP Tools**: Existing tool handlers can remain unchanged
- **HubSpot Integration**: API client and service layers are transport-agnostic
- **Business Logic**: Core functionality remains the same

### Medium Complexity (Moderate Changes)
- **Environment Configuration**: New variables and Railway-specific setup
- **Error Handling**: Adapt from stderr logging to HTTP error responses
- **Session Management**: Implement HTTP session tracking

### High Complexity (Significant Refactoring)
- **Transport Layer**: Complete migration from STDIO to HTTP Streamable
- **Authentication**: Implement security middleware and token validation
- **Server Initialization**: Restructure startup sequence for HTTP server

## Performance Considerations

### Current Performance Characteristics
- **Local Process**: Single-user, direct communication
- **Memory Usage**: Minimal overhead from STDIO transport
- **Latency**: Near-zero transport latency

### Expected Railway Performance
- **Multi-user Support**: HTTP sessions for concurrent users
- **Network Latency**: Additional HTTP round-trip overhead
- **Scalability**: Railway's auto-scaling capabilities
- **Resource Usage**: Express.js middleware overhead

## Compatibility Matrix

| Component | Current | Railway Compatible | Notes |
|-----------|---------|-------------------|-------|
| MCP SDK Version | 1.9.0 | ✅ | Supports both transports |
| Node.js Version | >=18.0.0 | ✅ | Railway supports Node 18+ |
| HubSpot API | v9.0.0 | ✅ | Cloud-compatible |
| Transport | STDIO | ❌ | Requires HTTP Streamable |
| Authentication | None | ❌ | Requires implementation |
| Environment | Local | ❌ | Requires cloud config |

## Next Steps

1. **Phase 1**: Implement HTTP Streamable transport
2. **Phase 2**: Add authentication middleware
3. **Phase 3**: Configure Railway environment variables
4. **Phase 4**: Create Dockerfile and deployment config
5. **Phase 5**: Test and optimize for production deployment

This analysis shows that while the core business logic can remain largely unchanged, significant infrastructure changes are required to migrate from a local DXT to a Railway-deployed HTTP service.