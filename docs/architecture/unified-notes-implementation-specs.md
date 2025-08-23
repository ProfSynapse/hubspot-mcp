# Unified Notes Tool Implementation Specifications

## Overview

This document provides detailed implementation specifications for the unified Notes tool architecture. It serves as a technical blueprint for developers to implement the streamlined Notes interface that eliminates complex association workflows.

## Implementation Structure

### File Organization

```
src/bcps/Notes/
├── unified-notes.tool.ts           # Main unified tool (NEW)
├── operations/                     # Operation handlers (NEW)
│   ├── base-operation.ts           # Base operation handler class
│   ├── create-contact-note.ts      # CreateContactNote operation
│   ├── create-company-note.ts      # CreateCompanyNote operation
│   ├── create-deal-note.ts         # CreateDealNote operation
│   ├── list-contact-notes.ts       # ListContactNotes operation
│   ├── list-company-notes.ts       # ListCompanyNotes operation
│   ├── list-deal-notes.ts          # ListDealNotes operation
│   ├── get-note.ts                 # GetNote operation
│   └── update-note.ts              # UpdateNote operation
├── notes.service.ts                # Enhanced service (MODIFIED)
├── unified-notes.types.ts          # Operation type definitions (NEW)
├── notes.types.ts                  # Existing types (UNCHANGED)
└── index.ts                        # Updated BCP registration (MODIFIED)
```

## Core Implementation Components

### 1. Unified Notes Tool (`unified-notes.tool.ts`)

