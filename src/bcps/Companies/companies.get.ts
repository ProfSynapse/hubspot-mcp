/**
 * Get Company Tool
 * 
 * Provides functionality to retrieve a company by ID from HubSpot.
 * Part of the Companies BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for get company tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'HubSpot company ID (required). Use search or recent operations to find company IDs first.'
    }
  },
  required: ['id']
};

/**
 * Get company tool definition
 */
export const tool: ToolDefinition = {
  name: 'get',
  description: 'Get a company by ID from HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Get company
      const company = await apiClient.getCompany(params.id);
      
      return {
        company: {
          id: company.id,
          properties: company.properties,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to get company',
        error: errorMessage
      };
    }
  }
};
