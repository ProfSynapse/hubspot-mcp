/**
 * Location: /src/core/tool-registration-factory.ts
 * 
 * Tool Registration Factory that registers consolidated domain tools with MCP SDK.
 * Uses proper Zod schemas for each domain and creates clean delegation handlers.
 * 
 * Used by:
 * - src/http-server-sdk.ts: Uses factory to register all tools with MCP server
 * 
 * How it works with other files:
 * - Works with BcpToolDelegator to handle actual tool execution
 * - Registers consolidated tools (one per domain) with the MCP server
 * - Maps domain operations to specific BCP tools through the delegator
 * - Provides comprehensive parameter schemas for each domain
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BcpDelegator } from './bcp-tool-delegator.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface ToolRegistrationFactory {
  createDomainTool(domain: string, delegator: BcpDelegator): DomainToolConfig;
  registerAllTools(server: McpServer, delegator: BcpDelegator): Promise<void>;
}

interface DomainToolConfig {
  name: string;
  schema: z.ZodObject<any>;
  handler: (params: any) => Promise<CallToolResult>;
}

export class BcpToolRegistrationFactory implements ToolRegistrationFactory {
  private static readonly DOMAIN_CONFIGS: Record<string, DomainConfig> = {
    Companies: {
      operations: ['create', 'get', 'update', 'delete', 'search', 'recent'],
      description: 'HubSpot company management with CRUD operations and search capabilities'
    },
    Contacts: {
      operations: ['create', 'get', 'update', 'delete', 'search', 'recent'],
      description: 'HubSpot contact management with CRUD operations and search capabilities'
    },
    Notes: {
      operations: ['create', 'get', 'update', 'delete', 'list', 'recent', 'addAssociation', 'removeAssociation', 'listAssociations', 'createWithAssociations'],
      description: 'HubSpot note management with associations and content operations'
    },
    Associations: {
      operations: ['create', 'createDefault', 'delete', 'list', 'batchCreate', 'batchCreateDefault', 'batchDelete', 'batchRead', 'deleteLabels', 'getAssociationTypes', 'getAssociationTypeReference'],
      description: 'HubSpot object association management with batch operations'
    },
    Deals: {
      operations: ['create', 'get', 'update', 'delete', 'search', 'recent', 'batchCreate', 'batchUpdate'],
      description: 'HubSpot deal management with CRUD operations, search, and batch processing'
    },
    Products: {
      operations: ['list', 'search', 'get'],
      description: 'HubSpot product catalog management with search and retrieval'
    },
    Properties: {
      operations: ['list', 'get', 'create', 'update', 'delete', 'listGroups', 'getGroup', 'createGroup', 'updateGroup', 'deleteGroup'],
      description: 'HubSpot custom property management with groups and field definitions'
    },
    Emails: {
      operations: ['create', 'get', 'update', 'delete', 'list', 'recent'],
      description: 'HubSpot email management for marketing campaigns and communications'
    },
    BlogPosts: {
      operations: ['create', 'get', 'update', 'delete', 'recent', 'list'],
      description: 'HubSpot blog post management for content marketing'
    },
    Quotes: {
      operations: ['create', 'get', 'update', 'delete', 'search', 'recent', 'addLineItem', 'listLineItems', 'updateLineItem', 'removeLineItem'],
      description: 'HubSpot quote management with line items and pricing'
    }
  };

  createDomainTool(domain: string, delegator: BcpDelegator): DomainToolConfig {
    const config = BcpToolRegistrationFactory.DOMAIN_CONFIGS[domain];
    if (!config) {
      throw new Error(`No configuration found for domain: ${domain}`);
    }

    const toolName = `hubspot${domain}`;
    const schema = this.createDomainSchema(domain, config.operations);
    const handler = this.createDomainHandler(domain, delegator);

    return { name: toolName, schema, handler };
  }

  private createDomainSchema(domain: string, operations: string[]): z.ZodObject<any> {
    // Base schema with operation parameter
    const baseSchema = {
      operation: z.enum(operations as [string, ...string[]]).describe('Operation to perform')
    };

    // Domain-specific parameter schemas
    const domainParams = this.getDomainSpecificParams(domain);

    return z.object({ ...baseSchema, ...domainParams });
  }

  private getDomainSpecificParams(domain: string): Record<string, z.ZodType<any>> {
    // Common parameters used across domains
    const commonParams = {
      id: z.string().optional().describe('Object ID (required for get, update, delete operations)'),
      limit: z.number().int().min(1).max(100).optional().describe('Maximum number of results'),
      properties: z.record(z.any()).optional().describe('Additional object properties')
    };

    // Domain-specific parameters
    switch (domain) {
      case 'Companies':
        return {
          ...commonParams,
          name: z.string().optional().describe('Company name (required for create)'),
          domain: z.string().optional().describe('Company website domain'),
          industry: z.string().optional().describe('Company industry'),
          description: z.string().optional().describe('Company description'),
          searchType: z.enum(['name', 'domain']).optional().describe('Type of search to perform'),
          searchTerm: z.string().optional().describe('Search term')
        };

      case 'Contacts':
        return {
          ...commonParams,
          email: z.string().email().optional().describe('Contact email (required for create)'),
          firstName: z.string().optional().describe('Contact first name'),
          lastName: z.string().optional().describe('Contact last name'),
          phone: z.string().optional().describe('Contact phone number'),
          company: z.string().optional().describe('Contact company'),
          searchType: z.enum(['email', 'name']).optional().describe('Type of search to perform'),
          searchTerm: z.string().optional().describe('Search term')
        };

      case 'Notes':
        return {
          ...commonParams,
          content: z.string().optional().describe('Note content (required for create)'),
          ownerId: z.string().optional().describe('HubSpot owner ID'),
          metadata: z.record(z.any()).optional().describe('Custom note properties'),
          startTimestamp: z.string().optional().describe('Start timestamp filter (ISO 8601)'),
          endTimestamp: z.string().optional().describe('End timestamp filter (ISO 8601)'),
          after: z.string().optional().describe('Pagination cursor'),
          
          // Association operation parameters
          noteId: z.string().optional().describe('Note ID for association operations'),
          objectType: z.string().optional().describe('Type of object to associate'),
          objectId: z.string().optional().describe('ID of object to associate'),
          toObjectType: z.string().optional().describe('Type of object for list associations')
        };

      case 'Associations':
        return {
          ...commonParams,
          fromObjectType: z.string().optional().describe('Source object type'),
          toObjectType: z.string().optional().describe('Target object type'),
          fromObjectId: z.string().optional().describe('Source object ID'),
          toObjectId: z.string().optional().describe('Target object ID'),
          associations: z.array(z.any()).optional().describe('Batch associations array'),
          inputs: z.array(z.any()).optional().describe('Batch read inputs'),
          objectType: z.string().optional().describe('Object type for list operation'),
          objectId: z.string().optional().describe('Object ID for list operation'),
          after: z.string().optional().describe('Pagination cursor'),
          associationCategory: z.string().optional().describe('Association category'),
          associationTypeId: z.number().optional().describe('Association type ID'),
          types: z.array(z.any()).optional().describe('Association types')
        };

      case 'Deals':
        return {
          ...commonParams,
          dealname: z.string().optional().describe('Deal name (required for create)'),
          pipeline: z.string().optional().describe('Pipeline ID'),
          dealstage: z.string().optional().describe('Deal stage ID'),
          amount: z.string().optional().describe('Deal amount'),
          closedate: z.string().optional().describe('Close date (ISO 8601)'),
          description: z.string().optional().describe('Deal description'),
          hubspot_owner_id: z.string().optional().describe('Owner ID'),
          searchType: z.enum(['name', 'modifiedDate', 'custom']).optional().describe('Search type'),
          query: z.string().optional().describe('Search query'),
          customSearch: z.object({
            filterGroups: z.array(z.any()),
            sorts: z.array(z.any()).optional(),
            properties: z.array(z.string()).optional(),
            limit: z.number().optional(),
            after: z.number().optional()
          }).optional().describe('Custom search parameters'),
          deals: z.array(z.any()).optional().describe('Batch create deals'),
          updates: z.array(z.any()).optional().describe('Batch update deals')
        };

      case 'Products':
        return {
          ...commonParams,
          name: z.string().optional().describe('Product name for search')
        };

      case 'Properties':
        // Properties never uses 'id', only 'propertyName'
        const propertiesParams = {
          limit: z.number().int().min(1).max(100).optional().describe('Maximum number of results'),
          properties: z.record(z.any()).optional().describe('Additional object properties')
        };
        return {
          ...propertiesParams,
          objectType: z.string().optional().describe('HubSpot object type'),
          propertyName: z.string().optional().describe('Property name'),
          name: z.string().optional().describe('Internal property name'),
          label: z.string().optional().describe('Property display label'),
          description: z.string().optional().describe('Property description'),
          groupName: z.string().optional().describe('Property group name'),
          type: z.enum(['string', 'number', 'date', 'datetime', 'enumeration', 'bool']).optional().describe('Property data type'),
          fieldType: z.enum(['text', 'textarea', 'select', 'radio', 'checkbox', 'date', 'file', 'number']).optional().describe('Form field type'),
          options: z.array(z.object({
            label: z.string(),
            value: z.string(),
            displayOrder: z.number().optional(),
            hidden: z.boolean().optional()
          })).optional().describe('Enumeration options'),
          displayName: z.string().optional().describe('Group display name')
        };

      case 'Emails':
        return {
          ...commonParams,
          name: z.string().optional().describe('Email internal name'),
          templateId: z.string().optional().describe('Template ID'),
          subject: z.string().optional().describe('Email subject'),
          from: z.object({
            name: z.string().optional(),
            email: z.string().email()
          }).optional().describe('Sender information'),
          replyTo: z.string().email().optional().describe('Reply-to email'),
          previewText: z.string().optional().describe('Preview text'),
          folderId: z.string().optional().describe('Folder ID'),
          metadata: z.record(z.any()).optional().describe('Custom properties'),
          state: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']).optional().describe('Email state'),
          type: z.enum(['REGULAR', 'AUTOMATED', 'AB_TEST', 'FOLLOW_UP']).optional().describe('Email type'),
          campaignId: z.string().optional().describe('Campaign ID'),
          createdAfter: z.string().optional().describe('Created after date'),
          createdBefore: z.string().optional().describe('Created before date'),
          query: z.string().optional().describe('Search query'),
          after: z.string().optional().describe('Pagination cursor')
        };

      case 'BlogPosts':
        return {
          ...commonParams,
          name: z.string().optional().describe('Blog post title'),
          contentGroupId: z.string().optional().describe('Blog ID'),
          slug: z.string().optional().describe('URL slug'),
          blogAuthorId: z.string().optional().describe('Author ID'),
          metaDescription: z.string().optional().describe('Meta description'),
          postBody: z.string().optional().describe('Post content'),
          featuredImage: z.string().optional().describe('Featured image URL'),
          useFeaturedImage: z.boolean().optional().describe('Use featured image'),
          state: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']).optional().describe('Post state'),
          updateDraftOnly: z.boolean().optional().describe('Update draft only'),
          tagIds: z.array(z.string()).optional().describe('Tag IDs')
        };

      case 'Quotes':
        return {
          ...commonParams,
          title: z.string().optional().describe('Quote title'),
          expirationDate: z.string().optional().describe('Expiration date'),
          status: z.enum(['DRAFT', 'APPROVAL_NOT_NEEDED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PENDING_BUYER_ACTION', 'ACCEPTED', 'DECLINED', 'LOST', 'WON']).optional().describe('Quote status'),
          currency: z.string().optional().describe('Currency code'),
          language: z.string().optional().describe('Language code'),
          locale: z.string().optional().describe('Locale code'),
          searchType: z.enum(['title', 'status']).optional().describe('Search type'),
          searchTerm: z.string().optional().describe('Search term'),
          quoteId: z.string().optional().describe('Quote ID for line items'),
          lineItemId: z.string().optional().describe('Line item ID'),
          productId: z.string().optional().describe('Product ID'),
          quantity: z.number().optional().describe('Line item quantity'),
          price: z.number().optional().describe('Line item price'),
          discount: z.number().optional().describe('Discount amount'),
          discountPercentage: z.number().optional().describe('Discount percentage'),
          termInMonths: z.number().optional().describe('Term in months'),
          recurringBillingPeriod: z.enum(['monthly', 'quarterly', 'semiannually', 'annually', 'per_two_years', 'per_three_years']).optional().describe('Billing period')
        };

      default:
        return commonParams;
    }
  }

  private createDomainHandler(domain: string, delegator: BcpDelegator) {
    return async (params: any): Promise<CallToolResult> => {
      try {
        const { operation, ...operationParams } = params;
        
        if (!operation) {
          throw new Error('Operation parameter is required');
        }

        const result = await delegator.delegate(domain, operation, operationParams);
        
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error performing ${domain} operation: ${errorMessage}` }]
        };
      }
    };
  }

  async registerAllTools(server: McpServer, delegator: BcpDelegator): Promise<void> {
    const domains = Object.keys(BcpToolRegistrationFactory.DOMAIN_CONFIGS);
    
    for (const domain of domains) {
      try {
        const toolConfig = this.createDomainTool(domain, delegator);
        const config = BcpToolRegistrationFactory.DOMAIN_CONFIGS[domain];
        
        server.tool(
          toolConfig.name,
          toolConfig.schema.shape,
          toolConfig.handler
        );
        
        console.error(`[TOOL-FACTORY] Registered ${toolConfig.name} with ${config.operations.length} operations`);
      } catch (error) {
        console.error(`[TOOL-FACTORY] Failed to register ${domain} tool:`, error instanceof Error ? error.message : String(error));
        throw error;
      }
    }
    
    console.error(`[TOOL-FACTORY] Successfully registered ${domains.length} domain tools`);
  }
}

interface DomainConfig {
  operations: string[];
  description: string;
}