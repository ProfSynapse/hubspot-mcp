/**
 * Update Company Tool
 * 
 * Provides functionality to update company properties in HubSpot.
 * Part of the Companies BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for update company tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'HubSpot company ID (required)'
    },
    properties: {
      type: 'object',
      description: 'Company properties to update (e.g., { "name": "ACME Corp", "domain": "acme.com", "industry": "Technology" })',
      additionalProperties: true
    }
  },
  required: ['id', 'properties']
};

/**
 * Update company tool definition
 */
export const tool: ToolDefinition = {
  name: 'update',
  description: 'Update a company in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';

      // Create API client
      const apiClient = createHubspotApiClient(apiKey);

      // Update company with the provided properties
      const company = await apiClient.updateCompany(params.id, params.properties);

      return {
        message: 'Company updated successfully',
        company: {
          id: company.id,
          properties: company.properties,
          updatedAt: company.updatedAt
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to update company',
        error: errorMessage
      };
    }
  }
};
