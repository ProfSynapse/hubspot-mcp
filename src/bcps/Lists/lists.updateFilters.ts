/**
 * Update Filters Tool
 *
 * Updates filter definitions for DYNAMIC lists
 * Part of the Lists BCP
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { ListsService } from './lists.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for update filters tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    listId: {
      type: 'string',
      description: 'List ID to update filters for (required, must be DYNAMIC list)'
    },
    filterBranch: {
      type: 'object',
      description: 'New filter branch structure (required)',
      properties: {
        filterBranchType: {
          type: 'string',
          enum: ['OR'],
          description: 'Must be OR for root branch'
        },
        filterBranches: {
          type: 'array',
          items: { type: 'object' },
          description: 'Child AND branches containing filters'
        },
        filters: {
          type: 'array',
          items: { type: 'object' },
          description: 'Must be empty array for root OR branch'
        }
      },
      required: ['filterBranchType', 'filterBranches', 'filters']
    }
  },
  required: ['listId', 'filterBranch']
};

/**
 * Update filters tool definition
 */
export const tool: ToolDefinition = {
  name: 'updateFilters',
  description: 'Update filter definitions for a DYNAMIC list (DYNAMIC lists only)',
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
      const result = await listsService.updateListFilters(params.listId, params.filterBranch);

      const response = {
        success: true,
        data: result,
        message: `Filters updated successfully for list: ${result.name}`
      };

      return enhanceResponse(response, 'updateFilters', params, 'Lists');
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to update filters: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};