```typescript
import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService } from './notes.service.js';
import { UnifiedNotesParams, OPERATION_HANDLERS } from './unified-notes.types.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      enum: [
        'createContactNote', 'createCompanyNote', 'createDealNote',
        'listContactNotes', 'listCompanyNotes', 'listDealNotes',
        'getNote', 'updateNote'
      ],
      description: 'The operation to perform on notes'
    }
  },
  required: ['operation'],
  allOf: [
    // Operation-specific parameter schemas
    {
      if: { properties: { operation: { const: 'createContactNote' } } },
      then: {
        properties: {
          contactId: { type: 'string', description: 'ID of the contact to associate the note with' },
          content: { type: 'string', description: 'Content of the note' },
          ownerId: { type: 'string', description: 'Optional HubSpot owner ID' },
          timestamp: { type: 'string', description: 'Optional timestamp for the note' },
          metadata: { type: 'object', description: 'Optional additional properties' }
        },
        required: ['contactId', 'content']
      }
    },
    {
      if: { properties: { operation: { const: 'createCompanyNote' } } },
      then: {
        properties: {
          companyId: { type: 'string', description: 'ID of the company to associate the note with' },
          content: { type: 'string', description: 'Content of the note' },
          ownerId: { type: 'string', description: 'Optional HubSpot owner ID' },
          timestamp: { type: 'string', description: 'Optional timestamp for the note' },
          metadata: { type: 'object', description: 'Optional additional properties' }
        },
        required: ['companyId', 'content']
      }
    },
    {
      if: { properties: { operation: { const: 'createDealNote' } } },
      then: {
        properties: {
          dealId: { type: 'string', description: 'ID of the deal to associate the note with' },
          content: { type: 'string', description: 'Content of the note' },
          ownerId: { type: 'string', description: 'Optional HubSpot owner ID' },
          timestamp: { type: 'string', description: 'Optional timestamp for the note' },
          metadata: { type: 'object', description: 'Optional additional properties' }
        },
        required: ['dealId', 'content']
      }
    },
    {
      if: { properties: { operation: { const: 'listContactNotes' } } },
      then: {
        properties: {
          contactId: { type: 'string', description: 'ID of the contact to list notes for' },
          limit: { type: 'number', description: 'Maximum number of results (default 10, max 100)' },
          after: { type: 'string', description: 'Pagination cursor' },
          startDate: { type: 'string', description: 'Filter notes from this date (ISO string)' },
          endDate: { type: 'string', description: 'Filter notes to this date (ISO string)' }
        },
        required: ['contactId']
      }
    },
    {
      if: { properties: { operation: { const: 'listCompanyNotes' } } },
      then: {
        properties: {
          companyId: { type: 'string', description: 'ID of the company to list notes for' },
          limit: { type: 'number', description: 'Maximum number of results (default 10, max 100)' },
          after: { type: 'string', description: 'Pagination cursor' },
          startDate: { type: 'string', description: 'Filter notes from this date (ISO string)' },
          endDate: { type: 'string', description: 'Filter notes to this date (ISO string)' }
        },
        required: ['companyId']
      }
    },
    {
      if: { properties: { operation: { const: 'listDealNotes' } } },
      then: {
        properties: {
          dealId: { type: 'string', description: 'ID of the deal to list notes for' },
          limit: { type: 'number', description: 'Maximum number of results (default 10, max 100)' },
          after: { type: 'string', description: 'Pagination cursor' },
          startDate: { type: 'string', description: 'Filter notes from this date (ISO string)' },
          endDate: { type: 'string', description: 'Filter notes to this date (ISO string)' }
        },
        required: ['dealId']
      }
    },
    {
      if: { properties: { operation: { const: 'getNote' } } },
      then: {
        properties: {
          noteId: { type: 'string', description: 'ID of the note to retrieve' },
          includeAssociations: { type: 'boolean', description: 'Whether to include associations (default true)' }
        },
        required: ['noteId']
      }
    },
    {
      if: { properties: { operation: { const: 'updateNote' } } },
      then: {
        properties: {
          noteId: { type: 'string', description: 'ID of the note to update' },
          content: { type: 'string', description: 'New content for the note' },
          ownerId: { type: 'string', description: 'New owner ID for the note' },
          timestamp: { type: 'string', description: 'New timestamp for the note' },
          metadata: { type: 'object', description: 'Updated metadata properties' }
        },
        required: ['noteId']
      }
    }
  ],
  examples: [
    {
      operation: 'createContactNote',
      contactId: '12345',
      content: 'Had a productive call with the customer about their requirements.'
    },
    {
      operation: 'listCompanyNotes',
      companyId: '67890',
      limit: 20
    },
    {
      operation: 'getNote',
      noteId: '98765'
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'hubspotNotes',
  description: 'Unified Notes tool for creating and managing notes with automatic associations',
  inputSchema,
  handler: async (params: UnifiedNotesParams) => {
    // Initialize service
    const tempConfig: ServiceConfig = {
      hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN || '',
    };

    if (!tempConfig.hubspotAccessToken) {
      throw new BcpError(
        'HubSpot access token is missing. Please ensure HUBSPOT_ACCESS_TOKEN is set.',
        'AUTH_ERROR',
        401
      );
    }

    const notesService = new NotesService(tempConfig);
    await notesService.init();

    // Get operation handler
    const handler = OPERATION_HANDLERS.get(params.operation);
    if (!handler) {
      throw new BcpError(
        `Unknown operation: ${params.operation}`,
        'VALIDATION_ERROR',
        400
      );
    }

    try {
      // Validate and execute operation
      handler.validate(params);
      const result = await handler.execute(params, notesService);
      
      return {
        success: true,
        data: result,
        message: `Successfully executed ${params.operation}`,
        operation: params.operation
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to execute ${params.operation}: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};
```

### 2. Operation Handler Base Class (`operations/base-operation.ts`)

