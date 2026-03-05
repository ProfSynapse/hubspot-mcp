import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { PropertiesService } from './properties.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    objectType: {
      type: 'string',
      description: 'The HubSpot object type to get PROPERTY SCHEMAS for (contacts, companies, deals, tickets, notes, etc.). NOTE: This lists property definitions, not object data. To list actual objects, use the respective domain (e.g., Notes domain for note data, Contacts domain for contact data).'
    }
  },
  required: ['objectType'],
  examples: [{
    objectType: 'contacts',
    description: 'Lists available property fields for contacts (email, firstname, etc.)'
  }, {
    objectType: 'companies', 
    description: 'Lists available property fields for companies (name, domain, etc.)'
  }, {
    objectType: 'notes',
    description: 'Lists available property fields for notes - for actual note data, use Notes domain'
  }]
};

export const tool: ToolDefinition = {
  name: 'listProperties',
  description: 'Get property SCHEMAS (field definitions) for a HubSpot object type. Returns property names, types, and metadata - NOT the actual object data. For object data, use the respective domain (Notes, Contacts, Companies, etc.)',
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
      const response = {
        message: `Found ${properties.length} properties for ${params.objectType}`,
        properties,
        details: {
          objectType: params.objectType,
          count: properties.length,
          propertyNames: properties.map(p => p.name).slice(0, 10)
        }
      };
      
      return enhanceResponse(response, 'list', params, 'Properties');
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