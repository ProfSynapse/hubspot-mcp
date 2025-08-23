# HubSpot MCP SDK Server Architecture

## Executive Summary

This document outlines the architectural design for a refactored HubSpot MCP server that leverages the official MCP SDK (`StreamableHTTPServerTransport`) while reusing all existing Bounded Context Pack (BCP) tool implementations. The architecture follows SOLID principles by implementing a clean delegation pattern that separates transport concerns from business logic.

## System Context

### Current State
- **Working http-server.ts**: Custom MCP implementation that correctly uses existing BCP tools
- **Problematic http-server-sdk.ts**: Reimplements all tools, violating DRY and SOLID principles
- **Existing BCP Assets**: 10 proven tool domains (Companies, Contacts, Notes, Associations, Deals, Products, Properties, Emails, BlogPosts, Quotes)

### Target State
- **Clean SDK Integration**: Use official MCP SDK transport layer
- **Code Reuse**: Leverage all existing BCP tool implementations without modification
- **SOLID Compliance**: Single responsibility, dependency inversion, DRY principles
- **Maintainable**: Easy to extend with new BCPs

## Component Architecture

### 1. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
│                    (Claude Desktop)                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ HTTP/SSE
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                   Transport Layer                               │
│              StreamableHTTPServerTransport                     │
│                   (Official MCP SDK)                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ JSON-RPC Messages
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                  Orchestration Layer                           │
│                   McpServer Instance                           │
│                (Tool Registration & Routing)                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ Tool Invocations
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                   Delegation Layer                             │
│                  BCP Tool Delegator                            │
│               (Maps operations to tools)                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ Individual Tool Calls
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    Business Logic Layer                        │
│                    Existing BCP Tools                         │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│   │  Companies  │ │  Contacts   │ │    Notes    │   ...       │
│   │     BCP     │ │     BCP     │ │     BCP     │             │
│   └─────────────┘ └─────────────┘ └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Core Components

#### A. Transport Layer
- **Component**: `StreamableHTTPServerTransport` (MCP SDK)
- **Responsibility**: Handle HTTP/SSE communication, session management, JSON-RPC protocol
- **Interface**: Official MCP SDK APIs

#### B. Orchestration Layer
- **Component**: `McpServer` instance
- **Responsibility**: Tool registration, method routing, parameter validation
- **Interface**: Register consolidated tools (one per domain)

#### C. Delegation Layer
- **Component**: `BcpToolDelegator` (New)
- **Responsibility**: Map domain operations to specific BCP tools
- **Interface**: Operation-based routing with parameter forwarding

#### D. Business Logic Layer
- **Component**: Existing BCP Tools (Unchanged)
- **Responsibility**: HubSpot API operations, data validation, error handling
- **Interface**: Current tool handler signatures

## Data Architecture

### 1. Tool Registration Pattern

```typescript
// Consolidated tool registration
server.tool(
  'hubspotCompany',
  {
    operation: z.enum(['create', 'get', 'update', 'delete', 'search', 'recent']),
    // ... all possible parameters from individual tools
  },
  async (params) => {
    return await bcpDelegator.delegate('Companies', params.operation, params);
  }
);
```

### 2. Delegation Flow

```typescript
interface BcpDelegator {
  delegate(domain: string, operation: string, params: any): Promise<any>;
}

class BcpToolDelegator implements BcpDelegator {
  async delegate(domain: string, operation: string, params: any) {
    // 1. Load domain BCP
    const bcp = await this.loadBcp(domain);
    
    // 2. Find specific tool
    const tool = bcp.tools.find(t => t.name === operation);
    
    // 3. Validate parameters
    this.validateParams(params, tool.inputSchema);
    
    // 4. Execute tool handler
    return await tool.handler(params);
  }
}
```

### 3. Error Handling Strategy

```typescript
interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// Consistent error wrapping
function wrapToolResult(result: any, error?: Error): ToolResult {
  if (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
  
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
  };
}
```

## API Specifications

### 1. BCP Delegator Interface

```typescript
interface BcpDelegator {
  /**
   * Delegate operation to appropriate BCP tool
   */
  delegate(domain: string, operation: string, params: Record<string, any>): Promise<any>;
  
  /**
   * Load BCP by domain name
   */
  loadBcp(domain: string): Promise<BCP>;
  
  /**
   * Validate parameters against tool schema
   */
  validateParams(params: any, schema: InputSchema, toolName: string): void;
  
  /**
   * Get available operations for a domain
   */
  getOperations(domain: string): Promise<string[]>;
}
```

