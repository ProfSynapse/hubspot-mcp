# HubSpot Lists API Research

**Research Date:** October 27, 2025
**API Version:** v3 (Current)
**Researcher:** PACT Preparer

---

## Executive Summary

**Can the user's requirements be met? YES**

The HubSpot Lists API v3 fully supports all requested capabilities:

1. **Create lists programmatically** - ✅ Supported via POST `/crm/v3/lists`
2. **Add contacts based on property criteria** - ✅ Supported via dynamic lists with filter definitions
3. **Support static and dynamic lists** - ✅ Three processing types available: MANUAL (static), DYNAMIC (auto-updating), and SNAPSHOT (initially filtered, then manual)

The v3 Lists API is production-ready and supports not only contacts but also companies, deals, and custom objects. The API provides comprehensive filtering capabilities with complex AND/OR logic, nested filter branches, and support for multiple property types (string, number, boolean, date/time).

**Recommendation:** Implement a Lists BCP following the existing architecture pattern. The API is well-documented, stable, and the v1 API won't be sunset until April 30, 2026, providing ample time for adoption.

---

## 1. Technology Overview

### HubSpot Lists API v3

The HubSpot Lists API v3 (also referred to as "Segments API" in recent documentation) provides programmatic access to create, manage, and query lists of CRM records. Lists are collections of records used for segmentation, filtering, and bulk operations within HubSpot.

**Key Features:**
- Multi-object support (Contacts, Companies, Deals, Custom Objects)
- Advanced filter definitions with complex conditional logic
- Three processing types for different use cases
- Batch operations supporting up to 100,000 records
- List conversion capabilities (dynamic to static)
- Search and pagination support

**Migration Status:**
- v1 Lists API will be sunset on **April 30, 2026**
- v3 is the current recommended version
- Migration guide available in official documentation

---

## 2. API Endpoints Reference

### List Management Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/crm/v3/lists` | POST | Create a new list |
| `/crm/v3/lists/{listId}` | GET | Retrieve list by ILS ID |
| `/crm/v3/lists/object-type-id/{objectTypeId}/name/{listName}` | GET | Retrieve list by name and object type |
| `/crm/v3/lists` | GET | Retrieve multiple lists (query param: `listIds`) |
| `/crm/v3/lists/search` | POST | Search lists with filters |
| `/crm/v3/lists/{listId}/update-list-name` | PUT | Update list name |
| `/crm/v3/lists/{listId}/update-list-filters` | PUT | Update filter branches (DYNAMIC lists only) |
| `/crm/v3/lists/{listId}` | DELETE | Delete list (recoverable for 90 days) |
| `/crm/v3/lists/{listId}/restore` | PUT | Restore deleted list within 90 days |

### Membership Management Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/crm/v3/lists/records/{objectTypeId}/{recordId}/memberships` | GET | Get individual record's list memberships |
| `/crm/v3/lists/records/memberships/batch/read` | POST | Batch retrieve memberships for multiple records |
| `/crm/v3/lists/{listId}/memberships/add` | PUT | Add records to list (MANUAL/SNAPSHOT only) |
| `/crm/v3/lists/{listId}/memberships/add-from/{sourceListId}` | PUT | Add all records from another list (max 100k) |
| `/crm/v3/lists/{listId}/memberships` | GET | View all list members with pagination |
| `/crm/v3/lists/{listId}/memberships` | DELETE | Remove all records from list |
| `/crm/v3/lists/{listId}/memberships/remove` | PUT | Remove specific records from list |

### List Conversion Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/crm/v3/lists/{listId}/schedule-conversion` | PUT | Schedule dynamic-to-static conversion |
| `/crm/v3/lists/{listId}/schedule-conversion` | GET | Retrieve conversion schedule info |
| `/crm/v3/lists/{listId}/schedule-conversion` | DELETE | Cancel scheduled conversion |

---

## 3. List Types Comparison

### Processing Types

The Lists API v3 supports three distinct processing types:

| Processing Type | Auto-Updates | Manual Management | Filter-Based | Use Case |
|-----------------|--------------|-------------------|--------------|----------|
| **MANUAL** | ❌ No | ✅ Yes | ❌ No | Static lists where you manually control membership |
| **DYNAMIC** | ✅ Yes | ❌ No | ✅ Yes | Auto-updating lists based on filter criteria (smart lists) |
| **SNAPSHOT** | ❌ No | ✅ Yes | ✅ Initial only | Create initial list from filters, then manage manually |

### Detailed Comparison

#### MANUAL Lists (Static)
- **Description:** Records added/removed only through user actions or API calls
- **Filter Support:** None - filters cannot be specified
- **Membership Control:** Complete manual control via API
- **Use Cases:**
  - Campaign-specific recipient lists
  - One-time segmentation snapshots
  - Lists requiring human review before additions
- **API Operations:** Can use `memberships/add` and `memberships/remove` endpoints

#### DYNAMIC Lists (Active/Smart)
- **Description:** Automatically adds/removes records when they match/unmatch filter criteria
- **Filter Support:** Required - must specify filterBranch in creation
- **Membership Control:** Entirely automatic based on filters
- **Use Cases:**
  - Ongoing segmentation (e.g., "all contacts with lifecycle stage = Customer")
  - Real-time audience targeting
  - Automatic list maintenance based on property changes
- **API Operations:** Cannot manually add/remove members; update filters via `update-list-filters` endpoint
- **Evaluation:** Continuous re-evaluation as record properties change

#### SNAPSHOT Lists
- **Description:** Initially populated by filter criteria, then operates as manual list
- **Filter Support:** Initial creation only - filters applied once at creation time
- **Membership Control:** Manual after initial creation
- **Use Cases:**
  - Historical snapshots (e.g., "contacts who were customers on Q4 2025")
  - Time-bound campaigns with manual adjustments
  - Audit trails requiring fixed membership with optional additions
- **API Operations:** Can use membership endpoints after initial creation

### When to Use Each Type

| Requirement | Recommended Type |
|-------------|------------------|
| List must reflect real-time property changes | DYNAMIC |
| Need manual control over membership | MANUAL |
| Want initial filter-based population with manual adjustments | SNAPSHOT |
| Compliance or audit requirements for fixed membership | SNAPSHOT or MANUAL |
| Automated workflows based on current criteria | DYNAMIC |
| One-time campaign with specific recipients | MANUAL |

---

## 4. Object Type IDs

Lists can be created for different HubSpot object types using the `objectTypeId` parameter:

| Object Type | objectTypeId | Description |
|-------------|--------------|-------------|
| Contacts | `"0-1"` | Contact records |
| Companies | `"0-2"` | Company records |
| Deals | `"0-3"` | Deal/opportunity records |
| Tickets | `"0-5"` | Support ticket records |
| Products | `"0-7"` | Product catalog items |
| Meetings | `"0-47"` | Scheduled meeting records |
| Calls | `"0-48"` | Call activity records |
| Invoices | `"0-53"` | Invoice records |
| Marketing Events | `"0-54"` | Event records |
| Custom Objects | `"2-{uniqueId}"` | Custom object types (ID assigned at creation) |

**Note:** The v3 Lists API supports all object types, whereas v1 only supported Contacts.

---

## 5. Filtering Capabilities

### Filter Structure Overview

HubSpot Lists use a hierarchical filter system with conditional logic:

```
Root Level (OR branch)
├── Child AND Branch 1
│   ├── Filter 1
│   ├── Filter 2
│   └── Nested Filter Branch (optional)
├── Child AND Branch 2
│   └── Filter 3
└── Child AND Branch 3
    └── Filter 4
```

**Key Rules:**
1. Root level must be an **OR** filter branch
2. Child level contains one or more **AND** sub-filter branches
3. Individual filters nested within **AND** branches
4. Records pass if they meet criteria from **any** AND branch (OR logic at root)
5. Records must meet **all** filters within an AND branch to pass that branch

### Filter Branch Types

