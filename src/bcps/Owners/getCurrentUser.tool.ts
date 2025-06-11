/**
 * Get Current User Tool
 *
 * Provides functionality to get the current user information from HubSpot.
 * Part of the Owners BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { OwnersService } from './owners.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {},
  required: [],
  examples: [{}]
};

export const tool: ToolDefinition = {
  name: 'getCurrentUser',
  description: 'Get the current user information from HubSpot (useful when you need an owner ID)',
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
      const user = await ownersService.getCurrentUser();

      return {
        message: 'Current user retrieved successfully',
        user,
        usage: {
          instruction: "Use the 'id' field from this user as the ownerId when creating or updating notes"
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to get current user: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};