/**
 * Location: /src/bcps/Emails/delete.tool.ts
 * 
 * Delete Email Tool - Deletes (archives) marketing emails in HubSpot.
 * Part of the Email BCP that handles email deletion operations.
 * 
 * Used by:
 * - index.ts: Exported as part of the Email BCP tools array
 * - server.ts: Registered as part of hubspotEmail tool with 'delete' operation
 * 
 * How it works with other files:
 * - Uses EmailsService from ./emails.service.ts to perform the actual API call
 * - Imports types from ./emails.types.ts for type safety
 * - Follows the same pattern as other BCP delete tools
 */

import { ToolDefinition, InputSchema, ServiceConfig, BcpError } from '../../core/types.js';
import { EmailsService } from './emails.service.js';

/**
 * Input schema for delete email tool
 * Requires email ID parameter
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'The HubSpot email ID to delete (archive)',
      minLength: 1
    }
  },
  required: ['id']
};

/**
 * Delete email tool definition
 */
export const tool: ToolDefinition = {
  name: 'delete',
  description: 'Delete (archive) a marketing email in HubSpot. Note: This archives the email rather than permanently deleting it.',
  inputSchema,
  handler: async (params: { id: string }) => {
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

      await emailsService.deleteEmail(params.id);
      
      return {
        message: `Email ${params.id} deleted (archived) successfully`,
        id: params.id,
        status: 'deleted'
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
        `Failed to delete email: ${message}`,
        'API_ERROR',
        500
      );
    }
  }
};