| Branch Type | Description | Can Contain Filters | Can Contain Nested Branches |
|-------------|-------------|---------------------|---------------------------|
| **OR** | Root level only; records pass if ANY child AND branch passes | ❌ No (must be empty array) | ✅ Yes (AND branches) |
| **AND** | Records pass if ALL filters within pass | ✅ Yes | ✅ Yes (UNIFIED_EVENTS, ASSOCIATION) |
| **UNIFIED_EVENTS** | Filters based on unified events | ✅ Yes | ❌ No |
| **ASSOCIATION** | Filters based on associated records | ✅ Yes | ❌ No |

### Filter Types

The API supports 13+ filter types:

| Filter Type | Purpose | Example Use Case |
|-------------|---------|------------------|
| `PROPERTY` | Evaluates record property values | Find contacts where firstname = "John" |
| `FORM_SUBMISSION` | Assesses form completion history | Contacts who submitted specific form |
| `PAGE_VIEW` | Tracks specific page visits | Visitors who viewed pricing page |
| `EMAIL_EVENT` | Monitors email subscription status | Contacts opted into newsletter |
| `EVENT` | Evaluates custom behavioral events | Users who completed onboarding |
| `IN_LIST` | Checks membership in other lists/workflows | Contacts in "VIP Customers" list |
| `CTA` | Measures call-to-action interactions | Clicked "Request Demo" CTA |
| `WEBINAR` | Tracks webinar registration/attendance | Registered for Q4 webinar |
| `INTEGRATION_EVENT` | External integration events | Shopify purchase completed |
| `SURVEY_MONKEY` | Survey response filters | Completed satisfaction survey |
| `SURVEY_MONKEY_VALUE` | Specific survey answer filters | Rated satisfaction >= 8 |
| `PRIVACY` | Privacy consent filters | Opted in for GDPR processing |
| `ADS_TIME` | Ad interaction time-based filters | Clicked ad in last 30 days |

---

## 6. Property Filter Operations

### Operation Structure

Property filters use an `operation` object with three key components:

```json
{
  "filterType": "PROPERTY",
  "property": "property_name",
  "operation": {
    "operationType": "MULTISTRING",    // Data type
    "operator": "IS_EQUAL_TO",         // Comparison method
    "values": ["value1", "value2"]     // Comparison values
  }
}
```

### Operation Types and Operators

#### MULTISTRING (String Properties)

**Available Operators:**
- `IS_EQUAL_TO` - Exact match
- `IS_NOT_EQUAL_TO` - Does not match
- `CONTAINS` - Contains substring
- `DOES_NOT_CONTAIN` - Does not contain substring
- `STARTS_WITH` - Begins with specified string
- `ENDS_WITH` - Ends with specified string
- `HAS_EVER_BEEN_EQUAL_TO` - Historical value match
- `HAS_NEVER_BEEN_EQUAL_TO` - Never matched historically
- `HAS_EVER_CONTAINED` - Historically contained substring
- `HAS_NEVER_CONTAINED` - Never contained substring
- `IS_BETWEEN` - Between two values (alphabetically)
- `IS_NOT_BETWEEN` - Not between two values

**Example:**
```json
{
  "filterType": "PROPERTY",
  "property": "firstname",
  "operation": {
    "operationType": "MULTISTRING",
    "operator": "IS_EQUAL_TO",
    "values": ["John", "Jane"]
  }
}
```

#### NUMBER (Numeric Properties)

**Available Operators:**
- `IS_EQUAL_TO` - Exact numeric match
- `IS_NOT_EQUAL_TO` - Not equal to value
- `IS_GREATER_THAN` - Greater than value
- `IS_LESS_THAN` - Less than value
- `IS_GREATER_THAN_OR_EQUAL_TO` - Greater than or equal
- `IS_LESS_THAN_OR_EQUAL_TO` - Less than or equal
- `IS_BETWEEN` - Between lowerBound and upperBound
- `IS_NOT_BETWEEN` - Not between bounds
- `HAS_EVER_BEEN_EQUAL_TO` - Historical value match
- `HAS_NEVER_BEEN_EQUAL_TO` - Never matched historically

**Example:**
```json
{
  "filterType": "PROPERTY",
  "property": "amount",
  "operation": {
    "operationType": "NUMBER",
    "operator": "IS_GREATER_THAN",
    "value": 50000
  }
}
```

**Range Example:**
```json
{
  "filterType": "PROPERTY",
  "property": "deal_value",
  "operation": {
    "operationType": "NUMBER",
    "operator": "IS_BETWEEN",
    "lowerBound": 10000,
    "upperBound": 50000
  }
}
```

#### BOOL (Boolean Properties)

**Available Operators:**
- `IS_EQUAL_TO` - Matches true or false
- `IS_NOT_EQUAL_TO` - Does not match value
- `IS_KNOWN` - Property has a value
- `IS_NOT_KNOWN` - Property is empty/null

**Example:**
```json
{
  "filterType": "PROPERTY",
  "property": "is_customer",
  "operation": {
    "operationType": "BOOL",
    "operator": "IS_EQUAL_TO",
    "value": true
  }
}
```

#### TIME_POINT (Date/Time Properties)

**Available Operators:**
- `IS_EQUAL_TO` - Exact date match
- `IS_AFTER` - After specified date
- `IS_BEFORE` - Before specified date
- `IS_BETWEEN` - Between two dates
- `IS_RELATIVE` - Relative to current date (e.g., last 30 days)
- `IS_WITHIN_TIME_WINDOW` - Within rolling time window

**Example (Absolute Date):**
```json
{
  "filterType": "PROPERTY",
  "property": "createdate",
  "operation": {
    "operationType": "TIME_POINT",
    "operator": "IS_AFTER",
    "timestamp": 1672531200000  // Unix timestamp in milliseconds
  }
}
```

**Example (Relative Date):**
```json
{
  "filterType": "PROPERTY",
  "property": "lastmodifieddate",
  "operation": {
    "operationType": "TIME_POINT",
    "operator": "IS_WITHIN_TIME_WINDOW",
    "rangeType": "ROLLING",
    "timeUnit": "DAY",
    "offset": -30  // Last 30 days
  }
}
```

#### Universal Operators (All Types)

**Available for ANY property type:**
- `IS_KNOWN` - Property has a value (not null/empty)
- `IS_NOT_KNOWN` - Property is null or empty

---

## 7. Complete Code Examples

### Example 1: Create Simple Static List

```json
POST /crm/v3/lists
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "VIP Customers - Q4 2025",
  "objectTypeId": "0-1",
  "processingType": "MANUAL"
}
```

**Response:**
```json
{
  "listId": "12345",
  "name": "VIP Customers - Q4 2025",
  "objectTypeId": "0-1",
  "processingType": "MANUAL",
  "createdAt": "2025-10-27T10:00:00.000Z",
  "updatedAt": "2025-10-27T10:00:00.000Z"
}
```

### Example 2: Create Dynamic List with Single Property Filter

Find all contacts where email domain is "example.com":

```json
POST /crm/v3/lists
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "Example.com Contacts",
  "objectTypeId": "0-1",
  "processingType": "DYNAMIC",
  "filterBranch": {
    "filterBranchType": "OR",
    "filterBranches": [
      {
        "filterBranchType": "AND",
        "filterBranches": [],
        "filters": [
          {
            "filterType": "PROPERTY",
            "property": "email",
            "operation": {
              "operationType": "MULTISTRING",
              "operator": "CONTAINS",
              "values": ["@example.com"]
            }
          }
        ]
      }
    ],
    "filters": []
  }
}
```

### Example 3: Create Dynamic List with Multiple Conditions (AND Logic)

Find contacts where:
- Lifecycle stage = "customer"
- AND Last modified in the last 30 days

