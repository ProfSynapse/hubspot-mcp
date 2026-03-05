/**
 * Association Enrichment Engine
 *
 * Location: src/core/association-enrichment-engine.ts
 * Summary: Handles fetching and attaching association data to contacts from HubSpot
 *
 * This engine is used by:
 * - HubSpot client for enriching contact responses
 * - Contact BCP tools (search, get, recent) when association parameters are provided
 *
 * Key features:
 * - Parallel fetching of different association types
 * - Graceful degradation for partial failures
 * - No caching - always fetches fresh data per architecture requirements
 * - Support for selective association type filtering
 */

import { Client } from '@hubspot/api-client';
import { ApiError } from './types.js';

/**
 * Valid association types for contacts
 */
export type AssociationType =
  | 'companies'
  | 'deals'
  | 'tickets'
  | 'notes'
  | 'tasks'
  | 'meetings'
  | 'calls'
  | 'emails'
  | 'quotes';

/**
 * Configuration options for association enrichment
 */
export interface AssociationOptions {
  associationTypes: AssociationType[];
  associationLimit?: number;
}

/**
 * Base contact data structure
 */
export interface BaseContact {
  id: string;
  properties: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Associated object data structures
 */
export interface AssociatedCompany {
  id: string;
  name?: string;
  domain?: string;
  industry?: string;
  associationType: string;
  associationTimestamp?: string;
}

export interface AssociatedDeal {
  id: string;
  dealname?: string;
  amount?: number;
  closedate?: string;
  dealstage?: string;
  pipeline?: string;
  associationType: string;
}

export interface AssociatedNote {
  id: string;
  body?: string;
  timestamp?: string;
  ownerName?: string;
  associationType: string;
}

export interface AssociatedEmail {
  id: string;
  subject?: string;
  html?: string;
  text?: string;
  timestamp?: string;
  direction?: 'INCOMING' | 'OUTGOING';
  associationType: string;
}

export interface AssociatedTask {
  id: string;
  subject?: string;
  status?: string;
  priority?: string;
  timestamp?: string;
  associationType: string;
}

export interface AssociatedMeeting {
  id: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  associationType: string;
}

export interface AssociatedCall {
  id: string;
  title?: string;
  status?: string;
  duration?: number;
  timestamp?: string;
  associationType: string;
}

export interface AssociatedTicket {
  id: string;
  subject?: string;
  status?: string;
  priority?: string;
  timestamp?: string;
  associationType: string;
}

export interface AssociatedQuote {
  id: string;
  title?: string;
  status?: string;
  amount?: number;
  expirationDate?: string;
  associationType: string;
}

/**
 * Association data container
 */
export interface AssociationData {
  companies?: AssociatedCompany[];
  deals?: AssociatedDeal[];
  tickets?: AssociatedTicket[];
  notes?: AssociatedNote[];
  tasks?: AssociatedTask[];
  meetings?: AssociatedMeeting[];
  calls?: AssociatedCall[];
  emails?: AssociatedEmail[];
  quotes?: AssociatedQuote[];
}

/**
 * Enhanced contact with association data
 */
export interface EnhancedContact extends BaseContact {
  associations?: AssociationData;
  associationMetadata?: {
    enrichmentTimestamp: string;
    partialFailures?: string[];
    totalAssociationCount: Record<string, number>;
  };
}

/**
 * Association error details
 */
export interface AssociationError {
  associationType: string;
  error: string;
  recoveryAction?: string;
}

/**
 * Association Enrichment Engine
 *
 * Responsible for fetching and attaching association data to contacts.
 * Implements parallel fetching and graceful error handling.
 */
export class AssociationEnrichmentEngine {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Enrich an array of contacts with association data
   *
   * @param contacts - Array of contacts to enrich
   * @param options - Association enrichment options
   * @returns Promise resolving to enriched contacts
   */
  async enrichContacts(
    contacts: BaseContact[],
    options: AssociationOptions
  ): Promise<EnhancedContact[]> {
    if (!contacts.length || !options.associationTypes.length) {
      return contacts as EnhancedContact[];
    }

    // Process contacts in parallel
    const enrichedContacts = await Promise.all(
      contacts.map(contact => this.enrichSingleContact(contact, options))
    );

    return enrichedContacts;
  }

