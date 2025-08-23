/**
 * Create Association Tool
 *
 * Provides functionality to create associations between objects in HubSpot.
 * Part of the Associations BCP.
 */

import { ToolDefinition, InputSchema, BcpError } from '../../core/types.js';
import { AssociationsService, AssociationType } from './associations.service.js';
import { ServiceConfig } from '../../core/types.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    fromObjectType: {
      type: 'string',
      description: 'The type of the first object (e.g., "contacts", "companies")',
    },
    fromObjectId: {
      type: 'string',
      description: 'The ID of the first object',
    },
    toObjectType: {
      type: 'string',
      description: 'The type of the second object',
    },
    toObjectId: {
      type: 'string',
      description: 'The ID of the second object',
    },
    associationTypes: {
      type: 'array',
      description: 'The types of associations to create',
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
  required: ['fromObjectType', 'fromObjectId', 'toObjectType', 'toObjectId', 'associationTypes'],
  examples: [
    {
      fromObjectType: 'contacts',
      fromObjectId: '123',
      toObjectType: 'companies',
      toObjectId: '456',
      associationTypes: [
        {
          associationCategory: 'HUBSPOT_DEFINED',
          associationTypeId: 1
        }
      ]
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'createAssociation',
  description: 'Create an association between two objects in HubSpot',
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
      const { fromObjectType, fromObjectId, toObjectType, toObjectId, associationTypes } = params;
      
      await associationsService.createAssociation(
        fromObjectType,
        fromObjectId,
        toObjectType,
        toObjectId,
        associationTypes as AssociationType[]
      );

      return {
        message: `Successfully created association between ${fromObjectType}/${fromObjectId} and ${toObjectType}/${toObjectId}`,
        details: {
          fromObjectType,
          fromObjectId,
          toObjectType,
          toObjectId,
          associationTypes
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to create association: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
