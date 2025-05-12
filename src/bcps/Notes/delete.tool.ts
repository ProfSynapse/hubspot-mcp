/**
 * Delete Note Tool
 *
 * Provides functionality to delete a note from HubSpot.
 * Part of the Notes BCP.
 */

import { ToolDefinition, InputSchema, BcpError } from '../../core/types.js';
import { NotesService } from './notes.service.js';
import { ServiceConfig } from '../../core/types.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'ID of the note to delete',
    },
  },
  required: ['id'],
  examples: [
    {
      id: '12345'
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'deleteNote',
  description: 'Delete a note from HubSpot',
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
      const { id } = params;
      
      await notesService.deleteNote(id);

      return {
        message: 'Note deleted successfully',
        details: {
          id
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to delete note: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
