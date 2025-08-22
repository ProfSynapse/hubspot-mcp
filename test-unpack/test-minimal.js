#!/usr/bin/env node

// Minimal test to isolate the DXT crash issue
console.error('TEST: Starting minimal test...');
console.error('TEST: Node version:', process.version);
console.error('TEST: Environment variables:', Object.keys(process.env).length);

// Test 1: Basic functionality
console.error('TEST: Basic console.error works');

// Test 2: Environment variables
console.error('TEST: HUBSPOT_ACCESS_TOKEN present:', !!process.env.HUBSPOT_ACCESS_TOKEN);

// Test 3: Try importing MCP SDK
try {
  console.error('TEST: Attempting to import MCP SDK...');
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  console.error('TEST: MCP SDK imported successfully');
  
  // Test 4: Try creating a simple server
  const server = new McpServer({
    name: 'test-server',
    version: '0.1.0',
    description: 'Minimal test server'
  });
  console.error('TEST: MCP Server created successfully');
  
} catch (error) {
  console.error('TEST: Failed to import or create MCP server:', error.message);
  console.error('TEST: Error stack:', error.stack);
}

// Test 5: Keep alive for a moment
setTimeout(() => {
  console.error('TEST: Test completed successfully');
  process.exit(0);
}, 1000);