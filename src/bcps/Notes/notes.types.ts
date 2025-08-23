/**
 * Notes Types
 *
 * Consolidated type definitions for the Notes BCP.
 * These types define the structure of notes, service options, and related objects
 * for use with the HubSpot Notes API, including enhanced descriptions
 * and clarity on required/optional fields.
 */

// Helper types for unified Notes tool service methods
export interface CreateNoteOptions {
  ownerId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface ListNotesOptions {
  limit?: number;
  after?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Represents an association between a note and another object in HubSpot.
 * This structure is typically returned by the API.
 */
export interface NoteAssociation {
  /**
   * The type of object associated with the note (e.g., 'contacts', 'companies', 'deals').
   * Required.
   */
  objectType: string;

  /**
   * The unique identifier of the associated object.
   * Required.
   */
  objectId: string;

  /**
   * The specific type of association (e.g., 'note_to_contact', 'meeting_note').
   * This corresponds to HubSpot's internal association label or type ID.
   * Optional.
   */
  associationType?: string;

  /**
   * The category of the association (e.g., 'HUBSPOT_DEFINED', 'USER_DEFINED').
   * Optional.
   */
  associationCategory?: 'HUBSPOT_DEFINED' | 'USER_DEFINED' | 'INTEGRATOR_DEFINED';
}

/**
 * Input structure for creating or specifying a note association.
 * Used when creating a note with associations or adding associations later.
 */
export interface NoteAssociationInput {
  /**
   * The type of object to associate with the note (e.g., 'contacts', 'companies').
   * Required.
   */
  objectType: string;

  /**
   * The ID of the object to associate with the note.
   * Required.
   */
  objectId: string;

  /**
   * The specific type of association to create (optional).
   * If not provided, a default association type might be used based on the object types.
   * This needs mapping to HubSpot's AssociationSpec (associationCategory & associationTypeId).
   * Optional.
   */
  associationType?: string; // Consider mapping this to a specific ID or label later
}

/**
 * Represents a note object as returned by the HubSpot API.
 */
export interface Note {
  /**
   * Unique identifier for the note. Assigned by HubSpot.
   * Required.
   */
  id: string;

  /**
   * The main content (body) of the note. Supports plain text.
   * Rich text support might require specific handling or properties.
   * Required.
   */
  content: string;

  /**
   * The timestamp when the engagement (note) occurred or was logged.
   * Stored as `hs_timestamp` in HubSpot. ISO 8601 format string.
   * Required.
   */
  timestamp: string;

  /**
   * The ID of the HubSpot user who owns the note.
   * Optional. May not always be present.
   */
  ownerId?: string;

  /**
   * A list of associations linked to this note.
   * Optional. Included based on request parameters.
   */
  associations?: NoteAssociation[];

  /**
   * Additional metadata associated with the note.
   * Includes standard HubSpot properties like creation/update dates
   * and any custom properties fetched.
   * Optional.
   */
  metadata?: {
    /** ISO 8601 timestamp of when the note was created in HubSpot. */
    createdAt?: string;
    /** ISO 8601 timestamp of when the note was last modified. */
    updatedAt?: string;
    /** Indicates if the note is archived. */
    archived?: boolean;
    /** ISO 8601 timestamp of when the note was archived. */
    archivedAt?: string | null;
    /** Any other custom or standard properties fetched for the note. */
    [key: string]: any;
  };
}

/**
 * Input structure for creating a new note.
 */
export interface NoteCreateInput {
  /**
   * The main content (body) of the note.
   * Required.
   */
  content: string;

  /**
   * The timestamp for the note engagement (when it happened).
   * If not provided, the current time will be used.
   * Should be provided as a Unix timestamp (milliseconds) or an ISO 8601 string.
   * Optional.
   */
  timestamp?: string | number;

  /**
   * The ID of the HubSpot user to assign as the owner of the note.
   * Optional.
   */
  ownerId?: string;

  /**
   * An array of associations to create alongside the note.
   * Optional.
   */
  associations?: NoteAssociationInput[];

  /**
   * Additional custom properties to set on the note upon creation.
   * Use HubSpot internal property names (e.g., `custom_property_internal_name`).
   * Optional.
   */
  metadata?: Record<string, any>;
}

/**
 * Input structure for updating an existing note.
 * Only include fields that need to be changed.
 */
export interface NoteUpdateInput {
  /**
   * The new content for the note.
   * Optional.
   */
  content?: string;

  /**
   * The new timestamp for the note engagement.
   * Should be provided as a Unix timestamp (milliseconds) or an ISO 8601 string.
   * Optional.
   */
  timestamp?: string | number;

  /**
   * The new owner ID for the note.
   * Optional.
   */
  ownerId?: string;

  /**
   * Additional custom properties to update on the note.
   * Use HubSpot internal property names. Provide the new values.
   * Optional.
   */
  metadata?: Record<string, any>;

  // Note: Updating associations typically requires separate API calls using the Associations API
  // or specific note association endpoints. Direct updates via the note update endpoint
  // might not be supported or could replace all existing associations.
}

/**
 * Filters for listing or searching notes.
 */
export interface NoteFilters {
  /**
   * Filter notes by the ID of the HubSpot owner.
   * Optional.
   */
  ownerId?: string;

  /**
   * Filter notes created or occurring after this timestamp (inclusive).
   * ISO 8601 format string (e.g., "2023-01-01T00:00:00Z") or Unix timestamp (milliseconds).
   * Optional.
   */
  startTimestamp?: string | number;

  /**
   * Filter notes created or occurring before this timestamp (inclusive).
   * ISO 8601 format string or Unix timestamp (milliseconds).
   * Optional.
   */
  endTimestamp?: string | number;

  /**
   * Filter notes associated with a specific object type (e.g., 'contacts').
   * Optional. Requires associatedObjectId.
   */
  associatedObjectType?: string;

  /**
   * Filter notes associated with a specific object ID.
   * Optional. Requires associatedObjectType.
   */
  associatedObjectId?: string;

  /**
   * Search term to filter notes by content.
   * Optional. HubSpot search capabilities might vary.
   */
  query?: string;

  /**
   * Maximum number of notes to return per page.
   * Default: 10. Max: 100 (check HubSpot API limits).
   * Optional.
   */
  limit?: number;

  /**
   * Pagination cursor for retrieving the next page of results.
   * Obtained from the previous page's response.
   * Optional.
   */
  after?: string;
}

/**
 * Represents a paginated response when listing notes.
 */
export interface NotesPage {
  /**
   * An array containing the notes for the current page.
   * Required.
   */
  results: Note[];

  /**
   * Pagination information, including the cursor for the next page.
   * Optional. Only present if more results are available.
   */
  pagination?: {
    /**
     * The cursor token to use in the 'after' parameter for the next request.
     */
    after?: string;
  };

  /**
   * The total number of notes matching the filter criteria.
   * Required.
   */
  total: number;
}
