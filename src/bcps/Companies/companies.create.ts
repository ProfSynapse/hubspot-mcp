/**
 * Create Company Tool
 * 
 * Provides functionality to create new companies in HubSpot.
 * Part of the Companies BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Valid HubSpot industry values
 * These are the allowed values for the industry property in HubSpot
 */
const VALID_INDUSTRIES = [
  'ACCOUNTING',
  'ADVERTISING',
  'AEROSPACE',
  'AGRICULTURE',
  'APPAREL',
  'BANKING',
  'BIOTECHNOLOGY',
  'CHEMICALS',
  'COMMUNICATIONS',
  'CONSTRUCTION',
  'CONSULTING',
  'CONSUMER_GOODS',
  'CONSUMER_SERVICES',
  'EDUCATION',
  'ELECTRONICS',
  'ENERGY',
  'ENGINEERING',
  'ENTERTAINMENT',
  'ENVIRONMENTAL',
  'FINANCE',
  'FOOD_BEVERAGE',
  'GOVERNMENT',
  'HEALTHCARE',
  'HOSPITALITY',
  'INSURANCE',
  'LEGAL',
  'MANUFACTURING',
  'MEDIA',
  'MINING',
  'NON_PROFIT',
  'PHARMACEUTICALS',
  'REAL_ESTATE',
  'RECREATION',
  'RETAIL',
  'SHIPPING',
  'TECHNOLOGY',
  'TELECOMMUNICATIONS',
  'TRANSPORTATION',
  'UTILITIES',
  'COMPUTER_SOFTWARE',
  'COMPUTER_HARDWARE',
  'IT_SERVICES',
  'MILITARY',
  'RELIGIOUS',
  'RESEARCH',
  'SPORTS',
  'OTHER'
];

/**
 * Input schema for create company tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Company name (required)'
    },
    domain: {
      type: 'string',
      description: 'Company website domain'
    },
    industry: {
      type: 'string',
      description: 'Company industry (must be a valid HubSpot industry value)',
      enum: VALID_INDUSTRIES
    },
    description: {
      type: 'string',
      description: 'Company description'
    },
    additionalProperties: {
      type: 'object',
      description: 'Additional company properties',
      properties: {}
    }
  },
  required: ['name']
};

/**
 * Create company tool definition
 */
export const tool: ToolDefinition = {
  name: 'create',
  description: 'Create a new company in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Prepare company properties
      const properties: Record<string, any> = {
        name: params.name,
        ...(params.domain && { domain: params.domain }),
        ...(params.industry && { industry: params.industry }),
        ...(params.description && { description: params.description }),
        ...(params.additionalProperties || {})
      };
      
      // Create company
      const company = await apiClient.createCompany(properties);
      
      return {
        message: 'Company created successfully',
        company: {
          id: company.id,
          name: company.properties.name,
          domain: company.properties.domain,
          createdAt: company.createdAt
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to create company',
        error: errorMessage
      };
    }
  }
};
