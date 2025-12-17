/**
 * Schema Registry for Meta-Tools Architecture
 *
 * Manages schema discovery and caching for the hubspot_getTools meta-tool.
 * Extracts schemas directly from BCP tools at runtime (source of truth).
 *
 * Used by:
 * - meta-tools-handler.ts: Uses registry for getTools schema discovery
 *
 * Key Features:
 * - Runtime schema extraction from BCP tools
 * - Context provider enrichment (deal stages, property groups, etc.)
 * - Two-level caching (BCP + schema)
 * - Operation name mapping (reuses delegator logic)
 */

import {
  BCP,
  ToolDefinition,
  InputSchema,
  DomainSummary,
  OperationSummary,
  OperationDetail,
  DomainConfig,
  SchemaContext
} from './types.js';
import { ContextRegistry } from './context/index.js';

/**
 * Domain configurations - operations available for each domain
 * This is the source of truth for available operations
 */
export const DOMAIN_CONFIGS: Record<string, DomainConfig> = {
  Companies: {
    operations: ['create', 'get', 'update', 'search', 'recent'],
    description: 'HubSpot company management with CRUD operations and search capabilities'
  },
  Contacts: {
    operations: ['create', 'get', 'update', 'search', 'recent'],
    description: 'HubSpot contact management with CRUD operations and search capabilities'
  },
  Notes: {
    operations: ['get', 'update', 'createContactNote', 'createCompanyNote', 'createDealNote', 'listContactNotes', 'listCompanyNotes', 'listDealNotes'],
    description: 'HubSpot notes management with CRUD operations and associations'
  },
  Associations: {
    operations: ['create', 'createDefault', 'list', 'batchCreate', 'batchCreateDefault', 'batchRead', 'getAssociationTypes', 'getAssociationTypeReference'],
    description: 'HubSpot object association management with batch operations'
  },
  Deals: {
    operations: ['create', 'get', 'update', 'search', 'recent'],
    description: 'HubSpot deal management with CRUD operations and search'
  },
  Products: {
    operations: ['list', 'search', 'get'],
    description: 'HubSpot product catalog management with search and retrieval'
  },
  Properties: {
    operations: ['list', 'get', 'create', 'update', 'search', 'listGroups', 'getGroup', 'createGroup', 'updateGroup'],
    description: 'HubSpot custom property management with groups and field definitions'
  },
  Emails: {
    operations: ['create', 'get', 'update', 'list', 'recent'],
    description: 'HubSpot email management for marketing campaigns and communications'
  },
  BlogPosts: {
    operations: ['create', 'get', 'update', 'recent', 'list'],
    description: 'HubSpot blog post management for content marketing'
  },
  Quotes: {
    operations: ['create', 'get', 'update', 'search', 'recent', 'addLineItem', 'listLineItems', 'updateLineItem', 'removeLineItem'],
    description: 'HubSpot quote management with line items and pricing'
  },
  ActivityHistory: {
    operations: ['recent', 'search'],
    description: 'Retrieve and search history of MCP tool calls from the database'
  },
  Lists: {
    operations: ['create', 'get', 'search', 'update', 'delete', 'updateFilters', 'addMembers', 'removeMembers', 'getMembers'],
    description: 'HubSpot list (segment) management with MANUAL, DYNAMIC, and SNAPSHOT support'
  }
};

/**
 * Operation name mappings - maps short operation names to actual tool names
 * Some domains use descriptive tool names (e.g., 'createAssociation') while
 * operations use short names (e.g., 'create')
 */
const OPERATION_MAPPINGS: Record<string, Record<string, string>> = {
  Notes: {
    get: 'get',
    update: 'update',
    createContactNote: 'createContactNote',
    createCompanyNote: 'createCompanyNote',
    createDealNote: 'createDealNote',
    listContactNotes: 'listContactNotes',
    listCompanyNotes: 'listCompanyNotes',
    listDealNotes: 'listDealNotes'
  },
  Associations: {
    batchCreate: 'batchCreateAssociations',
    batchCreateDefault: 'batchCreateDefaultAssociations',
    batchRead: 'batchReadAssociations',
    create: 'createAssociation',
    createDefault: 'createDefaultAssociation',
    list: 'listAssociations',
    getAssociationTypeReference: 'getAssociationTypeReference',
    getAssociationTypes: 'getAssociationTypes'
  },
  Properties: {
    list: 'listProperties',
    get: 'getProperty',
    create: 'createProperty',
    update: 'updateProperty',
    search: 'searchProperties',
    listGroups: 'listPropertyGroups',
    getGroup: 'getPropertyGroup',
    createGroup: 'createPropertyGroup',
    updateGroup: 'updatePropertyGroup'
  }
};

/**
 * SchemaRegistry - Manages schema discovery and caching for meta-tools
 */
export class SchemaRegistry {
  private bcpCache = new Map<string, BCP>();
  private schemaCache = new Map<string, OperationDetail>();
  private contextRegistry?: ContextRegistry;

  constructor(contextRegistry?: ContextRegistry) {
    this.contextRegistry = contextRegistry;
  }

  /**
   * Get all domains with their operations
   */
  async getAllDomains(): Promise<DomainSummary[]> {
    const domains = Object.keys(DOMAIN_CONFIGS);
    return domains.map(domain => ({
      name: domain,
      description: DOMAIN_CONFIGS[domain].description,
      operationCount: DOMAIN_CONFIGS[domain].operations.length,
      operations: DOMAIN_CONFIGS[domain].operations
    }));
  }

