/**
 * Meta-Tools Handler for hubspot_getTools and hubspot_useTools
 *
 * Used by:
 * - meta-tools-factory.ts: Registers these handlers with MCP server
 *
 * Key Features:
 * - getToolsHandler: Returns detailed schema for a specific domain+operation
 * - useToolsHandler: Universal tool execution with server-side validation
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { SchemaRegistry, DOMAIN_CONFIGS } from './schema-registry.js';
import { BcpToolDelegator } from './bcp-tool-delegator.js';
import { GetToolsParams, UseToolsParams } from './types.js';
import { ContextRegistry } from './context/index.js';

/**
 * Create the getTools handler
 * Returns detailed parameter schemas for one or more domain+operation pairs
 */
export function createGetToolsHandler(
  contextRegistry?: ContextRegistry
): (params: GetToolsParams) => Promise<CallToolResult> {
  const registry = new SchemaRegistry(contextRegistry);

  return async (params: GetToolsParams): Promise<CallToolResult> => {
    const includeContext = params.includeContext !== false; // Default true

    try {
      // Validate tools array is provided
      if (!params.tools || !Array.isArray(params.tools) || params.tools.length === 0) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: 'Missing required parameter: tools (array of {domain, operation} objects)\n\nRefer to the tool description for available domains and operations.'
          }]
        };
      }

      const results: any[] = [];
      const errors: string[] = [];

      for (const tool of params.tools) {
        // Validate domain
        if (!tool.domain) {
          errors.push(`Missing domain in tool request`);
          continue;
        }
        if (!registry.isDomainValid(tool.domain)) {
          errors.push(`Unknown domain: ${tool.domain}`);
          continue;
        }

        // Validate operation
        if (!tool.operation) {
          const availableOps = registry.getOperationsForDomain(tool.domain);
          errors.push(`Missing operation for ${tool.domain}. Available: ${availableOps.join(', ')}`);
          continue;
        }
        if (!registry.isOperationValid(tool.domain, tool.operation)) {
          const availableOps = registry.getOperationsForDomain(tool.domain);
          errors.push(`Operation '${tool.operation}' not found in ${tool.domain}. Available: ${availableOps.join(', ')}`);
          continue;
        }

        // Get schema for this tool
        const schema = await registry.getOperationSchema(tool.domain, tool.operation, includeContext);
        results.push(schema);
      }

      // Return results (and any errors)
      const response: any = { schemas: results };
      if (errors.length > 0) {
        response.errors = errors;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Failed to get schemas: ${error instanceof Error ? error.message : String(error)}`
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
 * Generate the description for hubspot_getTools tool
 * Includes the full catalog of domains and operations
 */
export function getGetToolsDescription(): string {
  const domainList = Object.entries(DOMAIN_CONFIGS)
    .map(([name, config]) => `• ${name}: ${config.operations.join(', ')}`)
    .join('\n');

  const totalOps = Object.values(DOMAIN_CONFIGS)
    .reduce((sum, config) => sum + config.operations.length, 0);

  return `Get parameter schemas for HubSpot operations. Pass an array of {domain, operation} pairs to get all schemas you need in one call.

AVAILABLE OPERATIONS (${totalOps} total):

${domainList}

EXAMPLE:
tools: [{domain: "Contacts", operation: "create"}, {domain: "Associations", operation: "create"}]

Returns schemas with required/optional parameters for each operation.`;
}

/**
 * Generate the description for hubspot_useTools tool
 */
export function getUseToolsDescription(): string {
  return `Execute a HubSpot operation. Use hubspot_getTools first to get the parameter schema for your operation.

Parameters are validated server-side against the operation's schema before execution.`;
}
