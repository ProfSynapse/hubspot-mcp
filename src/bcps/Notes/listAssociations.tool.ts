/**
 * List Note Associations Tool
 *
 * Provides functionality to list associations between a note and other objects in HubSpot.
 * Part of the Notes BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService } from './notes.service.js';
import { NoteAssociation } from './notes.types.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    noteId: {
      type: 'string',
      description: 'ID of the note to list associations for',
    },
    toObjectType: {
      type: 'string',
      description: 'Type of object to list associations for. Valid types are: "contacts", "companies", "deals", "tickets", "products", "line_items"',
      enum: ['contacts', 'companies', 'deals', 'tickets', 'products', 'line_items']
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of associations to return (default: 100, max: 500)',
      minimum: 1,
      maximum: 500,
      default: 100,
    },
    after: {
      type: 'string',
      description: 'Pagination cursor for retrieving the next page of results',
    },
  },
  required: ['noteId', 'toObjectType'],
  examples: [
    {
      noteId: '12345',
      toObjectType: 'contacts'
    },
    {
      noteId: '67890',
      toObjectType: 'companies',
      limit: 50
    },
    {
      noteId: '54321',
      toObjectType: 'deals',
      after: 'next_page_token'
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'listNoteAssociations',
  description: 'List associations between a note and other objects in HubSpot',
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
      const { noteId, toObjectType, limit, after } = params;
      
      const result = await notesService.listNoteAssociations(
        noteId,
        toObjectType,
        limit,
        after
      );

      // Format the associations for better readability
      const formattedAssociations = result.results.map((assoc: NoteAssociation) => ({
        id: assoc.objectId,
        type: assoc.objectType,
        associationType: assoc.associationType || 'default'
      }));

      return {
        message: `Found ${result.results.length} ${toObjectType} associations for note ${noteId}`,
        associations: formattedAssociations,
        pagination: result.pagination,
        details: {
          noteId,
          objectType: toObjectType,
          count: result.results.length,
          hasMore: !!result.pagination?.after
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to list note associations: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