```json
POST /crm/v3/lists
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "Recently Updated Customers",
  "objectTypeId": "0-1",
  "processingType": "DYNAMIC",
  "filterBranch": {
    "filterBranchType": "OR",
    "filterBranches": [
      {
        "filterBranchType": "AND",
        "filterBranches": [],
        "filters": [
          {
            "filterType": "PROPERTY",
            "property": "lifecyclestage",
            "operation": {
              "operationType": "MULTISTRING",
              "operator": "IS_EQUAL_TO",
              "values": ["customer"]
            }
          },
          {
            "filterType": "PROPERTY",
            "property": "lastmodifieddate",
            "operation": {
              "operationType": "TIME_POINT",
              "operator": "IS_WITHIN_TIME_WINDOW",
              "rangeType": "ROLLING",
              "timeUnit": "DAY",
              "offset": -30
            }
          }
        ]
      }
    ],
    "filters": []
  }
}
```

### Example 4: Create Dynamic List with OR Logic

Find contacts where:
- First name = "John" OR First name = "Jane"

```json
POST /crm/v3/lists
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "John or Jane Contacts",
  "objectTypeId": "0-1",
  "processingType": "DYNAMIC",
  "filterBranch": {
    "filterBranchType": "OR",
    "filterBranches": [
      {
        "filterBranchType": "AND",
        "filterBranches": [],
        "filters": [
          {
            "filterType": "PROPERTY",
            "property": "firstname",
            "operation": {
              "operationType": "MULTISTRING",
              "operator": "IS_EQUAL_TO",
              "values": ["John"]
            }
          }
        ]
      },
      {
        "filterBranchType": "AND",
        "filterBranches": [],
        "filters": [
          {
            "filterType": "PROPERTY",
            "property": "firstname",
            "operation": {
              "operationType": "MULTISTRING",
              "operator": "IS_EQUAL_TO",
              "values": ["Jane"]
            }
          }
        ]
      }
    ],
    "filters": []
  }
}
```

### Example 5: Complex Filter - (A AND B) OR (C AND D)

Find contacts where:
- (Lifecycle stage = "customer" AND Annual revenue > 100000)
- OR (Industry = "Technology" AND Number of employees > 50)

```json
POST /crm/v3/lists
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "High-Value Targets",
  "objectTypeId": "0-1",
  "processingType": "DYNAMIC",
  "filterBranch": {
    "filterBranchType": "OR",
    "filterBranches": [
      {
        "filterBranchType": "AND",
        "filterBranches": [],
        "filters": [
          {
            "filterType": "PROPERTY",
            "property": "lifecyclestage",
            "operation": {
              "operationType": "MULTISTRING",
              "operator": "IS_EQUAL_TO",
              "values": ["customer"]
            }
          },
          {
            "filterType": "PROPERTY",
            "property": "annualrevenue",
            "operation": {
              "operationType": "NUMBER",
              "operator": "IS_GREATER_THAN",
              "value": 100000
            }
          }
        ]
      },
      {
        "filterBranchType": "AND",
        "filterBranches": [],
        "filters": [
          {
            "filterType": "PROPERTY",
            "property": "industry",
            "operation": {
              "operationType": "MULTISTRING",
              "operator": "IS_EQUAL_TO",
              "values": ["Technology"]
            }
          },
          {
            "filterType": "PROPERTY",
            "property": "numberofemployees",
            "operation": {
              "operationType": "NUMBER",
              "operator": "IS_GREATER_THAN",
              "value": 50
            }
          }
        ]
      }
    ],
    "filters": []
  }
}
```

### Example 6: Add Contacts to Static List

```json
PUT /crm/v3/lists/{listId}/memberships/add
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "recordIds": ["101", "102", "103", "104"]
}
```

### Example 7: Search Lists

```json
POST /crm/v3/lists/search
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "listIds": [],
  "offset": 0,
  "count": 50,
  "processingTypes": ["DYNAMIC"],
  "additionalProperties": ["hs_folder_name"],
  "query": "customer",
  "includeFilters": true
}
```

### Example 8: Get List Members with Pagination

```bash
GET /crm/v3/lists/{listId}/memberships?limit=100&after=ABC123XYZ
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Example 9: Update Dynamic List Filters

```json
PUT /crm/v3/lists/{listId}/update-list-filters
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "filterBranch": {
    "filterBranchType": "OR",
    "filterBranches": [
      {
        "filterBranchType": "AND",
        "filterBranches": [],
        "filters": [
          {
            "filterType": "PROPERTY",
            "property": "lifecyclestage",
            "operation": {
              "operationType": "MULTISTRING",
              "operator": "IS_EQUAL_TO",
              "values": ["lead", "customer"]
            }
          }
        ]
      }
    ],
    "filters": []
  }
}
```

### Example 10: Create Snapshot List (Initial Filter, Then Manual)

```json
POST /crm/v3/lists
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "Q4 2025 Snapshot - Active Customers",
  "objectTypeId": "0-1",
  "processingType": "SNAPSHOT",
  "filterBranch": {
    "filterBranchType": "OR",
    "filterBranches": [
      {
        "filterBranchType": "AND",
        "filterBranches": [],
        "filters": [
          {
            "filterType": "PROPERTY",
            "property": "lifecyclestage",
            "operation": {
              "operationType": "MULTISTRING",
              "operator": "IS_EQUAL_TO",
              "values": ["customer"]
            }
          }
        ]
      }
    ],
    "filters": []
  }
}
```

---

## 8. JavaScript/Node.js SDK Examples

### Installation

```bash
npm install @hubspot/api-client
```

### Basic Setup

```javascript
import { Client } from "@hubspot/api-client";

const hubspotClient = new Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN
});
```

### Create a Dynamic List

```javascript
async function createDynamicList() {
  try {
    const listCreateRequest = {
      name: "High-Value Deals",
      objectTypeId: "0-3", // Deals
      processingType: "DYNAMIC",
      filterBranch: {
        filterBranchType: "OR",
        filterBranches: [
          {
            filterBranchType: "AND",
            filterBranches: [],
            filters: [
              {
                filterType: "PROPERTY",
                property: "amount",
                operation: {
                  operationType: "NUMBER",
                  operator: "IS_GREATER_THAN",
                  value: 50000
                }
              }
            ]
          }
        ],
        filters: []
      }
    };

    const response = await hubspotClient.crm.lists.listsApi.create(
      listCreateRequest
    );

    console.log("List created:", response);
    return response;
  } catch (error) {
    console.error("Error creating list:", error);
    throw error;
  }
}
```

### Get List by ID

```javascript
async function getList(listId) {
  try {
    const response = await hubspotClient.crm.lists.listsApi.getById(
      listId,
      true // includeFilters
    );

    console.log("List details:", response);
    return response;
  } catch (error) {
    console.error("Error fetching list:", error);
    throw error;
  }
}
```

### Add Contacts to Static List

```javascript
async function addContactsToList(listId, contactIds) {
  try {
    const response = await hubspotClient.crm.lists.membershipsApi.add(
      listId,
      { recordIds: contactIds }
    );

    console.log("Contacts added:", response);
    return response;
  } catch (error) {
    console.error("Error adding contacts:", error);
    throw error;
  }
}
```

### Search Lists

```javascript
async function searchLists(query) {
  try {
    const searchRequest = {
      query: query,
      processingTypes: ["DYNAMIC", "MANUAL"],
      includeFilters: true,
      count: 50,
      offset: 0
    };

    const response = await hubspotClient.crm.lists.listsApi.doSearch(
      searchRequest
    );

    console.log("Search results:", response);
    return response;
  } catch (error) {
    console.error("Error searching lists:", error);
    throw error;
  }
}
```

### Update Dynamic List Filters

```javascript
async function updateListFilters(listId, newFilterBranch) {
  try {
    const response = await hubspotClient.crm.lists.listsApi.updateListFilters(
      listId,
      { filterBranch: newFilterBranch }
    );

    console.log("Filters updated:", response);
    return response;
  } catch (error) {
    console.error("Error updating filters:", error);
    throw error;
  }
}
```

### Get List Memberships with Pagination

```javascript
async function getListMembers(listId, limit = 100, after = null) {
  try {
    const response = await hubspotClient.crm.lists.membershipsApi.getPage(
      listId,
      limit,
      after
    );

    console.log(`Retrieved ${response.results.length} members`);

    // Handle pagination
    if (response.paging?.next?.after) {
      console.log("More results available, next cursor:", response.paging.next.after);
    }

    return response;
  } catch (error) {
    console.error("Error fetching list members:", error);
    throw error;
  }
}
```

---

## 9. Authentication

### Private App Access Token (Recommended)

HubSpot Lists API uses Bearer token authentication with Private App access tokens.

**Steps to Create Private App:**
1. Navigate to **Settings** → **Integrations** → **Private Apps** in your HubSpot account
2. Click **"Create a private app"**
3. Configure app name and description
4. Select required scopes:
   - `crm.lists.read` - Read lists
   - `crm.lists.write` - Create and modify lists
   - `crm.objects.contacts.read` - Read contacts (for contact lists)
   - `crm.objects.companies.read` - Read companies (for company lists)
5. Copy the generated access token

**Making Authenticated Requests:**

```bash
curl -X GET \
  'https://api.hubapi.com/crm/v3/lists/{listId}' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json'
