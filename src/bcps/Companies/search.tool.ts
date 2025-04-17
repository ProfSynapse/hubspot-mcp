/**
 * Search Companies Tool
 * 
 * Provides functionality to search for companies in HubSpot by name or domain.
 * Part of the Companies BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for search companies tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    searchType: {
      type: 'string',
      description: 'Type of search to perform',
      enum: ['name', 'domain']
    },
    searchTerm: {
      type: 'string',
      description: 'Term to search for (company name or domain)'
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return',
      minimum: 1,
      maximum: 100,
      default: 10
    }
  },
  required: ['searchType', 'searchTerm']
};

/**
 * Search companies tool definition
 */
export const tool: ToolDefinition = {
  name: 'search',
  description: 'Search for companies by name or domain',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Search companies
      let companies;
      if (params.searchType === 'domain') {
        companies = await apiClient.searchCompaniesByDomain(
          params.searchTerm,
          params.limit || 10
        );
      } else {
        companies = await apiClient.searchCompaniesByName(
          params.searchTerm,
          params.limit || 10
        );
      }
      
      // Transform results
      const results = companies.map(company => ({
        id: company.id,
        name: company.properties.name,
        domain: company.properties.domain,
        industry: company.properties.industry,
        createdAt: company.createdAt
      }));
      
      return {
        message: `Found ${results.length} companies`,
        companies: results,
        count: results.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to search companies',
        companies: [],
        count: 0,
        error: errorMessage
      };
    }
  }
};
