/**
 * Create Contact Note Tool
 * 
 * Provides functionality to create a note associated with a contact in HubSpot.
 * Part of the Notes BCP.
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService } from './notes.service.js';
import { enhanceNotesResponse, enhanceErrorResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for create contact note tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    contactId: {
      type: 'string',
      description: 'ID of the contact to associate the note with (required). Use Contacts domain search operations if you need to find the contact ID first.'
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
      description: 'Optional custom properties object. IMPORTANT: Custom properties must exist in HubSpot first. Use Properties domain to list available properties for notes, or create them in HubSpot Settings > Properties > Notes.'
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

      const response = {
        success: true,
        data: result,
        message: 'Successfully created contact note'
      };

      return enhanceNotesResponse(response, 'createContactNote', params);
    } catch (error) {
      // For property validation errors, enhance the error with suggestions
      if (error instanceof Error && (error.message.includes('Property') || error.message.includes('PROPERTY_DOESNT_EXIST'))) {
        const enhancedError = enhanceErrorResponse(error, 'createContactNote', params, 'Notes');
        
        // Throw enhanced BcpError with suggestions in the message
        const suggestionsText = enhancedError.suggestions ? 
          '\n\nSuggestions:\n' + enhancedError.suggestions.join('\n') : '';
        
        throw new BcpError(
          `Failed to create contact note: ${error.message}${suggestionsText}`,
          'API_ERROR',
          (error as any).status || 500
        );
      }
      
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