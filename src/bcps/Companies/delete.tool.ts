/**
 * Delete Company Tool
 * 
 * Provides functionality to delete/archive a company in HubSpot.
 * Part of the Companies BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for delete company tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'HubSpot company ID (required)'
    }
  },
  required: ['id']
};

/**
 * Delete company tool definition
 */
export const tool: ToolDefinition = {
  name: 'delete',
  description: 'Delete/archive a company in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Delete company
      await apiClient.deleteCompany(params.id);
      
      return {
        message: `Company ${params.id} deleted successfully`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to delete company',
        error: errorMessage
      };
    }
  }
};
