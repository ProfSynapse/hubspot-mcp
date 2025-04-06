/**
 * Hubspot Service
 * 
 * Service for interacting with the Hubspot API.
 * Provides methods for working with contacts, companies, deals, and engagements.
 */

import { BaseService } from './base-service.js';
import config from '../config.js';
import {
    HubspotContact,
    HubspotCompany,
    HubspotDeal,
    HubspotEngagement,
    CreateContactData,
    CreateCompanyData,
    CreateDealData,
    HubspotSearchRequest,
    HubspotSearchResponse,
    HubspotSearchFilter,
    HubspotSearchFilterGroup
} from '../types/hubspot-types.js';

/**
 * Service for interacting with the Hubspot API
 */
export class HubspotService extends BaseService {
    private static instance: HubspotService;

    /**
     * Private constructor to enforce singleton pattern
     * @param accessToken - Hubspot API access token
     */
    private constructor(accessToken: string) {
        super(
            config.hubspotApiUrl,
            {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        );
    }

    /**
     * Initializes the HubspotService singleton instance
     * @param accessToken - Hubspot API access token
     * @returns The singleton instance of HubspotService
     */
    public static initialize(accessToken: string): HubspotService {
        if (!HubspotService.instance) {
            HubspotService.instance = new HubspotService(accessToken);
        }
        return HubspotService.instance;
    }

    /**
     * Gets the singleton instance of HubspotService
     * @returns The singleton instance of HubspotService
     * @throws Error if service hasn't been initialized
     */
    public static getInstance(): HubspotService {
        if (!HubspotService.instance) {
            throw new Error('HubspotService not initialized. Call initialize() first.');
        }
        return HubspotService.instance;
    }

    /**
     * Helper method to convert datetime fields in objects
     * @param obj - Object to convert
     * @returns Converted object
     */
    private convertDatetimeFields(obj: any): any {
        if (obj === null || obj === undefined) {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.convertDatetimeFields(item));
        }

        if (typeof obj === 'object') {
            const result: any = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    result[key] = this.convertDatetimeFields(obj[key]);
                }
            }
            return result;
        }

        // Convert timestamp strings to ISO format
        if (typeof obj === 'string' && /^\d{13}$/.test(obj)) {
            return new Date(parseInt(obj)).toISOString();
        }

        return obj;
    }

    // ===== CONTACT METHODS =====

    /**
     * Creates a new contact in Hubspot
     * @param data - Contact creation data
     * @returns The created contact
     */
    async createContact(data: CreateContactData): Promise<HubspotContact> {
        return this.makeRequest(async () => {
            const response = await this.client.post('/crm/v3/objects/contacts', data);
            return this.convertDatetimeFields(response.data);
        });
    }

    /**
     * Gets a contact by ID
     * @param contactId - ID of the contact to retrieve
     * @param properties - Optional array of properties to include
     * @returns The contact
     */
    async getContact(contactId: string, properties?: string[]): Promise<HubspotContact> {
        return this.makeRequest(async () => {
            const params: any = {};
            if (properties && properties.length > 0) {
                params.properties = properties.join(',');
            }

            const response = await this.client.get(`/crm/v3/objects/contacts/${contactId}`, { params });
            return this.convertDatetimeFields(response.data);
        });
    }

    /**
     * Searches for contacts based on filter criteria
     * @param request - Search request
     * @returns Search response with contacts
     */
    async searchContacts(request: HubspotSearchRequest): Promise<HubspotSearchResponse<HubspotContact>> {
        return this.makeRequest(async () => {
            const response = await this.client.post('/crm/v3/objects/contacts/search', request);
            return this.convertDatetimeFields(response.data);
        });
    }

    /**
     * Finds a contact by email
     * @param email - Email to search for
     * @returns The contact or null if not found
     */
    async findContactByEmail(email: string): Promise<HubspotContact | null> {
        const filter: HubspotSearchFilter = {
            propertyName: 'email',
            operator: 'EQ',
            value: email
        };

        const filterGroup: HubspotSearchFilterGroup = {
            filters: [filter]
        };

        const request: HubspotSearchRequest = {
            filterGroups: [filterGroup],
            limit: 1
        };

        const response = await this.searchContacts(request);
        return response.results.length > 0 ? response.results[0] : null;
    }

    /**
     * Finds a contact by name and company
     * @param firstName - First name
     * @param lastName - Last name
     * @param company - Optional company name
     * @returns The contact or null if not found
     */
    async findContactByName(firstName: string, lastName: string, company?: string): Promise<HubspotContact | null> {
        const filters: HubspotSearchFilter[] = [
            {
                propertyName: 'firstname',
                operator: 'EQ',
                value: firstName
            },
            {
                propertyName: 'lastname',
                operator: 'EQ',
                value: lastName
            }
        ];

        if (company) {
            filters.push({
                propertyName: 'company',
                operator: 'EQ',
                value: company
            });
        }

        const filterGroup: HubspotSearchFilterGroup = {
            filters: filters
        };

        const request: HubspotSearchRequest = {
            filterGroups: [filterGroup],
            limit: 1
        };

        const response = await this.searchContacts(request);
        return response.results.length > 0 ? response.results[0] : null;
    }

    // ===== COMPANY METHODS =====

    /**
     * Creates a new company in Hubspot
     * @param data - Company creation data
     * @returns The created company
     */
    async createCompany(data: CreateCompanyData): Promise<HubspotCompany> {
        return this.makeRequest(async () => {
            const response = await this.client.post('/crm/v3/objects/companies', data);
            return this.convertDatetimeFields(response.data);
        });
    }

    /**
     * Gets a company by ID
     * @param companyId - ID of the company to retrieve
     * @param properties - Optional array of properties to include
     * @returns The company
     */
    async getCompany(companyId: string, properties?: string[]): Promise<HubspotCompany> {
        return this.makeRequest(async () => {
            const params: any = {};
            if (properties && properties.length > 0) {
                params.properties = properties.join(',');
            }

            const response = await this.client.get(`/crm/v3/objects/companies/${companyId}`, { params });
            return this.convertDatetimeFields(response.data);
        });
    }

    /**
     * Searches for companies based on filter criteria
     * @param request - Search request
     * @returns Search response with companies
     */
    async searchCompanies(request: HubspotSearchRequest): Promise<HubspotSearchResponse<HubspotCompany>> {
        return this.makeRequest(async () => {
            const response = await this.client.post('/crm/v3/objects/companies/search', request);
            return this.convertDatetimeFields(response.data);
        });
    }

    /**
     * Finds a company by name
     * @param name - Company name to search for
     * @returns The company or null if not found
     */
    async findCompanyByName(name: string): Promise<HubspotCompany | null> {
        const filter: HubspotSearchFilter = {
            propertyName: 'name',
            operator: 'EQ',
            value: name
        };

        const filterGroup: HubspotSearchFilterGroup = {
            filters: [filter]
        };

        const request: HubspotSearchRequest = {
            filterGroups: [filterGroup],
            limit: 1
        };

        const response = await this.searchCompanies(request);
        return response.results.length > 0 ? response.results[0] : null;
    }

    /**
     * Finds a company by domain
     * @param domain - Domain to search for
     * @returns The company or null if not found
     */
    async findCompanyByDomain(domain: string): Promise<HubspotCompany | null> {
        const filter: HubspotSearchFilter = {
            propertyName: 'domain',
            operator: 'EQ',
            value: domain
        };

        const filterGroup: HubspotSearchFilterGroup = {
            filters: [filter]
        };

        const request: HubspotSearchRequest = {
            filterGroups: [filterGroup],
            limit: 1
        };

        const response = await this.searchCompanies(request);
        return response.results.length > 0 ? response.results[0] : null;
    }

    /**
     * Gets the most recently active companies
     * @param limit - Maximum number of companies to return
     * @returns Array of companies
     */
    async getRecentCompanies(limit: number = 10): Promise<HubspotCompany[]> {
        return this.makeRequest(async () => {
            const request: HubspotSearchRequest = {
                filterGroups: [],
                sorts: [
                    {
                        propertyName: 'hs_lastmodifieddate',
                        direction: 'DESCENDING'
                    }
                ],
                limit: limit,
                properties: ['name', 'domain', 'website', 'phone', 'industry', 'hs_lastmodifieddate']
            };

            const response = await this.searchCompanies(request);
            return response.results;
        });
    }

    // ===== ENGAGEMENT METHODS =====

    /**
     * Gets recent engagements across all contacts/companies
     * @param days - Number of days to look back
     * @param limit - Maximum number of engagements to return
     * @returns Array of engagements
     */
    async getRecentEngagements(days: number = 7, limit: number = 50): Promise<HubspotEngagement[]> {
        return this.makeRequest(async () => {
            // Calculate the date range (past N days)
            const endTime = new Date();
            const startTime = new Date();
            startTime.setDate(startTime.getDate() - days);

            // Format timestamps for API call
            const startTimestamp = startTime.getTime();
            const endTimestamp = endTime.getTime();

            // Get all recent engagements
            const response = await this.client.get('/engagements/v1/engagements/recent/modified', {
                params: {
                    count: limit,
                    since: startTimestamp,
                    offset: 0
                }
            });

            // Format the engagements
            const engagements: HubspotEngagement[] = response.data.results.map((engagement: any) => {
                const engagementData = engagement.engagement || {};
                const metadata = engagement.metadata || {};

                const formattedEngagement: HubspotEngagement = {
                    id: engagementData.id,
                    type: engagementData.type,
                    timestamp: engagementData.timestamp,
                    createdAt: engagementData.createdAt,
                    lastUpdated: engagementData.lastUpdated,
                    createdBy: engagementData.createdBy,
                    modifiedBy: engagementData.modifiedBy,
                    content: this.formatEngagementContent(engagementData.type, metadata),
                    associations: this.formatEngagementAssociations(engagement.associations || {})
                };

                return formattedEngagement;
            });

            return this.convertDatetimeFields(engagements);
        });
    }

    /**
     * Gets activity history for a specific company
     * @param companyId - Hubspot company ID
     * @returns Array of engagements
     */
    async getCompanyActivity(companyId: string): Promise<HubspotEngagement[]> {
        return this.makeRequest(async () => {
            // Step 1: Get all engagement IDs associated with the company
            const associationsResponse = await this.client.get(`/crm/v3/objects/companies/${companyId}/associations/engagements`);

            // Extract engagement IDs from the associations response
            const engagementIds = associationsResponse.data.results.map((result: any) => result.id);

            // Step 2: Get detailed information for each engagement
            const engagements: HubspotEngagement[] = [];

            for (const engagementId of engagementIds) {
                const engagementResponse = await this.client.get(`/engagements/v1/engagements/${engagementId}`);
                const engagementData = engagementResponse.data.engagement || {};
                const metadata = engagementResponse.data.metadata || {};

                const formattedEngagement: HubspotEngagement = {
                    id: engagementData.id,
                    type: engagementData.type,
                    timestamp: engagementData.timestamp,
                    createdAt: engagementData.createdAt,
                    lastUpdated: engagementData.lastUpdated,
                    createdBy: engagementData.createdBy,
                    modifiedBy: engagementData.modifiedBy,
                    content: this.formatEngagementContent(engagementData.type, metadata),
                    associations: this.formatEngagementAssociations(engagementResponse.data.associations || {})
                };

                engagements.push(formattedEngagement);
            }

            return this.convertDatetimeFields(engagements);
        });
    }

    /**
     * Formats engagement content based on type
     * @param type - Engagement type
     * @param metadata - Engagement metadata
     * @returns Formatted content
     */
    private formatEngagementContent(type: string, metadata: any): any {
        switch (type) {
            case 'NOTE':
                return metadata.body || '';
            case 'EMAIL':
                return {
                    subject: metadata.subject || '',
                    from: metadata.from || {},
                    to: metadata.to || [],
                    cc: metadata.cc || [],
                    bcc: metadata.bcc || [],
                    sender: metadata.sender || {},
                    body: metadata.text || metadata.html || ''
                };
            case 'TASK':
                return {
                    subject: metadata.subject || '',
                    body: metadata.body || '',
                    status: metadata.status || '',
                    forObjectType: metadata.forObjectType || ''
                };
            case 'MEETING':
                return {
                    title: metadata.title || '',
                    body: metadata.body || '',
                    startTime: metadata.startTime,
                    endTime: metadata.endTime,
                    internalNotes: metadata.internalMeetingNotes || ''
                };
            case 'CALL':
                return {
                    body: metadata.body || '',
                    fromNumber: metadata.fromNumber || '',
                    toNumber: metadata.toNumber || '',
                    durationMilliseconds: metadata.durationMilliseconds,
                    status: metadata.status || '',
                    disposition: metadata.disposition || ''
                };
            default:
                return metadata;
        }
    }

    /**
     * Formats engagement associations
     * @param associations - Raw associations object
     * @returns Formatted associations
     */
    private formatEngagementAssociations(associations: any): HubspotEngagement['associations'] {
        return {
            contactIds: associations.contactIds || [],
            companyIds: associations.companyIds || [],
            dealIds: associations.dealIds || [],
            ownerIds: associations.ownerIds || [],
            ticketIds: associations.ticketIds || []
        };
    }

    // ===== DEAL METHODS =====

    /**
     * Creates a new deal in Hubspot
     * @param data - Deal creation data
     * @returns The created deal
     */
    async createDeal(data: CreateDealData): Promise<HubspotDeal> {
        return this.makeRequest(async () => {
            const response = await this.client.post('/crm/v3/objects/deals', data);
            return this.convertDatetimeFields(response.data);
        });
    }

    /**
     * Gets a deal by ID
     * @param dealId - ID of the deal to retrieve
     * @param properties - Optional array of properties to include
     * @returns The deal
     */
    async getDeal(dealId: string, properties?: string[]): Promise<HubspotDeal> {
        return this.makeRequest(async () => {
            const params: any = {};
            if (properties && properties.length > 0) {
                params.properties = properties.join(',');
            }

            const response = await this.client.get(`/crm/v3/objects/deals/${dealId}`, { params });
            return this.convertDatetimeFields(response.data);
        });
    }

    /**
     * Searches for deals based on filter criteria
     * @param request - Search request
     * @returns Search response with deals
     */
    async searchDeals(request: HubspotSearchRequest): Promise<HubspotSearchResponse<HubspotDeal>> {
        return this.makeRequest(async () => {
            const response = await this.client.post('/crm/v3/objects/deals/search', request);
            return this.convertDatetimeFields(response.data);
        });
    }

    /**
     * Gets the most recently active deals
     * @param limit - Maximum number of deals to return
     * @returns Array of deals
     */
    async getRecentDeals(limit: number = 10): Promise<HubspotDeal[]> {
        return this.makeRequest(async () => {
            const request: HubspotSearchRequest = {
                filterGroups: [],
                sorts: [
                    {
                        propertyName: 'hs_lastmodifieddate',
                        direction: 'DESCENDING'
                    }
                ],
                limit: limit,
                properties: ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 'hs_lastmodifieddate']
            };

            const response = await this.searchDeals(request);
            return response.results;
        });
    }
}
