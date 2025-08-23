/**
 * Recent Deals Tool
 * 
 * Provides functionality to retrieve recently created or modified deals from HubSpot.
 * Part of the Deals BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for recent deals tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'number',
      description: 'Maximum number of deals to return (default: 10, max: 100)'
    }
  },
  required: []
};

/**
 * Recent deals tool definition
 */
export const tool: ToolDefinition = {
  name: 'recent',
  description: 'Get recently created or modified deals from HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Get recent deals
      const limit = Math.min(params.limit || 10, 100);
      const deals = await apiClient.getRecentDeals(limit);
      
      return {
        message: 'Recent deals retrieved successfully',
        count: deals.length,
        deals: deals.map(deal => ({
          id: deal.id,
          name: deal.properties.dealname,
          amount: deal.properties.amount,
          stage: deal.properties.dealstage,
          closeDate: deal.properties.closedate,
          createdAt: deal.createdAt,
          updatedAt: deal.updatedAt
        }))
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to get recent deals',
        error: errorMessage
      };
    }
  }
};