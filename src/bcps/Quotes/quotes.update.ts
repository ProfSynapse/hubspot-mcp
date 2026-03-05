/**
 * Update Quote Tool
 * 
 * Provides functionality to update existing quotes in HubSpot.
 * Part of the Quotes BCP.
 */

import { ToolDefinition, InputSchema, ServiceConfig } from '../../core/types.js';
import { QuotesService } from './quotes.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

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
 * Valid HubSpot currency codes
 */
const VALID_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'JPY',
  'CNY',
  'INR',
  'BRL',
  'MXN'
];

/**
 * Valid payment types
 */
const VALID_PAYMENT_TYPES = [
  'OFFLINE',
  'ONLINE'
];

/**
 * Input schema for update quote tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Quote ID (required)'
    },
    title: {
      type: 'string',
      description: 'Quote title'
    },
    expirationDate: {
      type: 'string',
      description: 'Quote expiration date (ISO 8601 format)'
    },
    status: {
      type: 'string',
      description: 'Quote status',
      enum: VALID_STATUSES
    },
    currency: {
      type: 'string',
      description: 'Currency code',
      enum: VALID_CURRENCIES
    },
    language: {
      type: 'string',
      description: 'Language code (e.g., en, es, fr)'
    },
    locale: {
      type: 'string',
      description: 'Locale code (e.g., en-US, es-MX)'
    },
    senderCompanyName: {
      type: 'string',
      description: 'Sender company name'
    },
    senderCompanyAddress: {
      type: 'string',
      description: 'Sender company address'
    },
    senderCompanyCity: {
      type: 'string',
      description: 'Sender company city'
    },
    senderCompanyState: {
      type: 'string',
      description: 'Sender company state/province'
    },
    senderCompanyZip: {
      type: 'string',
      description: 'Sender company postal code'
    },
    senderCompanyCountry: {
      type: 'string',
      description: 'Sender company country'
    },
    senderFirstName: {
      type: 'string',
      description: 'Sender first name'
    },
    senderLastName: {
      type: 'string',
      description: 'Sender last name'
    },
    senderEmail: {
      type: 'string',
      description: 'Sender email address'
    },
    senderPhone: {
      type: 'string',
      description: 'Sender phone number'
    },
    senderJobTitle: {
      type: 'string',
      description: 'Sender job title'
    },
    esignEnabled: {
      type: 'boolean',
      description: 'Enable e-signature'
    },
    paymentEnabled: {
      type: 'boolean',
      description: 'Enable payment collection'
    },
    paymentType: {
      type: 'string',
      description: 'Payment type',
      enum: VALID_PAYMENT_TYPES
    },
    collectBillingAddress: {
      type: 'boolean',
      description: 'Collect billing address'
    },
    collectShippingAddress: {
      type: 'boolean',
      description: 'Collect shipping address'
    },
    showSignatureBox: {
      type: 'boolean',
      description: 'Show signature box'
    },
    showCountersignatureBox: {
      type: 'boolean',
      description: 'Show countersignature box'
    },
    domain: {
      type: 'string',
      description: 'Quote domain'
    },
    additionalProperties: {
      type: 'object',
      description: 'Additional quote properties',
      properties: {}
    }
  },
  required: ['id']
};

/**
 * Update quote tool definition
 */
export const tool: ToolDefinition = {
  name: 'update',
  description: 'Update an existing quote in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create service instance
      const config = { hubspotAccessToken: apiKey };
      const service = new QuotesService(config);
      await service.init();
      
      // Prepare quote properties (excluding id)
      const { id, ...updateParams } = params;
      const properties: Record<string, any> = {};
      
      if (updateParams.title) properties.hs_title = updateParams.title;
      if (updateParams.expirationDate) properties.hs_expiration_date = updateParams.expirationDate;
      if (updateParams.status) properties.hs_status = updateParams.status;
      if (updateParams.currency) properties.hs_currency = updateParams.currency;
      if (updateParams.language) properties.hs_language = updateParams.language;
      if (updateParams.locale) properties.hs_locale = updateParams.locale;
      if (updateParams.senderCompanyName) properties.hs_sender_company_name = updateParams.senderCompanyName;
      if (updateParams.senderCompanyAddress) properties.hs_sender_company_address = updateParams.senderCompanyAddress;
      if (updateParams.senderCompanyCity) properties.hs_sender_company_city = updateParams.senderCompanyCity;
      if (updateParams.senderCompanyState) properties.hs_sender_company_state = updateParams.senderCompanyState;
      if (updateParams.senderCompanyZip) properties.hs_sender_company_zip = updateParams.senderCompanyZip;
      if (updateParams.senderCompanyCountry) properties.hs_sender_company_country = updateParams.senderCompanyCountry;
      if (updateParams.senderFirstName) properties.hs_sender_firstname = updateParams.senderFirstName;
      if (updateParams.senderLastName) properties.hs_sender_lastname = updateParams.senderLastName;
      if (updateParams.senderEmail) properties.hs_sender_email = updateParams.senderEmail;
      if (updateParams.senderPhone) properties.hs_sender_phone = updateParams.senderPhone;
      if (updateParams.senderJobTitle) properties.hs_sender_jobtitle = updateParams.senderJobTitle;
      if (updateParams.esignEnabled !== undefined) properties.hs_esign_enabled = String(updateParams.esignEnabled);
      if (updateParams.paymentEnabled !== undefined) properties.hs_payment_enabled = String(updateParams.paymentEnabled);
      if (updateParams.paymentType) properties.hs_payment_type = updateParams.paymentType;
      if (updateParams.collectBillingAddress !== undefined) properties.hs_collect_billing_address = String(updateParams.collectBillingAddress);
      if (updateParams.collectShippingAddress !== undefined) properties.hs_collect_shipping_address = String(updateParams.collectShippingAddress);
      if (updateParams.showSignatureBox !== undefined) properties.hs_show_signature_box = String(updateParams.showSignatureBox);
      if (updateParams.showCountersignatureBox !== undefined) properties.hs_show_countersignature_box = String(updateParams.showCountersignatureBox);
      if (updateParams.domain) properties.hs_domain = updateParams.domain;
      
      // Add any additional properties
      if (updateParams.additionalProperties) {
        Object.assign(properties, updateParams.additionalProperties);
      }
      
      // Check if we have any properties to update
      if (Object.keys(properties).length === 0) {
        return {
          message: 'No properties provided for update',
          error: 'At least one property must be provided to update the quote'
        };
      }
      
      // Update quote
      const quote = await service.updateQuote(id, properties);
      
      const response = {
        message: 'Quote updated successfully',
        quote: {
          id: quote.id,
          properties: quote.properties,
          updatedAt: quote.updatedAt
        }
      };
      
      return enhanceResponse(response, 'update', params, 'Quotes');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to update quote',
        error: errorMessage
      };
    }
  }
};