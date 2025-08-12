/**
 * Location: /src/bcps/Emails/update.tool.ts
 * 
 * Update Email Tool - Updates existing marketing emails in HubSpot.
 * Part of the Email BCP that handles email update operations.
 * 
 * Used by:
 * - index.ts: Exported as part of the Email BCP tools array
 * - server.ts: Registered as part of hubspotEmail tool with 'update' operation
 * 
 * How it works with other files:
 * - Uses EmailsService from ./emails.service.ts to perform the actual API call
 * - Imports types from ./emails.types.ts for type safety
 * - Follows the same pattern as other BCP update tools
 */

import { ToolDefinition, InputSchema, ServiceConfig, BcpError } from '../../core/types.js';
import { EmailsService } from './emails.service.js';
import { EmailUpdateInput } from './emails.types.js';

/**
 * Input schema for update email tool
 * Requires email ID and allows partial updates to email properties
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'The HubSpot email ID to update (required)',
      minLength: 1
    },
    name: {
      type: 'string',
      description: 'Internal name for the email'
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
    state: {
      type: 'string',
      description: 'Email state',
      enum: ['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']
    },
    metadata: {
      type: 'object',
      description: 'Additional custom properties for the email',
      properties: {}
    }
  },
  required: ['id']
};

/**
 * Update email tool definition
 */
export const tool: ToolDefinition = {
  name: 'update',
  description: 'Update an existing marketing email in HubSpot. Supports partial updates - only provided fields will be modified.',
  inputSchema,
  handler: async (params: { id: string } & EmailUpdateInput) => {
    const config: ServiceConfig = {
      hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN || '',
    };

    const emailsService = new EmailsService(config);
    await emailsService.init();

    try {
      // Validate required parameter
      if (!params.id) {
        throw new BcpError('Email ID is required', 'VALIDATION_ERROR', 400);
      }

      // Extract update properties (excluding id)
      const { id, ...updateProperties } = params;
      
      // Check if at least one property to update is provided
      const hasUpdateProperties = Object.keys(updateProperties).some(key => 
        updateProperties[key as keyof EmailUpdateInput] !== undefined
      );
      
      if (!hasUpdateProperties) {
        throw new BcpError(
          'At least one property to update must be provided',
          'VALIDATION_ERROR',
          400
        );
      }

      const result = await emailsService.updateEmail(id, updateProperties);
      
      return {
        message: 'Email updated successfully',
        email: {
          id: result.id,
          name: result.name,
          subject: result.subject,
          state: result.state,
          type: result.type,
          templateId: result.templateId,
          updatedAt: result.metadata.updatedAt
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const message = error instanceof Error ? error.message : String(error);
      
      // Handle specific API error cases
      if (message.includes('404') || message.includes('not found')) {
        throw new BcpError(
          `Email with ID ${params.id} not found`,
          'NOT_FOUND',
          404
        );
      }
      
      throw new BcpError(
        `Failed to update email: ${message}`,
        'API_ERROR',
        500
      );
    }
  }
};