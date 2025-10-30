/**
 * Properties Search Tool
 * Location: /mnt/c/Users/Joseph/Documents/Code/hubspot-mcp/src/bcps/Properties/properties.search.ts
 *
 * Performs fuzzy search on property schemas to find relevant properties without overwhelming
 * the LLM context window. Uses fuse.js for intelligent matching with typo tolerance.
 *
 * Used by: MCP tool registration system (properties.index.ts)
 * Uses: PropertiesService for API operations and caching, response-enhancer for suggestions
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { PropertiesService } from './properties.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    objectType: {
      type: 'string',
      description: 'The HubSpot object type (contacts, companies, deals, tickets, etc.)'
    },
    query: {
      type: 'string',
      description: 'Search query to match against property name, label, description, or group. Examples: "email", "phone", "custom", "deal amount"',
      minLength: 1
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return (default: 15, max: 50)',
      minimum: 1,
      maximum: 50,
      default: 15
    },
    includeArchived: {
      type: 'boolean',
      description: 'Include archived properties in search (default: false)',
      default: false
    },
    groupName: {
      type: 'string',
      description: 'Optional: Filter results to a specific property group'
    }
  },
  required: ['objectType', 'query'],
  examples: [
    {
      objectType: 'contacts',
      query: 'email',
      description: 'Find all email-related properties for contacts'
    },
    {
      objectType: 'deals',
      query: 'amount',
      limit: 10,
      description: 'Find deal amount properties, return top 10'
    },
    {
      objectType: 'companies',
      query: 'industry',
      groupName: 'companyinformation',
      description: 'Find industry properties in company information group'
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'searchProperties',
  description: 'Search for property schemas using fuzzy matching. Returns only the most relevant properties to minimize context usage. Use this instead of listProperties when looking for specific properties.',
  inputSchema,
  handler: async (params) => {
    const tempConfig: ServiceConfig = {
      hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN || '',
    };

    if (!tempConfig.hubspotAccessToken) {
      throw new BcpError('HubSpot access token is missing', 'AUTH_ERROR', 401);
    }

    const service = new PropertiesService(tempConfig);
    await service.init();

    try {
      const results = await service.searchProperties({
        objectType: params.objectType,
        query: params.query,
        limit: params.limit || 15,
        includeArchived: params.includeArchived || false,
        groupName: params.groupName
      });

      const response = {
        message: `Found ${results.length} properties matching "${params.query}" for ${params.objectType}`,
        results: results
      };

      return enhanceResponse(response, 'search', params, 'Properties');
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      throw new BcpError(
        `Failed to search properties for ${params.objectType}: ${error instanceof Error ? error.message : String(error)}`,
        'API_ERROR',
        500
      );
    }
  }
};
