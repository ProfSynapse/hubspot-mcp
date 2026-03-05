# Meta-Tools Architecture Design

**Project:** HubSpot MCP Meta-Tools Refactor
**Date:** 2025-12-17
**Status:** Architecture Design Complete
**Version:** 1.0

---

## Executive Summary

This document specifies the complete architectural design for refactoring the HubSpot MCP server from a 12-domain-tool architecture to a 2-tool meta-architecture using `hubspot_getTools` and `hubspot_useTools`. This refactor will:

1. **Reduce tool surface area** from 12 consolidated domain tools to 2 meta-tools
2. **Preserve all existing functionality** - all 72 BCP operations remain accessible
3. **Improve discoverability** - LLMs can dynamically discover available operations
4. **Maintain backward compatibility** - parallel deployment strategy enables gradual migration
5. **Preserve critical features** - context/goals validation, dynamic schema enrichment, activity logging

### Key Design Principles

- **Zero Business Logic Changes**: All 72 BCP tool implementations remain untouched
- **Runtime Schema Discovery**: Schemas generated dynamically from actual BCP tool inputSchemas
- **Delegation Preservation**: BcpToolDelegator remains the execution engine with minimal changes
- **Context Provider Integration**: Dynamic schema enrichment (deal stages, property groups) preserved
- **Type Safety**: Full TypeScript type safety maintained throughout

---

## 1. Tool Specifications

### 1.1 hubspot_getTools

#### Purpose
Provides dynamic discovery of all available HubSpot operations across all domains. Returns detailed schemas for requested operations, enriched with context provider data (deal stages, property groups, etc.).

#### Tool Definition

**Tool Name:** `hubspot_getTools`

**Description:**
```
Discover available HubSpot operations and their detailed parameter schemas.

Use this tool to:
- Browse all available HubSpot operations across 12 domains
- Get detailed parameter schemas for specific operations
- Understand required vs optional parameters
- Access context-enriched schemas (e.g., valid deal stages, property groups)

Available Domains & Operations:

**Companies** (5 operations): create, get, update, search, recent
**Contacts** (5 operations): create, get, update, search, recent
**Deals** (5 operations): create, get, update, search, recent
**Notes** (8 operations): get, update, createContactNote, createCompanyNote, createDealNote, listContactNotes, listCompanyNotes, listDealNotes
**Associations** (8 operations): create, createDefault, list, batchCreate, batchCreateDefault, batchRead, getAssociationTypes, getAssociationTypeReference
**Products** (3 operations): list, search, get
**Properties** (8 operations): list, get, create, update, search, listGroups, getGroup, createGroup, updateGroup
**Emails** (5 operations): create, get, update, list, recent
**BlogPosts** (5 operations): create, get, update, recent, list
**Quotes** (9 operations): create, get, update, search, recent, addLineItem, listLineItems, updateLineItem, removeLineItem
**Lists** (9 operations): create, get, search, update, delete, updateFilters, addMembers, removeMembers, getMembers
**ActivityHistory** (2 operations): recent, search

TOTAL: 72 operations across 12 domains

To use an operation, first call this tool to get its schema, then call hubspot_useTools with the domain, operation, and parameters.
```

#### Input Schema

```typescript
{
  type: 'object',
  properties: {
    domain: {
      type: 'string',
      description: 'The HubSpot domain to discover operations for (optional - omit to list all domains)',
      enum: [
        'Companies', 'Contacts', 'Deals', 'Notes', 'Associations',
        'Products', 'Properties', 'Emails', 'BlogPosts', 'Quotes',
        'Lists', 'ActivityHistory'
      ]
    },
    operation: {
      type: 'string',
      description: 'Specific operation to get schema for (optional - requires domain to be specified)'
    },
    includeContext: {
      type: 'boolean',
      description: 'Whether to include context-enriched schemas (e.g., valid deal stages from HubSpot). Default: true',
      default: true
    }
  },
  required: []
}
```

#### Output Format

**Case 1: No parameters (list all domains)**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"domains\":[{\"name\":\"Companies\",\"description\":\"HubSpot company management with CRUD operations and search capabilities\",\"operationCount\":5,\"operations\":[\"create\",\"get\",\"update\",\"search\",\"recent\"]},{\"name\":\"Contacts\",\"description\":\"HubSpot contact management with CRUD operations and search capabilities\",\"operationCount\":5,\"operations\":[\"create\",\"get\",\"update\",\"search\",\"recent\"]},...],\"totalDomains\":12,\"totalOperations\":72}"
    }
  ]
}
```

**Case 2: Domain specified (list operations for domain)**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"domain\":\"Associations\",\"description\":\"HubSpot object association management with batch operations\",\"operations\":[{\"name\":\"create\",\"description\":\"Create an association between two objects in HubSpot\",\"schema\":{\"type\":\"object\",\"properties\":{\"fromObjectType\":{\"type\":\"string\",\"description\":\"The type of the first object (e.g., 'contacts', 'companies')\"},\"fromObjectId\":{\"type\":\"string\",\"description\":\"The ID of the first object\"},\"toObjectType\":{\"type\":\"string\",\"description\":\"The type of the second object\"},\"toObjectId\":{\"type\":\"string\",\"description\":\"The ID of the second object\"},\"associationTypes\":{\"type\":\"array\",\"description\":\"The types of associations to create\",\"items\":{\"type\":\"object\",\"properties\":{\"associationCategory\":{\"type\":\"string\",\"enum\":[\"HUBSPOT_DEFINED\",\"USER_DEFINED\",\"INTEGRATOR_DEFINED\"]},\"associationTypeId\":{\"type\":\"integer\"}}}}},\"required\":[\"fromObjectType\",\"fromObjectId\",\"toObjectType\",\"toObjectId\",\"associationTypes\"],\"examples\":[...]}},{\"name\":\"createDefault\",...}]}"
    }
  ]
}
```

**Case 3: Domain + Operation specified (detailed schema with context)**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"domain\":\"Deals\",\"operation\":\"create\",\"description\":\"Create a new deal in HubSpot\",\"schema\":{\"type\":\"object\",\"properties\":{\"dealname\":{\"type\":\"string\",\"description\":\"The name of the deal\"},\"pipeline\":{\"type\":\"string\",\"description\":\"The pipeline for the deal\"},\"dealstage\":{\"type\":\"string\",\"description\":\"The stage of the deal in the pipeline\",\"enum\":[\"appointmentscheduled\",\"qualifiedtobuy\",\"presentationscheduled\",\"decisionmakerboughtin\",\"contractsent\",\"closedwon\",\"closedlost\"],\"enumDescriptions\":{\"appointmentscheduled\":\"Appointment Scheduled (Default Pipeline)\",\"qualifiedtobuy\":\"Qualified to Buy (Default Pipeline)\",\"presentationscheduled\":\"Presentation Scheduled (Default Pipeline)\",\"decisionmakerboughtin\":\"Decision Maker Bought-In (Default Pipeline)\",\"contractsent\":\"Contract Sent (Default Pipeline)\",\"closedwon\":\"Closed Won (Default Pipeline)\",\"closedlost\":\"Closed Lost (Default Pipeline)\"}},\"amount\":{\"type\":\"string\",\"description\":\"The monetary value of the deal\"},...},\"required\":[\"dealname\",\"pipeline\",\"dealstage\"],\"examples\":[...]}}"
    }
  ]
}
```

#### Implementation Strategy

**Schema Registry Class:**
```typescript
class SchemaRegistry {
  private bcpCache = new Map<string, BCP>();
  private schemaCache = new Map<string, Map<string, InputSchema>>();
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
    const bcp = await this.loadBcp(domain);

