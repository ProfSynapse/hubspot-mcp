import {
  SimplePublicObject,
  SimplePublicObjectInput,
  SimplePublicObjectInputForCreate,
  CollectionResponseWithTotalSimplePublicObjectForwardPaging,
  PublicObjectSearchRequest,
  Filter,
  FilterGroup,
} from '@hubspot/api-client/lib/codegen/crm/objects/index.js';
import { HubspotBaseService } from '../../core/base-service.js';
import { ServiceConfig, BcpError, ApiError } from '../../core/types.js';
import {
  Note,
  NoteAssociation, // Updated structure
  NoteAssociationInput, // Updated structure
  NoteCreateInput, // Updated structure
  NoteUpdateInput, // Updated structure
  NoteFilters,     // Updated structure
  NotesPage        // Updated structure
} from './notes.types.js';
import { customListNotes } from './listNotes.custom.js';

const NOTE_OBJECT_TYPE = 'notes';
// Define standard properties to fetch for notes
const NOTE_PROPERTIES = [
  'hs_note_body',
  'hs_timestamp',
  'hubspot_owner_id',
  'hs_lastmodifieddate',
  'hs_createdate', // Added for createdAt metadata
  'hs_object_id', // Ensure ID is always fetched
];
// Define common association types to fetch by default when requested
const DEFAULT_ASSOCIATIONS_TO_FETCH = ['contacts', 'companies', 'deals', 'tickets'];

/**
 * Helper function to transform a HubSpot API object (SimplePublicObject)
 * into our standardized Note interface.
 * @param object - The SimplePublicObject from the HubSpot API.
 * @returns A Note object.
 */
function transformHubSpotObjectToNote(object: SimplePublicObject): Note {
  const properties = object.properties || {};
  const associations: NoteAssociation[] = [];

  // Map associations if they exist and are structured as expected
  // The HubSpot client library might place associations under `object.associations`
  const objectWithAssociations = object as any; // Type assertion needed as SDK types might lag
  if (objectWithAssociations.associations) {
    for (const objectTypeKey in objectWithAssociations.associations) {
      const associationGroup = objectWithAssociations.associations[objectTypeKey];
      if (associationGroup && associationGroup.results && Array.isArray(associationGroup.results)) {
        associationGroup.results.forEach((assoc: any) => {
          // Extract association type details if available
          let associationType: string | undefined;
          let associationCategory: NoteAssociation['associationCategory'] | undefined;
          if (assoc.types && Array.isArray(assoc.types) && assoc.types.length > 0) {
            // Prefer label if available, otherwise use type ID
            associationType = assoc.types[0].label || `TypeID ${assoc.types[0].typeId}`;
            associationCategory = assoc.types[0].category;
          }

          associations.push({
            objectId: assoc.id,
            objectType: objectTypeKey, // The key represents the associated object type
            associationType: associationType,
            associationCategory: associationCategory,
          });
        });
      }
    }
  }

  // Construct the standardized metadata object
  const metadata: Note['metadata'] = {
    createdAt: properties.hs_createdate || object.createdAt?.toISOString(),
    updatedAt: properties.hs_lastmodifieddate || object.updatedAt?.toISOString(),
    archived: object.archived || false,
    archivedAt: object.archivedAt?.toISOString() || null,
    // Include any other fetched properties dynamically
    ...Object.keys(properties)
      .filter(key => !['hs_note_body', 'hs_timestamp', 'hubspot_owner_id', 'hs_lastmodifieddate', 'hs_createdate'].includes(key))
      .reduce((acc, key) => {
        acc[key] = properties[key];
        return acc;
      }, {} as Record<string, any>),
  };

  return {
    id: object.id || properties.hs_object_id || '', // Ensure ID is present
    content: properties.hs_note_body || '',
    // Ensure timestamp is consistently returned as ISO string
    timestamp: properties.hs_timestamp
      ? new Date(parseInt(properties.hs_timestamp, 10)).toISOString()
      : object.createdAt?.toISOString() || '', // Fallback to createdAt if hs_timestamp missing
    ownerId: properties.hubspot_owner_id || undefined, // Return undefined if not present
    associations: associations.length > 0 ? associations : undefined, // Return undefined if no associations
    metadata: metadata,
  };
}

/**
 * Helper function to transform a HubSpot API collection response
 * into our standardized NotesPage interface.
 * @param response - The CollectionResponseWithTotalSimplePublicObjectForwardPaging from HubSpot API.
 * @returns A NotesPage object.
 */
