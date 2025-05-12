/**
 * Get Recent Notes Tool
 *
 * Provides functionality to retrieve recent notes from HubSpot.
 * Part of the Notes BCP.
 */

import { ToolDefinition, InputSchema, BcpError } from '../../core/types.js';
import { NotesService } from './notes.service.js';
import { ServiceConfig } from '../../core/types.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of recent notes to return (default: 10, max: 100)',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
  },
  required: [],
  examples: [
    {
      limit: 5
    },
    {
      limit: 25
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'getRecentNotes',
  description: 'Retrieve recent notes from HubSpot',
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
      const { limit = 10 } = params;
      
      const result = await notesService.getRecentNotes(limit);

      return {
        message: `Successfully retrieved ${result.results.length} recent notes`,
        notes: result.results,
        pagination: result.pagination,
        total: result.total,
        details: {
          limit
        }
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to retrieve recent notes: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
