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
    
    // Register Deals tools (future)
    // this.registerDealsTools();
  }
  
  /**
   * Get available BCPs
   */
  private getAvailableBCPs(): string[] {
    // Return the list of available BCPs
    return ['Companies', 'Contacts', 'Deals', 'Notes', 'Associations'];
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
      console.error('- hubspotBlogPost: Blog post operations (create, get, update, delete, recent)');
      console.error('- hubspotNote: Note operations (create, get, update, delete, list, recent)');
      console.error('- hubspotAssociation: Association operations (create, createDefault, delete, list, batchCreate, batchCreateDefault, batchDelete, batchRead, deleteLabels)');
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
