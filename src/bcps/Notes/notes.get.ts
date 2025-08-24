/**
 * Get Note Tool
 * 
 * Provides functionality to retrieve a note by ID from HubSpot.
 * Part of the Notes BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService } from './notes.service.js';
import { enhanceNotesResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for get note tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    noteId: {
      type: 'string',
      description: 'ID of the note (required)'
    },
    includeAssociations: {
      type: 'boolean',
      description: 'Whether to include associations (default true)'
    }
  },
  required: ['noteId']
};

/**
 * Get note tool definition
 */
export const tool: ToolDefinition = {
  name: 'get',
  description: 'Get a note by ID from HubSpot',
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

    try {
      const result = await notesService.getNote(
        params.noteId,
        params.includeAssociations !== false
      );

      const response = {
        success: true,
        data: result,
        message: 'Successfully retrieved note'
      };

      return enhanceNotesResponse(response, 'get', params);
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to get note: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};