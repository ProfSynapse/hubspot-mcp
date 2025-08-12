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
      description: 'The name of the property group to retrieve'
    }
  },
  required: ['objectType', 'groupName'],
  examples: [{
    objectType: 'contacts',
    groupName: 'contactinformation'
  }, {
    objectType: 'companies',
    groupName: 'companyinformation'
  }]
};

export const tool: ToolDefinition = {
  name: 'getPropertyGroup',
  description: 'Get details of a specific property group for a HubSpot object type',
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
      const group = await service.getPropertyGroup(params.objectType, params.groupName);
      return {
        message: `Retrieved property group ${params.groupName} for ${params.objectType}`,
        propertyGroup: group,
        details: {
          objectType: params.objectType,
          groupName: params.groupName,
          displayName: group.displayName,
          propertyCount: group.properties.length
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      throw new BcpError(
        `Failed to get property group ${params.groupName} for ${params.objectType}: ${error instanceof Error ? error.message : String(error)}`,
        'API_ERROR',
        500
      );
    }
  }
};