/**
 * Get Contact Tool
 * 
 * Provides functionality to retrieve a contact by ID from HubSpot.
 * Part of the Contacts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';
import { AssociationType, AssociationOptions } from '../../core/association-enrichment-engine.js';
import { enhanceContactsResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for get contact tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'HubSpot contact ID (required)'
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
  required: ['id']
};

/**
 * Get contact tool definition
 */
export const tool: ToolDefinition = {
  name: 'get',
  description: 'Get a contact by ID from HubSpot with optional association data',
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

      // Get contact
      const contact = await apiClient.getContact(params.id, associationOptions);

      const response = {
        message: `Retrieved contact${params.includeAssociations ? ' with associations' : ''}`,
        contact: {
          id: contact.id,
          email: contact.properties.email,
          firstName: contact.properties.firstname,
          lastName: contact.properties.lastname,
          company: contact.properties.company || null,
          phone: contact.properties.phone || null,
          properties: contact.properties,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
          associations: contact.associations || null,
          associationMetadata: contact.associationMetadata || null
        }
      };

      // Enhance response with contextual suggestions
      return enhanceContactsResponse(response, 'get', params);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResponse = {
        message: 'Failed to get contact',
        error: errorMessage
      };

      // Enhance error response with suggestions
      return enhanceContactsResponse(errorResponse, 'get', params);
    }
  }
};
