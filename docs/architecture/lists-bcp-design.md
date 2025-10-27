# HubSpot Lists BCP Architecture

**Document Version:** 1.0
**Date:** October 27, 2025
**Architect:** PACT Architect
**Phase:** Architecture (PACT Framework)

---

## Executive Summary

This document defines the complete architecture for a production-ready Lists BCP (Bounded Context Pack) to be integrated into the existing HubSpot MCP server. The Lists BCP enables programmatic management of HubSpot lists (also known as Segments), supporting MANUAL (static), DYNAMIC (auto-updating), and SNAPSHOT (initially filtered, then manual) list types.

### Key Design Decisions

1. **Full Pattern Consistency**: The Lists BCP follows the exact patterns established by existing BCPs (Notes, Contacts, Companies) to ensure seamless integration and maintainability.

2. **Three Processing Types Support**: Complete support for all three HubSpot list types with appropriate validation and error handling to prevent invalid operations (e.g., attempting to manually add members to DYNAMIC lists).

3. **Advanced Filter System**: Robust filter definition support with hierarchical OR/AND branch structures, comprehensive property type operators, and builder utilities to simplify complex filter construction.

4. **Membership Management**: Efficient batch operations supporting up to 100,000 records per operation with pagination for large list memberships.

5. **Response Enhancement**: Rich contextual suggestions integrated via the existing response-enhancer system to guide users through common workflows and prevent mistakes.

### Alignment with Existing Patterns

