/**
 * Search Deals Tool
 * 
 * Provides functionality to search for deals in HubSpot.
 * Part of the Deals BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';
import { PublicObjectSearchRequest } from '@hubspot/api-client/lib/codegen/crm/deals/index.js';

/**
 * Input schema for search deals tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    searchType: {
      type: 'string',
      description: 'Type of search to perform',
      enum: ['name', 'modifiedDate', 'custom']
    },
    query: {
      type: 'string',
      description: 'Search query (for name search) or ISO date string (for modifiedDate search)'
    },
    customSearch: {
      type: 'object',
      description: 'Custom search request (for advanced searches)',
      properties: {
        filterGroups: {
          type: 'array',
          description: 'Filter groups for the search',
          items: {
            type: 'object',
            properties: {
              filters: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    propertyName: { type: 'string' },
                    operator: { type: 'string' },
                    value: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        sorts: {
          type: 'array',
          description: 'Sort order for results',
          items: {
            type: 'object',
            properties: {
              propertyName: { type: 'string' },
              direction: { type: 'string', enum: ['ASCENDING', 'DESCENDING'] }
            }
          }
        },
        properties: {
          type: 'array',
          description: 'Properties to include in results',
          items: { type: 'string' }
        },
        limit: { type: 'number', description: 'Maximum number of results' },
        after: { type: 'number', description: 'Pagination cursor' }
      }
    }
  },
  required: ['searchType']
};

/**
 * Search deals tool definition
 */
export const tool: ToolDefinition = {
  name: 'search',
  description: 'Search for deals in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      let deals;
      
      switch (params.searchType) {
        case 'name':
          if (!params.query) {
            throw new Error('Query is required for name search');
          }
          deals = await apiClient.searchDealsByName(params.query);
          break;
          
        case 'modifiedDate':
          if (!params.query) {
            throw new Error('Query (ISO date string) is required for modifiedDate search');
          }
          const date = new Date(params.query);
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date format. Please use ISO 8601 format.');
          }
          deals = await apiClient.searchDealsByModifiedDate(date);
          break;
          
        case 'custom':
          if (!params.customSearch) {
            throw new Error('customSearch object is required for custom search');
          }
          const searchRequest: PublicObjectSearchRequest = {
            filterGroups: params.customSearch.filterGroups || [],
            sorts: params.customSearch.sorts || [],
            properties: params.customSearch.properties || ['dealname', 'amount', 'closedate', 'dealstage'],
            limit: params.customSearch.limit || 100,
            after: params.customSearch.after || 0
          };
          deals = await apiClient.searchDeals(searchRequest);
          break;
          
        default:
          throw new Error('Invalid search type');
      }
      
      return {
        message: 'Deals search completed',
        count: deals.length,
        deals: deals.map(deal => ({
          id: deal.id,
          name: deal.properties.dealname,
          amount: deal.properties.amount,
          stage: deal.properties.dealstage,
          closeDate: deal.properties.closedate,
          updatedAt: deal.updatedAt
        }))
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to search deals',
        error: errorMessage
      };
    }
  }
};