```

**Required Scopes by Operation:**

| Operation | Required Scopes |
|-----------|----------------|
| Create lists | `crm.lists.write` |
| Read lists | `crm.lists.read` |
| Update lists | `crm.lists.write` |
| Delete lists | `crm.lists.write` |
| Read memberships | `crm.lists.read`, object-specific read scope |
| Modify memberships | `crm.lists.write`, object-specific write scope |

### OAuth (For Multi-Account Apps)

For apps that need to access multiple HubSpot accounts, use OAuth 2.0 flow:
- Authorization Code Flow for server-side apps
- Refresh tokens for long-term access
- Token expiration: 6 hours (access token)

**Reference:** https://developers.hubspot.com/docs/api/oauth/tokens

---

## 10. Rate Limits and Best Practices

### Rate Limits (2025)

| Account Type | Rate Limit | Daily Limit |
|--------------|------------|-------------|
| Private Apps (Standard) | 190 calls per 10 seconds | Subject to account limits |
| Private Apps (with Capacity Pack) | 250 calls per 10 seconds | Higher limits |
| OAuth Apps | Varies by subscription | Account-dependent |

**429 Error Response:**
```json
{
  "status": "error",
  "message": "You have reached your API limit",
  "correlationId": "abc-123-def",
  "category": "RATE_LIMITS"
}
```

### Best Practices

#### 1. Use Batch Operations
```javascript
// ❌ Bad: Individual requests
for (const contactId of contactIds) {
  await addContactToList(listId, contactId);
}

// ✅ Good: Batch request
await hubspotClient.crm.lists.membershipsApi.add(listId, {
  recordIds: contactIds // Up to 100k at once
});
```

#### 2. Implement Exponential Backoff
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.statusCode === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

#### 3. Use Dynamic Lists for Real-Time Segmentation
```javascript
// ❌ Bad: Manually updating static list on property changes
async function onContactUpdate(contactId, properties) {
  if (properties.lifecyclestage === 'customer') {
    await addContactToList('customer-list', contactId);
  }
}

// ✅ Good: Create dynamic list once, automatic updates
await createDynamicList({
  name: "All Customers",
  processingType: "DYNAMIC",
  filterBranch: {
    // Filters for lifecyclestage = customer
  }
});
```

#### 4. Leverage Caching for List Metadata
```javascript
const listCache = new Map();

async function getListWithCache(listId) {
  if (listCache.has(listId)) {
    return listCache.get(listId);
  }

  const list = await hubspotClient.crm.lists.listsApi.getById(listId);
  listCache.set(listId, list);

  return list;
}
```

#### 5. Use includeFilters Sparingly
```javascript
// Only include filters when you need them
const list = await hubspotClient.crm.lists.listsApi.getById(
  listId,
  false // includeFilters - set to true only when needed
);
```

#### 6. Pagination for Large Lists
```javascript
async function getAllListMembers(listId) {
  const allMembers = [];
  let after = null;

  do {
    const response = await hubspotClient.crm.lists.membershipsApi.getPage(
      listId,
      100, // limit
      after
    );

    allMembers.push(...response.results);
    after = response.paging?.next?.after;
  } while (after);

  return allMembers;
}
```

#### 7. Monitor Error Rates
```javascript
// Keep error rate below 5% for marketplace apps
let totalRequests = 0;
let errorRequests = 0;

function trackRequest(success) {
  totalRequests++;
  if (!success) errorRequests++;

  const errorRate = (errorRequests / totalRequests) * 100;
  if (errorRate > 5) {
    console.warn(`High error rate: ${errorRate.toFixed(2)}%`);
  }
}
```

#### 8. Use Webhooks for List Changes
```javascript
// Instead of polling for list membership changes,
// set up webhooks for object property changes
// Webhook calls don't count against API limits
```

---

## 11. Implementation Considerations

### Integration into Existing BCP Architecture

Based on the existing codebase structure at `/src/bcps/`, the Lists integration should follow this pattern:

```
src/bcps/Lists/
├── index.ts                      // BCP definition, exports all tools
├── lists.service.ts              // Core service extending HubspotBaseService
├── lists.create.ts               // Tool: Create list
├── lists.get.ts                  // Tool: Get list by ID
├── lists.search.ts               // Tool: Search lists
├── lists.update.ts               // Tool: Update list name/filters
├── lists.delete.ts               // Tool: Delete list
├── lists.addMembers.ts           // Tool: Add records to list
├── lists.removeMembers.ts        // Tool: Remove records from list
├── lists.getMembers.ts           // Tool: Get list members
└── lists.types.ts                // TypeScript interfaces and types
```

### Service Class Structure

```typescript
// lists.service.ts
import { HubspotBaseService } from '../../core/base-service.js';

export class ListsService extends HubspotBaseService {
  async createList(params: CreateListParams): Promise<ListResponse> {
    this.checkInitialized();
    // Implementation
  }

  async getList(listId: string, includeFilters: boolean): Promise<ListResponse> {
    this.checkInitialized();
    // Implementation
  }

  async searchLists(params: SearchListsParams): Promise<SearchListsResponse> {
    this.checkInitialized();
    // Implementation
  }

  // Additional methods...
}
```

### Tool Registration

Register in `/src/core/bcp-tool-delegator.ts` and `/src/core/tool-registration-factory.ts`:

```typescript
// Follow pattern from existing BCPs
case 'hubspotLists':
  return this.getDomainTool(
    'Lists',
    'hubspotLists',
    'Manage HubSpot lists and memberships'
  );
```

### Response Enhancement

Implement contextual suggestions using the response enhancer:

```typescript
import { enhanceResponse } from '../../core/response-enhancer.js';

const response = {
  success: true,
  data: result,
  message: 'List created successfully'
};

return enhanceResponse(response, 'Lists', 'create', params);
```

### Suggested Contextual Hints

Add to `/src/core/suggestion-config.ts`:

```typescript
Lists: {
  create: [
    "💡 Use processingType 'DYNAMIC' for auto-updating lists based on filters",
    "📋 Use processingType 'MANUAL' for static lists you control manually",
    "🔄 After creating a dynamic list, it automatically evaluates membership"
  ],
  addMembers: [
    "⚠️ Can only add members to MANUAL or SNAPSHOT lists",
    "💡 For DYNAMIC lists, records are added automatically when they match filters"
  ],
  search: [
    "🔍 Use includeFilters: true to see filter definitions in results",
    "💡 Filter by processingType to find specific list types"
  ]
}
```

---

## 12. Common Patterns and Use Cases

### Pattern 1: Lead Nurturing Lists

Create progressive lists based on engagement:

```typescript
// List 1: New Leads (created in last 7 days)
const newLeads = {
  name: "New Leads - Last 7 Days",
  objectTypeId: "0-1",
  processingType: "DYNAMIC",
  filterBranch: {
    filterBranchType: "OR",
    filterBranches: [{
      filterBranchType: "AND",
      filters: [
        {
          filterType: "PROPERTY",
          property: "lifecyclestage",
          operation: {
            operationType: "MULTISTRING",
            operator: "IS_EQUAL_TO",
            values: ["lead"]
          }
        },
        {
          filterType: "PROPERTY",
          property: "createdate",
          operation: {
            operationType: "TIME_POINT",
            operator: "IS_WITHIN_TIME_WINDOW",
            rangeType: "ROLLING",
            timeUnit: "DAY",
            offset: -7
          }
        }
      ]
    }]
  }
};

