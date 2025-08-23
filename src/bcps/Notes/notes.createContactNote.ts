/**
 * Create Contact Note Tool
 * 
 * Provides functionality to create a note associated with a contact in HubSpot.
 * Part of the Notes BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService } from './notes.service.js';

/**
 * Input schema for create contact note tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    contactId: {
      type: 'string',
      description: 'ID of the contact to associate the note with (required)'
    },
    content: {
      type: 'string',
      description: 'Content of the note (required)'
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
  required: ['contactId', 'content']
};

/**
 * Create contact note tool definition
 */
export const tool: ToolDefinition = {
  name: 'createContactNote',
  description: 'Create a note associated with a contact in HubSpot',
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

    if (!params.content || typeof params.content !== 'string' || params.content.trim().length === 0) {
      throw new BcpError(
        'Missing required parameter: content (must be non-empty string)',
        'VALIDATION_ERROR',
        400
      );
    }

    try {
      const result = await notesService.createContactNote(
        params.contactId,
        params.content,
        {
          ownerId: params.ownerId,
          timestamp: params.timestamp,
          metadata: params.metadata
        }
      );

      return {
        success: true,
        data: result,
        message: 'Successfully created contact note'
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to create contact note: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};