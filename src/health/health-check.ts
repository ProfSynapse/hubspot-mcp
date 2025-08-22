/**
 * Health Check System
 * Location: src/health/health-check.ts
 * 
 * This module provides comprehensive health monitoring for the HTTP MCP server,
 * including dependency checks, system metrics, and Railway-compatible health endpoints.
 * Used by load balancers and monitoring systems to determine server health.
 */

import { Request, Response } from 'express';
import { HubspotApiClient } from '../core/hubspot-client.js';
import { SessionManager } from '../core/session-manager.js';
import { metricsCollector } from '../utils/metrics.js';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  sessions: {
    total: number;
    active: number;
    idle: number;
  };
  dependencies: {
    hubspot: DependencyHealth;
    auth?: DependencyHealth;
  };
  metrics: {
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
  };
}

interface DependencyHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  lastChecked: string;
}

export class HealthChecker {
  constructor(
    private hubspotClient?: HubspotApiClient,
    private sessionManager?: SessionManager
  ) {}
  
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    const [hubspotHealth] = await Promise.allSettled([
      this.checkHubSpotHealth()
    ]);
    
    const memory = process.memoryUsage();
    const sessionStats = this.sessionManager?.getStats() || { total: 0, byState: {} };
    const metrics = metricsCollector.getMetrics();
    
    const overallStatus = this.determineOverallStatus([
      hubspotHealth.status === 'fulfilled' ? hubspotHealth.value : { status: 'unhealthy' as const }
    ]);
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used: memory.heapUsed,
        free: memory.heapTotal - memory.heapUsed,
        total: memory.heapTotal,
        percentage: Math.round((memory.heapUsed / memory.heapTotal) * 100)
      },
      sessions: {
        total: sessionStats.total,
        active: sessionStats.byState?.active || 0,
        idle: sessionStats.byState?.idle || 0
      },
      dependencies: {
        hubspot: hubspotHealth.status === 'fulfilled' ? hubspotHealth.value : {
          status: 'unhealthy',
          error: hubspotHealth.reason?.message || 'Unknown error',
          lastChecked: new Date().toISOString()
        }
      },
      metrics: {
        requestCount: metrics.httpRequests.total,
        errorCount: metrics.errors.total,
        averageResponseTime: metrics.performance.averageResponseTime
      }
    };
  }
  
  private async checkHubSpotHealth(): Promise<DependencyHealth> {
    const startTime = Date.now();
    
    try {
      if (!this.hubspotClient) {
        return {
          status: 'degraded',
          error: 'HubSpot client not configured',
          lastChecked: new Date().toISOString()
        };
      }
      
      // Test HubSpot API connectivity with a lightweight request
      await this.hubspotClient.testConnection();
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      };
    }
  }
  
  private determineOverallStatus(dependencies: Array<{ status: string }>): 'healthy' | 'unhealthy' | 'degraded' {
    const unhealthyCount = dependencies.filter(d => d.status === 'unhealthy').length;
    const degradedCount = dependencies.filter(d => d.status === 'degraded').length;
    
    // Check system resources
    const memory = process.memoryUsage();
    const memoryUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
    
    if (unhealthyCount > 0 || memoryUsagePercent > 90) {
      return 'unhealthy';
    } else if (degradedCount > 0 || memoryUsagePercent > 80) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }
}

// Health check endpoint handler
export const createHealthCheckHandler = (healthChecker: HealthChecker) => {
  return async (req: Request, res: Response) => {
    try {
      const health = await healthChecker.performHealthCheck();
      
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed'
      });
    }
  };
};

// Railway health check (simplified)
export const railwayHealthCheck = (req: Request, res: Response) => {
  // Railway expects a simple 200 response for healthy status
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  
  // Basic health indicators
  const isHealthy = (
    uptime > 5 &&                           // Server has been running for at least 5 seconds
    memory.heapUsed < memory.heapTotal * 0.9 // Memory usage below 90%
  );
  
  if (isHealthy) {
    res.status(200).json({
      status: 'healthy',
      uptime: Math.floor(uptime),
      memory: Math.round((memory.heapUsed / memory.heapTotal) * 100)
    });
  } else {
    res.status(503).json({
      status: 'unhealthy',
      uptime: Math.floor(uptime),
      memory: Math.round((memory.heapUsed / memory.heapTotal) * 100)
    });
  }
};

// Readiness check (for Kubernetes/container orchestration)
export const readinessCheck = (sessionManager?: SessionManager) => {
  return (req: Request, res: Response) => {
    try {
      // Check if the server is ready to handle requests
      const memory = process.memoryUsage();
      const memoryUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
      
      const isReady = (
        process.uptime() > 1 &&               // Server has been up for at least 1 second
        memoryUsagePercent < 95 &&            // Memory usage is reasonable
        (!sessionManager || sessionManager.getStats().total < 1000) // Not overwhelmed with sessions
      );
      
      if (isReady) {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          reason: memoryUsagePercent >= 95 ? 'high_memory_usage' : 'server_overloaded'
        });
      }
    } catch (error) {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Readiness check failed'
      });
    }
  };
};

// Liveness check (for Kubernetes/container orchestration)
export const livenessCheck = (req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};