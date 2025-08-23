# HubSpot MCP SDK Implementation Specifications

## Core Component Implementations

### 1. BCP Delegator Implementation

```typescript
// src/core/bcp-delegator.ts

import { ToolDefinition, BCP, validateParams } from './types.js';

export interface BcpDelegator {
  delegate(domain: string, operation: string, params: Record<string, any>): Promise<any>;
  loadBcp(domain: string): Promise<BCP>;
  validateParams(params: any, schema: any, toolName: string): void;
  getOperations(domain: string): Promise<string[]>;
}

export class BcpToolDelegator implements BcpDelegator {
  private bcpCache = new Map<string, BCP>();
  private toolCache = new Map<string, Map<string, ToolDefinition>>();

  constructor() {
    // Initialize with empty caches - BCPs loaded on demand
  }

  async delegate(domain: string, operation: string, params: Record<string, any>): Promise<any> {
    try {
      // 1. Load domain BCP (cached)
      const bcp = await this.loadBcp(domain);
      
      // 2. Find specific tool (cached)
      const tool = await this.findTool(domain, operation);
      
      if (!tool || !tool.handler) {
        throw new Error(`Handler not found for ${domain}.${operation}`);
      }
      
      // 3. Validate parameters against tool schema
      if (tool.inputSchema) {
        this.validateParams(params, tool.inputSchema, tool.name);
      }
      
      // 4. Execute tool handler
      const result = await tool.handler(params);
      
      return result;
    } catch (error) {
      // Enhance error with context
      const enhancedError = new Error(
        `Failed to delegate ${domain}.${operation}: ${error.message}`
      );
      enhancedError.cause = error;
      throw enhancedError;
    }
  }

  async loadBcp(domain: string): Promise<BCP> {
    // Check cache first
    if (this.bcpCache.has(domain)) {
      return this.bcpCache.get(domain)!;
    }

    // Dynamic import based on domain
    let bcp: BCP;
    try {
      switch (domain) {
        case 'Companies':
          const companiesBcp = await import('../bcps/Companies/index.js');
          bcp = companiesBcp.bcp;
          break;
        case 'Contacts':
          const contactsBcp = await import('../bcps/Contacts/index.js');
          bcp = contactsBcp.bcp;
          break;
        case 'Notes':
          const notesBcp = await import('../bcps/Notes/index.js');
          bcp = { domain: 'Notes', description: 'Notes BCP', tools: notesBcp.noteTools };
          break;
        case 'Associations':
          const assocBcp = await import('../bcps/Associations/index.js');
          bcp = { domain: 'Associations', description: 'Associations BCP', tools: assocBcp.associationTools };
          break;
        case 'Deals':
          const dealsBcp = await import('../bcps/Deals/index.js');
          bcp = dealsBcp.bcp;
          break;
        case 'Products':
          const productsBcp = await import('../bcps/Products/index.js');
          bcp = { domain: 'Products', description: 'Products BCP', tools: Object.values(productsBcp.productTools) };
          break;
        case 'Properties':
          const propsBcp = await import('../bcps/Properties/index.js');
          bcp = { domain: 'Properties', description: 'Properties BCP', tools: propsBcp.propertiesTools };
          break;
        case 'Emails':
          const emailsBcp = await import('../bcps/Emails/index.js');
          bcp = { domain: 'Emails', description: 'Emails BCP', tools: emailsBcp.emailTools };
          break;
        case 'BlogPosts':
          const blogsBcp = await import('../bcps/BlogPosts/index.js');
          bcp = blogsBcp.bcp;
          break;
        case 'Quotes':
          const quotesBcp = await import('../bcps/Quotes/index.js');
          bcp = quotesBcp.bcp;
          break;
        default:
          throw new Error(`Unknown BCP domain: ${domain}`);
      }
    } catch (error) {
      throw new Error(`Failed to load BCP for domain ${domain}: ${error.message}`);
    }

    // Cache the loaded BCP
    this.bcpCache.set(domain, bcp);
    
    // Cache individual tools for faster lookup
    const toolMap = new Map<string, ToolDefinition>();
    bcp.tools.forEach(tool => {
      toolMap.set(tool.name, tool);
    });
    this.toolCache.set(domain, toolMap);

    return bcp;
  }

  private async findTool(domain: string, operation: string): Promise<ToolDefinition | undefined> {
    // Check tool cache first
    const toolMap = this.toolCache.get(domain);
    if (toolMap) {
      return toolMap.get(operation);
    }

    // Load BCP if not cached (will cache tools)
    await this.loadBcp(domain);
    return this.toolCache.get(domain)?.get(operation);
  }

  validateParams(params: any, schema: any, toolName: string): void {
    try {
      validateParams(params, schema, toolName);
    } catch (error) {
      throw new Error(`Parameter validation failed for ${toolName}: ${error.message}`);
    }
  }

  async getOperations(domain: string): Promise<string[]> {
    const bcp = await this.loadBcp(domain);
    return bcp.tools.map(tool => tool.name);
  }

  // Utility method to clear caches (useful for testing)
  clearCache(): void {
    this.bcpCache.clear();
    this.toolCache.clear();
  }

  // Method to get cache statistics
  getCacheStats(): { bcpCount: number; toolCount: number } {
    const toolCount = Array.from(this.toolCache.values())
      .reduce((sum, toolMap) => sum + toolMap.size, 0);
    
    return {
      bcpCount: this.bcpCache.size,
      toolCount
    };
  }
}
```

