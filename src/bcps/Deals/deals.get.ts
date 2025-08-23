/**
 * Get Deal Tool
 * 
 * Provides functionality to retrieve a deal by ID from HubSpot.
 * Part of the Deals BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for get deal tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'The ID of the deal to retrieve'
    }
  },
  required: ['id']
};

/**
 * Get deal tool definition
 */
export const tool: ToolDefinition = {
  name: 'get',
  description: 'Get a deal by ID from HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Get deal
      const deal = await apiClient.getDeal(params.id);
      
      return {
        message: 'Deal retrieved successfully',
        deal: {
          id: deal.id,
          properties: deal.properties,
          createdAt: deal.createdAt,
          updatedAt: deal.updatedAt
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to get deal',
        error: errorMessage
      };
    }
  }
};