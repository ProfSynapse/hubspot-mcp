/**
 * Remove Members Tool
 *
 * Removes records from a MANUAL or SNAPSHOT list
 * Part of the Lists BCP
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { ListsService } from './lists.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for remove members tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    listId: {
      type: 'string',
      description: 'List ID to remove members from (required)'
    },
    recordIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of record IDs to remove (required, max 100,000)'
    }
  },
  required: ['listId', 'recordIds']
};

/**
 * Remove members tool definition
 */
export const tool: ToolDefinition = {
  name: 'removeMembers',
  description: 'Remove records from a MANUAL or SNAPSHOT list (cannot remove from DYNAMIC lists)',
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
      const result = await listsService.removeMembers(params.listId, params.recordIds);

      const response = {
        success: true,
        data: result,
        message: `Successfully removed ${result.recordsRemoved} records from list`
      };

      return enhanceResponse(response, 'removeMembers', params, 'Lists');
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to remove members: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};
