# Meta-Tools Architecture Research: Current State Analysis

**Project:** HubSpot MCP Meta-Tools Refactor
**Date:** 2025-12-17
**Purpose:** Comprehensive analysis of current tool registration architecture to guide migration from 12+ domain tools to 2-tool meta-architecture (getTools + useTools)

---

## Executive Summary

The HubSpot MCP server currently implements a **domain-consolidated architecture** with 12 domain-specific tools (e.g., `hubspotCompanies`, `hubspotContacts`). Each domain tool accepts an `operation` parameter to delegate to specific BCP tool handlers. This research documents the complete current state to enable refactoring to a 2-tool meta-architecture where:
- `getTools` - Discovers and returns available operations across all domains
- `useTools` - Executes any operation with domain and operation parameters

### Key Findings

1. **Current Architecture:** 12 domain tools → 70+ operations → 70+ individual BCP tool files
2. **Schema Mismatch:** Tool registration factory schemas differ significantly from actual BCP tool inputSchemas
3. **Delegation Pattern:** BcpToolDelegator maps domain/operation pairs to specific tool handlers via caching
4. **Critical Requirement:** `context` and `goals` parameters are **REQUIRED** at the delegator level but NOT in individual tool schemas

---

## 1. Current Tool Registration Flow

### 1.1 Architecture Overview

```
Client Request
    ↓
HTTP Server (http-server-sdk.ts)
    ↓
MCP Server (McpServer instance)
    ↓
Tool Registration Factory (tool-registration-factory.ts)
    ├─ Creates domain tool (e.g., hubspotCompanies)
    ├─ Defines Zod schema with operation enum + domain params
    └─ Creates handler that delegates to BcpToolDelegator
        ↓
BcpToolDelegator (bcp-tool-delegator.ts)
    ├─ Extracts context/goals (REQUIRED)
    ├─ Loads BCP dynamically (cached)
    ├─ Finds specific tool via operation name
    ├─ Validates params against tool's inputSchema
    └─ Executes tool handler
        ↓
Individual BCP Tool (e.g., companies.create.ts)
    └─ Executes business logic via service
```

### 1.2 Registration Process

**File:** `/mnt/f/Code/hubspot-mcp/src/http-server-sdk.ts`

1. **Server Initialization:**
   - `getOrCreateMCPServer()` creates singleton MCP server instance
   - Prevents duplicate tool registration on session reconnects
   - Initializes context registry (e.g., DealPipelineContextProvider)

2. **Tool Registration:**
   ```typescript
   const delegator = new BcpToolDelegator();
   const toolFactory = new BcpToolRegistrationFactory(contextRegistry);
   await toolFactory.registerAllTools(server, delegator);
   ```

3. **Domain Tool Creation:**
   - Factory iterates through `DOMAIN_CONFIGS` object
   - For each domain: creates tool name, schema, and handler
   - Registers with MCP server using `server.tool(name, schema.shape, handler)`

### 1.3 Tool Execution Flow

**File:** `/mnt/f/Code/hubspot-mcp/src/core/bcp-tool-delegator.ts`

1. **Handler receives params** including `operation`, `context`, `goals`, and operation-specific params
2. **Delegator validates** `context` and `goals` are non-empty strings (REQUIRED)
3. **Delegator loads BCP** via dynamic import (cached after first load)
4. **Delegator finds tool** via operation name mapping
5. **Delegator validates params** against tool's inputSchema (WITHOUT context/goals)
6. **Tool handler executes** with operation params only
7. **Activity logging** records the call (if ActivityHistory is enabled)

### 1.4 Key Classes and Interfaces

**BcpToolRegistrationFactory** (`tool-registration-factory.ts`):
- `DOMAIN_CONFIGS`: Static registry of 12 domains with operations and descriptions
- `createDomainTool()`: Creates tool config with name, schema, handler
- `createDomainSchema()`: Builds Zod schema with base + domain-specific params
- `getDomainSpecificParams()`: Switch statement defining params per domain
- `createDomainHandler()`: Returns async handler that calls delegator.delegate()

**BcpToolDelegator** (`bcp-tool-delegator.ts`):
- `delegate()`: Main entry point for tool execution
- `loadBcp()`: Dynamic import with caching
- `findTool()`: Locates tool by operation name with mapping support
- `mapOperationToToolName()`: Handles domain-specific operation name conventions
- `validateParams()`: Delegates to core validateParams function

---

## 2. Complete Domain/Operation Inventory

### Domain Configuration Source
**File:** `/mnt/f/Code/hubspot-mcp/src/core/tool-registration-factory.ts` (lines 36-84)

### 2.1 Companies Domain

**Tool Name:** `hubspotCompanies`
**BCP File:** `/mnt/f/Code/hubspot-mcp/src/bcps/Companies/index.ts`

| Operation | Tool File | Tool Name | Required Parameters | Optional Parameters |
|-----------|-----------|-----------|---------------------|---------------------|
| `create` | `companies.create.ts` | `create` | `name` | `domain`, `industry`, `description`, `additionalProperties` |
| `get` | `companies.get.ts` | `get` | `id` | - |
| `update` | `companies.update.ts` | `update` | `id` | `name`, `domain`, `industry`, `description`, `additionalProperties` |
| `search` | `companies.search.ts` | `search` | `searchType`, `searchTerm` | `limit` |
| `recent` | `companies.recent.ts` | `recent` | - | `limit` |

**Factory Schema Parameters (getDomainSpecificParams):**
- `id`, `limit`, `properties` (common)
- `name`, `domain`, `industry`, `description`, `searchType`, `searchTerm`