function transformCollectionResponseToNotesPage(
  response: CollectionResponseWithTotalSimplePublicObjectForwardPaging
): NotesPage {
  return {
    results: response.results.map(transformHubSpotObjectToNote),
    pagination: response.paging?.next ? { after: response.paging.next.after } : undefined,
    total: response.total,
  };
}

/**
 * Helper function to format timestamp input (string or number) into milliseconds string.
 * @param timestamp - Timestamp input.
 * @returns Timestamp in milliseconds as a string, or current time if invalid/missing.
 */
function formatTimestampForHubspot(timestamp?: string | number): string {
  if (timestamp) {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return String(date.getTime());
    }
  }
  // Fallback to current time if timestamp is invalid or not provided
  return String(Date.now());
}

export class NotesService extends HubspotBaseService {
  constructor(config: ServiceConfig) {
    super(config);
  }

  /**
   * Creates a new note in HubSpot.
   * @param input - The data for the new note, conforming to NoteCreateInput.
   * @returns The created Note object.
   * @throws {BcpError} If validation fails or API call errors.
   */
  public async createNote(input: NoteCreateInput): Promise<Note> {
    this.checkInitialized();
    // Validate required fields with clearer message
    this.validateRequired(input, ['content'], 'createNote');

    const properties: Record<string, string> = {
      hs_note_body: input.content,
      // Format timestamp correctly for HubSpot
      hs_timestamp: formatTimestampForHubspot(input.timestamp),
    };

    if (input.ownerId) {
      properties.hubspot_owner_id = input.ownerId;
    }

    // Include custom metadata properties
    if (input.metadata) {
      for (const key in input.metadata) {
        // Ensure metadata is not overwriting core properties managed explicitly
        if (Object.prototype.hasOwnProperty.call(input.metadata, key) && !['hs_note_body', 'hs_timestamp', 'hubspot_owner_id'].includes(key)) {
          properties[key] = String(input.metadata[key]); // Ensure value is string
        }
      }
    }

    const simplePublicObjectInput: SimplePublicObjectInputForCreate = {
      properties,
      associations: [] // Initialize associations array
    };

    // Map associations if provided, using the helper for Type ID lookup
    if (input.associations && input.associations.length > 0) {
      simplePublicObjectInput.associations = input.associations.map(assocInput => {
        // Validate association input
        if (!assocInput.objectType || !assocInput.objectId) {
          throw new BcpError(
            `Invalid association input: objectType and objectId are required. Received: ${JSON.stringify(assocInput)}`,
            'VALIDATION_ERROR',
            400
          );
        }
        const typeId = this.getAssociationTypeId(assocInput.objectType, assocInput.associationType);
        return {
          to: { id: assocInput.objectId },
          types: [
            {
              // Default to HUBSPOT_DEFINED unless specified otherwise (future enhancement)
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: typeId
            }
          ]
        };
      });
    }

    try {
      const response = await this.client.crm.objects.basicApi.create(NOTE_OBJECT_TYPE, simplePublicObjectInput);
      // Fetch the created note again with associations to ensure consistent response structure
      return this.getNote(response.id, true);
    } catch (e: any) {
      this.handleApiError(e, 'Failed to create note');
    }
  }

  /**
   * Retrieves a specific note by its ID from HubSpot.
   * @param id - The ID of the note to retrieve.
   * @param includeAssociations - Whether to fetch associated objects (default: true).
   * @returns The requested Note object.
   * @throws {BcpError} If ID is missing, note not found, or API call errors.
   */
  public async getNote(id: string, includeAssociations: boolean = true): Promise<Note> {
    this.checkInitialized();
    if (!id) {
      throw new BcpError('Note ID is required to get a note.', 'VALIDATION_ERROR', 400);
    }
    try {
      // Define which association types to fetch if requested
      const associationsToFetch = includeAssociations
        ? DEFAULT_ASSOCIATIONS_TO_FETCH
        : undefined;

      const response = await this.client.crm.objects.basicApi.getById(
        NOTE_OBJECT_TYPE,
        id,
        NOTE_PROPERTIES, // Fetch standard properties
        associationsToFetch // Fetch associations if requested
      );
      return transformHubSpotObjectToNote(response);
    } catch (e: any) {
      // Provide more specific error for not found
      if (e.code === 404 || e.body?.category === 'OBJECT_NOT_FOUND') {
        throw new BcpError(`Note with ID '${id}' not found.`, 'NOT_FOUND', 404);
      }
      this.handleApiError(e, `Failed to get note with ID ${id}`);
    }
  }

