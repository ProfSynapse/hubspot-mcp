/**
 * Get Members Tool
 *
 * Retrieves list members with pagination
 * Part of the Lists BCP
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { ListsService } from './lists.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for get members tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    listId: {
      type: 'string',
      description: 'List ID to get members from (required)'
    },
    limit: {
      type: 'number',
      description: 'Maximum number of members to return (default: 100, max: 500)'
    },
    after: {
      type: 'string',
      description: 'Pagination cursor for next page'
    }
  },
  required: ['listId']
};

/**
 * Get members tool definition
 */
export const tool: ToolDefinition = {
  name: 'getMembers',
  description: 'Get list members with pagination',
  inputSchema,
  handler: async (params) => {
    const tempConfig: ServiceConfig = {
      hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN || '',
    };

    if (!tempConfig.hubspotAccessToken) {
      throw new BcpError(
        'HubSpot access token is missing. Please ensure HUBSPOT_ACCESS_TOKEN is set.',
        'AUTH_ERROR',
        401
      );
    }

    const listsService = new ListsService(tempConfig);
    await listsService.init();

    try {
      const result = await listsService.getMembers(params.listId, {
        limit: params.limit,
        after: params.after
      });

      const response = {
        success: true,
        data: result,
        message: `Retrieved ${result.members.length} members`
      };

      return enhanceResponse(response, 'getMembers', params, 'Lists');
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to get members: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};
