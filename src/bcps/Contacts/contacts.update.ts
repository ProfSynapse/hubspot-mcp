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
    properties: {
      type: 'object',
      description: 'Contact properties to update (e.g., { "email": "test@example.com", "firstname": "John", "hs_legal_basis": "Legitimate interest" })',
      additionalProperties: true
    }
  },
  required: ['id', 'properties']
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

      // Update contact with the provided properties
      const contact = await apiClient.updateContact(params.id, params.properties);

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
