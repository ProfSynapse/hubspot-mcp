# HubSpot Properties API - Filtering and Search Capabilities Research

**Research Date:** October 30, 2025
**API Version:** HubSpot CRM v3
**Purpose:** Determine if HubSpot's Properties API supports filtering, searching, or limiting properties when listing them

---

## Executive Summary

HubSpot's Properties API v3 provides **LIMITED filtering capabilities** through query parameters, but **NO native search, pagination, or result limiting** for the list properties endpoint. The API returns ALL properties for a given object type in a single response.

### Key Findings

1. **No Search/Query Functionality**: The API does not support searching properties by name, label, or description
2. **No Pagination**: All properties are returned in a single response with no pagination mechanism
3. **No Limit Parameter**: Cannot limit the number of properties returned
4. **Limited Filtering**: Only two filtering parameters are available:
   - `archived` - Filter archived vs. active properties
   - `dataSensitivity` - Filter by sensitivity level (Enterprise only)
5. **Client-Side Filtering Required**: For any other filtering needs, applications must retrieve all properties and filter locally

---

## API Endpoint Documentation

### GET /crm/v3/properties/{objectType}

Retrieves all properties for a specified HubSpot CRM object type.

**Endpoint Pattern:**
```
GET https://api.hubapi.com/crm/v3/properties/{objectType}
```

**Path Parameters:**
- `objectType` (required): The CRM object type (contacts, companies, deals, tickets, notes, etc.)

**Supported Query Parameters:**

| Parameter | Type | Values | Description | Requirements |
|-----------|------|--------|-------------|--------------|
| `archived` | boolean | `true`, `false` | Include or exclude archived properties | All accounts |
| `dataSensitivity` | string | `sensitive`, `highly_sensitive`, (omit for non-sensitive) | Filter by sensitivity level | Enterprise accounts only |

**NOT Supported:**
- ❌ `search` or `query` - No text search capabilities
- ❌ `limit` or `count` - No result limiting
- ❌ `offset` or pagination - All results returned at once
- ❌ `filter` - No general filtering mechanism
- ❌ `properties` - Cannot request specific property fields only
- ❌ `groupName` - Cannot filter by property group (must filter client-side)

---

## Detailed Parameter Documentation

### 1. The `archived` Parameter

Controls whether to include archived properties in the response.

**Usage:**
```bash
# Get only active (non-archived) properties (default behavior)
GET /crm/v3/properties/contacts

# Get only active properties (explicit)
GET /crm/v3/properties/contacts?archived=false

# Get only archived properties
GET /crm/v3/properties/contacts?archived=true
```

**NodeJS SDK Example:**
```javascript
const hubspotClient = new hubspot.Client({ apiKey: "YOUR_API_KEY" });

// Get active properties
const activeProperties = await hubspotClient.crm.properties.coreApi.getAll(
  "contacts",
  false  // archived = false
);

// Get archived properties
const archivedProperties = await hubspotClient.crm.properties.coreApi.getAll(
  "contacts",
  true   // archived = true
);
```

**Response Indicators:**
- Archived properties include `"archived": true` field
- Archived properties include `"archivedAt": "2023-11-07T05:31:56Z"` timestamp
- Archived properties are permanently deleted after 90 days

**Important Notes:**
- Properties are soft-deleted (archived) when deleted via API
- After 90 days, archived properties are hard-deleted from HubSpot
- Default behavior (omitting parameter) returns only non-archived properties

---

### 2. The `dataSensitivity` Parameter

Filters properties based on their data sensitivity classification. **Available only to Enterprise accounts.**

**Usage:**
```bash
# Get only non-sensitive properties (default)
GET /crm/v3/properties/contacts

# Get only sensitive data properties
GET /crm/v3/properties/contacts?dataSensitivity=sensitive

# Get only highly sensitive data properties
GET /crm/v3/properties/contacts?dataSensitivity=highly_sensitive
```

**Supported Values:**
- **Omitted** (default): Returns only non-sensitive properties
- **`sensitive`**: Returns properties marked as Sensitive Data
- **`highly_sensitive`**: Returns properties marked as Highly Sensitive Data

