/**
 * Quotes Service
 * 
 * Handles all HubSpot quote-related API operations.
 * Extends the base service with quote-specific functionality.
 */

import { SimplePublicObjectInputForCreate, PublicObjectSearchRequest } from '@hubspot/api-client/lib/codegen/crm/quotes/index.js';
import { HubspotBaseService } from '../../core/base-service.js';
import { getAssociationTypeId } from '../Associations/associationTypeHelper.js';

// Basic quote properties that can be undefined
export interface QuotePropertiesInput {
  hs_title: string;
  hs_expiration_date?: string;
  hs_status?: string;
  hs_currency?: string;
  hs_public_url_key?: string;
  hs_language?: string;
  hs_locale?: string;
  hs_pdf_download_link?: string;
  hs_sender_company_name?: string;
  hs_sender_company_address?: string;
  hs_sender_company_address2?: string;
  hs_sender_company_city?: string;
  hs_sender_company_state?: string;
  hs_sender_company_zip?: string;
  hs_sender_company_country?: string;
  hs_sender_firstname?: string;
  hs_sender_lastname?: string;
  hs_sender_email?: string;
  hs_sender_phone?: string;
  hs_sender_jobtitle?: string;
  hs_esign_enabled?: string;
  hs_payment_enabled?: string;
  hs_payment_type?: string;
  hs_collect_billing_address?: string;
  hs_collect_shipping_address?: string;
  hs_show_signature_box?: string;
  hs_show_countersignature_box?: string;
  hs_domain?: string;
  [key: string]: string | undefined;
}

// HubSpot API requires all properties to be strings
export interface QuoteProperties {
  hs_title: string;
  hs_expiration_date: string;
  hs_status: string;
  hs_currency: string;
  [key: string]: string;
}

export interface QuoteResponse {
  id: string;
  properties: QuoteProperties;
  createdAt: string;
  updatedAt: string;
}

// Line item properties
export interface LineItemPropertiesInput {
  name: string;
  hs_product_id?: string;
  quantity?: string;
  price?: string;
  discount?: string;
  hs_discount_percentage?: string;
  hs_term_in_months?: string;
  hs_recurring_billing_period?: string;
  hs_recurring_billing_start_date?: string;
  hs_recurring_billing_frequency?: string;
  description?: string;
  hs_line_item_currency_code?: string;
  [key: string]: string | undefined;
}

export interface LineItemProperties {
  name: string;
  quantity: string;
  price: string;
  amount: string;
  [key: string]: string;
}

export interface LineItemResponse {
  id: string;
  properties: LineItemProperties;
  createdAt: string;
  updatedAt: string;
}