```typescript
import { NotesService } from '../notes.service.js';
import { BcpError } from '../../../core/types.js';

export abstract class BaseOperationHandler {
  abstract operationName: string;

  /**
   * Validate operation-specific parameters
   */
  abstract validate(params: any): void;

  /**
   * Execute the operation with the validated parameters
   */
  abstract execute(params: any, service: NotesService): Promise<any>;

  /**
   * Common validation helper for required fields
   */
  protected validateRequired(params: any, fields: string[]): void {
    for (const field of fields) {
      if (!params[field]) {
        throw new BcpError(
          `Missing required parameter for ${this.operationName}: ${field}`,
          'VALIDATION_ERROR',
          400
        );
      }
    }
  }

  /**
   * Common validation for entity IDs (should be non-empty strings)
   */
  protected validateEntityId(id: string, entityType: string): void {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new BcpError(
        `Invalid ${entityType} ID: must be a non-empty string`,
        'VALIDATION_ERROR',
        400
      );
    }
  }

  /**
   * Common validation for optional numeric parameters
   */
  protected validateNumericParameter(value: any, name: string, min?: number, max?: number): void {
    if (value !== undefined) {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new BcpError(
          `Invalid ${name}: must be a number`,
          'VALIDATION_ERROR',
          400
        );
      }
      if (min !== undefined && value < min) {
        throw new BcpError(
          `Invalid ${name}: must be at least ${min}`,
          'VALIDATION_ERROR',
          400
        );
      }
      if (max !== undefined && value > max) {
        throw new BcpError(
          `Invalid ${name}: must be no more than ${max}`,
          'VALIDATION_ERROR',
          400
        );
      }
    }
  }
}
```

### 3. Create Contact Note Operation (`operations/create-contact-note.ts`)

```typescript
import { BaseOperationHandler } from './base-operation.ts';
import { NotesService } from '../notes.service.js';
import { CreateContactNoteParams } from '../unified-notes.types.js';

export class CreateContactNoteHandler extends BaseOperationHandler {
  operationName = 'createContactNote';

  validate(params: CreateContactNoteParams): void {
    this.validateRequired(params, ['contactId', 'content']);
    this.validateEntityId(params.contactId, 'contact');
    
    if (typeof params.content !== 'string' || params.content.trim().length === 0) {
      throw new BcpError(
        'Note content must be a non-empty string',
        'VALIDATION_ERROR',
        400
      );
    }
  }

  async execute(params: CreateContactNoteParams, service: NotesService) {
    return await service.createContactNote(
      params.contactId,
      params.content,
      {
        ownerId: params.ownerId,
        timestamp: params.timestamp,
        metadata: params.metadata
      }
    );
  }
}
```

### 4. Enhanced Notes Service Methods

```typescript
// Add these methods to the existing NotesService class

/**
 * Creates a note directly associated with a contact
 */
public async createContactNote(
  contactId: string, 
  content: string, 
  options: CreateNoteOptions = {}
): Promise<Note> {
  this.checkInitialized();
  
  const noteInput: NoteCreateInput = {
    content,
    timestamp: options.timestamp,
    ownerId: options.ownerId,
    metadata: options.metadata,
    associations: [{
      objectType: 'contacts',
      objectId: contactId,
      associationType: 'default'
    }]
  };

  return this.createNote(noteInput);
}

/**
 * Creates a note directly associated with a company
 */
public async createCompanyNote(
  companyId: string, 
  content: string, 
  options: CreateNoteOptions = {}
): Promise<Note> {
  this.checkInitialized();
  
  const noteInput: NoteCreateInput = {
    content,
    timestamp: options.timestamp,
    ownerId: options.ownerId,
    metadata: options.metadata,
    associations: [{
      objectType: 'companies',
      objectId: companyId,
      associationType: 'default'
    }]
  };

  return this.createNote(noteInput);
}

/**
 * Creates a note directly associated with a deal
 */
public async createDealNote(
  dealId: string, 
  content: string, 
  options: CreateNoteOptions = {}
): Promise<Note> {
  this.checkInitialized();
  
  const noteInput: NoteCreateInput = {
    content,
    timestamp: options.timestamp,
    ownerId: options.ownerId,
    metadata: options.metadata,
    associations: [{
      objectType: 'deals',
      objectId: dealId,
      associationType: 'default'
    }]
  };

  return this.createNote(noteInput);
}

/**
 * Lists notes associated with a specific contact
 */
public async listContactNotes(
  contactId: string, 
  options: ListNotesOptions = {}
): Promise<NotesPage> {
  this.checkInitialized();
  
  const filters: NoteFilters = {
    associatedObjectType: 'contacts',
    associatedObjectId: contactId,
    limit: options.limit || 10,
    after: options.after,
    startTimestamp: options.startDate,
    endTimestamp: options.endDate
  };

  return this.listNotes(filters, true);
}

/**
 * Lists notes associated with a specific company
 */
public async listCompanyNotes(
  companyId: string, 
  options: ListNotesOptions = {}
): Promise<NotesPage> {
  this.checkInitialized();
  
  const filters: NoteFilters = {
    associatedObjectType: 'companies',
    associatedObjectId: companyId,
    limit: options.limit || 10,
    after: options.after,
    startTimestamp: options.startDate,
    endTimestamp: options.endDate
  };

  return this.listNotes(filters, true);
}

/**
 * Lists notes associated with a specific deal
 */
public async listDealNotes(
  dealId: string, 
  options: ListNotesOptions = {}
): Promise<NotesPage> {
  this.checkInitialized();
  
  const filters: NoteFilters = {
    associatedObjectType: 'deals',
    associatedObjectId: dealId,
    limit: options.limit || 10,
    after: options.after,
    startTimestamp: options.startDate,
    endTimestamp: options.endDate
  };

  return this.listNotes(filters, true);
}
```

