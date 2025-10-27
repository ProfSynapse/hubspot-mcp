/**
 * Get List Tool
 *
 * Retrieves a list by ID from HubSpot
 * Part of the Lists BCP
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { ListsService } from './lists.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for get list tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    listId: {
      type: 'string',
      description: 'List ID to retrieve (required)'
    },
    includeFilters: {
      type: 'boolean',
      description: 'Whether to include filter definitions (default: true)'
    }
  },
  required: ['listId']
};

/**
 * Get list tool definition
 */
export const tool: ToolDefinition = {
  name: 'get',
  description: 'Retrieve a HubSpot list by ID',
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
      const result = await listsService.getList(
        params.listId,
        params.includeFilters !== false
      );

      const response = {
        success: true,
        data: result,
        message: `List retrieved successfully: ${result.name}`
      };

      return enhanceResponse(response, 'get', params, 'Lists');
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to get list: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};
