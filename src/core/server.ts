/**
 * MCP Server with BCP Architecture
 * 
 * Implements a Model Context Protocol server with Bounded Context Packs (BCP)
 * for HubSpot API integration.
 */

import { BCP, ToolDefinition, ToolValidationError, validateParams } from './types.js';
import { createHubspotApiClient, HubspotApiClient } from './hubspot-client.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

/**
 * HubSpotBCPServer class
 * 
 * Implements the MCP Server with BCP architecture
 */
export class HubspotBCPServer {
  private server: McpServer;
  private apiClient: HubspotApiClient;
  
  /**
   * Create a new HubSpot BCP Server
   * 
   * @param apiKey - HubSpot API key
   */
  constructor(apiKey: string) {
    // Create API client
    this.apiClient = createHubspotApiClient(apiKey);
    
    // Create MCP server
    this.server = new McpServer({
      name: 'hubspot-bcp-server',
      version: '1.0.0',
      description: 'HubSpot MCP Server with BCP Architecture'
    });
    
    // Register all tools
    this.registerAllTools();
  }
  
  /**
   * Register all tools from all BCPs
   */
  private registerAllTools(): void {
    // Register Companies tools
    this.registerCompaniesTools();
    
    // Register Contacts tools
    this.registerContactsTools();
    
    // Register BlogPosts tools
    this.registerBlogPostsTools();
    
    // Register Deals tools (future)
    // this.registerDealsTools();
  }
  
  /**
   * Get available BCPs
   */
  private getAvailableBCPs(): string[] {
    // Return the list of available BCPs
    return ['Companies', 'Contacts', 'Deals'];
  }
  