### 2. Tool Registration Factory

```typescript
interface ToolRegistrationFactory {
  /**
   * Create consolidated tool registration for domain
   */
  createDomainTool(domain: string, delegator: BcpDelegator): ToolRegistration;
  
  /**
   * Register all domain tools with MCP server
   */
  registerAllTools(server: McpServer, delegator: BcpDelegator): Promise<void>;
}
```

### 3. Schema Consolidation

```typescript
interface SchemaConsolidator {
  /**
   * Merge schemas from all tools in a domain
   */
  consolidateSchemas(tools: ToolDefinition[]): ZodSchema;
  
  /**
   * Create operation enum from tool names
   */
  createOperationEnum(tools: ToolDefinition[]): ZodEnum;
  
  /**
   * Add operation parameter to consolidated schema
   */
  addOperationParam(schema: ZodSchema, operations: string[]): ZodSchema;
}
```

## Technology Decisions

### 1. Official MCP SDK
- **Choice**: `@modelcontextprotocol/sdk`
- **Rationale**: Ensures compatibility, handles protocol complexities, provides SSE support
- **Trade-offs**: Less control over transport layer, dependency on external library

### 2. Delegation Pattern
- **Choice**: Operation-based routing with parameter forwarding
- **Rationale**: Maintains separation of concerns, enables tool reuse, follows SRP
- **Trade-offs**: Additional abstraction layer, slight performance overhead

### 3. Schema Consolidation
- **Choice**: Merge all tool schemas into domain-level schemas
- **Rationale**: Simplifies client interface, reduces tool proliferation
- **Trade-offs**: Larger parameter sets, potential parameter conflicts

### 4. Dynamic Loading
- **Choice**: Runtime BCP loading with caching
- **Rationale**: Maintains modularity, enables hot-swapping, reduces startup time
- **Trade-offs**: Runtime import overhead, potential loading failures

## Security Architecture

### 1. Parameter Validation
- **Strategy**: Validate all parameters against tool schemas before delegation
- **Implementation**: Use existing Zod schemas from BCP tools
- **Fallback**: Reject invalid requests with descriptive errors

### 2. Error Sanitization
- **Strategy**: Sanitize error messages to prevent information leakage
- **Implementation**: Wrap all tool errors in consistent format
- **Logging**: Log full errors server-side, return sanitized messages to client

### 3. Access Control
- **Strategy**: Leverage existing HubSpot API key validation
- **Implementation**: Pass through current authentication mechanisms
- **Future**: Support for OAuth2 flows via existing middleware

## Deployment Architecture

### 1. File Structure
```
src/
├── http-server-sdk.ts          # Main server entry point
├── core/
│   ├── bcp-delegator.ts        # New delegation layer
│   ├── tool-factory.ts         # New tool registration factory
│   ├── schema-consolidator.ts  # New schema merger
│   └── server.ts               # Existing (unchanged)
├── bcps/                       # Existing BCPs (unchanged)
│   ├── Companies/
│   ├── Contacts/
│   └── ...
└── utils/                      # Existing utilities (unchanged)
```

### 2. Dependencies
- **Add**: `@modelcontextprotocol/sdk` (already present)
- **Modify**: None - all existing dependencies remain
- **Remove**: Custom transport implementation

### 3. Environment Variables
- **Existing**: All current environment variables remain unchanged
- **New**: None required
- **Modified**: None

## Implementation Guidelines

### 1. Development Phases

#### Phase 1: Core Delegation Infrastructure
1. Create `BcpDelegator` class with basic delegation logic
2. Implement `ToolRegistrationFactory` for domain tool creation
3. Create `SchemaConsolidator` for parameter merging
4. Add unit tests for delegation layer

#### Phase 2: Transport Integration
1. Replace custom transport with `StreamableHTTPServerTransport`
2. Update server initialization to use official SDK
3. Integrate delegator with MCP server tool registration
4. Test basic tool operations

#### Phase 3: Comprehensive Tool Registration
1. Register all 10 BCP domains with consolidated schemas
2. Implement parameter validation and error handling
3. Add operation-specific parameter mapping
4. Test all tool operations end-to-end

