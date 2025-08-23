/**
 * Get Association Type Reference Tool
 * 
 * This tool provides a reference table of common association types between different HubSpot objects.
 * It helps users understand which association type IDs to use for different object type combinations.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { AssociationsService } from './associations.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    fromObjectType: {
      type: 'string',
      description: 'Optional: Filter reference by source object type (e.g., "notes", "contacts")',
    },
    toObjectType: {
      type: 'string',
      description: 'Optional: Filter reference by target object type (e.g., "contacts", "companies")',
    }
  },
  required: [], // No required parameters
  examples: [
    {}, // Empty example to show all association types
    {
      fromObjectType: 'notes'
    },
    {
      fromObjectType: 'contacts',
      toObjectType: 'companies'
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'getAssociationTypeReference',
  description: 'Get a reference table of common association types between HubSpot objects',
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
      // Get the full reference table
      const referenceTable = associationsService.getAssociationTypeReferenceTable();
      
      // If specific object types are provided, filter the reference table
      if (params.fromObjectType || params.toObjectType) {
        const { fromObjectType, toObjectType } = params;
        
        // If both object types are provided, get the specific association types
        if (fromObjectType && toObjectType) {
          const types = associationsService.getAssociationTypes(fromObjectType, toObjectType);
          
          if (types) {
            // Format the specific association types
            let filteredTable = `Association Types from ${fromObjectType} to ${toObjectType}:\n`;
            
            for (const [typeName, typeId] of Object.entries(types)) {
              filteredTable += `- ${typeName}: ${typeId}\n`;
            }
            
            return {
              referenceTable: filteredTable,
              associationTypes: types,
              fromObjectType,
              toObjectType
            };
          } else {
            return {
              message: `No association types found between ${fromObjectType} and ${toObjectType}`,
              referenceTable: `No association types found between ${fromObjectType} and ${toObjectType}`,
              associationTypes: {},
              fromObjectType,
              toObjectType
            };
          }
        }
        
        // If only fromObjectType is provided, filter the reference table
        if (fromObjectType) {
          // Simple string filtering - not ideal but works for this purpose
          const lines = referenceTable.split('\n');
          const filteredLines = lines.filter(line => 
            line.includes(`${fromObjectType} →`) || 
            line === 'Common Association Types:'
          );
          
          if (filteredLines.length > 1) {
            return {
              referenceTable: filteredLines.join('\n'),
              fromObjectType
            };
          } else {
            return {
              message: `No association types found for ${fromObjectType}`,
              referenceTable: `No association types found for ${fromObjectType}`,
              fromObjectType
            };
          }
        }
        
        // If only toObjectType is provided, filter the reference table
        if (toObjectType) {
          // Simple string filtering - not ideal but works for this purpose
          const lines = referenceTable.split('\n');
          const filteredLines = lines.filter(line => 
            line.includes(`→ ${toObjectType}`) || 
            line === 'Common Association Types:'
          );
          
          if (filteredLines.length > 1) {
            return {
              referenceTable: filteredLines.join('\n'),
              toObjectType
            };
          } else {
            return {
              message: `No association types found for ${toObjectType}`,
              referenceTable: `No association types found for ${toObjectType}`,
              toObjectType
            };
          }
        }
      }
      
      // Return the full reference table if no filters are provided
      return {
        referenceTable,
        message: 'Association type reference table retrieved successfully'
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to get association type reference: ${errorMessage}`,
        (error as any).category || 'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};

export default tool;