    return bcp.tools.map(tool => {
      let schema = tool.inputSchema;

      // Apply context enrichment if requested
      if (includeContext && this.contextRegistry) {
        schema = this.applyContextEnrichment(domain, tool.name, schema);
      }

      return {
        name: tool.name,
        description: tool.description,
        schema: schema
      };
    });
  }

  /**
   * Get detailed schema for a specific operation
   */
  async getOperationSchema(
    domain: string,
    operation: string,
    includeContext: boolean = true
  ): Promise<OperationDetail> {
    const bcp = await this.loadBcp(domain);
    const tool = this.findTool(bcp, operation);

    if (!tool) {
      throw new Error(`Operation '${operation}' not found in domain '${domain}'`);
    }

    let schema = tool.inputSchema;

    // Apply context enrichment if requested
    if (includeContext && this.contextRegistry) {
      schema = this.applyContextEnrichment(domain, operation, schema);
    }

    return {
      domain,
      operation: tool.name,
      description: tool.description,
      schema: schema
    };
  }

  /**
   * Load BCP with caching (reuses BcpToolDelegator logic)
   */
  private async loadBcp(domain: string): Promise<BCP> {
    // Implementation mirrors BcpToolDelegator.loadBcp()
    // Returns cached BCP or loads via dynamic import
  }

  /**
   * Apply context provider enrichment to schema
   */
  private applyContextEnrichment(
    domain: string,
    operation: string,
    schema: InputSchema
  ): InputSchema {
    if (!this.contextRegistry) return schema;

    const enrichedSchema = JSON.parse(JSON.stringify(schema)); // Deep clone

    // Apply deal stage enrichment for Deals domain
    if (domain === 'Deals' && enrichedSchema.properties.dealstage) {
      const dealContext = this.contextRegistry.getContext('deals');
      if (dealContext) {
        enrichedSchema.properties.dealstage.enum = dealContext.validValues;
        enrichedSchema.properties.dealstage.enumDescriptions = dealContext.valueDescriptions;
      }
    }

    // Apply property group enrichment for Properties domain
    if (domain === 'Properties' && enrichedSchema.properties.groupName) {
      const propsContext = this.contextRegistry.getContext('properties');
      if (propsContext) {
        enrichedSchema.properties.groupName.enum = propsContext.validValues;
        enrichedSchema.properties.groupName.enumDescriptions = propsContext.valueDescriptions;
      }
    }

    // Apply blog enrichment for BlogPosts domain
    if (domain === 'BlogPosts' && enrichedSchema.properties.contentGroupId) {
      const blogsContext = this.contextRegistry.getContext('blogs');
      if (blogsContext) {
        enrichedSchema.properties.contentGroupId.enum = blogsContext.validValues;
        enrichedSchema.properties.contentGroupId.enumDescriptions = blogsContext.valueDescriptions;
      }
    }

    return enrichedSchema;
  }

  /**
   * Find tool in BCP using operation mapping logic
   */
  private findTool(bcp: BCP, operation: string): ToolDefinition | undefined {
    // First try direct match
    let tool = bcp.tools.find(t => t.name === operation);
    if (tool) return tool;

    // Try with operation mapping (from BcpToolDelegator)
    const mappedName = this.mapOperationToToolName(bcp.domain, operation);
    if (mappedName) {
      tool = bcp.tools.find(t => t.name === mappedName);
    }

    return tool;
  }

  /**
   * Map operation names to tool names (mirrors BcpToolDelegator logic)
   */
  private mapOperationToToolName(domain: string, operation: string): string | null {
    // Same mapping logic as BcpToolDelegator.mapOperationToToolName()
  }
}
```

**Tool Handler:**
```typescript
async function getToolsHandler(params: {
  domain?: string;
  operation?: string;
  includeContext?: boolean;
}): Promise<CallToolResult> {
  const registry = new SchemaRegistry(contextRegistry);
  const includeContext = params.includeContext !== false; // Default true

  try {
    // Case 1: No params - return all domains
    if (!params.domain) {
      const domains = await registry.getAllDomains();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            domains,
            totalDomains: domains.length,
            totalOperations: domains.reduce((sum, d) => sum + d.operationCount, 0)
          })
        }]
      };
    }

    // Case 2: Domain only - return all operations for domain
    if (!params.operation) {
      const operations = await registry.getDomainOperations(params.domain, includeContext);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            domain: params.domain,
            description: DOMAIN_CONFIGS[params.domain].description,
            operations
          })
        }]
      };
    }

    // Case 3: Domain + operation - return detailed schema
    const operationDetail = await registry.getOperationSchema(
      params.domain,
      params.operation,
      includeContext
    );
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(operationDetail)
      }]
    };
  } catch (error) {
    throw new Error(`Failed to get tools: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

---

### 1.2 hubspot_useTools

#### Purpose
Executes any HubSpot operation across all domains. Validates parameters, delegates to BCP tools, and maintains context/goals tracking for activity logging.

#### Tool Definition

**Tool Name:** `hubspot_useTools`

**Description:**
```
Execute any HubSpot operation across all 12 domains.

This is the universal tool for interacting with HubSpot. It handles all 72 operations including:
- CRM object management (Companies, Contacts, Deals, Notes, etc.)
- Associations between objects
- Custom properties and property groups
- Marketing tools (Emails, Blog Posts)
- Sales tools (Quotes with line items)
- List management (MANUAL, DYNAMIC, SNAPSHOT)
- Activity history tracking

Required workflow:
1. First call hubspot_getTools to discover available operations and their schemas
2. Then call this tool with the appropriate domain, operation, and parameters

The context and goals parameters help track your workflow and provide better error messages.
```

#### Input Schema

```typescript
{
  type: 'object',
  properties: {
    context: {
      type: 'string',
      description: 'Contextual information about the current task or workflow. Explain what you are trying to accomplish in the broader context. This helps with error messages and activity tracking. (REQUIRED)',
      minLength: 1
    },
    goals: {
      type: 'string',
      description: 'Specific goals or objectives for this operation. What are you trying to achieve with this particular API call? (REQUIRED)',
      minLength: 1
    },
    domain: {
      type: 'string',
      description: 'The HubSpot domain to operate on (REQUIRED)',
      enum: [
        'Companies', 'Contacts', 'Deals', 'Notes', 'Associations',
        'Products', 'Properties', 'Emails', 'BlogPosts', 'Quotes',
        'Lists', 'ActivityHistory'
      ]
    },
    operation: {
      type: 'string',
      description: 'The operation to perform within the domain (REQUIRED). Use hubspot_getTools to discover available operations.'
    },
    parameters: {
      type: 'object',
      description: 'Operation-specific parameters as defined by the operation schema. Use hubspot_getTools to discover required and optional parameters for each operation.',
      additionalProperties: true
    }
  },
  required: ['context', 'goals', 'domain', 'operation']
}
```

#### Validation Flow

```
1. Tool Handler Entry
   ↓
2. Validate context/goals (non-empty strings)
   ↓
3. Validate domain (exists in DOMAIN_CONFIGS)
   ↓
4. Delegate to BcpToolDelegator.delegate(domain, operation, {context, goals, ...parameters})
   ↓
5. Delegator validates context/goals (redundant but safe)
   ↓
6. Delegator loads BCP and finds tool
   ↓
7. Delegator validates parameters against tool.inputSchema
   ↓
8. Delegator executes tool handler
   ↓
9. Activity logging (with context/goals in metadata)
   ↓
10. Return result or error
```

#### Error Response Format

**Validation Errors:**
```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "Parameter validation failed for createAssociation:\n• Missing required parameter: fromObjectType\n• Parameter toObjectId must be a string\n\nUse hubspot_getTools with domain='Associations' and operation='create' to see the complete parameter schema."
  }]
}
```

**BCP Errors:**
```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "Failed to create contact note: Property hs_custom_field doesn't exist\n\nSuggestion: Use hubspot_useTools with domain='Properties' and operation='list' to see all available properties for contacts."
  }]
}
```

**Domain/Operation Not Found:**
```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "Operation 'createNote' not found in domain 'Notes'.\n\nAvailable operations for Notes domain:\n• get, update\n• createContactNote, createCompanyNote, createDealNote\n• listContactNotes, listCompanyNotes, listDealNotes\n\nUse hubspot_getTools to discover the correct operation name and its parameters."
  }]
}
```

#### Implementation Strategy

**Tool Handler:**
```typescript
async function useToolsHandler(params: {
  context: string;
  goals: string;
  domain: string;
  operation: string;
  parameters?: Record<string, any>;
}): Promise<CallToolResult> {
  // 1. Validate required parameters
  if (!params.context || typeof params.context !== 'string' || params.context.trim().length === 0) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: 'Missing required parameter: context (must be non-empty string)\n\n' +
              'The context parameter helps track your workflow. Provide a brief explanation of what you are trying to accomplish.'
      }]
    };
  }

  if (!params.goals || typeof params.goals !== 'string' || params.goals.trim().length === 0) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: 'Missing required parameter: goals (must be non-empty string)\n\n' +
              'The goals parameter helps track your specific objectives. Explain what you want to achieve with this API call.'
      }]
    };
  }

  // 2. Validate domain exists
  if (!DOMAIN_CONFIGS[params.domain]) {
    const availableDomains = Object.keys(DOMAIN_CONFIGS).join(', ');
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `Unknown domain: ${params.domain}\n\n` +
              `Available domains: ${availableDomains}\n\n` +
              'Use hubspot_getTools with no parameters to see all available domains and their operations.'
      }]
    };
  }

  // 3. Delegate to BcpToolDelegator
  try {
    const delegatorParams = {
      context: params.context,
      goals: params.goals,
      ...(params.parameters || {})
    };

    const result = await delegator.delegate(
      params.domain,
      params.operation,
      delegatorParams
    );

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result)
      }]
    };
  } catch (error) {
    // Enhanced error handling with helpful suggestions
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if operation not found
    if (errorMessage.includes('not found')) {
      const operations = DOMAIN_CONFIGS[params.domain].operations;
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Operation '${params.operation}' not found in domain '${params.domain}'.\n\n` +
                `Available operations for ${params.domain} domain:\n${operations.map(op => `• ${op}`).join('\n')}\n\n` +
                'Use hubspot_getTools to discover the correct operation name and its parameters.'
        }]
      };
    }

    // Check if validation error
    if (errorMessage.includes('validation failed')) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `${errorMessage}\n\n` +
                `Use hubspot_getTools with domain='${params.domain}' and operation='${params.operation}' to see the complete parameter schema.`
        }]
      };
    }

    // Generic error with suggestion
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `${errorMessage}\n\n` +
              'Use hubspot_getTools to verify the operation exists and review its parameter requirements.'
      }]
    };
  }
}
```

---

## 2. Schema Registry Design

### 2.1 Core Components

**SchemaRegistry Class** - Manages schema discovery and caching

**Responsibilities:**
1. Load BCPs dynamically (reuse BcpToolDelegator logic)
2. Extract schemas from BCP tools
3. Apply context provider enrichment
4. Cache schemas for performance
5. Handle operation name mapping

**Key Methods:**

```typescript
class SchemaRegistry {
  // Discovery methods
  async getAllDomains(): Promise<DomainSummary[]>
  async getDomainOperations(domain: string, includeContext: boolean): Promise<OperationSummary[]>
  async getOperationSchema(domain: string, operation: string, includeContext: boolean): Promise<OperationDetail>

  // BCP loading (mirrors delegator)
  private async loadBcp(domain: string): Promise<BCP>

  // Context enrichment
  private applyContextEnrichment(domain: string, operation: string, schema: InputSchema): InputSchema

  // Tool finding (mirrors delegator)
  private findTool(bcp: BCP, operation: string): ToolDefinition | undefined
  private mapOperationToToolName(domain: string, operation: string): string | null

  // Cache management
  clearCache(): void
  getCacheStats(): { bcpCount: number, schemaCount: number }
}
```

### 2.2 Type Definitions

```typescript
interface DomainSummary {
  name: string;
  description: string;
  operationCount: number;
  operations: string[];
}

interface OperationSummary {
  name: string;
  description: string;
  schema: InputSchema;
}

interface OperationDetail {
  domain: string;
  operation: string;
  description: string;
  schema: InputSchema;
}

// Context enrichment types
interface SchemaContext {
  validValues: string[];
  valueDescriptions: Record<string, string>;
}

interface ContextRegistry {
  getContext(contextKey: string): SchemaContext | null;
}
```

### 2.3 Caching Strategy

**Two-Level Cache:**

1. **BCP Cache** (inherited from delegator pattern)
   - Key: domain name
   - Value: BCP object with tools array
   - Invalidation: Manual clear or server restart
   - Shared with BcpToolDelegator (singleton pattern)

2. **Schema Cache** (new for meta-tools)
   - Key: `${domain}:${operation}:${includeContext}`
   - Value: Enriched InputSchema
   - Invalidation: Manual clear or context update
   - Size limit: 200 entries (72 operations × 2 context states = 144 + buffer)

**Cache Implementation:**
```typescript
private bcpCache = new Map<string, BCP>();
private schemaCache = new Map<string, InputSchema>();

private getSchemaCacheKey(domain: string, operation: string, includeContext: boolean): string {
  return `${domain}:${operation}:${includeContext}`;
}

async getOperationSchema(domain: string, operation: string, includeContext: boolean): Promise<OperationDetail> {
  const cacheKey = this.getSchemaCacheKey(domain, operation, includeContext);

  // Check cache
  if (this.schemaCache.has(cacheKey)) {
    return {
      domain,
      operation,
      description: '...', // Need to cache description too
      schema: this.schemaCache.get(cacheKey)!
    };
  }

  // Generate schema
  const bcp = await this.loadBcp(domain);
  const tool = this.findTool(bcp, operation);
  if (!tool) throw new Error(`Operation not found: ${operation}`);

  let schema = tool.inputSchema;
  if (includeContext && this.contextRegistry) {
    schema = this.applyContextEnrichment(domain, operation, schema);
  }

  // Cache result
  this.schemaCache.set(cacheKey, schema);

  return { domain, operation: tool.name, description: tool.description, schema };
}
```

### 2.4 Operation Name Mapping

**Challenge:** Some domains use descriptive tool names (e.g., `createAssociation`) while DOMAIN_CONFIGS uses short operation names (e.g., `create`).

**Solution:** Reuse BcpToolDelegator's mapping logic

**Mapping Table (from BcpToolDelegator):**

| Domain | Operation (short) | Tool Name (actual) |
|--------|------------------|-------------------|
| Associations | create | createAssociation |
| Associations | batchCreate | batchCreateAssociations |
| Associations | list | listAssociations |
| Properties | list | listProperties |
| Properties | get | getProperty |
| Properties | create | createProperty |
| Properties | update | updateProperty |
| Properties | search | searchProperties |
| Notes | (all) | (direct match) |
| Companies | (all) | (direct match) |
| Contacts | (all) | (direct match) |

**Implementation:**
```typescript
private findTool(bcp: BCP, operation: string): ToolDefinition | undefined {
  // First try direct match
  let tool = bcp.tools.find(t => t.name === operation);
  if (tool) return tool;

  // Try with operation mapping
  const mappedName = this.mapOperationToToolName(bcp.domain, operation);
  if (mappedName) {
    tool = bcp.tools.find(t => t.name === mappedName);
  }

  return tool;
}

private mapOperationToToolName(domain: string, operation: string): string | null {
  // Copy exact logic from BcpToolDelegator.mapOperationToToolName()
  const operationMappings: Record<string, Record<string, string>> = {
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

  return operationMappings[domain]?.[operation] || null;
}
```

---

## 3. Context Provider Integration

### 3.1 Current Context Providers

**DealPipelineContextProvider:**
- Fetches all pipelines and stages at server startup
- Provides valid `dealstage` values with descriptions
- Example: "appointmentscheduled" → "Appointment Scheduled (Default Pipeline)"

**Property Groups (implicit):**
- Fetched at server startup
- Cached in server instance
- Provides valid `groupName` values for Properties domain

**Blog Groups (implicit):**
- Fetched at server startup
- Cached in server instance
- Provides valid `contentGroupId` values for BlogPosts domain

### 3.2 Integration Strategy

**Schema Enrichment Flow:**

```
1. LLM calls hubspot_getTools with domain + operation
   ↓
2. SchemaRegistry.getOperationSchema() loads base schema from BCP tool
   ↓
3. If includeContext=true, applyContextEnrichment() is called
   ↓
4. For each property in schema:
   a. Check if domain + property matches context provider pattern
   b. Fetch context from ContextRegistry
   c. Inject enum values and descriptions into schema
   ↓
5. Return enriched schema to LLM
   ↓
6. LLM sees valid values and descriptions in schema
   ↓
7. LLM calls hubspot_useTools with appropriate parameter values
```

**Context Application Logic:**

```typescript
private applyContextEnrichment(
  domain: string,
  operation: string,
  schema: InputSchema
): InputSchema {
  if (!this.contextRegistry) return schema;

  const enrichedSchema = JSON.parse(JSON.stringify(schema)); // Deep clone

  // Deal stage enrichment
  if (domain === 'Deals' && enrichedSchema.properties.dealstage) {
    const dealContext = this.contextRegistry.getContext('deals');
    if (dealContext) {
      enrichedSchema.properties.dealstage.enum = dealContext.validValues;
      // Add custom field for descriptions (MCP extension)
      enrichedSchema.properties.dealstage.enumDescriptions = dealContext.valueDescriptions;
    }
  }

  // Property group enrichment
  if (domain === 'Properties' && enrichedSchema.properties.groupName) {
    const propsContext = this.contextRegistry.getContext('properties');
    if (propsContext) {
      enrichedSchema.properties.groupName.enum = propsContext.validValues;
      enrichedSchema.properties.groupName.enumDescriptions = propsContext.valueDescriptions;
    }
  }

  // Blog group enrichment
  if (domain === 'BlogPosts' && enrichedSchema.properties.contentGroupId) {
    const blogsContext = this.contextRegistry.getContext('blogs');
    if (blogsContext) {
      enrichedSchema.properties.contentGroupId.enum = blogsContext.validValues;
      enrichedSchema.properties.contentGroupId.enumDescriptions = blogsContext.valueDescriptions;
    }
  }

  return enrichedSchema;
}
```

### 3.3 Context Registry Interface

**Existing Interface (to be preserved):**

```typescript
interface ContextRegistry {
  getContext(contextKey: string): SchemaContext | null;
  registerProvider(key: string, provider: ContextProvider): void;
  initialize(): Promise<void>;
}

interface SchemaContext {
  validValues: string[];
  valueDescriptions: Record<string, string>;
}

interface ContextProvider {
  getContext(): Promise<SchemaContext>;
}
```

**Context Keys:**
- `'deals'` → DealPipelineContextProvider
- `'properties'` → PropertyGroupContextProvider (implicit)
- `'blogs'` → BlogGroupContextProvider (implicit)

---

## 4. Implementation Plan

### 4.1 Files to Create

**1. Schema Registry**
- **Path:** `/src/core/schema-registry.ts`
- **Purpose:** Manage schema discovery and caching
- **Dependencies:** BcpToolDelegator, ContextRegistry, types
- **Lines of Code:** ~400
- **Complexity:** HIGH

**2. Meta-Tools Handler**
- **Path:** `/src/core/meta-tools-handler.ts`
- **Purpose:** Implement getTools and useTools handlers
- **Dependencies:** SchemaRegistry, BcpToolDelegator
- **Lines of Code:** ~300
- **Complexity:** MEDIUM

**3. Updated Factory**
- **Path:** `/src/core/tool-registration-factory-v2.ts` (parallel deployment)
- **Purpose:** Register meta-tools instead of domain tools
- **Dependencies:** MetaToolsHandler, SchemaRegistry
- **Lines of Code:** ~200
- **Complexity:** MEDIUM

### 4.2 Files to Modify

**1. BcpToolDelegator** (MINOR)
- **Path:** `/src/core/bcp-tool-delegator.ts`
- **Changes:**
  - Extract `loadBcp()` to be reusable by SchemaRegistry
  - Extract `mapOperationToToolName()` to shared utility
  - Add `getBcp()` public method for SchemaRegistry
- **Lines Changed:** ~20
- **Complexity:** LOW

**2. Type Definitions** (MINOR)
- **Path:** `/src/core/types.ts`
- **Changes:**
  - Add DomainSummary, OperationSummary, OperationDetail types
  - Add MetaToolResult type
- **Lines Changed:** ~30
- **Complexity:** LOW

**3. HTTP Server SDK** (MINOR)
- **Path:** `/src/http-server-sdk.ts`
- **Changes:**
  - Create separate registration path for meta-tools
  - Add feature flag: `USE_META_TOOLS` environment variable
  - Register 2 meta-tools if flag=true, else register 12 domain tools
- **Lines Changed:** ~40
- **Complexity:** LOW

**4. Context Registry** (MINOR)
- **Path:** `/src/core/context/index.ts`
- **Changes:**
  - Expose SchemaContext type
  - Ensure getContext() is public and documented
- **Lines Changed:** ~10
- **Complexity:** LOW

### 4.3 Implementation Order

**Phase 1: Foundation (Days 1-2)**

1. **Create SchemaRegistry class**
   - Implement BCP loading (copy from delegator)
   - Implement schema extraction from tools
   - Implement operation name mapping
   - Add basic caching
   - **Testing:** Unit tests for schema extraction

2. **Create MetaToolsHandler**
   - Implement getToolsHandler (all 3 cases)
   - Implement useToolsHandler
   - Implement error handling with helpful messages
   - **Testing:** Unit tests for each handler case

**Phase 2: Integration (Day 3)**

3. **Integrate Context Providers**
   - Add applyContextEnrichment to SchemaRegistry
   - Test with DealPipelineContextProvider
   - Test with property groups
   - Test with blog groups
   - **Testing:** Integration tests with live context data

4. **Update BcpToolDelegator**
   - Refactor to share loadBcp() logic
   - Add getBcp() method
   - **Testing:** Ensure existing tests still pass

**Phase 3: Registration (Day 4)**

5. **Create ToolRegistrationFactoryV2**
   - Implement registerMetaTools() method
   - Wire up SchemaRegistry and MetaToolsHandler
   - Create proper Zod schemas for both meta-tools
   - **Testing:** Integration test with MCP server

6. **Update HTTP Server SDK**
   - Add USE_META_TOOLS feature flag
   - Implement conditional registration
   - Update health check endpoint
   - **Testing:** Test both registration paths

**Phase 4: Testing & Documentation (Day 5)**

7. **Comprehensive Testing**
   - Test all 72 operations via meta-tools
   - Test context enrichment for all providers
   - Test error messages for all error cases
   - Performance testing (latency comparison)
   - **Testing:** Full integration test suite

8. **Update Documentation**
   - Update README with meta-tools usage
   - Create migration guide
   - Document feature flag
   - Add example workflows
   - **Documentation:** Complete

### 4.4 Migration Strategy

**Parallel Deployment:**

**Step 1: Deploy with Both Architectures (Week 1)**
- Set `USE_META_TOOLS=false` in production (default)
- Both tool sets available in code
- Monitor performance and stability

**Step 2: Beta Testing (Week 2)**
- Enable `USE_META_TOOLS=true` in staging environment
- Test with real LLM workflows
- Gather feedback on discoverability
- Fix any issues discovered

**Step 3: Gradual Rollout (Week 3)**
- Enable meta-tools for 10% of production traffic
- Monitor error rates and latency
- Compare activity logs between architectures
- Increase to 50% if metrics are good

**Step 4: Full Migration (Week 4)**
- Enable `USE_META_TOOLS=true` for 100% of traffic
- Deprecate old domain tools (mark in docs)
- Set sunset date for old architecture (30 days)

**Step 5: Cleanup (Week 5)**
- Remove old ToolRegistrationFactory
- Remove DOMAIN_CONFIGS static registry
- Remove getDomainSpecificParams() switch statement
- Simplify codebase

---

## 5. Example Flows

### 5.1 Flow 1: Discover and Create Association

**Step 1: Discover Associations Operations**

**LLM Request:**
```json
{
  "name": "hubspot_getTools",
  "arguments": {
    "domain": "Associations"
  }
}
```

**Server Response:**
```json
{
  "content": [{
    "type": "text",
    "text": "{\"domain\":\"Associations\",\"description\":\"HubSpot object association management with batch operations\",\"operations\":[{\"name\":\"create\",\"description\":\"Create an association between two objects in HubSpot\",\"schema\":{\"type\":\"object\",\"properties\":{\"fromObjectType\":{\"type\":\"string\",\"description\":\"The type of the first object (e.g., 'contacts', 'companies')\"},\"fromObjectId\":{\"type\":\"string\",\"description\":\"The ID of the first object\"},\"toObjectType\":{\"type\":\"string\",\"description\":\"The type of the second object\"},\"toObjectId\":{\"type\":\"string\",\"description\":\"The ID of the second object\"},\"associationTypes\":{\"type\":\"array\",\"description\":\"The types of associations to create\",\"items\":{\"type\":\"object\",\"properties\":{\"associationCategory\":{\"type\":\"string\",\"description\":\"The category of the association\",\"enum\":[\"HUBSPOT_DEFINED\",\"USER_DEFINED\",\"INTEGRATOR_DEFINED\"]},\"associationTypeId\":{\"type\":\"integer\",\"description\":\"The ID of the association type\"}},\"required\":[\"associationCategory\",\"associationTypeId\"]}}},\"required\":[\"fromObjectType\",\"fromObjectId\",\"toObjectType\",\"toObjectId\",\"associationTypes\"],\"examples\":[{\"fromObjectType\":\"contacts\",\"fromObjectId\":\"123\",\"toObjectType\":\"companies\",\"toObjectId\":\"456\",\"associationTypes\":[{\"associationCategory\":\"HUBSPOT_DEFINED\",\"associationTypeId\":1}]}]}},{\"name\":\"createDefault\",\"description\":\"...\"}]}"
  }]
}
```

**Step 2: Create Association**

**LLM Request:**
```json
{
  "name": "hubspot_useTools",
  "arguments": {
    "context": "User wants to associate contact Jane Doe with her company Acme Corp",
    "goals": "Create a default association between the contact and company to link them in the CRM",
    "domain": "Associations",
    "operation": "create",
    "parameters": {
      "fromObjectType": "contacts",
      "fromObjectId": "12345",
      "toObjectType": "companies",
      "toObjectId": "67890",
      "associationTypes": [
        {
          "associationCategory": "HUBSPOT_DEFINED",
          "associationTypeId": 1
        }
      ]
    }
  }
}
```

**Server Processing:**
```
1. useToolsHandler validates context/goals ✓
2. useToolsHandler validates domain='Associations' ✓
3. Delegates to delegator.delegate('Associations', 'create', {...params})
4. Delegator validates context/goals ✓
5. Delegator loads Associations BCP (cached)
6. Delegator maps 'create' → 'createAssociation' tool
7. Delegator validates parameters against createAssociation.inputSchema ✓
8. Delegator executes createAssociation handler
9. Handler calls AssociationsService.createAssociation()
10. ActivityHistoryService logs activity with context/goals
11. Result returned to LLM
```

**Server Response:**
```json
{
  "content": [{
    "type": "text",
    "text": "{\"message\":\"Successfully created association between contacts/12345 and companies/67890\",\"details\":{\"fromObjectType\":\"contacts\",\"fromObjectId\":\"12345\",\"toObjectType\":\"companies\",\"toObjectId\":\"67890\",\"associationTypes\":[{\"associationCategory\":\"HUBSPOT_DEFINED\",\"associationTypeId\":1}]}}"
  }]
}
```

---

### 5.2 Flow 2: Create Deal with Context-Enriched Schema

**Step 1: Get Deal Create Schema**

**LLM Request:**
```json
{
  "name": "hubspot_getTools",
  "arguments": {
    "domain": "Deals",
    "operation": "create",
    "includeContext": true
  }
}
```

**Server Processing:**
```
1. SchemaRegistry.getOperationSchema('Deals', 'create', true)
2. Load Deals BCP (cached)
3. Find 'create' tool (direct match)
4. Extract base schema from tool.inputSchema
5. applyContextEnrichment('Deals', 'create', schema)
   - Detect dealstage property
   - Fetch context from contextRegistry.getContext('deals')
   - DealPipelineContextProvider returns live deal stages from HubSpot
   - Inject enum and enumDescriptions into schema
6. Return enriched schema
```

**Server Response:**
```json
{
  "content": [{
    "type": "text",
    "text": "{\"domain\":\"Deals\",\"operation\":\"create\",\"description\":\"Create a new deal in HubSpot\",\"schema\":{\"type\":\"object\",\"properties\":{\"dealname\":{\"type\":\"string\",\"description\":\"The name of the deal\"},\"pipeline\":{\"type\":\"string\",\"description\":\"The pipeline for the deal\"},\"dealstage\":{\"type\":\"string\",\"description\":\"The stage of the deal in the pipeline\",\"enum\":[\"appointmentscheduled\",\"qualifiedtobuy\",\"presentationscheduled\",\"decisionmakerboughtin\",\"contractsent\",\"closedwon\",\"closedlost\"],\"enumDescriptions\":{\"appointmentscheduled\":\"Appointment Scheduled (Default Pipeline)\",\"qualifiedtobuy\":\"Qualified to Buy (Default Pipeline)\",\"presentationscheduled\":\"Presentation Scheduled (Default Pipeline)\",\"decisionmakerboughtin\":\"Decision Maker Bought-In (Default Pipeline)\",\"contractsent\":\"Contract Sent (Default Pipeline)\",\"closedwon\":\"Closed Won (Default Pipeline)\",\"closedlost\":\"Closed Lost (Default Pipeline)\"}},\"amount\":{\"type\":\"string\",\"description\":\"The monetary value of the deal\"},\"closedate\":{\"type\":\"string\",\"description\":\"The expected close date (YYYY-MM-DD)\"},\"description\":{\"type\":\"string\",\"description\":\"Description of the deal\"},\"hubspot_owner_id\":{\"type\":\"string\",\"description\":\"The ID of the deal owner\"},\"additionalProperties\":{\"type\":\"object\",\"description\":\"Additional deal properties\"}},\"required\":[\"dealname\",\"pipeline\",\"dealstage\"],\"examples\":[{\"dealname\":\"Q4 Enterprise Deal\",\"pipeline\":\"default\",\"dealstage\":\"appointmentscheduled\",\"amount\":\"50000\",\"closedate\":\"2025-12-31\"}]}}"
  }]
}
```

**Step 2: Create Deal with Valid Stage**

**LLM Request:**
```json
{
  "name": "hubspot_useTools",
  "arguments": {
    "context": "Creating a new sales opportunity for enterprise client following initial discovery call",
    "goals": "Create deal in CRM to track the opportunity through the sales pipeline",
    "domain": "Deals",
    "operation": "create",
    "parameters": {
      "dealname": "Acme Corp - Enterprise License",
      "pipeline": "default",
      "dealstage": "appointmentscheduled",
      "amount": "75000",
      "closedate": "2026-03-31",
      "description": "Enterprise license deal for 500 users"
    }
  }
}
```

**Server Response:**
```json
{
  "content": [{
    "type": "text",
    "text": "{\"success\":true,\"data\":{\"id\":\"98765\",\"properties\":{\"dealname\":\"Acme Corp - Enterprise License\",\"pipeline\":\"default\",\"dealstage\":\"appointmentscheduled\",\"amount\":\"75000\",\"closedate\":\"2026-03-31\",\"description\":\"Enterprise license deal for 500 users\"}},\"message\":\"Successfully created deal\",\"suggestions\":[\"💡 Associate deal: {operation: 'create', domain: 'Associations', parameters: {fromObjectType: 'deals', fromObjectId: '98765', toObjectType: 'contacts', toObjectId: '...'}}\" ]}"
  }]
}
```

---

### 5.3 Flow 3: Error Handling - Missing Required Parameter

**LLM Request:**
```json
{
  "name": "hubspot_useTools",
  "arguments": {
    "context": "Creating association between contact and company",
    "goals": "Link contact to their employer in HubSpot",
    "domain": "Associations",
    "operation": "create",
    "parameters": {
      "fromObjectType": "contacts",
      "fromObjectId": "12345",
      "toObjectType": "companies"
      // Missing: toObjectId and associationTypes
    }
  }
}
```

**Server Processing:**
```
1. useToolsHandler validates context/goals ✓
2. useToolsHandler validates domain ✓
3. Delegates to delegator.delegate()
4. Delegator loads Associations BCP
5. Delegator maps 'create' → 'createAssociation'
6. Delegator validates parameters against tool.inputSchema
   - VALIDATION FAILS: Missing toObjectId, associationTypes
7. Delegator throws validation error
8. useToolsHandler catches error, enhances with suggestions
```

**Server Response:**
```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "Parameter validation failed for createAssociation:\n• Missing required parameter: toObjectId\n• Missing required parameter: associationTypes\n\nUse hubspot_getTools with domain='Associations' and operation='create' to see the complete parameter schema."
  }]
}
```

---

### 5.4 Flow 4: Error Handling - Invalid Operation Name

**LLM Request:**
```json
{
  "name": "hubspot_useTools",
  "arguments": {
    "context": "Creating a note for a contact",
    "goals": "Document phone call conversation in CRM",
    "domain": "Notes",
    "operation": "create",
    "parameters": {
      "contactId": "12345",
      "content": "Discussed Q1 renewal options"
    }
  }
}
```

**Server Processing:**
```
1. useToolsHandler validates context/goals ✓
2. useToolsHandler validates domain ✓
3. Delegates to delegator.delegate('Notes', 'create', {...})
4. Delegator loads Notes BCP
5. Delegator tries to find 'create' tool
6. No direct match found
7. Delegator tries mapOperationToToolName('Notes', 'create')
8. Returns null (Notes doesn't have generic 'create')
9. Tool not found - delegator throws error
10. useToolsHandler catches, detects "not found" in message
11. Enhances error with available operations list
```

**Server Response:**
```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "Operation 'create' not found in domain 'Notes'.\n\nAvailable operations for Notes domain:\n• get\n• update\n• createContactNote\n• createCompanyNote\n• createDealNote\n• listContactNotes\n• listCompanyNotes\n• listDealNotes\n\nUse hubspot_getTools to discover the correct operation name and its parameters."
  }]
}
```

---

## 6. Technical Specifications

### 6.1 Performance Requirements

**Schema Discovery:**
- First call (cold cache): < 500ms
- Subsequent calls (warm cache): < 50ms
- Context enrichment overhead: < 100ms

**Tool Execution:**
- No additional latency vs current architecture
- Delegator path remains identical
- Activity logging unchanged

**Memory Usage:**
- BCP cache: ~2MB (shared with delegator)
- Schema cache: ~500KB (200 entries × ~2.5KB each)
- Total overhead: < 3MB

### 6.2 Scalability Considerations

**Concurrent Requests:**
- Schema cache is read-heavy (no write locks needed)
- BCP cache shared singleton (already thread-safe via Node.js event loop)
- No bottlenecks introduced

**Cache Invalidation:**
- Manual clear via admin endpoint
- Automatic clear on context provider update
- TTL not needed (schemas are static except for context enrichment)

**Horizontal Scaling:**
- Each instance maintains independent caches
- Context providers fetch independently (cached per instance)
- No shared state required between instances

### 6.3 Error Handling Matrix

| Error Type | Detection Point | Error Message Pattern | Suggested Action |
|-----------|----------------|----------------------|------------------|
| Missing context | useToolsHandler | "Missing required parameter: context" | Provide contextual information |
| Missing goals | useToolsHandler | "Missing required parameter: goals" | Provide specific goals |
| Invalid domain | useToolsHandler | "Unknown domain: X" | Use hubspot_getTools to see domains |
| Operation not found | BcpToolDelegator | "Operation 'X' not found in domain 'Y'" | Use hubspot_getTools to see operations |
| Missing required param | BcpToolDelegator | "Missing required parameter: X" | Use hubspot_getTools to see schema |
| Invalid param type | BcpToolDelegator | "Parameter X must be a Y" | Use hubspot_getTools to see schema |
| API error | BCP tool handler | "Failed to Z: error message" | Check HubSpot API status |
| Auth error | BCP tool handler | "HubSpot access token is missing" | Configure HUBSPOT_ACCESS_TOKEN |

### 6.4 Type Safety

**Full TypeScript Coverage:**

```typescript
// Schema Registry
class SchemaRegistry {
  async getAllDomains(): Promise<DomainSummary[]>
  async getDomainOperations(domain: string, includeContext: boolean): Promise<OperationSummary[]>
  async getOperationSchema(domain: string, operation: string, includeContext: boolean): Promise<OperationDetail>
}

// Meta-Tools Handler
async function getToolsHandler(params: GetToolsParams): Promise<CallToolResult>
async function useToolsHandler(params: UseToolsParams): Promise<CallToolResult>

// Parameter Types
interface GetToolsParams {
  domain?: string;
  operation?: string;
  includeContext?: boolean;
}

interface UseToolsParams {
  context: string;
  goals: string;
  domain: string;
  operation: string;
  parameters?: Record<string, any>;
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

**SchemaRegistry Tests:**
```typescript
describe('SchemaRegistry', () => {
  it('should load all domains', async () => {
    const domains = await registry.getAllDomains();
    expect(domains).toHaveLength(12);
    expect(domains[0]).toHaveProperty('name');
    expect(domains[0]).toHaveProperty('operations');
  });

  it('should get domain operations', async () => {
    const ops = await registry.getDomainOperations('Associations', false);
    expect(ops).toHaveLength(8);
    expect(ops[0].schema).toBeDefined();
  });

  it('should enrich schema with context', async () => {
    const detail = await registry.getOperationSchema('Deals', 'create', true);
    expect(detail.schema.properties.dealstage.enum).toBeDefined();
    expect(detail.schema.properties.dealstage.enumDescriptions).toBeDefined();
  });

  it('should handle operation name mapping', async () => {
    const detail = await registry.getOperationSchema('Associations', 'create', false);
    expect(detail.operation).toBe('createAssociation');
  });

  it('should cache schemas', async () => {
    await registry.getOperationSchema('Companies', 'create', true);
    const stats = registry.getCacheStats();
    expect(stats.schemaCount).toBeGreaterThan(0);
  });
});
```

**MetaToolsHandler Tests:**
```typescript
describe('getToolsHandler', () => {
  it('should return all domains with no params', async () => {
    const result = await getToolsHandler({});
    const data = JSON.parse(result.content[0].text);
    expect(data.domains).toHaveLength(12);
  });

  it('should return operations for domain', async () => {
    const result = await getToolsHandler({ domain: 'Contacts' });
    const data = JSON.parse(result.content[0].text);
    expect(data.operations).toHaveLength(5);
  });

  it('should return detailed schema for operation', async () => {
    const result = await getToolsHandler({
      domain: 'Associations',
      operation: 'create'
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.schema.required).toContain('fromObjectType');
  });
});

describe('useToolsHandler', () => {
  it('should reject missing context', async () => {
    const result = await useToolsHandler({
      goals: 'test',
      domain: 'Companies',
      operation: 'create',
      context: '', // Empty
      parameters: {}
    });
    expect(result.isError).toBe(true);
  });

  it('should reject invalid domain', async () => {
    const result = await useToolsHandler({
      context: 'test',
      goals: 'test',
      domain: 'InvalidDomain',
      operation: 'create',
      parameters: {}
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown domain');
  });

  it('should delegate to BcpToolDelegator', async () => {
    const spy = jest.spyOn(delegator, 'delegate');
    await useToolsHandler({
      context: 'test',
      goals: 'test',
      domain: 'Companies',
      operation: 'get',
      parameters: { id: '123' }
    });
    expect(spy).toHaveBeenCalledWith('Companies', 'get', expect.any(Object));
  });
});
```

### 7.2 Integration Tests

**End-to-End Workflow Tests:**
```typescript
describe('Meta-Tools E2E', () => {
  it('should discover and execute association creation', async () => {
    // Step 1: Discover
    const getTools = await getToolsHandler({
      domain: 'Associations',
      operation: 'create'
    });
    const schema = JSON.parse(getTools.content[0].text);
    expect(schema.schema.required).toContain('associationTypes');

    // Step 2: Execute
    const useTools = await useToolsHandler({
      context: 'E2E test',
      goals: 'Create association',
      domain: 'Associations',
      operation: 'create',
      parameters: {
        fromObjectType: 'contacts',
        fromObjectId: 'test-123',
        toObjectType: 'companies',
        toObjectId: 'test-456',
        associationTypes: [{
          associationCategory: 'HUBSPOT_DEFINED',
          associationTypeId: 1
        }]
      }
    });
    expect(useTools.isError).toBeFalsy();
  });

  it('should handle all 72 operations', async () => {
    const domains = await registry.getAllDomains();
    for (const domain of domains) {
      for (const operation of domain.operations) {
        const schema = await registry.getOperationSchema(
          domain.name,
          operation,
          true
        );
        expect(schema.schema).toBeDefined();
      }
    }
  });
});
```

### 7.3 Performance Tests

```typescript
describe('Performance', () => {
  it('should load schemas in under 500ms (cold cache)', async () => {
    registry.clearCache();
    const start = Date.now();
    await registry.getOperationSchema('Deals', 'create', true);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  it('should load schemas in under 50ms (warm cache)', async () => {
    await registry.getOperationSchema('Deals', 'create', true); // Warm up
    const start = Date.now();
    await registry.getOperationSchema('Deals', 'create', true);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(50);
  });

  it('should handle 100 concurrent requests', async () => {
    const promises = Array(100).fill(null).map((_, i) =>
      registry.getOperationSchema('Companies', 'create', true)
    );
    await expect(Promise.all(promises)).resolves.toBeDefined();
  });
});
```

---

## 8. Migration Guide

### 8.1 For Developers

**Enabling Meta-Tools:**

1. Set environment variable:
   ```bash
   export USE_META_TOOLS=true
   ```

2. Restart server:
   ```bash
   npm run start
   ```

3. Verify in health check:
   ```bash
   curl http://localhost:3000/health
   # Should show: "toolCount": 2
   ```

**Disabling Meta-Tools (rollback):**

1. Unset or set to false:
   ```bash
   export USE_META_TOOLS=false
   ```

2. Restart server - will use original 12 domain tools

**Testing Both Architectures:**

```typescript
// Test with meta-tools
process.env.USE_META_TOOLS = 'true';
const metaServer = await createMcpServer();

// Test with domain tools
process.env.USE_META_TOOLS = 'false';
const domainServer = await createMcpServer();

// Compare results
const metaResult = await callTool(metaServer, 'hubspot_useTools', {...});
const domainResult = await callTool(domainServer, 'hubspotCompanies', {...});
expect(metaResult).toEqual(domainResult);
```

### 8.2 For LLM Integrators

**Old Pattern (Domain Tools):**
```json
{
  "name": "hubspotAssociations",
  "arguments": {
    "context": "...",
    "goals": "...",
    "operation": "create",
    "fromObjectType": "contacts",
    "fromObjectId": "123",
    "toObjectType": "companies",
    "toObjectId": "456",
    "associationTypes": [...]
  }
}
```

**New Pattern (Meta-Tools):**
```json
// Step 1: Discover
{
  "name": "hubspot_getTools",
  "arguments": {
    "domain": "Associations",
    "operation": "create"
  }
}

// Step 2: Execute
{
  "name": "hubspot_useTools",
  "arguments": {
    "context": "...",
    "goals": "...",
    "domain": "Associations",
    "operation": "create",
    "parameters": {
      "fromObjectType": "contacts",
      "fromObjectId": "123",
      "toObjectType": "companies",
      "toObjectId": "456",
      "associationTypes": [...]
    }
  }
}
```

**Key Differences:**
1. Two-step process (discover + execute) vs one-step
2. Parameters nested under `parameters` key
3. `domain` and `operation` are top-level in useTools
4. `context` and `goals` remain at top level

---

## 9. Risk Assessment & Mitigation

### 9.1 Technical Risks

**Risk 1: Schema Mismatch Between Registry and Actual Tools**

- **Impact:** HIGH
- **Probability:** MEDIUM
- **Mitigation:**
  - Extract schemas directly from BCP tools at runtime (source of truth)
  - Comprehensive integration tests covering all 72 operations
  - Schema validation in CI/CD pipeline

**Risk 2: Context Provider Failures**

- **Impact:** MEDIUM
- **Probability:** LOW
- **Mitigation:**
  - Graceful degradation (return base schema if enrichment fails)
  - Retry logic for context provider API calls
  - Cache fallback to last successful enrichment

**Risk 3: Performance Degradation**

- **Impact:** MEDIUM
- **Probability:** LOW
- **Mitigation:**
  - Multi-level caching (BCP + schema)
  - Performance tests in CI/CD
  - Monitoring and alerting on latency metrics

**Risk 4: Breaking Changes for Existing Integrations**

- **Impact:** HIGH
- **Probability:** LOW (with parallel deployment)
- **Mitigation:**
  - Feature flag for gradual rollout
  - Maintain old architecture in parallel
  - 30-day deprecation notice before removal

### 9.2 Operational Risks

**Risk 1: Incomplete Testing**

- **Impact:** HIGH
- **Probability:** MEDIUM
- **Mitigation:**
  - Test all 72 operations systematically
  - E2E tests with real HubSpot API
  - Staging environment testing before production

**Risk 2: Documentation Gaps**

- **Impact:** MEDIUM
- **Probability:** MEDIUM
- **Mitigation:**
  - Comprehensive migration guide
  - Example workflows for common use cases
  - Updated README and API docs

**Risk 3: Rollback Complexity**

- **Impact:** LOW
- **Probability:** LOW
- **Mitigation:**
  - Feature flag enables instant rollback
  - Both architectures maintained in parallel
  - Database schema unchanged (activity logging compatible)

---

## 10. Success Criteria

### 10.1 Functional Requirements

- ✅ All 72 operations accessible via meta-tools
- ✅ Schema discovery returns accurate InputSchema from BCP tools
- ✅ Context enrichment works for all providers (deals, properties, blogs)
- ✅ Error messages include helpful suggestions
- ✅ Activity logging preserves context/goals metadata
- ✅ Operation name mapping handled correctly

### 10.2 Performance Requirements

- ✅ Schema discovery (cold): < 500ms
- ✅ Schema discovery (warm): < 50ms
- ✅ Tool execution latency: same as current architecture
- ✅ Memory overhead: < 5MB
- ✅ Concurrent requests: 100+ without degradation

### 10.3 Quality Requirements

- ✅ 100% test coverage for SchemaRegistry
- ✅ 100% test coverage for MetaToolsHandler
- ✅ All 72 operations tested via integration tests
- ✅ Zero BCP tool modifications
- ✅ TypeScript strict mode compliance
- ✅ No linting errors

### 10.4 Documentation Requirements

- ✅ Complete architecture document (this file)
- ✅ Updated README with meta-tools usage
- ✅ Migration guide for developers
- ✅ Example workflows for common operations
- ✅ API reference for both meta-tools

---

## 11. Future Enhancements

### 11.1 Phase 2 Enhancements

**Enhanced Discovery:**
- Add search/filter to getTools (e.g., "find all operations that accept contactId")
- Operation categorization (CRUD, Search, Batch, etc.)
- Dependency graph (operation X requires operation Y first)

**Improved Context:**
- Dynamic suggestions based on operation (e.g., "create deal" suggests "then create association")
- Workflow templates (e.g., "full contact creation workflow")
- Parameter auto-completion from recent activity

**Performance:**
- Redis-backed shared cache for multi-instance deployments
- Prefetch popular operations at startup
- Stream large schemas instead of JSON.stringify

### 11.2 Phase 3 Enhancements

**Schema Evolution:**
- Version tracking for schema changes
- Changelog for API updates
- Automatic migration suggestions

**Analytics:**
- Track most-used operations
- Identify common error patterns
- Suggest missing operations based on usage

**Developer Experience:**
- CLI tool for testing operations
- Postman collection generator
- Interactive schema explorer UI

---

## Appendix A: File Structure

```
/src/
├── core/
│   ├── schema-registry.ts              (NEW - 400 LOC)
│   ├── meta-tools-handler.ts           (NEW - 300 LOC)
│   ├── tool-registration-factory-v2.ts (NEW - 200 LOC)
│   ├── bcp-tool-delegator.ts           (MODIFY - 20 lines)
│   ├── types.ts                        (MODIFY - 30 lines)
│   └── context/
│       └── index.ts                    (MODIFY - 10 lines)
├── http-server-sdk.ts                  (MODIFY - 40 lines)
└── bcps/                               (NO CHANGES)
    ├── Companies/
    ├── Contacts/
    ├── Deals/
    ├── Notes/
    ├── Associations/
    ├── Products/
    ├── Properties/
    ├── Emails/
    ├── BlogPosts/
    ├── Quotes/
    ├── ActivityHistory/
    └── Lists/

/tests/
├── schema-registry.test.ts             (NEW - 200 LOC)
├── meta-tools-handler.test.ts          (NEW - 300 LOC)
└── meta-tools-e2e.test.ts             (NEW - 400 LOC)
```

**Total New Code:** ~1,900 LOC
**Total Modified Code:** ~100 LOC
**Total Test Code:** ~900 LOC

---

## Appendix B: Domain Catalog

This catalog is embedded in the `hubspot_getTools` tool description to provide instant discoverability:

| Domain | Operations | Description |
|--------|-----------|-------------|
| Companies | 5 | create, get, update, search, recent |
| Contacts | 5 | create, get, update, search, recent |
| Deals | 5 | create, get, update, search, recent |
| Notes | 8 | get, update, createContactNote, createCompanyNote, createDealNote, listContactNotes, listCompanyNotes, listDealNotes |
| Associations | 8 | create, createDefault, list, batchCreate, batchCreateDefault, batchRead, getAssociationTypes, getAssociationTypeReference |
| Products | 3 | list, search, get |
| Properties | 8 | list, get, create, update, search, listGroups, getGroup, createGroup, updateGroup |
| Emails | 5 | create, get, update, list, recent |
| BlogPosts | 5 | create, get, update, recent, list |
| Quotes | 9 | create, get, update, search, recent, addLineItem, listLineItems, updateLineItem, removeLineItem |
| Lists | 9 | create, get, search, update, delete, updateFilters, addMembers, removeMembers, getMembers |
| ActivityHistory | 2 | recent, search |

**Total:** 72 operations across 12 domains

---

## Appendix C: DOMAIN_CONFIGS Reference

**Source:** `/src/core/tool-registration-factory.ts` (lines 36-84)

This static configuration is used by:
1. **Current Architecture:** To generate 12 domain tool schemas
2. **Meta-Tools Architecture:** To validate domain names and list operations in getTools

**Preservation Strategy:** Keep DOMAIN_CONFIGS in tool-registration-factory-v2.ts for validation and discovery, but remove getDomainSpecificParams() switch statement.

```typescript
const DOMAIN_CONFIGS: Record<string, DomainConfig> = {
  Companies: {
    operations: ['create', 'get', 'update', 'search', 'recent'],
    description: 'HubSpot company management with CRUD operations and search capabilities'
  },
  // ... (11 more domains)
};
```

---

## Conclusion

This architecture design provides a complete specification for refactoring the HubSpot MCP from 12 domain tools to 2 meta-tools (`hubspot_getTools` and `hubspot_useTools`). The design:

1. **Preserves all functionality** - 72 operations remain accessible
2. **Improves discoverability** - LLMs can dynamically explore capabilities
3. **Maintains performance** - Multi-level caching ensures low latency
4. **Enables safe migration** - Parallel deployment with feature flag
5. **Requires no BCP changes** - Business logic untouched

**Next Steps:**
1. Review and approve this architecture design
2. Proceed to implementation following the 5-day plan
3. Deploy with feature flag disabled for parallel testing
4. Gradual rollout over 4 weeks
5. Deprecate old architecture after validation

**Estimated Effort:** 5 development days + 4 weeks gradual rollout + 1 week cleanup = 6 weeks total

**Risk Level:** MEDIUM (with feature flag) → LOW (after parallel validation)

**Business Value:** HIGH (improved LLM discoverability and developer experience)

---

**Document Status:** COMPLETE - Ready for Implementation
**Author:** PACT Architect
**Reviewers:** Development Team, Product Owner
**Approval Date:** Pending Review