**Schema Mismatch:** Factory uses generic `properties` object; tools use specific `additionalProperties`

---

### 2.2 Contacts Domain

**Tool Name:** `hubspotContacts`
**BCP File:** `/mnt/f/Code/hubspot-mcp/src/bcps/Contacts/index.ts`

| Operation | Tool File | Tool Name | Required Parameters | Optional Parameters |
|-----------|-----------|-----------|---------------------|---------------------|
| `create` | `contacts.create.ts` | `create` | `email` | `firstName`, `lastName`, `phone`, `company`, `additionalProperties` |
| `get` | `contacts.get.ts` | `get` | `id` | `includeAssociations`, `associationTypes`, `associationLimit` |
| `update` | `contacts.update.ts` | `update` | `id` | `email`, `firstName`, `lastName`, `phone`, `company`, `additionalProperties` |
| `search` | `contacts.search.ts` | `search` | `searchType`, `searchTerm` | `limit`, `includeAssociations`, `associationTypes`, `associationLimit` |
| `recent` | `contacts.recent.ts` | `recent` | - | `limit`, `includeAssociations`, `associationTypes`, `associationLimit` |

**Factory Schema Parameters:**
- Common: `id`, `limit`, `properties`
- Domain-specific: `email`, `firstName`, `lastName`, `phone`, `company`, `searchType`, `searchTerm`
- **Association params:** `includeAssociations`, `associationTypes`, `associationLimit`

**Special Features:** Contacts domain includes association enrichment engine for fetching related data

---

### 2.3 Notes Domain

**Tool Name:** `hubspotNotes`
**BCP File:** `/mnt/f/Code/hubspot-mcp/src/bcps/Notes/index.ts`

| Operation | Tool File | Tool Name | Required Parameters | Optional Parameters |
|-----------|-----------|-----------|---------------------|---------------------|
| `get` | `notes.get.ts` | `get` | `noteId` | `includeAssociations` |
| `update` | `notes.update.ts` | `update` | `noteId`, `content` | `ownerId`, `timestamp`, `metadata` |
| `createContactNote` | `notes.createContactNote.ts` | `createContactNote` | `contactId`, `content` | `ownerId`, `timestamp`, `metadata` |
| `createCompanyNote` | `notes.createCompanyNote.ts` | `createCompanyNote` | `companyId`, `content` | `ownerId`, `timestamp`, `metadata` |
| `createDealNote` | `notes.createDealNote.ts` | `createDealNote` | `dealId`, `content` | `ownerId`, `timestamp`, `metadata` |
| `listContactNotes` | `notes.listContactNotes.ts` | `listContactNotes` | `contactId` | `limit`, `after`, `startDate`, `endDate` |
| `listCompanyNotes` | `notes.listCompanyNotes.ts` | `listCompanyNotes` | `companyId` | `limit`, `after`, `startDate`, `endDate` |
| `listDealNotes` | `notes.listDealNotes.ts` | `listDealNotes` | `dealId` | `limit`, `after`, `startDate`, `endDate` |

**Factory Schema Parameters:**
- Common: `id`, `limit`, `properties`
- Core: `content`, `ownerId`, `timestamp`, `metadata`
- Intent-based: `contactId`, `companyId`, `dealId`
- List: `after`, `startDate`, `endDate`, `noteId`, `includeAssociations`

**Unique Pattern:** Intent-based create operations (per object type) rather than generic create

---

### 2.4 Associations Domain

**Tool Name:** `hubspotAssociations`
**BCP File:** `/mnt/f/Code/hubspot-mcp/src/bcps/Associations/index.ts`

| Operation | Tool File | Tool Name | Required Parameters | Optional Parameters |
|-----------|-----------|-----------|---------------------|---------------------|
| `create` | `associations.create.ts` | `createAssociation` | `fromObjectType`, `fromObjectId`, `toObjectType`, `toObjectId`, `associationTypes` | - |
| `createDefault` | `associations.createDefault.ts` | `createDefaultAssociation` | `fromObjectType`, `fromObjectId`, `toObjectType`, `toObjectId` | - |
| `list` | `associations.list.ts` | `listAssociations` | `fromObjectType`, `fromObjectId`, `toObjectType` | `limit`, `after` |
| `batchCreate` | `associations.batchCreate.ts` | `batchCreateAssociations` | `fromObjectType`, `toObjectType`, `associations` | - |
| `batchCreateDefault` | `associations.batchCreateDefault.ts` | `batchCreateDefaultAssociations` | `fromObjectType`, `toObjectType`, `associations` | - |
| `batchRead` | `associations.batchRead.ts` | `batchReadAssociations` | `fromObjectType`, `toObjectType`, `inputs` | - |
| `getAssociationTypes` | `associations.getAssociationTypes.ts` | `getAssociationTypes` | `fromObjectType`, `toObjectType` | - |
| `getAssociationTypeReference` | `associations.getAssociationTypeReference.ts` | `getAssociationTypeReference` | - | - |

**Factory Schema Parameters:**
- Single operations: `fromObjectType`, `toObjectType`, `fromObjectId`, `toObjectId`
- Association types: `associationTypes` (array with `associationCategory`, `associationTypeId`)
- Batch: `associations`, `inputs`
- List: `objectType`, `objectId`, `after`

**Complex Types:**
- `associationTypes`: Array of `{associationCategory, associationTypeId}`
- `associations`: Array of `{from: {id}, to: {id}, types: [...]}`
- `inputs`: Array of `{id}`

