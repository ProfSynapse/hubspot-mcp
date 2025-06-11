/**
 * Create Note Tool
 *
 * Provides functionality to create a new note in HubSpot.
 * Part of the Notes BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService } from './notes.service.js';
import { NoteCreateInput } from './notes.types.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    content: {
      type: 'string',
      description: 'Content of the note',
    },
    ownerId: {
      type: 'string',
      description: 'HubSpot owner ID for the note. This is optional - if not provided, the note may be assigned to the current user or remain unassigned. You can find owner IDs by looking at existing contacts, deals, or other records that have hubspot_owner_id properties.',
    },
    associations: {
      type: 'array',
      description: 'Associations to link this note with',
      items: {
        type: 'object',
        properties: {
          objectType: {
            type: 'string',
            description: 'Type of object to associate with (e.g., "contacts", "companies")',
          },
          objectId: {
            type: 'string',
            description: 'ID of the object to associate with',
          },
          associationType: {
            type: 'string',
            description: 'Type of association (optional)',
          },
        },
        required: ['objectType', 'objectId'],
      },
    },
    metadata: {
      type: 'object',
      description: 'Additional properties for the note'
    },
  },
  required: ['content'],
  examples: [
    {
      content: 'Had a great conversation with the customer about their needs.',
      ownerId: '12345',
      associations: [
        {
          objectType: 'contacts',
          objectId: '789'
        }
      ]
    },
    {
      content: 'Customer requested a follow-up call next week.',
      metadata: {
        followUpDate: '2025-05-18'
      }
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'createNote',
  description: 'Create a new note in HubSpot',
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
      const { content, ownerId, associations, metadata } = params;
      
      const noteInput: NoteCreateInput = {
        content,
        ownerId,
        associations,
        metadata,
      };

      const result = await notesService.createNote(noteInput);

      return {
        message: 'Note created successfully',
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
        `Failed to create note: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