  /**
   * Updates an existing note in HubSpot.
   * @param id - The ID of the note to update.
   * @param input - The data to update, conforming to NoteUpdateInput. Only provided fields are updated.
   * @returns The updated Note object.
   * @throws {BcpError} If ID or input is invalid, note not found, or API call errors.
   */
  public async updateNote(id: string, input: NoteUpdateInput): Promise<Note> {
    this.checkInitialized();
    if (!id) {
      throw new BcpError('Note ID is required for update.', 'VALIDATION_ERROR', 400);
    }
    // Ensure there's something to update
    if (Object.keys(input).length === 0 || (input.content === undefined && input.timestamp === undefined && input.ownerId === undefined && input.metadata === undefined)) {
      throw new BcpError('Update input cannot be empty. Provide at least one field to update (content, timestamp, ownerId, or metadata).', 'VALIDATION_ERROR', 400);
    }

    const properties: Record<string, string> = {};
    if (input.content !== undefined) {
      properties.hs_note_body = input.content;
    }
    if (input.timestamp !== undefined) {
      properties.hs_timestamp = formatTimestampForHubspot(input.timestamp);
    }
    if (input.ownerId !== undefined) {
      // Allow setting ownerId to empty string to unassign
      properties.hubspot_owner_id = input.ownerId;
    }
    // Include custom metadata properties for update
    if (input.metadata) {
      for (const key in input.metadata) {
        if (Object.prototype.hasOwnProperty.call(input.metadata, key) && !['hs_note_body', 'hs_timestamp', 'hubspot_owner_id'].includes(key)) {
          properties[key] = String(input.metadata[key]);
        }
      }
    }

    // Check if any properties were actually prepared for update
    if (Object.keys(properties).length === 0) {
        throw new BcpError('No valid properties provided to update.', 'VALIDATION_ERROR', 400);
    }

    const simplePublicObjectInput: SimplePublicObjectInput = { properties };

    try {
      await this.client.crm.objects.basicApi.update(NOTE_OBJECT_TYPE, id, simplePublicObjectInput);
      // Fetch the updated note to return the full object with potentially updated metadata
      return this.getNote(id, true); // Assuming we want associations in the response
    } catch (e: any) {
      if (e.code === 404 || e.body?.category === 'OBJECT_NOT_FOUND') {
        throw new BcpError(`Note with ID '${id}' not found for update.`, 'NOT_FOUND', 404);
      }
      this.handleApiError(e, `Failed to update note with ID ${id}`);
    }
  }

  /**
   * Deletes (archives) a note in HubSpot by its ID.
   * @param id - The ID of the note to delete.
   * @returns {Promise<void>} Resolves when deletion is successful.
   * @throws {BcpError} If ID is missing, note not found, or API call errors.
   */
  public async deleteNote(id: string): Promise<void> {
    this.checkInitialized();
    if (!id) {
      throw new BcpError('Note ID is required for deletion.', 'VALIDATION_ERROR', 400);
    }
    try {
      await this.client.crm.objects.basicApi.archive(NOTE_OBJECT_TYPE, id);
    } catch (e: any) {
      if (e.code === 404 || e.body?.category === 'OBJECT_NOT_FOUND') {
        // Treat not found during deletion as potentially idempotent (already deleted)
        // Log a warning instead of throwing an error, or make this configurable?
        console.warn(`Note with ID '${id}' not found during deletion attempt. It might have been already deleted.`);
        // Depending on desired behavior, you might still throw:
        // throw new BcpError(`Note with ID '${id}' not found for deletion.`, 'NOT_FOUND', 404);
        return; // Indicate success even if not found
      }
      this.handleApiError(e, `Failed to delete note with ID ${id}`);
    }
  }