export class QuotesService extends HubspotBaseService {
  /**
   * Create a new quote
   */
  async createQuote(properties: QuotePropertiesInput): Promise<QuoteResponse> {
    this.checkInitialized();
    this.validateRequired(properties, ['hs_title']);

    try {
      const apiProperties: { [key: string]: string } = {
        hs_title: properties.hs_title,
        hs_language: properties.hs_language || 'en', // Default to English if not specified
        ...(properties.hs_expiration_date && { hs_expiration_date: properties.hs_expiration_date }),
        ...(properties.hs_status && { hs_status: properties.hs_status }),
        ...(properties.hs_currency && { hs_currency: properties.hs_currency })
      };

      // Add other properties if they exist
      Object.entries(properties).forEach(([key, value]) => {
        if (value !== undefined && !apiProperties[key]) {
          apiProperties[key] = value;
        }
      });

      const input: SimplePublicObjectInputForCreate = {
        properties: apiProperties,
        associations: []
      };

      const response = await this.client.crm.quotes.basicApi.create(input);

      return {
        id: response.id,
        properties: response.properties as QuoteProperties,
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString()
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to create quote');
    }
  }

  /**
   * Get quote by ID
   */
  async getQuote(id: string): Promise<QuoteResponse> {
    this.checkInitialized();

    try {
      const response = await this.client.crm.quotes.basicApi.getById(id);

      return {
        id: response.id,
        properties: response.properties as QuoteProperties,
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString()
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get quote');
    }
  }

  /**
   * Search for quotes by title
   */
  async searchQuotesByTitle(title: string): Promise<QuoteResponse[]> {
    this.checkInitialized();

    try {
      const searchRequest: PublicObjectSearchRequest = {
        filterGroups: [{
          filters: [{
            propertyName: 'hs_title',
            operator: 'CONTAINS_TOKEN',
            value: title
          }]
        }],
        sorts: [],
        properties: ['hs_title', 'hs_status', 'hs_expiration_date', 'hs_currency'],
        limit: 100,
        after: 0
      };

      const response = await this.client.crm.quotes.searchApi.doSearch(searchRequest);

      return response.results.map(quote => ({
        id: quote.id,
        properties: quote.properties as QuoteProperties,
        createdAt: new Date(quote.createdAt).toISOString(),
        updatedAt: new Date(quote.updatedAt).toISOString()
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to search quotes');
    }
  }

  /**
   * Search for quotes by status
   */
  async searchQuotesByStatus(status: string): Promise<QuoteResponse[]> {
    this.checkInitialized();

    try {
      const searchRequest: PublicObjectSearchRequest = {
        filterGroups: [{
          filters: [{
            propertyName: 'hs_status',
            operator: 'EQ',
            value: status
          }]
        }],
        sorts: [],
        properties: ['hs_title', 'hs_status', 'hs_expiration_date', 'hs_currency'],
        limit: 100,
        after: 0
      };

      const response = await this.client.crm.quotes.searchApi.doSearch(searchRequest);

      return response.results.map(quote => ({
        id: quote.id,
        properties: quote.properties as QuoteProperties,
        createdAt: new Date(quote.createdAt).toISOString(),
        updatedAt: new Date(quote.updatedAt).toISOString()
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to search quotes');
    }
  }

  /**
   * Get recent quotes
   */
  async getRecentQuotes(limit: number = 10): Promise<QuoteResponse[]> {
    this.checkInitialized();

    try {
      const response = await this.client.crm.quotes.basicApi.getPage(
        limit,
        undefined,
        undefined,
        undefined,
        undefined,
        false
      );

      return response.results.map(quote => ({
        id: quote.id,
        properties: quote.properties as QuoteProperties,
        createdAt: new Date(quote.createdAt).toISOString(),
        updatedAt: new Date(quote.updatedAt).toISOString()
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get recent quotes');
    }
  }

  /**
   * Update quote properties
   */
  async updateQuote(id: string, properties: Partial<QuotePropertiesInput>): Promise<QuoteResponse> {
    this.checkInitialized();

    try {
      // Filter out undefined values and ensure string values
      const apiProperties: { [key: string]: string } = Object.fromEntries(
        Object.entries(properties)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => [key, value as string])
      );

      const response = await this.client.crm.quotes.basicApi.update(id, {
        properties: apiProperties
      });

      return {
        id: response.id,
        properties: response.properties as QuoteProperties,
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString()
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to update quote');
    }
  }

  /**
   * Delete a quote
   */
  async deleteQuote(id: string): Promise<void> {
    this.checkInitialized();

    try {
      await this.client.crm.quotes.basicApi.archive(id);
    } catch (error) {
      throw this.handleApiError(error, 'Failed to delete quote');
    }
  }

  /**
   * Create a line item and associate it with a quote
   */
  async addLineItemToQuote(quoteId: string, lineItem: LineItemPropertiesInput): Promise<LineItemResponse> {
    this.checkInitialized();
    this.validateRequired(lineItem, ['name']);

    try {
      // Create the line item with required properties
      const apiProperties: { [key: string]: string } = {
        name: lineItem.name,
        quantity: lineItem.quantity || '1',
        price: lineItem.price || '0'
      };

      // Add optional properties if they exist
      if (lineItem.hs_product_id) apiProperties.hs_product_id = lineItem.hs_product_id;
      if (lineItem.discount) apiProperties.discount = lineItem.discount;
      if (lineItem.hs_discount_percentage) apiProperties.hs_discount_percentage = lineItem.hs_discount_percentage;
      if (lineItem.hs_term_in_months) apiProperties.hs_term_in_months = lineItem.hs_term_in_months;
      if (lineItem.hs_recurring_billing_period) apiProperties.hs_recurring_billing_period = lineItem.hs_recurring_billing_period;
      if (lineItem.description) apiProperties.description = lineItem.description;

      // Create the line item first
      const lineItemResponse = await this.client.crm.lineItems.basicApi.create({
        properties: apiProperties,
        associations: []
      });

      // Use the correct v4 API for creating associations - FROM quote TO line_item
      try {
        // Try the v4 API default association endpoint (quotes -> line_items direction)
        const apiUrl = `https://api.hubapi.com/crm/v4/associations/quotes/line_items/batch/associate/default`;
        const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: [{
              from: { id: quoteId },
              to: { id: lineItemResponse.id }
            }]
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`v4 Association API Error ${response.status}: ${errorText}`);
        }

        const associationResult = await response.json();
        
        // Check if the association was actually created
        if (!associationResult || !associationResult.results || associationResult.results.length === 0) {
          throw new Error(`v4 Association API returned empty results: ${JSON.stringify(associationResult)}`);
        }
        
        // Check for errors in the response
        if (associationResult.numErrors && associationResult.numErrors > 0) {
          const firstError = associationResult.errors && associationResult.errors[0];
          throw new Error(`v4 Association API returned errors: ${firstError ? firstError.message : JSON.stringify(associationResult.errors)}`);
        }
      } catch (associationError) {
        throw new Error(`Failed to create v4 association: ${associationError instanceof Error ? associationError.message : String(associationError)}`);
      }

      try {
        // Wait a moment for the association to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify the association was created by checking if we can find the line item in the quote's associations
        const verifyQuote = await this.client.crm.quotes.basicApi.getById(
          quoteId,
          undefined,
          undefined,
          ['line_items']
        );
        
        // Check both possible key formats for line items associations
        const lineItemsAssociation = verifyQuote.associations?.['line_items'] || verifyQuote.associations?.['line items'];
        const isAssociated = lineItemsAssociation?.results?.some(
          assoc => assoc.id === lineItemResponse.id
        );
        
        if (!isAssociated) {
          const debugInfo = {
            lineItemId: lineItemResponse.id,
            quoteAssociations: verifyQuote.associations || 'null',
            foundLineItems_underscore: verifyQuote.associations?.['line_items']?.results?.map(a => a.id) || [],
            foundLineItems_space: verifyQuote.associations?.['line items']?.results?.map(a => a.id) || []
          };
          throw new Error(`Line item was not properly associated with the quote. Debug: ${JSON.stringify(debugInfo)}`);
        }
        
      } catch (associationError) {
        // If association fails, clean up the created line item
        try {
          await this.client.crm.lineItems.basicApi.archive(lineItemResponse.id);
        } catch (cleanupError) {
          console.warn('Failed to clean up line item after association error:', cleanupError);
        }
        throw new Error(`Failed to associate line item with quote: ${associationError instanceof Error ? associationError.message : String(associationError)}`);
      }

      return {
        id: lineItemResponse.id,
        properties: lineItemResponse.properties as LineItemProperties,
        createdAt: new Date(lineItemResponse.createdAt).toISOString(),
        updatedAt: new Date(lineItemResponse.updatedAt).toISOString()
      };
    } catch (error) {
      // Check if this is a product ID validation error and provide helpful guidance
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Associated product id') && errorMessage.includes('does not exist')) {
        const productIdMatch = errorMessage.match(/Associated product id '(\d+)' does not exist/);
        const productId = productIdMatch ? productIdMatch[1] : 'provided';
        throw this.handleApiError(error, `Failed to add line item to quote: Product ID ${productId} does not exist in your HubSpot product library. Use hubspotProduct operation "list" or "search" to find valid product IDs, or omit the productId to create a custom line item.`);
      }
      throw this.handleApiError(error, 'Failed to add line item to quote');
    }
  }

  /**
   * Get line items for a quote
   */
  async getQuoteLineItems(quoteId: string): Promise<LineItemResponse[]> {
    this.checkInitialized();

    try {
      // Get the quote with line item associations
      const quote = await this.client.crm.quotes.basicApi.getById(
        quoteId,
        undefined,
        undefined,
        ['line_items']
      );

      // Check both possible key formats for line items associations
      const lineItemsAssociation = quote.associations?.['line_items'] || quote.associations?.['line items'];
      
      if (!lineItemsAssociation) {
        return [];
      }

      // Get all line item IDs
      const lineItemIds = lineItemsAssociation.results.map(assoc => assoc.id);

      if (lineItemIds.length === 0) {
        return [];
      }

      // Batch get all line items
      const batchResponse = await this.client.crm.lineItems.batchApi.read({
        inputs: lineItemIds.map(id => ({ id })),
        properties: ['name', 'quantity', 'price', 'amount', 'discount', 'description', 'hs_product_id'],
        propertiesWithHistory: []
      });

      return batchResponse.results.map(item => ({
        id: item.id,
        properties: item.properties as LineItemProperties,
        createdAt: new Date(item.createdAt).toISOString(),
        updatedAt: new Date(item.updatedAt).toISOString()
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get quote line items');
    }
  }

  /**
   * Update a line item
   */
  async updateLineItem(lineItemId: string, updates: Partial<LineItemPropertiesInput>): Promise<LineItemResponse> {
    this.checkInitialized();

    try {
      // Filter out undefined values and ensure string values
      const apiProperties: { [key: string]: string } = Object.fromEntries(
        Object.entries(updates)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => [key, value as string])
      );

      const response = await this.client.crm.lineItems.basicApi.update(lineItemId, {
        properties: apiProperties
      });

      return {
        id: response.id,
        properties: response.properties as LineItemProperties,
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString()
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to update line item');
    }
  }

  /**
   * Remove a line item from a quote
   */
  async removeLineItemFromQuote(quoteId: string, lineItemId: string): Promise<void> {
    this.checkInitialized();

    try {
      // First, verify the line item exists and is associated with the quote
      const currentLineItems = await this.getQuoteLineItems(quoteId);
      const lineItemExists = currentLineItems.some(item => item.id === lineItemId);
      
      if (!lineItemExists) {
        throw new Error(`Line item ${lineItemId} is not associated with quote ${quoteId} or does not exist`);
      }

      // Remove association using the correct v4 API archive endpoint
      const apiUrl = `https://api.hubapi.com/crm/v4/associations/quotes/line_items/batch/archive`;
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: [{
            from: { id: quoteId },
            to: [{ id: lineItemId }]
          }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to remove association: ${response.status}: ${errorText}`);
      }

      // Delete the line item
      await this.client.crm.lineItems.basicApi.archive(lineItemId);
    } catch (error) {
      throw this.handleApiError(error, 'Failed to remove line item from quote');
    }
  }
}