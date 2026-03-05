/**
 * Create Quote Tool
 * 
 * Provides functionality to create new quotes in HubSpot.
 * Part of the Quotes BCP.
 */

import { ToolDefinition, InputSchema, ServiceConfig } from '../../core/types.js';
import { QuotesService, QuotePropertiesInput } from './quotes.service.js';

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
 * Input schema for create quote tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Quote title (required)'
    },
    expirationDate: {
      type: 'string',
      description: 'Quote expiration date (YYYY-MM-DD format, e.g., 2025-07-12)'
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
      description: 'Language code (e.g., en, es, fr) - defaults to "en" if not specified'
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
  required: ['title']
};

/**
 * Create quote tool definition
 */
export const tool: ToolDefinition = {
  name: 'create',
  description: 'Create a new quote in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create service instance
      const config = { hubspotAccessToken: apiKey };
      const service = new QuotesService(config);
      await service.init();
      
      // Prepare quote properties
      const properties: QuotePropertiesInput = {
        hs_title: params.title,
        hs_language: params.language || 'en', // Default to English if not specified
        ...(params.expirationDate && { 
          hs_expiration_date: params.expirationDate.includes('T') 
            ? params.expirationDate.split('T')[0] // Extract date part if datetime provided
            : params.expirationDate 
        }),
        ...(params.status && { hs_status: params.status }),
        ...(params.currency && { hs_currency: params.currency }),
        ...(params.locale && { hs_locale: params.locale }),
        ...(params.senderCompanyName && { hs_sender_company_name: params.senderCompanyName }),
        ...(params.senderCompanyAddress && { hs_sender_company_address: params.senderCompanyAddress }),
        ...(params.senderCompanyCity && { hs_sender_company_city: params.senderCompanyCity }),
        ...(params.senderCompanyState && { hs_sender_company_state: params.senderCompanyState }),
        ...(params.senderCompanyZip && { hs_sender_company_zip: params.senderCompanyZip }),
        ...(params.senderCompanyCountry && { hs_sender_company_country: params.senderCompanyCountry }),
        ...(params.senderFirstName && { hs_sender_firstname: params.senderFirstName }),
        ...(params.senderLastName && { hs_sender_lastname: params.senderLastName }),
        ...(params.senderEmail && { hs_sender_email: params.senderEmail }),
        ...(params.senderPhone && { hs_sender_phone: params.senderPhone }),
        ...(params.senderJobTitle && { hs_sender_jobtitle: params.senderJobTitle }),
        ...(params.esignEnabled !== undefined && { hs_esign_enabled: String(params.esignEnabled) }),
        ...(params.paymentEnabled !== undefined && { hs_payment_enabled: String(params.paymentEnabled) }),
        ...(params.paymentType && { hs_payment_type: params.paymentType }),
        ...(params.collectBillingAddress !== undefined && { hs_collect_billing_address: String(params.collectBillingAddress) }),
        ...(params.collectShippingAddress !== undefined && { hs_collect_shipping_address: String(params.collectShippingAddress) }),
        ...(params.showSignatureBox !== undefined && { hs_show_signature_box: String(params.showSignatureBox) }),
        ...(params.showCountersignatureBox !== undefined && { hs_show_countersignature_box: String(params.showCountersignatureBox) }),
        ...(params.domain && { hs_domain: params.domain }),
        ...(params.additionalProperties || {})
      };
      
      // Create quote
      const quote = await service.createQuote(properties);
      
      return {
        message: 'Quote created successfully',
        quote: {
          id: quote.id,
          title: quote.properties.hs_title,
          status: quote.properties.hs_status,
          createdAt: quote.createdAt
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to create quote',
        error: errorMessage
      };
    }
  }
};