### 2. Tool Registration Factory

```typescript
// src/core/tool-factory.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BcpDelegator } from './bcp-delegator.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface ToolRegistrationFactory {
  createDomainTool(domain: string, delegator: BcpDelegator): DomainToolConfig;
  registerAllTools(server: McpServer, delegator: BcpDelegator): Promise<void>;
}

interface DomainToolConfig {
  name: string;
  schema: z.ZodObject<any>;
  handler: (params: any) => Promise<CallToolResult>;
}

export class BcpToolRegistrationFactory implements ToolRegistrationFactory {
  private static readonly DOMAIN_CONFIGS: Record<string, DomainConfig> = {
    Companies: {
      operations: ['create', 'get', 'update', 'delete', 'search', 'recent'],
      description: 'HubSpot company management with CRUD operations and search capabilities'
    },
    Contacts: {
      operations: ['create', 'get', 'update', 'delete', 'search', 'recent'],
      description: 'HubSpot contact management with CRUD operations and search capabilities'
    },
    Notes: {
      operations: ['create', 'get', 'update', 'delete', 'list', 'recent', 'addAssociation', 'removeAssociation', 'listAssociations', 'createWithAssociations'],
      description: 'HubSpot note management with associations and content operations'
    },
    Associations: {
      operations: ['create', 'createDefault', 'delete', 'list', 'batchCreate', 'batchCreateDefault', 'batchDelete', 'batchRead', 'deleteLabels', 'getAssociationTypes', 'getAssociationTypeReference'],
      description: 'HubSpot object association management with batch operations'
    },
    Deals: {
      operations: ['create', 'get', 'update', 'delete', 'search', 'recent', 'batchCreate', 'batchUpdate'],
      description: 'HubSpot deal management with CRUD operations, search, and batch processing'
    },
    Products: {
      operations: ['list', 'search', 'get'],
      description: 'HubSpot product catalog management with search and retrieval'
    },
    Properties: {
      operations: ['list', 'get', 'create', 'update', 'delete', 'listGroups', 'getGroup', 'createGroup', 'updateGroup', 'deleteGroup'],
      description: 'HubSpot custom property management with groups and field definitions'
    },
    Emails: {
      operations: ['create', 'get', 'update', 'delete', 'list', 'recent'],
      description: 'HubSpot email management for marketing campaigns and communications'
    },
    BlogPosts: {
      operations: ['create', 'get', 'update', 'delete', 'recent'],
      description: 'HubSpot blog post management for content marketing'
    },
    Quotes: {
      operations: ['create', 'get', 'update', 'delete', 'search', 'recent', 'addLineItem', 'listLineItems', 'updateLineItem', 'removeLineItem'],
      description: 'HubSpot quote management with line items and pricing'
    }
  };

  createDomainTool(domain: string, delegator: BcpDelegator): DomainToolConfig {
    const config = BcpToolRegistrationFactory.DOMAIN_CONFIGS[domain];
    if (!config) {
      throw new Error(`No configuration found for domain: ${domain}`);
    }

    const toolName = `hubspot${domain}`;
    const schema = this.createDomainSchema(domain, config.operations);
    const handler = this.createDomainHandler(domain, delegator);

    return { name: toolName, schema, handler };
  }

  private createDomainSchema(domain: string, operations: string[]): z.ZodObject<any> {
    // Base schema with operation parameter
    const baseSchema = {
      operation: z.enum(operations as [string, ...string[]]).describe('Operation to perform')
    };

    // Domain-specific parameter schemas
    const domainParams = this.getDomainSpecificParams(domain);

    return z.object({ ...baseSchema, ...domainParams });
  }

  private getDomainSpecificParams(domain: string): Record<string, z.ZodType<any>> {
    // Common parameters used across domains
    const commonParams = {
      id: z.string().optional().describe('Object ID (required for get, update, delete operations)'),
      limit: z.number().int().min(1).max(100).optional().describe('Maximum number of results'),
      properties: z.record(z.any()).optional().describe('Additional object properties')
    };

    // Domain-specific parameters
    switch (domain) {
      case 'Companies':
        return {
          ...commonParams,
          name: z.string().optional().describe('Company name (required for create)'),
          domain: z.string().optional().describe('Company website domain'),
          industry: z.string().optional().describe('Company industry'),
          description: z.string().optional().describe('Company description'),
          searchType: z.enum(['name', 'domain']).optional().describe('Type of search to perform'),
          searchTerm: z.string().optional().describe('Search term')
        };

      case 'Contacts':
        return {
          ...commonParams,
          email: z.string().email().optional().describe('Contact email (required for create)'),
          firstName: z.string().optional().describe('Contact first name'),
          lastName: z.string().optional().describe('Contact last name'),
          phone: z.string().optional().describe('Contact phone number'),
          company: z.string().optional().describe('Contact company'),
          searchType: z.enum(['email', 'name']).optional().describe('Type of search to perform'),
          searchTerm: z.string().optional().describe('Search term')
        };

      case 'Notes':
        return {
          ...commonParams,
          content: z.string().optional().describe('Note content (required for create)'),
          ownerId: z.string().optional().describe('HubSpot owner ID'),
          metadata: z.record(z.any()).optional().describe('Custom note properties'),
          startTimestamp: z.string().optional().describe('Start timestamp filter (ISO 8601)'),
          endTimestamp: z.string().optional().describe('End timestamp filter (ISO 8601)'),
          after: z.string().optional().describe('Pagination cursor'),
          associationObjectType: z.string().optional().describe('Type of object to associate'),
          associationObjectId: z.string().optional().describe('ID of object to associate')
        };

      case 'Associations':
        return {
          ...commonParams,
          fromObjectType: z.string().optional().describe('Source object type'),
          toObjectType: z.string().optional().describe('Target object type'),
          fromObjectId: z.string().optional().describe('Source object ID'),
          toObjectId: z.string().optional().describe('Target object ID'),
          associations: z.array(z.any()).optional().describe('Batch associations array'),
          inputs: z.array(z.any()).optional().describe('Batch read inputs'),
          objectType: z.string().optional().describe('Object type for list operation'),
          objectId: z.string().optional().describe('Object ID for list operation'),
          after: z.string().optional().describe('Pagination cursor'),
          associationCategory: z.string().optional().describe('Association category'),
          associationTypeId: z.number().optional().describe('Association type ID'),
          types: z.array(z.any()).optional().describe('Association types')
        };

      case 'Deals':
        return {
          ...commonParams,
          dealname: z.string().optional().describe('Deal name (required for create)'),
          pipeline: z.string().optional().describe('Pipeline ID'),
          dealstage: z.string().optional().describe('Deal stage ID'),
          amount: z.string().optional().describe('Deal amount'),
          closedate: z.string().optional().describe('Close date (ISO 8601)'),
          description: z.string().optional().describe('Deal description'),
          hubspot_owner_id: z.string().optional().describe('Owner ID'),
          searchType: z.enum(['name', 'modifiedDate', 'custom']).optional().describe('Search type'),
          query: z.string().optional().describe('Search query'),
          customSearch: z.object({
            filterGroups: z.array(z.any()),
            sorts: z.array(z.any()).optional(),
            properties: z.array(z.string()).optional(),
            limit: z.number().optional(),
            after: z.number().optional()
          }).optional().describe('Custom search parameters'),
          deals: z.array(z.any()).optional().describe('Batch create deals'),
          updates: z.array(z.any()).optional().describe('Batch update deals')
        };

      case 'Products':
        return {
          ...commonParams,
          name: z.string().optional().describe('Product name for search')
        };

      case 'Properties':
        return {
          ...commonParams,
          objectType: z.string().optional().describe('HubSpot object type'),
          propertyName: z.string().optional().describe('Property name'),
          name: z.string().optional().describe('Internal property name'),
          label: z.string().optional().describe('Property display label'),
          description: z.string().optional().describe('Property description'),
          groupName: z.string().optional().describe('Property group name'),
          type: z.enum(['string', 'number', 'date', 'datetime', 'enumeration', 'bool']).optional().describe('Property data type'),
          fieldType: z.enum(['text', 'textarea', 'select', 'radio', 'checkbox', 'date', 'file', 'number']).optional().describe('Form field type'),
          options: z.array(z.object({
            label: z.string(),
            value: z.string(),
            displayOrder: z.number().optional(),
            hidden: z.boolean().optional()
          })).optional().describe('Enumeration options'),
          displayName: z.string().optional().describe('Group display name')
        };

      case 'Emails':
        return {
          ...commonParams,
          name: z.string().optional().describe('Email internal name'),
          templateId: z.string().optional().describe('Template ID'),
          subject: z.string().optional().describe('Email subject'),
          from: z.object({
            name: z.string().optional(),
            email: z.string().email()
          }).optional().describe('Sender information'),
          replyTo: z.string().email().optional().describe('Reply-to email'),
          previewText: z.string().optional().describe('Preview text'),
          folderId: z.string().optional().describe('Folder ID'),
          metadata: z.record(z.any()).optional().describe('Custom properties'),
          state: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']).optional().describe('Email state'),
          type: z.enum(['REGULAR', 'AUTOMATED', 'AB_TEST', 'FOLLOW_UP']).optional().describe('Email type'),
          campaignId: z.string().optional().describe('Campaign ID'),
          createdAfter: z.string().optional().describe('Created after date'),
          createdBefore: z.string().optional().describe('Created before date'),
          query: z.string().optional().describe('Search query'),
          after: z.string().optional().describe('Pagination cursor')
        };

      case 'BlogPosts':
        return {
          ...commonParams,
          name: z.string().optional().describe('Blog post title'),
          contentGroupId: z.string().optional().describe('Blog ID'),
          slug: z.string().optional().describe('URL slug'),
          blogAuthorId: z.string().optional().describe('Author ID'),
          metaDescription: z.string().optional().describe('Meta description'),
          postBody: z.string().optional().describe('Post content'),
          featuredImage: z.string().optional().describe('Featured image URL'),
          useFeaturedImage: z.boolean().optional().describe('Use featured image'),
          state: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']).optional().describe('Post state'),
          updateDraftOnly: z.boolean().optional().describe('Update draft only'),
          tagIds: z.array(z.string()).optional().describe('Tag IDs')
        };

      case 'Quotes':
        return {
          ...commonParams,
          title: z.string().optional().describe('Quote title'),
          expirationDate: z.string().optional().describe('Expiration date'),
          status: z.enum(['DRAFT', 'APPROVAL_NOT_NEEDED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PENDING_BUYER_ACTION', 'ACCEPTED', 'DECLINED', 'LOST', 'WON']).optional().describe('Quote status'),
          currency: z.string().optional().describe('Currency code'),
          language: z.string().optional().describe('Language code'),
          locale: z.string().optional().describe('Locale code'),
          searchType: z.enum(['title', 'status']).optional().describe('Search type'),
          searchTerm: z.string().optional().describe('Search term'),
          quoteId: z.string().optional().describe('Quote ID for line items'),
          lineItemId: z.string().optional().describe('Line item ID'),
          productId: z.string().optional().describe('Product ID'),
          quantity: z.number().optional().describe('Line item quantity'),
          price: z.number().optional().describe('Line item price'),
          discount: z.number().optional().describe('Discount amount'),
          discountPercentage: z.number().optional().describe('Discount percentage'),
          termInMonths: z.number().optional().describe('Term in months'),
          recurringBillingPeriod: z.enum(['monthly', 'quarterly', 'semiannually', 'annually', 'per_two_years', 'per_three_years']).optional().describe('Billing period')
        };

      default:
        return commonParams;
    }
  }

  private createDomainHandler(domain: string, delegator: BcpDelegator) {
    return async (params: any): Promise<CallToolResult> => {
      try {
        const { operation, ...operationParams } = params;
        
        if (!operation) {
          throw new Error('Operation parameter is required');
        }

        const result = await delegator.delegate(domain, operation, operationParams);
        
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error performing ${domain} operation: ${errorMessage}` }]
        };
      }
    };
  }

  async registerAllTools(server: McpServer, delegator: BcpDelegator): Promise<void> {
    const domains = Object.keys(BcpToolRegistrationFactory.DOMAIN_CONFIGS);
    
    for (const domain of domains) {
      try {
        const toolConfig = this.createDomainTool(domain, delegator);
        const config = BcpToolRegistrationFactory.DOMAIN_CONFIGS[domain];
        
        server.tool(
          toolConfig.name,
          toolConfig.schema,
          toolConfig.handler
        );
        
        console.error(`[TOOL-FACTORY] Registered ${toolConfig.name} with ${config.operations.length} operations`);
      } catch (error) {
        console.error(`[TOOL-FACTORY] Failed to register ${domain} tool:`, error.message);
        throw error;
      }
    }
    
    console.error(`[TOOL-FACTORY] Successfully registered ${domains.length} domain tools`);
  }
}

