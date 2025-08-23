# Unified Notes Tool Architecture

## Executive Summary

This document defines a streamlined Notes tool architecture that eliminates the complexity of the current multi-step association workflow. The unified approach provides intent-driven operations like `createContactNote`, `createCompanyNote`, and `createDealNote` that directly create notes associated with specific entities, eliminating orphaned notes and reducing parameter validation complexity.

## Current Problem Analysis

### Existing Complexity Issues

1. **Multi-Step Association Workflow**
   - Users must create a note first
   - Then separately associate it with entities
   - Complex parameter validation across multiple tools
   - Risk of orphaned notes when association fails

2. **Current Tool Inventory** (10 total tools)
   - `createNote` - Creates standalone notes (often orphaned)
   - `addAssociation` - Separate association step
   - `createWithAssociations` - Complex array-based associations
   - `removeAssociation` - Not needed per user requirements
   - `delete` - Not needed per user requirements
   - `listAssociations` - Complex association listing
   - Plus standard CRUD operations

3. **Parameter Complexity**
   - Arrays of association objects with `objectType`, `objectId`, `associationType`
   - Complex validation logic across multiple parameters
   - Users never want standalone notes without associations

## Proposed Unified Architecture

### Design Philosophy

- **Intent-Driven Operations**: Each operation clearly expresses user intent
- **Single Responsibility**: One operation does one thing completely
- **Simple Parameters**: Minimal, intuitive parameter sets
- **No Orphaned Notes**: Every note is created with its intended association
- **No Delete Operations**: As specified by user requirements

### Core Operations Design

#### 1. Create Operations (Intent-Based)

**`createContactNote`**
```typescript
interface CreateContactNoteParams {
  contactId: string;  // Required: The contact to associate with
  content: string;    // Required: Note content
  ownerId?: string;   // Optional: HubSpot owner
  timestamp?: string; // Optional: When note occurred
  metadata?: Record<string, any>; // Optional: Additional properties
}
```

**`createCompanyNote`**
```typescript
interface CreateCompanyNoteParams {
  companyId: string;  // Required: The company to associate with
  content: string;    // Required: Note content
  ownerId?: string;   // Optional: HubSpot owner
  timestamp?: string; // Optional: When note occurred
  metadata?: Record<string, any>; // Optional: Additional properties
}
```

**`createDealNote`**
```typescript
interface CreateDealNoteParams {
  dealId: string;     // Required: The deal to associate with
  content: string;    // Required: Note content
  ownerId?: string;   // Optional: HubSpot owner
  timestamp?: string; // Optional: When note occurred
  metadata?: Record<string, any>; // Optional: Additional properties
}
```

#### 2. List Operations (Entity-Specific)

**`listContactNotes`**
```typescript
interface ListContactNotesParams {
  contactId: string;    // Required: Contact to get notes for
  limit?: number;       // Optional: Max results (default 10)
  after?: string;       // Optional: Pagination cursor
  startDate?: string;   // Optional: Filter from date
  endDate?: string;     // Optional: Filter to date
}
```

**`listCompanyNotes`**
```typescript
interface ListCompanyNotesParams {
  companyId: string;    // Required: Company to get notes for
  limit?: number;       // Optional: Max results (default 10)
  after?: string;       // Optional: Pagination cursor
  startDate?: string;   // Optional: Filter from date
  endDate?: string;     // Optional: Filter to date
}
```

**`listDealNotes`**
```typescript
interface ListDealNotesParams {
  dealId: string;       // Required: Deal to get notes for
  limit?: number;       // Optional: Max results (default 10)
  after?: string;       // Optional: Pagination cursor
  startDate?: string;   // Optional: Filter from date
  endDate?: string;     // Optional: Filter to date
}
```

#### 3. Standard CRUD Operations

**`getNote`** (unchanged)
```typescript
interface GetNoteParams {
  noteId: string;              // Required: Note ID
  includeAssociations?: boolean; // Optional: Include associations (default true)
}
```

