/**
 * Location: /src/bcps/Emails/list.tool.ts
 * 
 * List Emails Tool - Lists marketing emails with filtering and pagination support.
 * Part of the Email BCP that handles email listing operations.
 * 
 * Used by:
 * - index.ts: Exported as part of the Email BCP tools array
 * - server.ts: Registered as part of hubspotEmail tool with 'list' operation
 * 
 * How it works with other files:
 * - Uses EmailsService from ./emails.service.ts to perform the actual API call
 * - Imports types from ./emails.types.ts for type safety
 * - Follows the same pattern as other BCP list tools
 */

import { ToolDefinition, InputSchema, ServiceConfig, BcpError } from '../../core/types.js';
import { EmailsService } from './emails.service.js';
import { EmailFilters } from './emails.types.js';

/**
 * Input schema for list emails tool
 * All parameters are optional for flexible filtering
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    state: {
      type: 'string',
      description: 'Filter by email state',
      enum: ['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']
    },
    type: {
      type: 'string',
      description: 'Filter by email type',
      enum: ['REGULAR', 'AUTOMATED', 'AB_TEST', 'FOLLOW_UP']
    },
    folderId: {
      type: 'string',
      description: 'Filter by folder ID'
    },
    campaignId: {
      type: 'string',
      description: 'Filter by campaign ID'
    },
    createdAfter: {
      type: 'string',
      description: 'Filter emails created after this date (ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ)'
    },
    createdBefore: {
      type: 'string',
      description: 'Filter emails created before this date (ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ)'
    },
    query: {
      type: 'string',
      description: 'Text search query for email names and subjects'
    },
    limit: {
      type: 'number',
      description: 'Maximum number of emails to return (1-100)',
      minimum: 1,
      maximum: 100,
      default: 10
    },
    after: {
      type: 'string',
      description: 'Pagination cursor for retrieving the next page of results'
    }
  },
  required: []
};

/**
 * List emails tool definition
 */
export const tool: ToolDefinition = {
  name: 'list',
  description: 'List marketing emails from HubSpot with optional filtering by state, type, dates, and text search. Supports pagination.',
  inputSchema,
  handler: async (params: EmailFilters) => {
    const config: ServiceConfig = {
      hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN || '',
    };

    const emailsService = new EmailsService(config);
    await emailsService.init();

    try {
      // Validate date formats if provided
      if (params.createdAfter) {
        const afterDate = new Date(params.createdAfter);
        if (isNaN(afterDate.getTime())) {
          throw new BcpError(
            'createdAfter must be a valid ISO 8601 date format',
            'VALIDATION_ERROR',
            400
          );
        }
      }
      
      if (params.createdBefore) {
        const beforeDate = new Date(params.createdBefore);
        if (isNaN(beforeDate.getTime())) {
          throw new BcpError(
            'createdBefore must be a valid ISO 8601 date format',
            'VALIDATION_ERROR',
            400
          );
        }
      }

      // Validate limit range
      if (params.limit && (params.limit < 1 || params.limit > 100)) {
        throw new BcpError(
          'Limit must be between 1 and 100',
          'VALIDATION_ERROR',
          400
        );
      }

      const result = await emailsService.listEmails(params);
      
      return {
        message: `Found ${result.results.length} emails`,
        emails: result.results,
        total: result.total,
        pagination: result.pagination,
        filters: {
          state: params.state,
          type: params.type,
          folderId: params.folderId,
          campaignId: params.campaignId,
          createdAfter: params.createdAfter,
          createdBefore: params.createdBefore,
          query: params.query,
          limit: params.limit || 10
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const message = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to list emails: ${message}`,
        'API_ERROR',
        500
      );
    }
  }
};