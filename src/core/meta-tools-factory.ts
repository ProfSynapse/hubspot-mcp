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
      tools: z.array(z.object({
        domain: z.enum(domainNames).describe('The HubSpot domain'),
        operation: z.string().describe('The operation name')
      })).min(1).describe('Array of {domain, operation} pairs to get schemas for (REQUIRED)'),
      includeContext: z.boolean()
        .optional()
        .default(true)
        .describe('Include context-enriched schemas (e.g., valid deal stages). Default: true')
    };

    const handler = createGetToolsHandler(this.contextRegistry);
    const description = getGetToolsDescription();

    server.tool(
      'hubspot_getTools',
      description,
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
        .describe('What you are trying to accomplish (REQUIRED)'),
      goals: z.string()
        .min(1)
        .describe('Specific goals for this operation (REQUIRED)'),
      domain: z.enum(domainNames)
        .describe('The HubSpot domain (REQUIRED)'),
      operation: z.string()
        .describe('The operation to perform (REQUIRED)'),
      parameters: z.record(z.any())
        .optional()
        .describe('Operation-specific parameters from hubspot_getTools schema')
    };

    const handler = createUseToolsHandler(delegator);
    const description = getUseToolsDescription();

    server.tool(
      'hubspot_useTools',
      description,
      schema,
      async (params) => {
        return handler(params as any);
      }
    );

    console.error('[META-TOOLS] Registered hubspot_useTools');
  }
}