**`updateNote`** (unchanged)
```typescript
interface UpdateNoteParams {
  noteId: string;       // Required: Note ID
  content?: string;     // Optional: New content
  ownerId?: string;     // Optional: New owner
  timestamp?: string;   // Optional: New timestamp
  metadata?: Record<string, any>; // Optional: Updated metadata
}
```

### Unified Tool Schema

The architecture implements a single `hubspotNotes` tool with an `operation` parameter that routes to the appropriate handler:

```typescript
interface UnifiedNotesToolParams {
  operation: 'createContactNote' | 'createCompanyNote' | 'createDealNote' | 
            'listContactNotes' | 'listCompanyNotes' | 'listDealNotes' |
            'getNote' | 'updateNote';
  
  // Parameters are validated based on the operation selected
  [key: string]: any;
}
```

## System Context

### External Dependencies
- **HubSpot CRM API**: Notes object API for CRUD operations
- **HubSpot Associations API V4**: For creating entity-note associations
- **Existing Notes Service**: Leverages current `NotesService` infrastructure

### Integration Points
- **BCP Registration**: Single tool registered as `hubspotNotes`
- **Service Layer**: Uses existing `NotesService` with new delegation methods
- **Type System**: Extends existing Notes types with new operation interfaces

## Component Architecture

### 1. Unified Notes Tool (`unified-notes.tool.ts`)

**Responsibilities:**
- Route operations based on `operation` parameter
- Validate parameters specific to each operation
- Delegate to appropriate service methods
- Return consistent response formats

**Key Features:**
- Single tool interface with operation-based routing
- Operation-specific parameter validation
- Simplified error handling and reporting
- Consistent response structure across all operations

### 2. Enhanced Notes Service

**New Methods:**
```typescript
class NotesService extends HubspotBaseService {
  // New intent-based creation methods
  async createContactNote(contactId: string, content: string, options?: CreateNoteOptions): Promise<Note>
  async createCompanyNote(companyId: string, content: string, options?: CreateNoteOptions): Promise<Note>
  async createDealNote(dealId: string, content: string, options?: CreateNoteOptions): Promise<Note>
  
  // New entity-specific listing methods
  async listContactNotes(contactId: string, filters?: ListNotesOptions): Promise<NotesPage>
  async listCompanyNotes(companyId: string, filters?: ListNotesOptions): Promise<NotesPage>
  async listDealNotes(dealId: string, filters?: ListNotesOptions): Promise<NotesPage>
  
  // Existing methods remain unchanged
  async getNote(id: string, includeAssociations?: boolean): Promise<Note>
  async updateNote(id: string, input: NoteUpdateInput): Promise<Note>
}
```

**Implementation Strategy:**
- Intent-based methods internally call `createNote()` with pre-configured associations
- Entity-specific listing methods use existing `listNotes()` with association filters
- Maintains backward compatibility with existing service interface

### 3. Operation Delegation Pattern

```typescript
interface OperationHandler {
  validate(params: any): void;
  execute(params: any, service: NotesService): Promise<any>;
}

class UnifiedNotesTool {
  private handlers: Map<string, OperationHandler>;
  
  async handle(params: UnifiedNotesToolParams): Promise<any> {
    const handler = this.handlers.get(params.operation);
    handler.validate(params);
    return handler.execute(params, this.notesService);
  }
}
```

## Data Architecture

### Simplified Type Definitions

```typescript
// Intent-based creation options
interface CreateNoteOptions {
  ownerId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

// Simplified listing options
interface ListNotesOptions {
  limit?: number;
  after?: string;
  startDate?: string;
  endDate?: string;
}

// Operation-specific parameter interfaces
interface CreateContactNoteParams {
  operation: 'createContactNote';
  contactId: string;
  content: string;
  ownerId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

// ... similar interfaces for other operations
```

### Response Format Standardization

All operations return a consistent response format:

