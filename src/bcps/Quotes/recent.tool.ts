/**
 * Recent Quotes Tool
 * 
 * Provides functionality to retrieve recent quotes from HubSpot.
 * Part of the Quotes BCP.
 */

import { ToolDefinition, InputSchema, ServiceConfig } from '../../core/types.js';
import { QuotesService } from './quotes.service.js';

/**
 * Input schema for recent quotes tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'number',
      description: 'Maximum number of quotes to return (default: 10)',
      minimum: 1,
      maximum: 100
    }
  },
  required: []
};

/**
 * Recent quotes tool definition
 */
export const tool: ToolDefinition = {
  name: 'recent',
  description: 'Get recent quotes from HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create service instance
      const config = { hubspotAccessToken: apiKey };
      const service = new QuotesService(config);
      await service.init();
      
      // Get recent quotes
      const limit = params.limit || 10;
      const quotes = await service.getRecentQuotes(limit);
      
      return {
        message: `Retrieved ${quotes.length} recent quote(s)`,
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
        message: 'Failed to get recent quotes',
        error: errorMessage
      };
    }
  }
};