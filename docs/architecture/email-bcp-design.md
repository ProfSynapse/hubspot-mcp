# Email BCP Architecture Design

## Executive Summary

This document outlines the architectural design for the Email BCP (Bounded Context Pack) implementation for HubSpot's Email Marketing API v3. The design follows the established BCP patterns in the codebase and provides comprehensive CRUD operations for marketing emails while excluding sending functionality as requested. The architecture ensures consistency with existing BCPs while accommodating email-specific requirements such as template dependencies and content management.

## System Context

The Email BCP integrates with:
- **HubSpot Email Marketing API v3**: Primary external dependency for all email operations
- **HubSpot Templates System**: Emails require templates - cannot create raw HTML emails
- **Core Infrastructure**: Extends HubspotBaseService and follows established patterns
- **MCP Server**: Registers tools through the standard BCP registration mechanism
- **Authentication System**: Uses private app access tokens via HUBSPOT_ACCESS_TOKEN

## Component Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Server                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Email BCP                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │create.tool  │  │  get.tool   │  │update.tool  │      │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │   │
│  │         │                │                 │              │   │
│  │  ┌──────┴────────────────┴─────────────────┴──────┐      │   │
│  │  │               EmailsService                     │      │   │
│  │  │  - createEmail()    - getEmail()               │      │   │
│  │  │  - updateEmail()    - deleteEmail()            │      │   │
│  │  │  - listEmails()     - getRecentEmails()        │      │   │
│  │  └─────────────────────┬───────────────────────┘      │   │
│  │                        │                              │   │
│  │  ┌─────────────────────┴───────────────────────┐      │   │
│  │  │           HubspotBaseService                │      │   │
│  │  └─────────────────────┬───────────────────────┘      │   │
│  └────────────────────────┼─────────────────────────────┘   │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  HubSpot API Client  │
                 └──────────────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ HubSpot Email API v3 │
                 └──────────────────────┘
```

### Service Class Structure

The `EmailsService` class extends `HubspotBaseService` and implements:

```typescript
export class EmailsService extends HubspotBaseService {
  // Core CRUD Operations
  async createEmail(properties: EmailCreateInput): Promise<Email>
  async getEmail(id: string): Promise<Email>
  async updateEmail(id: string, properties: EmailUpdateInput): Promise<Email>
  async deleteEmail(id: string): Promise<void>
  
  // List Operations
  async listEmails(filters?: EmailFilters): Promise<EmailsPage>
  async getRecentEmails(limit?: number): Promise<EmailsPage>
  
  // Helper Methods
  private transformHubSpotObjectToEmail(object: any): Email
  private formatEmailProperties(input: EmailCreateInput | EmailUpdateInput): Record<string, string>
}
```

### Tool Definitions

Each tool follows the standard pattern with Zod schema validation:

1. **create.tool.ts**: Creates new marketing emails (requires templateId)
2. **get.tool.ts**: Retrieves email by ID with full properties
3. **update.tool.ts**: Updates email properties (partial updates supported)
4. **delete.tool.ts**: Archives/deletes an email
5. **list.tool.ts**: Lists emails with filtering and pagination
6. **recent.tool.ts**: Gets recently created/modified emails

## Data Architecture

### TypeScript Interfaces

```typescript
// Core Email object returned by API
export interface Email {
  id: string;
  name: string;
  subject: string;
  state: EmailState;
  type: EmailType;
  templateId: string;
  from?: EmailSender;
  replyTo?: string;
  content?: EmailContent;
  metadata: EmailMetadata;
}

// Email states
export type EmailState = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';

// Email types
export type EmailType = 'REGULAR' | 'AUTOMATED' | 'AB_TEST' | 'FOLLOW_UP';

// Sender information
export interface EmailSender {
  name?: string;
  email: string;
}

// Email content (when fetched with content expansion)
export interface EmailContent {
  htmlBody?: string;
  plainTextBody?: string;
  previewText?: string;
}

// Metadata and timestamps
export interface EmailMetadata {
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  archivedAt?: string;
  archived: boolean;
  folderId?: string;
  campaignId?: string;
  [key: string]: any; // Additional properties
}