```typescript
interface UnifiedNotesResponse {
  success: boolean;
  data: Note | NotesPage;
  message: string;
  operation: string;
  entityId?: string;
  entityType?: string;
}
```

## API Specifications

### Tool Registration Schema

```json
{
  "name": "hubspotNotes",
  "description": "Unified Notes tool for creating and managing notes with automatic associations",
  "inputSchema": {
    "type": "object",
    "properties": {
      "operation": {
        "type": "string",
        "enum": [
          "createContactNote", "createCompanyNote", "createDealNote",
          "listContactNotes", "listCompanyNotes", "listDealNotes",
          "getNote", "updateNote"
        ],
        "description": "The operation to perform"
      }
    },
    "required": ["operation"],
    "allOf": [
      {
        "if": { "properties": { "operation": { "const": "createContactNote" } } },
        "then": {
          "properties": {
            "contactId": { "type": "string" },
            "content": { "type": "string" }
          },
          "required": ["contactId", "content"]
        }
      }
      // ... similar conditional schemas for other operations
    ]
  }
}
```

### Internal API Flow

1. **Request Reception**: Unified tool receives operation request
2. **Operation Routing**: Routes to appropriate handler based on operation type
3. **Parameter Validation**: Validates operation-specific parameters
4. **Service Delegation**: Calls appropriate NotesService method
5. **Response Formatting**: Returns standardized response format

## Technology Decisions

### Architecture Patterns

**Single Tool with Operation Routing**
- **Rationale**: Simplifies MCP interface while maintaining operation granularity
- **Benefits**: Reduced tool registration overhead, consistent interface
- **Trade-offs**: Slightly more complex internal routing vs. simplified external API

**Delegation Pattern for Service Methods**
- **Rationale**: Leverages existing service infrastructure while adding intent-based methods
- **Benefits**: Code reuse, consistent error handling, backward compatibility
- **Trade-offs**: Additional method layer vs. direct API calls

**Operation-Specific Parameter Validation**
- **Rationale**: Ensures type safety and clear error messages for each operation
- **Benefits**: Better developer experience, runtime safety
- **Trade-offs**: More validation code vs. generic parameter handling

### Technology Stack Alignment

- **TypeScript**: Full type safety for all operations and parameters
- **Zod Schemas**: Runtime validation for operation-specific parameters
- **Existing HubSpot SDK**: Maintains compatibility with current API client
- **BCP Architecture**: Follows established patterns for tool organization

## Security Architecture

### Input Validation
- **Operation-Level Validation**: Each operation validates its specific parameters
- **Entity ID Validation**: Validates entity IDs exist before creating associations
- **Content Sanitization**: Ensures note content doesn't contain malicious data

### Access Control
- **HubSpot Token Validation**: Uses existing token-based authentication
- **Scope Verification**: Ensures token has necessary permissions for note operations
- **Rate Limiting**: Inherits HubSpot API rate limiting protections

### Data Protection
- **No Sensitive Data Logging**: Avoids logging note content or entity IDs
- **Error Message Sanitization**: Prevents information leakage in error responses

## Deployment Architecture

### Integration Points

**BCP Registration Update**
```typescript
// In src/bcps/Notes/index.ts
import { unifiedNotesTool } from './unified-notes.tool.js';

export const notesBCP = {
  name: 'Notes',
  description: 'Unified tools for managing notes in HubSpot',
  tools: [unifiedNotesTool] // Replaces array of 10+ individual tools
};
```

**Backward Compatibility Strategy**
- **Phased Migration**: New unified tool alongside existing tools initially
- **Deprecation Path**: Gradual removal of individual tools after testing
- **Configuration Flag**: Allow switching between old and new implementation

## Implementation Guidelines

### Development Order

1. **Phase 1: Core Intent-Based Operations**
   - Implement `createContactNote`, `createCompanyNote`, `createDealNote`
   - Add corresponding service methods
   - Create operation routing infrastructure

