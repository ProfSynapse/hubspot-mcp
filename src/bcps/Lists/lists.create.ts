/**
 * Create List Tool
 *
 * Creates new HubSpot lists supporting MANUAL, DYNAMIC, and SNAPSHOT types
 * Part of the Lists BCP
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { ListsService } from './lists.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for create list tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'List name (required)'
    },
    objectTypeId: {
      type: 'string',
      enum: ['0-1', '0-2', '0-3', '0-5'],
      description: 'Object type: 0-1=Contacts, 0-2=Companies, 0-3=Deals, 0-5=Tickets'
    },
    processingType: {
      type: 'string',
      enum: ['MANUAL', 'DYNAMIC', 'SNAPSHOT'],
      description: 'List processing type: MANUAL (static), DYNAMIC (auto-updating), SNAPSHOT (initially filtered then manual)'
    },
    filterBranch: {
      type: 'object',
      description: 'Filter definition (required for DYNAMIC and SNAPSHOT lists). Structure: Root OR branch → Child AND branches → Individual filters. Example: {"filterBranchType":"OR","filters":[],"filterBranches":[{"filterBranchType":"AND","filters":[{"filterType":"PROPERTY","property":"email","operation":{"operationType":"MULTISTRING","operator":"CONTAINS","values":["@example.com"]}}],"filterBranches":[]}]}',
      properties: {
        filterBranchType: {
          type: 'string',
          enum: ['OR'],
          description: 'Must be OR for root branch'
        },
        filters: {
          type: 'array',
          items: { type: 'object' },
          description: 'Must be empty array for root OR branch (filters go in child AND branches)'
        },
        filterBranches: {
          type: 'array',
          description: 'Array of AND branches. Each AND branch contains filters. Structure: [{"filterBranchType":"AND","filters":[<filter objects>],"filterBranches":[]}]',
          items: {
            type: 'object',
            properties: {
              filterBranchType: {
                type: 'string',
                enum: ['AND'],
                description: 'Must be AND for child branches'
              },
              filterBranches: {
                type: 'array',
                items: { type: 'object' },
                description: 'Nested branches (usually empty for simple filters)'
              },
              filters: {
                type: 'array',
                description: 'Array of filter objects. Each filter must have: filterType, property, and operation object',
                items: {
                  type: 'object',
                  properties: {
                    filterType: {
                      type: 'string',
                      enum: ['PROPERTY'],
                      description: 'Filter type - use PROPERTY for property-based filters'
                    },
                    property: {
                      type: 'string',
                      description: 'Property name to filter on (e.g., "email", "firstname", "organization_type")'
                    },
                    operation: {
                      type: 'object',
                      description: 'Operation definition specifying how to filter. IMPORTANT: Must be an object with operationType, operator, and values/value',
                      properties: {
                        operationType: {
                          type: 'string',
                          enum: ['MULTISTRING', 'NUMBER', 'BOOL', 'TIME_POINT', 'ENUMERATION'],
                          description: 'Operation type: MULTISTRING for text properties, NUMBER for numeric, BOOL for boolean, TIME_POINT for dates, ENUMERATION for multi-select'
                        },
                        operator: {
                          type: 'string',
                          description: 'Comparison operator: IS_EQUAL_TO, IS_NOT_EQUAL_TO, CONTAINS, DOES_NOT_CONTAIN, IS_GREATER_THAN, IS_LESS_THAN, etc. Use IS_EQUAL_TO (not EQ), IS_NOT_EQUAL_TO (not NEQ)'
                        },
                        values: {
                          type: 'array',
                          description: 'Array of values for MULTISTRING and ENUMERATION types. Example: ["Career Center"] or ["value1","value2"]'
                        },
                        value: {
                          description: 'Single value for NUMBER, BOOL, or TIME_POINT types. Example: 100 or true'
                        }
                      },
                      required: ['operationType', 'operator']
                    }
                  },
                  required: ['filterType', 'property', 'operation']
                }
              }
            },
            required: ['filterBranchType', 'filters', 'filterBranches']
          }
        }
      },
      required: ['filterBranchType', 'filters', 'filterBranches']
    }
  },
  required: ['name', 'objectTypeId', 'processingType']
};

/**
 * Create list tool definition
 */
export const tool: ToolDefinition = {
  name: 'create',
  description: 'Create a new HubSpot list (MANUAL, DYNAMIC, or SNAPSHOT)',
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

    const listsService = new ListsService(tempConfig);
    await listsService.init();

    try {
      const result = await listsService.createList(params);

      const response = {
        success: true,
        data: result,
        message: `List created successfully: ${result.name} (${result.processingType})`
      };

      return enhanceResponse(response, 'create', params, 'Lists');
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to create list: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};
