/**
 * Custom Notes List Implementation
 * 
 * This file provides a custom implementation of the listNotes functionality
 * that bypasses the HubSpot SDK's type checking issues by using the raw apiRequest method.
 */

import { NotesPage, NoteFilters } from './notes.types.js';
import { Client } from '@hubspot/api-client';
import { BcpError } from '../../core/types.js';

// Define standard properties to fetch for notes
const NOTE_PROPERTIES = [
  'hs_note_body',
  'hs_timestamp',
  'hubspot_owner_id',
  'hs_lastmodifieddate',
  'hs_createdate',
  'hs_object_id',
];

// Define common association types to fetch by default
const DEFAULT_ASSOCIATIONS_TO_FETCH = ['contacts', 'companies', 'deals', 'tickets'];

/**
 * Custom implementation of listNotes that uses the raw apiRequest method
 * to bypass SDK type checking issues.
 * 
 * @param client - The HubSpot API client
 * @param filters - Optional filters for the notes
 * @param includeAssociations - Whether to include associations in the response
 * @returns A page of notes
 */
export async function customListNotes(
  client: Client,
  filters?: NoteFilters,
  includeAssociations: boolean = true
): Promise<NotesPage> {
  // Calculate limit and after values
  const limit = filters?.limit && filters.limit > 0 && filters.limit <= 100 ? filters.limit : 10;
  const after = filters?.after || '0';

  // Build the search request manually
  const searchRequest: any = {
    filterGroups: [],
    sorts: ['-hs_timestamp'], // Sort by timestamp descending
    properties: NOTE_PROPERTIES,
    limit: limit,
    after: after,
  };

  // Add associations if requested
  if (includeAssociations) {
    searchRequest.associations = DEFAULT_ASSOCIATIONS_TO_FETCH;
  }

  // Build filter groups
  const filterGroup: any = { filters: [] };

  // Add owner filter
  if (filters?.ownerId) {
    filterGroup.filters.push({
      propertyName: 'hubspot_owner_id',
      operator: 'EQ',
      value: filters.ownerId, // No type checking issues here
    });
  }

  // Add timestamp filters
  if (filters?.startTimestamp) {
    filterGroup.filters.push({
      propertyName: 'hs_timestamp',
      operator: 'GTE',
      value: String(new Date(filters.startTimestamp).getTime()),
    });
  }

  if (filters?.endTimestamp) {
    filterGroup.filters.push({
      propertyName: 'hs_timestamp',
      operator: 'LTE',
      value: String(new Date(filters.endTimestamp).getTime()),
    });
  }

  // Add content query filter
  if (filters?.query) {
    searchRequest.query = filters.query;
  }

  // Add association filters
  if (filters?.associatedObjectType && filters?.associatedObjectId) {
    console.warn("Filtering notes by association via search API is experimental and may not work as expected.");
    searchRequest.filterGroups.push({
      filters: [{
        propertyName: `associations.${filters.associatedObjectType}`,
        operator: 'EQ',
        value: filters.associatedObjectId
      }]
    });
  }

  // Add the main filter group if it has filters
  if (filterGroup.filters.length > 0) {
    searchRequest.filterGroups.push(filterGroup);
  }

  try {
    // Use the raw apiRequest method to bypass SDK type checking
    const response = await client.apiRequest({
      method: 'POST',
      path: '/crm/v3/objects/notes/search',
      body: searchRequest
    });

    // First cast to unknown, then to our expected type structure
    const typedResponse = (response as unknown) as {
      results: any[];
      paging?: { next?: { after: string } };
      total: number;
    };

    // Transform the response to our NotesPage format
    return {
      results: (typedResponse.results || []).map(transformHubSpotObjectToNote),
      pagination: typedResponse.paging?.next ? { after: typedResponse.paging.next.after } : undefined,
      total: typedResponse.total || 0,
    };
  } catch (error: any) {
    const message = error.message || String(error);
    const status = error.status || 500;
    throw new BcpError(
      `Failed to list notes: ${message}`,
      error.category || 'API_ERROR',
      status
    );
  }
}

/**
 * Helper function to transform a HubSpot API object to our Note interface
 */
function transformHubSpotObjectToNote(object: any): any {
  const properties = object.properties || {};
  const associations: any[] = [];

  // Map associations if they exist
  if (object.associations) {
    for (const objectTypeKey in object.associations) {
      const associationGroup = object.associations[objectTypeKey];
      if (associationGroup && associationGroup.results && Array.isArray(associationGroup.results)) {
        associationGroup.results.forEach((assoc: any) => {
          let associationType: string | undefined;
          let associationCategory: string | undefined;
          
          if (assoc.types && Array.isArray(assoc.types) && assoc.types.length > 0) {
            associationType = assoc.types[0].label || `TypeID ${assoc.types[0].typeId}`;
            associationCategory = assoc.types[0].category;
          }

          associations.push({
            objectId: assoc.id,
            objectType: objectTypeKey,
            associationType: associationType,
            associationCategory: associationCategory,
          });
        });
      }
    }
  }

  // Construct metadata
  const metadata: any = {
    createdAt: properties.hs_createdate || object.createdAt,
    updatedAt: properties.hs_lastmodifieddate || object.updatedAt,
    archived: object.archived || false,
    archivedAt: object.archivedAt || null,
  };

  // Add any other properties to metadata
  for (const key in properties) {
    if (!['hs_note_body', 'hs_timestamp', 'hubspot_owner_id', 'hs_lastmodifieddate', 'hs_createdate'].includes(key)) {
      metadata[key] = properties[key];
    }
  }

  return {
    id: object.id || properties.hs_object_id || '',
    content: properties.hs_note_body || '',
    timestamp: properties.hs_timestamp
      ? new Date(parseInt(properties.hs_timestamp, 10)).toISOString()
      : object.createdAt || '',
    ownerId: properties.hubspot_owner_id,
    associations: associations.length > 0 ? associations : undefined,
    metadata: metadata,
  };
}
