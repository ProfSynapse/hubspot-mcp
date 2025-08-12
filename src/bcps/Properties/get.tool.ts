import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { PropertiesService } from './properties.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    objectType: {
      type: 'string',
      description: 'The HubSpot object type (contacts, companies, deals, tickets, etc.)'
    },
    propertyName: {
      type: 'string',
      description: 'The name of the property to retrieve'
    }
  },
  required: ['objectType', 'propertyName'],
  examples: [{
    objectType: 'contacts',
    propertyName: 'email'
  }, {
    objectType: 'companies',
    propertyName: 'name'
  }]
};

export const tool: ToolDefinition = {
  name: 'getProperty',
  description: 'Get details of a specific property for a HubSpot object type',
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
      const property = await service.getProperty(params.objectType, params.propertyName);
      return {
        message: `Retrieved property ${params.propertyName} for ${params.objectType}`,
        property,
        details: {
          objectType: params.objectType,
          propertyName: params.propertyName,
          type: property.type,
          fieldType: property.fieldType,
          label: property.label
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      throw new BcpError(
        `Failed to get property ${params.propertyName} for ${params.objectType}: ${error instanceof Error ? error.message : String(error)}`,
        'API_ERROR',
        500
      );
    }
  }
};