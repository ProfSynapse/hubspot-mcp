import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { PropertiesService } from './properties.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    objectType: {
      type: 'string',
      description: 'The HubSpot object type (contacts, companies, deals, tickets, etc.)'
    },
    groupName: {
      type: 'string',
      description: 'The name of the property group to delete'
    }
  },
  required: ['objectType', 'groupName'],
  examples: [{
    objectType: 'contacts',
    groupName: 'custom_fields'
  }, {
    objectType: 'companies',
    groupName: 'financial_info'
  }]
};

export const tool: ToolDefinition = {
  name: 'deletePropertyGroup',
  description: 'Delete a property group from a HubSpot object type',
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
      await service.deletePropertyGroup(params.objectType, params.groupName);
      
      return {
        message: `Deleted property group ${params.groupName} from ${params.objectType}`,
        details: {
          objectType: params.objectType,
          groupName: params.groupName,
          deleted: true
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      throw new BcpError(
        `Failed to delete property group ${params.groupName} from ${params.objectType}: ${error instanceof Error ? error.message : String(error)}`,
        'API_ERROR',
        500
      );
    }
  }
};