# HubSpot Email Marketing API Research for Email BCP Implementation

## Executive Summary

This document provides comprehensive research on HubSpot's Email Marketing API v3 for implementing a new Email BCP (Bounded Context Pack) with standard CRUD operations. The Email Marketing API v3 was released to general availability and will replace the v1 API, which will be sunset on October 1, 2025. While the v3 API is available, detailed documentation access was limited during research, so some recommendations are based on v1 patterns and community discussions. The implementation should focus on core email management operations (create, read, update, delete) while excluding email sending functionality as requested.

## Technology Overview

### HubSpot Email Marketing API v3

The HubSpot Email Marketing API v3 is the latest version of their email management API that allows programmatic access to marketing emails in HubSpot. Key characteristics include:

- **General Availability**: Released as stable API with breaking change guidelines
- **Enhanced Features**: Includes ability to directly publish or send emails (Enterprise/transactional add-on required)
- **Modern API Design**: Follows updated CRM API patterns
- **Migration Required**: v1 API sunset date is October 1, 2025

## Detailed Documentation

### API References

#### Base Endpoint
```
https://api.hubapi.com/marketing/v3/emails/
```

#### CRUD Endpoints (Inferred from v3 patterns)

Based on HubSpot's standard v3 API patterns observed in other services:

1. **Create Email**
   - Method: `POST`
   - Path: `/marketing/v3/emails/`
   - Purpose: Creates a new marketing email

2. **Get Email**
   - Method: `GET`
   - Path: `/marketing/v3/emails/{emailId}`
   - Purpose: Retrieves a specific email by ID

3. **Update Email**
   - Method: `PATCH` or `PUT`
   - Path: `/marketing/v3/emails/{emailId}`
   - Purpose: Updates an existing email

4. **Delete Email**
   - Method: `DELETE`
   - Path: `/marketing/v3/emails/{emailId}`
   - Purpose: Deletes/archives an email

5. **List Emails**
   - Method: `GET`
   - Path: `/marketing/v3/emails/`
   - Purpose: Lists emails with pagination

### Authentication Requirements

HubSpot has sunset API keys as of November 30, 2022. Current authentication methods:

1. **Private App Access Tokens** (Recommended for this implementation)
   - Static access token for each integration
   - Scoped access control
   - Suitable for single account integrations

2. **OAuth 2.0**
   - Required for multi-account public apps
   - Dynamic token generation
   - Better for distributed applications

### Rate Limits

Current rate limits for Professional/Enterprise accounts:
- **Daily Limit**: 650,000 requests per day (increased from 500,000)
- **Burst Limits**: Increased for authenticated calls
- **Headers**: X-HubSpot-RateLimit-* headers returned with responses

### Data Model and Schema

Based on v1 patterns and community discussions, the email object likely includes:

#### Core Properties (Expected)
- `id`: String - Unique identifier
- `name`: String - Internal name of the email
- `subject`: String - Email subject line
- `state`: String - Email state (DRAFT, PUBLISHED, etc.)
- `type`: String - Email type (REGULAR, AUTOMATED, etc.)
- `created`: Timestamp - Creation date
- `updated`: Timestamp - Last update date

#### Content Properties
- `templateId`: String - Associated template ID (REQUIRED - cannot create emails without templates)
- `from`: Object - Sender information
- `replyTo`: String - Reply-to address

#### Known v3 Limitations
Based on community feedback, v3 doesn't include:
- `allEmailCampaignIds`
- `primaryEmailCampaignId`

### Code Examples and Patterns

#### Service Pattern (Based on existing BCPs)
```typescript
export class EmailsService extends HubspotBaseService {
  async createEmail(properties: EmailPropertiesInput): Promise<EmailResponse> {
    this.checkInitialized();
    this.validateRequired(properties, ['name', 'templateId']);
    
    // Implementation following existing patterns
  }
}
```

#### Tool Pattern
```typescript
export const tool: ToolDefinition = {
  name: 'create',
  description: 'Create a new marketing email in HubSpot',
  inputSchema,
  handler: async (params) => {
    // Tool implementation
  }
};
```