interface DomainConfig {
  operations: string[];
  description: string;
}
```

### 3. Updated Main Server File

```typescript
// src/http-server-sdk.ts

import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest, JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

// Import our new delegation architecture
import { BcpToolDelegator } from './core/bcp-delegator.js';
import { BcpToolRegistrationFactory } from './core/tool-factory.js';

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
```

## Testing Specifications

### 1. Unit Tests for BCP Delegator

```typescript
// tests/core/bcp-delegator.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BcpToolDelegator } from '../../src/core/bcp-delegator.js';

describe('BcpToolDelegator', () => {
  let delegator: BcpToolDelegator;

  beforeEach(() => {
    delegator = new BcpToolDelegator();
  });

  describe('delegate', () => {
    it('should successfully delegate to Companies create operation', async () => {
      const params = { name: 'Test Company', domain: 'test.com' };
      const result = await delegator.delegate('Companies', 'create', params);
      
      expect(result).toBeDefined();
      expect(result.message).toBe('Company created successfully');
    });

    it('should throw error for unknown domain', async () => {
      await expect(delegator.delegate('UnknownDomain', 'create', {}))
        .rejects.toThrow('Unknown BCP domain: UnknownDomain');
    });

    it('should throw error for unknown operation', async () => {
      await expect(delegator.delegate('Companies', 'unknownOp', {}))
        .rejects.toThrow('Handler not found for Companies.unknownOp');
    });

    it('should validate parameters against tool schema', async () => {
      // Should fail validation - missing required 'name' parameter
      await expect(delegator.delegate('Companies', 'create', {}))
        .rejects.toThrow('Parameter validation failed');
    });
  });

  describe('loadBcp', () => {
    it('should load and cache BCP', async () => {
      const bcp1 = await delegator.loadBcp('Companies');
      const bcp2 = await delegator.loadBcp('Companies');
      
      expect(bcp1).toBe(bcp2); // Should be same cached instance
      expect(bcp1.domain).toBe('Companies');
      expect(bcp1.tools.length).toBeGreaterThan(0);
    });
  });

  describe('getOperations', () => {
    it('should return available operations for domain', async () => {
      const operations = await delegator.getOperations('Companies');
      
      expect(operations).toContain('create');
      expect(operations).toContain('get');
      expect(operations).toContain('update');
      expect(operations).toContain('delete');
      expect(operations).toContain('search');
      expect(operations).toContain('recent');
    });
  });

  describe('cache management', () => {
    it('should track cache statistics', async () => {
      await delegator.loadBcp('Companies');
      await delegator.loadBcp('Contacts');
      
      const stats = delegator.getCacheStats();
      expect(stats.bcpCount).toBe(2);
      expect(stats.toolCount).toBeGreaterThan(0);
    });

    it('should clear cache when requested', async () => {
      await delegator.loadBcp('Companies');
      delegator.clearCache();
      
      const stats = delegator.getCacheStats();
      expect(stats.bcpCount).toBe(0);
      expect(stats.toolCount).toBe(0);
    });
  });
});
```

### 2. Integration Tests

```typescript
// tests/integration/tool-registration.test.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BcpToolDelegator } from '../../src/core/bcp-delegator.js';
import { BcpToolRegistrationFactory } from '../../src/core/tool-factory.js';