### 5. Unified Notes Types (`unified-notes.types.ts`)

```typescript
import { BaseOperationHandler } from './operations/base-operation.js';
import { CreateContactNoteHandler } from './operations/create-contact-note.js';
import { CreateCompanyNoteHandler } from './operations/create-company-note.js';
import { CreateDealNoteHandler } from './operations/create-deal-note.js';
import { ListContactNotesHandler } from './operations/list-contact-notes.js';
import { ListCompanyNotesHandler } from './operations/list-company-notes.js';
import { ListDealNotesHandler } from './operations/list-deal-notes.js';
import { GetNoteHandler } from './operations/get-note.js';
import { UpdateNoteHandler } from './operations/update-note.js';

// Operation parameter types
export interface CreateContactNoteParams {
  operation: 'createContactNote';
  contactId: string;
  content: string;
  ownerId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface CreateCompanyNoteParams {
  operation: 'createCompanyNote';
  companyId: string;
  content: string;
  ownerId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface CreateDealNoteParams {
  operation: 'createDealNote';
  dealId: string;
  content: string;
  ownerId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface ListContactNotesParams {
  operation: 'listContactNotes';
  contactId: string;
  limit?: number;
  after?: string;
  startDate?: string;
  endDate?: string;
}

export interface ListCompanyNotesParams {
  operation: 'listCompanyNotes';
  companyId: string;
  limit?: number;
  after?: string;
  startDate?: string;
  endDate?: string;
}

export interface ListDealNotesParams {
  operation: 'listDealNotes';
  dealId: string;
  limit?: number;
  after?: string;
  startDate?: string;
  endDate?: string;
}

export interface GetNoteParams {
  operation: 'getNote';
  noteId: string;
  includeAssociations?: boolean;
}

export interface UpdateNoteParams {
  operation: 'updateNote';
  noteId: string;
  content?: string;
  ownerId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

// Union type for all operation parameters
export type UnifiedNotesParams = 
  | CreateContactNoteParams 
  | CreateCompanyNoteParams 
  | CreateDealNoteParams
  | ListContactNotesParams 
  | ListCompanyNotesParams 
  | ListDealNotesParams
  | GetNoteParams 
  | UpdateNoteParams;

// Helper types for service methods
export interface CreateNoteOptions {
  ownerId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface ListNotesOptions {
  limit?: number;
  after?: string;
  startDate?: string;
  endDate?: string;
}

// Operation handlers registry
export const OPERATION_HANDLERS: Map<string, BaseOperationHandler> = new Map([
  ['createContactNote', new CreateContactNoteHandler()],
  ['createCompanyNote', new CreateCompanyNoteHandler()],
  ['createDealNote', new CreateDealNoteHandler()],
  ['listContactNotes', new ListContactNotesHandler()],
  ['listCompanyNotes', new ListCompanyNotesHandler()],
  ['listDealNotes', new ListDealNotesHandler()],
  ['getNote', new GetNoteHandler()],
  ['updateNote', new UpdateNoteHandler()]
]);
```

