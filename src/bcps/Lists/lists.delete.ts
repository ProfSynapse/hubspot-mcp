/**
 * Delete List Tool
 *
 * Deletes (archives) a list in HubSpot (recoverable for 90 days)
 * Part of the Lists BCP
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { ListsService } from './lists.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for delete list tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    listId: {
      type: 'string',
      description: 'List ID to delete (required)'
    }
  },
  required: ['listId']
};

/**
 * Delete list tool definition
 */
export const tool: ToolDefinition = {
  name: 'delete',
  description: 'Delete (archive) a HubSpot list (recoverable for 90 days)',
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
      await listsService.deleteList(params.listId);

      const response = {
        success: true,
        message: `List deleted successfully. List can be restored within 90 days.`
      };

      return enhanceResponse(response, 'delete', params, 'Lists');
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to delete list: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};