**NodeJS SDK Example:**
```javascript
// Note: The NodeJS SDK's getAll() method signature is:
// getAll(objectType: string, archived: boolean, options?: RequestOptions)
// To add dataSensitivity, you need to use the underlying API client

const response = await hubspotClient.crm.properties.coreApi.getAll(
  "contacts",
  false,
  {
    qs: { dataSensitivity: "sensitive" }
  }
);
```

**Direct API Request Example:**
```javascript
const response = await fetch(
  'https://api.hubapi.com/crm/v3/properties/contacts?dataSensitivity=sensitive',
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**Response Indicators:**
Properties include a `dataSensitivity` field:
```json
{
  "name": "ssn",
  "label": "Social Security Number",
  "dataSensitivity": "highly_sensitive",
  "sensitiveDataCategories": ["HIPAA"],
  ...
}
```

**Values in Response:**
- `"non_sensitive"` - Standard property
- `"sensitive"` - Sensitive Data property
- `"highly_sensitive"` - Highly Sensitive Data property
- `"sensitiveDataCategories": ["HIPAA"]` - Additional classification for protected health info

**Requirements:**
- **Account Level**: Enterprise subscription required
- **Scopes for Reading**: No special scopes required to retrieve property schemas
- **Scopes for Writing**:
  - `{object}.sensitive.write` - For creating/editing sensitive properties
  - `{object}.highly_sensitive.write` - For creating/editing highly sensitive properties

**Important Notes:**
- By default, only non-sensitive properties are returned
- Sensitive properties must be explicitly requested with the parameter
- This is a security feature to prevent accidental exposure of sensitive data schemas
- Applies to reading property definitions, not property values

---

### 3. Combining Parameters

You can combine both `archived` and `dataSensitivity` parameters:

```bash
# Get archived sensitive properties
GET /crm/v3/properties/contacts?archived=true&dataSensitivity=sensitive

