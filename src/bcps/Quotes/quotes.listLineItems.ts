/**
 * List Line Items Tool
 * 
 * Provides functionality to list all line items for a quote in HubSpot.
 * Part of the Quotes BCP.
 */

import { ToolDefinition, InputSchema, ServiceConfig } from '../../core/types.js';
import { QuotesService } from './quotes.service.js';

/**
 * Input schema for list line items tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    quoteId: {
      type: 'string',
      description: 'Quote ID to get line items for (required)'
    }
  },
  required: ['quoteId']
};

/**
 * List line items tool definition
 */
export const tool: ToolDefinition = {
  name: 'listLineItems',
  description: 'List all line items for a quote in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create service instance
      const config = { hubspotAccessToken: apiKey };
      const service = new QuotesService(config);
      await service.init();
      
      // Get line items for quote
      const lineItems = await service.getQuoteLineItems(params.quoteId);
      
      // Calculate total
      const total = lineItems.reduce((sum, item) => {
        const amount = parseFloat(item.properties.amount || '0');
        return sum + amount;
      }, 0);
      
      return {
        message: `Found ${lineItems.length} line item(s)`,
        quoteId: params.quoteId,
        lineItems: lineItems.map(item => ({
          id: item.id,
          name: item.properties.name,
          quantity: item.properties.quantity,
          price: item.properties.price,
          amount: item.properties.amount,
          discount: item.properties.discount,
          description: item.properties.description,
          productId: item.properties.hs_product_id
        })),
        total: total.toFixed(2)
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to list line items',
        error: errorMessage
      };
    }
  }
};