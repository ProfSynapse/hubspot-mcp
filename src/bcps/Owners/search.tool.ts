/**
 * Search Owners Tool
 *
 * Provides functionality to search owners by email in HubSpot.
 * Part of the Owners BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { OwnersService } from './owners.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      description: 'Email address to search for (partial matches supported)',
    },
  },
  required: ['email'],
  examples: [
    {
      email: 'john@company.com'
    },
    {
      email: 'john'
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'searchOwners',
  description: 'Search for owners by email address in HubSpot',
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
      const { email } = params;
      const result = await ownersService.searchOwnersByEmail(email);

      return {
        message: `Found ${result.results.length} owners matching email: ${email}`,
        owners: result.results,
        total: result.total,
        usage: {
          instruction: "Use the 'id' field from the results as the ownerId when creating or updating notes"
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to search owners: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};