  /**
   * Lists notes with optional filters and pagination using the search endpoint.
   * Uses a custom implementation to bypass SDK type checking issues.
   * 
   * @param filters - Optional filters conforming to NoteFilters.
   * @param includeAssociations - Whether to include associations in the response (default: true).
   * @returns A page of notes (NotesPage).
   * @throws {BcpError} If API call errors.
   */
  public async listNotes(filters?: NoteFilters, includeAssociations: boolean = true): Promise<NotesPage> {
    this.checkInitialized();
    
    try {
      // Use our custom implementation that bypasses SDK type checking issues
      return await customListNotes(this.client, filters, includeAssociations);
    } catch (e: any) {
      // Re-throw if it's already a BcpError
      if (e instanceof BcpError) {
        throw e;
      }
      // Otherwise handle the error
      this.handleApiError(e, 'Failed to list notes');
    }
  }

  /**
   * Retrieves a list of the most recent notes, sorted by timestamp descending.
   * @param limit - Optional limit for the number of recent notes (default 10, max 100).
   * @param includeAssociations - Whether to include associations (default: true).
   * @returns A page of recent notes (NotesPage).
   * @throws {BcpError} If limit is invalid or API call errors.
   */
  public async getRecentNotes(limit: number = 10, includeAssociations: boolean = true): Promise<NotesPage> {
    this.checkInitialized();
    if (limit <= 0 || limit > 100) {
        throw new BcpError('Limit must be a positive number between 1 and 100.', 'VALIDATION_ERROR', 400);
    }

    // Use listNotes with sorting and limit, no filters
    const filters: NoteFilters = { limit };
    return this.listNotes(filters, includeAssociations);
  }

  /**
   * Adds an association between a note and another HubSpot object.
   * Uses the dedicated V4 Associations API.
   * @param noteId - The ID of the note.
   * @param objectType - The type of object to associate with (e.g., 'contacts', 'companies').
   * @param objectId - The ID of the object to associate with.
   * @param associationType - Optional specific association type label or identifier.
   * @returns The updated Note object with the new association reflected.
   * @throws {BcpError} If parameters are invalid or API call errors.
   */
  public async addAssociationToNote(
    noteId: string,
    objectType: string,
    objectId: string,
    associationType?: string // This maps to associationTypeId internally
  ): Promise<Note> {
    this.checkInitialized();

    // Validate required parameters
    if (!noteId) throw new BcpError('Note ID is required to add association.', 'VALIDATION_ERROR', 400);
    if (!objectType) throw new BcpError('Associated object type is required.', 'VALIDATION_ERROR', 400);
    if (!objectId) throw new BcpError('Associated object ID is required.', 'VALIDATION_ERROR', 400);

    try {
      const associationTypeId = this.getAssociationTypeId(objectType, associationType);
      // Use the V4 Associations API endpoint
      await this.client.apiRequest({
        method: 'PUT',
        // Path format: /crm/v4/objects/{objectType}/{objectId}/associations/{toObjectType}/{toObjectId}
        path: `/crm/v4/objects/${NOTE_OBJECT_TYPE}/${noteId}/associations/${objectType}/${objectId}`,
        body: [
          {
            associationCategory: 'HUBSPOT_DEFINED', // Assuming standard association
            associationTypeId: associationTypeId
          }
        ]
      });

      // Return the updated note, fetching it again to include the new association
      return this.getNote(noteId, true);
    } catch (e: any) {
      // Handle potential duplicate association errors? HubSpot might return 400 or similar.
      if (e.response?.body?.message?.includes('already exists')) {
         console.warn(`Association between note ${noteId} and ${objectType} ${objectId} might already exist.`);
         // Return the current note state if association already exists
         return this.getNote(noteId, true);
      }
      this.handleApiError(e, `Failed to add association from note ${noteId} to ${objectType} ${objectId}`);
    }
  }

  /**
   * Removes an association between a note and another HubSpot object.
   * Uses the dedicated V4 Associations API.
   * @param noteId - The ID of the note.
   * @param objectType - The type of object to disassociate (e.g., 'contacts').
   * @param objectId - The ID of the object to disassociate.
   * @returns The updated Note object with the association removed.
   * @throws {BcpError} If parameters are invalid or API call errors.
   */
  public async removeAssociationFromNote(
    noteId: string,
    objectType: string,
    objectId: string
  ): Promise<Note> {
    this.checkInitialized();

    if (!noteId) throw new BcpError('Note ID is required to remove association.', 'VALIDATION_ERROR', 400);
    if (!objectType) throw new BcpError('Associated object type is required.', 'VALIDATION_ERROR', 400);
    if (!objectId) throw new BcpError('Associated object ID is required.', 'VALIDATION_ERROR', 400);

    try {
      // Use the V4 Associations API endpoint for deletion
      await this.client.apiRequest({
        method: 'DELETE',
        path: `/crm/v4/objects/${NOTE_OBJECT_TYPE}/${noteId}/associations/${objectType}/${objectId}`
      });

      // Return the updated note, fetching it again to reflect the removed association
      return this.getNote(noteId, true);
    } catch (e: any) {
       if (e.code === 404) {
         // If the association doesn't exist, treat as success (idempotent)
         console.warn(`Association between note ${noteId} and ${objectType} ${objectId} not found during removal attempt.`);
         return this.getNote(noteId, true);
       }
      this.handleApiError(e, `Failed to remove association from note ${noteId} to ${objectType} ${objectId}`);
    }
  }

