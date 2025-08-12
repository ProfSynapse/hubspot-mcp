/**
 * HubSpot API Client
 * 
 * Provides a type-safe interface to the HubSpot API with error handling
 * and response parsing. Organized by domain (Companies, Contacts, BlogPosts)
 * to match the BCP architecture.
 */

import { Client } from '@hubspot/api-client';
import { ApiError, ApiErrorType } from './types.js';

/**
 * HubSpot API client class
 */
export class HubspotApiClient {
  private client: Client;
  private currentOperation: string = '';
  
  /**
   * Create a new HubSpot API client
   * 
   * @param apiKey - HubSpot API key
   */
  constructor(apiKey: string) {
    // For DXT extensions, we allow empty API key during initialization
    // The key will be provided later through the extension settings UI
    this.client = new Client({
      accessToken: apiKey || 'placeholder'
    });
  }

  /**
   * Get the access token from environment variables
   * 
   * @returns Access token
   */
  private getAccessToken(): string {
    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token) {
      throw new Error('Access token not available');
    }
    return token;
  }

  /**
   * Handle API errors consistently
   */
  private handleApiError(error: unknown, operation: string): never {
    this.currentOperation = operation;
    
    // Network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(
        `Network error: ${error.message}`,
        undefined,
        operation,
        'network_error'
      );
    }

    // Re-throw ApiErrors
    if (error instanceof ApiError) {
      throw error;
    }

    // Parse HubSpot error messages
    const message = error instanceof Error ? error.message : String(error);
    let errorType: ApiErrorType = 'unknown';
    let status = 500;
    
    if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('access token')) {
      errorType = 'auth_error';
      status = 401;
    } else if (message.includes('not found')) {
      status = 404;
    } else if (message.includes('rate limit')) {
      errorType = 'rate_limit';
      status = 429;
    } else if (message.includes('validation') || message.includes('invalid')) {
      errorType = 'validation_error';
      status = 400;
    }

    throw new ApiError(
      `HubSpot API error: ${message}`,
      status,
      operation,
      errorType
    );
  }

  /**
   * Format response data consistently
   */
  private formatResponse<T>(data: T): T {
    return data;
  }

  //=============================================================================
  // COMPANIES API METHODS
  //=============================================================================

  /**
   * Create a company
   * 
   * @param properties - Company properties
   * @returns Created company data
   */
  async createCompany(properties: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.companies.basicApi.create({
        properties,
        associations: []
      });
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'createCompany');
    }
  }

  /**
   * Get company by ID
   * 
   * @param id - Company ID
   * @returns Company data
   */
  async getCompany(id: string): Promise<any> {
    try {
      const response = await this.client.crm.companies.basicApi.getById(id);
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'getCompany');
    }
  }

  /**
   * Update company properties
   * 
   * @param id - Company ID
   * @param properties - Properties to update
   * @returns Updated company data
   */
  async updateCompany(id: string, properties: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.companies.basicApi.update(id, {
        properties
      });
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'updateCompany');
    }
  }

  /**
   * Delete/archive a company
   * 
   * @param id - Company ID
   */
  async deleteCompany(id: string): Promise<void> {
    try {
      await this.client.crm.companies.basicApi.archive(id);
    } catch (error) {
      this.handleApiError(error, 'deleteCompany');
    }
  }

  /**
   * Search companies by domain
   * 
   * @param domain - Domain to search for
   * @param limit - Maximum number of results
   * @returns Matching companies
   */
  async searchCompaniesByDomain(domain: string, limit: number = 10): Promise<any[]> {
    try {
      const response = await this.client.crm.companies.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'domain',
            operator: 'EQ',
            value: domain
          }]
        }],
        sorts: [],
        after: 0,
        limit,
        properties: ['name', 'domain', 'website', 'industry', 'description']
      });
      
      return this.formatResponse(response.results.map(company => ({
        id: company.id,
        properties: company.properties,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'searchCompaniesByDomain');
    }
  }

  /**
   * Search companies by name
   * 
   * @param name - Name to search for
   * @param limit - Maximum number of results
   * @returns Matching companies
   */
  async searchCompaniesByName(name: string, limit: number = 10): Promise<any[]> {
    try {
      const response = await this.client.crm.companies.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'name',
            operator: 'CONTAINS_TOKEN',
            value: name
          }]
        }],
        sorts: [],
        after: 0,
        limit,
        properties: ['name', 'domain', 'website', 'industry', 'description']
      });
      
      return this.formatResponse(response.results.map(company => ({
        id: company.id,
        properties: company.properties,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'searchCompaniesByName');
    }
  }

  /**
   * Get recent companies
   * 
   * @param limit - Maximum number of results
   * @returns Recent companies
   */
  async getRecentCompanies(limit: number = 10): Promise<any[]> {
    try {
      const response = await this.client.crm.companies.basicApi.getPage(
        limit,
        undefined,
        undefined,
        undefined,
        ['name', 'domain', 'website', 'industry', 'description'],
        false
      );
      
      return this.formatResponse(response.results.map(company => ({
        id: company.id,
        properties: company.properties,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'getRecentCompanies');
    }
  }

  //=============================================================================
  // CONTACTS API METHODS
  //=============================================================================

  /**
   * Create a contact
   * 
   * @param properties - Contact properties
   * @returns Created contact data
   */
  async createContact(properties: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.contacts.basicApi.create({
        properties,
        associations: []
      });
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'createContact');
    }
  }

  /**
   * Get contact by ID
   * 
   * @param id - Contact ID
   * @returns Contact data
   */
  async getContact(id: string): Promise<any> {
    try {
      const response = await this.client.crm.contacts.basicApi.getById(id);
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'getContact');
    }
  }

  /**
   * Update contact properties
   * 
   * @param id - Contact ID
   * @param properties - Properties to update
   * @returns Updated contact data
   */
  async updateContact(id: string, properties: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.contacts.basicApi.update(id, {
        properties
      });
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'updateContact');
    }
  }

  /**
   * Delete/archive a contact
   * 
   * @param id - Contact ID
   */
  async deleteContact(id: string): Promise<void> {
    try {
      await this.client.crm.contacts.basicApi.archive(id);
    } catch (error) {
      this.handleApiError(error, 'deleteContact');
    }
  }

  /**
   * Search contacts by email
   * 
   * @param email - Email to search for
   * @param limit - Maximum number of results
   * @returns Matching contacts
   */
  async searchContactsByEmail(email: string, limit: number = 10): Promise<any[]> {
    try {
      const response = await this.client.crm.contacts.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: email
          }]
        }],
        sorts: [],
        after: 0,
        limit,
        properties: ['email', 'firstname', 'lastname', 'phone', 'company']
      });
      
      return this.formatResponse(response.results.map(contact => ({
        id: contact.id,
        properties: contact.properties,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'searchContactsByEmail');
    }
  }

  /**
   * Search contacts by name
   * 
   * @param name - Name to search for
   * @param limit - Maximum number of results
   * @returns Matching contacts
   */
  async searchContactsByName(name: string, limit: number = 10): Promise<any[]> {
    try {
      // Split name into first and last name parts
      const nameParts = name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      
      // Build filter groups for first name and last name
      const filterGroups = [];
      
      if (firstName) {
        filterGroups.push({
          filters: [{
            propertyName: 'firstname',
            operator: 'CONTAINS_TOKEN' as any,
            value: firstName
          }]
        });
      }
      
      if (lastName) {
        filterGroups.push({
          filters: [{
            propertyName: 'lastname',
            operator: 'CONTAINS_TOKEN' as any,
            value: lastName
          }]
        });
      }
      
      const response = await this.client.crm.contacts.searchApi.doSearch({
        filterGroups,
        sorts: [],
        after: 0,
        limit,
        properties: ['email', 'firstname', 'lastname', 'phone', 'company']
      });
      
      return this.formatResponse(response.results.map(contact => ({
        id: contact.id,
        properties: contact.properties,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'searchContactsByName');
    }
  }

  /**
   * Get recent contacts
   * 
   * @param limit - Maximum number of results
   * @returns Recent contacts
   */
  async getRecentContacts(limit: number = 10): Promise<any[]> {
    try {
      const response = await this.client.crm.contacts.basicApi.getPage(
        limit,
        undefined,
        undefined,
        undefined,
        ['email', 'firstname', 'lastname', 'phone', 'company'],
        false
      );
      
      return this.formatResponse(response.results.map(contact => ({
        id: contact.id,
        properties: contact.properties,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'getRecentContacts');
    }
  }

  //=============================================================================
  // BLOG POSTS API METHODS
  //=============================================================================

  /**
   * Create a blog post
   * 
   * @param properties - Blog post properties
   * @returns Created blog post data
   */
  async createBlogPost(properties: Record<string, any>): Promise<any> {
    try {
      // Validate required properties
      if (!properties.contentGroupId) {
        throw new Error('Content group ID is required for create operation');
      }
      
      // Use fetch directly to create a blog post
      const accessToken = this.getAccessToken();
      
      const url = 'https://api.hubapi.com/cms/v3/blogs/posts';
      
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(properties)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create blog post: ${errorData.message || response.statusText}`);
      }
      
      const data = await response.json();
      
      // Return the response directly to avoid type issues
      return this.formatResponse(data);
    } catch (error) {
      return this.handleApiError(error, 'createBlogPost');
    }
  }

  /**
   * Get blog post by ID
   * 
   * @param id - Blog post ID
   * @returns Blog post data
   */
  async getBlogPost(id: string): Promise<any> {
    try {
      // Use fetch directly to get a blog post
      const accessToken = this.getAccessToken();
      
      const url = `https://api.hubapi.com/cms/v3/blogs/posts/${id}`;
      
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to get blog post: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Return the response directly to avoid type issues
      return this.formatResponse(data);
    } catch (error) {
      return this.handleApiError(error, 'getBlogPost');
    }
  }

  /**
   * Update blog post properties
   * 
   * @param id - Blog post ID
   * @param properties - Properties to update
   * @returns Updated blog post data
   */
  async updateBlogPost(id: string, properties: Record<string, any>): Promise<any> {
    try {
      // Use fetch directly to update a blog post
      const accessToken = this.getAccessToken();
      
      const url = `https://api.hubapi.com/cms/v3/blogs/posts/${id}`;
      
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(properties)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update blog post: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Return the response directly to avoid type issues
      return this.formatResponse(data);
    } catch (error) {
      return this.handleApiError(error, 'updateBlogPost');
    }
  }

  /**
   * Update blog post draft
   * 
   * @param id - Blog post ID
   * @param properties - Properties to update
   * @returns Updated blog post draft data
   */
  async updateBlogPostDraft(id: string, properties: Record<string, any>): Promise<any> {
    try {
      // Use fetch directly to update a blog post draft
      const accessToken = this.getAccessToken();
      
      const url = `https://api.hubapi.com/cms/v3/blogs/posts/${id}/draft`;
      
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(properties)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update blog post draft: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Return the response directly to avoid type issues
      return this.formatResponse(data);
    } catch (error) {
      return this.handleApiError(error, 'updateBlogPostDraft');
    }
  }

  /**
   * Delete/archive a blog post
   * 
   * @param id - Blog post ID
   */
  async deleteBlogPost(id: string): Promise<void> {
    try {
      // Use fetch directly to delete a blog post
      const accessToken = this.getAccessToken();
      
      const url = `https://api.hubapi.com/cms/v3/blogs/posts/${id}`;
      
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete blog post: ${response.statusText}`);
      }
    } catch (error) {
      this.handleApiError(error, 'deleteBlogPost');
    }
  }


  /**
   * Get recent blog posts
   * 
   * @param limit - Maximum number of results
   * @returns Recent blog posts
   */
  async getRecentBlogPosts(limit: number = 10): Promise<any[]> {
    try {
      // Use fetch directly to get recent blog posts
      const accessToken = this.getAccessToken();
      
      const url = `https://api.hubapi.com/cms/v3/blogs/posts?limit=${limit}&sort=-updatedAt`;
      
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to get recent blog posts: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Return the results directly to avoid type issues
      return this.formatResponse(data.results || []);
    } catch (error) {
      return this.handleApiError(error, 'getRecentBlogPosts');
    }
  }

  /**
   * Get list of blogs
   * 
   * @param limit - Maximum number of results
   * @param offset - Offset for pagination
   * @returns List of blogs
   */
  async getBlogs(limit: number = 20, offset: number = 0): Promise<any[]> {
    try {
      // Get the access token from environment variables
      const accessToken = this.getAccessToken();
      
      // Use the v2 blogs API to get a list of blogs
      const url = `https://api.hubapi.com/content/api/v2/blogs?limit=${limit}&offset=${offset}`;
      
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to get blogs: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Return the blogs array
      return this.formatResponse(data.objects || []);
    } catch (error) {
      return this.handleApiError(error, 'getBlogs');
    }
  }

  //=============================================================================
  // DEALS API METHODS
  //=============================================================================

  /**
   * Create a deal
   * 
   * @param properties - Deal properties
   * @returns Created deal data
   */
  async createDeal(properties: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.deals.basicApi.create({
        properties,
        associations: []
      });
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'createDeal');
    }
  }

  /**
   * Get deal by ID
   * 
   * @param id - Deal ID
   * @returns Deal data
   */
  async getDeal(id: string): Promise<any> {
    try {
      const response = await this.client.crm.deals.basicApi.getById(id);
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'getDeal');
    }
  }

  /**
   * Update deal properties
   * 
   * @param id - Deal ID
   * @param properties - Properties to update
   * @returns Updated deal data
   */
  async updateDeal(id: string, properties: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.deals.basicApi.update(id, {
        properties
      });
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'updateDeal');
    }
  }

  /**
   * Delete/archive a deal
   * 
   * @param id - Deal ID
   */
  async deleteDeal(id: string): Promise<void> {
    try {
      await this.client.crm.deals.basicApi.archive(id);
    } catch (error) {
      this.handleApiError(error, 'deleteDeal');
    }
  }

  /**
   * Search deals
   * 
   * @param searchRequest - Search request
   * @returns Matching deals
   */
  async searchDeals(searchRequest: any): Promise<any[]> {
    try {
      const response = await this.client.crm.deals.searchApi.doSearch(searchRequest);
      
      return this.formatResponse(response.results.map(deal => ({
        id: deal.id,
        properties: deal.properties,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'searchDeals');
    }
  }

  /**
   * Search deals by name
   * 
   * @param name - Name to search for
   * @param limit - Maximum number of results
   * @returns Matching deals
   */
  async searchDealsByName(name: string, limit: number = 10): Promise<any[]> {
    try {
      const searchRequest = {
        filterGroups: [{
          filters: [{
            propertyName: 'dealname',
            operator: 'CONTAINS_TOKEN',
            value: name
          }]
        }],
        sorts: [],
        after: 0,
        limit,
        properties: ['dealname', 'amount', 'closedate', 'dealstage', 'pipeline', 'description']
      };

      return await this.searchDeals(searchRequest);
    } catch (error) {
      return this.handleApiError(error, 'searchDealsByName');
    }
  }

  /**
   * Search deals by modified date
   * 
   * @param date - Modified date
   * @param limit - Maximum number of results
   * @returns Matching deals
   */
  async searchDealsByModifiedDate(date: Date, limit: number = 100): Promise<any[]> {
    try {
      const searchRequest = {
        filterGroups: [{
          filters: [{
            propertyName: 'hs_lastmodifieddate',
            operator: 'GTE',
            value: date.getTime().toString()
          }]
        }],
        sorts: [],
        after: 0,
        limit,
        properties: ['dealname', 'amount', 'closedate', 'dealstage', 'pipeline', 'description']
      };

      return await this.searchDeals(searchRequest);
    } catch (error) {
      return this.handleApiError(error, 'searchDealsByModifiedDate');
    }
  }

  /**
   * Get recent deals
   * 
   * @param limit - Maximum number of results
   * @returns Recent deals
   */
  async getRecentDeals(limit: number = 10): Promise<any[]> {
    try {
      const response = await this.client.crm.deals.basicApi.getPage(
        limit,
        undefined,
        undefined,
        undefined,
        ['dealname', 'amount', 'closedate', 'dealstage', 'pipeline', 'description'],
        false
      );
      
      return this.formatResponse(response.results.map(deal => ({
        id: deal.id,
        properties: deal.properties,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'getRecentDeals');
    }
  }

  /**
   * Batch create deals
   * 
   * @param dealsInput - Array of deal properties
   * @returns Created deals
   */
  async batchCreateDeals(dealsInput: Array<Record<string, any>>): Promise<any[]> {
    try {
      const inputs = dealsInput.map(properties => ({
        properties,
        associations: []
      }));

      const response = await this.client.crm.deals.batchApi.create({ inputs });
      
      return this.formatResponse(response.results.map(deal => ({
        id: deal.id,
        properties: deal.properties,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'batchCreateDeals');
    }
  }

  /**
   * Batch update deals
   * 
   * @param updates - Array of deal updates
   * @returns Updated deals
   */
  async batchUpdateDeals(updates: Array<{ id: string; properties: Record<string, any> }>): Promise<any[]> {
    try {
      const inputs = updates.map(({ id, properties }) => ({
        id,
        properties
      }));

      const response = await this.client.crm.deals.batchApi.update({ inputs });
      
      return this.formatResponse(response.results.map(deal => ({
        id: deal.id,
        properties: deal.properties,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'batchUpdateDeals');
    }
  }
}

/**
 * Create a HubSpot API client instance
 * 
 * @param apiKey - HubSpot API key
 * @returns HubSpot API client instance
 */
export function createHubspotApiClient(apiKey: string): HubspotApiClient {
  return new HubspotApiClient(apiKey);
}
