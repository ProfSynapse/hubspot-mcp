/**
 * Add Members Tool
 *
 * Adds records to a MANUAL or SNAPSHOT list
 * Part of the Lists BCP
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { ListsService } from './lists.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for add members tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    listId: {
      type: 'string',
      description: 'List ID to add members to (required)'
    },
    recordIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of record IDs to add (required, max 100,000)'
    }
  },
  required: ['listId', 'recordIds']
};

/**
 * Add members tool definition
 */
export const tool: ToolDefinition = {
  name: 'addMembers',
  description: 'Add records to a MANUAL or SNAPSHOT list (cannot add to DYNAMIC lists)',
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
      const result = await listsService.addMembers(params.listId, params.recordIds);

      const response = {
        success: true,
        data: result,
        message: `Successfully added ${result.recordsAdded} records to list`
      };

      return enhanceResponse(response, 'addMembers', params, 'Lists');
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to add members: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};
