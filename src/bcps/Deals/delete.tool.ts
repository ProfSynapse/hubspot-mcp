/**
 * Delete Deal Tool
 * 
 * Provides functionality to delete (archive) deals in HubSpot.
 * Part of the Deals BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for delete deal tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'The ID of the deal to delete'
    }
  },
  required: ['id']
};

/**
 * Delete deal tool definition
 */
export const tool: ToolDefinition = {
  name: 'delete',
  description: 'Delete (archive) a deal in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Delete deal
      await apiClient.deleteDeal(params.id);
      
      return {
        message: 'Deal deleted successfully',
        dealId: params.id
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to delete deal',
        error: errorMessage
      };
    }
  }
};