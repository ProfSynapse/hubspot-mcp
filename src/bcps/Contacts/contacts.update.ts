/**
 * Update Contact Tool
 * 
 * Provides functionality to update contact properties in HubSpot.
 * Part of the Contacts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for update contact tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'HubSpot contact ID (required)'
    },
    email: {
      type: 'string',
      description: 'Contact email address'
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
  required: ['id']
};

/**
 * Update contact tool definition
 */
export const tool: ToolDefinition = {
  name: 'update',
  description: 'Update a contact in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Prepare contact properties
      const properties: Record<string, any> = {
        ...(params.email && { email: params.email }),
        ...(params.firstName && { firstname: params.firstName }),
        ...(params.lastName && { lastname: params.lastName }),
        ...(params.phone && { phone: params.phone }),
        ...(params.company && { company: params.company }),
        ...(params.additionalProperties || {})
      };
      
      // Update contact
      const contact = await apiClient.updateContact(params.id, properties);
      
      return {
        message: 'Contact updated successfully',
        contact: {
          id: contact.id,
          properties: contact.properties,
          updatedAt: contact.updatedAt
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to update contact',
        error: errorMessage
      };
    }
  }
};
