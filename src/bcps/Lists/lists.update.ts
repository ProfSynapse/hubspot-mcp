/**
 * Update List Tool
 *
 * Updates a list name in HubSpot
 * Part of the Lists BCP
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { ListsService } from './lists.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for update list tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    listId: {
      type: 'string',
      description: 'List ID to update (required)'
    },
    name: {
      type: 'string',
      description: 'New list name (required)'
    }
  },
  required: ['listId', 'name']
};

/**
 * Update list tool definition
 */
export const tool: ToolDefinition = {
  name: 'update',
  description: 'Update a HubSpot list name',
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
      const result = await listsService.updateListName(params.listId, params.name);

      const response = {
        success: true,
        data: result,
        message: `List updated successfully: ${result.name}`
      };

      return enhanceResponse(response, 'update', params, 'Lists');
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to update list: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};
