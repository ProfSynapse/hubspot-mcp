/**
 * Batch Read Associations Tool
 *
 * Provides functionality to read multiple associations between objects in HubSpot in a single request.
 * Part of the Associations BCP.
 */

import { ToolDefinition, InputSchema, BcpError } from '../../core/types.js';
import { AssociationsService, AssociationBatchReadResult } from './associations.service.js';
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
    inputs: {
      type: 'array',
      description: 'The objects to read associations for',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The ID of the object to read associations for',
          },
          after: {
            type: 'string',
            description: 'Pagination cursor for retrieving the next page of results',
          },
        },
        required: ['id'],
      },
    },
  },
  required: ['fromObjectType', 'toObjectType', 'inputs'],
  examples: [
    {
      fromObjectType: 'contacts',
      toObjectType: 'companies',
      inputs: [
        { id: '123' },
        { id: '456', after: 'next_page_token' }
      ]
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'batchReadAssociations',
  description: 'Read multiple associations between objects in HubSpot in a single request',
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
      let { fromObjectType, toObjectType, inputs } = params;
      
      // If fromObjectType is not provided, try to infer it from the inputs
      if (!fromObjectType && inputs && inputs.length > 0 && inputs[0].type) {
        fromObjectType = inputs[0].type;
        console.log(`Inferred fromObjectType from inputs: ${fromObjectType}`);
      }
      
      // Validate required parameters
      if (!fromObjectType || !toObjectType) {
        throw new BcpError(
          'Object types are required for batch reading associations',
          'VALIDATION_ERROR',
          400
        );
      }
      
      // Define an interface for the input items
      interface InputItem {
        id: string;
        after?: string;
        type?: string;
        [key: string]: any; // Allow other properties
      }
      
      // Prepare inputs for the service call (remove 'type' property if present)
      const processedInputs = inputs.map((input: InputItem) => {
        const { id, after } = input;
        return { id, after };
      });
      
      const result: AssociationBatchReadResult = await associationsService.batchReadAssociations(
        fromObjectType,
        toObjectType,
        processedInputs
      );

      // Count total number of associations found
      const totalAssociations = result.results.reduce((count: number, item: any) => {
        return count + (item.to ? item.to.length : 0);
      }, 0);

      return {
        message: `Successfully read ${totalAssociations} associations between ${fromObjectType} and ${toObjectType}`,
        results: result.results,
        details: {
          fromObjectType,
          toObjectType,
          count: totalAssociations
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to batch read associations: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
