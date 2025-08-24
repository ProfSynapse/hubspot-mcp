/**
 * Analytics module for HubSpot MCP server
 * 
 * This module provides:
 * - Database connection pooling
 * - Tool call and error logging
 * - Performance metrics tracking
 * - Middleware for transparent analytics integration
 */

export { default as database, pool } from './database.js';
export { 
  AnalyticsService, 
  analyticsService,
  type ToolUsageStats,
  type ErrorStats,
  type SummaryStats,
  type AnalyticsResponse
} from './analytics-service.js';
export { 
  withAnalytics,
  wrapToolHandlers,
  createAnalyticsToolFactory,
  isAnalyticsEnabled,
  withConditionalAnalytics
} from './middleware.js';