// List 2: Engaged Leads (opened email in last 30 days)
const engagedLeads = {
  name: "Engaged Leads - Email Opened",
  objectTypeId: "0-1",
  processingType: "DYNAMIC",
  filterBranch: {
    filterBranchType: "OR",
    filterBranches: [{
      filterBranchType: "AND",
      filters: [
        {
          filterType: "PROPERTY",
          property: "lifecyclestage",
          operation: {
            operationType: "MULTISTRING",
            operator: "IS_EQUAL_TO",
            values: ["lead"]
          }
        },
        {
          filterType: "EMAIL_EVENT",
          property: "hs_email_open",
          operation: {
            operationType: "TIME_POINT",
            operator: "IS_WITHIN_TIME_WINDOW",
            rangeType: "ROLLING",
            timeUnit: "DAY",
            offset: -30
          }
        }
      ]
    }]
  }
};
```

### Pattern 2: Customer Segmentation by Value

```typescript
// High-value customers
const highValueCustomers = {
  name: "High-Value Customers (>$100k)",
  objectTypeId: "0-1",
  processingType: "DYNAMIC",
  filterBranch: {
    filterBranchType: "OR",
    filterBranches: [{
      filterBranchType: "AND",
      filters: [
        {
          filterType: "PROPERTY",
          property: "lifecyclestage",
          operation: {
            operationType: "MULTISTRING",
            operator: "IS_EQUAL_TO",
            values: ["customer"]
          }
        },
        {
          filterType: "PROPERTY",
          property: "total_revenue",
          operation: {
            operationType: "NUMBER",
            operator: "IS_GREATER_THAN",
            value: 100000
          }
        }
      ]
    }]
  }
};
```

### Pattern 3: Re-engagement Campaign

```typescript
// Inactive customers (no activity in 90 days)
const inactiveCustomers = {
  name: "Re-engagement Target - Inactive 90+ Days",
  objectTypeId: "0-1",
  processingType: "DYNAMIC",
  filterBranch: {
    filterBranchType: "OR",
    filterBranches: [{
      filterBranchType: "AND",
      filters: [
        {
          filterType: "PROPERTY",
          property: "lifecyclestage",
          operation: {
            operationType: "MULTISTRING",
            operator: "IS_EQUAL_TO",
            values: ["customer"]
          }
        },
        {
          filterType: "PROPERTY",
          property: "notes_last_contacted",
          operation: {
            operationType: "TIME_POINT",
            operator: "IS_BEFORE",
            rangeType: "ROLLING",
            timeUnit: "DAY",
            offset: -90
          }
        }
      ]
    }]
  }
};
```

### Pattern 4: Event-Based List (Snapshot for Historical Record)

```typescript
// Snapshot of attendees at a specific date
const webinarAttendees = {
  name: "Q4 Webinar Attendees - Oct 27, 2025",
  objectTypeId: "0-1",
  processingType: "SNAPSHOT", // Captures one-time snapshot
  filterBranch: {
    filterBranchType: "OR",
    filterBranches: [{
      filterBranchType: "AND",
      filters: [
        {
          filterType: "WEBINAR",
          webinarId: "12345",
          operation: {
            operator: "HAS_ATTENDED"
          }
        }
      ]
    }]
  }
};
```

### Pattern 5: Multi-Criteria Qualification

```typescript
// Sales-qualified leads: engaged + company size + revenue
const sqlList = {
  name: "Sales Qualified Leads",
  objectTypeId: "0-1",
  processingType: "DYNAMIC",
  filterBranch: {
    filterBranchType: "OR",
    filterBranches: [{
      filterBranchType: "AND",
      filters: [
        {
          filterType: "PROPERTY",
          property: "lifecyclestage",
          operation: {
            operationType: "MULTISTRING",
            operator: "IS_EQUAL_TO",
            values: ["marketingqualifiedlead"]
          }
        },
        {
          filterType: "PROPERTY",
          property: "numemployees",
          operation: {
            operationType: "NUMBER",
            operator: "IS_GREATER_THAN",
            value: 50
          }
        },
        {
          filterType: "PROPERTY",
          property: "annualrevenue",
          operation: {
            operationType: "NUMBER",
            operator: "IS_GREATER_THAN",
            value: 1000000
          }
        },
        {
          filterType: "FORM_SUBMISSION",
          formId: "demo-request-form",
          operation: {
            operator: "HAS_COMPLETED"
          }
        }
      ]
    }]
  }
};
```

---

## 13. Limitations and Constraints

### API Limitations

1. **Filter Evaluation Delay**
   - Dynamic lists may take several minutes to fully evaluate after creation or filter updates
   - Not suitable for real-time membership requirements (use Search API instead)

2. **Membership Operations**
   - Cannot manually add/remove members from DYNAMIC lists
   - `memberships/add` and `memberships/remove` only work with MANUAL and SNAPSHOT lists
   - Maximum 100,000 records per batch operation

3. **Filter Complexity**
   - Maximum filter depth/nesting not documented but UI supports up to 5 levels
   - Very complex filters may impact list evaluation performance
   - Some filter types (e.g., custom behavioral events) require enterprise subscriptions

4. **Object Type Support**
   - Not all object types support all filter types
   - Custom object filtering has limited documentation
   - Association filters only work within AND branches

5. **Search Limitations**
   - Search query matches list names only (not filter criteria)
   - Cannot search by filter content directly
   - Maximum 10,000 lists can be retrieved per search (pagination limit)

6. **List Conversion**
   - Dynamic-to-static conversion is one-way (cannot convert back)
   - Conversion scheduling requires specific date or inactivity threshold
   - Snapshot lists cannot be converted back to dynamic after creation

### Property Limitations

1. **Historical Operators**
   - `HAS_EVER_BEEN` operators rely on property history tracking
   - Not all properties have historical data (depends on account settings)
   - Historical data retention may vary by subscription level

2. **Time-Based Filters**
   - Relative time filters use UTC timezone
   - Rolling time windows evaluate continuously (may affect performance)
   - Absolute timestamps must be in Unix milliseconds

3. **Multi-Value Properties**
   - Checkbox properties require special handling
   - Semi-colon delimited values may need specific operators
   - Not all operators work with multi-value properties

### Rate Limits

1. **Daily Limits**
   - Error rate must stay below 5% for marketplace apps
   - Excessive filter updates on dynamic lists may trigger throttling
   - Bulk membership operations count as single API calls (efficient)

2. **Burst Limits**
   - 190-250 calls per 10 seconds (depending on account type)
   - 429 errors include `Retry-After` header
   - Concurrent requests count toward the same bucket

### Data Consistency

1. **Eventual Consistency**
   - Dynamic list membership changes are not instantaneous
   - Property updates may take minutes to reflect in list membership
   - Membership counts may be slightly stale in API responses

2. **Deletion Recovery**
   - Deleted lists recoverable for 90 days via restore endpoint
   - After 90 days, deletion is permanent
   - Restored lists retain original listId and memberships

---

## 14. Error Handling Patterns

### Common Error Responses

```typescript
// 400 Bad Request - Invalid filter structure
{
  "status": "error",
  "message": "Invalid filter branch structure",
  "correlationId": "abc-123-def",
  "category": "VALIDATION_ERROR",
  "errors": [{
    "message": "Filter branch must start with OR type",
    "in": "body.filterBranch.filterBranchType"
  }]
}

// 403 Forbidden - Missing scopes
{
  "status": "error",
  "message": "This app does not have the required scope to access this resource",
  "correlationId": "abc-123-def",
  "category": "MISSING_SCOPES"
}

