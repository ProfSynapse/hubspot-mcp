/**
 * Search Quotes Tool
 * 
 * Provides functionality to search for quotes in HubSpot.
 * Part of the Quotes BCP.
 */

import { ToolDefinition, InputSchema, ServiceConfig } from '../../core/types.js';
import { QuotesService } from './quotes.service.js';

/**
 * Valid HubSpot quote status values
 */
const VALID_STATUSES = [
  'DRAFT',
  'APPROVAL_NOT_NEEDED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'PENDING_BUYER_ACTION',
  'ACCEPTED',
  'DECLINED',
  'LOST',
  'WON'
];

/**
 * Input schema for search quotes tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    searchType: {
      type: 'string',
      description: 'Type of search to perform',
      enum: ['title', 'status']
    },
    searchTerm: {
      type: 'string',
      description: 'Search term (title text for title search, or status value for status search)'
    },
    status: {
      type: 'string',
      description: 'Quote status to search for (alternative to searchType/searchTerm)',
      enum: VALID_STATUSES
    }
  },
  required: []
};

/**
 * Search quotes tool definition
 */
export const tool: ToolDefinition = {
  name: 'search',
  description: 'Search for quotes in HubSpot by title or status',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create service instance
      const config = { hubspotAccessToken: apiKey };
      const service = new QuotesService(config);
      await service.init();
      
      let quotes;
      
      // Determine search type
      if (params.searchType === 'title' && params.searchTerm) {
        quotes = await service.searchQuotesByTitle(params.searchTerm);
      } else if (params.searchType === 'status' && params.searchTerm) {
        quotes = await service.searchQuotesByStatus(params.searchTerm);
      } else if (params.status) {
        quotes = await service.searchQuotesByStatus(params.status);
      } else {
        return {
          message: 'Please provide either searchType with searchTerm, or status',
          error: 'Invalid search parameters'
        };
      }
      
      return {
        message: `Found ${quotes.length} quote(s)`,
        quotes: quotes.map(quote => ({
          id: quote.id,
          title: quote.properties.hs_title,
          status: quote.properties.hs_status,
          expirationDate: quote.properties.hs_expiration_date,
          currency: quote.properties.hs_currency,
          createdAt: quote.createdAt,
          updatedAt: quote.updatedAt
        }))
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to search quotes',
        error: errorMessage
      };
    }
  }
};