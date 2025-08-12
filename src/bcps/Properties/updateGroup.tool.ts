import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { PropertiesService, PropertyGroupInput } from './properties.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    objectType: {
      type: 'string',
      description: 'The HubSpot object type (contacts, companies, deals, tickets, etc.)'
    },
    groupName: {
      type: 'string',
      description: 'The name of the property group to update'
    },
    displayName: {
      type: 'string',
      description: 'Updated display name for the property group'
    },
    displayOrder: {
      type: 'number',
      description: 'Updated display order for the property group'
    }
  },
  required: ['objectType', 'groupName'],
  examples: [{
    objectType: 'contacts',
    groupName: 'custom_fields',
    displayName: 'Updated Custom Fields'
  }, {
    objectType: 'companies',
    groupName: 'financial_info',
    displayOrder: 3
  }]
};

export const tool: ToolDefinition = {
  name: 'updatePropertyGroup',
  description: 'Update an existing property group for a HubSpot object type',
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
      const { objectType, groupName, ...updateData } = params;
      const group = await service.updatePropertyGroup(objectType, groupName, updateData as Partial<PropertyGroupInput>);
      
      return {
        message: `Updated property group ${groupName} for ${objectType}`,
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
        `Failed to update property group ${params.groupName} for ${params.objectType}: ${error instanceof Error ? error.message : String(error)}`,
        'API_ERROR',
        500
      );
    }
  }
};