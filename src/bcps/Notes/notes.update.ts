/**
 * Update Note Tool
 * 
 * Provides functionality to update a note in HubSpot.
 * Part of the Notes BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService } from './notes.service.js';
import { enhanceNotesResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for update note tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    noteId: {
      type: 'string',
      description: 'ID of the note (required)'
    },
    content: {
      type: 'string',
      description: 'Content of the note'
    },
    ownerId: {
      type: 'string',
      description: 'Optional HubSpot owner ID'
    },
    timestamp: {
      type: 'string',
      description: 'Optional timestamp for the note (ISO 8601 format)'
    },
    metadata: {
      type: 'object',
      description: 'Optional additional properties'
    }
  },
  required: ['noteId']
};

/**
 * Update note tool definition
 */
export const tool: ToolDefinition = {
  name: 'update',
  description: 'Update a note in HubSpot',
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

    // At least one field must be provided for update
    if (!params.content && !params.ownerId && !params.timestamp && !params.metadata) {
      throw new BcpError(
        'Update requires at least one field to change (content, ownerId, timestamp, or metadata)',
        'VALIDATION_ERROR',
        400
      );
    }

    try {
      const result = await notesService.updateNote(params.noteId, {
        content: params.content,
        ownerId: params.ownerId,
        timestamp: params.timestamp,
        metadata: params.metadata
      });

      const response = {
        success: true,
        data: result,
        message: 'Successfully updated note'
      };

      return enhanceNotesResponse(response, 'update', params);
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to update note: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};