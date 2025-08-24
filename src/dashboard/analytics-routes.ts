/**
 * Dashboard Analytics API Routes
 * Location: src/dashboard/analytics-routes.ts
 * 
 * This module defines the Express routes for serving analytics data to the dashboard
 * frontend. It provides endpoints for usage statistics, error logs, performance metrics,
 * and other analytics data consumed by the dashboard UI components.
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { analyticsService, AnalyticsResponse } from '../analytics/analytics-service.js';
import { DashboardSessionService } from './session-service.js';

// Query parameter validation schemas
const DashboardQuerySchema = z.object({
  days: z.string().optional().transform(val => {
    if (!val) return 7;
    const parsed = parseInt(val);
    return isNaN(parsed) ? 7 : Math.min(Math.max(parsed, 1), 90); // 1-90 days
  }),
  limit: z.string().optional().transform(val => {
    if (!val) return 50;
    const parsed = parseInt(val);
    return isNaN(parsed) ? 50 : Math.min(Math.max(parsed, 1), 200); // 1-200 items
  }),
  interval: z.string().optional().transform(val => {
    if (!val) return 1;
    const parsed = parseInt(val);
    return isNaN(parsed) ? 1 : Math.min(Math.max(parsed, 1), 24); // 1-24 hours
  })
});

// API Response interfaces
interface DashboardStatsResponse {
  success: boolean;
  data: AnalyticsResponse;
  metadata: {
    generatedAt: string;
    queryParams: {
      days: number;
    };
  };
}

interface ErrorLogResponse {
  success: boolean;
  data: {
    errors: Array<{
      id: number;
      tool_name: string;
      operation: string | null;
      error_message: string;
      error_code: string;
      params: any;
      timestamp: Date;
    }>;
    total: number;
  };
  metadata: {
    generatedAt: string;
    queryParams: {
      days: number;
      limit: number;
    };
  };
}

interface PerformanceMetricsResponse {
  success: boolean;
  data: Array<{
    time_bucket: Date;
    call_count: number;
    error_count: number;
    avg_response_time: number;
    error_rate: number;
  }>;
  metadata: {
    generatedAt: string;
    queryParams: {
      days: number;
      intervalHours: number;
    };
  };
}

interface HealthResponse {
  success: boolean;
  data: {
    analytics: {
      status: string;
      message: string;
      timestamp: Date;
    };
    database: {
      connected: boolean;
      lastCheck: Date;
    };
    summary: {
      totalCalls: number;
      errorRate: string;
      avgResponseTime: number;
    };
  };
}

/**
 * Create analytics API routes
 */
