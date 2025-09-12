/**
 * Search Contacts Tool
 * 
 * Provides functionality to search for contacts in HubSpot by email or name.
 * Part of the Contacts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for search contacts tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    searchType: {
      type: 'string',
      description: 'Type of search to perform',
      enum: ['email', 'name']
    },
    searchTerm: {
      type: 'string',
      description: 'Term to search for (email or name)'
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return',
      minimum: 1,
      maximum: 100,
      default: 10
    }
  },
  required: ['searchType', 'searchTerm']
};

/**
 * Search contacts tool definition
 */
export const tool: ToolDefinition = {
  name: 'search',
  description: 'Search for contacts by email or name',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Search contacts
      let contacts;
      if (params.searchType === 'email') {
        contacts = await apiClient.searchContactsByEmail(
          params.searchTerm,
          params.limit || 10,
          true  // Include associations to get company data
        );
      } else {
        contacts = await apiClient.searchContactsByName(
          params.searchTerm,
          params.limit || 10,
          true  // Include associations to get company data
        );
      }
      
      // Transform results
      const results = contacts.map(contact => ({
        id: contact.id,
        email: contact.properties.email,
        firstName: contact.properties.firstname,
        lastName: contact.properties.lastname,
        company: contact.properties.company || contact.properties.associatedCompanyName || null,
        associatedCompanyId: contact.properties.associatedCompanyId || null,
        associatedCompanyName: contact.properties.associatedCompanyName || null,
        phone: contact.properties.phone || null,
        createdAt: contact.createdAt,
        associations: contact.associations || null
      }));
      
      return {
        message: `Found ${results.length} contacts`,
        contacts: results,
        count: results.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to search contacts',
        contacts: [],
        count: 0,
        error: errorMessage
      };
    }
  }
};