// Input types for create/update
export interface EmailCreateInput {
  name: string;              // Required: Internal name
  templateId: string;        // Required: Template to use
  subject?: string;          // Email subject line
  from?: EmailSender;        // Sender details
  replyTo?: string;          // Reply-to address
  previewText?: string;      // Preview text
  folderId?: string;         // Folder for organization
  metadata?: Record<string, any>;
}

export interface EmailUpdateInput {
  name?: string;
  subject?: string;
  from?: EmailSender;
  replyTo?: string;
  previewText?: string;
  state?: EmailState;
  metadata?: Record<string, any>;
}

// Filtering and pagination
export interface EmailFilters {
  state?: EmailState;
  type?: EmailType;
  folderId?: string;
  campaignId?: string;
  createdAfter?: string | Date;
  createdBefore?: string | Date;
  query?: string;           // Text search in name/subject
  limit?: number;           // Default: 10, Max: 100
  after?: string;           // Pagination cursor
}

export interface EmailsPage {
  results: Email[];
  pagination?: {
    after?: string;
  };
  total: number;
}
```

## API Specifications

### Endpoint Mappings

| Operation | HTTP Method | Endpoint | Tool Name |
|-----------|-------------|----------|-----------|
| Create Email | POST | `/marketing/v3/emails/` | createEmail |
| Get Email | GET | `/marketing/v3/emails/{emailId}` | getEmail |
| Update Email | PATCH | `/marketing/v3/emails/{emailId}` | updateEmail |
| Delete Email | DELETE | `/marketing/v3/emails/{emailId}` | deleteEmail |
| List Emails | GET | `/marketing/v3/emails/` | listEmails |

### Input/Output Schemas (Zod)

```typescript
// Create Email Schema
const createEmailSchema = z.object({
  name: z.string().min(1).describe('Internal name for the email'),
  templateId: z.string().describe('ID of the template to use'),
  subject: z.string().optional().describe('Email subject line'),
  from: z.object({
    name: z.string().optional(),
    email: z.string().email()
  }).optional().describe('Sender information'),
  replyTo: z.string().email().optional().describe('Reply-to email address'),
  previewText: z.string().optional().describe('Preview text for email clients'),
  folderId: z.string().optional().describe('Folder ID for organization'),
  metadata: z.record(z.any()).optional().describe('Additional properties')
});

// Update Email Schema
const updateEmailSchema = z.object({
  name: z.string().optional(),
  subject: z.string().optional(),
  from: z.object({
    name: z.string().optional(),
    email: z.string().email()
  }).optional(),
  replyTo: z.string().email().optional(),
  previewText: z.string().optional(),
  state: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']).optional(),
  metadata: z.record(z.any()).optional()
});

// List Emails Schema
const listEmailsSchema = z.object({
  state: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']).optional(),
  type: z.enum(['REGULAR', 'AUTOMATED', 'AB_TEST', 'FOLLOW_UP']).optional(),
  folderId: z.string().optional(),
  campaignId: z.string().optional(),
  createdAfter: z.union([z.string(), z.date()]).optional(),
  createdBefore: z.union([z.string(), z.date()]).optional(),
  query: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(10),
  after: z.string().optional()
});
```

## Technology Decisions

1. **TypeScript**: Maintains type safety throughout the implementation
2. **Zod**: Runtime validation for all tool inputs ensuring data integrity
3. **@hubspot/api-client**: Official SDK for API interactions
4. **Existing Base Classes**: Leverage HubspotBaseService for consistency
5. **Error Handling**: Use BcpError for standardized error responses

## Security Architecture

### Authentication Flow
```
User → MCP Server → EmailsService → HubspotBaseService → API Client
                                                               ↓
                                                    HUBSPOT_ACCESS_TOKEN
