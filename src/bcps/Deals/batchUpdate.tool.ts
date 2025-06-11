/**
 * Batch Update Deals Tool
 * 
 * Provides functionality to update multiple deals at once in HubSpot.
 * Part of the Deals BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for batch update deals tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    updates: {
      type: 'array',
      description: 'Array of deal updates',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Deal ID to update'
          },
          properties: {
            type: 'object',
            description: 'Properties to update',
            properties: {
              dealname: {
                type: 'string',
                description: 'Deal name'
              },
              pipeline: {
                type: 'string',
                description: 'Pipeline ID the deal belongs to'
              },
              dealstage: {
                type: 'string',
                description: 'Deal stage ID within the pipeline'
              },
              amount: {
                type: 'string',
                description: 'Deal amount in currency'
              },
              closedate: {
                type: 'string',
                description: 'Expected close date (ISO 8601 format: YYYY-MM-DD)'
              },
              description: {
                type: 'string',
                description: 'Deal description'
              },
              hubspot_owner_id: {
                type: 'string',
                description: 'HubSpot owner ID for the deal'
              }
            }
          }
        },
        required: ['id', 'properties']
      }
    }
  },
  required: ['updates']
};

/**
 * Batch update deals tool definition
 */
export const tool: ToolDefinition = {
  name: 'batchUpdate',
  description: 'Update multiple deals at once in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Batch update deals
      const updatedDeals = await apiClient.batchUpdateDeals(params.updates);
      
      return {
        message: 'Deals updated successfully',
        count: updatedDeals.length,
        deals: updatedDeals.map(deal => ({
          id: deal.id,
          name: deal.properties.dealname,
          amount: deal.properties.amount,
          stage: deal.properties.dealstage,
          updatedAt: deal.updatedAt
        }))
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to batch update deals',
        error: errorMessage
      };
    }
  }
};