  /**
   * Get all operations for a domain with their schemas
   */
  async getDomainOperations(domain: string, includeContext: boolean = true): Promise<OperationSummary[]> {
    const config = DOMAIN_CONFIGS[domain];
    if (!config) {
      throw new Error(`Unknown domain: ${domain}`);
    }

    const bcp = await this.loadBcp(domain);
    const results: OperationSummary[] = [];

    for (const operationName of config.operations) {
      const tool = this.findTool(bcp, domain, operationName);
      if (tool) {
        let schema = this.cloneSchema(tool.inputSchema);

        if (includeContext && this.contextRegistry?.isInitialized()) {
          schema = this.applyContextEnrichment(domain, operationName, schema);
        }

        results.push({
          name: operationName,
          description: tool.description,
          schema
        });
      }
    }

    return results;
  }

  /**
   * Get detailed schema for a specific operation
   */
  async getOperationSchema(
    domain: string,
    operation: string,
    includeContext: boolean = true
  ): Promise<OperationDetail> {
    const config = DOMAIN_CONFIGS[domain];
    if (!config) {
      throw new Error(`Unknown domain: ${domain}`);
    }

    if (!config.operations.includes(operation)) {
      throw new Error(`Operation '${operation}' not found in domain '${domain}'. Available operations: ${config.operations.join(', ')}`);
    }

    // Check cache
    const cacheKey = `${domain}:${operation}:${includeContext}`;
    if (this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey)!;
    }

    const bcp = await this.loadBcp(domain);
    const tool = this.findTool(bcp, domain, operation);

    if (!tool) {
      throw new Error(`Tool handler not found for ${domain}.${operation}`);
    }

    let schema = this.cloneSchema(tool.inputSchema);

    if (includeContext && this.contextRegistry?.isInitialized()) {
      schema = this.applyContextEnrichment(domain, operation, schema);
    }

    const result: OperationDetail = {
      domain,
      operation,
      description: tool.description,
      schema
    };

    // Cache result
    this.schemaCache.set(cacheKey, result);

    return result;
  }

  /**
   * Load BCP with caching
   */
  private async loadBcp(domain: string): Promise<BCP> {
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
          bcp = notesBcp.notesBCP;
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
        case 'ActivityHistory':
          const activityBcp = await import('../bcps/ActivityHistory/index.js');
          bcp = activityBcp.bcp;
          break;
        case 'Lists':
          const listsBcp = await import('../bcps/Lists/index.js');
          bcp = listsBcp.bcp;
          break;
        default:
          throw new Error(`Unknown BCP domain: ${domain}`);
      }
    } catch (error) {
      throw new Error(`Failed to load BCP for domain ${domain}: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Cache the loaded BCP
    this.bcpCache.set(domain, bcp);

    return bcp;
  }

  /**
   * Find tool in BCP using operation name mapping
   */
  private findTool(bcp: BCP, domain: string, operation: string): ToolDefinition | undefined {
    // First try direct match
    let tool = bcp.tools.find(t => t.name === operation);
    if (tool) return tool;

    // Try with operation mapping
    const mappedName = OPERATION_MAPPINGS[domain]?.[operation];
    if (mappedName) {
      tool = bcp.tools.find(t => t.name === mappedName);
    }

    return tool;
  }

  /**
   * Apply context provider enrichment to schema
   */
  private applyContextEnrichment(
    domain: string,
    operation: string,
    schema: InputSchema
  ): InputSchema {
    if (!this.contextRegistry?.isInitialized()) {
      return schema;
    }

    const contexts = this.contextRegistry.getContextForDomain(domain);
    if (contexts.length === 0) {
      return schema;
    }

    // Deep clone to avoid mutation
    const enrichedSchema = this.cloneSchema(schema);

    for (const context of contexts) {
      const property = enrichedSchema.properties[context.field];
      if (property) {
        // Add enum values from context
        if (context.values.length > 0) {
          (property as any).enum = context.values.map(v => v.value);
          (property as any).enumDescriptions = context.values.reduce((acc, v) => {
            acc[v.value] = v.label;
            return acc;
          }, {} as Record<string, string>);
        }

        // Update description if provided
        if (context.description) {
          property.description = `${property.description} ${context.description}`;
        }
      }
    }

    return enrichedSchema;
  }

  /**
   * Deep clone a schema to avoid mutation
   */
  private cloneSchema(schema: InputSchema): InputSchema {
    return JSON.parse(JSON.stringify(schema));
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.bcpCache.clear();
    this.schemaCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { bcpCount: number; schemaCount: number } {
    return {
      bcpCount: this.bcpCache.size,
      schemaCount: this.schemaCache.size
    };
  }

  /**
   * Check if a domain exists
   */
  isDomainValid(domain: string): boolean {
    return domain in DOMAIN_CONFIGS;
  }

  /**
   * Check if an operation exists in a domain
   */
  isOperationValid(domain: string, operation: string): boolean {
    const config = DOMAIN_CONFIGS[domain];
    return config ? config.operations.includes(operation) : false;
  }

  /**
   * Get available operations for a domain
   */
  getOperationsForDomain(domain: string): string[] {
    return DOMAIN_CONFIGS[domain]?.operations || [];
  }
}
