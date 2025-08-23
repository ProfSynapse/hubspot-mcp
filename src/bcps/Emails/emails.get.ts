/**
 * Location: /src/bcps/Emails/get.tool.ts
 * 
 * Get Email Tool - Retrieves individual marketing emails by ID from HubSpot.
 * Part of the Email BCP that handles email retrieval operations.
 * 
 * Used by:
 * - index.ts: Exported as part of the Email BCP tools array
 * - server.ts: Registered as part of hubspotEmail tool with 'get' operation
 * 
 * How it works with other files:
 * - Uses EmailsService from ./emails.service.ts to perform the actual API call
 * - Imports types from ./emails.types.ts for type safety
 * - Follows the same pattern as other BCP get tools
 */

import { ToolDefinition, InputSchema, ServiceConfig, BcpError } from '../../core/types.js';
import { EmailsService } from './emails.service.js';

/**
 * Input schema for get email tool
 * Requires email ID parameter
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'The HubSpot email ID to retrieve',
      minLength: 1
    }
  },
  required: ['id']
};

/**
 * Get email tool definition
 */
export const tool: ToolDefinition = {
  name: 'get',
  description: 'Retrieve a marketing email by its ID from HubSpot',
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

      const result = await emailsService.getEmail(params.id);
      
      return {
        message: 'Email retrieved successfully',
        email: result
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
        `Failed to get email: ${message}`,
        'API_ERROR',
        500
      );
    }
  }
};