/**
 * List Owners Tool
 *
 * Provides functionality to list owners in HubSpot.
 * Part of the Owners BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { OwnersService } from './owners.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'number',
      description: 'Maximum number of owners to return (1-100, default: 100)',
      minimum: 1,
      maximum: 100,
      default: 100,
    },
    after: {
      type: 'string',
      description: 'Pagination cursor for the next page of results',
    },
  },
  required: [],
  examples: [
    {
      limit: 50
    },
    {
      limit: 10,
      after: "NTI1Cg%3D%3D"
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'listOwners',
  description: 'List all owners in the HubSpot account with their IDs, names, and email addresses',
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

    const ownersService = new OwnersService(tempConfig);
    await ownersService.init();

    try {
      const { limit = 100, after } = params;
      const result = await ownersService.listOwners(limit, after);

      return {
        message: `Found ${result.results.length} owners`,
        owners: result.results,
        pagination: result.pagination,
        total: result.total,
        usage: {
          instruction: "Use the 'id' field as the ownerId when creating or updating notes. For example, ownerId: '12345'"
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to list owners: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};