### 6. Updated BCP Registration (`index.ts`)

```typescript
/**
 * Notes BCP Index - Updated for Unified Tool
 */

import { tool as unifiedNotesTool } from './unified-notes.tool.js';
import { ToolDefinition } from '../../core/types.js';

/**
 * Array of unified Note tools
 */
export const noteTools: ToolDefinition[] = [
  unifiedNotesTool
];

/**
 * Notes BCP with simplified tool set
 */
export const notesBCP = {
  name: 'Notes',
  description: 'Unified tool for managing notes in HubSpot with automatic associations',
  tools: noteTools
};

export default notesBCP;
```

## Implementation Steps

### Phase 1: Foundation Setup

1. **Create Operation Handler Infrastructure**
   ```bash
   # Create operations directory
   mkdir -p src/bcps/Notes/operations
   
   # Create base operation handler
   touch src/bcps/Notes/operations/base-operation.ts
   ```

2. **Implement Type Definitions**
   ```bash
   # Create unified types file
   touch src/bcps/Notes/unified-notes.types.ts
   ```

3. **Create Operation Handlers**
   ```bash
   # Create individual operation handlers
   touch src/bcps/Notes/operations/create-contact-note.ts
   touch src/bcps/Notes/operations/create-company-note.ts
   touch src/bcps/Notes/operations/create-deal-note.ts
   # ... etc for all operations
   ```

### Phase 2: Service Enhancement

1. **Add Intent-Based Methods to NotesService**
   - Implement `createContactNote`, `createCompanyNote`, `createDealNote`
   - Implement `listContactNotes`, `listCompanyNotes`, `listDealNotes`
   - Test all new methods with existing infrastructure

2. **Validate Backward Compatibility**
   - Run existing tests to ensure no regressions
   - Verify existing tools continue to work

### Phase 3: Unified Tool Implementation

1. **Create Unified Tool**
   - Implement `unified-notes.tool.ts` with operation routing
   - Add comprehensive parameter validation schemas
   - Implement error handling and response formatting

2. **Register Handlers**
   - Create operation handler instances
   - Register handlers in the handlers map
   - Test operation routing logic

### Phase 4: Integration and Testing

1. **Update BCP Registration**
   - Modify `index.ts` to export unified tool
   - Test BCP registration in server

2. **Comprehensive Testing**
   - Unit tests for each operation handler
   - Integration tests for end-to-end workflows
   - Performance testing to ensure no degradation

### Phase 5: Migration and Cleanup

1. **Gradual Migration**
   - Deploy with both old and new tools available
   - Monitor usage and performance
   - Gather user feedback

2. **Deprecation**
   - Mark individual tools as deprecated
   - Provide migration documentation
   - Eventually remove deprecated tools

## Testing Specifications

### Unit Testing Structure

```typescript
// Test file: src/bcps/Notes/__tests__/unified-notes.tool.test.ts

describe('UnifiedNotesTool', () => {
  describe('createContactNote', () => {
    it('should create note with contact association', async () => {
      const params = {
        operation: 'createContactNote',
        contactId: '12345',
        content: 'Test note content'
      };
      // Test implementation
    });

    it('should validate required parameters', async () => {
      const params = {
        operation: 'createContactNote',
        content: 'Test note content'
        // Missing contactId
      };
      // Test should throw validation error
    });
  });

  // Similar test structures for other operations
});
```