// 404 Not Found - List doesn't exist
{
  "status": "error",
  "message": "List not found",
  "correlationId": "abc-123-def",
  "category": "OBJECT_NOT_FOUND"
}

// 409 Conflict - Cannot add to dynamic list
{
  "status": "error",
  "message": "Cannot manually add members to DYNAMIC list",
  "correlationId": "abc-123-def",
  "category": "CONFLICT"
}

// 429 Too Many Requests
{
  "status": "error",
  "message": "Rate limit exceeded",
  "correlationId": "abc-123-def",
  "category": "RATE_LIMITS"
}
```

### Error Handling Service Method

```typescript
// lists.service.ts
import { BcpError } from '../../core/types.js';

export class ListsService extends HubspotBaseService {
  private handleListsApiError(error: any, context: string): never {
    const statusCode = error.response?.statusCode || error.statusCode;
    const body = error.response?.body || {};

    switch (statusCode) {
      case 400:
        throw new BcpError(
          `Invalid request: ${body.message || 'Check filter structure'}`,
          'VALIDATION_ERROR',
          { context, details: body.errors }
        );

      case 403:
        throw new BcpError(
          'Missing required scope: crm.lists.read or crm.lists.write',
          'MISSING_SCOPES',
          { context, requiredScopes: ['crm.lists.read', 'crm.lists.write'] }
        );

      case 404:
        throw new BcpError(
          'List not found',
          'NOT_FOUND',
          { context }
        );

      case 409:
        throw new BcpError(
          'Cannot modify DYNAMIC list membership manually',
          'CONFLICT',
          { context, hint: 'Use update-list-filters endpoint instead' }
        );

      case 429:
        throw new BcpError(
          'Rate limit exceeded',
          'RATE_LIMIT',
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
}
```

---

## 15. Testing Considerations

### Unit Tests

```typescript
// lists.service.test.ts
describe('ListsService', () => {
  let service: ListsService;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    mockClient = createMockHubSpotClient();
    service = new ListsService(mockClient);
  });

  describe('createList', () => {
    it('should create a manual list successfully', async () => {
      const params = {
        name: "Test List",
        objectTypeId: "0-1",
        processingType: "MANUAL"
      };

      mockClient.crm.lists.listsApi.create.mockResolvedValue({
        listId: "123",
        ...params
      });

      const result = await service.createList(params);

      expect(result.listId).toBe("123");
      expect(mockClient.crm.lists.listsApi.create).toHaveBeenCalledWith(params);
    });

    it('should validate required filterBranch for dynamic lists', async () => {
      const params = {
        name: "Test Dynamic List",
        objectTypeId: "0-1",
        processingType: "DYNAMIC"
        // Missing filterBranch
      };

      await expect(service.createList(params)).rejects.toThrow(
        'DYNAMIC lists require filterBranch definition'
      );
    });

    it('should handle 403 errors with missing scopes', async () => {
      mockClient.crm.lists.listsApi.create.mockRejectedValue({
        statusCode: 403,
        response: {
          body: { message: 'Missing scope: crm.lists.write' }
        }
      });

      await expect(service.createList({...})).rejects.toThrow(BcpError);
    });
  });
});
```

### Integration Tests

```typescript
// lists.integration.test.ts
describe('Lists API Integration', () => {
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
      await hubspotClient.crm.lists.listsApi.remove(testListId);
    }
  });

  it('should create, retrieve, and delete a list', async () => {
    // Create
    const createResponse = await hubspotClient.crm.lists.listsApi.create({
      name: `Test List ${Date.now()}`,
      objectTypeId: "0-1",
      processingType: "MANUAL"
    });

    testListId = createResponse.listId;
    expect(testListId).toBeDefined();

    // Retrieve
    const getResponse = await hubspotClient.crm.lists.listsApi.getById(
      testListId,
      false
    );

    expect(getResponse.name).toContain('Test List');

    // Delete
    await hubspotClient.crm.lists.listsApi.remove(testListId);

    // Verify deletion
    await expect(
      hubspotClient.crm.lists.listsApi.getById(testListId)
    ).rejects.toThrow();
  });
});
```

---

## 16. Migration from v1 to v3

### Key Differences

| Feature | v1 API | v3 API |
|---------|--------|--------|
| Supported Objects | Contacts only | Contacts, Companies, Deals, Custom Objects |
| Filter Capabilities | Limited | Advanced with nested branches |
| Endpoint Structure | `/contacts/v1/lists` | `/crm/v3/lists` |
| List Types | Dynamic/Static | MANUAL/DYNAMIC/SNAPSHOT |
| Batch Operations | Limited | Up to 100k records |
| Response Format | Legacy structure | Standardized CRM format |

### Endpoint Mapping

| v1 Endpoint | v3 Equivalent |
|-------------|---------------|
| `GET /contacts/v1/lists` | `POST /crm/v3/lists/search` |
| `GET /contacts/v1/lists/:listId` | `GET /crm/v3/lists/{listId}` |
| `POST /contacts/v1/lists` | `POST /crm/v3/lists` |
| `POST /contacts/v1/lists/:listId/add` | `PUT /crm/v3/lists/{listId}/memberships/add` |
| `POST /contacts/v1/lists/:listId/remove` | `PUT /crm/v3/lists/{listId}/memberships/remove` |
| `DELETE /contacts/v1/lists/:listId` | `DELETE /crm/v3/lists/{listId}` |

### Migration Checklist

- [ ] Audit all v1 Lists API usage in codebase
- [ ] Update endpoint URLs from `/contacts/v1/lists` to `/crm/v3/lists`
- [ ] Refactor filter definitions to new structure (OR → AND branches)
- [ ] Update list type terminology (dynamic/static → MANUAL/DYNAMIC/SNAPSHOT)
- [ ] Implement new error handling for v3 response format
- [ ] Test with new objectTypeId parameters
- [ ] Update authentication to use Bearer tokens (if using API keys)
- [ ] Implement batch operations where applicable
- [ ] Update response parsing for new data structure
- [ ] Test pagination with new cursor-based system

---

## 17. Resource Links

### Official HubSpot Documentation

| Resource | URL |
|----------|-----|
| Lists API Overview | https://developers.hubspot.com/docs/api/crm/lists |
| Lists API Guide | https://developers.hubspot.com/docs/api-reference/crm-lists-v3/guide |
| List Filters Documentation | https://developers.hubspot.com/docs/api/crm/lists-filters |
| List Filters Guide | https://developers.hubspot.com/docs/guides/api/crm/lists/lists-filters |
| List Filter Definitions | https://developers.hubspot.com/docs/api/crm/list-filters-definitions |
| v1 API Sunset Notice | https://developers.hubspot.com/changelog/upcoming-sunset-v1-lists-api |
| v3 API Release Notes | https://developers.hubspot.com/changelog/v3-lists-api |
| API Client Libraries | https://developers.hubspot.com/docs/api/client-libraries |
| OAuth Documentation | https://developers.hubspot.com/docs/api/oauth/tokens |
| Rate Limits Guide | https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines |

### HubSpot Node.js SDK

| Resource | URL |
|----------|-----|
| npm Package | https://www.npmjs.com/package/@hubspot/api-client |
| GitHub Repository | https://github.com/HubSpot/hubspot-api-nodejs |
| API Documentation | https://github.hubspot.com/hubspot-api-nodejs/ |
| Lists API Class Reference | https://github.hubspot.com/hubspot-api-nodejs/classes/crm_lists.ListsApi.html |

### Community Resources

| Resource | URL |
|----------|-----|
| HubSpot Developer Community | https://community.hubspot.com/t5/APIs-Integrations/ct-p/APIs-Integrations |
| Developer Slack (#lists-api-v3) | https://developers.hubspot.com/slack |
| HubSpot API Postman Collection | https://www.postman.com/hubspot/hubspot-public-api-workspace/folder/zrus225/lists-api |
| Stack Overflow [hubspot] tag | https://stackoverflow.com/questions/tagged/hubspot |

### Knowledge Base Articles

| Resource | URL |
|----------|-----|
| Understanding Lists vs Segments | https://knowledge.hubspot.com/segments/what-is-the-difference-between-saved-filters-smart-lists-and-static-lists |
| Creating Segments/Lists | https://knowledge.hubspot.com/segments/create-active-or-static-lists |
| Determine Filter Criteria | https://knowledge.hubspot.com/lists/determine-your-list-criteria |
| AND vs OR Logic | https://knowledge.hubspot.com/lists/difference-between-and-vs-or-logic-in-lists-and-workflows |

### Third-Party Tutorials

| Resource | URL |
|----------|-----|
| How to Programmatically Manage Lists | https://moldstud.com/articles/p-how-to-programmatically-manage-hubspot-lists-developer-faqs-and-best-practices |
| HubSpot API v3 Use Cases | https://theobogroup.com/diving-into-the-new-hubspot-api-v3-with-real-world-use-cases/ |
| API Rate Limits Guide | https://mpiresolutions.com/blog/hubspot-api-rate-limits/ |
| Replace API Key with Private Apps | https://dev.to/darkmavis1980/how-to-replace-the-api-key-with-private-apps-in-hubspot-29i9 |

---

## 18. Recommendations for Implementation

### Phase 1: Core Infrastructure (Week 1)

**Priority: HIGH**

1. **Create Lists BCP Structure**
   - Set up `/src/bcps/Lists/` directory following existing patterns
   - Create `lists.types.ts` with comprehensive TypeScript interfaces
   - Implement `ListsService` extending `HubspotBaseService`

2. **Essential Operations (Tools)**
   - `lists.create.ts` - Create MANUAL, DYNAMIC, and SNAPSHOT lists
   - `lists.get.ts` - Retrieve list by ID with optional filter inclusion
   - `lists.search.ts` - Search lists by name and processingType
   - `lists.delete.ts` - Delete lists (with 90-day recovery note)

3. **Error Handling**
   - Implement Lists-specific error handling in service class
   - Handle 409 conflicts for DYNAMIC list membership operations
   - Add contextual error messages for filter validation failures

4. **Testing**
   - Unit tests for service methods
   - Mock HubSpot client responses
   - Test filter structure validation

### Phase 2: Membership Management (Week 2)

**Priority: HIGH**

1. **Membership Tools**
   - `lists.addMembers.ts` - Add records to MANUAL/SNAPSHOT lists
   - `lists.removeMembers.ts` - Remove records from lists
   - `lists.getMembers.ts` - Retrieve list members with pagination

2. **Batch Operations**
   - Support up to 100k records per operation
   - Implement pagination for large membership lists
   - Add batch membership retrieval support

3. **Validation**
   - Validate processingType before membership operations
   - Prevent manual additions to DYNAMIC lists with clear error messages
   - Validate objectTypeId matches between list and records

### Phase 3: Advanced Features (Week 3)

**Priority: MEDIUM**

1. **Filter Management**
   - `lists.updateFilters.ts` - Update DYNAMIC list filter definitions
   - Filter builder utilities for common patterns
   - Filter validation before API submission

2. **List Utilities**
   - `lists.update.ts` - Update list name
   - `lists.restore.ts` - Restore deleted lists
   - List conversion scheduling endpoints

3. **Response Enhancement**
   - Add contextual suggestions to all operations
   - Workflow guidance (e.g., "To add members, use processingType: MANUAL")
   - Cross-reference related operations

### Phase 4: Developer Experience (Week 4)

**Priority: MEDIUM**

1. **Helper Utilities**
   - Filter builder class for complex filter construction
   - Pre-built filter templates for common use cases
   - Validation utilities for filter structures

2. **Documentation**
   - JSDoc comments with examples
   - README for Lists BCP
   - Migration guide for users transitioning from manual list management

3. **Integration Tests**
   - End-to-end tests with real HubSpot API (test account)
   - Test dynamic list evaluation timing
   - Test membership synchronization

### Recommended Tool Structure

```typescript
// Example: lists.create.ts
export const tool = {
  name: 'hubspotLists_create',
  description: 'Create a new HubSpot list (MANUAL, DYNAMIC, or SNAPSHOT)',
  inputSchema: z.object({
    name: z.string().describe('List name'),
    objectTypeId: z.enum(['0-1', '0-2', '0-3']).describe('Object type: 0-1=Contacts, 0-2=Companies, 0-3=Deals'),
    processingType: z.enum(['MANUAL', 'DYNAMIC', 'SNAPSHOT']).describe('List type'),
    filterBranch: z.object({...}).optional().describe('Required for DYNAMIC/SNAPSHOT lists')
  }),
  handler: async (params: CreateListParams) => {
    const service = new ListsService(hubspotClient);
    const result = await service.createList(params);
    return enhanceResponse(result, 'Lists', 'create', params);
  }
};
```

### Filter Builder Utility (Recommended)

```typescript
// Helper class for building filters
export class ListFilterBuilder {
  private filterBranch: FilterBranch;

