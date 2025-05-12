/**
 * Create Note With Associations Tool
 * 
 * This tool allows creating a note and associating it with multiple objects in a single operation.
 * It combines the functionality of create.tool.ts and addAssociation.tool.ts.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService } from './notes.service.js';
import { NoteCreateInput, NoteAssociationInput } from './notes.types.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    content: {
      type: 'string',
      description: 'The content of the note',
    },
    timestamp: {
      type: 'string',
      description: 'The timestamp for the note (ISO string or milliseconds since epoch). Defaults to current time.',
    },
    ownerId: {
      type: 'string',
      description: 'The HubSpot owner ID for the note',
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata for the note'
    },
    associations: {
      type: 'array',
      description: 'Objects to associate with the note',
      items: {
        type: 'object',
        properties: {
          objectType: {
            type: 'string',
            description: 'The type of object to associate with (e.g., "contacts", "companies")',
          },
          objectId: {
            type: 'string',
            description: 'The ID of the object to associate with',
          },
          associationType: {
            type: 'string',
            description: 'Optional specific association type (e.g., "meeting", "call")',
          },
        },
        required: ['objectType', 'objectId'],
      },
    },
  },
  required: ['content', 'associations'],
  examples: [
    {
      content: 'Meeting notes from client call',
      associations: [
        {
          objectType: 'contacts',
          objectId: '12345'
        },
        {
          objectType: 'companies',
          objectId: '67890'
        }
      ]
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'createNoteWithAssociations',
  description: 'Create a note and associate it with multiple objects in a single operation',
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
      // Validate required parameters
      if (!params.content) {
        throw new BcpError('Note content is required.', 'VALIDATION_ERROR', 400);
      }
      
      if (!params.associations || !Array.isArray(params.associations) || params.associations.length === 0) {
        throw new BcpError('At least one association is required.', 'VALIDATION_ERROR', 400);
      }

      // Validate each association
      for (const assoc of params.associations as Array<{objectType: string, objectId: string, associationType?: string}>) {
        if (!assoc.objectType || !assoc.objectId) {
          throw new BcpError(
            'Each association must include objectType and objectId.',
            'VALIDATION_ERROR',
            400
          );
        }
      }

      // Prepare the note creation input
      const noteInput: NoteCreateInput = {
        content: params.content,
      };

      // Add optional parameters if provided
      if (params.timestamp !== undefined) {
        noteInput.timestamp = params.timestamp;
      }
      
      if (params.ownerId !== undefined) {
        noteInput.ownerId = params.ownerId;
      }
      
      if (params.metadata !== undefined) {
        noteInput.metadata = params.metadata;
      }

      // Map associations to the format expected by createNote
      noteInput.associations = params.associations.map((assoc: {objectType: string, objectId: string, associationType?: string}): NoteAssociationInput => ({
        objectType: assoc.objectType,
        objectId: assoc.objectId,
        associationType: assoc.associationType
      }));

      // Create the note with associations
      const createdNote = await notesService.createNote(noteInput);

      return {
        note: createdNote,
        message: `Successfully created note with ID ${createdNote.id} and associated it with ${params.associations.length} object(s).`,
        associations: params.associations.map((assoc: {objectType: string, objectId: string, associationType?: string}) => ({
          objectType: assoc.objectType,
          objectId: assoc.objectId,
          associationType: assoc.associationType || 'default'
        }))
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to create note with associations: ${errorMessage}`,
        (error as any).category || 'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};

export default tool;
