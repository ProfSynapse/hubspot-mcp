/**
 * Get Contact Tool
 * 
 * Provides functionality to retrieve a contact by ID from HubSpot.
 * Part of the Contacts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for get contact tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'HubSpot contact ID (required)'
    }
  },
  required: ['id']
};

/**
 * Get contact tool definition
 */
export const tool: ToolDefinition = {
  name: 'get',
  description: 'Get a contact by ID from HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Get contact
      const contact = await apiClient.getContact(params.id);
      
      return {
        contact: {
          id: contact.id,
          properties: contact.properties,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to get contact',
        error: errorMessage
      };
    }
  }
};
