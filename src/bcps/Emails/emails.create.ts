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
import { enhanceResponse } from '../../core/response-enhancer.js';

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
      description: 'ID of the template to use for email creation (required for HubSpot v3 API - you MUST use a template)'
    },
    campaignId: {
      type: 'string',
      description: 'Campaign ID to associate with the email (optional)'
    },
    type: {
      type: 'string',
      description: 'Email type - will be auto-assigned as BATCH_EMAIL by HubSpot if not specified',
      enum: ['BATCH_EMAIL', 'AUTOMATED_EMAIL', 'BLOG_EMAIL', 'RSS_EMAIL', 'LEADNURTURING_EMAIL']
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
  required: ['name', 'templateId']
};

/**
 * Create email tool definition
 */
export const tool: ToolDefinition = {
  name: 'create',
  description: 'Create a new marketing email in HubSpot. Template ID is required for v3 API. Campaign ID and type parameters are supported. Does not include email sending functionality.',
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
      
      if (!params.templateId) {
        throw new BcpError('Template ID is required for email creation in HubSpot v3 API', 'VALIDATION_ERROR', 400);
      }

      const result = await emailsService.createEmail(params);
      
      const response = {
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
      
      return enhanceResponse(response, 'create', params, 'Emails');
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const message = error instanceof Error ? error.message : String(error);
      const errorResponse = {
        message: 'Failed to create email',
        error: message
      };
      
      return enhanceResponse(
        errorResponse,
        'create',
        params,
        'Emails',
        error instanceof Error ? error : undefined
      );
    }
  }
};