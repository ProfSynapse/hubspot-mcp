/**
 * List Company Notes Tool
 * 
 * Provides functionality to list notes associated with a company in HubSpot.
 * Part of the Notes BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService } from './notes.service.js';
import { enhanceNotesResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for list company notes tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    companyId: {
      type: 'string',
      description: 'ID of the company to list notes for (required)'
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results (default 10, max 100)'
    },
    after: {
      type: 'string',
      description: 'Pagination cursor'
    },
    startDate: {
      type: 'string',
      description: 'Filter notes from this date (ISO 8601)'
    },
    endDate: {
      type: 'string',
      description: 'Filter notes to this date (ISO 8601)'
    }
  },
  required: ['companyId']
};

/**
 * List company notes tool definition
 */
export const tool: ToolDefinition = {
  name: 'listCompanyNotes',
  description: 'List notes associated with a company in HubSpot',
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

    const notesService = new NotesService(tempConfig);
    await notesService.init();

    if (params.limit !== undefined && (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 100)) {
      throw new BcpError(
        'Invalid limit parameter: must be a number between 1 and 100',
        'VALIDATION_ERROR',
        400
      );
    }

    try {
      const result = await notesService.listCompanyNotes(
        params.companyId,
        {
          limit: params.limit,
          after: params.after,
          startDate: params.startDate,
          endDate: params.endDate
        }
      );

      const response = {
        success: true,
        data: result,
        message: 'Successfully retrieved company notes'
      };

      return enhanceNotesResponse(response, 'listCompanyNotes', params);
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to list company notes: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};