  /**
   * Enrich a single contact with association data
   *
   * @param contact - Contact to enrich
   * @param options - Association enrichment options
   * @returns Promise resolving to enriched contact
   */
  async enrichSingleContact(
    contact: BaseContact,
    options: AssociationOptions
  ): Promise<EnhancedContact> {
    const enrichedContact: EnhancedContact = { ...contact };
    const errors: AssociationError[] = [];
    const associationData: AssociationData = {};
    const associationCounts: Record<string, number> = {};

    // Fetch each association type in parallel
    const associationPromises = options.associationTypes.map(async (type) => {
      try {
        const associations = await this.fetchAssociationsByType(
          contact.id,
          type,
          options.associationLimit || 50
        );

        associationData[type] = associations;
        associationCounts[type] = associations.length;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          associationType: type,
          error: errorMessage,
          recoveryAction: this.getRecoveryAction(error)
        });

        // For scope-related errors, provide the association IDs without content
        if (error instanceof Error && error.message.includes('sales-email-read')) {
          console.log(`⚠️ ${type} associations found but content requires sales-email-read scope`);

          // Try to get just the association IDs without content
          try {
            const assocOnlyResponse = await this.client.crm.associations.batchApi.read(
              'contacts',
              type,
              { inputs: [{ id: contact.id }] }
            );

            if (assocOnlyResponse.results?.[0]?.to) {
              const associationStubs = assocOnlyResponse.results[0].to.map((assoc: any) => ({
                id: assoc.id,
                associationType: assoc.type,
                error: 'Content requires sales-email-read scope'
              }));

              associationData[type] = associationStubs;
              associationCounts[type] = associationStubs.length;

              // Update the error to be more informative
              errors[errors.length - 1].recoveryAction = 'grant_sales_email_read_scope';
            }
          } catch (assocError) {
            // If even association read fails, keep the empty array
            associationData[type] = [];
            associationCounts[type] = 0;
          }
        } else {
          // Set empty array for other types of failures
          associationData[type] = [];
          associationCounts[type] = 0;
        }
      }
    });

    // Wait for all association fetches to complete
    await Promise.allSettled(associationPromises);

    // Add association data to contact
    enrichedContact.associations = associationData;

    // Add metadata
    enrichedContact.associationMetadata = {
      enrichmentTimestamp: new Date().toISOString(),
      totalAssociationCount: associationCounts
    };

    // Add error information if any failures occurred
    if (errors.length > 0) {
      enrichedContact.associationMetadata.partialFailures = errors.map(e => e.associationType);
    }

