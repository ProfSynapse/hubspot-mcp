#!/usr/bin/env node

/**
 * HubSpot BCP Server Entry Point
 * 
 * This is the main entry point for the HubSpot BCP Server.
 * It creates and starts the server with the BCP architecture.
 */

import { createServer } from './core/server.js';

/**
 * Main function to start the server
 */
async function main(): Promise<void> {
  try {
    // Get HubSpot API key from environment
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN;
    
    if (!apiKey) {
      console.error('Error: HUBSPOT_ACCESS_TOKEN environment variable is required');
      process.exit(1);
    }
    
    // Create and start the server
    const server = await createServer(apiKey);
    
    // Use stderr for logging to avoid interfering with the JSON-RPC protocol
    console.error('HubSpot BCP Server is running');
    console.error('Available tools:');
    console.error('- hubspotCompany: Company operations (create, get, update, delete, search, recent)');
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.error('Shutting down server...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.error('Shutting down server...');
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