### Best Practices and Conventions

Based on analyzed BCP implementations:

1. **Service Architecture**
   - Extend `HubspotBaseService` for consistency
   - Implement standard CRUD methods
   - Use typed interfaces for all data structures
   - Handle errors with `BcpError` pattern

2. **Tool Organization**
   - Separate file for each operation (create.tool.ts, get.tool.ts, etc.)
   - Export all tools through index.ts
   - Use Zod schemas for input validation

3. **Type Safety**
   - Define separate Input and Response interfaces
   - Use string type for all HubSpot properties
   - Include proper TypeScript types throughout

4. **Error Handling**
   - Validate required fields before API calls
   - Provide meaningful error messages
   - Handle specific API error codes (404, 400, etc.)

## Compatibility Matrix

| Component | Version | Notes |
|-----------|---------|-------|
| HubSpot API | v3 | Required (v1 sunset Oct 2025) |
| Node.js | 14+ | Based on project configuration |
| @hubspot/api-client | Latest | SDK for API interactions |
| TypeScript | 4.x | Project requirement |

## Security Considerations

1. **Authentication**
   - Use environment variable for access token: `HUBSPOT_ACCESS_TOKEN`
   - Never expose tokens in code or logs
   - Implement token rotation if using OAuth

2. **Data Validation**
   - Validate all inputs before API calls
   - Sanitize user-provided content
   - Implement proper access controls

3. **Rate Limiting**
   - Implement retry logic with backoff
   - Monitor rate limit headers
   - Cache responses where appropriate

## Resource Links

### Official Documentation
- [Marketing Email API Guide](https://developers.hubspot.com/docs/guides/api/marketing/emails/marketing-emails)
- [v3 API Reference](https://developers.hubspot.com/docs/reference/api/marketing/emails/marketing-emails)
- [API Authentication](https://developers.hubspot.com/docs/guides/apps/authentication/intro-to-auth)
- [API Usage Details](https://developers.hubspot.com/docs/api/usage-details)

### Community Resources
- [v3 Migration Announcement](https://developers.hubspot.com/changelog/marketing-email-api-v3-released-to-general-availability-and-upcoming-sunset-for-v1)
- [HubSpot Community Forums](https://community.hubspot.com/)

### Migration Guides
- [v1 to v3 Migration Timeline](https://developers.hubspot.com/changelog/marketing-email-api-v3-released-to-general-availability-and-upcoming-sunset-for-v1)

## Recommendations

1. **Implementation Priority**
   - Start with core CRUD operations: Create, Get, Update, Delete
   - Add List/Search functionality next
   - Exclude sending functionality as requested
   - Focus on template-based email creation (required by API)

2. **Architecture Decisions**
   - Follow existing BCP patterns for consistency
   - Use Private App authentication for simplicity
   - Implement comprehensive error handling
   - Add input validation using Zod schemas

3. **Testing Strategy**
   - Create unit tests for service methods
   - Mock HubSpot API responses
   - Test error scenarios thoroughly
   - Validate against rate limits

4. **Future Considerations**
   - Monitor v3 API updates for new features
   - Plan for v1 sunset before October 2025
   - Consider caching strategy for frequently accessed emails
   - Prepare for potential schema changes

## Constraints and Limitations

1. **API Constraints**
   - Must use templates for email creation (no raw HTML)
   - Some v1 properties not available in v3
   - Rate limits apply to all operations

2. **Implementation Constraints**
   - Exclude email sending functionality
   - Focus on essential CRUD operations only
   - Must handle authentication properly

3. **Documentation Gaps**
   - Complete v3 schema not fully documented in public resources
   - Some endpoint details inferred from patterns
   - May need to test API responses for full property list

## Next Steps

1. Verify v3 API access with test requests
2. Confirm exact endpoint paths and methods
3. Document actual response schemas from API
4. Implement service following existing BCP patterns
5. Create comprehensive tests
6. Update documentation with findings