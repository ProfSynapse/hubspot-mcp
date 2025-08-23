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
   * Test connection to HubSpot API
   * 
   * @returns Promise that resolves if connection is successful
   */
  async testConnection(): Promise<void> {
    try {
      // Use a lightweight API call to test connectivity
      await this.client.crm.companies.basicApi.getPage(1, undefined, undefined, undefined, undefined, false);
    } catch (error) {
      this.handleApiError(error, 'testConnection');
    }
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
      // Use search API instead of getPage to get better control over properties
      const response = await this.client.crm.companies.searchApi.doSearch({
        filterGroups: [],
        sorts: [
          {
            propertyName: 'createdate',
            direction: 'DESCENDING'
          } as any
        ],
        after: 0,
        limit,
        properties: ['name', 'domain', 'website']
      });
      
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
        properties: ['email', 'firstname', 'lastname']
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
        properties: ['email', 'firstname', 'lastname']
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
      // Use search API instead of getPage to get better control over properties
      const response = await this.client.crm.contacts.searchApi.doSearch({
        filterGroups: [],
        sorts: [
          {
            propertyName: 'createdate',
            direction: 'DESCENDING'
          } as any
        ],
        after: 0,
        limit,
        properties: ['email', 'firstname', 'lastname']
      });
      
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
  // NOTES API METHODS
  //=============================================================================

  /**
   * Create a note
   * 
   * @param properties - Note properties
   * @returns Created note data
   */
  async createNote(properties: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.objects.basicApi.create('notes', {
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
      return this.handleApiError(error, 'createNote');
    }
  }

  /**
   * Get note by ID
   * 
   * @param id - Note ID
   * @returns Note data
   */
  async getNote(id: string): Promise<any> {
    try {
      const response = await this.client.crm.objects.basicApi.getById('notes', id);
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'getNote');
    }
  }

  /**
   * Update note properties
   * 
   * @param id - Note ID
   * @param properties - Properties to update
   * @returns Updated note data
   */
  async updateNote(id: string, properties: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.objects.basicApi.update('notes', id, {
        properties
      });
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'updateNote');
    }
  }


  /**
   * Search notes
   * 
   * @param searchRequest - Search request
   * @returns Matching notes
   */
  async searchNotes(searchRequest: any): Promise<any[]> {
    try {
      const response = await this.client.crm.objects.searchApi.doSearch('notes', searchRequest);
      
      return this.formatResponse(response.results.map(note => ({
        id: note.id,
        properties: note.properties,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'searchNotes');
    }
  }

  //=============================================================================
  // PRODUCTS API METHODS
  //=============================================================================

  /**
   * Create a product
   * 
   * @param properties - Product properties
   * @returns Created product data
   */
  async createProduct(properties: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.products.basicApi.create({
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
      return this.handleApiError(error, 'createProduct');
    }
  }

  /**
   * Get product by ID
   * 
   * @param id - Product ID
   * @returns Product data
   */
  async getProduct(id: string): Promise<any> {
    try {
      const response = await this.client.crm.products.basicApi.getById(id);
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'getProduct');
    }
  }

  /**
   * Update product properties
   * 
   * @param id - Product ID
   * @param properties - Properties to update
   * @returns Updated product data
   */
  async updateProduct(id: string, properties: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.products.basicApi.update(id, {
        properties
      });
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'updateProduct');
    }
  }


  /**
   * Search products
   * 
   * @param searchQuery - Search query
   * @param limit - Maximum number of results
   * @returns Matching products
   */
  async searchProducts(searchQuery: string, limit: number = 10): Promise<any[]> {
    try {
      const response = await this.client.crm.products.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'name',
            operator: 'CONTAINS_TOKEN',
            value: searchQuery
          }]
        }],
        sorts: [],
        after: 0,
        limit,
        properties: ['name', 'price', 'description']
      });
      
      return this.formatResponse(response.results.map(product => ({
        id: product.id,
        properties: product.properties,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'searchProducts');
    }
  }

  /**
   * Get recent products
   * 
   * @param limit - Maximum number of results
   * @returns Recent products
   */
  async getRecentProducts(limit: number = 10): Promise<any[]> {
    try {
      // Use search API instead of getPage to get better control over properties
      const response = await this.client.crm.products.searchApi.doSearch({
        filterGroups: [],
        sorts: [
          {
            propertyName: 'createdate',
            direction: 'DESCENDING'
          } as any
        ],
        after: 0,
        limit,
        properties: ['name', 'price', 'description']
      });
      
      return this.formatResponse(response.results.map(product => ({
        id: product.id,
        properties: product.properties,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'getRecentProducts');
    }
  }

  //=============================================================================
  // EMAIL ACTIVITIES API METHODS
  //=============================================================================

  /**
   * Create an email activity/engagement
   * 
   * @param properties - Email properties
   * @returns Created email data
   */
  async createEmail(properties: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.objects.basicApi.create('emails', {
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
      return this.handleApiError(error, 'createEmail');
    }
  }

  /**
   * Get email by ID
   * 
   * @param id - Email ID
   * @returns Email data
   */
  async getEmail(id: string): Promise<any> {
    try {
      const response = await this.client.crm.objects.basicApi.getById('emails', id);
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'getEmail');
    }
  }

  /**
   * Search emails
   * 
   * @param searchQuery - Search query
   * @param limit - Maximum number of results
   * @returns Matching emails
   */
  async searchEmails(searchQuery: string, limit: number = 10): Promise<any[]> {
    try {
      const response = await this.client.crm.objects.searchApi.doSearch('emails', {
        filterGroups: [{
          filters: [{
            propertyName: 'hs_email_subject',
            operator: 'CONTAINS_TOKEN',
            value: searchQuery
          }]
        }],
        sorts: [],
        after: 0,
        limit,
        properties: ['hs_email_subject', 'hs_email_text', 'hs_timestamp']
      });
      
      return this.formatResponse(response.results.map(email => ({
        id: email.id,
        properties: email.properties,
        createdAt: email.createdAt,
        updatedAt: email.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'searchEmails');
    }
  }

  //=============================================================================
  // QUOTES API METHODS
  //=============================================================================

  /**
   * Create a quote
   * 
   * @param properties - Quote properties
   * @returns Created quote data
   */
  async createQuote(properties: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.quotes.basicApi.create({
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
      return this.handleApiError(error, 'createQuote');
    }
  }

  /**
   * Get quote by ID
   * 
   * @param id - Quote ID
   * @returns Quote data
   */
  async getQuote(id: string): Promise<any> {
    try {
      const response = await this.client.crm.quotes.basicApi.getById(id);
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'getQuote');
    }
  }

  /**
   * Update quote properties
   * 
   * @param id - Quote ID
   * @param properties - Properties to update
   * @returns Updated quote data
   */
  async updateQuote(id: string, properties: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.quotes.basicApi.update(id, {
        properties
      });
      
      return this.formatResponse({
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });
    } catch (error) {
      return this.handleApiError(error, 'updateQuote');
    }
  }


  /**
   * Search quotes
   * 
   * @param searchQuery - Search query
   * @param limit - Maximum number of results
   * @returns Matching quotes
   */
  async searchQuotes(searchQuery: string, limit: number = 10): Promise<any[]> {
    try {
      const response = await this.client.crm.quotes.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'hs_title',
            operator: 'CONTAINS_TOKEN',
            value: searchQuery
          }]
        }],
        sorts: [],
        after: 0,
        limit,
        properties: ['hs_title', 'hs_expiration_date', 'hs_domain']
      });
      
      return this.formatResponse(response.results.map(quote => ({
        id: quote.id,
        properties: quote.properties,
        createdAt: quote.createdAt,
        updatedAt: quote.updatedAt
      })));
    } catch (error) {
      return this.handleApiError(error, 'searchQuotes');
    }
  }

  //=============================================================================
  // ASSOCIATIONS API METHODS
  //=============================================================================

  /**
   * Create an association between two objects
   * 
   * @param fromObjectType - Source object type
   * @param fromObjectId - Source object ID
   * @param toObjectType - Target object type
   * @param toObjectId - Target object ID
   * @param associationTypeId - Association type ID
   */
  async createAssociation(
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string,
    toObjectId: string,
    associationTypeId: number = 1
  ): Promise<void> {
    try {
      await this.client.apiRequest({
        method: 'PUT',
        path: `/crm/v4/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}`,
        body: [{
          associationCategory: 'HUBSPOT_DEFINED',
          associationTypeId
        }]
      });
    } catch (error) {
      this.handleApiError(error, 'createAssociation');
    }
  }


  /**
   * List associations for an object
   * 
   * @param objectType - Object type
   * @param objectId - Object ID
   * @param toObjectType - Target object type
   * @param limit - Maximum number of results
   * @returns List of associations
   */
  async listAssociations(
    objectType: string,
    objectId: string,
    toObjectType: string,
    limit: number = 100
  ): Promise<any> {
    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v4/objects/${objectType}/${objectId}/associations/${toObjectType}?limit=${limit}`
      });
      
      return this.formatResponse(response);
    } catch (error) {
      return this.handleApiError(error, 'listAssociations');
    }
  }

  //=============================================================================
  // PROPERTIES API METHODS
  //=============================================================================

  /**
   * Create a custom property
   * 
   * @param objectType - Object type
   * @param propertyData - Property data
   * @returns Created property data
   */
  async createProperty(objectType: string, propertyData: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.properties.coreApi.create(objectType, propertyData as any);
      return this.formatResponse(response);
    } catch (error) {
      return this.handleApiError(error, 'createProperty');
    }
  }

  /**
   * Get property by name
   * 
   * @param objectType - Object type
   * @param propertyName - Property name
   * @returns Property data
   */
  async getProperty(objectType: string, propertyName: string): Promise<any> {
    try {
      const response = await this.client.crm.properties.coreApi.getByName(objectType, propertyName);
      return this.formatResponse(response);
    } catch (error) {
      return this.handleApiError(error, 'getProperty');
    }
  }

  /**
   * Update property
   * 
   * @param objectType - Object type
   * @param propertyName - Property name
   * @param propertyData - Updated property data
   * @returns Updated property data
   */
  async updateProperty(objectType: string, propertyName: string, propertyData: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.crm.properties.coreApi.update(objectType, propertyName, propertyData);
      return this.formatResponse(response);
    } catch (error) {
      return this.handleApiError(error, 'updateProperty');
    }
  }


  /**
   * List properties for an object type
   * 
   * @param objectType - Object type
   * @returns List of properties
   */
  async listProperties(objectType: string): Promise<any[]> {
    try {
      const response = await this.client.crm.properties.coreApi.getAll(objectType);
      return this.formatResponse(response.results);
    } catch (error) {
      return this.handleApiError(error, 'listProperties');
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
      // Use search API instead of getPage to get better control over properties
      const response = await this.client.crm.deals.searchApi.doSearch({
        filterGroups: [],
        sorts: [
          {
            propertyName: 'createdate',
            direction: 'DESCENDING'
          } as any
        ],
        after: 0,
        limit,
        properties: ['dealname', 'amount', 'closedate', 'dealstage']
      });
      
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
