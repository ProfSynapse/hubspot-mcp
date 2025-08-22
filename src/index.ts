#!/usr/bin/env node

/**
 * HubSpot BCP Server Entry Point
 * 
 * This is the main entry point for the HubSpot BCP Server.
 * It creates and starts the server with the BCP architecture.
 */

// File logging for DXT debugging since stderr is suppressed
import { appendFileSync } from 'fs';

function debugLog(message: string) {
  try {
    const logLine = `${new Date().toISOString()} ${message}\n`;
    appendFileSync('debug.log', logLine);
  } catch (e) {
    // Fallback to stderr if file logging fails
    console.error('[HUBSPOT-MCP]', message);
  }
}

debugLog('=== STARTING HUBSPOT MCP EXTENSION ===');
debugLog(`Node version: ${process.version}`);
debugLog(`Current directory: ${process.cwd()}`);
debugLog(`Script location: ${import.meta.url}`);

debugLog('Attempting to import createServer...');
try {
  var { createServer } = await import('./core/server.js');
  debugLog('✅ createServer imported successfully');
} catch (error) {
  debugLog(`💥 Failed to import createServer: ${error instanceof Error ? error.message : String(error)}`);
  debugLog(`💥 Stack: ${error instanceof Error ? error.stack : 'No stack'}`);
  process.exit(1);
}

// Log after imports to check if module loading is the issue
console.error('[HUBSPOT-MCP] Modules loaded successfully');

/**
 * Main function to start the server
 */
async function main(): Promise<void> {
  debugLog('Main function called');
  
  try {
    debugLog('Getting API key from environment...');
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || process.env.hubspot_access_token || '';
    debugLog(`API Key present: ${!!apiKey}`);
    debugLog(`Environment variables count: ${Object.keys(process.env).length}`);
    
    debugLog('Creating server...');
    const server = await createServer(apiKey);
    debugLog('✅ Server created successfully');
    
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
    debugLog(`💥 Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
    debugLog(`💥 Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    process.exit(1);
  }
}

// Add global error handlers
process.on('uncaughtException', (error) => {
  debugLog(`💥 Uncaught Exception: ${error.message}`);
  debugLog(`💥 Stack: ${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  debugLog(`💥 Unhandled Rejection: ${reason}`);
  debugLog(`💥 Promise: ${promise}`);
  process.exit(1);
});

// Start the server
debugLog('Calling main function...');
main().catch(error => {
  debugLog(`💥 Unhandled error in main: ${error instanceof Error ? error.message : String(error)}`);
  debugLog(`💥 Stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
  process.exit(1);
});
