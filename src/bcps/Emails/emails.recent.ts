/**
 * Location: /src/bcps/Emails/recent.tool.ts
 * 
 * Recent Emails Tool - Retrieves recently created or modified marketing emails.
 * Part of the Email BCP that handles recent email retrieval operations.
 * 
 * Used by:
 * - index.ts: Exported as part of the Email BCP tools array
 * - server.ts: Registered as part of hubspotEmail tool with 'recent' operation
 * 
 * How it works with other files:
 * - Uses EmailsService from ./emails.service.ts to perform the actual API call
 * - Imports types from ./emails.types.ts for type safety
 * - Follows the same pattern as other BCP recent tools
 */

import { ToolDefinition, InputSchema, ServiceConfig, BcpError } from '../../core/types.js';
import { EmailsService } from './emails.service.js';

/**
 * Input schema for recent emails tool
 * Only limit parameter which is optional
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'number',
      description: 'Maximum number of recent emails to return (1-100)',
      minimum: 1,
      maximum: 100,
      default: 10
    }
  },
  required: []
};

/**
 * Recent emails tool definition
 */
export const tool: ToolDefinition = {
  name: 'recent',
  description: 'Get recently created or modified marketing emails from HubSpot, sorted by update date (most recent first).',
  inputSchema,
  handler: async (params: { limit?: number }) => {
    const config: ServiceConfig = {
      hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN || '',
    };

    const emailsService = new EmailsService(config);
    await emailsService.init();

    try {
      // Validate limit parameter
      const limit = params.limit || 10;
      if (limit < 1 || limit > 100) {
        throw new BcpError(
          'Limit must be between 1 and 100',
          'VALIDATION_ERROR',
          400
        );
      }

      const result = await emailsService.getRecentEmails(limit);
      
      return {
        message: `Found ${result.results.length} recent emails`,
        emails: result.results,
        total: result.total,
        pagination: result.pagination,
        limit: limit
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const message = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to get recent emails: ${message}`,
        'API_ERROR',
        500
      );
    }
  }
};