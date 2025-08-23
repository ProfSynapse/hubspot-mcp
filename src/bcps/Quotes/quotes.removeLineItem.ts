/**
 * Remove Line Item Tool
 * 
 * Provides functionality to remove line items from quotes in HubSpot.
 * Part of the Quotes BCP.
 */

import { ToolDefinition, InputSchema, ServiceConfig } from '../../core/types.js';
import { QuotesService } from './quotes.service.js';

/**
 * Input schema for remove line item tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    quoteId: {
      type: 'string',
      description: 'Quote ID to remove the line item from (required)'
    },
    lineItemId: {
      type: 'string',
      description: 'Line item ID to remove (required)'
    }
  },
  required: ['quoteId', 'lineItemId']
};

/**
 * Remove line item tool definition
 */
export const tool: ToolDefinition = {
  name: 'removeLineItem',
  description: 'Remove a line item from a quote in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create service instance
      const config = { hubspotAccessToken: apiKey };
      const service = new QuotesService(config);
      await service.init();
      
      // Remove line item from quote
      await service.removeLineItemFromQuote(params.quoteId, params.lineItemId);
      
      return {
        message: 'Line item removed successfully',
        quoteId: params.quoteId,
        lineItemId: params.lineItemId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to remove line item from quote',
        error: errorMessage
      };
    }
  }
};