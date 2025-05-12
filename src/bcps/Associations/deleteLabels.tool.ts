/**
 * Delete Association Labels Tool
 *
 * Provides functionality to delete specific association labels between objects in HubSpot.
 * Part of the Associations BCP.
 */

import { ToolDefinition, InputSchema, BcpError } from '../../core/types.js';
import { AssociationsService, AssociationInput } from './associations.service.js';
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
      description: 'The association labels to delete',
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
          types: {
            type: 'array',
            description: 'The types of associations to delete',
            items: {
              type: 'object',
              properties: {
                associationCategory: {
                  type: 'string',
                  description: 'The category of the association',
                  enum: ['HUBSPOT_DEFINED', 'USER_DEFINED', 'INTEGRATOR_DEFINED'],
                },
                associationTypeId: {
                  type: 'integer',
                  description: 'The ID of the association type',
                },
              },
              required: ['associationCategory', 'associationTypeId'],
            },
          },
        },
        required: ['from', 'to', 'types'],
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
          to: { id: '456' },
          types: [
            {
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: 1
            }
          ]
        }
      ]
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'deleteAssociationLabels',
  description: 'Delete specific association labels between objects in HubSpot',
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
      
      await associationsService.batchDeleteAssociationLabels(
        fromObjectType,
        toObjectType,
        associations as AssociationInput[]
      );

      // Count total number of association labels deleted
      const totalLabelsDeleted = associations.reduce((count: number, assoc: any) => count + assoc.types.length, 0);

      return {
        message: `Successfully deleted ${totalLabelsDeleted} association labels between ${fromObjectType} and ${toObjectType}`,
        details: {
          fromObjectType,
          toObjectType,
          count: totalLabelsDeleted
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to delete association labels: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
