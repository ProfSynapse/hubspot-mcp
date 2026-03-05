# HubSpot Contacts API Search Research and Documentation

## Executive Summary

This research provides comprehensive analysis of HubSpot's Contacts API search functionality, with particular focus on why name-based searches often return unexpected results while email searches work more reliably. The investigation reveals significant differences in search behavior, operator functionality, and underlying API limitations that directly impact search accuracy and user experience.

Key findings indicate that **email searches are more reliable for exact matches and duplicate prevention**, while **name searches are inherently fuzzy but may not prioritize exact matches effectively**. The research also uncovers ongoing issues with HubSpot's search tokenization, wildcard functionality, and case sensitivity requirements that affect search implementation in 2024-2025.

## Technology Overview

### HubSpot Contacts API v3 (Current)
The primary API for contact management and search operations, providing enhanced search capabilities over legacy versions. Key endpoint: `/crm/v3/objects/contacts/search`

### Legacy Contact Lists API (Sunsetting)
The V1 Contact Lists API will sunset on September 30, 2025, requiring migration to v3 Lists API for continued functionality.

### Search API Architecture
Built on HubSpot's CRM Search API framework, supporting complex filtering, sorting, and property-based searches across CRM objects.

## Detailed Documentation

### API Search Functionality

#### Search Endpoint Structure
```
POST /crm/v3/objects/contacts/search
```

#### Default Searchable Properties for Contacts
- `firstname`
- `lastname`
- `email`
- `hs_additional_emails`
- `phone`
- `hs_object_id`
- `hs_searchable_calculated_phone_number`
- `company`

#### Request Structure
```json
{
  "filterGroups": [
    {
      "filters": [
        {
          "propertyName": "string",
          "operator": "string",
          "value": "string"
        }
      ]
    }
  ],
  "properties": ["array of property names"],
  "sorts": [
    {
      "propertyName": "string",
      "direction": "ASCENDING|DESCENDING"
    }
  ],
  "query": "string",
  "limit": 100,
  "after": 0
}
```

### Search Operators and Filters

#### Supported Operators
- **EQ**: Exact equality (case-sensitive, requires lowercase for strings)
- **NEQ**: Not equal to
- **LT/LTE**: Less than/Less than or equal to
- **GT/GTE**: Greater than/Greater than or equal to
- **BETWEEN**: Range-based filtering
- **IN/NOT_IN**: List-based filtering (requires "values" array instead of "value")
- **HAS_PROPERTY/NOT_HAS_PROPERTY**: Property existence checks
- **CONTAINS_TOKEN**: Partial text matching with tokenization
- **NOT_CONTAINS_TOKEN**: Negative partial text matching

#### Filter Group Configuration
- Maximum of 5 filter groups per request
- Maximum of 6 filters per group
- Total maximum of 18 filters across all groups
- AND logic within filter groups, OR logic between groups

### Email vs Name Search Behavior Analysis

#### Email Search Characteristics

**Strengths:**
- **Exact Matching**: Email addresses provide precise, unique identifiers
- **Duplicate Prevention**: Essential for checking if contacts already exist
- **Data Integrity**: Prevents creation of duplicate contact records
- **Reliable Results**: Consistent search behavior with minimal false positives

**Limitations:**
- **Partial Domain Search**: Searching partial email domains may not work through basic CRM search
- **Validation Requirements**: Requires third-party integrations for comprehensive email validation

**Implementation Example:**
```json
{
  "filterGroups": [
    {
      "filters": [
        {
          "propertyName": "email",
          "operator": "EQ",
          "value": "john.doe@example.com"
        }
      ]
    }
  ]
}
```

#### Name Search Characteristics

**Strengths:**
- **Fuzzy Matching**: Inherently supports partial and approximate matches
- **Flexible Input**: Accommodates various name formats and variations
- **User-Friendly**: Natural search behavior for end users

**Weaknesses:**
- **Inconsistent Exact Match Priority**: Exact matches may not appear first in results
- **Token-Based Limitations**: Search only works on space-delimited tokens
- **Case Sensitivity Issues**: Requires lowercase values for reliable results
- **Multiple Field Complexity**: Names split across firstname/lastname fields create search complexity

**Current Implementation Analysis:**
The existing codebase implements name search by splitting the input and creating separate filter groups for firstname and lastname:

```typescript
// From hubspot-client.ts (lines 405-450)
const nameParts = name.split(' ');
const firstName = nameParts[0];
const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

const filterGroups = [];

if (firstName) {
  filterGroups.push({
    filters: [{
      propertyName: 'firstname',
      operator: 'CONTAINS_TOKEN' as any,
      value: firstName
    }]
  });
}

if (lastName) {
  filterGroups.push({
    filters: [{
      propertyName: 'lastname',
      operator: 'CONTAINS_TOKEN' as any,
      value: lastName
    }]
  });
}
```

### Fuzzy Matching and Partial Search Capabilities

#### Wildcard Search Support
- **Basic Wildcards**: Use `*` at the beginning of search terms for partial matching
- **Example**: Search `*タロウ` to find `山田シンタロウ`
- **Limitation**: Only supports prefix wildcards, not suffix or infix wildcards