# Get active highly sensitive properties
GET /crm/v3/properties/contacts?archived=false&dataSensitivity=highly_sensitive
```

**Note:** While the API documentation doesn't explicitly show these combined, standard query parameter behavior suggests this should work. Testing recommended.

---

## Response Format

The API returns all properties in a single response with no pagination:

```json
{
  "results": [
    {
      "name": "email",
      "label": "Email",
      "description": "Contact's email address",
      "groupName": "contactinformation",
      "type": "string",
      "fieldType": "text",
      "dataSensitivity": "non_sensitive",
      "archived": false,
      "formField": true,
      "displayOrder": 1,
      "hidden": false,
      "hasUniqueValue": true,
      "createdAt": "2023-01-15T10:30:00Z",
      "updatedAt": "2023-06-20T14:45:00Z"
    },
    {
      "name": "firstname",
      "label": "First Name",
      ...
    }
    // ... hundreds more properties
  ]
}
```

**Response Characteristics:**
- **No `paging` object**: Unlike other HubSpot v3 APIs, properties endpoint returns all results at once
- **No `next.after` token**: Pagination not available
- **All results in single array**: The `results` array contains every property
- **Typical count**: 200-500+ properties for mature HubSpot accounts

---

## Current Implementation Analysis

### Existing Code (properties.service.ts)

```typescript
async getProperties(objectType: string): Promise<PropertyResponse[]> {
  this.checkInitialized();
  this.validateRequired({ objectType }, ['objectType']);

  try {
    const response = await this.client.apiRequest({
      method: 'GET',
      path: `/crm/v3/properties/${objectType}`
      // No query parameters currently supported
    });

    const data = await response.json();
    return (data.results || []).map((property: any) =>
      this.transformPropertyResponse(property)
    );
  } catch (error) {
    throw this.handleApiError(error, `Failed to get properties for ${objectType}`);
  }
}
```

### Current Limitations

1. **No filtering parameters exposed**: The tool doesn't support `archived` or `dataSensitivity` parameters
2. **Returns ALL properties**: Every property is returned, potentially 200-500+ items
3. **Context window concern**: Large property lists can consume significant context space
4. **No client-side filtering**: Results are not filtered or limited before returning

---

## Recommendations

### Immediate Implementation (Phase 1)

Add support for the available query parameters to give users control:

**1. Add `archived` parameter to tool schema:**

```typescript
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    objectType: {
      type: 'string',
      description: 'The HubSpot object type (contacts, companies, deals, etc.)'
    },
    archived: {
      type: 'boolean',
      description: 'Include archived properties (default: false)',
      default: false
    }
  },
  required: ['objectType']
};
```

**2. Add `dataSensitivity` parameter:**

```typescript
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    objectType: { ... },
    archived: { ... },
    dataSensitivity: {
      type: 'string',
      enum: ['non_sensitive', 'sensitive', 'highly_sensitive'],
      description: 'Filter by sensitivity level (Enterprise only)',
      default: 'non_sensitive'
    }
  },
  required: ['objectType']
};
```

**3. Update service method:**

```typescript
async getProperties(
  objectType: string,
  archived: boolean = false,
  dataSensitivity?: 'sensitive' | 'highly_sensitive'
): Promise<PropertyResponse[]> {
  this.checkInitialized();
  this.validateRequired({ objectType }, ['objectType']);

  try {
    // Build query parameters
    const queryParams = new URLSearchParams();

    // Note: archived param may need special handling as it might be
    // passed as path parameter in SDK, not query parameter
    if (archived) {
      queryParams.append('archived', 'true');
    }

    if (dataSensitivity) {
      queryParams.append('dataSensitivity', dataSensitivity);
    }

    const queryString = queryParams.toString();
    const path = `/crm/v3/properties/${objectType}${queryString ? '?' + queryString : ''}`;

    const response = await this.client.apiRequest({
      method: 'GET',
      path
    });

    const data = await response.json();
    return (data.results || []).map((property: any) =>
      this.transformPropertyResponse(property)
    );
  } catch (error) {
    throw this.handleApiError(error, `Failed to get properties for ${objectType}`);
  }
}
```

### Enhanced Implementation (Phase 2)

Add client-side filtering and optimization features:

**1. Client-side property name filtering:**

```typescript
const inputSchema: InputSchema = {
  properties: {
    objectType: { ... },
    archived: { ... },
    dataSensitivity: { ... },
    nameFilter: {
      type: 'string',
      description: 'Filter properties by name (case-insensitive substring match)',
      optional: true
    },
    groupName: {
      type: 'string',
      description: 'Filter properties by group name',
      optional: true
    },
    limit: {
      type: 'number',
      description: 'Maximum number of properties to return (client-side limit)',
      optional: true
    }
  }
};
```

**2. Implement client-side filtering:**

```typescript
async getProperties(
  objectType: string,
  options: {
    archived?: boolean;
    dataSensitivity?: 'sensitive' | 'highly_sensitive';
    nameFilter?: string;
    groupName?: string;
    limit?: number;
  } = {}
): Promise<PropertyResponse[]> {
  // ... fetch all properties from API with archived & dataSensitivity

  let properties = allProperties;

  // Client-side filtering
  if (options.nameFilter) {
    const filter = options.nameFilter.toLowerCase();
    properties = properties.filter(p =>
      p.name.toLowerCase().includes(filter) ||
      p.label.toLowerCase().includes(filter)
    );
  }

  if (options.groupName) {
    properties = properties.filter(p =>
      p.groupName === options.groupName
    );
  }

  if (options.limit && options.limit > 0) {
    properties = properties.slice(0, options.limit);
  }

  return properties;
}
```

**3. Response optimization:**

```typescript
// In the tool handler, provide summary + sample instead of all properties
const response = {
  message: `Found ${properties.length} properties for ${params.objectType}`,
  summary: {
    totalCount: properties.length,
    groups: [...new Set(properties.map(p => p.groupName))],
    types: [...new Set(properties.map(p => p.type))],
    sensitivityBreakdown: {
      nonSensitive: properties.filter(p => p.dataSensitivity === 'non_sensitive').length,
      sensitive: properties.filter(p => p.dataSensitivity === 'sensitive').length,
      highlySensitive: properties.filter(p => p.dataSensitivity === 'highly_sensitive').length
    }
  },
  // Only include first 20 properties in response to save context
  properties: properties.slice(0, 20),
  // Provide property names list for reference
  allPropertyNames: properties.map(p => p.name),
  truncated: properties.length > 20
};
```

### Advanced Implementation (Phase 3)

Implement caching to avoid repeated full property fetches:

**1. Add caching layer:**

```typescript
// In properties.service.ts
private propertyCache: Map<string, {
  properties: PropertyResponse[],
  timestamp: number,
  ttl: number
}> = new Map();

