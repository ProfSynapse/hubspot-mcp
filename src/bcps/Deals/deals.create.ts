/**
 * Create Deal Tool
 * 
 * Provides functionality to create new deals in HubSpot.
 * Part of the Deals BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for create deal tool
 */
const inputSchema: InputSchema = {
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
    },
    additionalProperties: {
      type: 'object',
      description: 'Additional deal properties',
      properties: {}
    }
  },
  required: ['dealname']
};

/**
 * Create deal tool definition
 */
export const tool: ToolDefinition = {
  name: 'create',
  description: 'Create a new deal in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Prepare deal properties
      const properties: Record<string, any> = {
        dealname: params.dealname,
        ...(params.pipeline && { pipeline: params.pipeline }),
        ...(params.dealstage && { dealstage: params.dealstage }),
        ...(params.amount && { amount: params.amount }),
        ...(params.closedate && { closedate: params.closedate }),
        ...(params.description && { description: params.description }),
        ...(params.hubspot_owner_id && { hubspot_owner_id: params.hubspot_owner_id }),
        ...(params.additionalProperties || {})
      };
      
      // Create deal
      const deal = await apiClient.createDeal(properties);
      
      return {
        message: 'Deal created successfully',
        deal: {
          id: deal.id,
          name: deal.properties.dealname,
          amount: deal.properties.amount,
          stage: deal.properties.dealstage,
          createdAt: deal.createdAt
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to create deal',
        error: errorMessage
      };
    }
  }
};