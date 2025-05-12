/**
 * Add Association to Note Tool
 *
 * Provides functionality to add an association between a note and another object in HubSpot.
 * Part of the Notes BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService } from './notes.service.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    noteId: {
      type: 'string',
      description: 'ID of the note to add an association to',
    },
    objectType: {
      type: 'string',
      description: 'Type of object to associate with (e.g., "contacts", "companies", "deals", "tickets")',
    },
    objectId: {
      type: 'string',
      description: 'ID of the object to associate with',
    },
    associationType: {
      type: 'string',
      description: 'Type of association (optional, defaults to standard association for the object type)',
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
      objectId: '456',
      associationType: 'default'
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'addAssociationToNote',
  description: 'Add an association between a note and another object in HubSpot',
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
      const { noteId, objectType, objectId, associationType } = params;
      
      const result = await notesService.addAssociationToNote(
        noteId,
        objectType,
        objectId,
        associationType
      );

      return {
        message: `Association added successfully between note ${noteId} and ${objectType} ${objectId}`,
        note: result,
        details: {
          noteId,
          objectType,
          objectId,
          associationType: associationType || 'default',
          associationsCount: result.associations?.length || 0
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to add association: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