#### CONTAINS_TOKEN Behavior
- **Token Definition**: Searches for words separated by delimiters (spaces, special characters)
- **Special Character Handling**: Automatically escapes special characters in search terms
- **Duplicate Token Logic**: Multiple instances of the same token are treated as a single search term
- **Case Handling**: Case-insensitive matching but requires lowercase input values

#### Query Parameter Functionality
- **Multi-Field Search**: Searches across default searchable properties simultaneously
- **Partial Word Matching**: Supports matching partial words or phrases
- **Machine Learning**: Uses ML algorithms to determine relevance (in UI, limited in API)

### Common Issues and Troubleshooting

#### 2024 Known Issues

**API Search Problems:**
1. **"There was a problem with the request"** errors due to property name mismatches
2. **Wildcard Search Bugs**: Wildcard functionality ignoring certain characters (reported August 2024)
3. **Case Sensitivity Requirements**: Inconsistent documentation about lowercase requirements
4. **IN Operator Failures**: IN operator not working with proper configuration in some cases

**Name Search Specific Issues:**
1. **Exact Match Deprioritization**: Exact company/contact names appearing between 5th-10th results
2. **Tokenization Problems**: Cannot search for strings within other strings without delimiters
3. **Multi-Word Name Handling**: Complex logic required for proper firstname/lastname searches
4. **Special Character Escaping**: Unexpected results with names containing special characters

**Performance and Reliability Issues:**
1. **Search Result Limits**: Maximum 100 results for CRM searches, 10,000 total per query
2. **Rate Limiting**: 5 requests per second per account
3. **Index Delays**: Newly created/updated objects may not appear immediately in results
4. **Query Length Limits**: 3,000-character query limit

### Best Practices and Patterns

#### Email Search Best Practices
1. **Always Use EQ Operator**: For exact email matching
2. **Include Email in Properties**: Always include email in response properties
3. **Implement Validation**: Use third-party email validation services
4. **Handle Duplicate Prevention**: Use email as primary identifier for upsert operations

#### Name Search Best Practices
1. **Use CONTAINS_TOKEN**: For flexible name matching
2. **Implement Fallback Logic**: Search both combined name and split firstname/lastname
3. **Consider Full-Text Alternatives**: Implement client-side relevance scoring
4. **Handle Special Characters**: Pre-process names to handle special characters properly

#### Enhanced Name Search Pattern
```json
{
  "filterGroups": [
    {
      "filters": [
        {
          "propertyName": "firstname",
          "operator": "CONTAINS_TOKEN",
          "value": "john"
        },
        {
          "propertyName": "lastname",
          "operator": "CONTAINS_TOKEN", 
          "value": "smith"
        }
      ]
    }
  ],
  "query": "john smith",
  "properties": ["firstname", "lastname", "email", "company"],
  "sorts": [
    {
      "propertyName": "createdate",
      "direction": "DESCENDING"
    }
  ],
  "limit": 100
}
```

#### Query Parameter Usage
For broader name searches across multiple fields:
```json
{
  "query": "john smith",
  "properties": ["firstname", "lastname", "email", "company"],
  "limit": 50
}
```

### Code Examples and Implementation

#### Current Implementation Issues
The existing search implementation has several areas for improvement:

1. **Missing Error Handling**: No specific handling for tokenization issues
2. **Limited Operator Usage**: Only uses CONTAINS_TOKEN, no fallback to EQ for exact matches
3. **No Relevance Scoring**: No client-side logic to prioritize exact matches
4. **Case Sensitivity**: No preprocessing to ensure lowercase values

#### Recommended Enhanced Implementation
```typescript
async searchContactsByName(name: string, limit: number = 10): Promise<any[]> {
  try {
    const lowercaseName = name.toLowerCase().trim();
    const nameParts = lowercaseName.split(/\s+/);
    
    // Strategy 1: Exact match across combined query
    const exactSearchRequest = {
      query: lowercaseName,
      properties: ['email', 'firstname', 'lastname', 'company'],
      limit: limit,
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }]
    };
    
    // Strategy 2: Token-based search with firstname/lastname filters
    const filterGroups = [];
    
    if (nameParts.length === 1) {
      // Single name - search both firstname and lastname
      filterGroups.push({
        filters: [{
          propertyName: 'firstname',
          operator: 'CONTAINS_TOKEN',
          value: nameParts[0]
        }]
      });
      filterGroups.push({
        filters: [{
          propertyName: 'lastname',
          operator: 'CONTAINS_TOKEN',
          value: nameParts[0]
        }]
      });
    } else {
      // Multiple names - assign to firstname/lastname
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      
      if (firstName) {
        filterGroups.push({
          filters: [{
            propertyName: 'firstname',
            operator: 'CONTAINS_TOKEN',
            value: firstName
          }]
        });
      }
      
      if (lastName) {
        filterGroups.push({
          filters: [{
            propertyName: 'lastname',
            operator: 'CONTAINS_TOKEN',
            value: lastName
          }]
        });
      }
    }
    
    const tokenSearchRequest = {
      filterGroups,
      properties: ['email', 'firstname', 'lastname', 'company'],
      limit: limit,
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }]
    };
    
    // Execute both searches and merge results with deduplication
    const [exactResults, tokenResults] = await Promise.all([
      this.client.crm.contacts.searchApi.doSearch(exactSearchRequest),
      this.client.crm.contacts.searchApi.doSearch(tokenSearchRequest)
    ]);
    
    // Merge and deduplicate results, prioritizing exact matches
    const mergedResults = [...exactResults.results];
    const existingIds = new Set(exactResults.results.map(contact => contact.id));
    
    for (const contact of tokenResults.results) {
      if (!existingIds.has(contact.id)) {
        mergedResults.push(contact);
      }
    }
    
    return this.formatResponse(mergedResults.slice(0, limit).map(contact => ({
      id: contact.id,
      properties: contact.properties,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt
    })));
    
  } catch (error) {
    return this.handleApiError(error, 'searchContactsByName');
  }
}
```