describe('Tool Registration Integration', () => {
  let server: McpServer;
  let delegator: BcpToolDelegator;
  let factory: BcpToolRegistrationFactory;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0.0' });
    delegator = new BcpToolDelegator();
    factory = new BcpToolRegistrationFactory();
  });

  it('should register all domain tools with MCP server', async () => {
    await factory.registerAllTools(server, delegator);
    
    // Access registered tools (implementation depends on McpServer API)
    const registeredTools = (server as any)._registeredTools || {};
    
    expect(registeredTools['hubspotCompany']).toBeDefined();
    expect(registeredTools['hubspotContact']).toBeDefined();
    expect(registeredTools['hubspotNote']).toBeDefined();
    expect(registeredTools['hubspotAssociation']).toBeDefined();
    expect(registeredTools['hubspotDeal']).toBeDefined();
    expect(registeredTools['hubspotProduct']).toBeDefined();
    expect(registeredTools['hubspotProperty']).toBeDefined();
    expect(registeredTools['hubspotEmail']).toBeDefined();
    expect(registeredTools['hubspotBlogPost']).toBeDefined();
    expect(registeredTools['hubspotQuote']).toBeDefined();
  });

  it('should create proper domain tool configuration', () => {
    const toolConfig = factory.createDomainTool('Companies', delegator);
    
    expect(toolConfig.name).toBe('hubspotCompany');
    expect(toolConfig.schema).toBeDefined();
    expect(toolConfig.handler).toBeDefined();
    expect(typeof toolConfig.handler).toBe('function');
  });

  it('should handle tool execution through delegation', async () => {
    const toolConfig = factory.createDomainTool('Companies', delegator);
    
    const params = {
      operation: 'create',
      name: 'Test Company',
      domain: 'test.com'
    };
    
    const result = await toolConfig.handler(params);
    
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Company created successfully');
  });
});
```

This implementation provides a clean, maintainable architecture that leverages the official MCP SDK while preserving all existing BCP investments. The delegation pattern ensures SOLID compliance while the factory pattern simplifies tool registration and management.