/**
 * Location: /src/bcps/Emails/create.tool.ts
 * 
 * Create Email Tool - Creates new marketing emails in HubSpot using Email Marketing API v3.
 * Part of the Email BCP that handles email creation operations.
 * 
 * Used by:
 * - index.ts: Exported as part of the Email BCP tools array
 * - server.ts: Registered as part of hubspotEmail tool with 'create' operation
 * 
 * How it works with other files:
 * - Uses EmailsService from ./emails.service.ts to perform the actual API call
 * - Imports types from ./emails.types.ts for type safety
 * - Follows the same pattern as other BCP create tools
 */

import { ToolDefinition, InputSchema, ServiceConfig, BcpError } from '../../core/types.js';
import { EmailsService } from './emails.service.js';
import { EmailCreateInput } from './emails.types.js';

/**
 * Input schema for create email tool
 * Validates required fields (name only) and optional properties
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Internal name for the email (required)',
      minLength: 1
    },
    templateId: {
      type: 'string',
      description: 'ID of the template to use for email creation (optional - current implementation does not work properly)'
    },
    subject: {
      type: 'string',
      description: 'Email subject line'
    },
    from: {
      type: 'object',
      description: 'Sender information',
      properties: {
        name: {
          type: 'string',
          description: 'Sender display name'
        },
        email: {
          type: 'string',
          description: 'Sender email address',
          pattern: '^[^@]+@[^@]+\\.[^@]+$'
        }
      },
      required: ['email']
    },
    replyTo: {
      type: 'string',
      description: 'Reply-to email address',
      pattern: '^[^@]+@[^@]+\\.[^@]+$'
    },
    previewText: {
      type: 'string',
      description: 'Preview text shown in email clients'
    },
    folderId: {
      type: 'string',
      description: 'Folder ID for organizing the email'
    },
    metadata: {
      type: 'object',
      description: 'Additional custom properties for the email',
      properties: {}
    }
  },
  required: ['name']
};

/**
 * Create email tool definition
 */
export const tool: ToolDefinition = {
  name: 'create',
  description: 'Create a new marketing email in HubSpot. Template ID is currently not working properly in the API. Does not include email sending functionality.',
  inputSchema,
  handler: async (params: EmailCreateInput) => {
    const config: ServiceConfig = {
      hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN || '',
    };

    const emailsService = new EmailsService(config);
    await emailsService.init();

    try {
      // Validate required parameters
      if (!params.name) {
        throw new BcpError('Email name is required', 'VALIDATION_ERROR', 400);
      }
      
      // Note: templateId is no longer required due to API issues

      const result = await emailsService.createEmail(params);
      
      return {
        message: 'Email created successfully',
        email: {
          id: result.id,
          name: result.name,
          subject: result.subject,
          state: result.state,
          type: result.type,
          templateId: result.templateId,
          createdAt: result.metadata.createdAt,
          updatedAt: result.metadata.updatedAt
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const message = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to create email: ${message}`,
        'API_ERROR',
        500
      );
    }
  }
};