/**
 * Location: /src/bcps/Emails/emails.types.ts
 * 
 * TypeScript interfaces and type definitions for the Email BCP.
 * Defines the data structures for HubSpot Email Marketing API v3 operations.
 * 
 * Used by:
 * - emails.service.ts: Service class uses these types for method signatures and return values
 * - *.tool.ts files: Tools use these interfaces for input validation and response formatting
 * - index.ts: BCP definition imports these types for tool registration
 */

/**
 * Email states as defined by HubSpot Email Marketing API v3
 */
export type EmailState = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';

/**
 * Email types supported by HubSpot
 */
export type EmailType = 'REGULAR' | 'AUTOMATED' | 'AB_TEST' | 'FOLLOW_UP';

/**
 * Sender information for an email
 */
export interface EmailSender {
  name?: string;
  email: string;
}

/**
 * Email content structure (when fetched with content expansion)
 */
export interface EmailContent {
  htmlBody?: string;
  plainTextBody?: string;
  previewText?: string;
}

/**
 * Email metadata and timestamps
 */
export interface EmailMetadata {
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  archivedAt?: string;
  archived: boolean;
  folderId?: string;
  campaignId?: string;
  [key: string]: any; // Additional properties from HubSpot
}

/**
 * Core Email object returned by HubSpot API
 */
export interface Email {
  id: string;
  name: string;
  subject: string;
  state: EmailState;
  type: EmailType;
  templateId?: string; // Optional since current implementation doesn't handle this properly
  from?: EmailSender;
  replyTo?: string;
  content?: EmailContent;
  metadata: EmailMetadata;
}

/**
 * Input interface for creating emails
 * Only name is required, all other properties are optional
 */
export interface EmailCreateInput {
  name: string;              // Required: Internal name for the email
  templateId?: string;       // Optional: Template ID (current implementation doesn't work properly)
  subject?: string;          // Email subject line
  from?: EmailSender;        // Sender information
  replyTo?: string;          // Reply-to email address
  previewText?: string;      // Preview text for email clients
  folderId?: string;         // Folder ID for organization
  metadata?: Record<string, any>; // Additional custom properties
}

/**
 * Input interface for updating emails
 * All properties are optional for partial updates
 */
export interface EmailUpdateInput {
  name?: string;
  subject?: string;
  from?: EmailSender;
  replyTo?: string;
  previewText?: string;
  state?: EmailState;
  metadata?: Record<string, any>;
}

/**
 * Filtering options for listing emails
 */
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

/**
 * Paginated response for email listings
 */
export interface EmailsPage {
  results: Email[];
  pagination?: {
    after?: string;
  };
  total: number;
}

/**
 * Service response for individual email operations
 */
export interface EmailResponse extends Email {}

/**
 * Properties input that can be undefined (for internal processing)
 */
export interface EmailPropertiesInput {
  name: string;
  templateId: string;
  subject?: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  preview_text?: string;
  folder_id?: string;
  [key: string]: string | undefined;
}

/**
 * Properties formatted for HubSpot API (all strings)
 */
export interface EmailProperties {
  name: string;
  templateId: string;
  subject: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  preview_text: string;
  folder_id: string;
  [key: string]: string;
}