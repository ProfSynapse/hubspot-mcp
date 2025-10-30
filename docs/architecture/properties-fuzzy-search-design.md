# Properties Fuzzy Search Architecture Design

**Project:** HubSpot MCP - Properties Domain Enhancement
**Design Date:** October 30, 2025
**Design Phase:** Architect
**Status:** Implementation-Ready

---

## Executive Summary

This document specifies the architecture for a fuzzy search solution for HubSpot properties that solves the context window problem by performing intelligent filtering on the backend before returning results to the LLM.

### Problem Statement

The current `listProperties` tool returns ALL properties for a given object type (200-500+ properties), consuming significant LLM context window space. Users often need to find specific properties but must wade through hundreds of results.

### Solution Overview

Implement a new `searchProperties` tool that:
1. Fetches all properties from HubSpot API (unavoidable - API doesn't support search)
2. Performs intelligent fuzzy matching using `fuse.js` library
3. Ranks results by relevance
4. Returns only top N matches (default 15) to minimize context usage
5. Implements smart caching to avoid repeated API calls

### Key Design Decisions

| Decision | Chosen Approach | Rationale |
|----------|----------------|-----------|
| **Fuzzy Algorithm** | `fuse.js` library | Battle-tested, handles typos, sophisticated scoring, simple API |
| **Caching Strategy** | In-memory per-objectType cache with 10-minute TTL | Properties rarely change, significant performance benefit |
| **Default Limit** | 15 results | Balances discoverability with context efficiency |
| **Search Fields** | name, label, description, groupName | Covers all user-facing property metadata |
| **Response Format** | Simple ranked list | No scoring metadata - LLM only needs results |

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Design](#component-design)
3. [API Design](#api-design)
4. [Fuzzy Search Algorithm](#fuzzy-search-algorithm)
5. [Caching Design](#caching-design)
6. [Integration Points](#integration-points)
7. [Implementation Plan](#implementation-plan)
8. [Alternative Approaches](#alternative-approaches)
9. [Testing Strategy](#testing-strategy)
10. [Performance Characteristics](#performance-characteristics)

---

## Architecture Overview

### System Context Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         LLM Context                          │
│                                                              │
│  User Query: "Find email properties"                        │
│  Tool: searchProperties(objectType: 'contacts',             │
│                         query: 'email', limit: 15)          │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    Properties BCP Tool Layer                 │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  properties.search.ts                              │    │
│  │  - Validates input parameters                      │    │
│  │  - Calls service layer                             │    │
│  │  - Enhances response with suggestions              │    │
│  └─────────────────────┬──────────────────────────────┘    │
└────────────────────────┼─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                 Properties Service Layer                     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  PropertiesService.searchProperties()              │    │
│  │  1. Check cache for full property list             │    │
│  │  2. Fetch from API if cache miss                   │    │
│  │  3. Apply fuse.js fuzzy search                     │    │
│  │  4. Return top N matches                           │    │
│  └─────────────────────┬──────────────────────────────┘    │
│                        │                                     │
│  ┌─────────────────────┴──────────────────────────────┐    │
│  │  In-Memory Property Cache                          │    │
│  │  - Key: objectType                                 │    │
│  │  - Value: { properties[], timestamp, ttl }         │    │
│  │  - TTL: 10 minutes                                 │    │
│  └─────────────────────┬──────────────────────────────┘    │
└────────────────────────┼─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                  HubSpot API v3                              │
│                                                              │
│  GET /crm/v3/properties/{objectType}                        │
│  - Returns ALL properties (no filtering)                    │
│  - 200-500+ properties per object type                      │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
┌─────────┐
│  START  │
└────┬────┘
     │
     ▼
┌─────────────────────────────────────┐
│ Validate Input Parameters           │
│ - objectType (required)              │
│ - query (required)                   │
│ - limit (optional, default 15)       │
│ - includeArchived (optional, false)  │
└────┬────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ Check Cache                          │
│ Key: `${objectType}:${archived}`     │
└────┬────────────────┬────────────────┘
     │ Cache Hit      │ Cache Miss
     │                │
     │                ▼
     │           ┌─────────────────────────────┐
     │           │ Fetch from HubSpot API      │
     │           │ GET /crm/v3/properties/...  │
     │           └────┬────────────────────────┘
     │                │
     │                ▼
     │           ┌─────────────────────────────┐
     │           │ Store in Cache              │
     │           │ TTL: 10 minutes             │
     │           └────┬────────────────────────┘
     │                │
     └────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ Apply Fuse.js Search                │
│ - Search across configured fields   │
│ - Auto-rank by relevance            │
│ - Take top N (limit)                │
└────┬────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ Format Response                     │
│ - Add match metadata                │
│ - Include suggestions               │
└────┬────────────────────────────────┘
     │
     ▼
┌─────────┐
│  RETURN │
└─────────┘
```

---

## Component Design

### 1. Tool Layer: `properties.search.ts`

**Responsibility**: Define the MCP tool interface and handle input validation.

```typescript
/**
 * Search Properties Tool
 *
 * Performs fuzzy search on property schemas to find relevant properties
 * without overwhelming the LLM context window.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { PropertiesService } from './properties.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    objectType: {
      type: 'string',
      description: 'The HubSpot object type (contacts, companies, deals, tickets, etc.)'
    },
    query: {
      type: 'string',
      description: 'Search query to match against property name, label, description, or group. Examples: "email", "phone", "custom", "deal amount"',
      minLength: 1
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return (default: 15, max: 50)',
      minimum: 1,
      maximum: 50,
      default: 15
    },
    includeArchived: {
      type: 'boolean',
      description: 'Include archived properties in search (default: false)',
      default: false
    },
    groupName: {
      type: 'string',
      description: 'Optional: Filter results to a specific property group',
      optional: true
    }
  },
  required: ['objectType', 'query'],
  examples: [
    {
      objectType: 'contacts',
      query: 'email',
      description: 'Find all email-related properties for contacts'
    },
    {
      objectType: 'deals',
      query: 'amount',
      limit: 10,
      description: 'Find deal amount properties, return top 10'
    },
    {
      objectType: 'companies',
      query: 'industry',
      groupName: 'companyinformation',
      description: 'Find industry properties in company information group'
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'searchProperties',
  description: 'Search for property schemas using fuzzy matching. Returns only the most relevant properties to minimize context usage. Use this instead of listProperties when looking for specific properties.',
  inputSchema,
  handler: async (params) => {
    const tempConfig: ServiceConfig = {
      hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN || '',
    };

    if (!tempConfig.hubspotAccessToken) {
      throw new BcpError('HubSpot access token is missing', 'AUTH_ERROR', 401);
    }

    const service = new PropertiesService(tempConfig);
    await service.init();

    try {
      const results = await service.searchProperties({
        objectType: params.objectType,
        query: params.query,
        limit: params.limit || 15,
        includeArchived: params.includeArchived || false,
        groupName: params.groupName
      });

      const response = {
        message: `Found ${results.length} properties matching "${params.query}" for ${params.objectType}`,
        results: results
      };

      return enhanceResponse(response, 'search', params, 'Properties');
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      throw new BcpError(
        `Failed to search properties for ${params.objectType}: ${error instanceof Error ? error.message : String(error)}`,
        'API_ERROR',
        500
      );
    }
  }
};
```

### 2. Service Layer: `PropertiesService` Extensions

**Responsibility**: Implement caching, fuzzy matching, and result ranking.

```typescript
// Add to PropertiesService class in properties.service.ts

/**
 * In-memory cache for properties
 * Key format: `${objectType}:${includeArchived}`
 */
private propertyCache: Map<string, {
  properties: PropertyResponse[];
  timestamp: number;
  ttl: number;
}> = new Map();

/**
 * Default cache TTL: 10 minutes
 */
private readonly CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Search properties with fuzzy matching using fuse.js
 */
async searchProperties(options: {
  objectType: string;
  query: string;
  limit?: number;
  includeArchived?: boolean;
  groupName?: string;
}): Promise<PropertyResponse[]> {
  this.checkInitialized();
  this.validateRequired({ objectType: options.objectType, query: options.query }, ['objectType', 'query']);

  // Get all properties (from cache or API)
  const allProperties = await this.getCachedProperties(
    options.objectType,
    options.includeArchived || false
  );

  // Apply optional group filter
  let propertiesToSearch = allProperties;
  if (options.groupName) {
    propertiesToSearch = allProperties.filter(p => p.groupName === options.groupName);
  }

  // Configure fuse.js for fuzzy search
  const fuse = new Fuse(propertiesToSearch, {
    keys: [
      { name: 'name', weight: 0.4 },
      { name: 'label', weight: 0.3 },
      { name: 'description', weight: 0.2 },
      { name: 'groupName', weight: 0.1 }
    ],
    threshold: 0.4,  // 0 = exact match, 1 = match anything
    includeScore: false
  });

  // Search and limit results
  const limit = Math.min(options.limit || 15, 50);
  const results = fuse.search(options.query).slice(0, limit);

  // Return just the property objects (fuse returns { item: property })
  return results.map(result => result.item);
}

/**
 * Get properties from cache or API
 */
private async getCachedProperties(
  objectType: string,
  includeArchived: boolean
): Promise<PropertyResponse[]> {
  const cacheKey = `${objectType}:${includeArchived}`;
  const cached = this.propertyCache.get(cacheKey);

  // Check if cache is valid
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.properties;
  }

  // Fetch from API
  const properties = await this.getPropertiesFromAPI(objectType, includeArchived);

  // Store in cache
  this.propertyCache.set(cacheKey, {
    properties,
    timestamp: Date.now(),
    ttl: this.CACHE_TTL_MS
  });

  return properties;
}

/**
 * Fetch properties from HubSpot API (with archived parameter)
 */
private async getPropertiesFromAPI(
  objectType: string,
  includeArchived: boolean
): Promise<PropertyResponse[]> {
  const queryParams = includeArchived ? '?archived=true' : '';
  const path = `/crm/v3/properties/${objectType}${queryParams}`;

  try {
    const response = await this.client.apiRequest({
      method: 'GET',
      path
    });

    const data = await response.json();
    return (data.results || []).map((property: any) => this.transformPropertyResponse(property));
  } catch (error) {
    throw this.handleApiError(error, `Failed to get properties for ${objectType}`);
  }
}

/**
 * Clear property cache (useful for testing or manual invalidation)
 */
clearPropertyCache(objectType?: string): void {
  if (objectType) {
    // Clear specific object type
    const keysToDelete = Array.from(this.propertyCache.keys())
      .filter(key => key.startsWith(`${objectType}:`));
    keysToDelete.forEach(key => this.propertyCache.delete(key));
  } else {
    // Clear all
    this.propertyCache.clear();
  }
}
```

### 3. Type Definitions and Dependencies

Add `fuse.js` to package.json:

```bash
npm install fuse.js
```

Add import to `properties.service.ts`:

```typescript
import Fuse from 'fuse.js';
```

No additional type definitions needed - the service now returns `PropertyResponse[]` directly.

---

## API Design

### Tool Schema: `searchProperties`

**Tool Name**: `searchProperties`

**Description**: Search for property schemas using fuzzy matching. Returns only the most relevant properties to minimize context usage.

**Input Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `objectType` | string | Yes | - | HubSpot object type (contacts, companies, deals, etc.) |
| `query` | string | Yes | - | Search query (min 1 character) |
| `limit` | integer | No | 15 | Max results to return (1-50) |
| `includeArchived` | boolean | No | false | Include archived properties |
| `groupName` | string | No | - | Filter to specific property group |

**Response Format**:

```typescript
{
  message: string;                    // Summary message
  results: PropertyResponse[];        // Matched properties (ranked by relevance)
  suggestions?: string[];             // Contextual suggestions
}
```

**Example Request**:

```json
{
  "objectType": "contacts",
  "query": "email",
  "limit": 10
}
```

**Example Response**:

```json
{
  "message": "Found 5 properties matching \"email\" for contacts",
  "results": [
    {
      "name": "email",
      "label": "Email",
      "description": "Contact's email address",
      "groupName": "contactinformation",
      "type": "string",
      "fieldType": "text",
      "formField": true,
      "displayOrder": 1,
      "hidden": false,
      "hasUniqueValue": true,
      "createdAt": "2023-01-15T10:30:00Z",
      "updatedAt": "2023-06-20T14:45:00Z"
    },
    {
      "name": "hs_email_domain",
      "label": "Email Domain",
      "description": "The domain of the contact's email address",
      "groupName": "contactinformation",
      "type": "string",
      "fieldType": "text",
      "formField": false,
      "displayOrder": 50,
      "hidden": false,
      "hasUniqueValue": false,
      "createdAt": "2023-01-15T10:30:00Z",
      "updatedAt": "2023-06-20T14:45:00Z"
    }
  ],
  "suggestions": [
    "💡 To get full details of a specific property: {operation: 'get', objectType: 'contacts', propertyName: 'email'}",
    "🔄 Use listPropertyGroups to see all available property groups",
    "📝 Properties define the schema - use Contacts domain to work with actual contact data"
  ]
}
```

### Service Method Signatures

```typescript
// In PropertiesService class

/**
 * Search properties with fuzzy matching using fuse.js
 * @param options - Search options
 * @returns Ranked array of matching properties
 */
async searchProperties(options: {
  objectType: string;
  query: string;
  limit?: number;
  includeArchived?: boolean;
  groupName?: string;
}): Promise<PropertyResponse[]>

/**
 * Get cached properties or fetch from API
 * @param objectType - HubSpot object type
 * @param includeArchived - Include archived properties
 * @returns Array of properties
 */
private async getCachedProperties(objectType: string, includeArchived: boolean): Promise<PropertyResponse[]>

/**
 * Fetch properties from HubSpot API
 * @param objectType - HubSpot object type
 * @param includeArchived - Include archived properties
 * @returns Array of properties
 */
private async getPropertiesFromAPI(objectType: string, includeArchived: boolean): Promise<PropertyResponse[]>

/**
 * Clear cache for testing/invalidation
 * @param objectType - Optional: clear specific object type only
 */
clearPropertyCache(objectType?: string): void
```

---

## Fuzzy Search Algorithm

### Algorithm Overview

The fuzzy search uses **`fuse.js`**, a battle-tested fuzzy search library. This approach provides:
- **Fast performance**: Optimized search algorithm
- **Typo tolerance**: Handles misspellings like "emal" → "email"
- **Sophisticated scoring**: Industry-standard relevance ranking
- **Simple implementation**: 10 lines of code vs 100+
- **Well-maintained**: 28k+ GitHub stars, actively maintained

### Fuse.js Configuration

The search is configured to prioritize matches across multiple fields with weighted importance:

```typescript
import Fuse from 'fuse.js';

const fuse = new Fuse(properties, {
  keys: [
    { name: 'name', weight: 0.4 },         // 40% - property name (most important)
    { name: 'label', weight: 0.3 },        // 30% - display label
    { name: 'description', weight: 0.2 },  // 20% - description text
    { name: 'groupName', weight: 0.1 }     // 10% - group name (least important)
  ],
  threshold: 0.4,  // 0 = exact match required, 1 = match anything
  includeScore: false  // Don't expose scores to LLM
});

const results = fuse.search(query).slice(0, limit);
```

### Configuration Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **threshold** | 0.4 | Balance between precision (0.0) and recall (1.0) |
| **name weight** | 0.4 | Property name is most important for matching |
| **label weight** | 0.3 | Display label is second priority |
| **description weight** | 0.2 | Description provides context but less important |
| **groupName weight** | 0.1 | Group is helpful but least critical |
| **includeScore** | false | LLM doesn't need internal scores |

### Example Search Results

#### Example 1: Exact Match

**Query**: `"email"`

**Top Results:**
1. `email` - Exact name match
2. `hs_email_domain` - Partial name match
3. `hs_email_optout` - Partial name match
4. `hs_email_bounce` - Partial name match

#### Example 2: Typo Handling

**Query**: `"emal"` (typo)

**Top Results:**
1. `email` - Fuzzy match (1 character difference)
2. `hs_email_domain` - Fuzzy match
3. `hs_email_optout` - Fuzzy match

Fuse.js automatically handles common typos and misspellings.

#### Example 3: Multi-word Query

**Query**: `"deal amount"`

**Top Results:**
1. `amount` - Both tokens match (name + label)
2. `deal_amount` - Exact multi-word match
3. `hs_deal_amount_calculated` - Both tokens in name

#### Example 4: No Match

**Query**: `"xyz123"`

**Result**: Empty array `[]` - no properties match the query.

### Performance Characteristics

| Property Count | Search Time | Memory Usage |
|----------------|-------------|--------------|
| 100 properties | ~5ms | ~10KB (fuse.js overhead) |
| 250 properties | ~10ms | ~15KB |
| 500 properties | ~15ms | ~20KB |
| 1000 properties | ~25ms | ~30KB |

**Notes**:
- Fuse.js is highly optimized with internal indexing
- Performance scales well even with large property sets
- Memory overhead is minimal (library + search index)
- Cache benefit still provides 10-40x speedup for subsequent searches

---

## Caching Design

### Cache Structure

**Implementation**: In-memory Map within `PropertiesService` instance

```typescript
private propertyCache: Map<string, {
  properties: PropertyResponse[];  // Full property list
  timestamp: number;               // Cache creation time (ms)
  ttl: number;                     // Time-to-live in ms
}> = new Map();
```

### Cache Key Strategy

**Format**: `${objectType}:${includeArchived}`

**Examples**:
- `"contacts:false"` - Active contact properties
- `"contacts:true"` - Archived contact properties
- `"companies:false"` - Active company properties
- `"deals:true"` - Archived deal properties

**Rationale**: Separate cache entries for archived vs. active because they return different result sets.

### Cache Lifecycle

#### 1. Cache Population (Cold Start)

```
┌─────────────────┐
│ Search Request  │
└────────┬────────┘
         │
         ▼
    ┌─────────┐
    │ Cache?  │──── No ────┐
    └────┬────┘            │
         │ Yes             ▼
         │          ┌──────────────┐
         │          │ Fetch from   │
         │          │ HubSpot API  │
         │          └──────┬───────┘
         │                 │
         │                 ▼
         │          ┌──────────────┐
         │          │ Store in     │
         │          │ Cache        │
         │          │ TTL: 10 min  │
         │          └──────┬───────┘
         │                 │
         └─────────────────┘
         │
         ▼
    ┌─────────┐
    │ Search  │
    └─────────┘
```

#### 2. Cache Hit (Warm)

```
┌─────────────────┐
│ Search Request  │
└────────┬────────┘
         │
         ▼
    ┌─────────┐
    │ Cache?  │──── Yes ────┐
    └─────────┘             │
                            ▼
                     ┌─────────────┐
                     │ Age < TTL?  │
                     └──────┬──────┘
                            │ Yes
                            ▼
                     ┌─────────────┐
                     │ Use cached  │
                     │ properties  │
                     └──────┬──────┘
                            │
                            ▼
                     ┌─────────────┐
                     │ Search      │
                     │ (fast!)     │
                     └─────────────┘
```

#### 3. Cache Expiration

```
┌─────────────────┐
│ Search Request  │
└────────┬────────┘
         │
         ▼
    ┌─────────┐
    │ Cache?  │──── Yes ────┐
    └─────────┘             │
                            ▼
                     ┌─────────────┐
                     │ Age < TTL?  │
                     └──────┬──────┘
                            │ No (expired)
                            ▼
                     ┌─────────────┐
                     │ Fetch fresh │
                     │ from API    │
                     └──────┬──────┘
                            │
                            ▼
                     ┌─────────────┐
                     │ Update      │
                     │ cache entry │
                     └──────┬──────┘
                            │
                            ▼
                     ┌─────────────┐
                     │ Search      │
                     └─────────────┘
```

### TTL (Time-To-Live) Strategy

**Default TTL**: **10 minutes** (600,000 ms)

**Rationale**:
- Properties are **metadata** that rarely changes
- Users typically add/modify properties infrequently (weekly/monthly)
- 10 minutes provides excellent cache hit rate while ensuring freshness
- Balances between:
  - **Too short (1-2 min)**: Wastes API calls, defeats caching purpose
  - **Too long (1+ hour)**: Stale data risk, user frustration if they modify properties

**Cache Hit Rate Estimates**:
- **First search**: 0% (cold start)
- **Within 10 minutes**: ~95% (warm cache)
- **After 10 minutes**: 0% (expired, refetch)
- **Average over 1 hour**: ~83% cache hit rate (10 min cache / 12 min avg interval)

### Memory Impact

**Per Object Type Cache**:
- **250 properties** × **2KB per property** = **500KB per objectType**
- **Average account** (contacts, companies, deals, tickets) = **2MB total**
- **Large account** (10+ object types) = **5MB total**

**Conclusion**: Memory impact is negligible for modern servers.

### Cache Invalidation

#### Automatic Invalidation
- **TTL expiration**: After 10 minutes
- **No proactive invalidation**: We don't invalidate on create/update/delete operations
  - **Why**: Property changes are rare, complexity not justified
  - **Acceptable risk**: 10-minute window of staleness is acceptable

#### Manual Invalidation
Provide method for testing and edge cases:

```typescript
/**
 * Clear property cache manually
 * @param objectType - Optional: clear specific object type only
 */
clearPropertyCache(objectType?: string): void {
  if (objectType) {
    // Clear specific object type (both archived variants)
    this.propertyCache.delete(`${objectType}:false`);
    this.propertyCache.delete(`${objectType}:true`);
  } else {
    // Clear entire cache
    this.propertyCache.clear();
  }
}
```

**Use Cases**:
- Unit tests need clean state
- User reports stale data
- After bulk property operations

### Cache Metrics

Response includes cache diagnostics:

```typescript
{
  "metadata": {
    "cacheHit": true,           // Was cache used?
    "executionTimeMs": 12,      // Total execution time
    // ...
  }
}
```

**Cache Performance**:
- **Cache Hit**: 5-20ms execution time
- **Cache Miss**: 200-500ms execution time (API call + search)
- **Speedup**: **10-40x faster** with warm cache

---

## Integration Points

### 1. File Structure

```
src/bcps/Properties/
├── index.ts                      # Updated: Export new tool
├── properties.service.ts         # Updated: Add search methods + caching
├── properties.list.ts            # Existing: Keep unchanged
├── properties.get.ts             # Existing: Keep unchanged
├── properties.create.ts          # Existing: Keep unchanged
├── properties.update.ts          # Existing: Keep unchanged
├── properties.search.ts          # NEW: Fuzzy search tool
├── properties.listGroups.ts      # Existing: Keep unchanged
├── properties.getGroup.ts        # Existing: Keep unchanged
├── properties.createGroup.ts     # Existing: Keep unchanged
└── properties.updateGroup.ts     # Existing: Keep unchanged
```

### 2. Update `index.ts` to Export New Tool

```typescript
// src/bcps/Properties/index.ts

import { ToolDefinition } from '../../core/types.js';

import { tool as listTool } from './properties.list.js';
import { tool as getTool } from './properties.get.js';
import { tool as createTool } from './properties.create.js';
import { tool as updateTool } from './properties.update.js';
import { tool as searchTool } from './properties.search.js';  // NEW
import { tool as listGroupsTool } from './properties.listGroups.js';
import { tool as getGroupTool } from './properties.getGroup.js';
import { tool as createGroupTool } from './properties.createGroup.js';
import { tool as updateGroupTool } from './properties.updateGroup.js';

export const propertiesTools: ToolDefinition[] = [
  searchTool,        // NEW - Add first for discoverability
  listTool,
  getTool,
  createTool,
  updateTool,
  listGroupsTool,
  getGroupTool,
  createGroupTool,
  updateGroupTool
];

export const propertiesBCP = {
  name: 'Properties',
  description: 'Tools for managing HubSpot properties and property groups',
  tools: propertiesTools
};

export default propertiesBCP;
```

### 3. Tool Registration

**Location**: `src/core/tool-registration-factory.ts`

No changes required - the BCP auto-registration pattern will pick up the new tool automatically from the `propertiesTools` array.

### 4. Response Enhancement Integration

**Location**: `src/core/suggestion-config.ts`

Add suggestions for the new search operation:

```typescript
// Add to WORKFLOW_SUGGESTIONS
export const WORKFLOW_SUGGESTIONS: Record<string, string[]> = {
  // ... existing suggestions ...

  'search': [
    '💡 Use searchProperties to find specific properties without overwhelming context',
    '🔄 Narrow results with groupName parameter or adjust limit',
    '📝 Use getProperty for full details of a specific property'
  ]
};

// Add to WORKFLOW_PATTERNS
export const WORKFLOW_PATTERNS: Record<string, Record<string, string[]>> = {
  'Properties': {
    // ... existing patterns ...

    'property-search': [
      '🔍 Search workflow: searchProperties → review results → getProperty for details',
      '💡 Tip: Use specific search terms for better matches (e.g., "email" not "e")',
      '📊 Check matchScore to understand relevance'
    ]
  }
};
```

### 5. Backwards Compatibility

**Existing `listProperties` Tool**: Keep unchanged and fully functional

**Design Decision**: Do NOT modify the existing `listProperties` tool. Users may rely on its behavior of returning all properties.

**Migration Path**:
- Users can continue using `listProperties` for "show me everything" use cases
- LLM should prefer `searchProperties` when looking for specific properties
- Documentation should recommend `searchProperties` for focused queries

---

## Implementation Plan

### Phase 1: Service Layer (Backend Logic)

**Files to Modify**: `src/bcps/Properties/properties.service.ts`

**Tasks**:
1. Add cache property to class
   ```typescript
   private propertyCache: Map<string, {...}> = new Map();
   private readonly CACHE_TTL_MS = 10 * 60 * 1000;
   ```

2. Add type definitions
   ```typescript
   export interface PropertySearchResult { ... }
   export interface PropertySearchMatch extends PropertyResponse { ... }
   export interface PropertySearchOptions { ... }
   ```

3. Implement `getCachedProperties()` private method
   - Check cache
   - Fetch from API if miss
   - Store in cache

4. Implement `getPropertiesFromAPI()` private method
   - Handle `archived` parameter
   - Transform response

5. Implement `calculateMatchScore()` private method
   - Weighted scoring algorithm
   - Token-based matching

6. Implement `explainMatch()` private method
   - Generate human-readable match reason

7. Implement `isCacheHit()` private method
   - Check cache validity

8. Implement `clearPropertyCache()` public method
   - For testing and manual invalidation

9. Implement `searchProperties()` public method
   - Orchestrates all private methods
   - Returns formatted results

**Testing**: Unit tests for each method (see Testing Strategy section)

**Estimated Time**: 3-4 hours

---

### Phase 2: Tool Layer (MCP Interface)

**Files to Create**: `src/bcps/Properties/properties.search.ts`

**Tasks**:
1. Define input schema
   - objectType, query, limit, includeArchived, groupName
   - Add examples and descriptions

2. Implement tool handler
   - Initialize service
   - Call `service.searchProperties()`
   - Format response
   - Enhance with suggestions

3. Add error handling
   - BcpError for auth failures
   - Graceful error messages

**Testing**: Integration tests for tool (see Testing Strategy section)

**Estimated Time**: 1-2 hours

---

### Phase 3: Integration

**Files to Modify**:
- `src/bcps/Properties/index.ts` - Export new tool
- `src/core/suggestion-config.ts` - Add suggestions

**Tasks**:
1. Update `index.ts` to export `searchTool`
2. Add workflow suggestions to suggestion-config
3. Update Properties BCP description if needed

**Testing**: End-to-end tests

**Estimated Time**: 30 minutes

---

### Phase 4: Documentation

**Files to Create/Update**:
- This architecture document (already created)
- Update README if needed
- Add inline code comments

**Tasks**:
1. Document usage examples
2. Add JSDoc comments to all methods
3. Update any developer guides

**Estimated Time**: 1 hour

---

### Total Implementation Estimate

**Total Time**: **3-4 hours** (half work day)

**Breakdown**:
- Service Layer: 1-2 hours (fuse.js simplifies implementation)
- Tool Layer: 1 hour
- Integration: 0.5 hours
- Testing: 1 hour

---

### Implementation Order (Step-by-Step)

1. **Step 1**: Install `fuse.js` dependency (`npm install fuse.js`)
2. **Step 2**: Add import to `properties.service.ts`
3. **Step 3**: Implement cache infrastructure (`propertyCache`, `CACHE_TTL_MS`)
4. **Step 4**: Implement `getPropertiesFromAPI()` with archived support
5. **Step 5**: Implement `getCachedProperties()` with cache logic
6. **Step 6**: Implement `clearPropertyCache()` method
7. **Step 7**: Implement main `searchProperties()` method with fuse.js
8. **Step 8**: Create `properties.search.ts` tool
9. **Step 9**: Update `index.ts` to export tool
10. **Step 10**: Add suggestions to `suggestion-config.ts`
11. **Step 11**: Write unit tests
12. **Step 12**: Write integration tests
13. **Step 13**: Manual testing with real HubSpot account
14. **Step 14**: Update documentation

---

## Alternative Approaches

### Alternative 1: Custom Scoring Algorithm (REJECTED)

**Description**: Build a custom weighted substring matching algorithm.

**Pros**:
- No external dependencies
- Full control over scoring logic
- Can customize to exact requirements

**Cons**:
- ❌ Reinventing the wheel - 100+ lines of code vs 10
- ❌ No typo tolerance - "emal" won't match "email"
- ❌ Need to maintain and test custom scoring logic
- ❌ Less sophisticated than battle-tested libraries
- ❌ Time-consuming to implement and debug

**Decision**: **REJECTED** in favor of `fuse.js`

**Why fuse.js is better**:
- 28k+ GitHub stars, industry-standard library
- Handles typos automatically
- Well-tested scoring algorithms
- Simple 10-line implementation
- Only 10KB gzipped
- Saves 2-3 hours of development time

**Example of what we're avoiding**:
```typescript
// Custom algorithm would require ~100 lines of code like this:
private calculateMatchScore(property: PropertyResponse, query: string): number {
  const queryLower = query.toLowerCase().trim();
  const queryTokens = queryLower.split(/\s+/);
  let score = 0;

  // 40+ lines of scoring logic...
  if (property.name.toLowerCase() === queryLower) {
    score += 40;
  } else if (property.name.toLowerCase().includes(queryLower)) {
    score += 25;
  }
  // ... etc

  return Math.min(score, 100);
}

// Plus another 30 lines for explainMatch()
// Plus unit tests for scoring edge cases
// Total: 150+ lines of custom code vs 10 with fuse.js
```

---

### Alternative 2: Elasticsearch/Database Search (REJECTED)

**Description**: Store properties in Elasticsearch or PostgreSQL full-text search.

**Why rejected**:
- ❌ Massive infrastructure overhead for 200-500 properties
- ❌ Over-engineered - in-memory search is already sub-20ms
- ❌ Data synchronization complexity
- ❌ Would add significant complexity for zero benefit

---

### Alternative 3: Regular Expression Matching (REJECTED)

**Description**: Allow users to provide regex patterns for matching.

**Why rejected**:
- ❌ Steep learning curve - most users don't know regex
- ❌ Security risk - ReDoS attacks from malicious patterns
- ❌ No relevance scoring - all matches equal
- ❌ LLMs struggle with complex regex syntax

---

### Chosen Approach Summary

**Using `fuse.js` Library**

**Why This Approach**:
1. ✅ **Battle-tested**: 28k+ GitHub stars, industry standard
2. ✅ **Typo tolerant**: Handles "emal" → "email" automatically
3. ✅ **Simple**: 10 lines of code vs 150+
4. ✅ **Fast**: Optimized algorithms, <20ms for 500 properties
5. ✅ **Maintainable**: No custom scoring logic to debug
6. ✅ **Small footprint**: Only 10KB gzipped

**What We're NOT Doing**:
- ❌ Custom scoring algorithms (reinventing the wheel)
- ❌ Elasticsearch (over-engineered for small dataset)
- ❌ Regular expressions (security risk + UX problem)
- ❌ Complex field filtering (unnecessary complexity)

---

## Testing Strategy

### Unit Tests

**File**: `src/bcps/Properties/__tests__/properties.service.test.ts`

#### Test Suite 1: Cache Functionality

```typescript
describe('PropertiesService - Caching', () => {
  let service: PropertiesService;

  beforeEach(() => {
    service = new PropertiesService(mockConfig);
    service.init();
  });

  afterEach(() => {
    service.clearPropertyCache();
  });

  it('should cache properties after first fetch', async () => {
    const result1 = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    expect(result1).toHaveLength(10); // Returns results
    expect(result1[0]).toHaveProperty('name'); // Valid property structure

    // Second call should use cache (verify via spy or timing)
    const result2 = await service.searchProperties({
      objectType: 'contacts',
      query: 'phone',
      limit: 10
    });

    expect(result2).toHaveLength(10);
  });

  it('should expire cache after TTL', async () => {
    // First call
    await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    // Fast-forward time by 11 minutes
    jest.advanceTimersByTime(11 * 60 * 1000);

    // Second call should refetch (verify via API call spy)
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    expect(result).toBeDefined();
  });

  it('should clear cache manually', async () => {
    await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    service.clearPropertyCache('contacts');

    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    expect(result).toBeDefined();
  });

  it('should maintain separate cache for archived properties', async () => {
    const activeResult = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      includeArchived: false
    });

    const archivedResult = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      includeArchived: true
    });

    expect(activeResult).toBeDefined();
    expect(archivedResult).toBeDefined();

    // Both should now be cached (verify via spy)
    const activeResult2 = await service.searchProperties({
      objectType: 'contacts',
      query: 'phone',
      includeArchived: false
    });

    expect(activeResult2).toBeDefined();
  });
});
```

#### Test Suite 2: Search Functionality (Fuse.js)

```typescript
describe('PropertiesService - Search', () => {
  let service: PropertiesService;

  beforeEach(() => {
    service = new PropertiesService(mockConfig);
    service.init();
  });

  it('should return top N results', async () => {
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 5
    });

    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('should return valid property objects', async () => {
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    result.forEach(property => {
      expect(property).toHaveProperty('name');
      expect(property).toHaveProperty('label');
      expect(property).toHaveProperty('type');
    });
  });

  it('should filter by group name', async () => {
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      groupName: 'contactinformation'
    });

    result.forEach(property => {
      expect(property.groupName).toBe('contactinformation');
    });
  });

  it('should handle no matches gracefully', async () => {
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'xyznonexistent',
      limit: 10
    });

    expect(result).toHaveLength(0);
  });

  it('should handle typos with fuse.js', async () => {
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'emal', // Typo
      limit: 10
    });

    // Should still match "email" property
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(p => p.name === 'email')).toBe(true);
  });

  it('should return results ranked by relevance', async () => {
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 20
    });

    // Results are pre-sorted by fuse.js relevance
    expect(result[0].name).toBe('email'); // Exact match should be first
  });
});
```

### Integration Tests

**File**: `src/bcps/Properties/__tests__/properties.search.integration.test.ts`

```typescript
describe('Properties Search Tool - Integration', () => {
  it('should search properties via tool handler', async () => {
    const result = await tool.handler({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('metadata');
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('should enhance response with suggestions', async () => {
    const result = await tool.handler({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    expect(result).toHaveProperty('suggestions');
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('should handle auth errors', async () => {
    delete process.env.HUBSPOT_ACCESS_TOKEN;

    await expect(tool.handler({
      objectType: 'contacts',
      query: 'email'
    })).rejects.toThrow('HubSpot access token is missing');
  });

  it('should validate required parameters', async () => {
    await expect(tool.handler({
      objectType: 'contacts'
      // Missing query parameter
    })).rejects.toThrow();
  });
});
```

### Manual Testing Checklist

```markdown
## Manual Test Cases

### Basic Functionality
- [ ] Search for "email" in contacts returns relevant properties
- [ ] Search for "amount" in deals returns deal amount properties
- [ ] Search for "domain" in companies returns domain-related properties
- [ ] Limit parameter correctly limits results (test with 5, 10, 20)
- [ ] includeArchived parameter returns archived properties

### Scoring Accuracy
- [ ] Exact name matches appear first in results
- [ ] Partial name matches score lower than exact matches
- [ ] Label matches are included in results
- [ ] Description matches are included
- [ ] Multi-word queries work correctly ("deal amount")

### Cache Behavior
- [ ] First search is slower (~200-500ms)
- [ ] Subsequent searches are faster (<20ms)
- [ ] Cache expires after 10 minutes
- [ ] Different object types have separate caches
- [ ] Archived vs. active have separate caches

### Edge Cases
- [ ] Empty query string handled gracefully
- [ ] Query with no matches returns empty results
- [ ] Very long query strings don't cause errors
- [ ] Special characters in query don't break search
- [ ] groupName filter works correctly

### Error Handling
- [ ] Invalid objectType returns helpful error
- [ ] Missing access token returns auth error
- [ ] API errors are caught and returned gracefully
```

### Performance Testing

```typescript
describe('PropertiesService - Performance', () => {
  it('should search 500 properties in under 50ms', async () => {
    const startTime = Date.now();

    await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 20
    });

    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(50);
  });

  it('should benefit from caching', async () => {
    // First call (cache miss)
    const result1 = await service.searchProperties({
      objectType: 'contacts',
      query: 'email'
    });

    // Second call (cache hit)
    const startTime = Date.now();
    await service.searchProperties({
      objectType: 'contacts',
      query: 'phone'
    });
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(20); // Should be very fast
  });
});
```

---

## Performance Characteristics

### Latency Analysis

#### Cold Start (Cache Miss)

| Operation | Time | Notes |
|-----------|------|-------|
| API Request | 200-500ms | Network + HubSpot processing |
| JSON Parsing | 5-10ms | Parsing 200-500 properties |
| Transformation | 5-10ms | Mapping to PropertyResponse[] |
| Cache Storage | <1ms | In-memory write |
| Fuzzy Search | 10-20ms | Scoring + sorting |
| **Total** | **220-541ms** | First search per objectType |

#### Warm Cache (Cache Hit)

| Operation | Time | Notes |
|-----------|------|-------|
| Cache Lookup | <1ms | Map.get() operation |
| Fuzzy Search | 10-20ms | Scoring + sorting |
| **Total** | **10-20ms** | Subsequent searches |

#### Speedup from Caching

**10-40x faster** with warm cache (220-541ms → 10-20ms)

### Scalability

#### Property Count Impact

| Properties | Search Time (Cold) | Search Time (Warm) | Memory Usage |
|------------|-------------------|-------------------|--------------|
| 100 | ~230ms | ~5ms | ~200KB |
| 250 | ~250ms | ~10ms | ~500KB |
| 500 | ~350ms | ~20ms | ~1MB |
| 1000 | ~500ms | ~40ms | ~2MB |

**Conclusion**: Linear scaling, acceptable performance up to 1000+ properties.

### Memory Footprint

#### Per Property

- **Raw JSON**: ~1.5KB
- **Transformed Object**: ~2KB (with typed fields)

#### Per Object Type

- **Small (100 props)**: 200KB
- **Medium (250 props)**: 500KB
- **Large (500 props)**: 1MB

#### Total Application

- **Typical Account** (4 object types): ~2MB
- **Large Account** (10 object types): ~5MB
- **Enterprise** (20 object types): ~10MB

**Conclusion**: Negligible memory impact for modern servers (Node.js default heap: 4GB).

### Cache Hit Rate Analysis

#### Assumptions
- Users search multiple properties in same session
- Property changes are infrequent (weekly/monthly)
- Cache TTL: 10 minutes

#### Estimated Hit Rates

| Scenario | Cache Hit Rate | Explanation |
|----------|---------------|-------------|
| Single search session | ~0% | Only one search, cold start |
| 5 searches in 10 min | ~80% | 4/5 hit cache |
| 10 searches in 10 min | ~90% | 9/10 hit cache |
| Continuous use (1 hr) | ~83% | 10 min cache / 12 min avg |
| Daily usage | ~95% | Properties rarely change |

#### Impact on API Rate Limits

**Without Cache**:
- 10 searches × 10 object types = 100 API calls
- Hits rate limit quickly

**With Cache**:
- 10 searches × 10 object types × 5% miss rate = 5 API calls
- **95% reduction in API calls**

### Comparison: listProperties vs. searchProperties

#### Context Window Usage

| Tool | Properties Returned | Estimated Tokens | Context Efficiency |
|------|---------------------|------------------|-------------------|
| **listProperties** | 250 (all) | ~15,000 tokens | ❌ Inefficient |
| **searchProperties (limit=15)** | 15 (top matches) | ~900 tokens | ✅ Efficient |
| **searchProperties (limit=5)** | 5 (top matches) | ~300 tokens | ✅✅ Very Efficient |

**Savings**: **94% reduction** in context usage (15,000 → 900 tokens)

#### Response Time

| Tool | Cold Start | Warm Cache | Avg (80% hit rate) |
|------|-----------|------------|-------------------|
| **listProperties** | 220-541ms | 220-541ms | 220-541ms |
| **searchProperties** | 230-551ms | 10-20ms | 56-130ms |

**Note**: listProperties doesn't cache currently (returns full list each time).

---

## Risk Assessment & Mitigation

### Risk 1: Cache Staleness

**Risk**: Users modify properties, cache shows outdated data for up to 10 minutes.

**Impact**: Medium - Users may not see newly created properties immediately.

**Likelihood**: Low - Properties are modified infrequently.

**Mitigation**:
1. 10-minute TTL is acceptable for property metadata
2. Provide `clearPropertyCache()` method for manual invalidation
3. Document cache behavior in tool description
4. Consider adding cache invalidation on create/update operations (future enhancement)

**Severity**: LOW

---

### Risk 2: Memory Exhaustion

**Risk**: Caching many object types could exhaust memory.

**Impact**: High - Application crash, service disruption.

**Likelihood**: Very Low - Even 20 object types = 10MB (negligible).

**Mitigation**:
1. Implement cache size monitoring
2. Add max cache entries limit (e.g., 50 object types)
3. Implement LRU eviction if needed
4. Monitor memory usage in production

**Severity**: VERY LOW

---

### Risk 3: Poor Search Results

**Risk**: Scoring algorithm returns irrelevant results.

**Impact**: Medium - Users frustrated, need to refine queries.

**Likelihood**: Low - Weighted scoring is tested and predictable.

**Mitigation**:
1. Extensive unit tests for scoring algorithm
2. Include `matchReason` field to explain results
3. Allow users to adjust `limit` parameter
4. Collect user feedback for algorithm tuning
5. Document search behavior and examples

**Severity**: LOW

---

### Risk 4: API Rate Limiting

**Risk**: Cache misses cause rapid API calls, hitting rate limits.

**Impact**: High - Service disruption, failed searches.

**Likelihood**: Very Low - 10-minute cache provides 95% hit rate.

**Mitigation**:
1. Cache TTL ensures minimal API calls
2. Monitor API usage metrics
3. Implement exponential backoff for rate limit errors
4. Add request queuing if needed

**Severity**: VERY LOW

---

### Risk 5: Search Query Injection

**Risk**: Malicious search queries could cause performance issues or crashes.

**Impact**: Medium - Slow responses, potential DoS.

**Likelihood**: Low - Substring matching is inherently safe.

**Mitigation**:
1. Input validation on query parameter (max length)
2. No regex or eval() in search logic
3. Timeout for search operations
4. Rate limiting at tool layer

**Severity**: LOW

---

### Overall Risk Level: **LOW**

All identified risks have low probability and/or low impact, with clear mitigation strategies.

---

## Appendix

### A. Example Use Cases

#### Use Case 1: Find Email Properties

**User Intent**: "Show me all email-related properties for contacts"

**Tool Call**:
```json
{
  "objectType": "contacts",
  "query": "email",
  "limit": 15
}
```

**Expected Results**:
1. `email` (score: 85) - Exact name match
2. `hs_email_domain` (score: 45) - Contains "email"
3. `hs_email_optout` (score: 40) - Contains "email"
4. `hs_email_bounce` (score: 40) - Contains "email"
5. `hs_email_open` (score: 35) - Contains "email"

---

#### Use Case 2: Find Custom Properties

**User Intent**: "What custom properties exist for deals?"

**Tool Call**:
```json
{
  "objectType": "deals",
  "query": "custom",
  "limit": 20
}
```

**Expected Results**: Properties with "custom" in name, label, or description.

---

#### Use Case 3: Find Properties in Specific Group

**User Intent**: "Show me all properties in the company information group"

**Tool Call**:
```json
{
  "objectType": "companies",
  "query": "information",
  "groupName": "companyinformation",
  "limit": 50
}
```

**Expected Results**: Only properties in `companyinformation` group.

---

### B. Glossary

| Term | Definition |
|------|------------|
| **BCP** | Bounded Context Pack - Organizational pattern for domain tools |
| **Cache Hit** | When requested data is found in cache (fast) |
| **Cache Miss** | When requested data must be fetched from API (slow) |
| **Fuzzy Search** | Search algorithm that finds approximate matches |
| **Match Score** | Numerical value (0-100) indicating relevance |
| **Property** | Metadata defining a field in HubSpot CRM (not the data itself) |
| **Token** | Individual word in a multi-word query |
| **TTL** | Time-To-Live - How long cached data remains valid |
| **Weighted Scoring** | Algorithm that assigns different importance to different match types |

---

### C. References

- [HubSpot Properties API Documentation](https://developers.hubspot.com/docs/api/crm/properties)
- [Properties API Research Document](../preparation/properties-api-filtering-research.md)
- [HubSpot MCP Architecture Summary](./architecture-summary.md)
- [Response Enhancement System](../../src/core/response-enhancer.ts)

---

## Document Metadata

**Version**: 2.0 (Simplified with fuse.js)
**Author**: PACT Architect
**Last Updated**: October 30, 2025
**Status**: Implementation-Ready
**Next Phase**: Code - Backend Implementation
**Key Changes from v1.0**:
- Switched from custom scoring algorithm to `fuse.js` library
- Removed `matchScore` and `matchReason` from response (cleaner LLM context)
- Removed all metadata from response (only returns ranked results)
- Reduced implementation time from 5-8 hours to 3-4 hours
- Added typo tolerance capability

---

**End of Architecture Document**
