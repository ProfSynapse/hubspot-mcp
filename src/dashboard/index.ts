/**
 * Dashboard Module Index
 * Location: src/dashboard/index.ts
 * 
 * This module exports all dashboard-related functionality including
 * authentication services, session management, API routes, middleware,
 * and the main dashboard server. This provides a clean interface for
 * integrating dashboard functionality into the main application.
 */

// Services
export { DashboardAuthService, dashboardAuthService } from './auth-service.js';
export { 
  DashboardSessionService, 
  createSessionService,
  type SessionConfig,
  type SessionUser 
} from './session-service.js';

// Routes
export { 
  createAuthRoutes, 
  requireAuth,
  type LoginResponse,
  type LogoutResponse,
  type SessionStatusResponse 
} from './auth-routes.js';

export { 
  createAnalyticsRoutes,
  type DashboardStatsResponse,
  type ErrorLogResponse,
  type PerformanceMetricsResponse,
  type HealthResponse 
} from './analytics-routes.js';

// Middleware
export { 
  createDashboardMiddleware,
  requireDashboardAuth,
  optionalDashboardAuth,
  createDashboardRateLimit,
  dashboardSecurityHeaders,
  validateDashboardRequest,
  dashboardErrorHandler,
  dashboardRequestLogger,
  sessionActivityTracker
} from './middleware.js';

// Main server
export { 
  DashboardServer, 
  createDashboardServer,
  type DashboardConfig 
} from './dashboard-server.js';

// Re-export types from analytics service for convenience
export type { 
  AnalyticsResponse,
  ToolUsageStats,
  ErrorStats,
  SummaryStats
} from '../analytics/analytics-service.js';