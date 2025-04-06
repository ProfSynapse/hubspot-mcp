/**
 * Hubspot Types
 * 
 * Type definitions for Hubspot API objects and operations.
 * These types represent the data structures used by the Hubspot API.
 */

/**
 * Common properties for all Hubspot objects
 */
export interface HubspotObject {
    id: string;
    createdAt: string;
    updatedAt: string;
    archived: boolean;
}

/**
 * Hubspot Contact object
 */
export interface HubspotContact extends HubspotObject {
    properties: {
        firstname?: string;
        lastname?: string;
        email?: string;
        phone?: string;
        company?: string;
        website?: string;
        address?: string;
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
        jobtitle?: string;
        [key: string]: string | undefined;
    };
}

/**
 * Hubspot Company object
 */
export interface HubspotCompany extends HubspotObject {
    properties: {
        name?: string;
        domain?: string;
        website?: string;
        phone?: string;
        industry?: string;
        description?: string;
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
        [key: string]: string | undefined;
    };
}

/**
 * Hubspot Deal object
 */
export interface HubspotDeal extends HubspotObject {
    properties: {
        dealname?: string;
        amount?: string;
        dealstage?: string;
        pipeline?: string;
        closedate?: string;
        dealtype?: string;
        description?: string;
        [key: string]: string | undefined;
    };
}

/**
 * Hubspot Engagement object
 */
export interface HubspotEngagement {
    id: string;
    type: 'NOTE' | 'EMAIL' | 'TASK' | 'MEETING' | 'CALL';
    timestamp: number;
    createdAt: number;
    lastUpdated: number;
    createdBy: string;
    modifiedBy: string;
    content: any;
    associations?: {
        contactIds?: string[];
        companyIds?: string[];
        dealIds?: string[];
        ownerIds?: string[];
        ticketIds?: string[];
    };
}

/**
 * Data for creating a contact
 */
export interface CreateContactData {
    properties: {
        firstname?: string;
        lastname?: string;
        email?: string;
        phone?: string;
        company?: string;
        [key: string]: string | undefined;
    };
}

/**
 * Data for creating a company
 */
export interface CreateCompanyData {
    properties: {
        name: string;
        domain?: string;
        website?: string;
        industry?: string;
        [key: string]: string | undefined;
    };
}

/**
 * Data for creating a deal
 */
export interface CreateDealData {
    properties: {
        dealname: string;
        amount?: string;
        dealstage?: string;
        pipeline?: string;
        closedate?: string;
        [key: string]: string | undefined;
    };
    associations?: {
        contactIds?: string[];
        companyIds?: string[];
    };
}

/**
 * Search filter for Hubspot objects
 */
export interface HubspotSearchFilter {
    propertyName: string;
    operator: 'EQ' | 'NEQ' | 'LT' | 'GT' | 'LTE' | 'GTE' | 'BETWEEN' | 'IN' | 'NOT_IN' | 'HAS_PROPERTY' | 'NOT_HAS_PROPERTY' | 'CONTAINS_TOKEN' | 'NOT_CONTAINS_TOKEN';
    value: string | string[] | number | number[] | boolean;
}

/**
 * Search filter group for Hubspot objects
 */
export interface HubspotSearchFilterGroup {
    filters: HubspotSearchFilter[];
}

/**
 * Search request for Hubspot objects
 */
export interface HubspotSearchRequest {
    filterGroups: HubspotSearchFilterGroup[];
    sorts?: {
        propertyName: string;
        direction: 'ASCENDING' | 'DESCENDING';
    }[];
    limit?: number;
    after?: string;
    properties?: string[];
}

/**
 * Search response for Hubspot objects
 */
export interface HubspotSearchResponse<T> {
    total: number;
    results: T[];
    paging?: {
        next?: {
            after: string;
            link: string;
        };
    };
}
