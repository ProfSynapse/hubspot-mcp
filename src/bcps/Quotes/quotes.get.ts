/**
 * Get Quote Tool
 * 
 * Provides functionality to retrieve a quote by ID from HubSpot.
 * Part of the Quotes BCP.
 */

import { ToolDefinition, InputSchema, ServiceConfig } from '../../core/types.js';
import { QuotesService } from './quotes.service.js';

/**
 * Input schema for get quote tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Quote ID (required)'
    }
  },
  required: ['id']
};

/**
 * Get quote tool definition
 */
export const tool: ToolDefinition = {
  name: 'get',
  description: 'Get a quote by ID from HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create service instance
      const config = { hubspotAccessToken: apiKey };
      const service = new QuotesService(config);
      await service.init();
      
      // Get quote
      const quote = await service.getQuote(params.id);
      
      return {
        message: 'Quote retrieved successfully',
        quote: {
          id: quote.id,
          properties: quote.properties,
          createdAt: quote.createdAt,
          updatedAt: quote.updatedAt
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to get quote',
        error: errorMessage
      };
    }
  }
};