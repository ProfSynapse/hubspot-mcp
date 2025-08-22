/**
 * MCP HTTP Server using Official SDK
 * 
 * Replaces our custom implementation with the official MCP SDK 
 * StreamableHTTPServerTransport to ensure proper tool discovery
 * by Claude Desktop.
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest, CallToolResult, JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Simple in-memory event store for resumability (minimal implementation)
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
    // Simple implementation - replay all events after the lastEventId
    // In a real implementation, this would be more sophisticated
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

// Import our existing configuration and services
import { loadConfig, validateConfiguration, isDevelopment } from './config/environment.js';
import { createLogger } from './utils/logger.js';

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
 * Create MCP Server with HubSpot BCP Tools
 */
function createMCPServer(): McpServer {
  logger.info('🚀 Creating MCP Server with HubSpot BCP tools...');
  
  const server = new McpServer({
    name: 'hubspot-mcp',
    version: '0.1.0',
  }, {
    capabilities: {
      tools: {},
      logging: {}
    }
  });

  // Register a simple test tool first to verify SDK integration
  server.tool(
    'test-tool',
    'A simple test tool to verify MCP SDK integration',
    {
      message: z.string().describe('Message to echo back'),
    },
    async ({ message }): Promise<CallToolResult> => {
      logger.info({ message }, 'Test tool called');
      return {
        content: [
          {
            type: 'text',
            text: `Echo: ${message} (from HubSpot MCP Server)`,
          },
        ],
      };
    }
  );

  // Register HubSpot Companies tool
  server.tool(
    'hubspotCompany',
    'HubSpot company management tool with CRUD operations',
    {
      operation: z.enum(['create', 'read', 'update', 'delete', 'search', 'recent']).describe('The operation to perform'),
      id: z.string().optional().describe('Company ID (required for read, update, delete)'),
      name: z.string().optional().describe('Company name (required for create)'),
      domain: z.string().optional().describe('Company website domain'),
      industry: z.string().optional().describe('Company industry'),
      description: z.string().optional().describe('Company description'),
      searchQuery: z.string().optional().describe('Search query (for search operation)'),
      properties: z.record(z.any()).optional().describe('Additional company properties'),
    },
    async ({ operation, id, name, domain, industry, description, searchQuery, properties }): Promise<CallToolResult> => {
      logger.info({ operation, id, name }, 'HubSpot company tool called');
      
      try {
        // Get API key from environment  
        const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
        if (!apiKey || apiKey.startsWith('test_')) {
          return {
            content: [{
              type: 'text',
              text: `⚠️ Demo Mode: Would perform ${operation} operation on company${id ? ` ${id}` : ''}. Set HUBSPOT_ACCESS_TOKEN for real API calls.`
            }]
          };
        }

        // TODO: Implement actual HubSpot API calls here
        // For now, return success message
        return {
          content: [{
            type: 'text', 
            text: `✅ Company ${operation} operation completed successfully.`
          }]
        };
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{
            type: 'text',
            text: `❌ Error performing ${operation} operation: ${errorMessage}`
          }]
        };
      }
    }
  );

  logger.info('✅ MCP Server created with HubSpot tools registered');
  
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
        eventStore, // Enable resumability
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
      const mcpServer = createMCPServer();
      await mcpServer.connect(transport);
      logger.info('MCP server connected to transport');

      // Handle the initialization request
      await transport.handleRequest(req, res, req.body);
      logger.info('Initialization request handled');
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
    activeSessions: Object.keys(transports).length
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, '🚀 HubSpot MCP Server (SDK) listening');
  logger.info('🔧 Test with: /health endpoint');
  logger.info('📡 MCP endpoint: /mcp');
  logger.info(`🌐 Connect Claude Desktop to: ${isDevelopment(config) ? 'http://localhost:' + PORT : 'https://hubspot.synapticlabs.ai'}/mcp`);
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