**Operation Mapping:** Delegator maps short names to descriptive tool names (e.g., `create` → `createAssociation`)

---

### 2.5 Deals Domain

**Tool Name:** `hubspotDeals`
**BCP File:** `/mnt/f/Code/hubspot-mcp/src/bcps/Deals/index.ts`

| Operation | Tool File | Tool Name | Required Parameters | Optional Parameters |
|-----------|-----------|-----------|---------------------|---------------------|
| `create` | `deals.create.ts` | `create` | `dealname`, `pipeline`, `dealstage` | `amount`, `closedate`, `description`, `hubspot_owner_id`, `additionalProperties` |
| `get` | `deals.get.ts` | `get` | `id` | - |
| `update` | `deals.update.ts` | `update` | `id` | `dealname`, `pipeline`, `dealstage`, `amount`, `closedate`, `description`, `hubspot_owner_id`, `additionalProperties` |
| `search` | `deals.search.ts` | `search` | `searchType` | `query`, `customSearch` |
| `recent` | `deals.recent.ts` | `recent` | - | `limit` |

**Factory Schema Parameters:**
- Common: `id`, `limit`, `properties`
- Deal-specific: `dealname`, `pipeline`, `dealstage`, `amount`, `closedate`, `description`, `hubspot_owner_id`
- Search: `searchType` (enum: name, modifiedDate, custom), `query`, `customSearch`

**customSearch Structure:**
```typescript
{
  filterGroups: Array<{filters: Array<{propertyName, operator, value}>}>,
  sorts: Array<{propertyName, direction}>,
  properties: string[],
  limit: number,
  after: number
}
```

**Context Enhancement:** DealPipelineContextProvider enriches `dealstage` parameter with actual stage options

---

### 2.6 Products Domain

**Tool Name:** `hubspotProducts`
**BCP File:** `/mnt/f/Code/hubspot-mcp/src/bcps/Products/index.ts`

| Operation | Tool File | Tool Name | Required Parameters | Optional Parameters |
|-----------|-----------|-----------|---------------------|---------------------|
| `list` | `products.list.ts` | `list` | - | `limit` |
| `search` | `products.search.ts` | `search` | `name` | `limit` |
| `get` | `products.get.ts` | `get` | `id` | - |

**Factory Schema Parameters:**
- Common: `id`, `limit`, `properties`
- Domain-specific: `name`

**Note:** Read-only domain - no create/update operations

---

### 2.7 Properties Domain

**Tool Name:** `hubspotProperties`
**BCP File:** `/mnt/f/Code/hubspot-mcp/src/bcps/Properties/index.ts`

| Operation | Tool File | Tool Name | Required Parameters | Optional Parameters |
|-----------|-----------|-----------|---------------------|---------------------|
| `search` | `properties.search.ts` | `searchProperties` | `objectType` | `query`, `limit` |
| `get` | `properties.get.ts` | `getProperty` | `objectType`, `propertyName` | - |
| `create` | `properties.create.ts` | `createProperty` | `objectType`, `name`, `label`, `groupName`, `type`, `fieldType` | `description`, `options`, `formField`, `displayOrder`, `hidden`, `hasUniqueValue`, `calculationFormula` |
| `update` | `properties.update.ts` | `updateProperty` | `objectType`, `propertyName` | `label`, `description`, `groupName`, `type`, `fieldType`, `options`, `formField`, `displayOrder`, `hidden`, `hasUniqueValue` |
| `listGroups` | `properties.listGroups.ts` | `listPropertyGroups` | `objectType` | - |
| `getGroup` | `properties.getGroup.ts` | `getPropertyGroup` | `objectType`, `groupName` | - |
| `createGroup` | `properties.createGroup.ts` | `createPropertyGroup` | `objectType`, `name`, `displayName` | `displayOrder` |
| `updateGroup` | `properties.updateGroup.ts` | `updatePropertyGroup` | `objectType`, `groupName`, `displayName` | `displayOrder` |

**Factory Schema Parameters:**
- **EXCLUDES `id`** - Properties never use id, only propertyName
- Common: `limit`, `properties` (generic object)
- Property operations: `objectType`, `propertyName`, `name`, `label`, `description`, `groupName`
- Property config: `type`, `fieldType`, `options`, `formField`, `displayOrder`, `hidden`, `hasUniqueValue`, `calculationFormula`
- Group operations: `displayName`

**Special Feature:** `groupName` uses dynamic schema from cached property groups fetched at startup

**Note:** `list` operation DISABLED to prevent context window overflow (returns 200-500+ properties)

---

### 2.8 Emails Domain

**Tool Name:** `hubspotEmails`
**BCP File:** `/mnt/f/Code/hubspot-mcp/src/bcps/Emails/index.ts`

| Operation | Tool File | Tool Name | Required Parameters | Optional Parameters |
|-----------|-----------|-----------|---------------------|---------------------|
| `create` | `emails.create.ts` | `create` | `name`, `templateId` | `subject`, `from`, `replyTo`, `previewText`, `folderId`, `metadata` |
| `get` | `emails.get.ts` | `get` | `id` | - |
| `update` | `emails.update.ts` | `update` | `id` | `name`, `subject`, `from`, `replyTo`, `previewText`, `state`, `metadata` |
| `list` | `emails.list.ts` | `list` | - | `type`, `campaignId`, `createdAfter`, `createdBefore`, `query`, `after`, `limit` |
| `recent` | `emails.recent.ts` | `recent` | - | `limit` |

