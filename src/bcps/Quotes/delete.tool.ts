/**
 * Delete Quote Tool
 * 
 * Provides functionality to delete (archive) quotes in HubSpot.
 * Part of the Quotes BCP.
 */

import { ToolDefinition, InputSchema, ServiceConfig } from '../../core/types.js';
import { QuotesService } from './quotes.service.js';

/**
 * Input schema for delete quote tool
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
 * Delete quote tool definition
 */
export const tool: ToolDefinition = {
  name: 'delete',
  description: 'Delete (archive) a quote in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create service instance
      const config = { hubspotAccessToken: apiKey };
      const service = new QuotesService(config);
      await service.init();
      
      // Delete quote
      await service.deleteQuote(params.id);
      
      return {
        message: 'Quote deleted successfully',
        id: params.id
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to delete quote',
        error: errorMessage
      };
    }
  }
};