  constructor() {
    this.filterBranch = {
      filterBranchType: 'OR',
      filterBranches: [],
      filters: []
    };
  }

  addAndBranch(): AndBranchBuilder {
    const andBranch = new AndBranchBuilder();
    this.filterBranch.filterBranches.push(andBranch.build());
    return andBranch;
  }

  build(): FilterBranch {
    return this.filterBranch;
  }
}

// Usage:
const filterBuilder = new ListFilterBuilder();
filterBuilder.addAndBranch()
  .propertyEquals('lifecyclestage', 'customer')
  .propertyGreaterThan('total_revenue', 100000);

const filter = filterBuilder.build();
```

### Suggested MCP Tool Operations

Following the existing pattern (e.g., `hubspotCompany`), implement:

```typescript
// Tool name: hubspotLists
// Operations:
- create        // Create new list
- get           // Get list by ID
- search        // Search lists
- update        // Update list name
- updateFilters // Update DYNAMIC list filters
- delete        // Delete list
- restore       // Restore deleted list
- addMembers    // Add records to list
- removeMembers // Remove records from list
- getMembers    // Get list members
- getMemberships // Get record's list memberships
```

### Success Metrics

1. **Functionality**
   - All three processing types (MANUAL, DYNAMIC, SNAPSHOT) supported
   - Filter creation for all major property types (string, number, boolean, time)
   - Batch operations working efficiently

2. **Quality**
   - Unit test coverage > 80%
   - Integration tests passing
   - Error handling comprehensive and clear

3. **Developer Experience**
   - Clear contextual suggestions in responses
   - Filter validation prevents API errors
   - Documentation complete with examples

4. **Performance**
   - Response times < 2 seconds for list operations
   - Batch operations handle max 100k records
   - Rate limiting implemented with exponential backoff

---

## 19. Potential Gotchas and Common Mistakes

### Gotcha 1: Filter Structure Validation

**Problem:** HubSpot requires specific filter branch structure (OR → AND) even for simple single-condition filters.

**Mistake:**
```json
{
  "filterBranch": {
    "filterBranchType": "AND",  // ❌ Root must be OR
    "filters": [...]
  }
}
```

**Correct:**
```json
{
  "filterBranch": {
    "filterBranchType": "OR",
    "filterBranches": [{
      "filterBranchType": "AND",
      "filters": [...]
    }]
  }
}
```

### Gotcha 2: Processing Type Constraints

**Problem:** Attempting to manually add members to DYNAMIC lists results in 409 errors.

**Solution:** Always check `processingType` before membership operations:

```typescript
if (list.processingType === 'DYNAMIC') {
  throw new Error('Use updateFilters endpoint for DYNAMIC lists');
}
```

### Gotcha 3: Filter Evaluation Delay

**Problem:** Dynamic list membership doesn't update immediately after creation or filter changes.

**Solution:**
- Set expectations that evaluation may take 5-15 minutes
- Don't rely on immediate membership for critical workflows
- Use Search API for real-time filtering needs

### Gotcha 4: Historical Operators

**Problem:** `HAS_EVER_BEEN_EQUAL_TO` operators don't work if property history isn't enabled.

**Solution:**
- Check account settings for property history tracking
- Document which properties support historical operators
- Fall back to current value operators when history unavailable

### Gotcha 5: ObjectTypeId String Type

**Problem:** Passing objectTypeId as number instead of string.

**Mistake:**
```typescript
objectTypeId: 1  // ❌ Must be string
```

**Correct:**
```typescript
objectTypeId: "0-1"  // ✅ String format
```

### Gotcha 6: Empty Filters Array

**Problem:** Forgetting to initialize empty arrays in filter structure.

**Mistake:**
```json
{
  "filterBranch": {
    "filterBranchType": "OR",
    "filterBranches": [...]
    // ❌ Missing: "filters": []
  }
}
```

**Correct:**
```json
{
  "filterBranch": {
    "filterBranchType": "OR",
    "filterBranches": [...],
    "filters": []  // ✅ Required even when empty
  }
}
```

### Gotcha 7: Rate Limiting on Filter Updates

**Problem:** Frequent filter updates on DYNAMIC lists can trigger rate limits.

**Solution:**
- Batch filter changes when possible
- Implement debouncing for user-triggered filter updates
- Use SNAPSHOT lists for frequently changing criteria

### Gotcha 8: Pagination Cursor Expiration

**Problem:** Pagination cursors (`after` parameter) may expire if not used promptly.

**Solution:**
- Process paginated results in reasonable time
- Don't cache cursors for extended periods
- Restart pagination if cursor becomes invalid

---

## 20. Security Considerations

### Access Control

1. **Scope Management**
   - Use least-privilege principle: only request necessary scopes
   - `crm.lists.read` for read-only operations
   - `crm.lists.write` for create/update/delete operations
   - Object-specific scopes for membership operations

2. **Private App Token Security**
   - Store access tokens in environment variables, never in code
   - Rotate tokens periodically
   - Use separate tokens for development/staging/production
   - Revoke tokens immediately if compromised

3. **List Access Permissions**
   - Lists inherit permissions from the HubSpot account
   - Private apps can only access lists in the account they're created in
   - OAuth apps respect user permissions

### Data Privacy

1. **GDPR Compliance**
   - Lists may contain PII (personally identifiable information)
   - Respect data retention policies
   - Handle deleted contacts appropriately (they auto-remove from lists)
   - Document list purposes for compliance audits

2. **Filter Sensitivity**
   - Be cautious with filters containing sensitive criteria
   - Avoid exposing filter definitions in logs
   - Encrypt stored filter configurations if necessary

3. **Membership Data**
   - Limit member data retrieval to necessary fields
   - Don't log full membership lists
   - Implement access controls on list membership endpoints

### API Security

1. **Request Validation**
   ```typescript
   // Sanitize list names
   function sanitizeListName(name: string): string {
     return name
       .trim()
       .replace(/[<>]/g, '') // Remove potential XSS characters
       .slice(0, 255); // Enforce length limit
   }
   ```

2. **Error Information Disclosure**
   ```typescript
   // Don't expose internal details in errors
   catch (error) {
     // ❌ Don't do this:
     return { error: error.message, stack: error.stack };

     // ✅ Do this:
     return { error: 'Failed to create list', correlationId: generateId() };
   }
   ```

3. **Rate Limit Protection**
   - Implement rate limiting at application level
   - Prevent single users from exhausting API quota
   - Monitor for unusual API usage patterns

### Audit Trail

1. **Operation Logging**
   ```typescript
   // Log critical operations
   logger.info('List created', {
     listId: result.listId,
     listName: sanitizedName,
     processingType: params.processingType,
     userId: currentUser.id,
     timestamp: new Date().toISOString()
   });
   ```

2. **Change Tracking**
   - Log filter updates on DYNAMIC lists
   - Track membership additions/removals
   - Maintain audit trail for compliance

---

## Appendix A: Complete Filter Examples Library

### Contact Filters

```typescript
// All contacts created in last 30 days
const recentContacts = {
  filterType: "PROPERTY",
  property: "createdate",
  operation: {
    operationType: "TIME_POINT",
    operator: "IS_WITHIN_TIME_WINDOW",
    rangeType: "ROLLING",
    timeUnit: "DAY",
    offset: -30
  }
};