**Factory Schema Parameters:**
- Common: `id`, `limit`, `properties`, `metadata`
- Email-specific: `name`, `templateId`, `subject`, `from` (object), `replyTo`, `previewText`, `folderId`
- Update/List: `state` (enum), `type` (enum), `campaignId`, `createdAfter`, `createdBefore`, `query`, `after`

**Complex Types:**
- `from`: `{name?: string, email: string}`
- `state`: Enum of DRAFT, PUBLISHED, SCHEDULED, ARCHIVED
- `type`: Enum of REGULAR, AUTOMATED, AB_TEST, FOLLOW_UP

---

### 2.9 BlogPosts Domain

**Tool Name:** `hubspotBlogPosts`
**BCP File:** `/mnt/f/Code/hubspot-mcp/src/bcps/BlogPosts/index.ts`

| Operation | Tool File | Tool Name | Required Parameters | Optional Parameters |
|-----------|-----------|-----------|---------------------|---------------------|
| `create` | `blogPosts.create.ts` | `create` | `name`, `contentGroupId` | `slug`, `blogAuthorId`, `metaDescription`, `postBody`, `featuredImage`, `useFeaturedImage`, `state`, `tagIds` |
| `get` | `blogPosts.get.ts` | `get` | `id` | - |
| `update` | `blogPosts.update.ts` | `update` | `id` | `name`, `slug`, `blogAuthorId`, `metaDescription`, `postBody`, `featuredImage`, `useFeaturedImage`, `state`, `updateDraftOnly`, `tagIds` |
| `recent` | `blogPosts.recent.ts` | `recent` | - | `limit` |
| `list` | `blogPosts.list.ts` | `list` | - | `limit` |

**Factory Schema Parameters:**
- Common: `id`, `limit`, `properties`
- BlogPost-specific: `name`, `contentGroupId`, `slug`, `blogAuthorId`, `metaDescription`, `postBody`, `featuredImage`, `useFeaturedImage`
- State management: `state` (enum), `updateDraftOnly`, `tagIds`

**Special Feature:** `contentGroupId` uses dynamic schema from cached blogs fetched at startup

---

### 2.10 Quotes Domain

**Tool Name:** `hubspotQuotes`
**BCP File:** `/mnt/f/Code/hubspot-mcp/src/bcps/Quotes/index.ts`

| Operation | Tool File | Tool Name | Required Parameters | Optional Parameters |
|-----------|-----------|-----------|---------------------|---------------------|
| `create` | `quotes.create.ts` | `create` | `title` | `expirationDate`, `status`, `currency`, `language`, `locale`, `additionalProperties` |
| `get` | `quotes.get.ts` | `get` | `id` | - |
| `update` | `quotes.update.ts` | `update` | `id` | `title`, `expirationDate`, `status`, `currency`, `language`, `locale`, `additionalProperties` |
| `search` | `quotes.search.ts` | `search` | `searchType` | `searchTerm` |
| `recent` | `quotes.recent.ts` | `recent` | - | `limit` |
| `addLineItem` | `quotes.addLineItem.ts` | `addLineItem` | `quoteId`, `name` | `productId`, `quantity`, `price`, `discount`, `discountPercentage`, `termInMonths`, `recurringBillingPeriod`, `description` |
| `listLineItems` | `quotes.listLineItems.ts` | `listLineItems` | `quoteId` | - |
| `updateLineItem` | `quotes.updateLineItem.ts` | `updateLineItem` | `lineItemId` | `name`, `quantity`, `price`, `discount`, `discountPercentage`, `termInMonths`, `recurringBillingPeriod`, `description` |
| `removeLineItem` | `quotes.removeLineItem.ts` | `removeLineItem` | `quoteId`, `lineItemId` | - |

**Factory Schema Parameters:**
- Common: `id`, `limit`, `properties`
- Quote-specific: `title`, `expirationDate`, `status`, `currency`, `language`, `locale`
- Search: `searchType` (enum), `searchTerm`
- Line items: `quoteId`, `lineItemId`, `productId`, `quantity`, `price`, `discount`, `discountPercentage`, `termInMonths`, `recurringBillingPeriod`

**Complex Enums:**
- `status`: DRAFT, APPROVAL_NOT_NEEDED, PENDING_APPROVAL, APPROVED, REJECTED, PENDING_BUYER_ACTION, ACCEPTED, DECLINED, LOST, WON
- `recurringBillingPeriod`: monthly, quarterly, semiannually, annually, per_two_years, per_three_years

---

### 2.11 ActivityHistory Domain

**Tool Name:** `hubspotActivityHistory`
**BCP File:** `/mnt/f/Code/hubspot-mcp/src/bcps/ActivityHistory/index.ts`

| Operation | Tool File | Tool Name | Required Parameters | Optional Parameters |
|-----------|-----------|-----------|---------------------|---------------------|
| `recent` | `activityHistory.recent.ts` | `recent` | - | `days`, `domain`, `operation` |
| `search` | `activityHistory.search.ts` | `search` | `query` | `days`, `domain`, `operation` |

**Factory Schema Parameters:**
- `days` (min: 1, max: 30, default: 7)
- `domain` (filter by domain name)
- `operation` (filter by operation name)
- `query` (for search operation)