2. **Phase 2: Entity-Specific Listing**
   - Implement `listContactNotes`, `listCompanyNotes`, `listDealNotes`
   - Add service methods with association-based filtering
   - Test pagination and filtering

3. **Phase 3: Unified Tool Interface**
   - Create unified tool with operation parameter
   - Implement parameter validation for each operation
   - Add comprehensive error handling

4. **Phase 4: Integration and Migration**
   - Register unified tool in BCP
   - Test alongside existing tools
   - Plan deprecation of individual tools

### Code Organization

```
src/bcps/Notes/
├── unified-notes.tool.ts           # Main unified tool
├── operations/
│   ├── create-contact-note.ts      # CreateContactNote handler
│   ├── create-company-note.ts      # CreateCompanyNote handler
│   ├── create-deal-note.ts         # CreateDealNote handler
│   ├── list-contact-notes.ts       # ListContactNotes handler
│   ├── list-company-notes.ts       # ListCompanyNotes handler
│   ├── list-deal-notes.ts          # ListDealNotes handler
│   ├── get-note.ts                 # GetNote handler
│   └── update-note.ts              # UpdateNote handler
├── notes.service.ts                # Enhanced with new methods
├── notes.types.ts                  # Updated with operation types
└── index.ts                        # BCP registration
```

### Testing Strategy

**Unit Testing**
- Test each operation handler independently
- Mock NotesService methods for isolation
- Validate parameter schemas for all operations

**Integration Testing**
- Test end-to-end flows for each operation
- Verify HubSpot API integration
- Test error handling and edge cases

**Backward Compatibility Testing**
- Ensure existing service methods continue working
- Test migration scenarios
- Validate performance impact

## Risk Assessment

### Technical Risks

**1. Association Type ID Mapping (Medium Risk)**
- **Risk**: Hard-coded association type IDs may become invalid
- **Mitigation**: Implement dynamic type ID lookup or configuration
- **Contingency**: Fallback to default association types

**2. Parameter Validation Complexity (Low Risk)**
- **Risk**: Operation-specific validation may miss edge cases
- **Mitigation**: Comprehensive test coverage and schema validation
- **Contingency**: Generic parameter validation fallback

**3. Performance Impact (Low Risk)**
- **Risk**: Additional routing layer may introduce latency
- **Mitigation**: Efficient operation routing and minimal overhead
- **Contingency**: Performance monitoring and optimization

### Business Risks

**1. User Adoption (Low Risk)**
- **Risk**: Users may prefer existing individual tools
- **Mitigation**: Clear documentation and migration guide
- **Contingency**: Maintain both interfaces during transition

**2. API Compatibility (Medium Risk)**
- **Risk**: HubSpot API changes may affect association creation
- **Mitigation**: Regular API compatibility testing
- **Contingency**: Version-specific implementation branches

## Success Criteria

### Functional Requirements
- ✅ Create notes with single operation (contactId + content)
- ✅ Eliminate multi-step association workflow
- ✅ Provide entity-specific listing operations
- ✅ Maintain existing get/update functionality
- ✅ No delete operations (as specified)

### Non-Functional Requirements
- ✅ Reduce parameter complexity by 70%+ vs. current implementation
- ✅ Maintain existing performance characteristics
- ✅ 100% backward compatibility with existing NotesService
- ✅ Zero orphaned notes in new workflow
- ✅ Clear, actionable error messages for all operations

### Quality Gates
- ✅ All operations have comprehensive parameter validation
- ✅ Each operation has dedicated error handling
- ✅ Response formats are consistent across all operations
- ✅ Documentation includes examples for every operation
- ✅ Migration path is clearly defined and tested

---

This architecture provides a clean, intent-driven interface for HubSpot Notes that eliminates the complexity of multi-step workflows while maintaining the flexibility and power of the underlying HubSpot API. The unified approach reduces cognitive load for users while providing a foundation for future enhancements.