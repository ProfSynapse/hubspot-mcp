/**
 * Get Note Tool
 *
 * Provides functionality to retrieve a note by ID from HubSpot.
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
      description: 'ID of the note to retrieve',
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
  name: 'getNote',
  description: 'Retrieve a note by ID from HubSpot',
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
      
      const result = await notesService.getNote(id);

      return {
        message: 'Note retrieved successfully',
        note: result,
        details: {
          id: result.id,
          content: result.content,
          timestamp: result.timestamp,
          ownerId: result.ownerId,
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to retrieve note: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
