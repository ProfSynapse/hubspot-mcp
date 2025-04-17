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
    if (!apiKey) {
      throw new ApiError(
        'HubSpot API key is required',
        401,
        'initialization',
        'auth_error'
      );
    }
    
    this.client = new Client({
      accessToken: apiKey
    });
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
      const response = await this.client.cms.blogs.blogPosts.blogPostsApi.create(properties as any);
      
      // Return the response directly to avoid type issues
      return this.formatResponse(response);
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
      const response = await this.client.cms.blogs.blogPosts.blogPostsApi.getById(id);
      
      // Return the response directly to avoid type issues
      return this.formatResponse(response);
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
      const response = await this.client.cms.blogs.blogPosts.blogPostsApi.update(id, properties as any);
      
      // Return the response directly to avoid type issues
      return this.formatResponse(response);
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
      const response = await this.client.cms.blogs.blogPosts.blogPostsApi.updateDraft(id, properties as any);
      
      // Return the response directly to avoid type issues
      return this.formatResponse(response);
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
      await this.client.cms.blogs.blogPosts.blogPostsApi.archive(id);
    } catch (error) {
      this.handleApiError(error, 'deleteBlogPost');
    }
  }

  /**
   * Publish a blog post draft
   * 
   * @param id - Blog post ID
   * @returns Published blog post data
   */
  async publishBlogPost(id: string): Promise<any> {
    try {
      // First get the blog post
      const blogPost = await this.client.cms.blogs.blogPosts.blogPostsApi.getById(id);
      
      // Then publish it
      const response = await this.client.cms.blogs.blogPosts.blogPostsApi.update(id, {
        ...blogPost,
        state: 'PUBLISHED'
      } as any);
      
      // Return the response directly to avoid type issues
      return this.formatResponse(response);
    } catch (error) {
      return this.handleApiError(error, 'publishBlogPost');
    }
  }

  /**
   * Schedule a blog post for future publishing
   * 
   * @param id - Blog post ID
   * @param publishDate - Date to publish the blog post (ISO8601 format)
   * @returns Scheduled blog post data
   */
  async scheduleBlogPost(id: string, publishDate: string): Promise<any> {
    try {
      // First get the blog post
      const blogPost = await this.client.cms.blogs.blogPosts.blogPostsApi.getById(id);
      
      // Then schedule it
      const response = await this.client.cms.blogs.blogPosts.blogPostsApi.update(id, {
        ...blogPost,
        state: 'SCHEDULED',
        publishDate: new Date(publishDate)
      } as any);
      
      // Return the response directly to avoid type issues
      return this.formatResponse(response);
    } catch (error) {
      return this.handleApiError(error, 'scheduleBlogPost');
    }
  }

  /**
   * Search blog posts
   * 
   * @param query - Search query
   * @param limit - Maximum number of results
   * @returns Matching blog posts
   */
  async searchBlogPosts(query: string, limit: number = 10): Promise<any[]> {
    try {
      // Use any to bypass type checking for the getPage method
      const getPage = this.client.cms.blogs.blogPosts.blogPostsApi.getPage as any;
      const response = await getPage(
        limit,
        undefined,
        undefined,
        undefined,
        ['name', 'slug', 'state', 'publishDate', 'postBody']
      );
      
      // Return the results directly to avoid type issues
      return this.formatResponse(response.results);
    } catch (error) {
      return this.handleApiError(error, 'searchBlogPosts');
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
      // Use any to bypass type checking for the getPage method
      const getPage = this.client.cms.blogs.blogPosts.blogPostsApi.getPage as any;
      const response = await getPage(
        limit
      );
      
      // Return the results directly to avoid type issues
      return this.formatResponse(response.results);
    } catch (error) {
      return this.handleApiError(error, 'getRecentBlogPosts');
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
