#!/usr/bin/env node

/**
 * Standalone Dashboard Server Entry Point
 * Location: src/dashboard-server.ts
 * 
 * This is a standalone entry point for running the analytics dashboard server
 * independently from the main MCP server. It's useful for development, testing,
 * or when you want to run the dashboard on a separate instance.
 * 
 * Usage:
 *   npm run build && node build/dashboard-server.js
 *   tsx src/dashboard-server.ts
 */

import { createDashboardServer, DashboardConfig } from './dashboard/index.js';

/**
 * Load configuration from environment variables
 */
function loadConfig(): Partial<DashboardConfig> {
  return {
    port: parseInt(process.env.DASHBOARD_PORT || process.env.PORT || '3001'),
    host: process.env.DASHBOARD_HOST || process.env.HOST || '0.0.0.0',
    sessionSecret: process.env.SESSION_SECRET,
    corsOrigin: process.env.CORS_ORIGIN?.split(',') || process.env.CORS_ORIGINS?.split(','),
    secure: process.env.FORCE_HTTPS === 'true' || process.env.NODE_ENV === 'production',
    environment: (process.env.NODE_ENV as any) || 'development'
  };
}

/**
 * Main function to start the dashboard server
 */
async function main(): Promise<void> {
  try {
    console.log('🚀 Starting HubSpot MCP Analytics Dashboard Server...');

    // Check required environment variables
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL environment variable is required');
      process.exit(1);
    }

    // Load configuration
    const config = loadConfig();
    
    // Create and start dashboard server
    const dashboardServer = createDashboardServer(config);
    
    await dashboardServer.start();

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, starting graceful shutdown...');
      try {
        await dashboardServer.stop();
        console.log('Dashboard server stopped gracefully');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    process.on('SIGINT', async () => {
      console.log('Received SIGINT, starting graceful shutdown...');
      try {
        await dashboardServer.stop();
        console.log('Dashboard server stopped gracefully');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start dashboard server:', error);
    process.exit(1);
  }
}

// Run the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Startup error:', error);
    process.exit(1);
  });
}

export { main };