This architecture maintains 100% consistency with:
- Service pattern from `HubspotBaseService`
- Tool registration via `BcpToolDelegator` and `BcpToolRegistrationFactory`
- Response enhancement via `response-enhancer.ts` and `suggestion-config.ts`
- Type safety with TypeScript interfaces and Zod schemas
- Error handling with `BcpError` exceptions

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [File Structure](#2-file-structure)
3. [Component Specifications](#3-component-specifications)
4. [Type System Design](#4-type-system-design)
5. [API Integration Design](#5-api-integration-design)
6. [Response Enhancement Design](#6-response-enhancement-design)
7. [Implementation Specifications](#7-implementation-specifications)
8. [Quality Requirements](#8-quality-requirements)
9. [Integration Points](#9-integration-points)
10. [Security & Validation](#10-security--validation)
11. [Testing Strategy](#11-testing-strategy)
12. [Open Questions & Decisions](#12-open-questions--decisions)

---

## 1. System Architecture

### 1.1 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Server (HTTP/Stdio)                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              BcpToolRegistrationFactory                          │
│  - Registers hubspotLists tool with MCP server                  │
│  - Defines Zod schema with all operations                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BcpToolDelegator                                │
│  - Routes operation calls to Lists BCP tools                    │
│  - Handles caching and parameter validation                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Lists BCP (index.ts)                        │
│  - Exports BCP definition with all tools                        │
│  - Tools: create, get, search, update, delete, updateFilters,   │
│           addMembers, removeMembers, getMembers                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ListsService                                │
│  extends HubspotBaseService                                      │
│  - Manages HubSpot Lists API v3 interactions                    │
│  - Validates processing types and operations                    │
│  - Handles filter structure validation                          │
│  - Provides helper methods for filter building                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              HubSpot Lists API v3 (REST)                         │
│  - POST /crm/v3/lists (create)                                  │
│  - GET /crm/v3/lists/{listId} (retrieve)                        │
│  - POST /crm/v3/lists/search (search)                           │
│  - PUT /crm/v3/lists/{listId}/update-list-filters               │
│  - PUT /crm/v3/lists/{listId}/memberships/add                   │
│  - GET /crm/v3/lists/{listId}/memberships (pagination)          │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Diagram

```
User Request (MCP Client)
         │
         ▼
   [Zod Validation]
         │
         ▼
  [Tool Delegator]
         │
         ▼
  [Lists Tool Handler]
         │
         ├─── Validates Processing Type
         │
         ├─── Validates Filter Structure (if applicable)
         │
         ▼
  [ListsService Method]
         │
         ├─── checkInitialized()
         │
         ├─── validateRequired()
         │
         ▼
  [HubSpot Client API Call]
         │
         ▼
  [HubSpot API v3 Response]
         │
         ▼
  [Transform to Standard Types]
         │
         ▼
  [Response Enhancer]
         │
         ├─── Add parameter suggestions
         │
         ├─── Add workflow guidance
         │
         ├─── Add domain context
         │
         ▼
  [Enhanced Response] → User
```

### 1.3 Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **MCP Server** | HTTP/Stdio transport, request routing |
| **ToolRegistrationFactory** | Registers `hubspotLists` with operation enum, schema definition |
| **BcpToolDelegator** | Routes operations to correct tool, caching, common parameter extraction |
| **Lists BCP (index.ts)** | Exports tool array, domain definition |
| **Individual Tool Files** | Operation-specific logic, Zod schema, handler function |
| **ListsService** | HubSpot API interaction, validation, error handling, filter helpers |
| **Response Enhancer** | Contextual suggestions based on operation and parameters |
| **Suggestion Config** | Lists-specific suggestion definitions |

---

## 2. File Structure

```
src/bcps/Lists/
├── index.ts                           # BCP definition, exports all tools
├── lists.service.ts                   # Core service extending HubspotBaseService
├── lists.types.ts                     # TypeScript interfaces and types
│
├── lists.create.ts                    # Tool: Create list (MANUAL/DYNAMIC/SNAPSHOT)
├── lists.get.ts                       # Tool: Get list by ID
├── lists.search.ts                    # Tool: Search lists with filters
├── lists.update.ts                    # Tool: Update list name
├── lists.delete.ts                    # Tool: Delete list
├── lists.updateFilters.ts             # Tool: Update DYNAMIC list filters
│
├── lists.addMembers.ts                # Tool: Add records to list
├── lists.removeMembers.ts             # Tool: Remove records from list
├── lists.getMembers.ts                # Tool: Get list members with pagination
│
└── __tests__/                         # Unit and integration tests
    ├── lists.service.test.ts          # Service method tests
    ├── lists.create.test.ts           # Create operation tests
    ├── lists.filters.test.ts          # Filter validation tests
    └── lists.membership.test.ts       # Membership operation tests
```

### File Naming Conventions

- **Service file**: `lists.service.ts` (lowercase domain name)
- **Tool files**: `lists.{operation}.ts` (lowercase, descriptive operation)
- **Types file**: `lists.types.ts` (lowercase domain name)
- **Index file**: `index.ts` (standard BCP entry point)

### File Purposes

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `index.ts` | BCP definition, tool exports | ~50 lines |
| `lists.service.ts` | Service class with all API methods | ~800 lines |
| `lists.types.ts` | All TypeScript interfaces | ~400 lines |
| `lists.create.ts` | Create list tool | ~150 lines |
| `lists.get.ts` | Get list tool | ~100 lines |
| `lists.search.ts` | Search lists tool | ~150 lines |
| `lists.update.ts` | Update name tool | ~100 lines |
| `lists.delete.ts` | Delete list tool | ~80 lines |
| `lists.updateFilters.ts` | Update filters tool | ~150 lines |
| `lists.addMembers.ts` | Add members tool | ~120 lines |
| `lists.removeMembers.ts` | Remove members tool | ~100 lines |
| `lists.getMembers.ts` | Get members tool | ~150 lines |

**Total Estimated Lines**: ~2,450 (excluding tests)

---

## 3. Component Specifications

### 3.1 ListsService Class

#### Class Structure

```typescript
export class ListsService extends HubspotBaseService {
  constructor(config: ServiceConfig) {
    super(config);
  }

  // Core List Operations
  async createList(params: CreateListParams): Promise<List>;
  async getList(listId: string, includeFilters?: boolean): Promise<List>;
  async searchLists(params: SearchListsParams): Promise<SearchListsResponse>;
  async updateListName(listId: string, name: string): Promise<List>;
  async deleteList(listId: string): Promise<void>;
  async updateListFilters(listId: string, filterBranch: FilterBranch): Promise<List>;

  // Membership Operations
  async addMembers(listId: string, recordIds: string[]): Promise<MembershipResult>;
  async removeMembers(listId: string, recordIds: string[]): Promise<MembershipResult>;
  async getMembers(listId: string, params?: GetMembersParams): Promise<MembersPage>;

  // Helper Methods
  private validateProcessingType(list: List, operation: string): void;
  private validateFilterStructure(filterBranch: FilterBranch): void;
  private buildFilterBranch(filters: PropertyFilter[]): FilterBranch;
}
```

#### Method Specifications

##### createList

```typescript
/**
 * Creates a new list in HubSpot
 *
 * @param params - List creation parameters
 * @returns Created List object
 * @throws BcpError for validation failures, missing scopes, or API errors
 */
async createList(params: CreateListParams): Promise<List> {
  this.checkInitialized();

  // Validate required fields
  this.validateRequired(params, ['name', 'objectTypeId', 'processingType'], 'createList');

  // Validate filterBranch requirement for DYNAMIC and SNAPSHOT
  if ((params.processingType === 'DYNAMIC' || params.processingType === 'SNAPSHOT')) {
    if (!params.filterBranch) {
      throw new BcpError(
        `${params.processingType} lists require filterBranch definition`,
        'VALIDATION_ERROR',
        400
      );
    }
    // Validate filter structure
    this.validateFilterStructure(params.filterBranch);
  }

  // Prevent filterBranch on MANUAL lists
  if (params.processingType === 'MANUAL' && params.filterBranch) {
    throw new BcpError(
      'MANUAL lists cannot have filters. Use DYNAMIC or SNAPSHOT for filtered lists.',
      'VALIDATION_ERROR',
      400
    );
  }

  try {
    const response = await this.client.crm.lists.listsApi.create({
      name: params.name,
      objectTypeId: params.objectTypeId,
      processingType: params.processingType,
      ...(params.filterBranch && { filterBranch: params.filterBranch })
    });

    return this.transformListResponse(response);
  } catch (e: any) {
    this.handleListsApiError(e, 'createList');
  }
}
```

##### getList

```typescript
/**
 * Retrieves a list by ID
 *
 * @param listId - List ID to retrieve
 * @param includeFilters - Whether to include filter definitions (default: true)
 * @returns List object
 * @throws BcpError if list not found
 */
async getList(listId: string, includeFilters: boolean = true): Promise<List> {
  this.checkInitialized();

  if (!listId) {
    throw new BcpError('List ID is required', 'VALIDATION_ERROR', 400);
  }

  try {
    const response = await this.client.crm.lists.listsApi.getById(
      listId,
      includeFilters
    );

    return this.transformListResponse(response);
  } catch (e: any) {
    if (e.code === 404 || e.body?.category === 'OBJECT_NOT_FOUND') {
      throw new BcpError(`List with ID '${listId}' not found`, 'NOT_FOUND', 404);
    }
    this.handleListsApiError(e, 'getList');
  }
}
```

##### searchLists

```typescript
/**
 * Searches lists with optional filters
 *
 * @param params - Search parameters
 * @returns Search results with pagination
 */
async searchLists(params: SearchListsParams): Promise<SearchListsResponse> {
  this.checkInitialized();

  const searchRequest: any = {
    listIds: params.listIds || [],
    offset: params.offset || 0,
    count: params.count || 50,
    processingTypes: params.processingTypes || [],
    additionalProperties: params.additionalProperties || [],
    query: params.query || '',
    includeFilters: params.includeFilters !== false
  };

  try {
    const response = await this.client.crm.lists.listsApi.doSearch(searchRequest);

    return {
      lists: response.lists.map(list => this.transformListResponse(list)),
      total: response.lists.length,
      hasMore: response.lists.length === searchRequest.count
    };
  } catch (e: any) {
    this.handleListsApiError(e, 'searchLists');
  }
}
```

##### addMembers

```typescript
/**
 * Adds members to a list (MANUAL or SNAPSHOT only)
 *
 * @param listId - List ID
 * @param recordIds - Array of record IDs to add (max 100,000)
 * @returns Membership operation result
 * @throws BcpError if list is DYNAMIC or other validation failures
 */
async addMembers(listId: string, recordIds: string[]): Promise<MembershipResult> {
  this.checkInitialized();

  if (!listId || !recordIds || recordIds.length === 0) {
    throw new BcpError(
      'List ID and at least one record ID are required',
      'VALIDATION_ERROR',
      400
    );
  }

  if (recordIds.length > 100000) {
    throw new BcpError(
      'Maximum 100,000 records can be added per operation',
      'VALIDATION_ERROR',
      400
    );
  }

  // Fetch list to validate processing type
  const list = await this.getList(listId, false);

  if (list.processingType === 'DYNAMIC') {
    throw new BcpError(
      'Cannot manually add members to DYNAMIC lists. Update filters instead using updateListFilters.',
      'CONFLICT',
      409
    );
  }

  try {
    await this.client.crm.lists.membershipsApi.add(listId, {
      recordIds: recordIds
    });

    return {
      success: true,
      recordsAdded: recordIds.length,
      listId: listId
    };
  } catch (e: any) {
    this.handleListsApiError(e, 'addMembers');
  }
}
```

##### updateListFilters

```typescript
/**
 * Updates filter definitions for DYNAMIC lists
 *
 * @param listId - List ID
 * @param filterBranch - New filter branch structure
 * @returns Updated List object
 * @throws BcpError if list is not DYNAMIC or validation failures
 */
async updateListFilters(
  listId: string,
  filterBranch: FilterBranch
): Promise<List> {
  this.checkInitialized();

  if (!listId || !filterBranch) {
    throw new BcpError(
      'List ID and filterBranch are required',
      'VALIDATION_ERROR',
      400
    );
  }

  // Validate filter structure
  this.validateFilterStructure(filterBranch);

  // Fetch list to validate processing type
  const list = await this.getList(listId, false);

  if (list.processingType !== 'DYNAMIC') {
    throw new BcpError(
      `Cannot update filters on ${list.processingType} lists. Only DYNAMIC lists support filter updates.`,
      'CONFLICT',
      409
    );
  }

  try {
    await this.client.crm.lists.listsApi.updateListFilters(listId, {
      filterBranch: filterBranch
    });

    // Fetch updated list to return
    return this.getList(listId, true);
  } catch (e: any) {
    this.handleListsApiError(e, 'updateListFilters');
  }
}
```

#### Helper Methods

##### validateFilterStructure

```typescript
/**
 * Validates that a filter branch follows HubSpot's required structure:
 * - Root must be OR branch
 * - Root must have empty filters array
 * - Children must be AND branches
 * - AND branches contain actual filters
 */
private validateFilterStructure(filterBranch: FilterBranch): void {
  // Root must be OR
  if (filterBranch.filterBranchType !== 'OR') {
    throw new BcpError(
      'Root filter branch must be of type OR',
      'VALIDATION_ERROR',
      400
    );
  }

  // Root must have empty filters
  if (filterBranch.filters && filterBranch.filters.length > 0) {
    throw new BcpError(
      'Root OR branch must have empty filters array. Place filters in child AND branches.',
      'VALIDATION_ERROR',
      400
    );
  }

  // Must have at least one AND branch
  if (!filterBranch.filterBranches || filterBranch.filterBranches.length === 0) {
    throw new BcpError(
      'Filter branch must contain at least one child AND branch',
      'VALIDATION_ERROR',
      400
    );
  }

  // Validate AND branches
  filterBranch.filterBranches.forEach((andBranch, index) => {
    if (andBranch.filterBranchType !== 'AND') {
      throw new BcpError(
        `Child branch ${index} must be of type AND`,
        'VALIDATION_ERROR',
        400
      );
    }

    if (!andBranch.filters || andBranch.filters.length === 0) {
      throw new BcpError(
        `AND branch ${index} must contain at least one filter`,
        'VALIDATION_ERROR',
        400
      );
    }
  });
}
```

##### handleListsApiError

```typescript
/**
 * Specialized error handler for Lists API errors
 */
private handleListsApiError(error: any, context: string): never {
  const statusCode = error.response?.statusCode || error.statusCode;
  const body = error.response?.body || {};

  switch (statusCode) {
    case 400:
      throw new BcpError(
        `Invalid request: ${body.message || 'Check filter structure and parameters'}`,
        'VALIDATION_ERROR',
        400,
        { context, details: body.errors }
      );

    case 403:
      throw new BcpError(
        'Missing required scope: crm.lists.read or crm.lists.write',
        'MISSING_SCOPES',
        403,
        { context, requiredScopes: ['crm.lists.read', 'crm.lists.write'] }
      );

    case 404:
      throw new BcpError(
        'List not found',
        'NOT_FOUND',
        404,
        { context }
      );

    case 409:
      throw new BcpError(
        'Cannot perform operation: conflict with list processing type',
        'CONFLICT',
        409,
        {
          context,
          hint: 'Check if list is DYNAMIC (cannot add members) or ensure list exists'
        }
      );

    case 429:
      throw new BcpError(
        'Rate limit exceeded',
        'RATE_LIMIT',
        429,
        {
          context,
          retryAfter: error.response?.headers['retry-after'],
          hint: 'Implement exponential backoff'
        }
      );

    default:
      return this.handleApiError(error, context);
  }
}
```

### 3.2 Tool Definitions

#### Tool Pattern (Example: lists.create.ts)

```typescript
/**
 * Create List Tool
 *
 * Creates new HubSpot lists supporting MANUAL, DYNAMIC, and SNAPSHOT types
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { ListsService } from './lists.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for create list tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'List name (required)'
    },
    objectTypeId: {
      type: 'string',
      enum: ['0-1', '0-2', '0-3', '0-5'],
      description: 'Object type: 0-1=Contacts, 0-2=Companies, 0-3=Deals, 0-5=Tickets'
    },
    processingType: {
      type: 'string',
      enum: ['MANUAL', 'DYNAMIC', 'SNAPSHOT'],
      description: 'List processing type'
    },
    filterBranch: {
      type: 'object',
      description: 'Filter definition (required for DYNAMIC and SNAPSHOT)',
      properties: {
        filterBranchType: {
          type: 'string',
          enum: ['OR']
        },
        filterBranches: {
          type: 'array',
          items: { type: 'object' }
        },
        filters: {
          type: 'array',
          items: { type: 'object' }
        }
      }
    }
  },
  required: ['name', 'objectTypeId', 'processingType']
};

/**
 * Create list tool definition
 */
export const tool: ToolDefinition = {
  name: 'create',
  description: 'Create a new HubSpot list (MANUAL, DYNAMIC, or SNAPSHOT)',
  inputSchema,
  handler: async (params) => {
    try {
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      const service = new ListsService({ hubspotAccessToken: apiKey });
      await service.init();

      const result = await service.createList(params);

      const response = {
        success: true,
        message: `List created successfully: ${result.name} (${result.processingType})`,
        list: result
      };

      return enhanceResponse(response, 'create', params, 'Lists');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResponse = {
        success: false,
        message: 'Failed to create list',
        error: errorMessage
      };

      return enhanceResponse(errorResponse, 'create', params, 'Lists', error as Error);
    }
  }
};
```

#### All Tool Files Summary

| Tool File | Operation | Description | Complexity |
|-----------|-----------|-------------|------------|
| `lists.create.ts` | create | Create MANUAL/DYNAMIC/SNAPSHOT lists | High |
| `lists.get.ts` | get | Retrieve list by ID | Low |
| `lists.search.ts` | search | Search with filters, pagination | Medium |
| `lists.update.ts` | update | Update list name | Low |
| `lists.delete.ts` | delete | Delete list (recoverable 90 days) | Low |
| `lists.updateFilters.ts` | updateFilters | Update DYNAMIC list filters | High |
| `lists.addMembers.ts` | addMembers | Add records to list | Medium |
| `lists.removeMembers.ts` | removeMembers | Remove records from list | Medium |
| `lists.getMembers.ts` | getMembers | Get members with pagination | Medium |

---

## 4. Type System Design

### 4.1 Core Interfaces

```typescript
/**
 * lists.types.ts
 *
 * TypeScript type definitions for Lists BCP
 */

/**
 * List processing types
 */
export type ProcessingType = 'MANUAL' | 'DYNAMIC' | 'SNAPSHOT';

/**
 * Supported object type IDs
 */
export type ObjectTypeId = '0-1' | '0-2' | '0-3' | '0-5' | '0-7' | '0-47' | '0-48' | '0-53' | '0-54';

/**
 * Filter branch types
 */
export type FilterBranchType = 'OR' | 'AND' | 'UNIFIED_EVENTS' | 'ASSOCIATION';

/**
 * Property filter operation types
 */
export type OperationType = 'MULTISTRING' | 'NUMBER' | 'BOOL' | 'TIME_POINT';

/**
 * Filter operators by operation type
 */
export type MultistringOperator =
  | 'IS_EQUAL_TO'
  | 'IS_NOT_EQUAL_TO'
  | 'CONTAINS'
  | 'DOES_NOT_CONTAIN'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'HAS_EVER_BEEN_EQUAL_TO'
  | 'HAS_NEVER_BEEN_EQUAL_TO'
  | 'HAS_EVER_CONTAINED'
  | 'HAS_NEVER_CONTAINED'
  | 'IS_BETWEEN'
  | 'IS_NOT_BETWEEN'
  | 'IS_KNOWN'
  | 'IS_NOT_KNOWN';

export type NumberOperator =
  | 'IS_EQUAL_TO'
  | 'IS_NOT_EQUAL_TO'
  | 'IS_GREATER_THAN'
  | 'IS_LESS_THAN'
  | 'IS_GREATER_THAN_OR_EQUAL_TO'
  | 'IS_LESS_THAN_OR_EQUAL_TO'
  | 'IS_BETWEEN'
  | 'IS_NOT_BETWEEN'
  | 'HAS_EVER_BEEN_EQUAL_TO'
  | 'HAS_NEVER_BEEN_EQUAL_TO'
  | 'IS_KNOWN'
  | 'IS_NOT_KNOWN';

export type BoolOperator =
  | 'IS_EQUAL_TO'
  | 'IS_NOT_EQUAL_TO'
  | 'IS_KNOWN'
  | 'IS_NOT_KNOWN';

export type TimePointOperator =
  | 'IS_EQUAL_TO'
  | 'IS_AFTER'
  | 'IS_BEFORE'
  | 'IS_BETWEEN'
  | 'IS_RELATIVE'
  | 'IS_WITHIN_TIME_WINDOW';

/**
 * Core List object
 */
export interface List {
  listId: string;
  name: string;
  objectTypeId: ObjectTypeId;
  processingType: ProcessingType;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  filterBranch?: FilterBranch;
  membershipCount?: number;
}

/**
 * Filter branch structure (hierarchical)
 */
export interface FilterBranch {
  filterBranchType: FilterBranchType;
  filterBranches: FilterBranch[];
  filters: PropertyFilter[];
}

/**
 * Property filter
 */
export interface PropertyFilter {
  filterType: 'PROPERTY';
  property: string;
  operation: FilterOperation;
}

/**
 * Filter operations (union type based on operationType)
 */
export type FilterOperation =
  | MultistringOperation
  | NumberOperation
  | BoolOperation
  | TimePointOperation;

export interface MultistringOperation {
  operationType: 'MULTISTRING';
  operator: MultistringOperator;
  values?: string[];
}

export interface NumberOperation {
  operationType: 'NUMBER';
  operator: NumberOperator;
  value?: number;
  lowerBound?: number;
  upperBound?: number;
}

export interface BoolOperation {
  operationType: 'BOOL';
  operator: BoolOperator;
  value?: boolean;
}

export interface TimePointOperation {
  operationType: 'TIME_POINT';
  operator: TimePointOperator;
  timestamp?: number;
  lowerBound?: number;
  upperBound?: number;
  rangeType?: 'ROLLING' | 'FIXED';
  timeUnit?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  offset?: number;
}

/**
 * List creation parameters
 */
export interface CreateListParams {
  name: string;
  objectTypeId: ObjectTypeId;
  processingType: ProcessingType;
  filterBranch?: FilterBranch;
}

/**
 * Search lists parameters
 */
export interface SearchListsParams {
  listIds?: string[];
  offset?: number;
  count?: number;
  processingTypes?: ProcessingType[];
  additionalProperties?: string[];
  query?: string;
  includeFilters?: boolean;
}

/**
 * Search lists response
 */
export interface SearchListsResponse {
  lists: List[];
  total: number;
  hasMore: boolean;
}

/**
 * Get members parameters
 */
export interface GetMembersParams {
  limit?: number;
  after?: string;
}

/**
 * Members page (paginated result)
 */
export interface MembersPage {
  members: ListMember[];
  pagination?: {
    after?: string;
  };
  total?: number;
}

/**
 * List member
 */
export interface ListMember {
  recordId: string;
  addedAt?: string;
}

/**
 * Membership operation result
 */
export interface MembershipResult {
  success: boolean;
  recordsAdded?: number;
  recordsRemoved?: number;
  listId: string;
}
```

### 4.2 Zod Schemas

Zod schemas are defined inline within tool files following the existing pattern. Key validation rules:

- **name**: Required string, min 1 character
- **objectTypeId**: Enum of valid object type IDs
- **processingType**: Enum ['MANUAL', 'DYNAMIC', 'SNAPSHOT']
- **filterBranch**: Complex nested object validation for hierarchical structure
- **recordIds**: Array of strings, min 1 item, max 100,000 items for batch operations
- **limit**: Integer between 1 and 500
- **after**: Optional string for pagination cursor

---

## 5. API Integration Design

### 5.1 HubSpot API v3 Endpoints

| Operation | HTTP Method | Endpoint | Request Body | Response |
|-----------|-------------|----------|--------------|----------|
| Create List | POST | `/crm/v3/lists` | `{ name, objectTypeId, processingType, filterBranch? }` | List object |
| Get List | GET | `/crm/v3/lists/{listId}?includeFilters=true` | N/A | List object |
| Search Lists | POST | `/crm/v3/lists/search` | `{ query, processingTypes, offset, count, includeFilters }` | Array of lists |
| Update Name | PUT | `/crm/v3/lists/{listId}/update-list-name` | `{ name }` | List object |
| Delete List | DELETE | `/crm/v3/lists/{listId}` | N/A | 204 No Content |
| Update Filters | PUT | `/crm/v3/lists/{listId}/update-list-filters` | `{ filterBranch }` | List object |
| Add Members | PUT | `/crm/v3/lists/{listId}/memberships/add` | `{ recordIds: string[] }` | 204 No Content |
| Remove Members | PUT | `/crm/v3/lists/{listId}/memberships/remove` | `{ recordIds: string[] }` | 204 No Content |
| Get Members | GET | `/crm/v3/lists/{listId}/memberships?limit=100&after=cursor` | N/A | Paginated members |

### 5.2 Authentication

Uses existing `@hubspot/api-client` with Bearer token authentication:

```typescript
const client = new Client({
  accessToken: config.hubspotAccessToken
});

// Access Lists API
client.crm.lists.listsApi.create(params);
client.crm.lists.membershipsApi.add(listId, params);
```

**Required Scopes**:
- `crm.lists.read` - Read lists and memberships
- `crm.lists.write` - Create, update, delete lists and manage memberships
- Object-specific scopes for membership operations (e.g., `crm.objects.contacts.read`)

### 5.3 Rate Limiting Strategy

- **Burst Limits**: 190-250 calls per 10 seconds (account-dependent)
- **Daily Limits**: Account-dependent
- **Retry Strategy**: Exponential backoff on 429 errors
- **Batch Operations**: Use batch membership endpoints to minimize API calls

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.statusCode === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 5.4 Error Handling Patterns

```typescript
// Standard error transformation pattern
try {
  const response = await this.client.crm.lists.listsApi.create(params);
  return this.transformListResponse(response);
} catch (e: any) {
  // Check for specific error types
  if (e.code === 404 || e.body?.category === 'OBJECT_NOT_FOUND') {
    throw new BcpError('List not found', 'NOT_FOUND', 404);
  }

  if (e.code === 403 || e.body?.category === 'MISSING_SCOPES') {
    throw new BcpError(
      'Missing required scope: crm.lists.write',
      'MISSING_SCOPES',
      403,
      { requiredScopes: ['crm.lists.write'] }
    );
  }

  if (e.code === 409) {
    throw new BcpError(
      'Cannot add members to DYNAMIC list',
      'CONFLICT',
      409,
      { hint: 'Use updateListFilters for DYNAMIC lists' }
    );
  }

  // Fall back to generic handler
  this.handleListsApiError(e, 'operationContext');
}
```

---

## 6. Response Enhancement Design

### 6.1 Suggestion Categories

Following the existing pattern in `suggestion-config.ts`, Lists suggestions fall into:

1. **Parameter-based suggestions**: Shown when specific parameters are used
2. **Workflow suggestions**: Shown for specific operations to guide next steps
3. **Domain suggestions**: General Lists domain context
4. **Error suggestions**: Specific guidance when errors occur

### 6.2 Lists Suggestions Configuration

Add to `src/core/suggestion-config.ts`:

```typescript
// Parameter-based suggestions
export const PARAMETER_SUGGESTIONS: Record<string, string[]> = {
  // Existing parameters...

  listId: [
    "💡 Find list: {operation: 'search', query: 'list name'}",
    "📋 List all lists: {operation: 'search', count: 50}"
  ],

  processingType: [
    "📋 MANUAL: Static lists you control manually",
    "🔄 DYNAMIC: Auto-updating lists based on filters",
    "📸 SNAPSHOT: Initially filtered, then manual"
  ],

  filterBranch: [
    "🔍 Filter structure: OR branch → AND branches → filters",
    "💡 Root must be OR, children must be AND",
    "📋 Each AND branch contains property filters"
  ],

  recordIds: [
    "📊 Batch operations support up to 100,000 records",
    "💡 Find record IDs using search operations in other domains"
  ]
};

// Workflow suggestions
export const WORKFLOW_SUGGESTIONS: Record<string, string[]> = {
  // Existing workflows...

  createList: [
    "📋 Next: Add members with {operation: 'addMembers', listId: 'list_id', recordIds: [...]}"
  ],

  addMembers: [
    "📊 View members: {operation: 'getMembers', listId: 'list_id', limit: 100}"
  ],

  updateFilters: [
    "⏳ Note: Dynamic lists may take 5-15 minutes to fully evaluate new filters",
    "📊 Check membership: {operation: 'getMembers', listId: 'list_id'}"
  ]
};

// Domain suggestions
export const DOMAIN_SUGGESTIONS: Record<string, string[]> = {
  // Existing domains...

  Lists: [
    "📋 Lists organize records for segmentation and bulk operations",
    "🔄 DYNAMIC lists auto-update based on property filters",
    "💡 Use SNAPSHOT for historical point-in-time lists",
    "⚠️ Cannot manually add members to DYNAMIC lists - update filters instead"
  ]
};

// Error suggestions
export const ERROR_SUGGESTIONS: Record<string, string[]> = {
  // Existing errors...

  INVALID_FILTER_STRUCTURE: [
    "🔍 Root filter branch must be type OR with empty filters array",
    "📋 Child branches must be type AND with at least one filter",
    "💡 Example: { filterBranchType: 'OR', filterBranches: [{ filterBranchType: 'AND', filters: [...] }], filters: [] }"
  ],

  DYNAMIC_LIST_MEMBERSHIP: [
    "⚠️ Cannot manually modify DYNAMIC list membership",
    "🔄 Use {operation: 'updateFilters'} to change membership criteria",
    "💡 Convert to SNAPSHOT if you need filter-based + manual control"
  ]
};
```

### 6.3 Workflow Patterns

Add to `WORKFLOW_PATTERNS` in `suggestion-config.ts`:

```typescript
export const WORKFLOW_PATTERNS: Record<string, Record<string, string[]>> = {
  // Existing patterns...

  Lists: {
    'static-list-creation': [
      "📋 Static List Workflow:",
      "1️⃣ Create list: {operation: 'create', name: 'My List', objectTypeId: '0-1', processingType: 'MANUAL'}",
      "2️⃣ Find records: Use Contacts/Companies domain to search for record IDs",
      "3️⃣ Add members: {operation: 'addMembers', listId: 'list_id', recordIds: ['id1', 'id2']}",
      "4️⃣ Verify: {operation: 'getMembers', listId: 'list_id'}"
    ],

    'dynamic-list-creation': [
      "🔄 Dynamic List Workflow:",
      "1️⃣ Create with filters: {operation: 'create', processingType: 'DYNAMIC', filterBranch: {...}}",
      "2️⃣ Wait 5-15 minutes for initial evaluation",
      "3️⃣ Check members: {operation: 'getMembers', listId: 'list_id'}",
      "4️⃣ Update filters as needed: {operation: 'updateFilters'}"
    ],

    'snapshot-list-creation': [
      "📸 Snapshot List Workflow:",
      "1️⃣ Create with filters: {operation: 'create', processingType: 'SNAPSHOT', filterBranch: {...}}",
      "2️⃣ Wait for initial population",
      "3️⃣ Add/remove members manually: {operation: 'addMembers' or 'removeMembers'}",
      "4️⃣ List captures point-in-time state with manual control"
    ],

    'filter-building': [
      "🔍 Filter Building Workflow:",
      "1️⃣ Identify property: Use Properties domain to find valid property names",
      "2️⃣ Choose operator: IS_EQUAL_TO, CONTAINS, IS_GREATER_THAN, etc.",
      "3️⃣ Build AND branch: Group related conditions",
      "4️⃣ Combine with OR: Multiple AND branches for alternative criteria"
    ]
  }
};
```

### 6.4 Enhanced Response Examples

**Success Response (Create List)**:
```json
{
  "success": true,
  "message": "List created successfully: VIP Customers (MANUAL)",
  "list": {
    "listId": "12345",
    "name": "VIP Customers",
    "objectTypeId": "0-1",
    "processingType": "MANUAL",
    "createdAt": "2025-10-27T10:00:00.000Z",
    "updatedAt": "2025-10-27T10:00:00.000Z"
  },
  "suggestions": [
    "📋 Next: Add members with {operation: 'addMembers', listId: '12345', recordIds: [...]}",
    "💡 Find list: {operation: 'search', query: 'list name'}",
    "📋 Lists organize records for segmentation and bulk operations"
  ]
}
```

**Error Response (Invalid Operation)**:
```json
{
  "success": false,
  "message": "Failed to add members",
  "error": "Cannot manually add members to DYNAMIC lists",
  "suggestions": [
    "⚠️ Cannot manually modify DYNAMIC list membership",
    "🔄 Use {operation: 'updateFilters'} to change membership criteria",
    "💡 Convert to SNAPSHOT if you need filter-based + manual control"
  ]
}
```

---

## 7. Implementation Specifications

### 7.1 Priority 1: Core Operations (Week 1)

**Objective**: Implement essential list management operations

**Files to Create**:
1. `lists.types.ts` - All TypeScript interfaces
2. `lists.service.ts` - Service class with core methods
3. `lists.create.ts` - Create list tool
4. `lists.get.ts` - Get list tool
5. `lists.search.ts` - Search lists tool
6. `lists.delete.ts` - Delete list tool
7. `index.ts` - BCP definition

**Implementation Order**:
1. Define all types in `lists.types.ts`
2. Create `ListsService` skeleton extending `HubspotBaseService`
3. Implement `createList()` with full validation
4. Implement `getList()` with error handling
5. Implement `searchLists()` with pagination
6. Implement `deleteList()` with recovery note
7. Create tool wrappers for each operation
8. Export BCP in `index.ts`

**Success Criteria**:
- All core operations functional
- Type safety enforced throughout
- Error handling comprehensive
- Unit tests passing for service methods

### 7.2 Priority 2: Membership Management (Week 2)

**Objective**: Implement membership operations with validation

**Files to Create**:
1. `lists.addMembers.ts` - Add members tool
2. `lists.removeMembers.ts` - Remove members tool
3. `lists.getMembers.ts` - Get members tool

**Implementation Order**:
1. Implement `addMembers()` with processing type validation
2. Implement `removeMembers()` with processing type validation
3. Implement `getMembers()` with pagination support
4. Add batch operation limits (100k records)
5. Create tool wrappers for each operation

**Success Criteria**:
- Batch operations support up to 100k records
- Processing type validation prevents invalid operations
- Pagination works correctly for large lists
- Error messages guide users to correct actions

### 7.3 Priority 3: Advanced Features (Week 3)

**Objective**: Implement filter management and utilities

**Files to Create**:
1. `lists.updateFilters.ts` - Update filters tool
2. `lists.update.ts` - Update list name tool
3. Filter builder utilities (in `lists.service.ts`)

**Implementation Order**:
1. Implement `updateListFilters()` with structure validation
2. Implement `updateListName()` for simple updates
3. Add `validateFilterStructure()` helper
4. Add `buildFilterBranch()` helper for simple cases
5. Create tool wrappers

**Success Criteria**:
- Filter structure validation prevents API errors
- Helper methods simplify filter building
- Clear error messages for filter issues

### 7.4 Priority 4: Integration & Enhancement (Week 4)

**Objective**: Integrate with existing systems and enhance responses

**Tasks**:
1. Register Lists BCP in `bcp-tool-delegator.ts`
2. Add Lists configuration to `tool-registration-factory.ts`
3. Add Lists suggestions to `suggestion-config.ts`
4. Implement `enhanceListsResponse()` in `response-enhancer.ts`
5. Write integration tests
6. Update documentation

**Integration Points**:

**In `bcp-tool-delegator.ts`**:
```typescript
case 'Lists':
  const listsBcp = await import('../bcps/Lists/index.js');
  bcp = listsBcp.bcp;
  break;
```

**In `tool-registration-factory.ts`**:
```typescript
Lists: {
  operations: [
    'create', 'get', 'search', 'update', 'delete',
    'updateFilters', 'addMembers', 'removeMembers', 'getMembers'
  ],
  description: 'HubSpot list management with MANUAL, DYNAMIC, and SNAPSHOT support'
}
```

**In `response-enhancer.ts`**:
```typescript
/**
 * Convenience function for Lists domain operations
 */
export function enhanceListsResponse(
  result: any,
  operation: string,
  params: Record<string, any>
): EnhancedResponse {
  return enhanceResponse(result, operation, params, 'Lists');
}
```

**Success Criteria**:
- Lists BCP accessible via `hubspotLists` tool
- All operations registered and functional
- Suggestions appear in responses
- Integration tests pass

---

## 8. Quality Requirements

### 8.1 Type Safety

- **100% TypeScript Coverage**: No `any` types except in controlled transformation contexts
- **Strict Mode Enabled**: All strict TypeScript flags enabled
- **Interface Definitions**: All API requests/responses have typed interfaces
- **Zod Validation**: Runtime validation for all user inputs
- **Type Guards**: Use type predicates for runtime type checking

### 8.2 Error Handling Standards

- **BcpError Usage**: All errors thrown as `BcpError` with appropriate codes
- **Contextual Information**: Errors include context about what operation failed
- **User-Friendly Messages**: Error messages guide users toward solutions
- **Error Codes**: Standard codes: `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMIT`, `AUTH_ERROR`
- **Stack Traces**: Preserve original error stack traces for debugging

### 8.3 Testing Requirements

**Unit Tests** (Target: 85% coverage):
- All service methods have dedicated tests
- Filter validation logic thoroughly tested
- Error handling paths tested
- Mock HubSpot client responses

**Integration Tests** (Target: Key workflows):
- Create → Add Members → Get Members workflow
- Create DYNAMIC → Update Filters workflow
- Search and pagination
- Error scenarios (404, 409, 429)

**Test File Structure**:
```
src/bcps/Lists/__tests__/
├── lists.service.test.ts         # Service method tests
├── lists.create.test.ts          # Create operation tests
├── lists.filters.test.ts         # Filter validation tests
├── lists.membership.test.ts      # Membership operations tests
└── lists.integration.test.ts     # End-to-end workflows
```

### 8.4 Documentation Requirements

- **JSDoc Comments**: All public methods and interfaces documented
- **Example Usage**: Code examples for common operations
- **Parameter Descriptions**: Clear descriptions for all parameters
- **Error Scenarios**: Document common errors and solutions
- **Workflow Guides**: Step-by-step guides for common use cases

---

## 9. Integration Points

### 9.1 BCP Registration

**File**: `/src/core/bcp-tool-delegator.ts`

Add case to `loadBcp()` switch statement:

```typescript
case 'Lists':
  const listsBcp = await import('../bcps/Lists/index.js');
  bcp = listsBcp.bcp;
  break;
```

Add operation name mappings if needed in `mapOperationToToolName()`:

```typescript
Lists: {
  // Direct operation names - no mapping needed
  create: 'create',
  get: 'get',
  search: 'search',
  update: 'update',
  delete: 'delete',
  updateFilters: 'updateFilters',
  addMembers: 'addMembers',
  removeMembers: 'removeMembers',
  getMembers: 'getMembers'
}
```

### 9.2 Tool Factory Configuration

**File**: `/src/core/tool-registration-factory.ts`

Add to `DOMAIN_CONFIGS`:

```typescript
Lists: {
  operations: [
    'create',
    'get',
    'search',
    'update',
    'delete',
    'updateFilters',
    'addMembers',
    'removeMembers',
    'getMembers'
  ],
  description: 'HubSpot list management supporting MANUAL (static), DYNAMIC (auto-updating), and SNAPSHOT (filtered then manual) lists with advanced filtering and membership operations'
}
```

Add to `getDomainSpecificParams()` switch statement:

```typescript
case 'Lists':
  return {
    ...commonParams,
    // Core list properties
    name: z.string().optional().describe('List name (required for create)'),
    objectTypeId: z.enum(['0-1', '0-2', '0-3', '0-5']).optional()
      .describe('Object type: 0-1=Contacts, 0-2=Companies, 0-3=Deals, 0-5=Tickets'),
    processingType: z.enum(['MANUAL', 'DYNAMIC', 'SNAPSHOT']).optional()
      .describe('List processing type'),

    // Filter definition
    filterBranch: z.object({
      filterBranchType: z.enum(['OR', 'AND']),
      filterBranches: z.array(z.any()).optional(),
      filters: z.array(z.any()).optional()
    }).optional().describe('Filter definition (required for DYNAMIC and SNAPSHOT)'),

    // Search parameters
    query: z.string().optional().describe('Search query for list names'),
    processingTypes: z.array(z.enum(['MANUAL', 'DYNAMIC', 'SNAPSHOT'])).optional()
      .describe('Filter by processing types'),
    includeFilters: z.boolean().optional().describe('Include filter definitions'),
    count: z.number().min(1).max(100).optional().describe('Results per page'),
    offset: z.number().min(0).optional().describe('Pagination offset'),

    // Membership operations
    listId: z.string().optional().describe('List ID (required for membership operations)'),
    recordIds: z.array(z.string()).min(1).max(100000).optional()
      .describe('Record IDs (max 100,000)'),
    after: z.string().optional().describe('Pagination cursor')
  };
```

### 9.3 Response Enhancer Integration

**File**: `/src/core/response-enhancer.ts`

Add convenience function:

```typescript
/**
 * Convenience function for Lists domain operations
 */
export function enhanceListsResponse(
  result: any,
  operation: string,
  params: Record<string, any>
): EnhancedResponse {
  return enhanceResponse(result, operation, params, 'Lists');
}
```

**File**: `/src/core/suggestion-config.ts`

Add all suggestion configurations as specified in Section 6.2.

### 9.4 Type Exports

Ensure Lists types are exported if needed by other BCPs:

```typescript
// In src/bcps/Lists/index.ts
export * from './lists.types.js';
export { ListsService } from './lists.service.js';
```

---

## 10. Security & Validation

### 10.1 Input Validation

**Required Field Validation**:
```typescript
// Always validate required fields first
this.validateRequired(params, ['name', 'objectTypeId', 'processingType'], 'createList');
```

**Enum Validation**:
```typescript
// Validate enum values
const validProcessingTypes = ['MANUAL', 'DYNAMIC', 'SNAPSHOT'];
if (!validProcessingTypes.includes(params.processingType)) {
  throw new BcpError(
    `Invalid processingType: ${params.processingType}`,
    'VALIDATION_ERROR',
    400
  );
}
```

**Batch Size Limits**:
```typescript
// Enforce HubSpot limits
if (recordIds.length > 100000) {
  throw new BcpError(
    'Maximum 100,000 records can be added per operation',
    'VALIDATION_ERROR',
    400
  );
}
```

### 10.2 Processing Type Constraints

**DYNAMIC List Restrictions**:
```typescript
// Prevent manual membership operations on DYNAMIC lists
if (list.processingType === 'DYNAMIC') {
  throw new BcpError(
    'Cannot manually add members to DYNAMIC lists. Update filters instead.',
    'CONFLICT',
    409,
    { hint: 'Use updateListFilters operation' }
  );
}
```

**MANUAL List Restrictions**:
```typescript
// Prevent filter operations on MANUAL lists
if (list.processingType === 'MANUAL') {
  throw new BcpError(
    'MANUAL lists do not have filters. Create as DYNAMIC for filter-based lists.',
    'CONFLICT',
    409
  );
}
```

### 10.3 Filter Structure Validation

Implement comprehensive validation in `validateFilterStructure()`:

1. Root must be OR branch
2. Root filters array must be empty
3. Must have at least one child AND branch
4. Each AND branch must have at least one filter
5. Filter operators must match operation type
6. Required fields present in each filter

### 10.4 Sanitization

**List Name Sanitization**:
```typescript
function sanitizeListName(name: string): string {
  return name
    .trim()
    .replace(/[<>]/g, '') // Remove potential XSS characters
    .slice(0, 255); // Enforce length limit
}
```

**Query Parameter Sanitization**:
```typescript
// Sanitize search queries
const sanitizedQuery = params.query?.trim().slice(0, 500) || '';
```

---

## 11. Testing Strategy

### 11.1 Unit Test Coverage

**Service Method Tests** (`lists.service.test.ts`):

```typescript
describe('ListsService', () => {
  let service: ListsService;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    mockClient = createMockHubSpotClient();
    service = new ListsService({ hubspotAccessToken: 'test-token' });
    service['client'] = mockClient; // Inject mock
  });

  describe('createList', () => {
    it('should create a MANUAL list successfully', async () => {
      const params: CreateListParams = {
        name: 'Test List',
        objectTypeId: '0-1',
        processingType: 'MANUAL'
      };

      mockClient.crm.lists.listsApi.create.mockResolvedValue({
        listId: '123',
        name: 'Test List',
        objectTypeId: '0-1',
        processingType: 'MANUAL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await service.createList(params);

      expect(result.listId).toBe('123');
      expect(result.processingType).toBe('MANUAL');
      expect(mockClient.crm.lists.listsApi.create).toHaveBeenCalledWith(params);
    });

    it('should require filterBranch for DYNAMIC lists', async () => {
      const params: CreateListParams = {
        name: 'Dynamic List',
        objectTypeId: '0-1',
        processingType: 'DYNAMIC'
        // Missing filterBranch
      };

      await expect(service.createList(params)).rejects.toThrow(
        'DYNAMIC lists require filterBranch definition'
      );
    });

    it('should validate filter structure', async () => {
      const params: CreateListParams = {
        name: 'Dynamic List',
        objectTypeId: '0-1',
        processingType: 'DYNAMIC',
        filterBranch: {
          filterBranchType: 'AND', // Should be OR
          filterBranches: [],
          filters: []
        }
      };

      await expect(service.createList(params)).rejects.toThrow(
        'Root filter branch must be of type OR'
      );
    });
  });

  describe('addMembers', () => {
    it('should add members to MANUAL list', async () => {
      mockClient.crm.lists.listsApi.getById.mockResolvedValue({
        listId: '123',
        processingType: 'MANUAL',
        // ...other fields
      });

      mockClient.crm.lists.membershipsApi.add.mockResolvedValue({});

      const result = await service.addMembers('123', ['contact1', 'contact2']);

      expect(result.success).toBe(true);
      expect(result.recordsAdded).toBe(2);
    });

    it('should reject adding members to DYNAMIC list', async () => {
      mockClient.crm.lists.listsApi.getById.mockResolvedValue({
        listId: '123',
        processingType: 'DYNAMIC',
        // ...other fields
      });

      await expect(
        service.addMembers('123', ['contact1'])
      ).rejects.toThrow('Cannot manually add members to DYNAMIC lists');
    });
  });
});
```

### 11.2 Integration Test Scenarios

**End-to-End Workflow Test** (`lists.integration.test.ts`):

```typescript
describe('Lists Integration Tests', () => {
  let hubspotClient: Client;
  let testListId: string;

  beforeAll(() => {
    hubspotClient = new Client({
      accessToken: process.env.HUBSPOT_TEST_TOKEN
    });
  });

  afterEach(async () => {
    // Cleanup
    if (testListId) {
      try {
        await hubspotClient.crm.lists.listsApi.remove(testListId);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  it('should complete create → add members → get members workflow', async () => {
    // 1. Create MANUAL list
    const createResponse = await hubspotClient.crm.lists.listsApi.create({
      name: `Test List ${Date.now()}`,
      objectTypeId: '0-1',
      processingType: 'MANUAL'
    });

    testListId = createResponse.listId;
    expect(testListId).toBeDefined();

    // 2. Add members
    const testContactIds = ['test-contact-1', 'test-contact-2'];
    await hubspotClient.crm.lists.membershipsApi.add(testListId, {
      recordIds: testContactIds
    });

    // 3. Get members (with retry for eventual consistency)
    await new Promise(resolve => setTimeout(resolve, 2000));
    const membersResponse = await hubspotClient.crm.lists.membershipsApi.getPage(
      testListId,
      100
    );

    expect(membersResponse.results.length).toBeGreaterThan(0);
  });

  it('should handle DYNAMIC list creation and filter updates', async () => {
    // Create DYNAMIC list with initial filters
    const createResponse = await hubspotClient.crm.lists.listsApi.create({
      name: `Dynamic Test ${Date.now()}`,
      objectTypeId: '0-1',
      processingType: 'DYNAMIC',
      filterBranch: {
        filterBranchType: 'OR',
        filterBranches: [{
          filterBranchType: 'AND',
          filterBranches: [],
          filters: [{
            filterType: 'PROPERTY',
            property: 'lifecyclestage',
            operation: {
              operationType: 'MULTISTRING',
              operator: 'IS_EQUAL_TO',
              values: ['lead']
            }
          }]
        }],
        filters: []
      }
    });

    testListId = createResponse.listId;

    // Update filters
    await hubspotClient.crm.lists.listsApi.updateListFilters(testListId, {
      filterBranch: {
        filterBranchType: 'OR',
        filterBranches: [{
          filterBranchType: 'AND',
          filterBranches: [],
          filters: [{
            filterType: 'PROPERTY',
            property: 'lifecyclestage',
            operation: {
              operationType: 'MULTISTRING',
              operator: 'IS_EQUAL_TO',
              values: ['customer']
            }
          }]
        }],
        filters: []
      }
    });

    // Verify update
    const updatedList = await hubspotClient.crm.lists.listsApi.getById(
      testListId,
      true
    );

    expect(updatedList.filterBranch?.filterBranches[0].filters[0].property)
      .toBe('lifecyclestage');
  });
});
```

### 11.3 Test Data Management

**Mock Data Helpers**:
```typescript
// Test data factory
export function createMockList(overrides?: Partial<List>): List {
  return {
    listId: 'mock-list-123',
    name: 'Mock List',
    objectTypeId: '0-1',
    processingType: 'MANUAL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

export function createMockFilterBranch(): FilterBranch {
  return {
    filterBranchType: 'OR',
    filterBranches: [{
      filterBranchType: 'AND',
      filterBranches: [],
      filters: [{
        filterType: 'PROPERTY',
        property: 'email',
        operation: {
          operationType: 'MULTISTRING',
          operator: 'CONTAINS',
          values: ['@example.com']
        }
      }]
    }],
    filters: []
  };
}
```

---

## 12. Open Questions & Decisions

### 12.1 Filter Builder Utility Design

**Question**: Should we provide a high-level filter builder utility class?

**Options**:

**Option A: Simple Helper Methods** (Recommended)
```typescript
// In lists.service.ts
buildSimplePropertyFilter(
  property: string,
  operator: string,
  values: any
): FilterBranch {
  // Returns complete OR → AND → filter structure
}
```

**Pros**: Easy to implement, keeps service focused
**Cons**: Limited to simple cases

**Option B: Fluent Builder Class**
```typescript
const filterBuilder = new ListFilterBuilder()
  .addAndBranch()
    .propertyEquals('lifecyclestage', 'customer')
    .propertyGreaterThan('revenue', 10000)
  .addAndBranch()
    .propertyContains('email', '@example.com')
  .build();
```

**Pros**: Intuitive API, prevents structure errors
**Cons**: Additional complexity, learning curve

**Recommendation**: Start with Option A in v1, consider Option B for v2 if user feedback indicates need.

### 12.2 Membership Count Caching

**Question**: Should we cache list membership counts to reduce API calls?

**Considerations**:
- Membership counts can change frequently for DYNAMIC lists
- Stale counts could mislead users
- Cache invalidation complexity

**Recommendation**: No caching for v1. Always fetch fresh counts from API. Consider caching with short TTL (30s) in v2 if performance becomes an issue.

### 12.3 List Conversion Support

**Question**: Should we support list conversion operations (DYNAMIC → MANUAL)?

**HubSpot API Support**:
- `/crm/v3/lists/{listId}/schedule-conversion` endpoint exists
- One-way conversion only (cannot convert back)
- Scheduling with date or inactivity threshold

**Recommendation**: Defer to v2. Not critical for MVP. Add as `convertList` operation if user demand exists.

### 12.4 Batch Read for Multiple Lists

**Question**: Should we support batch retrieval of multiple lists by IDs?

**HubSpot API Support**:
- `GET /crm/v3/lists?listIds=id1,id2,id3` endpoint exists
- More efficient than individual `getList` calls

**Recommendation**: Add as `batchGet` operation in Priority 3 if time permits. Use case: User has array of list IDs and wants all details.

### 12.5 Association Filters Support

**Question**: Should we support ASSOCIATION filter branches in v1?

**Considerations**:
- Association filters are advanced feature
- Requires understanding of association types
- Complex nested structure

**Recommendation**: Support only PROPERTY filters in v1. Document that ASSOCIATION filters are possible but require manual filterBranch construction. Add examples in documentation.

### 12.6 Error Recovery Patterns

**Question**: Should we implement automatic retry logic in the service?

**Options**:

**Option A: Service-Level Retry**
```typescript
// In service methods
async createList(params: CreateListParams): Promise<List> {
  return this.retryWithBackoff(() =>
    this.client.crm.lists.listsApi.create(params)
  );
}
```

**Option B: Client Responsibility**
```typescript
// Let MCP client handle retries
// Service throws errors immediately
```

**Recommendation**: Option B for v1. Clear error responses allow MCP client to decide retry strategy. Document rate limit handling in error suggestions.

---

## Appendix A: Complete Code Examples

### Example 1: Create Static List and Add Members

```typescript
// Step 1: Create MANUAL list
const createResponse = await tool.handler({
  operation: 'create',
  name: 'Q4 VIP Customers',
  objectTypeId: '0-1',
  processingType: 'MANUAL'
});

// Step 2: Find contacts to add
const searchResponse = await contactsTool.handler({
  operation: 'search',
  searchType: 'email',
  searchTerm: '@vip-domain.com',
  limit: 50
});

// Step 3: Add members
const memberIds = searchResponse.contacts.map(c => c.id);
const addResponse = await tool.handler({
  operation: 'addMembers',
  listId: createResponse.list.listId,
  recordIds: memberIds
});

// Step 4: Verify
const membersResponse = await tool.handler({
  operation: 'getMembers',
  listId: createResponse.list.listId,
  limit: 100
});
```

### Example 2: Create Dynamic List with Filters

```typescript
const createResponse = await tool.handler({
  operation: 'create',
  name: 'High-Value Customers',
  objectTypeId: '0-1',
  processingType: 'DYNAMIC',
  filterBranch: {
    filterBranchType: 'OR',
    filterBranches: [
      {
        filterBranchType: 'AND',
        filterBranches: [],
        filters: [
          {
            filterType: 'PROPERTY',
            property: 'lifecyclestage',
            operation: {
              operationType: 'MULTISTRING',
              operator: 'IS_EQUAL_TO',
              values: ['customer']
            }
          },
          {
            filterType: 'PROPERTY',
            property: 'total_revenue',
            operation: {
              operationType: 'NUMBER',
              operator: 'IS_GREATER_THAN',
              value: 100000
            }
          }
        ]
      }
    ],
    filters: []
  }
});
```

### Example 3: Update Dynamic List Filters

```typescript
const updateResponse = await tool.handler({
  operation: 'updateFilters',
  listId: 'dynamic-list-id',
  filterBranch: {
    filterBranchType: 'OR',
    filterBranches: [
      {
        filterBranchType: 'AND',
        filterBranches: [],
        filters: [
          {
            filterType: 'PROPERTY',
            property: 'lifecyclestage',
            operation: {
              operationType: 'MULTISTRING',
              operator: 'IS_EQUAL_TO',
              values: ['lead', 'customer']
            }
          }
        ]
      }
    ],
    filters: []
  }
});
```

---

## Appendix B: Filter Examples Library

### Contact Filters

```typescript
// All contacts created in last 30 days
{
  filterType: 'PROPERTY',
  property: 'createdate',
  operation: {
    operationType: 'TIME_POINT',
    operator: 'IS_WITHIN_TIME_WINDOW',
    rangeType: 'ROLLING',
    timeUnit: 'DAY',
    offset: -30
  }
}

// Contacts with specific lifecycle stage
{
  filterType: 'PROPERTY',
  property: 'lifecyclestage',
  operation: {
    operationType: 'MULTISTRING',
    operator: 'IS_EQUAL_TO',
    values: ['customer']
  }
}

// Contacts with email known
{
  filterType: 'PROPERTY',
  property: 'email',
  operation: {
    operationType: 'MULTISTRING',
    operator: 'IS_KNOWN'
  }
}
```

### Company Filters

```typescript
// Companies in specific industry
{
  filterType: 'PROPERTY',
  property: 'industry',
  operation: {
    operationType: 'MULTISTRING',
    operator: 'IS_EQUAL_TO',
    values: ['Technology', 'Software']
  }
}

// Companies with revenue range
{
  filterType: 'PROPERTY',
  property: 'annualrevenue',
  operation: {
    operationType: 'NUMBER',
    operator: 'IS_BETWEEN',
    lowerBound: 1000000,
    upperBound: 50000000
  }
}
```

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-27 | PACT Architect | Initial architecture document |

---

**End of Architecture Document**

This architecture is ready for implementation by the Code phase specialists. All patterns, specifications, and integration points are clearly defined and aligned with the existing codebase structure.
