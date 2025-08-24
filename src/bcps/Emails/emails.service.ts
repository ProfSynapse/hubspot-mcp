/**
 * Location: /src/bcps/Emails/emails.service.ts
 * 
 * EmailsService class for handling HubSpot Email Marketing API v3 operations.
 * Extends HubspotBaseService to provide email-specific functionality including
 * CRUD operations for marketing emails (excluding sending functionality).
 * 
 * Used by:
 * - *.tool.ts files: Tools instantiate this service to perform API operations
 * - Follows the same pattern as CompaniesService, NotesService, etc.
 * 
 * How it works with other files:
 * - Extends HubspotBaseService from ../../core/base-service.ts for authentication and error handling
 * - Uses types from ./emails.types.ts for type safety
 * - Called by individual tool handlers to perform API operations
 */

import { HubspotBaseService } from '../../core/base-service.js';
import { BcpError } from '../../core/types.js';
import {
  Email,
  EmailCreateInput,
  EmailUpdateInput,
  EmailFilters,
  EmailsPage,
  EmailResponse,
  EmailPropertiesInput,
  EmailProperties
} from './emails.types.js';

export class EmailsService extends HubspotBaseService {
  
  /**
   * Create a new marketing email
   * @param input - Email creation properties
   * @returns Created email object
   */
  async createEmail(input: EmailCreateInput): Promise<EmailResponse> {
    this.checkInitialized();
    this.validateRequired(input, ['name']);

    try {
      // Format request body correctly for HubSpot Marketing Email API v3
      // Remove properties wrapper and place fields at root level
      const requestBody: any = {
        name: input.name,
        businessUnitId: "0", // Required field - using default business unit
      };

      // Add optional fields at root level if provided
      if (input.subject) {
        requestBody.subject = input.subject;
      }
      if (input.from?.name) {
        requestBody.fromName = input.from.name;
      }
      if (input.from?.email) {
        requestBody.fromEmail = input.from.email;
      }
      if (input.replyTo) {
        requestBody.replyTo = input.replyTo;
      }
      if (input.previewText) {
        requestBody.previewText = input.previewText;
      }
      if (input.folderId) {
        requestBody.folderId = input.folderId;
      }
      // Add required templateId and optional campaignId, type parameters
      if (input.templateId) {
        requestBody.templateId = input.templateId;
      }
      if ('campaignId' in input && input.campaignId) {
        requestBody.campaignId = input.campaignId;
      }
      if ('type' in input && input.type) {
        requestBody.type = input.type;
      }
      
      const response = await this.client.apiRequest({
        method: 'POST',
        path: '/marketing/v3/emails/',
        body: requestBody
      });

      const data = await response.json();
      return this.transformHubSpotObjectToEmail(data);
    } catch (error) {
      throw this.handleApiError(error, 'Failed to create email');
    }
  }

