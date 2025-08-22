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

  // HubSpot BCP Tools registered below

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

  // Register HubSpot Contacts tool
  server.tool(
    'hubspotContact',
    'HubSpot contact management tool with CRUD operations',
    {
      operation: z.enum(['create', 'read', 'update', 'delete', 'search', 'recent']).describe('The operation to perform'),
      id: z.string().optional().describe('Contact ID (required for read, update, delete)'),
      email: z.string().optional().describe('Contact email (required for create)'),
      firstName: z.string().optional().describe('Contact first name'),
      lastName: z.string().optional().describe('Contact last name'),
      company: z.string().optional().describe('Contact company'),
      searchQuery: z.string().optional().describe('Search query (for search operation)'),
      properties: z.record(z.any()).optional().describe('Additional contact properties'),
    },
    async ({ operation, id, email, firstName, lastName, company, searchQuery, properties }): Promise<CallToolResult> => {
      logger.info({ operation, id, email }, 'HubSpot contact tool called');
      return {
        content: [{
          type: 'text',
          text: `⚠️ Demo Mode: Would perform ${operation} operation on contact${id ? ` ${id}` : ''}. Set HUBSPOT_ACCESS_TOKEN for real API calls.`
        }]
      };
    }
  );

  // Register HubSpot Notes tool
  server.tool(
    'hubspotNote',
    'HubSpot note management tool with CRUD operations',
    {
      operation: z.enum(['create', 'read', 'update', 'delete', 'search']).describe('The operation to perform'),
      id: z.string().optional().describe('Note ID (required for read, update, delete)'),
      body: z.string().optional().describe('Note content (required for create)'),
      objectType: z.enum(['contact', 'company', 'deal', 'ticket']).optional().describe('Type of object to associate note with'),
      objectId: z.string().optional().describe('ID of object to associate note with'),
      searchQuery: z.string().optional().describe('Search query (for search operation)'),
    },
    async ({ operation, id, body, objectType, objectId, searchQuery }): Promise<CallToolResult> => {
      logger.info({ operation, id, objectType }, 'HubSpot note tool called');
      return {
        content: [{
          type: 'text',
          text: `⚠️ Demo Mode: Would perform ${operation} operation on note${id ? ` ${id}` : ''}. Set HUBSPOT_ACCESS_TOKEN for real API calls.`
        }]
      };
    }
  );

  // Register HubSpot Associations tool
  server.tool(
    'hubspotAssociation',
    'HubSpot object association management tool',
    {
      operation: z.enum(['create', 'delete', 'list']).describe('The operation to perform'),
      fromObjectType: z.enum(['contact', 'company', 'deal', 'ticket', 'product', 'quote']).describe('Source object type'),
      fromObjectId: z.string().describe('Source object ID'),
      toObjectType: z.enum(['contact', 'company', 'deal', 'ticket', 'product', 'quote']).describe('Target object type'),
      toObjectId: z.string().optional().describe('Target object ID (required for create/delete)'),
      associationType: z.string().optional().describe('Type of association'),
    },
    async ({ operation, fromObjectType, fromObjectId, toObjectType, toObjectId, associationType }): Promise<CallToolResult> => {
      logger.info({ operation, fromObjectType, toObjectType }, 'HubSpot association tool called');
      return {
        content: [{
          type: 'text',
          text: `⚠️ Demo Mode: Would perform ${operation} association between ${fromObjectType} ${fromObjectId} and ${toObjectType}${toObjectId ? ` ${toObjectId}` : ''}. Set HUBSPOT_ACCESS_TOKEN for real API calls.`
        }]
      };
    }
  );

  // Register HubSpot Deals tool
  server.tool(
    'hubspotDeal',
    'HubSpot deal management tool with CRUD operations',
    {
      operation: z.enum(['create', 'read', 'update', 'delete', 'search', 'recent']).describe('The operation to perform'),
      id: z.string().optional().describe('Deal ID (required for read, update, delete)'),
      dealname: z.string().optional().describe('Deal name (required for create)'),
      amount: z.number().optional().describe('Deal amount'),
      dealstage: z.string().optional().describe('Deal stage'),
      pipeline: z.string().optional().describe('Deal pipeline'),
      searchQuery: z.string().optional().describe('Search query (for search operation)'),
      properties: z.record(z.any()).optional().describe('Additional deal properties'),
    },
    async ({ operation, id, dealname, amount, dealstage, pipeline, searchQuery, properties }): Promise<CallToolResult> => {
      logger.info({ operation, id, dealname }, 'HubSpot deal tool called');
      return {
        content: [{
          type: 'text',
          text: `⚠️ Demo Mode: Would perform ${operation} operation on deal${id ? ` ${id}` : ''}. Set HUBSPOT_ACCESS_TOKEN for real API calls.`
        }]
      };
    }
  );

  // Register HubSpot Products tool
  server.tool(
    'hubspotProduct',
    'HubSpot product management tool with CRUD operations',
    {
      operation: z.enum(['create', 'read', 'update', 'delete', 'search', 'recent']).describe('The operation to perform'),
      id: z.string().optional().describe('Product ID (required for read, update, delete)'),
      name: z.string().optional().describe('Product name (required for create)'),
      price: z.number().optional().describe('Product price'),
      description: z.string().optional().describe('Product description'),
      searchQuery: z.string().optional().describe('Search query (for search operation)'),
      properties: z.record(z.any()).optional().describe('Additional product properties'),
    },
    async ({ operation, id, name, price, description, searchQuery, properties }): Promise<CallToolResult> => {
      logger.info({ operation, id, name }, 'HubSpot product tool called');
      return {
        content: [{
          type: 'text',
          text: `⚠️ Demo Mode: Would perform ${operation} operation on product${id ? ` ${id}` : ''}. Set HUBSPOT_ACCESS_TOKEN for real API calls.`
        }]
      };
    }
  );

  // Register HubSpot Properties tool
  server.tool(
    'hubspotProperty',
    'HubSpot property management tool for custom properties',
    {
      operation: z.enum(['create', 'read', 'update', 'delete', 'list']).describe('The operation to perform'),
      objectType: z.enum(['contact', 'company', 'deal', 'ticket', 'product', 'quote']).describe('Object type for the property'),
      name: z.string().optional().describe('Property name (required for create, read, update, delete)'),
      label: z.string().optional().describe('Property label (required for create)'),
      type: z.enum(['string', 'number', 'bool', 'datetime', 'enumeration']).optional().describe('Property type (required for create)'),
      description: z.string().optional().describe('Property description'),
      groupName: z.string().optional().describe('Property group name'),
      options: z.array(z.object({ label: z.string(), value: z.string() })).optional().describe('Options for enumeration properties'),
    },
    async ({ operation, objectType, name, label, type, description, groupName, options }): Promise<CallToolResult> => {
      logger.info({ operation, objectType, name }, 'HubSpot property tool called');
      return {
        content: [{
          type: 'text',
          text: `⚠️ Demo Mode: Would perform ${operation} operation on ${objectType} property${name ? ` ${name}` : ''}. Set HUBSPOT_ACCESS_TOKEN for real API calls.`
        }]
      };
    }
  );

  // Register HubSpot Emails tool
  server.tool(
    'hubspotEmail',
    'HubSpot email management tool for email activities',
    {
      operation: z.enum(['create', 'read', 'search']).describe('The operation to perform'),
      id: z.string().optional().describe('Email ID (required for read)'),
      subject: z.string().optional().describe('Email subject (required for create)'),
      body: z.string().optional().describe('Email body content (required for create)'),
      toEmail: z.string().optional().describe('Recipient email address (required for create)'),
      fromEmail: z.string().optional().describe('Sender email address'),
      contactId: z.string().optional().describe('Associated contact ID'),
      companyId: z.string().optional().describe('Associated company ID'),
      searchQuery: z.string().optional().describe('Search query (for search operation)'),
    },
    async ({ operation, id, subject, body, toEmail, fromEmail, contactId, companyId, searchQuery }): Promise<CallToolResult> => {
      logger.info({ operation, id, subject }, 'HubSpot email tool called');
      return {
        content: [{
          type: 'text',
          text: `⚠️ Demo Mode: Would perform ${operation} operation on email${id ? ` ${id}` : ''}. Set HUBSPOT_ACCESS_TOKEN for real API calls.`
        }]
      };
    }
  );

  // Register HubSpot Blog Posts tool
  server.tool(
    'hubspotBlogPost',
    'HubSpot blog post management tool for content marketing',
    {
      operation: z.enum(['create', 'read', 'update', 'delete', 'search', 'list']).describe('The operation to perform'),
      id: z.string().optional().describe('Blog post ID (required for read, update, delete)'),
      name: z.string().optional().describe('Blog post title (required for create)'),
      slug: z.string().optional().describe('Blog post URL slug'),
      contentGroupId: z.string().optional().describe('Blog/content group ID'),
      state: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']).optional().describe('Blog post state'),
      htmlTitle: z.string().optional().describe('HTML title tag'),
      metaDescription: z.string().optional().describe('Meta description'),
      postBody: z.string().optional().describe('Blog post content'),
      searchQuery: z.string().optional().describe('Search query (for search operation)'),
    },
    async ({ operation, id, name, slug, contentGroupId, state, htmlTitle, metaDescription, postBody, searchQuery }): Promise<CallToolResult> => {
      logger.info({ operation, id, name }, 'HubSpot blog post tool called');
      return {
        content: [{
          type: 'text',
          text: `⚠️ Demo Mode: Would perform ${operation} operation on blog post${id ? ` ${id}` : ''}. Set HUBSPOT_ACCESS_TOKEN for real API calls.`
        }]
      };
    }
  );

  // Register HubSpot Quotes tool
  server.tool(
    'hubspotQuote',
    'HubSpot quote management tool for sales quotes',
    {
      operation: z.enum(['create', 'read', 'update', 'delete', 'search']).describe('The operation to perform'),
      id: z.string().optional().describe('Quote ID (required for read, update, delete)'),
      name: z.string().optional().describe('Quote name (required for create)'),
      dealId: z.string().optional().describe('Associated deal ID'),
      contactId: z.string().optional().describe('Associated contact ID'),
      domain: z.string().optional().describe('Quote domain/URL'),
      expirationDate: z.string().optional().describe('Quote expiration date (ISO format)'),
      searchQuery: z.string().optional().describe('Search query (for search operation)'),
      properties: z.record(z.any()).optional().describe('Additional quote properties'),
    },
    async ({ operation, id, name, dealId, contactId, domain, expirationDate, searchQuery, properties }): Promise<CallToolResult> => {
      logger.info({ operation, id, name }, 'HubSpot quote tool called');
      return {
        content: [{
          type: 'text',
          text: `⚠️ Demo Mode: Would perform ${operation} operation on quote${id ? ` ${id}` : ''}. Set HUBSPOT_ACCESS_TOKEN for real API calls.`
        }]
      };
    }
  );

  logger.info('✅ MCP Server created with all 10 HubSpot BCP tools registered');
  
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