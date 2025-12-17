/**
 * Meta-Tools Handler for hubspot_getTools and hubspot_useTools
 *
 * Implements the handlers for the two meta-tools that replace 12 domain tools.
 *
 * Used by:
 * - meta-tools-factory.ts: Registers these handlers with MCP server
 *
 * Key Features:
 * - getToolsHandler: Schema discovery with 3 modes (all domains, domain operations, specific operation)
 * - useToolsHandler: Universal tool execution with enhanced error messages
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { SchemaRegistry, DOMAIN_CONFIGS } from './schema-registry.js';
import { BcpToolDelegator } from './bcp-tool-delegator.js';
import { GetToolsParams, UseToolsParams } from './types.js';
import { ContextRegistry } from './context/index.js';

/**
 * Create the getTools handler
 */
export function createGetToolsHandler(
  contextRegistry?: ContextRegistry
): (params: GetToolsParams) => Promise<CallToolResult> {
  const registry = new SchemaRegistry(contextRegistry);

  return async (params: GetToolsParams): Promise<CallToolResult> => {
    const includeContext = params.includeContext !== false; // Default true

    try {
      // Case 1: No params - return all domains
      if (!params.domain) {
        const domains = await registry.getAllDomains();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              domains,
              totalDomains: domains.length,
              totalOperations: domains.reduce((sum, d) => sum + d.operationCount, 0)
            }, null, 2)
          }]
        };
      }

      // Validate domain
      if (!registry.isDomainValid(params.domain)) {
        const availableDomains = Object.keys(DOMAIN_CONFIGS).join(', ');
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Unknown domain: ${params.domain}\n\nAvailable domains: ${availableDomains}`
          }]
        };
      }

      // Case 2: Domain only - return all operations for domain
      if (!params.operation) {
        const operations = await registry.getDomainOperations(params.domain, includeContext);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              domain: params.domain,
              description: DOMAIN_CONFIGS[params.domain].description,
              operationCount: operations.length,
              operations
            }, null, 2)
          }]
        };
      }

      // Validate operation
      if (!registry.isOperationValid(params.domain, params.operation)) {
        const availableOps = registry.getOperationsForDomain(params.domain);
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Operation '${params.operation}' not found in domain '${params.domain}'.\n\nAvailable operations: ${availableOps.join(', ')}`
          }]
        };
      }

      // Case 3: Domain + operation - return detailed schema
      const operationDetail = await registry.getOperationSchema(
        params.domain,
        params.operation,
        includeContext
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(operationDetail, null, 2)
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Failed to get tools: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  };
}

/**
 * Create the useTools handler
 */
export function createUseToolsHandler(
  delegator: BcpToolDelegator
): (params: UseToolsParams) => Promise<CallToolResult> {
  return async (params: UseToolsParams): Promise<CallToolResult> => {
    // 1. Validate required parameters - context
    if (!params.context || typeof params.context !== 'string' || params.context.trim().length === 0) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: 'Missing required parameter: context (must be non-empty string)\n\n' +
                'The context parameter helps track your workflow. Provide a brief explanation of what you are trying to accomplish.'
        }]
      };
    }

    // 2. Validate required parameters - goals
    if (!params.goals || typeof params.goals !== 'string' || params.goals.trim().length === 0) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: 'Missing required parameter: goals (must be non-empty string)\n\n' +
                'The goals parameter helps track your specific objectives. Explain what you want to achieve with this API call.'
        }]
      };
    }

    // 3. Validate domain
    if (!params.domain || !DOMAIN_CONFIGS[params.domain]) {
      const availableDomains = Object.keys(DOMAIN_CONFIGS).join(', ');
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Unknown domain: ${params.domain || '(not provided)'}\n\n` +
                `Available domains: ${availableDomains}\n\n` +
                'Use hubspot_getTools with no parameters to see all available domains and their operations.'
        }]
      };
    }

    // 4. Validate operation
    if (!params.operation || !DOMAIN_CONFIGS[params.domain].operations.includes(params.operation)) {
      const operations = DOMAIN_CONFIGS[params.domain].operations;
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Operation '${params.operation || '(not provided)'}' not found in domain '${params.domain}'.\n\n` +
                `Available operations for ${params.domain} domain:\n${operations.map(op => `  - ${op}`).join('\n')}\n\n` +
                'Use hubspot_getTools to discover the correct operation name and its parameters.'
        }]
      };
    }

    // 5. Delegate to BcpToolDelegator
    try {
      const delegatorParams = {
        context: params.context,
        goals: params.goals,
        ...(params.parameters || {})
      };

      const result = await delegator.delegate(
        params.domain,
        params.operation,
        delegatorParams
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if operation not found
      if (errorMessage.includes('not found') || errorMessage.includes('Handler not found')) {
        const operations = DOMAIN_CONFIGS[params.domain].operations;
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Operation '${params.operation}' handler not found in domain '${params.domain}'.\n\n` +
                  `Available operations for ${params.domain} domain:\n${operations.map(op => `  - ${op}`).join('\n')}\n\n` +
                  'Use hubspot_getTools to discover the correct operation name and its parameters.'
          }]
        };
      }

      // Check if validation error
      if (errorMessage.includes('validation failed') || errorMessage.includes('Missing required parameter')) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `${errorMessage}\n\n` +
                  `Use hubspot_getTools with domain='${params.domain}' and operation='${params.operation}' to see the complete parameter schema.`
          }]
        };
      }

      // Generic error with suggestion
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error executing ${params.domain}.${params.operation}: ${errorMessage}\n\n` +
                'Use hubspot_getTools to verify the operation exists and review its parameter requirements.'
        }]
      };
    }
  };
}

/**
 * Get the description for hubspot_getTools tool
 */
export function getGetToolsDescription(): string {
  const domainList = Object.entries(DOMAIN_CONFIGS)
    .map(([name, config]) => `**${name}** (${config.operations.length} operations): ${config.operations.join(', ')}`)
    .join('\n');

  const totalOps = Object.values(DOMAIN_CONFIGS)
    .reduce((sum, config) => sum + config.operations.length, 0);

  return `Discover available HubSpot operations and their detailed parameter schemas.

Use this tool to:
- Browse all available HubSpot operations across 12 domains
- Get detailed parameter schemas for specific operations
- Understand required vs optional parameters
- Access context-enriched schemas (e.g., valid deal stages, property groups)

Available Domains & Operations:

${domainList}

TOTAL: ${totalOps} operations across 12 domains

To use an operation, first call this tool to get its schema, then call hubspot_useTools with the domain, operation, and parameters.`;
}

/**
 * Get the description for hubspot_useTools tool
 */
export function getUseToolsDescription(): string {
  return `Execute any HubSpot operation across all 12 domains.

This is the universal tool for interacting with HubSpot. It handles all 72 operations including:
- CRM object management (Companies, Contacts, Deals, Notes, etc.)
- Associations between objects
- Custom properties and property groups
- Marketing tools (Emails, Blog Posts)
- Sales tools (Quotes with line items)
- List management (MANUAL, DYNAMIC, SNAPSHOT)
- Activity history tracking

Required workflow:
1. First call hubspot_getTools to discover available operations and their schemas
2. Then call this tool with the appropriate domain, operation, and parameters

The context and goals parameters help track your workflow and provide better error messages.`;
}
