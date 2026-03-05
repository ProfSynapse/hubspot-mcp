/**
 * Batch Create Default Associations Tool
 *
 * Provides functionality to create multiple default associations between objects in HubSpot in a single request.
 * Part of the Associations BCP.
 */

import { ToolDefinition, InputSchema, BcpError } from '../../core/types.js';
import { AssociationsService, Association } from './associations.service.js';
import { ServiceConfig } from '../../core/types.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    fromObjectType: {
      type: 'string',
      description: 'The type of the first objects (e.g., "contacts", "companies")',
    },
    toObjectType: {
      type: 'string',
      description: 'The type of the second objects',
    },
    associations: {
      type: 'array',
      description: 'The associations to create',
      items: {
        type: 'object',
        properties: {
          from: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The ID of the first object',
              },
            },
            required: ['id'],
          },
          to: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The ID of the second object',
              },
            },
            required: ['id'],
          },
        },
        required: ['from', 'to'],
      },
    },
  },
  required: ['fromObjectType', 'toObjectType', 'associations'],
  examples: [
    {
      fromObjectType: 'contacts',
      toObjectType: 'companies',
      associations: [
        {
          from: { id: '123' },
          to: { id: '456' }
        },
        {
          from: { id: '789' },
          to: { id: '012' }
        }
      ]
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'batchCreateDefaultAssociations',
  description: 'Create multiple default associations between objects in HubSpot in a single request',
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
      const { fromObjectType, toObjectType, associations } = params;
      
      const result: Association[] = await associationsService.batchCreateDefaultAssociations(
        fromObjectType,
        toObjectType,
        associations
      );

      return {
        message: `Successfully created ${result.length} default associations between ${fromObjectType} and ${toObjectType}`,
        createdAssociations: result,
        details: {
          fromObjectType,
          toObjectType,
          count: result.length
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to batch create default associations: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
