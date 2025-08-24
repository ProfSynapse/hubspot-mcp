import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { PropertiesService, PropertyInput } from './properties.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    objectType: {
      type: 'string',
      description: 'The HubSpot object type to create the property for (contacts, companies, deals, tickets, etc.)'
    },
    name: {
      type: 'string',
      description: 'The internal name of the property (must be unique, lowercase, no spaces)'
    },
    label: {
      type: 'string',
      description: 'The display label for the property'
    },
    description: {
      type: 'string',
      description: 'Optional description of the property'
    },
    groupName: {
      type: 'string',
      description: 'Property group name to organize the property (required - use listGroups operation to see available groups)'
    },
    type: {
      type: 'string',
      enum: ['string', 'number', 'date', 'datetime', 'enumeration', 'bool'],
      description: 'The data type of the property'
    },
    fieldType: {
      type: 'string',
      enum: ['text', 'textarea', 'select', 'radio', 'checkbox', 'date', 'file', 'number'],
      description: 'The form field type for the property'
    },
    options: {
      type: 'array',
      description: 'Array of options for enumeration type properties',
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
      description: 'Whether the property should appear in forms (default: true)'
    },
    displayOrder: {
      type: 'number',
      description: 'Display order for the property (default: -1)'
    },
    hidden: {
      type: 'boolean',
      description: 'Whether the property is hidden (default: false)'
    },
    hasUniqueValue: {
      type: 'boolean',
      description: 'Whether the property values must be unique (default: false)'
    },
    calculationFormula: {
      type: 'string',
      description: 'Formula for calculated properties'
    }
  },
  required: ['objectType', 'name', 'label', 'groupName', 'type', 'fieldType'],
  examples: [{
    objectType: 'contacts',
    name: 'priority_level',
    label: 'Priority Level',
    groupName: 'contactinformation',
    description: 'Contact priority level for sales team',
    type: 'enumeration',
    fieldType: 'select',
    options: [
      { label: 'High', value: 'high', displayOrder: 1 },
      { label: 'Medium', value: 'medium', displayOrder: 2 },
      { label: 'Low', value: 'low', displayOrder: 3 }
    ]
  }, {
    objectType: 'companies',
    name: 'annual_contract_value',
    label: 'Annual Contract Value',
    groupName: 'companyinformation',
    type: 'number',
    fieldType: 'number',
    description: 'Total annual contract value for the company'
  }]
};

export const tool: ToolDefinition = {
  name: 'createProperty',
  description: 'Create a new custom property for a HubSpot object type',
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
      const { objectType, ...propertyData } = params;
      const property = await service.createProperty(objectType, propertyData as PropertyInput);
      
      const response = {
        message: `Created property ${property.name} for ${objectType}`,
        property,
        details: {
          objectType,
          propertyName: property.name,
          label: property.label,
          type: property.type,
          fieldType: property.fieldType
        }
      };
      
      return enhanceResponse(response, 'create', params, 'Properties');
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const errorResponse = {
        message: `Failed to create property for ${params.objectType}`,
        error: error instanceof Error ? error.message : String(error)
      };
      
      return enhanceResponse(
        errorResponse,
        'create',
        params,
        'Properties',
        error instanceof Error ? error : undefined
      );
    }
  }
};