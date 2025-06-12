/**
 * MCP Server with BCP Architecture
 * 
 * Implements a Model Context Protocol server with Bounded Context Packs (BCP)
 * for HubSpot API integration.
 */

import { createHubspotApiClient, HubspotApiClient } from './hubspot-client.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { noteTools } from '../bcps/Notes/index.js';
import { associationTools } from '../bcps/Associations/index.js';
import { ToolDefinition, validateParams } from './types.js'; // Ensure ToolDefinition and validateParams are imported

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
    
    // Register Notes tools
    this.registerNotesTools();
    
    // Register Associations tools
    this.registerAssociationsTools();
    
    // Register Quotes tools
    this.registerQuotesTools();
    
    // Register Deals tools
    this.registerDealsTools();
    
    // Register SocialMedia tools
    this.registerSocialMediaTools();
  }
  
  /**
   * Get available BCPs
   */
  private getAvailableBCPs(): string[] {
    // Return the list of available BCPs
    return ['Companies', 'Contacts', 'Deals', 'Notes', 'Associations', 'Quotes', 'SocialMedia'];
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
   * Register Notes tools
   */
  private registerNotesTools(): void {
    // Define a combined schema for all note operations
    // This requires careful merging of individual tool schemas
    const noteOperationEnum = z.enum(['create', 'get', 'update', 'delete', 'list', 'recent']);
    
    // Consolidate all properties from individual note tools' inputSchemas
    // This is a simplified approach; a more robust solution might involve dynamic schema generation
    // or a more complex Zod schema that varies based on 'operation'.
    const allNoteParams = {
      operation: noteOperationEnum.describe('Operation to perform for notes'),
      // Params for createNote
      content: z.string().optional().describe('Content of the note (required for create)'),
      // ownerId is used by create and update
      ownerId: z.string().optional().describe('HubSpot owner ID for the note'),
      // metadata is used by create and update
      metadata: z.record(z.string().or(z.number()).or(z.boolean())).optional().describe('Custom properties for the note'),
      // id is used by get, update, delete
      id: z.string().optional().describe('Note ID (required for get, update, delete)'),
      // Params for listNotes
      startTimestamp: z.string().optional().describe('Start timestamp for list filter (ISO 8601)'),
      endTimestamp: z.string().optional().describe('End timestamp for list filter (ISO 8601)'),
      // after is used by listNotes
      after: z.string().optional().describe('Pagination cursor for listNotes'),
      // limit is used by listNotes and getRecentNotes
      limit: z.number().int().min(1).max(100).optional().describe('Maximum number of results'),
    };

    this.server.tool(
      'hubspotNote',
      allNoteParams,
      async (params: any) => {
        try {
          const { operation, ...operationParams } = params;
          let selectedTool: ToolDefinition | undefined;

          switch (operation) {
            case 'create':
              selectedTool = noteTools.find(t => t.name === 'createNote');
              break;
            case 'get':
              selectedTool = noteTools.find(t => t.name === 'getNote');
              break;
            case 'update':
              selectedTool = noteTools.find(t => t.name === 'updateNote');
              break;
            case 'delete':
              selectedTool = noteTools.find(t => t.name === 'deleteNote');
              break;
            case 'list':
              selectedTool = noteTools.find(t => t.name === 'listNotes');
              break;
            case 'recent':
              selectedTool = noteTools.find(t => t.name === 'getRecentNotes');
              break;
            default:
              throw new Error(`Unknown note operation: ${operation}`);
          }

          if (!selectedTool || !selectedTool.handler) {
            throw new Error(`Handler not found for note operation: ${operation}`);
          }
          
          // Validate parameters against the tool's inputSchema
          if (selectedTool.inputSchema) {
            try {
              // This will throw an error if validation fails
              validateParams(operationParams, selectedTool.inputSchema, selectedTool.name);
            } catch (validationError) {
              throw new Error(`Error performing note operation: ${(validationError as Error).message}`);
            }
          }
          
          const result = await selectedTool.handler(operationParams);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };

        } catch (error) {
          // Ensure error is an instance of Error
          const err = error instanceof Error ? error : new Error(String(error));
          return {
            content: [{ type: 'text', text: `Error performing note operation: ${err.message}` }],
            isError: true
          };
        }
      }
    );
  }

  /**
   * Register Associations tools
   */
  private registerAssociationsTools(): void {
    // Define a combined schema for all association operations
    const associationOperationEnum = z.enum(['create', 'createDefault', 'delete', 'list', 'batchCreate', 'batchCreateDefault', 'batchDelete', 'batchRead', 'deleteLabels', 'getAssociationTypes', 'getAssociationTypeReference']);
    
    // Consolidate all properties from individual association tools' inputSchemas
    const allAssociationParams = {
      operation: associationOperationEnum.describe('Operation to perform for associations'),
      // Common parameters
      fromObjectType: z.string().optional().describe('The type of the first object (e.g., "contacts", "companies")'),
      toObjectType: z.string().optional().describe('The type of the second object'),
      // Parameters for single operations
      fromObjectId: z.string().optional().describe('The ID of the first object (for single operations)'),
      toObjectId: z.string().optional().describe('The ID of the second object (for single operations)'),
      // Parameters for batch operations
      associations: z.array(z.any()).optional().describe('The associations to create/delete (for batch operations)'),
      inputs: z.array(z.any()).optional().describe('The objects to read associations for (for batchRead)'),
      // Parameters for list operation
      objectType: z.string().optional().describe('The type of the object (for list operation)'),
      objectId: z.string().optional().describe('The ID of the object (for list operation)'),
      limit: z.number().int().min(1).max(500).optional().describe('Maximum number of results (for list operation)'),
      after: z.string().optional().describe('Pagination cursor (for list operation)'),
      // Parameters for association types
      associationCategory: z.string().optional().describe('The category of the association'),
      associationTypeId: z.number().optional().describe('The ID of the association type'),
      types: z.array(z.any()).optional().describe('The types of associations to create/delete'),
    };

    this.server.tool(
      'hubspotAssociation',
      allAssociationParams,
      async (params: any) => {
        try {
          const { operation, ...operationParams } = params;
          let selectedTool: ToolDefinition | undefined;

          switch (operation) {
            case 'create':
              selectedTool = associationTools.find(t => t.name === 'createAssociation');
              break;
            case 'createDefault':
              selectedTool = associationTools.find(t => t.name === 'createDefaultAssociation');
              break;
            case 'delete':
              selectedTool = associationTools.find(t => t.name === 'deleteAssociation');
              break;
            case 'list':
              selectedTool = associationTools.find(t => t.name === 'listAssociations');
              break;
            case 'batchCreate':
              selectedTool = associationTools.find(t => t.name === 'batchCreateAssociations');
              break;
            case 'batchCreateDefault':
              selectedTool = associationTools.find(t => t.name === 'batchCreateDefaultAssociations');
              break;
            case 'batchDelete':
              selectedTool = associationTools.find(t => t.name === 'batchDeleteAssociations');
              break;
            case 'batchRead':
              selectedTool = associationTools.find(t => t.name === 'batchReadAssociations');
              break;
            case 'deleteLabels':
              selectedTool = associationTools.find(t => t.name === 'deleteAssociationLabels');
              break;
            case 'getAssociationTypes':
              selectedTool = associationTools.find(t => t.name === 'getAssociationTypes');
              break;
            case 'getAssociationTypeReference':
              selectedTool = associationTools.find(t => t.name === 'getAssociationTypeReference');
              break;
            default:
              throw new Error(`Unknown association operation: ${operation}`);
          }

          if (!selectedTool || !selectedTool.handler) {
            throw new Error(`Handler not found for association operation: ${operation}`);
          }
          
          // Special handling for parameter mapping
          // Map parameters from the combined schema to the expected schema for specific operations
          if (operation === 'list') {
            if (operationParams.objectType && !operationParams.fromObjectType) {
              operationParams.fromObjectType = operationParams.objectType;
            }
            
            if (operationParams.objectId && !operationParams.fromObjectId) {
              operationParams.fromObjectId = operationParams.objectId;
            }
          }
          
          // Special handling for batchRead operation
          if (operation === 'batchRead' && !operationParams.fromObjectType && 
              operationParams.inputs && operationParams.inputs.length > 0 && 
              operationParams.inputs[0].type) {
            operationParams.fromObjectType = operationParams.inputs[0].type;
            console.log(`Server extracted fromObjectType from inputs: ${operationParams.fromObjectType}`);
          }
          
          // Validate parameters against the tool's inputSchema
          if (selectedTool.inputSchema) {
            try {
              // This will throw an error if validation fails
              validateParams(operationParams, selectedTool.inputSchema, selectedTool.name);
            } catch (validationError) {
              throw new Error(`Error performing association operation: ${(validationError as Error).message}`);
            }
          }
          
          const result = await selectedTool.handler(operationParams);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };

        } catch (error) {
          // Ensure error is an instance of Error
          const err = error instanceof Error ? error : new Error(String(error));
          return {
            content: [{ type: 'text', text: `Error performing association operation: ${err.message}` }],
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
        operation: z.enum(['create', 'get', 'update', 'delete', 'recent']).describe('Operation to perform'),
        
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
        
        // Parameters for get/update/delete operations
        id: z.string().optional().describe('Blog post ID (required for get, update, and delete operations)'),
        
        // Parameters for update operation
        updateDraftOnly: z.boolean().optional().describe('Whether to update only the draft version (true) or publish changes immediately (false)'),
        
        // Common parameters
        limit: z.number().int().min(1).max(100).default(10).describe('Maximum number of results (for recent operations)'),
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
              if (!params.id) {
                throw new Error('Blog post ID is required for get, update, and delete operations');
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
   * Register Deals tools
   */
  private registerDealsTools(): void {
    // Register the main Deals tool
    this.server.tool(
      'hubspotDeal',
      {
        operation: z.enum(['create', 'get', 'update', 'delete', 'search', 'recent', 'batchCreate', 'batchUpdate']).describe('Operation to perform'),
        
        // Parameters for create operation
        dealname: z.string().optional().describe('Deal name (required for create operation)'),
        pipeline: z.string().optional().describe('Pipeline ID the deal belongs to'),
        dealstage: z.string().optional().describe('Deal stage ID within the pipeline'),
        amount: z.string().optional().describe('Deal amount in currency'),
        closedate: z.string().optional().describe('Expected close date (ISO 8601 format: YYYY-MM-DD)'),
        description: z.string().optional().describe('Deal description'),
        hubspot_owner_id: z.string().optional().describe('HubSpot owner ID for the deal'),
        
        // Parameters for get/update/delete operations
        id: z.string().optional().describe('Deal ID (required for get, update, and delete operations)'),
        
        // Parameters for search operation
        searchType: z.enum(['name', 'modifiedDate', 'custom']).optional().describe('Type of search to perform'),
        query: z.string().optional().describe('Search query (for name search) or ISO date string (for modifiedDate search)'),
        customSearch: z.object({
          filterGroups: z.array(z.object({
            filters: z.array(z.object({
              propertyName: z.string(),
              operator: z.string(),
              value: z.string()
            }))
          })),
          sorts: z.array(z.object({
            propertyName: z.string(),
            direction: z.enum(['ASCENDING', 'DESCENDING'])
          })).optional(),
          properties: z.array(z.string()).optional(),
          limit: z.number().optional(),
          after: z.number().optional()
        }).optional().describe('Custom search request (for advanced searches)'),
        
        // Parameters for batch operations
        deals: z.array(z.object({
          dealname: z.string(),
          pipeline: z.string().optional(),
          dealstage: z.string().optional(),
          amount: z.string().optional(),
          closedate: z.string().optional(),
          description: z.string().optional(),
          hubspot_owner_id: z.string().optional()
        })).optional().describe('Array of deals to create (for batchCreate)'),
        updates: z.array(z.object({
          id: z.string(),
          properties: z.object({
            dealname: z.string().optional(),
            pipeline: z.string().optional(),
            dealstage: z.string().optional(),
            amount: z.string().optional(),
            closedate: z.string().optional(),
            description: z.string().optional(),
            hubspot_owner_id: z.string().optional()
          })
        })).optional().describe('Array of deal updates (for batchUpdate)'),
        
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
              if (!params.dealname) {
                throw new Error('Deal name is required for create operation');
              }
              break;
            case 'get':
            case 'update':
            case 'delete':
              if (!params.id) {
                throw new Error('Deal ID is required for get, update, and delete operations');
              }
              break;
            case 'search':
              if (!params.searchType) {
                throw new Error('Search type is required for search operation');
              }
              if (params.searchType !== 'custom' && !params.query) {
                throw new Error('Query is required for name and modifiedDate search');
              }
              if (params.searchType === 'custom' && !params.customSearch) {
                throw new Error('customSearch object is required for custom search');
              }
              break;
            case 'batchCreate':
              if (!params.deals || params.deals.length === 0) {
                throw new Error('Deals array is required for batchCreate operation');
              }
              break;
            case 'batchUpdate':
              if (!params.updates || params.updates.length === 0) {
                throw new Error('Updates array is required for batchUpdate operation');
              }
              break;
          }
          
          // Dispatch to the appropriate operation
          let result;
          switch (operation) {
            case 'create':
              // Prepare deal properties
              const properties: Record<string, any> = {
                dealname: params.dealname,
                ...(params.pipeline && { pipeline: params.pipeline }),
                ...(params.dealstage && { dealstage: params.dealstage }),
                ...(params.amount && { amount: params.amount }),
                ...(params.closedate && { closedate: params.closedate }),
                ...(params.description && { description: params.description }),
                ...(params.hubspot_owner_id && { hubspot_owner_id: params.hubspot_owner_id }),
                ...(params.properties || {})
              };
              
              result = await this.apiClient.createDeal(properties);
              break;
              
            case 'get':
              result = await this.apiClient.getDeal(params.id as string);
              break;
              
            case 'update':
              // Prepare update properties
              const updateProps: Record<string, any> = {
                ...(params.dealname && { dealname: params.dealname }),
                ...(params.pipeline && { pipeline: params.pipeline }),
                ...(params.dealstage && { dealstage: params.dealstage }),
                ...(params.amount && { amount: params.amount }),
                ...(params.closedate && { closedate: params.closedate }),
                ...(params.description && { description: params.description }),
                ...(params.hubspot_owner_id && { hubspot_owner_id: params.hubspot_owner_id }),
                ...(params.properties || {})
              };
              
              result = await this.apiClient.updateDeal(params.id as string, updateProps);
              break;
              
            case 'delete':
              await this.apiClient.deleteDeal(params.id as string);
              result = { message: `Deal ${params.id} deleted successfully` };
              break;
              
            case 'search':
              if (params.searchType === 'name') {
                result = await this.apiClient.searchDealsByName(params.query as string, params.limit);
              } else if (params.searchType === 'modifiedDate') {
                const date = new Date(params.query as string);
                if (isNaN(date.getTime())) {
                  throw new Error('Invalid date format. Please use ISO 8601 format.');
                }
                result = await this.apiClient.searchDealsByModifiedDate(date, params.limit);
              } else if (params.searchType === 'custom' && params.customSearch) {
                result = await this.apiClient.searchDeals(params.customSearch);
              }
              break;
              
            case 'recent':
              result = await this.apiClient.getRecentDeals(params.limit);
              break;
              
            case 'batchCreate':
              result = await this.apiClient.batchCreateDeals(params.deals as any[]);
              break;
              
            case 'batchUpdate':
              result = await this.apiClient.batchUpdateDeals(params.updates as any[]);
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
   * Register Quotes tools
   */
  private registerQuotesTools(): void {
    // Register the main Quotes tool
    this.server.tool(
      'hubspotQuote',
      {
        operation: z.enum(['create', 'get', 'update', 'delete', 'search', 'recent', 'addLineItem', 'listLineItems', 'updateLineItem', 'removeLineItem']).describe('Operation to perform'),
        
        // Parameters for create operation
        title: z.string().optional().describe('Quote title (required for create operation)'),
        expirationDate: z.string().optional().describe('Quote expiration date (ISO 8601 format)'),
        status: z.enum(['DRAFT', 'APPROVAL_NOT_NEEDED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PENDING_BUYER_ACTION', 'ACCEPTED', 'DECLINED', 'LOST', 'WON']).optional().describe('Quote status'),
        currency: z.string().optional().describe('Currency code (e.g., USD, EUR, GBP)'),
        language: z.string().optional().describe('Language code (e.g., en, es, fr)'),
        locale: z.string().optional().describe('Locale code (e.g., en-US, es-MX)'),
        senderCompanyName: z.string().optional().describe('Sender company name'),
        senderCompanyAddress: z.string().optional().describe('Sender company address'),
        senderCompanyCity: z.string().optional().describe('Sender company city'),
        senderCompanyState: z.string().optional().describe('Sender company state/province'),
        senderCompanyZip: z.string().optional().describe('Sender company postal code'),
        senderCompanyCountry: z.string().optional().describe('Sender company country'),
        senderFirstName: z.string().optional().describe('Sender first name'),
        senderLastName: z.string().optional().describe('Sender last name'),
        senderEmail: z.string().optional().describe('Sender email address'),
        senderPhone: z.string().optional().describe('Sender phone number'),
        senderJobTitle: z.string().optional().describe('Sender job title'),
        
        // Parameters for get/update/delete operations
        id: z.string().optional().describe('Quote ID (required for get, update, and delete operations)'),
        
        // Parameters for search operation
        searchType: z.enum(['title', 'status']).optional().describe('Type of search to perform'),
        searchTerm: z.string().optional().describe('Search term (title text for title search, or status value for status search)'),
        
        // Common parameters
        limit: z.number().int().min(1).max(100).default(10).describe('Maximum number of results (for search and recent operations)'),
        
        // Line item parameters
        quoteId: z.string().optional().describe('Quote ID (required for addLineItem, listLineItems, removeLineItem operations)'),
        lineItemId: z.string().optional().describe('Line item ID (required for updateLineItem, removeLineItem operations)'),
        name: z.string().optional().describe('Line item name (required for addLineItem)'),
        productId: z.string().optional().describe('Product ID from HubSpot product library'),
        quantity: z.number().optional().describe('Quantity for line item'),
        price: z.number().optional().describe('Unit price for line item'),
        discount: z.number().optional().describe('Discount amount for line item'),
        discountPercentage: z.number().optional().describe('Discount percentage (0-100)'),
        termInMonths: z.number().optional().describe('Term length in months for recurring items'),
        recurringBillingPeriod: z.enum(['monthly', 'quarterly', 'semiannually', 'annually', 'per_two_years', 'per_three_years']).optional().describe('Recurring billing period'),
        description: z.string().optional().describe('Line item description')
      },
      async (params) => {
        try {
          const { operation } = params;
          
          // Dispatch to the appropriate operation using the Quotes BCP
          const { bcp } = await import('../bcps/Quotes/index.js');
          
          // Find the appropriate tool based on operation
          let toolName;
          switch (operation) {
            case 'create':
              toolName = 'create';
              if (!params.title) {
                throw new Error('Quote title is required for create operation');
              }
              break;
            case 'get':
              toolName = 'get';
              if (!params.id) {
                throw new Error('Quote ID is required for get operation');
              }
              break;
            case 'update':
              toolName = 'update';
              if (!params.id) {
                throw new Error('Quote ID is required for update operation');
              }
              break;
            case 'delete':
              toolName = 'delete';
              if (!params.id) {
                throw new Error('Quote ID is required for delete operation');
              }
              break;
            case 'search':
              toolName = 'search';
              if (!params.searchType && !params.status) {
                throw new Error('Either searchType with searchTerm, or status is required for search operation');
              }
              break;
            case 'recent':
              toolName = 'recent';
              break;
            case 'addLineItem':
              toolName = 'addLineItem';
              if (!params.quoteId) {
                throw new Error('Quote ID is required for addLineItem operation');
              }
              if (!params.name) {
                throw new Error('Line item name is required for addLineItem operation');
              }
              break;
            case 'listLineItems':
              toolName = 'listLineItems';
              if (!params.quoteId) {
                throw new Error('Quote ID is required for listLineItems operation');
              }
              break;
            case 'updateLineItem':
              toolName = 'updateLineItem';
              if (!params.lineItemId) {
                throw new Error('Line item ID is required for updateLineItem operation');
              }
              break;
            case 'removeLineItem':
              toolName = 'removeLineItem';
              if (!params.quoteId || !params.lineItemId) {
                throw new Error('Quote ID and line item ID are required for removeLineItem operation');
              }
              break;
            default:
              throw new Error(`Unknown operation: ${operation}`);
          }
          
          // Find the tool
          const tool = bcp.tools.find(t => t.name === toolName);
          if (!tool || !tool.handler) {
            throw new Error(`Tool handler not found for operation: ${operation}`);
          }
          
          // Execute the tool handler
          const result = await tool.handler(params);
          
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
   * Register SocialMedia tools
   */
  private registerSocialMediaTools(): void {
    // Register the main SocialMedia tool
    this.server.tool(
      'hubspotSocialMedia',
      {
        operation: z.enum(['getBroadcastMessages', 'getBroadcastMessage', 'createBroadcastMessage', 'updateBroadcastMessage', 'deleteBroadcastMessage', 'getChannels']).describe('Operation to perform'),
        
        // Parameters for getBroadcastMessages
        status: z.enum(['SCHEDULED', 'PUBLISHED', 'FAILED', 'DRAFT']).optional().describe('Filter by broadcast message status'),
        since: z.number().optional().describe('Filter messages created since this timestamp (Unix timestamp in milliseconds)'),
        until: z.number().optional().describe('Filter messages created until this timestamp (Unix timestamp in milliseconds)'),
        
        // Parameters for get/update/delete operations
        broadcastGuid: z.string().optional().describe('The GUID of the broadcast message (required for get, update, delete operations)'),
        
        // Parameters for create/update operations
        body: z.string().optional().describe('The content of the social media post'),
        channelKeys: z.array(z.string()).optional().describe('Array of channel GUIDs to post to'),
        groupGuid: z.string().optional().describe('Group GUID to associate the message with'),
        publishNow: z.boolean().optional().describe('Whether to publish the message immediately'),
        publishAt: z.number().optional().describe('Unix timestamp (milliseconds) to schedule the message for publishing'),
        
        // Common parameters
        limit: z.number().int().min(1).max(100).optional().describe('Maximum number of results'),
        offset: z.number().optional().describe('Number of results to skip for pagination')
      },
      async (params) => {
        try {
          const { operation } = params;
          
          // Import the BCP
          const { bcp } = await import('../bcps/SocialMedia/index.js');
          
          // Find the appropriate tool based on operation
          let toolName;
          switch (operation) {
            case 'getBroadcastMessages':
              toolName = 'getBroadcastMessages';
              break;
            case 'getBroadcastMessage':
              toolName = 'getBroadcastMessage';
              if (!params.broadcastGuid) {
                throw new Error('Broadcast GUID is required for getBroadcastMessage operation');
              }
              break;
            case 'createBroadcastMessage':
              toolName = 'createBroadcastMessage';
              if (!params.body) {
                throw new Error('Message body is required for createBroadcastMessage operation');
              }
              break;
            case 'updateBroadcastMessage':
              toolName = 'updateBroadcastMessage';
              if (!params.broadcastGuid) {
                throw new Error('Broadcast GUID is required for updateBroadcastMessage operation');
              }
              break;
            case 'deleteBroadcastMessage':
              toolName = 'deleteBroadcastMessage';
              if (!params.broadcastGuid) {
                throw new Error('Broadcast GUID is required for deleteBroadcastMessage operation');
              }
              break;
            case 'getChannels':
              toolName = 'getChannels';
              break;
            default:
              throw new Error(`Unknown operation: ${operation}`);
          }
          
          // Find the tool
          const tool = bcp.tools.find(t => t.name === toolName);
          if (!tool || !tool.handler) {
            throw new Error(`Tool handler not found for operation: ${operation}`);
          }
          
          // Execute the tool handler
          const result = await tool.handler(params);
          
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
      console.error('- hubspotDeal: Deal operations (create, get, update, delete, search, recent, batchCreate, batchUpdate)');
      console.error('- hubspotBlogPost: Blog post operations (create, get, update, delete, recent)');
      console.error('- hubspotNote: Note operations (create, get, update, delete, list, recent)');
      console.error('- hubspotAssociation: Association operations (create, createDefault, delete, list, batchCreate, batchCreateDefault, batchDelete, batchRead, deleteLabels)');
      console.error('- hubspotQuote: Quote operations (create, get, update, delete, search, recent)');
      console.error('- hubspotSocialMedia: Social Media operations (getBroadcastMessages, getBroadcastMessage, createBroadcastMessage, updateBroadcastMessage, deleteBroadcastMessage, getChannels)');
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
