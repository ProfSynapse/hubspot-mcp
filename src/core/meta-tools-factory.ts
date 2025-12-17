/**
 * Meta-Tools Registration Factory
 *
 * Registers the two meta-tools (hubspot_getTools and hubspot_useTools) with MCP SDK.
 *
 * Used by:
 * - http-server-sdk.ts: Registers tools on server startup
 *
 * Key Features:
 * - hubspot_getTools: Schema discovery for all 72 operations across 12 domains
 * - hubspot_useTools: Universal execution with server-side validation
 * - Uses Zod schemas for parameter validation
 * - Context provider integration for dynamic enums (deal stages, property groups, etc.)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BcpToolDelegator } from './bcp-tool-delegator.js';
import { ContextRegistry } from './context/index.js';
import { DOMAIN_CONFIGS } from './schema-registry.js';
import {
  createGetToolsHandler,
  createUseToolsHandler,
  getGetToolsDescription,
  getUseToolsDescription
} from './meta-tools-handler.js';

/**
 * Factory for registering meta-tools with MCP server
 */
export class MetaToolsRegistrationFactory {
  private contextRegistry?: ContextRegistry;

  constructor(contextRegistry?: ContextRegistry) {
    this.contextRegistry = contextRegistry;
  }

  /**
   * Register all meta-tools with the MCP server
   */
  async registerAllTools(server: McpServer, delegator: BcpToolDelegator): Promise<void> {
    // Register hubspot_getTools
    this.registerGetTools(server);

    // Register hubspot_useTools
    this.registerUseTools(server, delegator);

    console.error('[META-TOOLS] Registered 2 meta-tools: hubspot_getTools, hubspot_useTools');
  }

  /**
   * Register hubspot_getTools
   */
  private registerGetTools(server: McpServer): void {
    const domainNames = Object.keys(DOMAIN_CONFIGS) as [string, ...string[]];

    const schema = {
      domain: z.enum(domainNames)
        .optional()
        .describe('The HubSpot domain to discover operations for (optional - omit to list all domains)'),
      operation: z.string()
        .optional()
        .describe('Specific operation to get schema for (optional - requires domain to be specified)'),
      includeContext: z.boolean()
        .optional()
        .default(true)
        .describe('Whether to include context-enriched schemas (e.g., valid deal stages from HubSpot). Default: true')
    };

    const handler = createGetToolsHandler(this.contextRegistry);

    server.tool(
      'hubspot_getTools',
      schema,
      async (params) => {
        return handler(params as any);
      }
    );

    console.error('[META-TOOLS] Registered hubspot_getTools');
  }

  /**
   * Register hubspot_useTools
   */
  private registerUseTools(server: McpServer, delegator: BcpToolDelegator): void {
    const domainNames = Object.keys(DOMAIN_CONFIGS) as [string, ...string[]];

    const schema = {
      context: z.string()
        .min(1)
        .describe('Contextual information about the current task or workflow. Explain what you are trying to accomplish in the broader context. This helps with error messages and activity tracking. (REQUIRED)'),
      goals: z.string()
        .min(1)
        .describe('Specific goals or objectives for this operation. What are you trying to achieve with this particular API call? (REQUIRED)'),
      domain: z.enum(domainNames)
        .describe('The HubSpot domain to operate on (REQUIRED)'),
      operation: z.string()
        .describe('The operation to perform within the domain (REQUIRED). Use hubspot_getTools to discover available operations.'),
      parameters: z.record(z.any())
        .optional()
        .describe('Operation-specific parameters as defined by the operation schema. Use hubspot_getTools to discover required and optional parameters for each operation.')
    };

    const handler = createUseToolsHandler(delegator);

    server.tool(
      'hubspot_useTools',
      schema,
      async (params) => {
        return handler(params as any);
      }
    );

    console.error('[META-TOOLS] Registered hubspot_useTools');
  }
}