```

### Security Measures
1. **Token Storage**: Access token stored in environment variables only
2. **Token Validation**: Verified during service initialization
3. **Input Sanitization**: All inputs validated through Zod schemas
4. **Error Masking**: Sensitive information removed from error messages
5. **Rate Limiting**: Respect HubSpot's rate limits with proper error handling

## Deployment Architecture

### File Structure
```
src/bcps/Emails/
├── index.ts                 # BCP export definition
├── emails.service.ts        # Core service implementation
├── emails.types.ts          # TypeScript interfaces
├── create.tool.ts           # Create email tool
├── get.tool.ts              # Get email tool
├── update.tool.ts           # Update email tool
├── delete.tool.ts           # Delete email tool
├── list.tool.ts             # List emails tool
├── recent.tool.ts           # Get recent emails tool
└── __tests__/
    └── emails.service.test.ts
```

### Integration Points
1. Register BCP in `src/core/server.ts` under `registerAllTools()`
2. Add `registerEmailsTools()` method following existing patterns
3. Export combined tool as `hubspotEmail` with operation parameter

## Implementation Guidelines

### Code Organization
1. **Service Layer**: All business logic in `EmailsService`
2. **Tool Layer**: Thin wrappers that validate input and call service methods
3. **Type Layer**: All interfaces in `emails.types.ts`
4. **Error Handling**: Consistent use of `BcpError` with proper error codes

### Example Implementation Pattern

```typescript
// Tool implementation pattern
export const tool: ToolDefinition = {
  name: 'createEmail',
  description: 'Create a new marketing email in HubSpot',
  inputSchema: createEmailSchema,
  handler: async (params) => {
    const config: ServiceConfig = {
      hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN || '',
    };
    
    const emailsService = new EmailsService(config);
    await emailsService.init();
    
    try {
      const result = await emailsService.createEmail(params);
      return {
        message: 'Email created successfully',
        email: result
      };
    } catch (error) {
      if (error instanceof BcpError) throw error;
      throw new BcpError(
        `Failed to create email: ${error.message}`,
        'API_ERROR',
        500
      );
    }
  }
};
```

### Service Method Pattern

```typescript
async createEmail(input: EmailCreateInput): Promise<Email> {
  this.checkInitialized();
  this.validateRequired(input, ['name', 'templateId']);
  
  const properties = this.formatEmailProperties(input);
  
  try {
    const response = await this.client.apiRequest({
      method: 'POST',
      path: '/marketing/v3/emails/',
      body: { properties }
    });
    
    return this.transformHubSpotObjectToEmail(response);
  } catch (error) {
    this.handleApiError(error, 'Failed to create email');
  }
}
```

## Risk Assessment

### Technical Risks
1. **API Version Changes**: v1 sunset October 2025 - mitigated by using v3
2. **Schema Uncertainty**: Some v3 properties undocumented - mitigate with defensive coding
3. **Template Dependency**: All emails require templates - validate templateId existence
4. **Rate Limiting**: Heavy usage may hit limits - implement exponential backoff

### Mitigation Strategies
1. **Comprehensive Testing**: Unit tests for all service methods
2. **Error Recovery**: Graceful handling of all error scenarios
3. **Documentation**: Clear inline documentation for future maintainers
4. **Monitoring**: Log all API interactions for debugging

## Special Considerations

### Email-Specific Features
1. **Template Requirements**: Cannot create emails without valid templateId
2. **State Management**: Handle transitions between DRAFT, PUBLISHED, etc.
3. **Content Rendering**: Email content may need special handling for HTML/text
4. **Campaign Integration**: Consider future integration with campaign management

### Excluded Features
1. **Email Sending**: Not included per requirements
2. **A/B Testing**: Management excluded from initial implementation
3. **Analytics**: Email performance metrics not included
4. **Scheduling**: Advanced scheduling features not included

## Next Steps

1. **Implementation Order**:
   - Create type definitions (`emails.types.ts`)
   - Implement service class (`emails.service.ts`)
   - Create individual tools (starting with `create.tool.ts`)
   - Add tests for each component
   - Register BCP in server

2. **Testing Strategy**:
   - Mock HubSpot API responses
   - Test error scenarios
   - Validate input/output transformations
   - Integration tests with actual API (staging)

3. **Documentation**:
   - Update README with Email BCP usage
   - Add JSDoc comments to all public methods
   - Create example usage scenarios

This architecture provides a robust foundation for the Email BCP implementation while maintaining consistency with the existing codebase patterns and accommodating email-specific requirements.