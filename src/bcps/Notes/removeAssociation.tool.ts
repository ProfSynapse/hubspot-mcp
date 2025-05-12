/**
 * Remove Association from Note Tool
 *
 * Provides functionality to remove an association between a note and another object in HubSpot.
 * Part of the Notes BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService } from './notes.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    noteId: {
      type: 'string',
      description: 'ID of the note to remove an association from',
    },
    objectType: {
      type: 'string',
      description: 'Type of object to disassociate (e.g., "contacts", "companies", "deals", "tickets")',
    },
    objectId: {
      type: 'string',
      description: 'ID of the object to disassociate',
    },
  },
  required: ['noteId', 'objectType', 'objectId'],
  examples: [
    {
      noteId: '12345',
      objectType: 'contacts',
      objectId: '789'
    },
    {
      noteId: '67890',
      objectType: 'companies',
      objectId: '456'
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'removeAssociationFromNote',
  description: 'Remove an association between a note and another object in HubSpot',
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
      const { noteId, objectType, objectId } = params;
      
      const result = await notesService.removeAssociationFromNote(
        noteId,
        objectType,
        objectId
      );

      return {
        message: `Association removed successfully between note ${noteId} and ${objectType} ${objectId}`,
        note: result,
        details: {
          noteId,
          objectType,
          objectId,
          associationsCount: result.associations?.length || 0
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to remove association: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
