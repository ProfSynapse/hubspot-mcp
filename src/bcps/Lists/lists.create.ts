/**
 * Create List Tool
 *
 * Creates new HubSpot lists supporting MANUAL, DYNAMIC, and SNAPSHOT types
 * Part of the Lists BCP
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { ListsService } from './lists.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for create list tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'List name (required)'
    },
    objectTypeId: {
      type: 'string',
      enum: ['0-1', '0-2', '0-3', '0-5'],
      description: 'Object type: 0-1=Contacts, 0-2=Companies, 0-3=Deals, 0-5=Tickets'
    },
    processingType: {
      type: 'string',
      enum: ['MANUAL', 'DYNAMIC', 'SNAPSHOT'],
      description: 'List processing type: MANUAL (static), DYNAMIC (auto-updating), SNAPSHOT (initially filtered then manual)'
    },
    filterBranch: {
      type: 'object',
      description: 'Filter definition (required for DYNAMIC and SNAPSHOT lists)',
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
      }
    }
  },
  required: ['name', 'objectTypeId', 'processingType']
};

/**
 * Create list tool definition
 */
export const tool: ToolDefinition = {
  name: 'create',
  description: 'Create a new HubSpot list (MANUAL, DYNAMIC, or SNAPSHOT)',
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
      const result = await listsService.createList(params);

      const response = {
        success: true,
        data: result,
        message: `List created successfully: ${result.name} (${result.processingType})`
      };

      return enhanceResponse(response, 'create', params, 'Lists');
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to create list: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};
