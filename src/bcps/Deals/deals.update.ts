/**
 * Update Deal Tool
 * 
 * Provides functionality to update existing deals in HubSpot.
 * Part of the Deals BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for update deal tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'The ID of the deal to update'
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
};

/**
 * Update deal tool definition
 */
export const tool: ToolDefinition = {
  name: 'update',
  description: 'Update an existing deal in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Update deal
      const deal = await apiClient.updateDeal(params.id, params.properties);
      
      return {
        message: 'Deal updated successfully',
        deal: {
          id: deal.id,
          properties: deal.properties,
          updatedAt: deal.updatedAt
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to update deal',
        error: errorMessage
      };
    }
  }
};