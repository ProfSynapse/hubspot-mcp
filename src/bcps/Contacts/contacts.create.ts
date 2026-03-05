/**
 * Create Contact Tool
 * 
 * Provides functionality to create new contacts in HubSpot.
 * Part of the Contacts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for create contact tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      description: 'Contact email address (required)'
    },
    firstName: {
      type: 'string',
      description: 'Contact first name'
    },
    lastName: {
      type: 'string',
      description: 'Contact last name'
    },
    phone: {
      type: 'string',
      description: 'Contact phone number'
    },
    company: {
      type: 'string',
      description: 'Contact company name'
    },
    additionalProperties: {
      type: 'object',
      description: 'Additional contact properties',
      properties: {}
    }
  },
  required: ['email']
};

/**
 * Create contact tool definition
 */
export const tool: ToolDefinition = {
  name: 'create',
  description: 'Create a new contact in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Prepare contact properties
      const properties: Record<string, any> = {
        email: params.email,
        ...(params.firstName && { firstname: params.firstName }),
        ...(params.lastName && { lastname: params.lastName }),
        ...(params.phone && { phone: params.phone }),
        ...(params.company && { company: params.company }),
        ...(params.additionalProperties || {})
      };
      
      // Create contact
      const contact = await apiClient.createContact(properties);
      
      return {
        message: 'Contact created successfully',
        contact: {
          id: contact.id,
          email: contact.properties.email,
          firstName: contact.properties.firstname,
          lastName: contact.properties.lastname,
          createdAt: contact.createdAt
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to create contact',
        error: errorMessage
      };
    }
  }
};
