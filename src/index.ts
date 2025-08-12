#!/usr/bin/env node

/**
 * HubSpot BCP Server Entry Point
 * 
 * This is the main entry point for the HubSpot BCP Server.
 * It creates and starts the server with the BCP architecture.
 */

// Log to stderr immediately to debug startup issues
console.error('[HUBSPOT-MCP] Starting HubSpot MCP Extension...');
console.error('[HUBSPOT-MCP] Node version:', process.version);
console.error('[HUBSPOT-MCP] Current directory:', process.cwd());
console.error('[HUBSPOT-MCP] Script location:', import.meta.url);

import { createServer } from './core/server.js';

// Log after imports to check if module loading is the issue
console.error('[HUBSPOT-MCP] Modules loaded successfully');

/**
 * Main function to start the server
 */
async function main(): Promise<void> {
  console.error('[HUBSPOT-MCP] Main function called');
  
  try {
    // Get HubSpot API key from environment
    // For DXT extensions, Claude Desktop will set this from user config
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || process.env.hubspot_access_token || '';
    console.error('[HUBSPOT-MCP] API Key present:', !!apiKey);
    console.error('[HUBSPOT-MCP] Environment variables:', Object.keys(process.env).join(', '));
    
    // Create and start the server (it will handle missing token gracefully)
    console.error('[HUBSPOT-MCP] Creating server...');
    const server = await createServer(apiKey);
    console.error('[HUBSPOT-MCP] Server created successfully');
    
    // Use stderr for logging to avoid interfering with the JSON-RPC protocol
    console.error('HubSpot DXT Extension is running');
    console.error('Available tools:');
    console.error('- hubspotCompany: Company operations (create, get, update, delete, search, recent)');
    console.error('- hubspotContact: Contact operations (create, get, update, delete, search, recent)');
    console.error('- hubspotDeal: Deal operations (create, get, update, delete, search, recent, batch)');
    console.error('- hubspotNote: Note operations (create, get, update, delete, list, recent, associations)');
    console.error('- hubspotBlogPost: Blog post operations (create, get, update, delete, list, recent)');
    console.error('- hubspotQuote: Quote operations (create, get, update, delete, search, recent, line items)');
    console.error('- hubspotProduct: Product operations (get, list, search)');
    console.error('- hubspotAssociation: Association operations (create, read, delete relationships)');
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.error('Shutting down server...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.error('Shutting down server...');
      process.exit(0);
    });
    
    console.error('[HUBSPOT-MCP] Server startup complete');
  } catch (error) {
    console.error('[HUBSPOT-MCP] Failed to start server:', error);
    console.error('[HUBSPOT-MCP] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    process.exit(1);
  }
}

// Add global error handlers
process.on('uncaughtException', (error) => {
  console.error('[HUBSPOT-MCP] Uncaught Exception:', error);
  console.error('[HUBSPOT-MCP] Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[HUBSPOT-MCP] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
console.error('[HUBSPOT-MCP] Calling main function...');
main().catch(error => {
  console.error('[HUBSPOT-MCP] Unhandled error in main:', error);
  console.error('[HUBSPOT-MCP] Stack:', error instanceof Error ? error.stack : 'No stack trace');
  process.exit(1);
});
