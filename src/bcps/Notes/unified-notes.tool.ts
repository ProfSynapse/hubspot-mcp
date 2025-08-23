/**
 * Location: /src/bcps/Notes/unified-notes.tool.ts
 * 
 * Unified Notes Tool implementation following the architect's specifications.
 * Provides intent-driven operations for creating and managing notes with 
 * automatic associations, replacing the complex multi-tool Notes interface.
 * 
 * Used by:
 * - src/bcps/Notes/index.ts: Exports this unified tool
 * - src/core/bcp-tool-delegator.ts: Routes operations to this tool
 * 
 * How it works with other files:
 * - Uses NotesService for actual HubSpot API operations
 * - Implements operation-based routing to handle different note operations
 * - Provides simple parameter structure without complex association arrays
 * - Returns consistent response formats across all operations
 */

import { ToolDefinition, InputSchema, BcpError, ServiceConfig } from '../../core/types.js';
import { NotesService, CreateNoteOptions, ListNotesOptions } from './notes.service.js';

// Union type for all unified Notes operations
export interface UnifiedNotesParams {
  operation: 'createContactNote' | 'createCompanyNote' | 'createDealNote' | 
            'listContactNotes' | 'listCompanyNotes' | 'listDealNotes' |
            'get' | 'update';
  [key: string]: any;
}