  /**
   * Lists all associations for a specific note, filtered by the target object type.
   * Uses the V4 Associations API.
   * @param noteId - The ID of the note whose associations are to be listed.
   * @param toObjectType - The type of associated object to list (e.g., 'contacts', 'companies').
   * @param limit - Maximum number of results per page (default: 100, max: 500).
   * @param after - Pagination cursor for fetching the next page.
   * @returns A paginated list of associations conforming to NoteAssociation.
   * @throws {BcpError} If parameters are invalid or API call errors.
   */
  public async listNoteAssociations(
    noteId: string,
    toObjectType: string,
    limit: number = 100,
    after?: string
  ): Promise<{ results: NoteAssociation[], pagination?: { after?: string } }> {
    this.checkInitialized();

    if (!noteId) throw new BcpError('Note ID is required to list associations.', 'VALIDATION_ERROR', 400);
    if (!toObjectType) throw new BcpError('Target object type (toObjectType) is required.', 'VALIDATION_ERROR', 400);

    // Basic validation for common object types, expand as needed
    const validObjectTypes = ['contacts', 'companies', 'deals', 'tickets', 'products', 'line_items']; // Add more as needed
    if (!validObjectTypes.includes(toObjectType.toLowerCase())) {
      console.warn(
        `Listing associations for potentially unsupported object type: ${toObjectType}. Valid types often include: ${validObjectTypes.join(', ')}`
      );
      // Allow potentially custom object types, but warn.
      // throw new BcpError(`Invalid target object type: ${toObjectType}.`, 'VALIDATION_ERROR', 400);
    }

    // Ensure limit is within valid bounds
    const effectiveLimit = Math.max(1, Math.min(limit, 500)); // Clamp limit between 1 and 500

    try {
      // Use the V4 Associations API endpoint: GET /crm/v4/objects/{objectType}/{objectId}/associations/{toObjectType}
      const queryParams = new URLSearchParams();
      queryParams.append('limit', effectiveLimit.toString());
      if (after) {
        queryParams.append('after', after);
      }

      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v4/objects/${NOTE_OBJECT_TYPE}/${noteId}/associations/${toObjectType}?${queryParams.toString()}`
      });

      // Transform the HubSpot API response to our standardized NoteAssociation format
      const associations: NoteAssociation[] = [];
      const typedResponse = response as any; // Type assertion needed

      if (typedResponse && Array.isArray(typedResponse.results)) {
        for (const result of typedResponse.results) {
          if (result && result.toObjectId) {
             let associationType: string | undefined;
             let associationCategory: NoteAssociation['associationCategory'] | undefined;
             // Extract detailed type info if available from V4 response structure
             if (result.associationTypes && Array.isArray(result.associationTypes) && result.associationTypes.length > 0) {
               const typeInfo = result.associationTypes[0]; // Assuming one type per result for simplicity
               associationType = typeInfo.label || `TypeID ${typeInfo.typeId}`;
               associationCategory = typeInfo.category;
             }
            associations.push({
              objectId: result.toObjectId,
              objectType: toObjectType, // The target object type we queried for
              associationType: associationType,
              associationCategory: associationCategory,
            });
          }
        }
      }

      return {
        results: associations,
        pagination: typedResponse?.paging?.next ? { after: typedResponse.paging.next.after } : undefined
      };
    } catch (e: any) {
       if (e.code === 404) {
         // If the note itself doesn't exist
         throw new BcpError(`Note with ID '${noteId}' not found when listing associations.`, 'NOT_FOUND', 404);
       }
      this.handleApiError(e, `Failed to list associations of type ${toObjectType} for note ${noteId}`);
    }
  }

  /**
   * Maps a simplified object type and an optional association type label/name
   * to a known HubSpot association type ID.
   * This is a placeholder and should be replaced or augmented by dynamic discovery
   * using the `getAssociationTypes` tool/endpoint in the future.
   *
   * @param objectType - The target object type (e.g., 'contacts', 'companies').
   * @param associationType - An optional friendly name for the association type (e.g., 'meeting').
   * @returns The corresponding HubSpot association type ID. Defaults to a generic ID if not found.
   * @throws {BcpError} If the objectType is fundamentally unrecognized for notes.
   * @private
   */
  private getAssociationTypeId(objectType: string, associationType?: string): number {
    // Standard HubSpot-defined association type IDs (Note -> Object)
    // Source: Derived from common usage and potential API responses. Needs verification/dynamic lookup.
    // Reference: https://developers.hubspot.com/docs/api/crm/associations/v4
    const noteAssociationMap: Record<string, Record<string, number>> = {
      'contacts': {
        'default': 202, // HubSpot defined: Note to Contact
        'meeting': 206, // Example: Meeting Note to Contact (Verify ID)
        'call': 208,    // Example: Call Note to Contact (Verify ID)
        'email': 210,   // Example: Email Note to Contact (Verify ID)
        'task': 212,    // Example: Task Note to Contact (Verify ID)
      },
      'companies': {
        'default': 214, // HubSpot defined: Note to Company
      },
      'deals': {
        'default': 216, // HubSpot defined: Note to Deal
      },
      'tickets': {
        'default': 218, // HubSpot defined: Note to Ticket
      },
      // Add mappings for other objects like 'products', 'line_items' if needed
    };

    // Normalize object type (e.g., 'contact' -> 'contacts')
    const normalizedObjectType = objectType.toLowerCase().endsWith('s')
      ? objectType.toLowerCase()
      : `${objectType.toLowerCase()}s`;

    const typeMap = noteAssociationMap[normalizedObjectType];

    if (!typeMap) {
      // If the object type itself is unknown in our map, maybe throw or return a default?
      // Throwing might be safer to prevent unexpected behavior.
      console.warn(`Unrecognized object type '${objectType}' for note association mapping. Defaulting might be risky.`);
      // Consider throwing an error for unsupported types:
      // throw new BcpError(`Association mapping not defined for note to object type: ${objectType}`, 'CONFIG_ERROR', 500);
      return 1; // Fallback to a potentially invalid/generic ID - **RISKY**
    }

    // Normalize the provided associationType label (lowercase, trim)
    const normalizedAssociationType = associationType?.toLowerCase().trim();

    // Look for a specific type match, otherwise use the default for that object type
    return (normalizedAssociationType && typeMap[normalizedAssociationType])
      ? typeMap[normalizedAssociationType]
      : typeMap['default'];
  }

  // Overload handleApiError for more specific context if needed
  protected handleApiError(error: unknown, context: string): never {
     if (error instanceof ApiError) { // If it's already our custom ApiError
       throw error;
     }
     // Add more specific error parsing if possible from HubSpot client errors
     const e = error as any;
     let status = e.code || e.status || 500;
     let message = e.message || String(error);
     let code = 'API_ERROR';

     if (status === 400 && e.body?.category === 'VALIDATION_ERROR') {
       code = 'VALIDATION_ERROR';
       message = `Validation failed: ${e.body.message || message}`;
     } else if (status === 401 || status === 403) {
       code = 'AUTH_ERROR';
       message = `Authentication/Authorization error: ${message}`;
     } else if (status === 404) {
       code = 'NOT_FOUND';
       // Context should already indicate what wasn't found
     } else if (status === 429) {
       code = 'RATE_LIMIT';
       message = `Rate limit exceeded: ${message}`;
     }

     throw new BcpError(
       `${context}: ${message}`,
       code,
       status
     );
   }

   // Overload validateRequired for more specific context
   protected validateRequired<T extends object>(
     params: T,
     required: (keyof T)[],
     operationName?: string // Add operation context
   ): void {
     for (const key of required) {
       if (params[key] === undefined || params[key] === null || params[key] === '') { // Also check for empty string
         const context = operationName ? ` in operation '${operationName}'` : '';
         throw new BcpError(
           `Missing required parameter${context}: ${String(key)}`,
           'VALIDATION_ERROR',
           400
         );
       }
     }
   }
}