**Special Features:**
- Queries PostgreSQL database for tool call history
- Prevents recursive logging (doesn't log itself)
- Requires ActivityHistoryService injection via delegator

---

### 2.12 Lists Domain

**Tool Name:** `hubspotLists`
**BCP File:** `/mnt/f/Code/hubspot-mcp/src/bcps/Lists/index.ts`

| Operation | Tool File | Tool Name | Required Parameters | Optional Parameters |
|-----------|-----------|-----------|---------------------|---------------------|
| `create` | `lists.create.ts` | `create` | `name`, `objectTypeId`, `processingType` | `filterBranch` (required for DYNAMIC/SNAPSHOT) |
| `get` | `lists.get.ts` | `get` | `listId` | `includeFilters` |
| `search` | `lists.search.ts` | `search` | - | `query`, `processingTypes`, `includeFilters`, `count`, `offset`, `listIds` |
| `update` | `lists.update.ts` | `update` | `listId` | `name` |
| `delete` | `lists.delete.ts` | `delete` | `listId` | - |
| `updateFilters` | `lists.updateFilters.ts` | `updateFilters` | `listId`, `filterBranch` | - |
| `addMembers` | `lists.addMembers.ts` | `addMembers` | `listId`, `recordIds` | - |
| `removeMembers` | `lists.removeMembers.ts` | `removeMembers` | `listId`, `recordIds` | - |
| `getMembers` | `lists.getMembers.ts` | `getMembers` | `listId` | `limit`, `after` |

**Factory Schema Parameters:**
- List management: `listId`, `name`, `objectTypeId` (enum: 0-1, 0-2, 0-3, 0-5), `processingType` (enum: MANUAL, DYNAMIC, SNAPSHOT)
- Filter operations: `filterBranch` (complex nested object)
- Search: `query`, `processingTypes`, `includeFilters`, `count`, `offset`, `listIds`
- Membership: `recordIds` (array, max 100,000), `after`

**Complex Types - filterBranch Structure:**
```typescript
{
  filterBranchType: 'OR',  // Root must be OR
  filters: [],  // Empty at root level
  filterBranches: [  // Array of AND branches
    {
      filterBranchType: 'AND',
      filterBranches: [],  // Usually empty
      filters: [  // Actual filter objects
        {
          filterType: 'PROPERTY',
          property: 'email',
          operation: {
            operationType: 'MULTISTRING',  // or NUMBER, BOOL, TIME_POINT, ENUMERATION
            operator: 'IS_EQUAL_TO',  // IS_NOT_EQUAL_TO, CONTAINS, etc.
            values: ['value1'],  // For MULTISTRING/ENUMERATION
            value: 123  // For NUMBER/BOOL/TIME_POINT
          }
        }
      ]
    }
  ]
}
```

**Special Features:**
- Auto-fix for common filter structure mistakes in service layer
- Detailed schema documentation for complex filter syntax
- Support for three list types with different filter requirements

---

## 3. Schema Generation Patterns and Mismatches

### 3.1 Current Schema Generation Pattern

**Location:** `tool-registration-factory.ts` → `createDomainSchema()` → `getDomainSpecificParams()`

**Pattern:**
1. **Base schema** (applied to ALL domains):
   ```typescript
   {
     context: z.string().min(1).describe('...'),  // REQUIRED
     goals: z.string().min(1).describe('...'),    // REQUIRED
     operation: z.enum([operations]).describe('...')
   }
   ```

2. **Common parameters** (mixed into most domains):
   ```typescript
   {
     id: z.string().optional(),
     limit: z.number().int().min(1).max(100).optional(),
     properties: z.record(z.any()).optional()
   }
   ```

3. **Domain-specific parameters** via switch statement
4. **Dynamic context enrichment** from context providers (e.g., deal stages)

### 3.2 Critical Schema Mismatches

#### Mismatch Type 1: Generic vs. Specific Property Names

**Factory Schema:**
```typescript
properties: z.record(z.any()).optional()
```

**Actual Tool Schema (companies.create.ts):**
```typescript
additionalProperties: {
  type: 'object',
  description: 'Additional company properties',
  properties: {}
}
```

**Impact:** Parameter name mismatch - tools expect `additionalProperties`, factory provides `properties`

---

#### Mismatch Type 2: Missing Required Context Parameters

**Factory Schema (all domains):**
```typescript
context: z.string().min(1).describe('Contextual information...'),
goals: z.string().min(1).describe('Specific goals...')
```

**Actual Tool Schemas:**
- **NO context or goals parameters** in any individual tool inputSchema
- These are **stripped** by delegator before passing to tool handler

**Impact:**
- Delegator REQUIRES these at top level
- Tools NEVER see these parameters
- Documentation confusion for LLMs calling tools

---

#### Mismatch Type 3: Operation-Specific Required Parameters

**Example: Notes Domain**

**Factory Schema:**
```typescript
contactId: z.string().optional(),
companyId: z.string().optional(),
dealId: z.string().optional()
```

**Actual Tool Schema (createContactNote):**
```typescript
{
  contactId: { type: 'string', description: '...' },  // In required array
  content: { type: 'string', description: '...' }
}
required: ['contactId', 'content']
```

**Impact:** Factory marks as optional what tools require - validation mismatch

---

#### Mismatch Type 4: Complex Type Simplification

**Example: Associations Domain**

**Factory Schema:**
```typescript
associationTypes: z.array(z.object({
  associationCategory: z.enum(['HUBSPOT_DEFINED', 'USER_DEFINED', 'INTEGRATOR_DEFINED']),
  associationTypeId: z.number().int()
})).optional()
```

**Actual Tool Schema (associations.create.ts):**
```typescript
associationTypes: {
  type: 'array',
  description: 'The types of associations to create',
  items: {
    type: 'object',
    properties: {
      associationCategory: { type: 'string', enum: [...] },
      associationTypeId: { type: 'integer', description: '...' }
    },
    required: ['associationCategory', 'associationTypeId']
  }
}
// In tool's required array
```

**Impact:** Factory has correct structure but marks as optional; tool requires it

---

#### Mismatch Type 5: Domain-Specific Exclusions

**Example: Properties Domain**

**Factory Schema:**
- Includes `id` parameter from common params
- Uses `propertyName` separately

**Actual Pattern:**
- Properties NEVER use `id`
- Always use `propertyName` to identify properties
- Factory comment: "Properties never uses 'id', only 'propertyName'"

**Impact:** Factory partially compensates but still includes conflicting param

---

### 3.3 Schema Generation Code Analysis

**Dynamic Context Application:**

```typescript
private applyDynamicContext(domain: string, baseParams: Record<string, z.ZodType<any>>): Record<string, z.ZodType<any>> {
  // Fetches context from providers (e.g., deal stages, property groups)
  // Enriches enum schemas with actual values from HubSpot API
  // Adds descriptive labels to help LLMs choose correct values
}
```

**Providers:**
- `DealPipelineContextProvider`: Fetches deal stages/pipelines, enriches `dealstage` parameter
- Property groups fetched at startup for `groupName` parameter
- Blog IDs fetched at startup for `contentGroupId` parameter

**Strength:** Provides real-time valid values to LLMs
**Weakness:** Tied to factory architecture, needs refactoring for meta-tool approach

---

### 3.4 Validation Flow Mismatch

**Current Flow:**

1. **Factory Zod Schema** validates at MCP server level (includes context/goals)
2. **Delegator** extracts and validates context/goals separately
3. **Delegator** calls `validateParams()` with tool's inputSchema (excludes context/goals)
4. **Tool inputSchema** validates operation-specific params only

**Problems:**

- **Double validation** for operation params (Zod then manual)
- **Split validation logic** between factory and delegator
- **Inconsistent error messages** from different validation layers
- **Schema documentation** doesn't match actual tool requirements

---

## 4. Key Files Requiring Modification

### 4.1 Core Architecture Files

#### `/src/core/tool-registration-factory.ts` (MAJOR REFACTOR)
**Current Responsibility:** Register 12 domain tools with operation enums
**Future Responsibility:** Register 2 meta-tools (getTools, useTools)

**Changes Required:**
- Remove `DOMAIN_CONFIGS` static registry
- Remove `getDomainSpecificParams()` switch statement
- Create `getTools` tool that discovers all BCPs and operations
- Create `useTools` tool that accepts domain + operation + params
- Preserve context provider integration for dynamic enums
- Generate schemas dynamically from actual BCP tool inputSchemas

**Complexity:** HIGH - Complete architectural change

---

#### `/src/core/bcp-tool-delegator.ts` (MODERATE REFACTOR)
**Current Responsibility:** Map domain/operation to tool handler
**Future Responsibility:** Same, but called by useTools meta-tool

**Changes Required:**
- Keep `delegate()` method (called by useTools)
- Keep `loadBcp()` and caching logic
- Keep `validateParams()` logic
- Possibly add `discoverAllOperations()` for getTools
- Keep context/goals validation
- May need `getToolSchema(domain, operation)` for getTools

**Complexity:** MODERATE - Mostly additions, core logic preserved

---

#### `/src/core/types.ts` (MINOR)
**Changes Required:**
- Potentially add `MetaToolResult` type
- Potentially add `OperationDiscovery` type
- Keep existing types for BCP, ToolDefinition, InputSchema

**Complexity:** LOW - Mostly additions

---

### 4.2 Server Initialization Files

#### `/src/http-server-sdk.ts` (MINOR)
**Changes Required:**
- Update call to `toolFactory.registerAllTools()` (if signature changes)
- Update health endpoint to reflect new tool count (2 instead of 12)
- Update debug endpoints if needed

**Complexity:** LOW - Mostly configuration updates

---

#### `/src/core/server.ts` (LEGACY - MAY NOT BE USED)
**Status:** Appears to be legacy stdio server; http-server-sdk.ts is active
**Changes:** Only if maintaining stdio transport support

---

### 4.3 BCP Files (NO CHANGES REQUIRED)

**All 70+ BCP tool files:**
- `src/bcps/*/index.ts` - BCP definitions
- `src/bcps/*/*.ts` - Individual tool implementations

**Changes Required:** NONE - Tools remain unchanged

**Rationale:**
- Tools already have proper inputSchemas
- Handlers already work with delegator pattern
- Only registration layer changes, not business logic

---

### 4.4 Supporting Files

#### `/src/core/context/index.ts` (MINOR)
**Changes Required:**
- May need to expose context providers to getTools for schema discovery
- May need `getContextForOperation(domain, operation)` method

**Complexity:** LOW

---

#### `/src/utils/logger.ts`, `/src/config/environment.ts` (NO CHANGES)
**Changes Required:** None

---

### 4.5 Test Files (UPDATES REQUIRED)

**Files to Update:**
- Any tests calling domain tools directly
- Update to call getTools + useTools pattern
- `/src/bcps/*/tests/*.test.ts` - Update if they test tool registration

**Complexity:** MODERATE - Test refactoring

---

## 5. Operation Name Mapping Requirements

### 5.1 Current Mapping Pattern

**Delegator Method:** `mapOperationToToolName(domain, operation)`

**Mapping Examples:**

**Notes Domain:**
```typescript
'createContactNote' → 'createContactNote'  // Direct match
'createCompanyNote' → 'createCompanyNote'
```

**Associations Domain:**
```typescript
'create' → 'createAssociation'
'batchCreate' → 'batchCreateAssociations'
'list' → 'listAssociations'
```

**Properties Domain:**
```typescript
'list' → 'listProperties'
'get' → 'getProperty'
'create' → 'createProperty'
```

**Most Domains:**
```typescript
'create' → 'create'  // Direct match (Companies, Contacts, Deals, etc.)
```

---

### 5.2 Mapping Strategy for Meta-Tools

**Option 1: Preserve Mapping**
- Keep `mapOperationToToolName()` in delegator
- useTools calls delegator which handles mapping
- getTools returns operation names as currently defined in DOMAIN_CONFIGS

**Option 2: Standardize Tool Names**
- Return actual tool names in getTools response
- Eliminate mapping logic
- Client uses exact tool names

**Recommendation:** Option 1 (preserve mapping) for backward compatibility

---

## 6. Context and Goals Parameter Handling

### 6.1 Current Implementation

**Delegator Validation:**
```typescript
async delegate(domain: string, operation: string, params: Record<string, any>): Promise<any> {
  const { context, goals, ...operationParams } = params;

  // REQUIRED validation
  if (!context || typeof context !== 'string' || context.trim().length === 0) {
    throw new Error('Missing required parameter: context');
  }
  if (!goals || typeof goals !== 'string' || goals.trim().length === 0) {
    throw new Error('Missing required parameter: goals');
  }

  // ... continue with operationParams only
}
```

**Activity Logging:**
```typescript
await this.activityService.logActivity(
  domain,
  operation,
  operationParams,  // WITHOUT context/goals
  result,
  true,
  undefined,
  { context, goals }  // Logged separately in metadata
);
```

---

### 6.2 Purpose of Context and Goals

**Context Parameter:**
- Provides LLM with situational awareness
- Helps understand broader workflow
- Improves error messages and suggestions
- NOT used in tool execution logic

**Goals Parameter:**
- Captures user intent
- Helps with activity history analysis
- Enables workflow optimization
- NOT used in tool execution logic

**Design Pattern:**
- **Metadata, not business logic**
- Stripped before tool execution
- Logged for analysis
- Never validated against tool schemas

---

### 6.3 Meta-Tool Implementation Strategy

**For useTools:**
```typescript
{
  context: 'Required: Contextual information',
  goals: 'Required: Specific goals',
  domain: 'Required: Domain name',
  operation: 'Required: Operation name',
  parameters: {
    // Operation-specific params
  }
}
```

**For getTools:**
- No context/goals required (discovery only)
- Could optionally accept for logging purposes

---

## 7. Dynamic Schema Enrichment

### 7.1 Context Providers

**DealPipelineContextProvider:**
- Fetches all pipelines and stages at startup
- Enriches `dealstage` parameter with valid values
- Provides descriptions like "Appointment Scheduled (Default Pipeline)"

**PropertyGroupContextProvider (Implicit):**
- Fetches property groups for common object types at startup
- Caches in server instance
- Used to create dynamic `groupName` enum

**BlogContextProvider (Implicit):**
- Fetches available blogs at startup
- Enriches `contentGroupId` parameter
- Caches blog ID → name mappings

---

### 7.2 Migration Strategy for Meta-Tools

**Challenge:** Dynamic context currently embedded in factory schemas

**Solution Options:**

**Option A: Move to getTools Response**
- getTools includes enriched schemas with context
- Fetches context dynamically on each getTools call
- Higher latency but always current

**Option B: Lazy Context Loading**
- getTools returns base schemas
- Context providers enrich on first useTools call
- Cache for subsequent calls

**Option C: Separate Context Tools**
- New tools: `getContextForOperation`, `getDealStages`, etc.
- LLMs call separately when needed
- More granular control

**Recommendation:** Option A - Include in getTools response for simplicity

---

## 8. Migration Complexity Analysis

### 8.1 Refactor Scope

**Files to Modify:** 4 core files
**Files to Create:** 2 new meta-tool files
**Files Unchanged:** 70+ BCP tool files
**Tests to Update:** ~15 test files

**Total Effort Estimate:** 3-5 days

---

### 8.2 Risk Assessment

**High Risk:**
- Schema generation from actual tool inputSchemas (complex logic)
- Context provider integration with new architecture
- Backward compatibility if keeping old tools temporarily

**Medium Risk:**
- Operation name mapping consistency
- Error message quality degradation
- Parameter validation completeness

**Low Risk:**
- BCP tool execution (unchanged)
- Delegator core logic (mostly unchanged)
- Database/logging integration

---

### 8.3 Rollout Strategy

**Phase 1: Parallel Implementation**
- Keep existing 12 domain tools
- Add 2 new meta-tools
- Test both in production

**Phase 2: Migration**
- Update documentation to prefer meta-tools
- Monitor usage patterns
- Gather feedback

**Phase 3: Deprecation**
- Mark domain tools as deprecated
- Provide migration guide
- Set sunset date

**Phase 4: Cleanup**
- Remove old domain tools
- Simplify factory
- Final documentation update

---

## 9. Recommendations for Architecture Phase

### 9.1 Key Decisions Needed

1. **Schema Discovery Method:**
   - Parse actual tool inputSchemas at runtime? (RECOMMENDED)
   - OR maintain separate registry of schemas?

2. **Context Provider Integration:**
   - Include enriched schemas in getTools response? (RECOMMENDED)
   - OR separate context discovery tools?

3. **Operation Naming:**
   - Preserve current operation names from DOMAIN_CONFIGS? (RECOMMENDED)
   - OR use actual tool names from BCP files?

4. **Backward Compatibility:**
   - Keep old domain tools during transition? (RECOMMENDED)
   - OR hard cutover to meta-tools?

---

### 9.2 Implementation Priorities

**Priority 1 (Critical):**
- Design getTools schema discovery algorithm
- Design useTools parameter structure
- Preserve context/goals handling pattern

**Priority 2 (Important):**
- Context provider integration strategy
- Error handling and validation approach
- Activity logging compatibility

**Priority 3 (Nice to Have):**
- Schema caching optimization
- Enhanced documentation generation
- Migration tooling for existing integrations

---

## 10. Appendices

### Appendix A: Complete Operation Count by Domain

| Domain | Operations | Tool Files | Notes |
|--------|-----------|------------|-------|
| Companies | 5 | 5 | CRUD + search + recent |
| Contacts | 5 | 5 | CRUD + search + recent + associations |
| Notes | 8 | 8 | Intent-based creates + lists |
| Associations | 8 | 8 | Single + batch + types |
| Deals | 5 | 5 | CRUD + search + recent |
| Products | 3 | 3 | Read-only |
| Properties | 8 | 8 | Properties + groups (list disabled) |
| Emails | 5 | 5 | CRUD + list + recent |
| BlogPosts | 5 | 5 | CRUD + list + recent |
| Quotes | 9 | 9 | CRUD + search + line items |
| ActivityHistory | 2 | 2 | Database queries |
| Lists | 9 | 9 | CRUD + filters + membership |
| **TOTAL** | **72** | **72** | |

---

### Appendix B: Common Parameter Patterns

**Identity Parameters:**
- `id` - Generic object ID (most domains)
- `propertyName` - Property identifier (Properties domain)
- `listId` - List identifier (Lists domain)
- `noteId` - Note identifier (Notes domain)
- `quoteId` - Quote identifier (Quotes domain)
- `lineItemId` - Line item identifier (Quotes domain)

**Pagination Parameters:**
- `limit` - Result count (max varies by domain)
- `after` - Pagination cursor (string or number)
- `offset` - Numeric offset (Lists domain)

**Search Parameters:**
- `searchType` - Type of search (enum, domain-specific)
- `searchTerm` - Search query string
- `query` - Generic search string

**Association Parameters:**
- `fromObjectType` / `toObjectType` - Object type identifiers
- `fromObjectId` / `toObjectId` - Object IDs
- `associationTypes` - Array of association type definitions

**Metadata Parameters:**
- `context` - Required by delegator only
- `goals` - Required by delegator only
- `metadata` - Custom properties object (domain-specific)
- `additionalProperties` - Extra properties (domain-specific)

---

### Appendix C: Validation Error Examples

**Context Missing:**
```
Error: Missing required parameter: context (must be non-empty string)
```

**Goals Missing:**
```
Error: Missing required parameter: goals (must be non-empty string)
```

**Tool-Specific Validation:**
```
Error: Parameter validation failed for createProperty:
Missing required parameter: objectType
Parameter name must be a string
```

**BcpError from Tool:**
```
BcpError: Failed to create contact note: Property hs_custom_field doesn't exist
```

---

### Appendix D: File Path Reference

**Core Architecture:**
- `/mnt/f/Code/hubspot-mcp/src/core/tool-registration-factory.ts`
- `/mnt/f/Code/hubspot-mcp/src/core/bcp-tool-delegator.ts`
- `/mnt/f/Code/hubspot-mcp/src/core/types.ts`
- `/mnt/f/Code/hubspot-mcp/src/http-server-sdk.ts`

**Context System:**
- `/mnt/f/Code/hubspot-mcp/src/core/context/index.ts`
- `/mnt/f/Code/hubspot-mcp/src/core/context/providers/deal-pipeline-context-provider.ts`

**BCP Domains:**
- `/mnt/f/Code/hubspot-mcp/src/bcps/Companies/`
- `/mnt/f/Code/hubspot-mcp/src/bcps/Contacts/`
- `/mnt/f/Code/hubspot-mcp/src/bcps/Notes/`
- `/mnt/f/Code/hubspot-mcp/src/bcps/Associations/`
- `/mnt/f/Code/hubspot-mcp/src/bcps/Deals/`
- `/mnt/f/Code/hubspot-mcp/src/bcps/Products/`
- `/mnt/f/Code/hubspot-mcp/src/bcps/Properties/`
- `/mnt/f/Code/hubspot-mcp/src/bcps/Emails/`
- `/mnt/f/Code/hubspot-mcp/src/bcps/BlogPosts/`
- `/mnt/f/Code/hubspot-mcp/src/bcps/Quotes/`
- `/mnt/f/Code/hubspot-mcp/src/bcps/ActivityHistory/`
- `/mnt/f/Code/hubspot-mcp/src/bcps/Lists/`

---

## Conclusion

This document provides a complete analysis of the current HubSpot MCP tool registration architecture. The system currently uses 12 domain-specific tools managing 72 operations across 72 BCP tool files. The refactor to a 2-tool meta-architecture (getTools + useTools) will require significant changes to the registration factory and moderate changes to the delegator, while preserving all existing BCP tool implementations.

**Key Takeaway:** The refactor is architecturally feasible with controlled risk, as the business logic in BCP tools remains completely unchanged. The primary challenges are schema discovery from actual tool inputSchemas and preserving the context provider enrichment system.

---

**Next Phase:** Architecture design for meta-tools implementation.
