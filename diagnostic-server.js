#!/usr/bin/env node

// ULTRA-DIAGNOSTIC MCP SERVER
// This will log every single step to identify exactly where it fails

console.error('🚀 DIAG: === STARTING DIAGNOSTIC SERVER ===');
console.error('🚀 DIAG: Script file loaded successfully');
console.error('🚀 DIAG: Node version:', process.version);
console.error('🚀 DIAG: Platform:', process.platform);
console.error('🚀 DIAG: Architecture:', process.arch);
console.error('🚀 DIAG: Process PID:', process.pid);
console.error('🚀 DIAG: Current working directory:', process.cwd());
console.error('🚀 DIAG: Script location:', import.meta.url);
console.error('🚀 DIAG: Command line args:', process.argv);

// Environment variables
console.error('🔧 DIAG: Environment variables count:', Object.keys(process.env).length);
console.error('🔧 DIAG: NODE_ENV:', process.env.NODE_ENV || 'undefined');
console.error('🔧 DIAG: DEBUG:', process.env.DEBUG || 'undefined');
console.error('🔧 DIAG: HUBSPOT_ACCESS_TOKEN present:', !!process.env.HUBSPOT_ACCESS_TOKEN);

// Memory info
if (process.memoryUsage) {
  const memory = process.memoryUsage();
  console.error('📊 DIAG: Memory - RSS:', memory.rss, 'Heap Used:', memory.heapUsed);
}

// Global error handlers FIRST
process.on('uncaughtException', (error) => {
  console.error('💥 DIAG: UNCAUGHT EXCEPTION:', error.message);
  console.error('💥 DIAG: Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 DIAG: UNHANDLED REJECTION at:', promise);
  console.error('💥 DIAG: Reason:', reason);
  process.exit(1);
});

// Test basic functionality
console.error('⏰ DIAG: Setting up timeout test...');
const timeoutId = setTimeout(() => {
  console.error('⏰ DIAG: 5-second timeout reached - process is alive');
}, 5000);

// Test async functionality
console.error('🔄 DIAG: Testing async functionality...');
(async () => {
  console.error('🔄 DIAG: Inside async function');
  
  try {
    console.error('📦 DIAG: Attempting to import MCP SDK...');
    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    console.error('✅ DIAG: MCP SDK imported successfully');
    
    console.error('🏗️ DIAG: Creating MCP server instance...');
    const server = new McpServer({
      name: 'diagnostic-server',
      version: '0.1.0',
      description: 'Ultra-diagnostic MCP server'
    });
    console.error('✅ DIAG: MCP server instance created');
    
    console.error('🔌 DIAG: Attempting to import StdioServerTransport...');
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    console.error('✅ DIAG: StdioServerTransport imported');
    
    console.error('🚇 DIAG: Creating transport...');
    const transport = new StdioServerTransport();
    console.error('✅ DIAG: Transport created');
    
    // Add a simple tool
    console.error('🛠️ DIAG: Adding diagnostic tool...');
    server.tool('diagnostic', {}, () => {
      console.error('🛠️ DIAG: Diagnostic tool called');
      return {
        content: [{ type: 'text', text: 'Diagnostic tool working!' }]
      };
    });
    console.error('✅ DIAG: Tool added');
    
    console.error('🔗 DIAG: Attempting to connect server to transport...');
    await server.connect(transport);
    console.error('✅ DIAG: Server connected to transport successfully');
    
    console.error('🎉 DIAG: === SERVER FULLY OPERATIONAL ===');
    
    // Clear the timeout since we succeeded
    clearTimeout(timeoutId);
    
  } catch (error) {
    console.error('💥 DIAG: ERROR in async function:', error.message);
    console.error('💥 DIAG: Error stack:', error.stack);
    console.error('💥 DIAG: Error name:', error.name);
    console.error('💥 DIAG: Error code:', error.code);
    
    // Clear timeout and exit
    clearTimeout(timeoutId);
    process.exit(1);
  }
})();

console.error('🏁 DIAG: Main script execution complete, waiting for async operations...');