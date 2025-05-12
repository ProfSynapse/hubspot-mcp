/**
 * Update Note Tool
 *
 * Provides functionality to update an existing note in HubSpot.
 * Part of the Notes BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService } from './notes.service.js';
import { NoteUpdateInput } from './notes.types.js';

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'ID of the note to update',
    },
    content: {
      type: 'string',
      description: 'Updated content of the note',
    },
    ownerId: {
      type: 'string',
      description: 'Updated HubSpot owner ID for the note',
    },
    metadata: {
      type: 'object',
      description: 'Additional properties to update for the note',
    },
  },
  required: ['id'],
  examples: [
    {
      id: '12345',
      content: 'Updated note content with additional information.'
    },
    {
      id: '67890',
      ownerId: '54321',
      metadata: {
        priority: 'high',
        followUpDate: '2025-06-01'
      }
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'updateNote',
  description: 'Update an existing note in HubSpot',
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
      const { id, content, ownerId, metadata } = params;
      
      // Create update input with only the fields that are provided
      const updateInput: NoteUpdateInput = {};
      if (content !== undefined) updateInput.content = content;
      if (ownerId !== undefined) updateInput.ownerId = ownerId;
      if (metadata !== undefined) updateInput.metadata = metadata;

      // Validate that at least one field is being updated
      if (Object.keys(updateInput).length === 0) {
        throw new BcpError(
          'At least one field (content, ownerId, or metadata) must be provided for update',
          'VALIDATION_ERROR',
          400
        );
      }

      const result = await notesService.updateNote(id, updateInput);

      return {
        message: 'Note updated successfully',
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
        `Failed to update note: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  },
};
