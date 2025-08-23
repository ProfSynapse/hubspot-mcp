import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { PropertiesService, PropertyInput } from './properties.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    objectType: {
      type: 'string',
      description: 'The HubSpot object type (contacts, companies, deals, tickets, etc.)'
    },
    propertyName: {
      type: 'string',
      description: 'The name of the property to update'
    },
    label: {
      type: 'string',
      description: 'Updated display label for the property'
    },
    description: {
      type: 'string',
      description: 'Updated description of the property'
    },
    groupName: {
      type: 'string',
      description: 'Updated property group name'
    },
    type: {
      type: 'string',
      enum: ['string', 'number', 'date', 'datetime', 'enumeration', 'bool'],
      description: 'Updated data type of the property'
    },
    fieldType: {
      type: 'string',
      enum: ['text', 'textarea', 'select', 'radio', 'checkbox', 'date', 'file', 'number'],
      description: 'Updated form field type for the property'
    },
    options: {
      type: 'array',
      description: 'Updated array of options for enumeration type properties',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Display label for the option' },
          value: { type: 'string', description: 'Internal value for the option' },
          displayOrder: { type: 'number', description: 'Order to display the option' },
          hidden: { type: 'boolean', description: 'Whether the option is hidden' }
        },
        required: ['label', 'value']
      }
    },
    formField: {
      type: 'boolean',
      description: 'Whether the property should appear in forms'
    },
    displayOrder: {
      type: 'number',
      description: 'Updated display order for the property'
    },
    hidden: {
      type: 'boolean',
      description: 'Whether the property is hidden'
    },
    hasUniqueValue: {
      type: 'boolean',
      description: 'Whether the property values must be unique'
    },
    calculationFormula: {
      type: 'string',
      description: 'Updated formula for calculated properties'
    }
  },
  required: ['objectType', 'propertyName'],
  examples: [{
    objectType: 'contacts',
    propertyName: 'priority_level',
    label: 'Updated Priority Level',
    description: 'Updated priority level description'
  }, {
    objectType: 'companies',
    propertyName: 'annual_contract_value',
    label: 'Total Annual Contract Value',
    hidden: false
  }]
};

export const tool: ToolDefinition = {
  name: 'updateProperty',
  description: 'Update an existing property for a HubSpot object type',
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
      const { objectType, propertyName, ...updateData } = params;
      const property = await service.updateProperty(objectType, propertyName, updateData as Partial<PropertyInput>);
      
      return {
        message: `Updated property ${propertyName} for ${objectType}`,
        property,
        details: {
          objectType,
          propertyName: property.name,
          label: property.label,
          type: property.type,
          fieldType: property.fieldType
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      throw new BcpError(
        `Failed to update property ${params.propertyName} for ${params.objectType}: ${error instanceof Error ? error.message : String(error)}`,
        'API_ERROR',
        500
      );
    }
  }
};