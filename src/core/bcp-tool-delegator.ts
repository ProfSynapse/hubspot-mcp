/**
 * Location: /src/core/bcp-tool-delegator.ts
 * 
 * BCP Tool Delegator implementation providing mapping between domain/operation 
 * combinations and existing BCP tools. Handles parameter forwarding, response 
 * formatting, and includes caching for performance optimization.
 * 
 * Used by:
 * - src/core/tool-registration-factory.ts: Uses delegator to handle tool execution
 * - src/http-server-sdk.ts: Creates and configures the delegator instance
 * 
 * How it works with other files:
 * - Dynamically imports existing BCP tool arrays from src/bcps/index.ts files
 * - Maps operation calls to specific tool handlers within each BCP
 * - Provides caching layer for improved performance
 * - Handles error propagation and parameter validation
 */

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
        `Failed to delegate ${domain}.${operation}: ${error instanceof Error ? error.message : String(error)}`
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
          bcp = dealsBcp.dealsBcp;
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
          bcp = emailsBcp.bcp;
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
      throw new Error(`Failed to load BCP for domain ${domain}: ${error instanceof Error ? error.message : String(error)}`);
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
      // First try direct operation match
      const directMatch = toolMap.get(operation);
      if (directMatch) {
        return directMatch;
      }
      
      // Try mapped operation name
      const mappedToolName = this.mapOperationToToolName(domain, operation);
      if (mappedToolName) {
        return toolMap.get(mappedToolName);
      }
    }

    // Load BCP if not cached (will cache tools)
    await this.loadBcp(domain);
    const loadedToolMap = this.toolCache.get(domain);
    if (loadedToolMap) {
      // First try direct operation match
      const directMatch = loadedToolMap.get(operation);
      if (directMatch) {
        return directMatch;
      }
      
      // Try mapped operation name
      const mappedToolName = this.mapOperationToToolName(domain, operation);
      if (mappedToolName) {
        return loadedToolMap.get(mappedToolName);
      }
    }
    
    return undefined;
  }

  /**
   * Maps operation names to tool names for different domain naming conventions
   * Some domains use simple operation names (e.g., 'recent', 'create')
   * Others use descriptive tool names (e.g., 'getRecentNotes', 'createNote')
   */
  private mapOperationToToolName(domain: string, operation: string): string | null {
    const operationMappings: Record<string, Record<string, string>> = {
      Notes: {
        recent: 'getRecentNotes',
        list: 'listNotes',
        create: 'createNote',
        get: 'getNote',
        update: 'updateNote',
        delete: 'deleteNote',
        addAssociation: 'addAssociationToNote',
        removeAssociation: 'removeAssociationFromNote',
        listAssociations: 'listNoteAssociations',
        createWithAssociations: 'createNoteWithAssociations'
      },
      Companies: {
        // Companies uses simple operation names that match directly
        // No mapping needed - direct operation names work
      },
      Contacts: {
        // Contacts uses simple operation names that match directly
        // No mapping needed - direct operation names work
      },
      Deals: {
        // Need to check Deals domain - may use simple names
      },
      Associations: {
        // Associations likely uses descriptive names
        batchCreate: 'batchCreate',
        batchCreateDefault: 'batchCreateDefault',
        batchDelete: 'batchDelete',
        batchRead: 'batchRead',
        create: 'create',
        createDefault: 'createDefault',
        delete: 'delete',
        deleteLabels: 'deleteLabels',
        getAssociationTypeReference: 'getAssociationTypeReference',
        getAssociationTypes: 'getAssociationTypes'
      },
      Products: {
        // Products likely uses descriptive names - need to map
      },
      Properties: {
        list: 'listProperties',
        get: 'getProperty',
        create: 'createProperty',
        update: 'updateProperty',
        delete: 'deleteProperty',
        listGroups: 'listPropertyGroups',
        getGroup: 'getPropertyGroup',
        createGroup: 'createPropertyGroup',
        updateGroup: 'updatePropertyGroup',
        deleteGroup: 'deletePropertyGroup'
      },
      Emails: {
        // Emails may use descriptive names - need to map
      },
      BlogPosts: {
        // BlogPosts may use descriptive names - need to map
      },
      Quotes: {
        // Quotes may use descriptive names - need to map
      }
    };

    return operationMappings[domain]?.[operation] || null;
  }

  validateParams(params: any, schema: any, toolName: string): void {
    try {
      validateParams(params, schema, toolName);
    } catch (error) {
      throw new Error(`Parameter validation failed for ${toolName}: ${error instanceof Error ? error.message : String(error)}`);
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