private getCacheKey(objectType: string, archived: boolean, dataSensitivity?: string): string {
  return `${objectType}:${archived}:${dataSensitivity || 'none'}`;
}

async getProperties(
  objectType: string,
  options: PropertyFetchOptions = {}
): Promise<PropertyResponse[]> {
  const cacheKey = this.getCacheKey(
    objectType,
    options.archived || false,
    options.dataSensitivity
  );

  // Check cache (5 minute TTL)
  const cached = this.propertyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return this.applyClientSideFilters(cached.properties, options);
  }

  // Fetch from API
  const properties = await this.fetchPropertiesFromAPI(objectType, options);

  // Cache result
  this.propertyCache.set(cacheKey, {
    properties,
    timestamp: Date.now(),
    ttl: 5 * 60 * 1000 // 5 minutes
  });

  return this.applyClientSideFilters(properties, options);
}
```

---

## Alternative Approaches

### 1. Property Discovery Flow

Instead of listing all properties at once, provide a discovery workflow:

```typescript
// Step 1: List property groups
const groups = await propertiesService.getPropertyGroups('contacts');

// Step 2: Get properties for specific group
const groupProperties = await propertiesService.getPropertiesByGroup('contacts', 'contactinformation');
```

**Implementation:**

```typescript
async getPropertiesByGroup(objectType: string, groupName: string): Promise<PropertyResponse[]> {
  const allProperties = await this.getProperties(objectType);
  return allProperties.filter(p => p.groupName === groupName);
}
```

### 2. Property Search Tool

Create a separate `searchProperties` tool that's optimized for finding specific properties:

```typescript
{
  name: 'searchProperties',
  description: 'Search for properties by name, label, or group',
  inputSchema: {
    properties: {
      objectType: { type: 'string' },
      query: {
        type: 'string',
        description: 'Search term for property name or label'
      },
      maxResults: {
        type: 'number',
        default: 10
      }
    }
  }
}
```

### 3. Lazy Loading Pattern

Return minimal property information initially, with option to fetch full details:

```typescript
// Initial response: just names and labels
{
  properties: [
    { name: 'email', label: 'Email' },
    { name: 'firstname', label: 'First Name' },
    // ... 200 more
  ],
  hint: 'Use getProperty operation with specific propertyName for full details'
}