## Compatibility Matrix

### API Version Requirements
- **HubSpot API v3**: Required for current search functionality
- **Node.js SDK**: @hubspot/api-client v8.0.0+
- **Authentication**: OAuth 2.0 or Private App tokens

### Known Version-Specific Issues
- **Contact ID System**: Updated in March 2024, affecting both v3 and legacy APIs
- **Lists API Migration**: V1 Contact Lists API sunset September 30, 2025
- **Search Operator Support**: IN operator inconsistencies across different SDK versions

### Rate Limits and Performance
- **Search Rate Limit**: 5 requests per second per account
- **Result Limits**: 100 results per search request, 10,000 total per query
- **API Limit Increases**: Pro+ customers receive higher limits as of October 2024

## Security Considerations

### Authentication Security
- **OAuth 2.0 Tokens**: Preferred for production applications
- **Private App Tokens**: Suitable for internal integrations
- **Scope Requirements**: Minimum required scopes for contact search operations

### Data Privacy
- **GDPR Compliance**: Consider data minimization when selecting properties
- **PII Handling**: Email addresses and names are personally identifiable information
- **Data Retention**: Implement appropriate caching and storage policies

### API Key Management
- **Environment Variables**: Store API keys in environment variables, not code
- **Token Rotation**: Implement regular token refresh for OAuth implementations
- **Error Handling**: Avoid exposing authentication errors to end users

## Resource Links

### Official Documentation
- [HubSpot CRM Search API Guide](https://developers.hubspot.com/docs/guides/api/crm/search)
- [HubSpot Contacts API Documentation](https://developers.hubspot.com/docs/guides/api/crm/objects/contacts)
- [HubSpot API Reference - Contacts v3](https://developers.hubspot.com/docs/reference/api/crm/objects/contacts/v3)
- [HubSpot Developer Changelog](https://developers.hubspot.com/changelog/tag/api)

### Community Resources
- [HubSpot Developer Community - APIs & Integrations](https://community.hubspot.com/t5/APIs-Integrations/bd-p/integrations)
- [Stack Overflow - HubSpot API Questions](https://stackoverflow.com/questions/tagged/hubspot-api)
- [HubSpot Status Page](https://status.hubspot.com/)

### Third-Party Tools
- [Clearout - Email Validation Integration](https://clearout.io/integrations/hubspot/)
- [HubSpot API NodeJS Client](https://github.com/HubSpot/hubspot-api-nodejs)
- [HubSpot API Python Client](https://github.com/HubSpot/hubspot-api-python)

## Recommendations

### Short-Term Improvements (Immediate Implementation)
1. **Implement Enhanced Name Search**: Use the recommended dual-strategy approach combining query and filter-based searches
2. **Add Input Preprocessing**: Convert all search inputs to lowercase and trim whitespace
3. **Improve Error Handling**: Add specific error handling for common search API issues
4. **Add Result Deduplication**: Implement logic to merge and deduplicate search results

### Medium-Term Enhancements (1-3 Months)
1. **Client-Side Relevance Scoring**: Implement algorithms to prioritize exact matches in results
2. **Search Result Caching**: Cache frequently searched names to improve performance
3. **Fuzzy Matching Library**: Integrate client-side fuzzy matching for improved name searches
4. **Search Analytics**: Track search success rates and optimize based on data

### Long-Term Strategic Considerations (3-12 Months)
1. **Search Service Architecture**: Consider building a dedicated search service layer
2. **Alternative Search Solutions**: Evaluate integrating with dedicated search engines (Elasticsearch, Algolia)
3. **Machine Learning Integration**: Develop ML models for better name matching and relevance scoring
4. **API Migration Planning**: Prepare for upcoming HubSpot API changes and deprecations

### Migration Considerations
1. **Lists API Sunset**: Plan migration from V1 Contact Lists API before September 30, 2025
2. **Contact ID Updates**: Ensure compatibility with new contact ID generation system (March 2024+)
3. **SDK Updates**: Regularly update HubSpot SDK versions to access latest features and bug fixes

---

*Documentation generated as part of HubSpot MCP implementation research - PACT Framework Preparation Phase*
*Last updated: September 10, 2025*