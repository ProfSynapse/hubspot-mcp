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
      description: 'The name of the property to delete'
    }
  },
  required: ['objectType', 'propertyName'],
  examples: [{
    objectType: 'contacts',
    propertyName: 'custom_field'
  }, {
    objectType: 'companies',
    propertyName: 'annual_contract_value'
  }]
};

export const tool: ToolDefinition = {
  name: 'deleteProperty',
  description: 'Delete a custom property from a HubSpot object type',
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
      await service.deleteProperty(params.objectType, params.propertyName);
      
      return {
        message: `Deleted property ${params.propertyName} from ${params.objectType}`,
        details: {
          objectType: params.objectType,
          propertyName: params.propertyName,
          deleted: true
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      throw new BcpError(
        `Failed to delete property ${params.propertyName} from ${params.objectType}: ${error instanceof Error ? error.message : String(error)}`,
        'API_ERROR',
        500
      );
    }
  }
};