  /**
   * Get an email by ID
   * @param id - Email ID
   * @returns Email object
   */
  async getEmail(id: string): Promise<EmailResponse> {
    this.checkInitialized();
    this.validateRequired({ id }, ['id']);

    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/marketing/v3/emails/${id}`
      });

      const data = await response.json();
      return this.transformHubSpotObjectToEmail(data);
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get email');
    }
  }

  /**
   * Update an email
   * @param id - Email ID
   * @param input - Email update properties
   * @returns Updated email object
   */
  async updateEmail(id: string, input: EmailUpdateInput): Promise<EmailResponse> {
    this.checkInitialized();
    this.validateRequired({ id }, ['id']);

    try {
      // Format update properties directly at root level like create operation
      const requestBody: any = {};

      // Add fields at root level if provided (similar to create operation)
      if (input.name) {
        requestBody.name = input.name;
      }
      if (input.subject) {
        requestBody.subject = input.subject;
      }
      if (input.from?.name) {
        requestBody.fromName = input.from.name;
      }
      if (input.from?.email) {
        requestBody.fromEmail = input.from.email;
      }
      if (input.replyTo) {
        requestBody.replyTo = input.replyTo;
      }
      if (input.previewText) {
        requestBody.previewText = input.previewText;
      }
      if (input.state) {
        requestBody.state = input.state;
      }
      
      // Add any additional metadata properties at root level
      if (input.metadata) {
        Object.entries(input.metadata).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            requestBody[key] = String(value);
          }
        });
      }
      
      const response = await this.client.apiRequest({
        method: 'PATCH',
        path: `/marketing/v3/emails/${id}`,
        body: requestBody
      });

      const data = await response.json();
      return this.transformHubSpotObjectToEmail(data);
    } catch (error) {
      throw this.handleApiError(error, 'Failed to update email');
    }
  }

  /**
   * Delete (archive) an email
   * @param id - Email ID
   */
  async deleteEmail(id: string): Promise<void> {
    this.checkInitialized();
    this.validateRequired({ id }, ['id']);

    try {
      await this.client.apiRequest({
        method: 'DELETE',
        path: `/marketing/v3/emails/${id}`
      });
    } catch (error) {
      throw this.handleApiError(error, 'Failed to delete email');
    }
  }

  /**
   * List emails with optional filtering
   * @param filters - Filtering and pagination options
   * @returns Paginated list of emails
   */
  async listEmails(filters?: EmailFilters): Promise<EmailsPage> {
    this.checkInitialized();

    try {
      const queryParams = new URLSearchParams();
      
      if (filters?.state) {
        queryParams.append('state', filters.state);
      }
      if (filters?.type) {
        queryParams.append('type', filters.type);
      }
      if (filters?.folderId) {
        queryParams.append('folderId', filters.folderId);
      }
      if (filters?.campaignId) {
        queryParams.append('campaignId', filters.campaignId);
      }
      if (filters?.createdAfter) {
        const date = filters.createdAfter instanceof Date 
          ? filters.createdAfter.toISOString() 
          : filters.createdAfter;
        queryParams.append('createdAfter', date);
      }
      if (filters?.createdBefore) {
        const date = filters.createdBefore instanceof Date 
          ? filters.createdBefore.toISOString() 
          : filters.createdBefore;
        queryParams.append('createdBefore', date);
      }
      if (filters?.query) {
        queryParams.append('query', filters.query);
      }
      if (filters?.limit) {
        queryParams.append('limit', filters.limit.toString());
      }
      if (filters?.after) {
        queryParams.append('after', filters.after);
      }

      const query = queryParams.toString();
      const path = query ? `/marketing/v3/emails/?${query}` : '/marketing/v3/emails/';
      
      const response = await this.client.apiRequest({
        method: 'GET',
        path
      });

      const data = await response.json();
      return {
        results: data.results?.map((item: any) => this.transformHubSpotObjectToEmail(item)) || [],
        pagination: data.paging ? { after: data.paging.next?.after } : undefined,
        total: data.total || data.results?.length || 0
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to list emails');
    }
  }

  /**
   * Get recent emails
   * @param limit - Maximum number of emails to return (default: 10, max: 100)
   * @returns Paginated list of recent emails
   */
  async getRecentEmails(limit: number = 10): Promise<EmailsPage> {
    this.checkInitialized();

    if (limit < 1 || limit > 100) {
      throw new BcpError('Limit must be between 1 and 100', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/marketing/v3/emails/?limit=${limit}&sort=-updatedAt`
      });

      const data = await response.json();
      return {
        results: data.results?.map((item: any) => this.transformHubSpotObjectToEmail(item)) || [],
        pagination: data.paging ? { after: data.paging.next?.after } : undefined,
        total: data.total || data.results?.length || 0
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get recent emails');
    }
  }

  /**
   * Transform HubSpot API response to Email object
   * @param object - HubSpot API response object
   * @returns Transformed Email object
   */
  private transformHubSpotObjectToEmail(object: any): Email {
    // Handle both root-level and properties-wrapped responses
    const properties = object.properties || {};
    const rootData = object;
    
    return {
      id: rootData.id || object.id,
      name: rootData.name || properties.name || '',
      subject: rootData.subject || properties.subject || '',
      state: rootData.state || properties.state || 'DRAFT',
      type: rootData.type || properties.type || 'REGULAR',
      templateId: rootData.templateId || properties.templateId || properties.template_id || '',
      from: (rootData.fromEmail || properties.from_email) ? {
        name: rootData.fromName || properties.from_name,
        email: rootData.fromEmail || properties.from_email
      } : undefined,
      replyTo: rootData.replyTo || properties.reply_to || properties.replyTo,
      content: {
        htmlBody: rootData.htmlBody || properties.html_body || properties.htmlBody,
        plainTextBody: rootData.plainTextBody || properties.plain_text_body || properties.plainTextBody,
        previewText: rootData.previewText || properties.preview_text || properties.previewText
      },
      metadata: {
        createdAt: rootData.createdAt || object.createdAt || new Date().toISOString(),
        updatedAt: rootData.updatedAt || object.updatedAt || new Date().toISOString(),
        publishedAt: rootData.publishedAt || properties.published_at || properties.publishedAt,
        archivedAt: rootData.archivedAt || properties.archived_at || properties.archivedAt,
        archived: rootData.archived === 'true' || rootData.archived === true || properties.archived === 'true' || properties.archived === true || false,
        folderId: rootData.folderId || properties.folder_id || properties.folderId,
        campaignId: rootData.campaignId || properties.campaign_id || properties.campaignId,
        // Include any additional properties that aren't mapped above
        ...Object.keys(properties).reduce((acc, key) => {
          if (!['name', 'subject', 'state', 'type', 'templateId', 'template_id', 
                'from_name', 'from_email', 'reply_to', 'replyTo', 'preview_text', 
                'previewText', 'html_body', 'htmlBody', 'plain_text_body', 
                'plainTextBody', 'published_at', 'publishedAt', 'archived_at', 
                'archivedAt', 'archived', 'folder_id', 'folderId', 'campaign_id', 
                'campaignId'].includes(key)) {
            acc[key] = properties[key];
          }
          return acc;
        }, {} as Record<string, any>)
      }
    };
  }

  /**
   * Format email properties for HubSpot API
   * @param input - Email input properties
   * @returns Formatted properties object
   */
  private formatEmailProperties(input: EmailCreateInput | EmailUpdateInput): Record<string, string> {
    const properties: Record<string, string> = {};

    if ('name' in input && input.name) {
      properties.name = input.name;
    }
    if ('templateId' in input && input.templateId) {
      properties.templateId = input.templateId;
    }
    if (input.subject) {
      properties.subject = input.subject;
    }
    if (input.from?.name) {
      properties.from_name = input.from.name;
    }
    if (input.from?.email) {
      properties.from_email = input.from.email;
    }
    if (input.replyTo) {
      properties.reply_to = input.replyTo;
    }
    if (input.previewText) {
      properties.preview_text = input.previewText;
    }
    if ('state' in input && input.state) {
      properties.state = input.state;
    }
    if ('folderId' in input && input.folderId) {
      properties.folder_id = input.folderId;
    }

    // Add any additional metadata properties
    if (input.metadata) {
      Object.entries(input.metadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          properties[key] = String(value);
        }
      });
    }

    return properties;
  }
}