export function createAnalyticsRoutes(sessionService: DashboardSessionService): express.Router {
  const router = express.Router();

  // Add JSON parsing middleware
  router.use(express.json({ limit: '1mb' }));

  /**
   * GET /api/analytics - Get complete dashboard analytics data
   */
  router.get('/analytics', async (req: Request, res: Response) => {
    try {
      const queryValidation = DashboardQuerySchema.safeParse(req.query);
      
      if (!queryValidation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: queryValidation.error.errors
        });
      }

      const { days } = queryValidation.data;
      
      console.log(`[Dashboard API] Fetching analytics data for ${days} days`);

      // Get analytics data from service
      const analyticsData = await analyticsService.getAnalyticsData(days);

      const response: DashboardStatsResponse = {
        success: true,
        data: analyticsData,
        metadata: {
          generatedAt: new Date().toISOString(),
          queryParams: { days }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('[Dashboard API] Analytics endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/analytics/errors - Get detailed error logs
   */
  router.get('/analytics/errors', async (req: Request, res: Response) => {
    try {
      const queryValidation = DashboardQuerySchema.safeParse(req.query);
      
      if (!queryValidation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: queryValidation.error.errors
        });
      }

      const { days, limit } = queryValidation.data;

      console.log(`[Dashboard API] Fetching error logs: ${limit} items for ${days} days`);

      // Get recent errors
      const errors = await analyticsService.getRecentErrors(limit, days);

      const response: ErrorLogResponse = {
        success: true,
        data: {
          errors,
          total: errors.length
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          queryParams: { days, limit }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('[Dashboard API] Errors endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch error logs',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/analytics/performance - Get performance metrics over time
   */
  router.get('/analytics/performance', async (req: Request, res: Response) => {
    try {
      const queryValidation = DashboardQuerySchema.safeParse(req.query);
      
      if (!queryValidation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: queryValidation.error.errors
        });
      }

      const { days, interval } = queryValidation.data;

      console.log(`[Dashboard API] Fetching performance metrics: ${days} days, ${interval}h intervals`);

      // Get performance metrics
      const metrics = await analyticsService.getPerformanceMetrics(days, interval);

      // Calculate error rates
      const enhancedMetrics = metrics.map(metric => ({
        ...metric,
        error_rate: metric.call_count > 0 
          ? parseFloat(((metric.error_count / metric.call_count) * 100).toFixed(2))
          : 0
      }));

      const response: PerformanceMetricsResponse = {
        success: true,
        data: enhancedMetrics,
        metadata: {
          generatedAt: new Date().toISOString(),
          queryParams: { 
            days, 
            intervalHours: interval 
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('[Dashboard API] Performance endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch performance metrics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/analytics/usage/:toolName - Get usage stats for specific tool
   */
  router.get('/analytics/usage/:toolName', async (req: Request, res: Response) => {
    try {
      const { toolName } = req.params;
      const queryValidation = DashboardQuerySchema.safeParse(req.query);
      
      if (!queryValidation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: queryValidation.error.errors
        });
      }

      const { days } = queryValidation.data;

      console.log(`[Dashboard API] Fetching usage stats for tool: ${toolName}, ${days} days`);

      // Get usage stats and filter for specific tool
      const allUsageStats = await analyticsService.getUsageStats(days);
      const toolStats = allUsageStats.filter(stat => stat.tool_name === toolName);

      res.json({
        success: true,
        data: {
          tool: toolName,
          statistics: toolStats,
          total_calls: toolStats.reduce((sum, stat) => sum + stat.call_count, 0),
          avg_response_time: toolStats.length > 0 
            ? Math.round(toolStats.reduce((sum, stat) => sum + stat.avg_response_time, 0) / toolStats.length)
            : 0
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          queryParams: { days, toolName }
        }
      });

    } catch (error) {
      console.error('[Dashboard API] Tool usage endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tool usage stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/analytics/health - Get health status of analytics system
   */
  router.get('/analytics/health', async (req: Request, res: Response) => {
    try {
      console.log('[Dashboard API] Health check requested');

      // Check analytics service health
      const analyticsHealth = await analyticsService.healthCheck();
      
      // Get summary stats for health overview
      const summaryStats = await analyticsService.getSummaryStats(1); // Last 24 hours

      const response: HealthResponse = {
        success: true,
        data: {
          analytics: analyticsHealth,
          database: {
            connected: analyticsHealth.status === 'healthy',
            lastCheck: analyticsHealth.timestamp
          },
          summary: summaryStats
        }
      };

      res.json(response);

    } catch (error) {
      console.error('[Dashboard API] Health endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/analytics/cleanup - Trigger cleanup of old analytics data
   */
  router.post('/analytics/cleanup', async (req: Request, res: Response) => {
    try {
      // Parse days to keep from request body
      const daysToKeep = req.body.daysToKeep || 90;
      
      if (typeof daysToKeep !== 'number' || daysToKeep < 30 || daysToKeep > 365) {
        return res.status(400).json({
          success: false,
          message: 'daysToKeep must be a number between 30 and 365'
        });
      }

      console.log(`[Dashboard API] Cleaning up analytics data older than ${daysToKeep} days`);

      const cleanupResult = await analyticsService.cleanupOldData(daysToKeep);

      res.json({
        success: true,
        message: 'Cleanup completed successfully',
        data: {
          toolCallsDeleted: cleanupResult.toolCallsDeleted,
          errorsDeleted: cleanupResult.errorsDeleted,
          daysToKeep
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[Dashboard API] Cleanup endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Cleanup operation failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

export type { 
  DashboardStatsResponse, 
  ErrorLogResponse, 
  PerformanceMetricsResponse, 
  HealthResponse 
};