/**
 * Recent Contacts Tool
 * 
 * Provides functionality to retrieve recently created or updated contacts in HubSpot.
 * Part of the Contacts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';
import { AssociationType, AssociationOptions } from '../../core/association-enrichment-engine.js';
import { enhanceContactsResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for recent contacts tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      description: 'Operation type (always "recent" for this tool)',
      enum: ['recent'],
      default: 'recent'
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return',
      minimum: 1,
      maximum: 100,
      default: 10
    },
    includeAssociations: {
      type: 'boolean',
      description: 'Include associated data (companies, deals, notes, etc.)',
      default: false
    },
    associationTypes: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['companies', 'deals', 'tickets', 'notes', 'tasks', 'meetings', 'calls', 'emails', 'quotes']
      },
      description: 'Types of associations to retrieve (enum ensures valid selection)',
      default: ['companies'],
      minItems: 1,
      maxItems: 9
    },
    associationLimit: {
      type: 'integer',
      description: 'Maximum number of associations per type to retrieve',
      minimum: 1,
      maximum: 500,
      default: 50
    }
  },
  required: []
};

/**
 * Recent contacts tool definition
 */
export const tool: ToolDefinition = {
  name: 'recent',
  description: 'Get recently created or updated contacts with optional association data',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';

      // Create API client
      const apiClient = createHubspotApiClient(apiKey);

      // Prepare association options if requested
      let associationOptions: AssociationOptions | undefined;
      if (params.includeAssociations && params.associationTypes && params.associationTypes.length > 0) {
        associationOptions = {
          associationTypes: params.associationTypes as AssociationType[],
          associationLimit: params.associationLimit || 50
        };
      }

      // Get recent contacts
      const contacts = await apiClient.getRecentContacts(params.limit || 10, associationOptions);

      // Transform results
      const results = contacts.map(contact => ({
        id: contact.id,
        email: contact.properties.email,
        firstName: contact.properties.firstname,
        lastName: contact.properties.lastname,
        company: contact.properties.company || null,
        phone: contact.properties.phone || null,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
        associations: contact.associations || null,
        associationMetadata: contact.associationMetadata || null
      }));

      const response = {
        message: `Retrieved ${results.length} recent contacts${params.includeAssociations ? ' with associations' : ''}`,
        contacts: results,
        count: results.length
      };

      // Enhance response with contextual suggestions
      return enhanceContactsResponse(response, 'recent', params);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResponse = {
        message: 'Failed to get recent contacts',
        contacts: [],
        count: 0,
        error: errorMessage
      };

      // Enhance error response with suggestions
      return enhanceContactsResponse(errorResponse, 'recent', params);
    }
  }
};
