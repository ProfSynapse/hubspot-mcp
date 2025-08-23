import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { PropertiesService } from './properties.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    objectType: {
      type: 'string',
      description: 'The HubSpot object type to get property groups for (contacts, companies, deals, tickets, etc.)'
    }
  },
  required: ['objectType'],
  examples: [{
    objectType: 'contacts'
  }, {
    objectType: 'companies'
  }]
};

export const tool: ToolDefinition = {
  name: 'listPropertyGroups',
  description: 'Get all property groups for a specific HubSpot object type',
  inputSchema,
  handler: async (params) => {
    const tempConfig: ServiceConfig = {
      hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN || '',
    };

    if (!tempConfig.hubspotAccessToken) {
      throw new BcpError('HubSpot access token is missing', 'AUTH_ERROR', 401);
    }

    const service = new PropertiesService(tempConfig);
    await service.init();

    try {
      const groups = await service.getPropertyGroups(params.objectType);
      return {
        message: `Found ${groups.length} property groups for ${params.objectType}`,
        propertyGroups: groups,
        details: {
          objectType: params.objectType,
          count: groups.length,
          groupNames: groups.map(g => g.name).slice(0, 10)
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      throw new BcpError(
        `Failed to list property groups for ${params.objectType}: ${error instanceof Error ? error.message : String(error)}`,
        'API_ERROR',
        500
      );
    }
  }
};