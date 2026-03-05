/**
 * Update Line Item Tool
 * 
 * Provides functionality to update line items in HubSpot quotes.
 * Part of the Quotes BCP.
 */

import { ToolDefinition, InputSchema, ServiceConfig } from '../../core/types.js';
import { QuotesService } from './quotes.service.js';

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
 * Input schema for update line item tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    lineItemId: {
      type: 'string',
      description: 'Line item ID to update (required)'
    },
    name: {
      type: 'string',
      description: 'Line item name/description'
    },
    quantity: {
      type: 'number',
      description: 'Quantity',
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
  required: ['lineItemId']
};

/**
 * Update line item tool definition
 */
export const tool: ToolDefinition = {
  name: 'updateLineItem',
  description: 'Update a line item in a HubSpot quote',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create service instance
      const config = { hubspotAccessToken: apiKey };
      const service = new QuotesService(config);
      await service.init();
      
      // Prepare update properties (excluding lineItemId)
      const { lineItemId, ...updateParams } = params;
      const updates: Record<string, any> = {};
      
      if (updateParams.name) updates.name = updateParams.name;
      if (updateParams.quantity !== undefined) updates.quantity = String(updateParams.quantity);
      if (updateParams.price !== undefined) updates.price = String(updateParams.price);
      if (updateParams.discount !== undefined) updates.discount = String(updateParams.discount);
      if (updateParams.discountPercentage !== undefined) updates.hs_discount_percentage = String(updateParams.discountPercentage);
      if (updateParams.termInMonths) updates.hs_term_in_months = String(updateParams.termInMonths);
      if (updateParams.recurringBillingPeriod) updates.hs_recurring_billing_period = updateParams.recurringBillingPeriod;
      if (updateParams.description) updates.description = updateParams.description;
      
      // Update line item
      const lineItem = await service.updateLineItem(lineItemId, updates);
      
      return {
        message: 'Line item updated successfully',
        lineItem: {
          id: lineItem.id,
          name: lineItem.properties.name,
          quantity: lineItem.properties.quantity,
          price: lineItem.properties.price,
          amount: lineItem.properties.amount,
          updatedAt: lineItem.updatedAt
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to update line item',
        error: errorMessage
      };
    }
  }
};