/**
 * Get Association Types Tool
 * 
 * This tool allows users to discover valid association types between two object types in HubSpot.
 * It queries the HubSpot API to retrieve the available association types and their labels.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { AssociationsService } from './associations.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    fromObjectType: {
      type: 'string',
      description: 'The source object type (e.g., "contacts", "companies", "notes")',
    },
    toObjectType: {
      type: 'string',
      description: 'The target object type (e.g., "contacts", "companies", "deals")',
    },
    useCache: {
      type: 'boolean',
      description: 'Whether to use cached association types instead of querying the API (default: true)',
    }
  },
  required: ['fromObjectType', 'toObjectType'],
  examples: [
    {
      fromObjectType: 'notes',
      toObjectType: 'contacts'
    },
    {
      fromObjectType: 'contacts',
      toObjectType: 'companies',
      useCache: false
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'getAssociationTypes',
  description: 'Get available association types between two object types in HubSpot',
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
      const { fromObjectType, toObjectType, useCache = true } = params;
      
      // Validate required parameters
      if (!fromObjectType) {
        throw new BcpError('Source object type (fromObjectType) is required.', 'VALIDATION_ERROR', 400);
      }
      
      if (!toObjectType) {
        throw new BcpError('Target object type (toObjectType) is required.', 'VALIDATION_ERROR', 400);
      }
      
      // If useCache is true, try to get association types from the cache first
      if (useCache) {
        const cachedTypes = associationsService.getAssociationTypes(fromObjectType, toObjectType);
        
        if (cachedTypes) {
          return {
            message: `Found ${Object.keys(cachedTypes).length} association types between ${fromObjectType} and ${toObjectType} in cache`,
            associationTypes: cachedTypes,
            fromObjectType,
            toObjectType,
            source: 'cache'
          };
        }
      }
      
      // If not using cache or no cached types found, query the API
      try {
        // Normalize object types (e.g., 'contact' -> 'contacts')
        const normalizedFromType = fromObjectType.toLowerCase().endsWith('s')
          ? fromObjectType.toLowerCase()
          : `${fromObjectType.toLowerCase()}s`;
        
        const normalizedToType = toObjectType.toLowerCase().endsWith('s')
          ? toObjectType.toLowerCase()
          : `${toObjectType.toLowerCase()}s`;
        
        // Query the HubSpot API for association types
        const response = await associationsService.getAssociationTypesFromApi(
          normalizedFromType,
          normalizedToType
        );
        
        // Format the response
        const apiTypes: Record<string, number> = {};
        if (response && response.results) {
          for (const result of response.results) {
            apiTypes[result.label.toLowerCase()] = result.typeId;
          }
        }
        
        return {
          message: `Found ${Object.keys(apiTypes).length} association types between ${fromObjectType} and ${toObjectType} from API`,
          associationTypes: apiTypes,
          fromObjectType: normalizedFromType,
          toObjectType: normalizedToType,
          source: 'api',
          apiResponse: response
        };
      } catch (apiError) {
        // If API call fails, try the cache as a fallback
        if (!useCache) {
          const cachedTypes = associationsService.getAssociationTypes(fromObjectType, toObjectType);
          
          if (cachedTypes) {
            return {
              message: `API call failed, but found ${Object.keys(cachedTypes).length} association types in cache`,
              associationTypes: cachedTypes,
              fromObjectType,
              toObjectType,
              source: 'cache (fallback)',
              apiError: apiError instanceof Error ? apiError.message : String(apiError)
            };
          }
        }
        
        // If no fallback available, throw the error
        throw apiError;
      }
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to get association types: ${errorMessage}`,
        (error as any).category || 'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};

export default tool;
