/**
 * Batch Delete Associations Tool
 *
 * Provides functionality to delete multiple associations between objects in HubSpot in a single request.
 * Part of the Associations BCP.
 */

import { ToolDefinition, InputSchema, BcpError } from '../../core/types.js';
import { AssociationsService } from './associations.service.js';
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
      description: 'The associations to delete',
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
            type: 'array',
            description: 'The IDs of the second objects to disassociate',
            items: {
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
          to: [
            { id: '456' },
            { id: '789' }
          ]
        },
        {
          from: { id: '012' },
          to: [
            { id: '345' }
          ]
        }
      ]
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'batchDeleteAssociations',
  description: 'Delete multiple associations between objects in HubSpot in a single request',
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
      
      await associationsService.batchDeleteAssociations(
        fromObjectType,
        toObjectType,
        associations
      );

      // Count total number of associations deleted
      const totalDeleted = associations.reduce((count: number, assoc: { from: { id: string }, to: Array<{ id: string }> }) => count + assoc.to.length, 0);

      return {
        message: `Successfully deleted ${totalDeleted} associations between ${fromObjectType} and ${toObjectType}`,
        details: {
          fromObjectType,
          toObjectType,
          count: totalDeleted
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to batch delete associations: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
