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
    name: {
      type: 'string',
      description: 'Company name'
    },
    domain: {
      type: 'string',
      description: 'Company website domain'
    },
    industry: {
      type: 'string',
      description: 'Company industry'
    },
    description: {
      type: 'string',
      description: 'Company description'
    },
    additionalProperties: {
      type: 'object',
      description: 'Additional company properties',
      properties: {}
    }
  },
  required: ['id']
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
      
      // Prepare company properties
      const properties: Record<string, any> = {
        ...(params.name && { name: params.name }),
        ...(params.domain && { domain: params.domain }),
        ...(params.industry && { industry: params.industry }),
        ...(params.description && { description: params.description }),
        ...(params.additionalProperties || {})
      };
      
      // Update company
      const company = await apiClient.updateCompany(params.id, properties);
      
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
