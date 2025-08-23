import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { PropertiesService, PropertyGroupInput } from './properties.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    objectType: {
      type: 'string',
      description: 'The HubSpot object type to create the property group for (contacts, companies, deals, tickets, etc.)'
    },
    name: {
      type: 'string',
      description: 'The internal name of the property group (must be unique, lowercase, no spaces)'
    },
    displayName: {
      type: 'string',
      description: 'The display name for the property group'
    },
    displayOrder: {
      type: 'number',
      description: 'Display order for the property group (default: -1)'
    }
  },
  required: ['objectType', 'name', 'displayName'],
  examples: [{
    objectType: 'contacts',
    name: 'custom_fields',
    displayName: 'Custom Fields',
    displayOrder: 5
  }, {
    objectType: 'companies',
    name: 'financial_info',
    displayName: 'Financial Information'
  }]
};

export const tool: ToolDefinition = {
  name: 'createPropertyGroup',
  description: 'Create a new property group for a HubSpot object type',
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
      const { objectType, ...groupData } = params;
      const group = await service.createPropertyGroup(objectType, groupData as PropertyGroupInput);
      
      return {
        message: `Created property group ${group.name} for ${objectType}`,
        propertyGroup: group,
        details: {
          objectType,
          groupName: group.name,
          displayName: group.displayName,
          displayOrder: group.displayOrder
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      throw new BcpError(
        `Failed to create property group for ${params.objectType}: ${error instanceof Error ? error.message : String(error)}`,
        'API_ERROR',
        500
      );
    }
  }
};