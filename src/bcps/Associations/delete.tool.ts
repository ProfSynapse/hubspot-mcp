/**
 * Delete Association Tool
 *
 * Provides functionality to delete associations between objects in HubSpot.
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
  },
  required: ['fromObjectType', 'fromObjectId', 'toObjectType', 'toObjectId'],
  examples: [
    {
      fromObjectType: 'contacts',
      fromObjectId: '123',
      toObjectType: 'companies',
      toObjectId: '456'
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'deleteAssociation',
  description: 'Delete all associations between two objects in HubSpot',
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
      const { fromObjectType, fromObjectId, toObjectType, toObjectId } = params;
      
      await associationsService.deleteAssociation(
        fromObjectType,
        fromObjectId,
        toObjectType,
        toObjectId
      );

      return {
        message: `Successfully deleted all associations between ${fromObjectType}/${fromObjectId} and ${toObjectType}/${toObjectId}`,
        details: {
          fromObjectType,
          fromObjectId,
          toObjectType,
          toObjectId
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to delete association: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
