/**
 * Tool Handlers
 * 
 * Implements the handlers for all Hubspot tools.
 * Each handler processes the tool arguments and calls the appropriate service methods.
 */

import { HubspotService } from '../services/hubspot-service.js';
import {
    CreateContactData,
    CreateCompanyData,
    CreateDealData,
    HubspotSearchRequest
} from '../types/hubspot-types.js';

/**
 * Handler function type for tool execution
 */
export type ToolHandler = (args: any) => Promise<any>;

/**
 * Maps tool names to their handler functions
 */
export interface ToolHandlers {
    [toolName: string]: ToolHandler;
}

/**
 * Creates and returns the handlers for all Hubspot tools
 * @param hubspotService - The initialized HubspotService instance
 * @returns Object mapping tool names to their handler functions
 */
export function createToolHandlers(hubspotService: HubspotService): ToolHandlers {
    return {
        // ===== CONTACT HANDLERS =====

        /**
         * Handler for the hubspot_create_contact tool
         */
        hubspot_create_contact: async (args: any) => {
            try {
                const { firstname, lastname, email, properties = {} } = args;

                // Check for required fields
                if (!firstname || !lastname) {
                    throw new Error('First name and last name are required');
                }

                // Check if contact already exists
                let existingContact = null;

                if (email) {
                    existingContact = await hubspotService.findContactByEmail(email);
                }

                if (!existingContact) {
                    existingContact = await hubspotService.findContactByName(
                        firstname,
                        lastname,
                        properties.company
                    );
                }

                if (existingContact) {
                    return {
                        message: 'Contact already exists',
                        contact: existingContact
                    };
                }

                // Create contact data
                const contactData: CreateContactData = {
                    properties: {
                        firstname,
                        lastname,
                        ...properties
                    }
                };

                // Add email if provided
                if (email) {
                    contactData.properties.email = email;
                }

                // Create the contact
                const contact = await hubspotService.createContact(contactData);

                return {
                    message: 'Contact created successfully',
                    contact
                };
            } catch (error) {
                console.error('Error in hubspot_create_contact:', error);
                throw new Error(`Failed to create contact: ${error instanceof Error ? error.message : String(error)}`);
            }
        },

        /**
         * Handler for the hubspot_get_contact tool
         */
        hubspot_get_contact: async (args: any) => {
            try {
                const { contact_id, properties } = args;

                if (!contact_id) {
                    throw new Error('Contact ID is required');
                }

                const contact = await hubspotService.getContact(contact_id, properties);
                return contact;
            } catch (error) {
                console.error(`Error in hubspot_get_contact for ID ${args.contact_id}:`, error);
                throw new Error(`Failed to get contact: ${error instanceof Error ? error.message : String(error)}`);
            }
        },

        /**
         * Handler for the hubspot_find_contact_by_email tool
         */
        hubspot_find_contact_by_email: async (args: any) => {
            try {
                const { email } = args;

                if (!email) {
                    throw new Error('Email is required');
                }

                const contact = await hubspotService.findContactByEmail(email);

                if (!contact) {
                    return {
                        message: 'No contact found with this email',
                        contact: null
                    };
                }

                return {
                    message: 'Contact found',
                    contact
                };
            } catch (error) {
                console.error(`Error in hubspot_find_contact_by_email for email ${args.email}:`, error);
                throw new Error(`Failed to find contact: ${error instanceof Error ? error.message : String(error)}`);
            }
        },

        /**
         * Handler for the hubspot_find_contact_by_name tool
         */
        hubspot_find_contact_by_name: async (args: any) => {
            try {
                const { firstname, lastname, company } = args;

                if (!firstname || !lastname) {
                    throw new Error('First name and last name are required');
                }

                const contact = await hubspotService.findContactByName(firstname, lastname, company);

                if (!contact) {
                    return {
                        message: 'No contact found with this name',
                        contact: null
                    };
                }

                return {
                    message: 'Contact found',
                    contact
                };
            } catch (error) {
                console.error(`Error in hubspot_find_contact_by_name for name ${args.firstname} ${args.lastname}:`, error);
                throw new Error(`Failed to find contact: ${error instanceof Error ? error.message : String(error)}`);
            }
        },

        /**
         * Handler for the hubspot_get_recent_contacts tool
         */
        hubspot_get_recent_contacts: async (args: any) => {
            try {
                const limit = args?.limit || 10;

                const request: HubspotSearchRequest = {
                    filterGroups: [],
                    sorts: [
                        {
                            propertyName: 'lastmodifieddate',
                            direction: 'DESCENDING' as 'DESCENDING'
                        }
                    ],
                    limit,
                    properties: ['firstname', 'lastname', 'email', 'phone', 'company', 'lastmodifieddate']
                };

                const response = await hubspotService.searchContacts(request);

                return {
                    contacts: response.results,
                    total: response.total
                };
            } catch (error) {
                console.error('Error in hubspot_get_recent_contacts:', error);
                throw new Error(`Failed to get recent contacts: ${error instanceof Error ? error.message : String(error)}`);
            }
        },

        // ===== COMPANY HANDLERS =====

        /**
         * Handler for the hubspot_create_company tool
         */
        hubspot_create_company: async (args: any) => {
            try {
                const { name, properties = {} } = args;

                if (!name) {
                    throw new Error('Company name is required');
                }

                // Check if company already exists
                const existingCompany = await hubspotService.findCompanyByName(name);

                if (existingCompany) {
                    return {
                        message: 'Company already exists',
                        company: existingCompany
                    };
                }

                // Create company data
                const companyData: CreateCompanyData = {
                    properties: {
                        name,
                        ...properties
                    }
                };

                // Create the company
                const company = await hubspotService.createCompany(companyData);

                return {
                    message: 'Company created successfully',
                    company
                };
            } catch (error) {
                console.error('Error in hubspot_create_company:', error);
                throw new Error(`Failed to create company: ${error instanceof Error ? error.message : String(error)}`);
            }
        },

        /**
         * Handler for the hubspot_get_company tool
         */
        hubspot_get_company: async (args: any) => {
            try {
                const { company_id, properties } = args;

                if (!company_id) {
                    throw new Error('Company ID is required');
                }

                const company = await hubspotService.getCompany(company_id, properties);
                return company;
            } catch (error) {
                console.error(`Error in hubspot_get_company for ID ${args.company_id}:`, error);
                throw new Error(`Failed to get company: ${error instanceof Error ? error.message : String(error)}`);
            }
        },

        /**
         * Handler for the hubspot_find_company_by_name tool
         */
        hubspot_find_company_by_name: async (args: any) => {
            try {
                const { name } = args;

                if (!name) {
                    throw new Error('Company name is required');
                }

                const company = await hubspotService.findCompanyByName(name);

                if (!company) {
                    return {
                        message: 'No company found with this name',
                        company: null
                    };
                }

                return {
                    message: 'Company found',
                    company
                };
            } catch (error) {
                console.error(`Error in hubspot_find_company_by_name for name ${args.name}:`, error);
                throw new Error(`Failed to find company: ${error instanceof Error ? error.message : String(error)}`);
            }
        },

        /**
         * Handler for the hubspot_find_company_by_domain tool
         */
        hubspot_find_company_by_domain: async (args: any) => {
            try {
                const { domain } = args;

                if (!domain) {
                    throw new Error('Domain is required');
                }

                const company = await hubspotService.findCompanyByDomain(domain);

                if (!company) {
                    return {
                        message: 'No company found with this domain',
                        company: null
                    };
                }

                return {
                    message: 'Company found',
                    company
                };
            } catch (error) {
                console.error(`Error in hubspot_find_company_by_domain for domain ${args.domain}:`, error);
                throw new Error(`Failed to find company: ${error instanceof Error ? error.message : String(error)}`);
            }
        },

        /**
         * Handler for the hubspot_get_company_activity tool
         */
        hubspot_get_company_activity: async (args: any) => {
            try {
                const { company_id } = args;

                if (!company_id) {
                    throw new Error('Company ID is required');
                }

                const activities = await hubspotService.getCompanyActivity(company_id);

                return {
                    activities,
                    count: activities.length
                };
            } catch (error) {
                console.error(`Error in hubspot_get_company_activity for ID ${args.company_id}:`, error);
                throw new Error(`Failed to get company activity: ${error instanceof Error ? error.message : String(error)}`);
            }
        },

        /**
         * Handler for the hubspot_get_recent_companies tool
         */
        hubspot_get_recent_companies: async (args: any) => {
            try {
                const limit = args?.limit || 10;

                const companies = await hubspotService.getRecentCompanies(limit);

                return {
                    companies,
                    count: companies.length
                };
            } catch (error) {
                console.error('Error in hubspot_get_recent_companies:', error);
                throw new Error(`Failed to get recent companies: ${error instanceof Error ? error.message : String(error)}`);
            }
        },

        // ===== ENGAGEMENT HANDLERS =====

        /**
         * Handler for the hubspot_get_recent_engagements tool
         */
        hubspot_get_recent_engagements: async (args: any) => {
            try {
                const days = args?.days || 7;
                const limit = args?.limit || 50;

                const engagements = await hubspotService.getRecentEngagements(days, limit);

                return {
                    engagements,
                    count: engagements.length,
                    period: `Last ${days} days`
                };
            } catch (error) {
                console.error('Error in hubspot_get_recent_engagements:', error);
                throw new Error(`Failed to get recent engagements: ${error instanceof Error ? error.message : String(error)}`);
            }
        },

        // ===== DEAL HANDLERS =====

        /**
         * Handler for the hubspot_create_deal tool
         */
        hubspot_create_deal: async (args: any) => {
            try {
                const { dealname, amount, dealstage, pipeline, closedate, properties = {}, associations = {} } = args;

                if (!dealname) {
                    throw new Error('Deal name is required');
                }

                // Create deal data
                const dealData: CreateDealData = {
                    properties: {
                        dealname,
                        ...properties
                    }
                };

                // Add optional properties if provided
                if (amount) dealData.properties.amount = amount;
                if (dealstage) dealData.properties.dealstage = dealstage;
                if (pipeline) dealData.properties.pipeline = pipeline;
                if (closedate) dealData.properties.closedate = closedate;

                // Add associations if provided
                if (associations.contactIds || associations.companyIds) {
                    dealData.associations = {};

                    if (associations.contactIds) {
                        dealData.associations.contactIds = associations.contactIds;
                    }

                    if (associations.companyIds) {
                        dealData.associations.companyIds = associations.companyIds;
                    }
                }

                // Create the deal
                const deal = await hubspotService.createDeal(dealData);

                return {
                    message: 'Deal created successfully',
                    deal
                };
            } catch (error) {
                console.error('Error in hubspot_create_deal:', error);
                throw new Error(`Failed to create deal: ${error instanceof Error ? error.message : String(error)}`);
            }
        },

        /**
         * Handler for the hubspot_get_deal tool
         */
        hubspot_get_deal: async (args: any) => {
            try {
                const { deal_id, properties } = args;

                if (!deal_id) {
                    throw new Error('Deal ID is required');
                }

                const deal = await hubspotService.getDeal(deal_id, properties);
                return deal;
            } catch (error) {
                console.error(`Error in hubspot_get_deal for ID ${args.deal_id}:`, error);
                throw new Error(`Failed to get deal: ${error instanceof Error ? error.message : String(error)}`);
            }
        },

        /**
         * Handler for the hubspot_get_recent_deals tool
         */
        hubspot_get_recent_deals: async (args: any) => {
            try {
                const limit = args?.limit || 10;

                const deals = await hubspotService.getRecentDeals(limit);

                return {
                    deals,
                    count: deals.length
                };
            } catch (error) {
                console.error('Error in hubspot_get_recent_deals:', error);
                throw new Error(`Failed to get recent deals: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    };
}
