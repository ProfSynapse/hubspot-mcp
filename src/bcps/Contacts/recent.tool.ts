/**
 * Recent Contacts Tool
 * 
 * Provides functionality to retrieve recently created or updated contacts in HubSpot.
 * Part of the Contacts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for recent contacts tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return',
      minimum: 1,
      maximum: 100,
      default: 10
    }
  },
  required: []
};

/**
 * Recent contacts tool definition
 */
export const tool: ToolDefinition = {
  name: 'recent',
  description: 'Get recently created or updated contacts',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Get recent contacts
      const contacts = await apiClient.getRecentContacts(params.limit || 10);
      
      // Transform results
      const results = contacts.map(contact => ({
        id: contact.id,
        email: contact.properties.email,
        firstName: contact.properties.firstname,
        lastName: contact.properties.lastname,
        company: contact.properties.company,
        createdAt: contact.createdAt
      }));
      
      return {
        message: `Retrieved ${results.length} recent contacts`,
        contacts: results,
        count: results.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to get recent contacts',
        contacts: [],
        count: 0,
        error: errorMessage
      };
    }
  }
};
