/**
 * Search Lists Tool
 *
 * Searches HubSpot lists with optional filters and pagination
 * Part of the Lists BCP
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { ListsService } from './lists.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for search lists tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  required: [],
  properties: {
    query: {
      type: 'string',
      description: 'Search query for list names'
    },
    processingTypes: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['MANUAL', 'DYNAMIC', 'SNAPSHOT']
      },
      description: 'Filter by processing types'
    },
    includeFilters: {
      type: 'boolean',
      description: 'Include filter definitions in results (default: true)'
    },
    count: {
      type: 'number',
      description: 'Results per page (default: 50, max: 100)'
    },
    offset: {
      type: 'number',
      description: 'Pagination offset'
    },
    listIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'Specific list IDs to retrieve'
    }
  }
};

/**
 * Search lists tool definition
 */
export const tool: ToolDefinition = {
  name: 'search',
  description: 'Search HubSpot lists with filters and pagination',
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
      const result = await listsService.searchLists(params);

      const response = {
        success: true,
        data: result,
        message: `Found ${result.total} lists`
      };

      return enhanceResponse(response, 'search', params, 'Lists');
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to search lists: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};
