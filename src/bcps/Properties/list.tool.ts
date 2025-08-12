import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { PropertiesService } from './properties.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    objectType: {
      type: 'string',
      description: 'The HubSpot object type to get properties for (contacts, companies, deals, tickets, etc.)'
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
  name: 'listProperties',
  description: 'Get all properties for a specific HubSpot object type',
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
      const properties = await service.getProperties(params.objectType);
      return {
        message: `Found ${properties.length} properties for ${params.objectType}`,
        properties,
        details: {
          objectType: params.objectType,
          count: properties.length,
          propertyNames: properties.map(p => p.name).slice(0, 10)
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      throw new BcpError(
        `Failed to list properties for ${params.objectType}: ${error instanceof Error ? error.message : String(error)}`,
        'API_ERROR',
        500
      );
    }
  }
};