  /**
   * Register Companies tools
   */
  private registerCompaniesTools(): void {
    // Register the main Companies tool
    this.server.tool(
      'hubspotCompany',
      {
        operation: z.enum(['create', 'get', 'update', 'delete', 'search', 'recent']).describe('Operation to perform'),
        
        // Parameters for create operation
        name: z.string().min(1).optional().describe('Company name (required for create operation)'),
        domain: z.string().optional().describe('Company domain (optional for create, required for search by domain)'),
        industry: z.string().optional().describe('Company industry'),
        description: z.string().optional().describe('Company description'),
        
        // Parameters for get/update/delete operations
        id: z.string().optional().describe('Company ID (required for get, update, and delete operations)'),
        
        // Parameters for search operation
        searchType: z.enum(['name', 'domain']).optional().describe('Type of search to perform (required for search operation)'),
        searchTerm: z.string().optional().describe('Term to search for (required for search operation)'),
        
        // Common parameters
        limit: z.number().int().min(1).max(100).default(10).describe('Maximum number of results (for search and recent operations)'),
        properties: z.record(z.string()).optional().describe('Additional properties for create/update operations')
      },
      async (params) => {
        try {
          const { operation } = params;
          
          // Validate operation-specific parameters
          switch (operation) {
            case 'create':
              if (!params.name) {
                throw new Error('Company name is required for create operation');
              }
              break;
            case 'get':
            case 'update':
            case 'delete':
              if (!params.id) {
                throw new Error('Company ID is required for get, update, and delete operations');
              }
              break;
            case 'search':
              if (!params.searchType) {
                throw new Error('Search type is required for search operation');
              }
              if (!params.searchTerm) {
                throw new Error('Search term is required for search operation');
              }
              break;
          }
          
          // Dispatch to the appropriate operation
          let result;
          switch (operation) {
            case 'create':
              // Prepare company properties
              const properties: Record<string, any> = {
                name: params.name,
                ...(params.domain && { domain: params.domain }),
                ...(params.industry && { industry: params.industry }),
                ...(params.description && { description: params.description }),
                ...(params.properties || {})
              };
              
              result = await this.apiClient.createCompany(properties);
              break;
              
            case 'get':
              result = await this.apiClient.getCompany(params.id as string);
              break;
              
            case 'update':
              // Prepare update properties
              const updateProps: Record<string, any> = {
                ...(params.name && { name: params.name }),
                ...(params.domain && { domain: params.domain }),
                ...(params.industry && { industry: params.industry }),
                ...(params.description && { description: params.description }),
                ...(params.properties || {})
              };
              
              result = await this.apiClient.updateCompany(params.id as string, updateProps);
              break;
              
            case 'delete':
              await this.apiClient.deleteCompany(params.id as string);
              result = { message: `Company ${params.id} deleted successfully` };
              break;
              
            case 'search':
              if (params.searchType === 'domain') {
                result = await this.apiClient.searchCompaniesByDomain(
                  params.searchTerm as string,
                  params.limit
                );
              } else {
                result = await this.apiClient.searchCompaniesByName(
                  params.searchTerm as string,
                  params.limit
                );
              }
              break;
              
            case 'recent':
              result = await this.apiClient.getRecentCompanies(params.limit);
              break;
              
            default:
              throw new Error(`Unknown operation: ${operation}`);
          }
          
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
            isError: true
          };
        }
      }
    );
  }
  
  /**
   * Register Contacts tools
   */
  private registerContactsTools(): void {
    // Register the main Contacts tool
    this.server.tool(
      'hubspotContact',
      {
        operation: z.enum(['create', 'get', 'update', 'delete', 'search', 'recent']).describe('Operation to perform'),
        
        // Parameters for create operation
        email: z.string().email().optional().describe('Contact email address (required for create operation)'),
        firstName: z.string().optional().describe('Contact first name'),
        lastName: z.string().optional().describe('Contact last name'),
        phone: z.string().optional().describe('Contact phone number'),
        company: z.string().optional().describe('Contact company name'),
        
        // Parameters for get/update/delete operations
        id: z.string().optional().describe('Contact ID (required for get, update, and delete operations)'),
        
        // Parameters for search operation
        searchType: z.enum(['email', 'name']).optional().describe('Type of search to perform (required for search operation)'),
        searchTerm: z.string().optional().describe('Term to search for (required for search operation)'),
        
        // Common parameters
        limit: z.number().int().min(1).max(100).default(10).describe('Maximum number of results (for search and recent operations)'),
        properties: z.record(z.string()).optional().describe('Additional properties for create/update operations')
      },
      async (params) => {
        try {
          const { operation } = params;
          
          // Validate operation-specific parameters
          switch (operation) {
            case 'create':
              if (!params.email) {
                throw new Error('Contact email is required for create operation');
              }
              break;
            case 'get':
            case 'update':
            case 'delete':
              if (!params.id) {
                throw new Error('Contact ID is required for get, update, and delete operations');
              }
              break;
            case 'search':
              if (!params.searchType) {
                throw new Error('Search type is required for search operation');
              }
              if (!params.searchTerm) {
                throw new Error('Search term is required for search operation');
              }
              break;
          }
          
          // Dispatch to the appropriate operation
          let result;
          switch (operation) {
            case 'create':
              // Prepare contact properties
              const properties: Record<string, any> = {
                email: params.email,
                ...(params.firstName && { firstname: params.firstName }),
                ...(params.lastName && { lastname: params.lastName }),
                ...(params.phone && { phone: params.phone }),
                ...(params.company && { company: params.company }),
                ...(params.properties || {})
              };
              
              result = await this.apiClient.createContact(properties);
              break;
              
            case 'get':
              result = await this.apiClient.getContact(params.id as string);
              break;
              
            case 'update':
              // Prepare update properties
              const updateProps: Record<string, any> = {
                ...(params.email && { email: params.email }),
                ...(params.firstName && { firstname: params.firstName }),
                ...(params.lastName && { lastname: params.lastName }),
                ...(params.phone && { phone: params.phone }),
                ...(params.company && { company: params.company }),
                ...(params.properties || {})
              };
              
              result = await this.apiClient.updateContact(params.id as string, updateProps);
              break;
              
            case 'delete':
              await this.apiClient.deleteContact(params.id as string);
              result = { message: `Contact ${params.id} deleted successfully` };
              break;
              
            case 'search':
              if (params.searchType === 'email') {
                result = await this.apiClient.searchContactsByEmail(
                  params.searchTerm as string,
                  params.limit
                );
              } else {
                result = await this.apiClient.searchContactsByName(
                  params.searchTerm as string,
                  params.limit
                );
              }
              break;
              
            case 'recent':
              result = await this.apiClient.getRecentContacts(params.limit);
              break;
              
            default:
              throw new Error(`Unknown operation: ${operation}`);
          }
          
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
            isError: true
          };
        }
      }
    );
  }

  /**
   * Register BlogPosts tools
   */
  private registerBlogPostsTools(): void {
    // Register the main BlogPosts tool
    this.server.tool(
      'hubspotBlogPost',
      {
        operation: z.enum(['create', 'get', 'update', 'delete', 'search', 'recent', 'publish', 'schedule']).describe('Operation to perform'),
        
        // Parameters for create operation
        name: z.string().optional().describe('Blog post title (required for create operation)'),
        contentGroupId: z.string().optional().describe('ID of the parent blog to publish the post to (required for create operation)'),
        slug: z.string().optional().describe('URL slug for the blog post'),
        blogAuthorId: z.string().optional().describe('ID of the blog author'),
        metaDescription: z.string().optional().describe('Meta description for the blog post'),
        postBody: z.string().optional().describe('HTML content of the blog post'),
        featuredImage: z.string().optional().describe('URL of the featured image'),
        useFeaturedImage: z.boolean().optional().describe('Whether to include a featured image'),
        state: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']).optional().describe('Publish state of the post'),
        
        // Parameters for get/update/delete/publish/schedule operations
        id: z.string().optional().describe('Blog post ID (required for get, update, delete, publish, and schedule operations)'),
        
        // Parameters for update operation
        updateDraftOnly: z.boolean().optional().describe('Whether to update only the draft version (true) or publish changes immediately (false)'),
        
        // Parameters for schedule operation
        publishDate: z.string().optional().describe('Date to publish the post (ISO8601 format, required for schedule operation)'),
        
        // Parameters for search operation
        query: z.string().optional().describe('Search query (required for search operation)'),
        
        // Common parameters
        limit: z.number().int().min(1).max(100).default(10).describe('Maximum number of results (for search and recent operations)'),
        tagIds: z.array(z.string()).optional().describe('IDs of tags to associate with the post')
      },
      async (params) => {
        try {
          const { operation } = params;
          
          // Validate operation-specific parameters
          switch (operation) {
            case 'create':
              if (!params.name) {
                throw new Error('Blog post title is required for create operation');
              }
              if (!params.contentGroupId) {
                throw new Error('Content group ID is required for create operation');
              }
              break;
            case 'get':
            case 'update':
            case 'delete':
            case 'publish':
              if (!params.id) {
                throw new Error('Blog post ID is required for get, update, delete, and publish operations');
              }
              break;
            case 'schedule':
              if (!params.id) {
                throw new Error('Blog post ID is required for schedule operation');
              }
              if (!params.publishDate) {
                throw new Error('Publish date is required for schedule operation');
              }
              break;
            case 'search':
              if (!params.query) {
                throw new Error('Search query is required for search operation');
              }
              break;
          }
          
          // Dispatch to the appropriate operation
          let result;
          switch (operation) {
            case 'create':
              // Prepare blog post properties
              const properties: Record<string, any> = {
                name: params.name,
                contentGroupId: params.contentGroupId,
                ...(params.slug && { slug: params.slug }),
                ...(params.blogAuthorId && { blogAuthorId: params.blogAuthorId }),
                ...(params.metaDescription && { metaDescription: params.metaDescription }),
                ...(params.postBody && { postBody: params.postBody }),
                ...(params.featuredImage && { featuredImage: params.featuredImage }),
                ...(params.useFeaturedImage !== undefined && { useFeaturedImage: params.useFeaturedImage }),
                ...(params.state && { state: params.state }),
                ...(params.tagIds && { tagIds: params.tagIds })
              };
              
              result = await this.apiClient.createBlogPost(properties);
              break;
              
            case 'get':
              result = await this.apiClient.getBlogPost(params.id as string);
              break;
              
            case 'update':
              // Prepare update properties
              const updateProps: Record<string, any> = {
                ...(params.name && { name: params.name }),
                ...(params.slug && { slug: params.slug }),
                ...(params.blogAuthorId && { blogAuthorId: params.blogAuthorId }),
                ...(params.metaDescription && { metaDescription: params.metaDescription }),
                ...(params.postBody && { postBody: params.postBody }),
                ...(params.featuredImage && { featuredImage: params.featuredImage }),
                ...(params.useFeaturedImage !== undefined && { useFeaturedImage: params.useFeaturedImage }),
                ...(params.tagIds && { tagIds: params.tagIds })
              };
              
              if (params.updateDraftOnly) {
                result = await this.apiClient.updateBlogPostDraft(params.id as string, updateProps);
              } else {
                result = await this.apiClient.updateBlogPost(params.id as string, updateProps);
              }
              break;
              
            case 'delete':
              await this.apiClient.deleteBlogPost(params.id as string);
              result = { message: `Blog post ${params.id} deleted successfully` };
              break;
              
            case 'publish':
              result = await this.apiClient.publishBlogPost(params.id as string);
              break;
              
            case 'schedule':
              result = await this.apiClient.scheduleBlogPost(params.id as string, params.publishDate as string);
              break;
              
            case 'search':
              result = await this.apiClient.searchBlogPosts(params.query as string, params.limit);
              break;
              
            case 'recent':
              result = await this.apiClient.getRecentBlogPosts(params.limit);
              break;
              
            default:
              throw new Error(`Unknown operation: ${operation}`);
          }
          
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
            isError: true
          };
        }
      }
    );
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      // Create and connect the transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      // Use stderr for logging to avoid interfering with the JSON-RPC protocol
      console.error('HubSpot BCP Server started');
      console.error('Available tools:');
      console.error('- hubspotCompany: Company operations (create, get, update, delete, search, recent)');
      console.error('- hubspotContact: Contact operations (create, get, update, delete, search, recent)');
      console.error('- hubspotBlogPost: Blog post operations (create, get, update, delete, search, recent, publish, schedule)');
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  }
  
  /**
   * Get the API client
   */
  getApiClient(): HubspotApiClient {
    return this.apiClient;
  }
}

/**
 * Create and start a HubSpot BCP Server
 * 
 * @param apiKey - HubSpot API key
 * @returns HubspotBCPServer instance
 */
export async function createServer(apiKey: string): Promise<HubspotBCPServer> {
  const server = new HubspotBCPServer(apiKey);
  await server.start();
  return server;
}
