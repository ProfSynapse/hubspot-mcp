/**
 * Add Line Item to Quote Tool
 * 
 * Provides functionality to add line items to existing quotes in HubSpot.
 * Part of the Quotes BCP.
 */

import { ToolDefinition, InputSchema, ServiceConfig } from '../../core/types.js';
import { QuotesService, LineItemPropertiesInput } from './quotes.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

/**
 * Valid recurring billing periods
 */
const VALID_BILLING_PERIODS = [
  'monthly',
  'quarterly',
  'semiannually',
  'annually',
  'per_two_years',
  'per_three_years'
];

/**
 * Input schema for add line item tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    quoteId: {
      type: 'string',
      description: 'Quote ID to add the line item to (required)'
    },
    name: {
      type: 'string',
      description: 'Line item name/description (required) - This identifies the product or service being quoted',
      minLength: 1
    },
    productId: {
      type: 'string',
      description: 'Product ID from HubSpot product library (optional). To get product IDs, use hubspotProduct operation "list" or "search".'
    },
    quantity: {
      type: 'number',
      description: 'Quantity (default: 1)',
      minimum: 0
    },
    price: {
      type: 'number',
      description: 'Unit price',
      minimum: 0
    },
    discount: {
      type: 'number',
      description: 'Discount amount',
      minimum: 0
    },
    discountPercentage: {
      type: 'number',
      description: 'Discount percentage (0-100)',
      minimum: 0,
      maximum: 100
    },
    termInMonths: {
      type: 'number',
      description: 'Term length in months for recurring items',
      minimum: 1
    },
    recurringBillingPeriod: {
      type: 'string',
      description: 'Recurring billing period',
      enum: VALID_BILLING_PERIODS
    },
    description: {
      type: 'string',
      description: 'Additional description for the line item'
    }
  },
  required: ['quoteId', 'name']
};

/**
 * Add line item tool definition
 */
export const tool: ToolDefinition = {
  name: 'addLineItem',
  description: 'Add a line item to an existing quote in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Validate required parameters
      if (!params.name || typeof params.name !== 'string' || params.name.trim().length === 0) {
        return {
          message: 'Failed to add line item to quote',
          error: 'Missing required parameter: name must be a non-empty string'
        };
      }
      
      if (!params.quoteId || typeof params.quoteId !== 'string' || params.quoteId.trim().length === 0) {
        return {
          message: 'Failed to add line item to quote', 
          error: 'Missing required parameter: quoteId must be a non-empty string'
        };
      }
      
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create service instance
      const config = { hubspotAccessToken: apiKey };
      const service = new QuotesService(config);
      await service.init();
      
      // Prepare line item properties
      const lineItemProperties: LineItemPropertiesInput = {
        name: params.name,
        ...(params.productId && { hs_product_id: params.productId }),
        ...(params.quantity !== undefined && { quantity: String(params.quantity) }),
        ...(params.price !== undefined && { price: String(params.price) }),
        ...(params.discount !== undefined && { discount: String(params.discount) }),
        ...(params.discountPercentage !== undefined && { hs_discount_percentage: String(params.discountPercentage) }),
        ...(params.termInMonths && { hs_term_in_months: String(params.termInMonths) }),
        ...(params.recurringBillingPeriod && { hs_recurring_billing_period: params.recurringBillingPeriod }),
        ...(params.description && { description: params.description })
      };
      
      // Add line item to quote
      const lineItem = await service.addLineItemToQuote(params.quoteId, lineItemProperties);
      
      const response = {
        message: 'Line item added successfully',
        lineItem: {
          id: lineItem.id,
          name: lineItem.properties.name,
          quantity: lineItem.properties.quantity,
          price: lineItem.properties.price,
          amount: lineItem.properties.amount,
          createdAt: lineItem.createdAt
        },
        quoteId: params.quoteId
      };
      
      return enhanceResponse(response, 'addLineItem', params, 'Quotes');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to add line item to quote',
        error: errorMessage
      };
    }
  }
};