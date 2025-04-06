#!/usr/bin/env node

/**
 * Hubspot MCP Server
 * 
 * A Model Context Protocol server for Hubspot CRM integration.
 * This server provides tools for interacting with Hubspot contacts, companies, deals, and engagements.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    McpError,
    ErrorCode
} from "@modelcontextprotocol/sdk/types.js";

import config from "./config.js";
import { HubspotService } from "./services/hubspot-service.js";
import { hubspotTools } from "./tools/index.js";
import { createToolHandlers } from "./tools/tool-handlers.js";

/**
 * Main function that initializes and starts the MCP server
 */
async function main() {
    try {
        // Initialize Hubspot service
        const hubspotService = HubspotService.initialize(config.hubspotAccessToken);

        // Create tool handlers
        const toolHandlers = createToolHandlers(hubspotService);

        // Create MCP server
        const server = new Server(
            {
                name: "hubspot-mcp-server",
                version: "0.1.0",
            },
            {
                capabilities: {
                    tools: {},
                }
            }
        );

        // Set up error handling
        server.onerror = (error) => {
            // Use stderr for logging to avoid interfering with JSON communication
            process.stderr.write(`[MCP Server Error] ${error}\n`);
        };

        // Handle process termination
        process.on("SIGINT", async () => {
            process.stderr.write("Shutting down server...\n");
            await server.close();
            process.exit(0);
        });

        // Register tool list handler
        server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: hubspotTools
            };
        });

        // Register tool call handler
        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                const toolName = request.params.name;
                const handler = toolHandlers[toolName];

                if (!handler) {
                    throw new McpError(
                        ErrorCode.MethodNotFound,
                        `Unknown tool: ${toolName}`
                    );
                }

                // Execute the tool handler with the provided arguments
                const result = await handler(request.params.arguments);

                // Return the result
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            } catch (error) {
                process.stderr.write(`Error handling tool call: ${error}\n`);

                // If it's already an MCP error, rethrow it
                if (error instanceof McpError) {
                    throw error;
                }

                // Otherwise, wrap it in an MCP error
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${error instanceof Error ? error.message : String(error)}`
                        }
                    ],
                    isError: true
                };
            }
        });

        // Connect to transport
        const transport = new StdioServerTransport();
        await server.connect(transport);

        process.stderr.write("Hubspot MCP Server running on stdio\n");
    } catch (error) {
        process.stderr.write(`Failed to start server: ${error}\n`);
        process.exit(1);
    }
}

// Start the server
main().catch(console.error);
