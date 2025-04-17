/**
 * Delete Contact Tool
 * 
 * Provides functionality to delete/archive a contact in HubSpot.
 * Part of the Contacts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for delete contact tool
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
 * Delete contact tool definition
 */
export const tool: ToolDefinition = {
  name: 'delete',
  description: 'Delete/archive a contact in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Delete contact
      await apiClient.deleteContact(params.id);
      
      return {
        message: `Contact ${params.id} deleted successfully`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to delete contact',
        error: errorMessage
      };
    }
  }
};