### Integration Testing Examples

```typescript
// Test file: src/bcps/Notes/__tests__/notes-integration.test.ts

describe('Notes Integration', () => {
  it('should create and retrieve contact note', async () => {
    // Create note
    const createResult = await notesTool.handler({
      operation: 'createContactNote',
      contactId: 'test-contact-id',
      content: 'Integration test note'
    });

    // Verify creation
    expect(createResult.success).toBe(true);
    expect(createResult.data.content).toBe('Integration test note');

    // Retrieve note
    const getResult = await notesTool.handler({
      operation: 'getNote',
      noteId: createResult.data.id
    });

    // Verify retrieval
    expect(getResult.success).toBe(true);
    expect(getResult.data.associations).toContainEqual(
      expect.objectContaining({
        objectType: 'contacts',
        objectId: 'test-contact-id'
      })
    );
  });
});
```

## Performance Considerations

### Operation Routing Efficiency

The unified tool uses a Map-based operation handler registry for O(1) operation lookup:

```typescript
// Efficient operation resolution
const handler = OPERATION_HANDLERS.get(params.operation);
```

### Parameter Validation Optimization

Each operation handler validates only the parameters it needs, avoiding unnecessary validation overhead:

```typescript
// Operation-specific validation instead of validating all possible parameters
validate(params: CreateContactNoteParams): void {
  this.validateRequired(params, ['contactId', 'content']);
  this.validateEntityId(params.contactId, 'contact');
}
```

### Service Method Optimization

New intent-based service methods minimize API calls by creating notes with associations in a single operation:

```typescript
// Single API call instead of separate create + associate calls
const noteInput: NoteCreateInput = {
  content,
  associations: [{ objectType: 'contacts', objectId: contactId }]
};
return this.createNote(noteInput);
```

## Error Handling Strategy

### Operation-Level Error Handling

Each operation handler provides specific error messages:

```typescript
if (!params.contactId) {
  throw new BcpError(
    'Missing required parameter for createContactNote: contactId',
    'VALIDATION_ERROR',
    400
  );
}
```

### Unified Error Response Format

All operations return errors in a consistent format:

```typescript
{
  success: false,
  error: {
    message: 'Specific error description',
    code: 'ERROR_CODE',
    operation: 'createContactNote'
  }
}
```

### Backward Compatibility Error Mapping

Existing error handling patterns are preserved for service-level errors:

```typescript
catch (error) {
  if (error instanceof BcpError) {
    throw error; // Preserve existing error handling
  }
  // Transform other errors appropriately
}
```

## Documentation Requirements

### API Documentation

Each operation requires comprehensive documentation with examples:

```markdown
### createContactNote

Creates a note directly associated with a contact.

**Parameters:**
- `contactId` (string, required): ID of the contact
- `content` (string, required): Note content
- `ownerId` (string, optional): HubSpot owner ID
- `timestamp` (string, optional): Note timestamp
- `metadata` (object, optional): Additional properties

**Example:**
```json
{
  "operation": "createContactNote",
  "contactId": "12345",
  "content": "Customer expressed interest in premium features"
}
```
```

### Migration Guide

Clear migration path from existing tools to unified tool:

```markdown
### Migration from Individual Tools

**Before (Complex Workflow):**
```json
// Step 1: Create note
{
  "tool": "createNote",
  "content": "Meeting notes"
}

// Step 2: Associate with contact
{
  "tool": "addAssociationToNote", 
  "noteId": "returned-note-id",
  "objectType": "contacts",
  "objectId": "12345"
}
```

**After (Unified Tool):**
```json
// Single operation
{
  "operation": "createContactNote",
  "contactId": "12345", 
  "content": "Meeting notes"
}
```
```

This comprehensive implementation specification provides developers with all the technical details needed to build the unified Notes tool architecture while maintaining backward compatibility and following established patterns in the codebase.