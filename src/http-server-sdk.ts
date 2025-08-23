/**
 * Location: /src/http-server-sdk.ts
 * 
 * MCP HTTP Server using Official SDK with Delegated BCP Tools.
 * 
 * This implementation uses the official MCP SDK StreamableHTTPServerTransport 
 * while reusing all existing BCP tool implementations through a clean delegation 
 * pattern. Follows SOLID principles by separating transport concerns from 
 * business logic.
 * 
 * Used by:
 * - Railway deployment: Entry point for the production server
 * - Development: Local server for testing and development
 * 
 * How it works with other files:
 * - Uses BcpToolDelegator to map operations to existing BCP tools
 * - Uses ToolRegistrationFactory to register consolidated domain tools
 * - Leverages existing configuration, logging, and error handling utilities
 * - Maintains session state and transport management for MCP protocol
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest, JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

// Import our new delegation architecture
import { BcpToolDelegator } from './core/bcp-tool-delegator.js';
import { BcpToolRegistrationFactory } from './core/tool-registration-factory.js';

// Import existing configuration and utilities
import { loadConfig, validateConfiguration, isDevelopment } from './config/environment.js';
import { createLogger } from './utils/logger.js';

// Simple event store for resumability
class SimpleEventStore {
  private events: Map<string, { eventId: string; message: JSONRPCMessage }[]> = new Map();
  private eventCounter = 0;

  async storeEvent(streamId: string, message: JSONRPCMessage): Promise<string> {
    const eventId = `event_${++this.eventCounter}`;
    if (!this.events.has(streamId)) {
      this.events.set(streamId, []);
    }
    this.events.get(streamId)!.push({ eventId, message });
    return eventId;
  }

  async replayEventsAfter(lastEventId: string, { send }: {
    send: (eventId: string, message: JSONRPCMessage) => Promise<void>
  }): Promise<string> {
    const streamId = 'default';
    const events = this.events.get(streamId) || [];
    
    let startIndex = 0;
    if (lastEventId) {
      startIndex = events.findIndex(e => e.eventId === lastEventId) + 1;
    }

    for (let i = startIndex; i < events.length; i++) {
      const event = events[i];
      await send(event.eventId, event.message);
    }

    return streamId;
  }
}

// Load configuration
const config = loadConfig();
validateConfiguration(config);

const logger = createLogger({
  level: config.LOG_LEVEL || 'info',
  environment: config.NODE_ENV || 'development',
  serviceName: 'hubspot-mcp-sdk',
  version: '0.1.0'
});

const PORT = config.PORT || 3000;

// Create Express app
const app = express();
app.use(express.json());

// CORS configuration
app.use(cors({
  origin: '*',
  exposedHeaders: ["Mcp-Session-Id"],
  credentials: true
}));

/**
 * Create MCP Server with Delegated BCP Tools
 */
async function createMCPServer(): Promise<McpServer> {
  logger.info('🚀 Creating MCP Server with delegated BCP tools...');
  
  // Validate HubSpot API token
  const apiKey = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!apiKey) {
    throw new Error('HUBSPOT_ACCESS_TOKEN environment variable is required');
  }
  
  // Create the MCP server instance
  const server = new McpServer({
    name: 'hubspot-mcp',
    version: '0.1.0',
  }, {
    capabilities: {
      tools: {},
      logging: {}
    }
  });

  // Create delegation architecture components
  const delegator = new BcpToolDelegator();
  const toolFactory = new BcpToolRegistrationFactory();
  
  // Register all domain tools using the delegation pattern
  try {
    await toolFactory.registerAllTools(server, delegator);
    logger.info('✅ All BCP tools registered successfully through delegation layer');
    
    // Log cache statistics
    const cacheStats = delegator.getCacheStats();
    logger.info(`📊 Cache initialized: ${cacheStats.bcpCount} BCPs, ${cacheStats.toolCount} tools`);
  } catch (error) {
    logger.error('❌ Failed to register BCP tools:', error);
    throw error;
  }

  return server;
}

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

/**
 * Handle MCP POST requests (client-to-server communication)
 */
const handleMCPPost = async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  
  logger.info({ 
    sessionId, 
    method: req.body?.method,
    hasSessionId: !!sessionId,
    isInitialize: !sessionId && isInitializeRequest(req.body)
  }, 'MCP POST request received');

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport for this session
      logger.info({ sessionId }, 'Reusing existing transport');
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request - create new transport and session
      logger.info('Creating new transport for initialization request');
      
      const eventStore = new SimpleEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore,
        onsessioninitialized: (newSessionId) => {
          logger.info({ sessionId: newSessionId }, 'Session initialized, storing transport');
          transports[newSessionId] = transport;
        }
      });

      // Clean up transport when closed
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          logger.info({ sessionId: sid }, 'Transport closed, removing from map');
          delete transports[sid];
        }
      };

      // Create and connect MCP server to transport
      const mcpServer = await createMCPServer();
      await mcpServer.connect(transport);
      logger.info('MCP server connected to transport with delegated tools');

      // Handle the initialization request
      await transport.handleRequest(req, res, req.body);
      logger.info('Initialization request handled successfully');
      return;
    } else {
      // Invalid request
      logger.error({ sessionId, body: req.body }, 'Invalid MCP request');
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle request with existing transport
    logger.info({ sessionId }, 'Handling request with existing transport');
    await transport.handleRequest(req, res, req.body);
    logger.info({ sessionId }, 'Request handled successfully');

  } catch (error) {
    logger.error({ error, sessionId }, 'Error handling MCP request');
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
};

/**
 * Handle MCP GET requests (Server-Sent Events for notifications)
 */
const handleMCPGet = async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  
  if (!sessionId || !transports[sessionId]) {
    logger.error({ sessionId }, 'Invalid session ID for SSE request');
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const lastEventId = req.headers['last-event-id'] as string | undefined;
  logger.info({ sessionId, lastEventId }, 'SSE connection request');

  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
    logger.info({ sessionId }, 'SSE stream established');
  } catch (error) {
    logger.error({ error, sessionId }, 'Error handling SSE request');
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
};

/**
 * Handle MCP DELETE requests (session termination)
 */
const handleMCPDelete = async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  
  if (!sessionId || !transports[sessionId]) {
    logger.error({ sessionId }, 'Invalid session ID for termination request');
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  logger.info({ sessionId }, 'Session termination request');

  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
    logger.info({ sessionId }, 'Session terminated');
  } catch (error) {
    logger.error({ error, sessionId }, 'Error handling session termination');
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
  }
};

// Register MCP endpoints
app.post('/mcp', handleMCPPost);
app.get('/mcp', handleMCPGet);
app.delete('/mcp', handleMCPDelete);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'hubspot-mcp-sdk',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    activeSessions: Object.keys(transports).length,
    architecture: 'delegated-bcp'
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, '🚀 HubSpot MCP Server (SDK + Delegated BCP) listening');
  logger.info('🔧 Test with: /health endpoint');
  logger.info('📡 MCP endpoint: /mcp');
  logger.info(`🌐 Connect Claude Desktop to: ${isDevelopment(config) ? 'http://localhost:' + PORT : 'https://hubspot.synapticlabs.ai'}/mcp`);
  logger.info('🏗️ Architecture: Official MCP SDK + Delegated BCP Tools');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Shutting down server...');

  // Close all active transports
  for (const sessionId in transports) {
    try {
      logger.info({ sessionId }, 'Closing transport');
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      logger.error({ error, sessionId }, 'Error closing transport');
    }
  }

  server.close(() => {
    logger.info('✅ Server shutdown complete');
    process.exit(0);
  });
});

export default app;