#### Phase 4: Optimization and Polish
1. Add caching for BCP loading and schema consolidation
2. Optimize parameter validation performance
3. Add comprehensive error logging and monitoring
4. Performance testing and optimization

### 2. Code Patterns

#### Delegation Handler Template
```typescript
async (params: any): Promise<CallToolResult> => {
  try {
    const { operation, ...operationParams } = params;
    const result = await delegator.delegate(domain, operation, operationParams);
    return wrapToolResult(result);
  } catch (error) {
    return wrapToolResult(null, error as Error);
  }
}
```

#### Schema Consolidation Template
```typescript
function createDomainSchema(domain: string, tools: ToolDefinition[]) {
  const operations = tools.map(t => t.name);
  const baseSchema = {
    operation: z.enum(operations).describe('Operation to perform')
  };
  
  // Merge all tool parameters
  const allParams = tools.reduce((acc, tool) => {
    return { ...acc, ...extractParams(tool.inputSchema) };
  }, {});
  
  return z.object({ ...baseSchema, ...allParams });
}
```

### 3. Testing Strategy

#### Unit Tests
- BCP delegator functionality
- Schema consolidation logic
- Parameter validation
- Error handling

#### Integration Tests
- Tool registration with MCP server
- End-to-end operation execution
- Transport layer communication
- Session management

#### Performance Tests
- Tool delegation overhead
- Schema validation performance
- Memory usage with all tools loaded
- Concurrent request handling

## Risk Assessment

### 1. Technical Risks

#### High Priority
- **Parameter Conflicts**: Different tools may have conflicting parameter names
  - **Mitigation**: Namespace parameters or use operation-specific validation
  - **Contingency**: Fallback to individual tool registration

- **Schema Complexity**: Merged schemas may become unwieldy
  - **Mitigation**: Use clear parameter descriptions and validation
  - **Contingency**: Split complex domains into sub-domains

#### Medium Priority
- **Performance Overhead**: Additional delegation layer may impact performance
  - **Mitigation**: Implement caching and optimize delegation logic
  - **Monitoring**: Track delegation time and optimize bottlenecks

- **Error Propagation**: Errors may be lost in delegation chain
  - **Mitigation**: Comprehensive error logging and structured error handling
  - **Testing**: Extensive error scenario testing

#### Low Priority
- **SDK Compatibility**: Future MCP SDK changes may break implementation
  - **Mitigation**: Version pinning and gradual SDK updates
  - **Monitoring**: Track SDK updates and test compatibility

### 2. Implementation Risks

#### Development Complexity
- **Risk**: Delegation layer adds complexity to debugging
- **Mitigation**: Comprehensive logging and clear error messages
- **Testing**: Unit tests for each delegation path

#### Backward Compatibility
- **Risk**: Changes may break existing integrations
- **Mitigation**: Maintain existing tool signatures in delegation layer
- **Validation**: Test against existing tool call patterns

## Success Metrics

### 1. Technical Metrics
- **Code Reuse**: 100% of existing BCP tools reused without modification
- **Performance**: <10ms additional overhead for tool delegation
- **Reliability**: <1% error rate increase from delegation layer
- **Maintainability**: 50% reduction in duplicated tool implementation code

### 2. Architectural Metrics
- **SOLID Compliance**: Clear separation of concerns across all layers
- **DRY Compliance**: Zero duplicated business logic between servers
- **Testability**: >90% code coverage for new delegation layer
- **Extensibility**: New BCPs can be added without modifying existing code

### 3. Operational Metrics
- **Deployment Success**: Seamless replacement of current SDK server
- **Feature Parity**: All existing tools work identically through new architecture
- **Performance**: No degradation in end-to-end operation times
- **Debugging**: Clear error messages and debugging capabilities

## Conclusion

This architecture provides a clean, maintainable solution for integrating the official MCP SDK while preserving all existing BCP investments. The delegation pattern ensures SOLID principle compliance while the consolidated tool registration simplifies the client interface. The phased implementation approach minimizes risk while delivering incremental value.

The key innovation is the separation of transport concerns from business logic, allowing the official SDK to handle protocol complexities while existing BCPs continue to handle HubSpot-specific operations unchanged. This approach future-proofs the implementation against both MCP protocol changes and HubSpot API evolution.