    return enrichedContact;
  }

  /**
   * Fetch associations for a specific contact and association type
   *
   * @param contactId - Contact ID
   * @param associationType - Type of association to fetch
   * @param limit - Maximum number of associations to fetch
   * @returns Promise resolving to array of associated objects
   */
  private async fetchAssociationsByType(
    contactId: string,
    associationType: AssociationType,
    limit: number
  ): Promise<any[]> {
    try {
      // Use the HubSpot SDK's associations API
      const associationResponse = await this.client.crm.associations.batchApi.read(
        'contacts',
        associationType,
        { inputs: [{ id: contactId }] }
      );

      if (!associationResponse.results || associationResponse.results.length === 0) {
        return [];
      }

      const firstResult = associationResponse.results[0];
      if (!firstResult.to || firstResult.to.length === 0) {
        return [];
      }

      // Extract object IDs
      const objectIds = firstResult.to.map((assoc: any) => assoc.id);

      // Batch fetch the actual objects with details
      const objectData = await this.batchFetchObjects(associationType, objectIds);

      // Transform and combine with association metadata
      return objectData.map((obj: any, index: number) => {
        const associationMeta = firstResult.to[index];
        return this.transformAssociatedObject(obj, associationType, associationMeta);
      });

    } catch (error) {
      throw new ApiError(
        `Failed to fetch ${associationType} associations for contact ${contactId}: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        `fetchAssociations_${associationType}`,
        'unknown'
      );
    }
  }

  /**
   * Get the appropriate CRM module for an object type
   *
   * @param objectType - Type of object
   * @returns CRM module or undefined
   */
  private getCrmModule(objectType: string): any {
    switch (objectType) {
      case 'companies':
        return this.client.crm.companies;
      case 'deals':
        return this.client.crm.deals;
      case 'tickets':
        return this.client.crm.tickets;
      case 'notes':
      case 'tasks':
      case 'meetings':
      case 'calls':
      case 'emails':
        // These are custom objects, return a wrapper that uses the correct API
        return {
          batchApi: {
            read: (params: any) => this.client.crm.objects.batchApi.read(objectType, params)
          },
          basicApi: {
            getById: (id: string, properties?: string[]) =>
              this.client.crm.objects.basicApi.getById(objectType, id, properties)
          }
        };
      case 'quotes':
        return this.client.crm.quotes;
      default:
        return undefined;
    }
  }

  /**
   * Batch fetch objects by type and IDs
   *
   * @param objectType - Type of objects to fetch
   * @param objectIds - Array of object IDs
   * @returns Promise resolving to array of objects
   */
  private async batchFetchObjects(objectType: string, objectIds: string[]): Promise<any[]> {
    if (objectIds.length === 0) {
      return [];
    }

    try {
      // Use batch read API if available, otherwise fetch individually
      if (objectIds.length <= 100) {
        // Batch read for efficiency using the SDK
        const crmModule = this.getCrmModule(objectType);
        if (!crmModule) {
          return [];
        }

        const batchResponse = await crmModule.batchApi.read({
          inputs: objectIds.map(id => ({ id })),
          properties: this.getPropertiesForObjectType(objectType)
        });

        return batchResponse.results || [];
      } else {
        // Fetch individually for large datasets
        const crmModule = this.getCrmModule(objectType);
        if (!crmModule) {
          return [];
        }

        const objectPromises = objectIds.map(id =>
          crmModule.basicApi.getById(
            id,
            this.getPropertiesForObjectType(objectType)
          )
        );

        const objects = await Promise.allSettled(objectPromises);
        return objects
          .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
          .map(result => result.value);
      }
    } catch (error) {
      throw new ApiError(
        `Failed to batch fetch ${objectType} objects: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        `batchFetch_${objectType}`,
        'unknown'
      );
    }
  }

  /**
   * Get relevant properties for each object type
   *
   * @param objectType - Type of object
   * @returns Array of property names to fetch
   */
  private getPropertiesForObjectType(objectType: string): string[] {
    const propertyMap: Record<string, string[]> = {
      companies: ['name', 'domain', 'industry', 'description', 'website'],
      deals: ['dealname', 'amount', 'closedate', 'dealstage', 'pipeline', 'description'],
      tickets: ['subject', 'hs_ticket_priority', 'hs_ticket_category', 'content'],
      notes: ['hs_note_body', 'hs_timestamp'],
      tasks: ['hs_task_subject', 'hs_task_status', 'hs_task_priority', 'hs_timestamp'],
      meetings: ['hs_meeting_title', 'hs_meeting_start_time', 'hs_meeting_end_time', 'hs_meeting_outcome'],
      calls: ['hs_call_title', 'hs_call_status', 'hs_call_duration', 'hs_timestamp'],
      emails: ['hs_email_subject', 'hs_email_text', 'hs_email_html', 'hs_timestamp', 'hs_email_direction'],
      quotes: ['hs_title', 'hs_expiration_date', 'hs_quote_amount']
    };

    return propertyMap[objectType] || ['name', 'description'];
  }

  /**
   * Transform associated object to standardized format
   *
   * @param obj - Raw object from API
   * @param associationType - Type of association
   * @param associationMeta - Association metadata
   * @returns Transformed associated object
   */
  private transformAssociatedObject(obj: any, associationType: AssociationType, associationMeta: any): any {
    const baseTransform = {
      id: obj.id,
      associationType: associationMeta.associationSpec?.associationTypeId || 'unknown'
    };

    switch (associationType) {
      case 'companies':
        return {
          ...baseTransform,
          name: obj.properties.name,
          domain: obj.properties.domain,
          industry: obj.properties.industry,
          associationTimestamp: obj.createdAt
        } as AssociatedCompany;

      case 'deals':
        return {
          ...baseTransform,
          dealname: obj.properties.dealname,
          amount: obj.properties.amount ? parseFloat(obj.properties.amount) : undefined,
          closedate: obj.properties.closedate,
          dealstage: obj.properties.dealstage,
          pipeline: obj.properties.pipeline
        } as AssociatedDeal;

      case 'notes':
        return {
          ...baseTransform,
          body: obj.properties.hs_note_body,
          timestamp: obj.properties.hs_timestamp || obj.createdAt
        } as AssociatedNote;

      case 'emails':
        return {
          ...baseTransform,
          subject: obj.properties.hs_email_subject,
          html: obj.properties.hs_email_html,
          text: obj.properties.hs_email_text,
          timestamp: obj.properties.hs_timestamp || obj.createdAt,
          direction: obj.properties.hs_email_direction as 'INCOMING' | 'OUTGOING' | undefined
        } as AssociatedEmail;

      case 'tasks':
        return {
          ...baseTransform,
          subject: obj.properties.hs_task_subject,
          status: obj.properties.hs_task_status,
          priority: obj.properties.hs_task_priority,
          timestamp: obj.properties.hs_timestamp || obj.createdAt
        } as AssociatedTask;

      case 'meetings':
        return {
          ...baseTransform,
          title: obj.properties.hs_meeting_title,
          startTime: obj.properties.hs_meeting_start_time,
          endTime: obj.properties.hs_meeting_end_time,
          status: obj.properties.hs_meeting_outcome
        } as AssociatedMeeting;

      case 'calls':
        return {
          ...baseTransform,
          title: obj.properties.hs_call_title,
          status: obj.properties.hs_call_status,
          duration: obj.properties.hs_call_duration ? parseInt(obj.properties.hs_call_duration) : undefined,
          timestamp: obj.properties.hs_timestamp || obj.createdAt
        } as AssociatedCall;

      case 'tickets':
        return {
          ...baseTransform,
          subject: obj.properties.subject,
          status: obj.properties.hs_ticket_category,
          priority: obj.properties.hs_ticket_priority,
          timestamp: obj.createdAt
        } as AssociatedTicket;

      case 'quotes':
        return {
          ...baseTransform,
          title: obj.properties.hs_title,
          status: obj.properties.hs_quote_status,
          amount: obj.properties.hs_quote_amount ? parseFloat(obj.properties.hs_quote_amount) : undefined,
          expirationDate: obj.properties.hs_expiration_date
        } as AssociatedQuote;

      default:
        return {
          ...baseTransform,
          ...obj.properties
        };
    }
  }

  /**
   * Get recovery action for different types of errors
   *
   * @param error - Error that occurred
   * @returns Suggested recovery action
   */
  private getRecoveryAction(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('rate limit')) {
      return 'retry_after_60_seconds';
    } else if (message.includes('unauthorized') || message.includes('forbidden')) {
      return 'check_api_permissions';
    } else if (message.includes('not found')) {
      return 'verify_association_exists';
    } else {
      return 'retry_later';
    }
  }
}