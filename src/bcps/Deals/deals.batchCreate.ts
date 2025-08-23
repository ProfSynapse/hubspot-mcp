/**
 * Batch Create Deals Tool
 * 
 * Provides functionality to create multiple deals at once in HubSpot.
 * Part of the Deals BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for batch create deals tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    deals: {
      type: 'array',
      description: 'Array of deals to create',
      items: {
        type: 'object',
        properties: {
          dealname: {
            type: 'string',
            description: 'Deal name (required)'
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
        },
        required: ['dealname']
      }
    }
  },
  required: ['deals']
};

/**
 * Batch create deals tool definition
 */
export const tool: ToolDefinition = {
  name: 'batchCreate',
  description: 'Create multiple deals at once in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Batch create deals
      const createdDeals = await apiClient.batchCreateDeals(params.deals);
      
      return {
        message: 'Deals created successfully',
        count: createdDeals.length,
        deals: createdDeals.map(deal => ({
          id: deal.id,
          name: deal.properties.dealname,
          amount: deal.properties.amount,
          stage: deal.properties.dealstage,
          createdAt: deal.createdAt
        }))
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to batch create deals',
        error: errorMessage
      };
    }
  }
};