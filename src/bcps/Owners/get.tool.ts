/**
 * Get Owner Tool
 *
 * Provides functionality to get a specific owner by ID in HubSpot.
 * Part of the Owners BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { OwnersService } from './owners.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    ownerId: {
      type: 'string',
      description: 'The ID of the owner to retrieve',
    },
  },
  required: ['ownerId'],
  examples: [
    {
      ownerId: '12345'
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'getOwner',
  description: 'Get a specific owner by their ID from HubSpot',
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
      const { ownerId } = params;
      const owner = await ownersService.getOwner(ownerId);

      return {
        message: 'Owner retrieved successfully',
        owner,
        usage: {
          instruction: "This owner ID can be used as the ownerId when creating or updating notes"
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to get owner: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};