// Operation-specific parameter interfaces
export interface CreateContactNoteParams extends UnifiedNotesParams {
  operation: 'createContactNote';
  contactId: string;
  content: string;
  ownerId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface CreateCompanyNoteParams extends UnifiedNotesParams {
  operation: 'createCompanyNote';
  companyId: string;
  content: string;
  ownerId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface CreateDealNoteParams extends UnifiedNotesParams {
  operation: 'createDealNote';
  dealId: string;
  content: string;
  ownerId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface ListContactNotesParams extends UnifiedNotesParams {
  operation: 'listContactNotes';
  contactId: string;
  limit?: number;
  after?: string;
  startDate?: string;
  endDate?: string;
}

export interface ListCompanyNotesParams extends UnifiedNotesParams {
  operation: 'listCompanyNotes';
  companyId: string;
  limit?: number;
  after?: string;
  startDate?: string;
  endDate?: string;
}

export interface ListDealNotesParams extends UnifiedNotesParams {
  operation: 'listDealNotes';
  dealId: string;
  limit?: number;
  after?: string;
  startDate?: string;
  endDate?: string;
}

export interface GetNoteParams extends UnifiedNotesParams {
  operation: 'get';
  noteId: string;
  includeAssociations?: boolean;
}

export interface UpdateNoteParams extends UnifiedNotesParams {
  operation: 'update';
  noteId: string;
  content?: string;
  ownerId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      enum: [
        'createContactNote', 'createCompanyNote', 'createDealNote',
        'listContactNotes', 'listCompanyNotes', 'listDealNotes',
        'get', 'update'
      ],
      description: 'The operation to perform on notes'
    },
    // Intent-based create parameters
    contactId: {
      type: 'string',
      description: 'ID of the contact to associate the note with (required for createContactNote)'
    },
    companyId: {
      type: 'string',
      description: 'ID of the company to associate the note with (required for createCompanyNote)'
    },
    dealId: {
      type: 'string',
      description: 'ID of the deal to associate the note with (required for createDealNote)'
    },
    content: {
      type: 'string',
      description: 'Content of the note (required for create operations)'
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
    },
    // List operation parameters
    limit: {
      type: 'number',
      description: 'Maximum number of results (default 10, max 100)'
    },
    after: {
      type: 'string',
      description: 'Pagination cursor'
    },
    startDate: {
      type: 'string',
      description: 'Filter notes from this date (ISO 8601)'
    },
    endDate: {
      type: 'string',
      description: 'Filter notes to this date (ISO 8601)'
    },
    // Standard CRUD parameters
    noteId: {
      type: 'string',
      description: 'ID of the note (required for get/update operations)'
    },
    includeAssociations: {
      type: 'boolean',
      description: 'Whether to include associations (default true)'
    }
  },
  required: ['operation'],
  examples: [
    {
      operation: 'createContactNote',
      contactId: '12345',
      content: 'Had a productive call with the customer about their requirements.'
    },
    {
      operation: 'listCompanyNotes',
      companyId: '67890',
      limit: 20
    },
    {
      operation: 'get',
      noteId: '98765'
    }
  ]
};

export const tool: ToolDefinition = {
  name: 'hubspotNotes',
  description: 'Unified Notes tool for creating and managing notes with automatic associations',
  inputSchema,
  handler: async (params: UnifiedNotesParams) => {
    // Initialize service
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
      let result: any;

      switch (params.operation) {
        case 'createContactNote': {
          const createParams = params as CreateContactNoteParams;
          validateCreateContactNote(createParams);
          result = await notesService.createContactNote(
            createParams.contactId,
            createParams.content,
            {
              ownerId: createParams.ownerId,
              timestamp: createParams.timestamp,
              metadata: createParams.metadata
            }
          );
          break;
        }

        case 'createCompanyNote': {
          const createParams = params as CreateCompanyNoteParams;
          validateCreateCompanyNote(createParams);
          result = await notesService.createCompanyNote(
            createParams.companyId,
            createParams.content,
            {
              ownerId: createParams.ownerId,
              timestamp: createParams.timestamp,
              metadata: createParams.metadata
            }
          );
          break;
        }

        case 'createDealNote': {
          const createParams = params as CreateDealNoteParams;
          validateCreateDealNote(createParams);
          result = await notesService.createDealNote(
            createParams.dealId,
            createParams.content,
            {
              ownerId: createParams.ownerId,
              timestamp: createParams.timestamp,
              metadata: createParams.metadata
            }
          );
          break;
        }

        case 'listContactNotes': {
          const listParams = params as ListContactNotesParams;
          validateListContactNotes(listParams);
          result = await notesService.listContactNotes(
            listParams.contactId,
            {
              limit: listParams.limit,
              after: listParams.after,
              startDate: listParams.startDate,
              endDate: listParams.endDate
            }
          );
          break;
        }

        case 'listCompanyNotes': {
          const listParams = params as ListCompanyNotesParams;
          validateListCompanyNotes(listParams);
          result = await notesService.listCompanyNotes(
            listParams.companyId,
            {
              limit: listParams.limit,
              after: listParams.after,
              startDate: listParams.startDate,
              endDate: listParams.endDate
            }
          );
          break;
        }

        case 'listDealNotes': {
          const listParams = params as ListDealNotesParams;
          validateListDealNotes(listParams);
          result = await notesService.listDealNotes(
            listParams.dealId,
            {
              limit: listParams.limit,
              after: listParams.after,
              startDate: listParams.startDate,
              endDate: listParams.endDate
            }
          );
          break;
        }

        case 'get': {
          const getParams = params as GetNoteParams;
          validateGetNote(getParams);
          result = await notesService.getNote(
            getParams.noteId,
            getParams.includeAssociations !== false
          );
          break;
        }

        case 'update': {
          const updateParams = params as UpdateNoteParams;
          validateUpdateNote(updateParams);
          result = await notesService.updateNote(updateParams.noteId, {
            content: updateParams.content,
            ownerId: updateParams.ownerId,
            timestamp: updateParams.timestamp,
            metadata: updateParams.metadata
          });
          break;
        }

        default:
          throw new BcpError(
            `Unknown operation: ${params.operation}`,
            'VALIDATION_ERROR',
            400
          );
      }

      return {
        success: true,
        data: result,
        message: `Successfully executed ${params.operation}`,
        operation: params.operation
      };
    } catch (error) {
      if (error instanceof BcpError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to execute ${params.operation}: ${errorMessage}`,
        'API_ERROR',
        (error as any).status || 500
      );
    }
  }
};

// Validation functions for each operation
function validateCreateContactNote(params: CreateContactNoteParams): void {
  if (!params.contactId) {
    throw new BcpError(
      'Missing required parameter for createContactNote: contactId',
      'VALIDATION_ERROR',
      400
    );
  }
  if (!params.content || typeof params.content !== 'string' || params.content.trim().length === 0) {
    throw new BcpError(
      'Missing required parameter for createContactNote: content (must be non-empty string)',
      'VALIDATION_ERROR',
      400
    );
  }
}

function validateCreateCompanyNote(params: CreateCompanyNoteParams): void {
  if (!params.companyId) {
    throw new BcpError(
      'Missing required parameter for createCompanyNote: companyId',
      'VALIDATION_ERROR',
      400
    );
  }
  if (!params.content || typeof params.content !== 'string' || params.content.trim().length === 0) {
    throw new BcpError(
      'Missing required parameter for createCompanyNote: content (must be non-empty string)',
      'VALIDATION_ERROR',
      400
    );
  }
}

function validateCreateDealNote(params: CreateDealNoteParams): void {
  if (!params.dealId) {
    throw new BcpError(
      'Missing required parameter for createDealNote: dealId',
      'VALIDATION_ERROR',
      400
    );
  }
  if (!params.content || typeof params.content !== 'string' || params.content.trim().length === 0) {
    throw new BcpError(
      'Missing required parameter for createDealNote: content (must be non-empty string)',
      'VALIDATION_ERROR',
      400
    );
  }
}

function validateListContactNotes(params: ListContactNotesParams): void {
  if (!params.contactId) {
    throw new BcpError(
      'Missing required parameter for listContactNotes: contactId',
      'VALIDATION_ERROR',
      400
    );
  }
  if (params.limit !== undefined && (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 100)) {
    throw new BcpError(
      'Invalid limit parameter: must be a number between 1 and 100',
      'VALIDATION_ERROR',
      400
    );
  }
}

function validateListCompanyNotes(params: ListCompanyNotesParams): void {
  if (!params.companyId) {
    throw new BcpError(
      'Missing required parameter for listCompanyNotes: companyId',
      'VALIDATION_ERROR',
      400
    );
  }
  if (params.limit !== undefined && (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 100)) {
    throw new BcpError(
      'Invalid limit parameter: must be a number between 1 and 100',
      'VALIDATION_ERROR',
      400
    );
  }
}

function validateListDealNotes(params: ListDealNotesParams): void {
  if (!params.dealId) {
    throw new BcpError(
      'Missing required parameter for listDealNotes: dealId',
      'VALIDATION_ERROR',
      400
    );
  }
  if (params.limit !== undefined && (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 100)) {
    throw new BcpError(
      'Invalid limit parameter: must be a number between 1 and 100',
      'VALIDATION_ERROR',
      400
    );
  }
}

function validateGetNote(params: GetNoteParams): void {
  if (!params.noteId) {
    throw new BcpError(
      'Missing required parameter for get: noteId',
      'VALIDATION_ERROR',
      400
    );
  }
}

function validateUpdateNote(params: UpdateNoteParams): void {
  if (!params.noteId) {
    throw new BcpError(
      'Missing required parameter for update: noteId',
      'VALIDATION_ERROR',
      400
    );
  }
  // At least one field must be provided for update
  if (!params.content && !params.ownerId && !params.timestamp && !params.metadata) {
    throw new BcpError(
      'Update requires at least one field to change (content, ownerId, timestamp, or metadata)',
      'VALIDATION_ERROR',
      400
    );
  }
}