// Contacts with specific lifecycle stage
const customerContacts = {
  filterType: "PROPERTY",
  property: "lifecyclestage",
  operation: {
    operationType: "MULTISTRING",
    operator: "IS_EQUAL_TO",
    values: ["customer"]
  }
};

// Contacts with email address known
const emailKnown = {
  filterType: "PROPERTY",
  property: "email",
  operation: {
    operationType: "MULTISTRING",
    operator: "IS_KNOWN"
  }
};
```

### Company Filters

```typescript
// Companies in specific industry
const techCompanies = {
  filterType: "PROPERTY",
  property: "industry",
  operation: {
    operationType: "MULTISTRING",
    operator: "IS_EQUAL_TO",
    values: ["Technology", "Software"]
  }
};

// Companies with revenue range
const midMarketCompanies = {
  filterType: "PROPERTY",
  property: "annualrevenue",
  operation: {
    operationType: "NUMBER",
    operator: "IS_BETWEEN",
    lowerBound: 1000000,
    upperBound: 50000000
  }
};

// Companies with 50+ employees
const largeCompanies = {
  filterType: "PROPERTY",
  property: "numberofemployees",
  operation: {
    operationType: "NUMBER",
    operator: "IS_GREATER_THAN_OR_EQUAL_TO",
    value: 50
  }
};
```

### Deal Filters

```typescript
// Open deals in specific stage
const qualificationDeals = {
  filterType: "PROPERTY",
  property: "dealstage",
  operation: {
    operationType: "MULTISTRING",
    operator: "IS_EQUAL_TO",
    values: ["qualifiedtobuy"]
  }
};

// Deals with close date in next quarter
const upcomingCloses = {
  filterType: "PROPERTY",
  property: "closedate",
  operation: {
    operationType: "TIME_POINT",
    operator: "IS_BETWEEN",
    lowerBound: Date.now(),
    upperBound: Date.now() + (90 * 24 * 60 * 60 * 1000) // 90 days
  }
};

// High-value deals
const highValueDeals = {
  filterType: "PROPERTY",
  property: "amount",
  operation: {
    operationType: "NUMBER",
    operator: "IS_GREATER_THAN",
    value: 100000
  }
};
```

---

## Appendix B: Quick Reference Card

### Create List Quick Reference

| List Type | processingType | filterBranch Required | Can Add Members Manually |
|-----------|---------------|----------------------|-------------------------|
| Static | MANUAL | ❌ No | ✅ Yes |
| Dynamic | DYNAMIC | ✅ Yes | ❌ No |
| Snapshot | SNAPSHOT | ✅ Yes | ✅ Yes (after creation) |

### Object Type IDs

| Object | ID | Common Use |
|--------|-----|------------|
| Contact | "0-1" | Email campaigns, lead nurturing |
| Company | "0-2" | Account-based marketing |
| Deal | "0-3" | Sales pipeline segmentation |
| Ticket | "0-5" | Support workflows |

### Common Operators

| Property Type | Operators | Example |
|---------------|-----------|---------|
| String | IS_EQUAL_TO, CONTAINS, STARTS_WITH | firstname CONTAINS "John" |
| Number | IS_GREATER_THAN, IS_BETWEEN | revenue > 100000 |
| Boolean | IS_EQUAL_TO | is_customer = true |
| Date | IS_AFTER, IS_WITHIN_TIME_WINDOW | created in last 30 days |

### Rate Limits

| Limit Type | Value |
|------------|-------|
| Burst | 190-250 calls / 10 seconds |
| Daily | Account-dependent |
| Batch Size | 100,000 records max |
| Error Rate | < 5% for marketplace apps |

---

**End of Research Document**

*This comprehensive research document provides all the information needed to successfully implement HubSpot Lists API integration into the existing BCP architecture. Proceed to Architecture phase for detailed system design.*
