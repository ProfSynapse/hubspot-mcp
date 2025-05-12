/**
 * List Associations Tool
 *
 * Provides functionality to list associations for an object in HubSpot.
 * Part of the Associations BCP.
 */

import { ToolDefinition, InputSchema, BcpError } from '../../core/types.js';
import { AssociationsService, AssociationListResult } from './associations.service.js';
import { ServiceConfig } from '../../core/types.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    objectType: {
      type: 'string',
      description: 'The type of the object (e.g., "contacts", "companies")',
    },
    objectId: {
      type: 'string',
      description: 'The ID of the object',
    },
    toObjectType: {
      type: 'string',
      description: 'The type of associated objects to list',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return (default: 500, max: 500)',
      minimum: 1,
      maximum: 500,
      default: 500,
    },
    after: {
      type: 'string',
      description: 'Pagination cursor for retrieving the next page of results',
    },
  },
  required: ['objectType', 'objectId', 'toObjectType'],
  examples: [
    {
      objectType: 'contacts',
      objectId: '123',
      toObjectType: 'companies',
      limit: 100
    },
    {
      objectType: 'companies',
      objectId: '456',
      toObjectType: 'contacts',
      after: 'next_page_token'
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'listAssociations',
  description: 'List associations for an object in HubSpot',
  inputSchema,
  handler: async (params) => {
    const tempConfig: ServiceConfig = {
      hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN || '',
    };

    if (!tempConfig.hubspotAccessToken) {
      throw new BcpError(
        'HubSpot access token is missing. Please ensure HUBSPOT_ACCESS_TOKEN is set.',
        'AUTH_ERROR',
        401
      );
    }

    const associationsService = new AssociationsService(tempConfig);
    await associationsService.init();

    try {
      const { objectType, objectId, toObjectType, limit, after } = params;
      
      const result: AssociationListResult = await associationsService.listAssociations(
        objectType,
        objectId,
        toObjectType,
        limit,
        after
      );

      // Ensure result.results exists and is an array
      const associations = Array.isArray(result.results) ? result.results : [];
      const count = associations.length;

      return {
        message: `Successfully retrieved ${count} associations for ${objectType}/${objectId} to ${toObjectType}`,
        associations: associations,
        pagination: result.paging,
        details: {
          objectType,
          objectId,
          toObjectType,
          limit,
          after
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to list associations: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
