/**
 * Create Deal Note Tool
 * 
 * Provides functionality to create a note associated with a deal in HubSpot.
 * Part of the Notes BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService } from './notes.service.js';

/**
 * Input schema for create deal note tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    dealId: {
      type: 'string',
      description: 'ID of the deal to associate the note with (required)'
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
  required: ['dealId', 'content']
};

/**
 * Create deal note tool definition
 */
export const tool: ToolDefinition = {
  name: 'createDealNote',
  description: 'Create a note associated with a deal in HubSpot',
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

    if (!params.dealId || typeof params.dealId !== 'string' || params.dealId.trim().length === 0) {
      throw new BcpError(
        'Missing required parameter: dealId (must be non-empty string)',
        'VALIDATION_ERROR',
        400
      );
    }

    if (!params.content || typeof params.content !== 'string' || params.content.trim().length === 0) {
      throw new BcpError(
        'Missing required parameter: content (must be non-empty string)',
        'VALIDATION_ERROR',
        400
      );
    }

    try {
      const result = await notesService.createDealNote(
        params.dealId,
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
        message: 'Successfully created deal note'
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to create deal note: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};