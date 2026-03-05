/**
 * Recent Companies Tool
 * 
 * Provides functionality to retrieve recently created or updated companies in HubSpot.
 * Part of the Companies BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for recent companies tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return',
      minimum: 1,
      maximum: 100,
      default: 10
    },
    operation: {
      type: 'string',
      description: 'Operation type (always "recent" for this tool)',
      enum: ['recent'],
      default: 'recent'
    }
  },
  required: []
};

/**
 * Recent companies tool definition
 */
export const tool: ToolDefinition = {
  name: 'recent',
  description: 'Get recently created or updated companies',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Get recent companies
      const limit = params.limit || 10;
      const companies = await apiClient.getRecentCompanies(limit);
      
      // Transform results
      const results = companies.map(company => ({
        id: company.id,
        name: company.properties.name,
        domain: company.properties.domain,
        industry: company.properties.industry,
        createdAt: company.createdAt
      }));
      
      return {
        message: `Retrieved ${results.length} recent companies`,
        companies: results,
        count: results.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to get recent companies',
        companies: [],
        count: 0,
        error: errorMessage
      };
    }
  }
};
