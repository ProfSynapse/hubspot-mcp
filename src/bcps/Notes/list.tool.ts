/**
 * List Notes Tool
 *
 * Provides functionality to list notes with optional filters from HubSpot.
 * Part of the Notes BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService } from './notes.service.js';
import { NoteFilters } from './notes.types.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    ownerId: {
      type: 'string',
      description: 'Filter notes by owner ID. You can find owner IDs by looking at existing contacts, deals, or other records that have hubspot_owner_id properties.',
    },
    startTimestamp: {
      type: 'string',
      description: 'Filter notes created after this timestamp (ISO 8601 format)',
    },
    endTimestamp: {
      type: 'string',
      description: 'Filter notes created before this timestamp (ISO 8601 format)',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of notes to return (default: 10, max: 100)',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    after: {
      type: 'string',
      description: 'Pagination cursor for retrieving the next page of results',
    },
  },
  required: [],
  examples: [
    {
      limit: 20
    },
    {
      ownerId: '12345',
      startTimestamp: '2025-01-01T00:00:00Z',
      endTimestamp: '2025-05-01T00:00:00Z'
    },
    {
      after: 'next_page_token',
      limit: 50
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'listNotes',
  description: 'List notes with optional filters from HubSpot',
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
      const { ownerId, startTimestamp, endTimestamp, limit, after } = params;
      
      const filters: NoteFilters = {};
      if (ownerId !== undefined) filters.ownerId = ownerId;
      if (startTimestamp !== undefined) filters.startTimestamp = startTimestamp;
      if (endTimestamp !== undefined) filters.endTimestamp = endTimestamp;
      if (limit !== undefined) filters.limit = limit;
      if (after !== undefined) filters.after = after;

      const result = await notesService.listNotes(filters);

      return {
        message: `Successfully retrieved ${result.results.length} notes`,
        notes: result.results,
        pagination: result.pagination,
        total: result.total,
        details: {
          filters: {
            ownerId,
            startTimestamp,
            endTimestamp,
            limit,
            after
          }
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to list notes: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