// Then fetch specific property when needed
const fullDetails = await propertiesService.getProperty('contacts', 'email');
```

---

## Best Practices & Recommendations

### For Current Implementation

1. **Add `archived` parameter immediately**
   - Low complexity, high value
   - Allows users to filter out archived properties (common use case)
   - Reduces response size for most queries

2. **Document the limitation clearly**
   - Update tool description to mention "returns ALL properties"
   - Suggest users fetch property groups first to understand structure
   - Recommend using specific `getProperty` for individual property details

3. **Implement response summarization**
   - Return summary statistics instead of full property list
   - Provide property names array for reference
   - Include only first 10-20 full property objects

4. **Consider context window impact**
   - A mature HubSpot account may have 500+ properties
   - Each property object is ~15-20 lines of JSON
   - Full response could consume 10,000+ tokens

### For Future Enhancements

1. **Add client-side filtering**
   - Name/label search
   - Group filtering
   - Type filtering
   - Result limiting

2. **Implement caching**
   - Properties don't change frequently
   - 5-10 minute cache TTL is reasonable
   - Invalidate on property create/update/delete operations

3. **Create specialized tools**
   - `searchProperties` - For finding specific properties
   - `getPropertyGroup` - For group-based property discovery
   - `getPropertyTypes` - For listing available property types

4. **Add pagination simulation**
   - Even though API doesn't paginate, implement client-side pagination
   - Return properties in pages of 50-100
   - Use offset/limit pattern familiar to users

---

## Testing Recommendations

### Basic Functionality Tests

```typescript
describe('Properties API Filtering', () => {
  it('should fetch only active properties by default', async () => {
    const properties = await service.getProperties('contacts');
    expect(properties.every(p => !p.archived)).toBe(true);
  });

  it('should fetch archived properties when specified', async () => {
    const properties = await service.getProperties('contacts', { archived: true });
    expect(properties.every(p => p.archived)).toBe(true);
  });

  it('should filter by dataSensitivity (Enterprise only)', async () => {
    const properties = await service.getProperties('contacts', {
      dataSensitivity: 'sensitive'
    });
    expect(properties.every(p =>
      p.dataSensitivity === 'sensitive'
    )).toBe(true);
  });
});
```

### Client-Side Filtering Tests

```typescript
describe('Client-side property filtering', () => {
  it('should filter properties by name substring', async () => {
    const properties = await service.getProperties('contacts', {
      nameFilter: 'email'
    });
    expect(properties.every(p =>
      p.name.toLowerCase().includes('email') ||
      p.label.toLowerCase().includes('email')
    )).toBe(true);
  });

  it('should limit result count', async () => {
    const properties = await service.getProperties('contacts', {
      limit: 10
    });
    expect(properties.length).toBeLessThanOrEqual(10);
  });
});
```

---

## API Rate Limits & Performance

### HubSpot API Limits

- **Rate Limit**: 100 requests per 10 seconds (standard accounts)
- **Daily Limits**: Vary by subscription tier
- **Properties Endpoint**: No special limits, uses standard rate limits

### Performance Considerations

1. **Response Size**: Properties endpoint returns entire property list
   - Small account: ~50-100 properties, ~50KB response
   - Medium account: ~200-300 properties, ~200KB response
   - Large account: ~500+ properties, ~500KB+ response

2. **Response Time**: Typically 200-500ms for properties endpoint

3. **Caching Benefits**:
   - Reduces API calls by 95%+ (properties rarely change)
   - Improves response time from 200-500ms to <10ms
   - Prevents rate limit issues

---

## Summary & Action Items

### What We Know

✅ **Available Filters:**
- `archived` parameter (true/false)
- `dataSensitivity` parameter (sensitive, highly_sensitive, or omit)

❌ **NOT Available:**
- Search/query functionality
- Pagination
- Result limiting
- Native filtering by group, type, or other fields

### What We Need to Do

**Priority 1 (High Value, Low Effort):**
1. Add `archived` parameter to listProperties tool
2. Update tool description to clarify it returns ALL properties
3. Implement response summarization (show summary + limited sample)

**Priority 2 (Medium Value, Medium Effort):**
1. Add `dataSensitivity` parameter (with Enterprise requirement note)
2. Implement client-side name/label filtering
3. Add result limiting (client-side)

**Priority 3 (High Value, High Effort):**
1. Implement caching layer
2. Create property search/discovery tools
3. Build property group-based filtering

### Key Takeaways

- HubSpot's Properties API is **not designed for filtered queries**
- The intended pattern is **fetch all, filter client-side**
- For large property lists, **response optimization is critical**
- The `archived` parameter is the **most useful filtering option**
- Enterprise accounts get **additional dataSensitivity filtering**

---

## References & Resources

### Official Documentation
- [HubSpot CRM Properties API](https://developers.hubspot.com/docs/api/crm/properties)
- [Properties API Reference](https://developers.hubspot.com/docs/reference/api/crm/properties)
- [Sensitive Data Guide](https://developers.hubspot.com/docs/api-reference/crm-sensitive-data/guide)
- [NodeJS SDK Documentation](https://github.com/HubSpot/hubspot-api-nodejs)

### Community Resources
- [HubSpot Community: API v3 Property Groups](https://community.hubspot.com/t5/APIs-Integrations/API-v3-How-do-I-get-all-properties-by-property-group/m-p/777152)
- [HubSpot Community: Filters in Properties Endpoint](https://community.hubspot.com/t5/APIs-Integrations/Filters-in-properties-endpoint/m-p/692507)
- [Stack Overflow: HubSpot Properties NodeJS](https://stackoverflow.com/questions/68863981/hubspot-api-list-of-properties-needed-nodejs)

### Related APIs
- [Using Object APIs Guide](https://developers.hubspot.com/docs/guides/crm/using-object-apis)
- [API Usage Guidelines and Limits](https://developers.hubspot.com/docs/api/usage-details)

---

**Document Version:** 1.0
**Last Updated:** October 30, 2025
**Next Review:** Review when implementing Phase 1 changes
