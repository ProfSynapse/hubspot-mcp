/**
 * Metrics Collection System
 * Location: src/utils/metrics.ts
 * 
 * This module provides comprehensive metrics collection for the HTTP MCP server,
 * including request tracking, performance monitoring, session metrics, and
 * HubSpot API call statistics. Outputs in Prometheus format for monitoring.
 */

import { Request, Response, NextFunction } from 'express';

interface MetricsData {
  httpRequests: {
    total: number;
    byStatus: Record<number, number>;
    byMethod: Record<string, number>;
  };
  mcpRequests: {
    total: number;
    byMethod: Record<string, number>;
    errors: number;
  };
  sessions: {
    created: number;
    terminated: number;
    active: number;
  };
  hubspot: {
    apiCalls: number;
    errors: number;
    rateLimitHits: number;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    byStatusCode: Record<number, number>;
  };
}

class MetricsCollector {
  private metrics: MetricsData = {
    httpRequests: { total: 0, byStatus: {}, byMethod: {} },
    mcpRequests: { total: 0, byMethod: {}, errors: 0 },
    sessions: { created: 0, terminated: 0, active: 0 },
    hubspot: { apiCalls: 0, errors: 0, rateLimitHits: 0 },
    performance: { averageResponseTime: 0, p95ResponseTime: 0, memoryUsage: 0, cpuUsage: 0 },
    errors: { total: 0, byType: {}, byStatusCode: {} }
  };
  
  private responseTimes: number[] = [];
  private maxResponseTimeSamples = 1000;
  
  incrementHttpRequest(method: string, statusCode: number): void {
    this.metrics.httpRequests.total++;
    this.metrics.httpRequests.byMethod[method] = (this.metrics.httpRequests.byMethod[method] || 0) + 1;
    this.metrics.httpRequests.byStatus[statusCode] = (this.metrics.httpRequests.byStatus[statusCode] || 0) + 1;
  }
  
  incrementMCPRequest(method: string, isError = false): void {
    this.metrics.mcpRequests.total++;
    this.metrics.mcpRequests.byMethod[method] = (this.metrics.mcpRequests.byMethod[method] || 0) + 1;
    
    if (isError) {
      this.metrics.mcpRequests.errors++;
    }
  }
  
  recordResponseTime(duration: number): void {
    this.responseTimes.push(duration);
    
    // Keep only last N measurements for p95 calculation
    if (this.responseTimes.length > this.maxResponseTimeSamples) {
      this.responseTimes = this.responseTimes.slice(-this.maxResponseTimeSamples);
    }
    
    // Update average
    this.metrics.performance.averageResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    
    // Update p95
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    this.metrics.performance.p95ResponseTime = sorted[p95Index] || 0;
  }
  
  recordError(errorType: string, statusCode?: number): void {
    this.metrics.errors.total++;
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
    
    if (statusCode) {
      this.metrics.errors.byStatusCode[statusCode] = (this.metrics.errors.byStatusCode[statusCode] || 0) + 1;
    }
  }
  
  updateSystemMetrics(): void {
    const memory = process.memoryUsage();
    this.metrics.performance.memoryUsage = memory.heapUsed;
    
    // CPU usage would require additional monitoring
    // For now, we'll track it via external monitoring
  }
  
  incrementHubSpotCall(isError = false, isRateLimit = false): void {
    this.metrics.hubspot.apiCalls++;
    
    if (isError) {
      this.metrics.hubspot.errors++;
    }
    
    if (isRateLimit) {
      this.metrics.hubspot.rateLimitHits++;
    }
  }
  
  updateSessionCount(active: number): void {
    this.metrics.sessions.active = active;
  }
  
  incrementSessionCreated(): void {
    this.metrics.sessions.created++;
  }
  
  incrementSessionTerminated(): void {
    this.metrics.sessions.terminated++;
  }
  
  getMetrics(): MetricsData {
    this.updateSystemMetrics();
    return JSON.parse(JSON.stringify(this.metrics)); // Deep clone
  }
  
  getCounter(name: string): number {
    switch (name) {
      case 'http_requests_total':
        return this.metrics.httpRequests.total;
      case 'mcp_requests_total':
        return this.metrics.mcpRequests.total;
      case 'mcp_errors_total':
        return this.metrics.mcpRequests.errors;
      case 'hubspot_api_calls_total':
        return this.metrics.hubspot.apiCalls;
      case 'hubspot_errors_total':
        return this.metrics.hubspot.errors;
      case 'sessions_created_total':
        return this.metrics.sessions.created;
      case 'sessions_terminated_total':
        return this.metrics.sessions.terminated;
      case 'errors_total':
        return this.metrics.errors.total;
      default:
        return 0;
    }
  }
  
  getHistogram(name: string, bucket: number): number {
    if (name === 'response_duration' && this.responseTimes.length > 0) {
      return this.responseTimes.filter(time => time <= bucket * 1000).length;
    }
    return 0;
  }
  
  getGauge(name: string): number {
    switch (name) {
      case 'sessions_active':
        return this.metrics.sessions.active;
      case 'memory_usage_bytes':
        return this.metrics.performance.memoryUsage;
      case 'response_time_avg_ms':
        return this.metrics.performance.averageResponseTime;
      case 'response_time_p95_ms':
        return this.metrics.performance.p95ResponseTime;
      default:
        return 0;
    }
  }
  
  // Prometheus format for metrics endpoint
  toPrometheusFormat(): string {
    const metrics = this.getMetrics();
    const timestamp = Date.now();
    
    return `
# HELP mcp_http_requests_total Total number of HTTP requests
# TYPE mcp_http_requests_total counter
mcp_http_requests_total ${metrics.httpRequests.total} ${timestamp}

# HELP mcp_http_requests_by_method HTTP requests by method
# TYPE mcp_http_requests_by_method counter
${Object.entries(metrics.httpRequests.byMethod)
  .map(([method, count]) => `mcp_http_requests_by_method{method="${method}"} ${count} ${timestamp}`)
  .join('\n')}

# HELP mcp_http_requests_by_status HTTP requests by status code
# TYPE mcp_http_requests_by_status counter
${Object.entries(metrics.httpRequests.byStatus)
  .map(([status, count]) => `mcp_http_requests_by_status{status="${status}"} ${count} ${timestamp}`)
  .join('\n')}

# HELP mcp_requests_total Total number of MCP requests
# TYPE mcp_requests_total counter
mcp_requests_total ${metrics.mcpRequests.total} ${timestamp}

# HELP mcp_requests_by_method MCP requests by method
# TYPE mcp_requests_by_method counter
${Object.entries(metrics.mcpRequests.byMethod)
  .map(([method, count]) => `mcp_requests_by_method{method="${method}"} ${count} ${timestamp}`)
  .join('\n')}

# HELP mcp_request_errors_total Total number of MCP request errors
# TYPE mcp_request_errors_total counter
mcp_request_errors_total ${metrics.mcpRequests.errors} ${timestamp}

# HELP mcp_http_request_duration_seconds HTTP request duration in seconds
# TYPE mcp_http_request_duration_seconds histogram
mcp_http_request_duration_seconds_bucket{le="0.1"} ${this.getHistogram('response_duration', 0.1)} ${timestamp}
mcp_http_request_duration_seconds_bucket{le="0.5"} ${this.getHistogram('response_duration', 0.5)} ${timestamp}
mcp_http_request_duration_seconds_bucket{le="1.0"} ${this.getHistogram('response_duration', 1.0)} ${timestamp}
mcp_http_request_duration_seconds_bucket{le="2.0"} ${this.getHistogram('response_duration', 2.0)} ${timestamp}
mcp_http_request_duration_seconds_bucket{le="5.0"} ${this.getHistogram('response_duration', 5.0)} ${timestamp}
mcp_http_request_duration_seconds_bucket{le="+Inf"} ${this.responseTimes.length} ${timestamp}

# HELP mcp_sessions_active Number of active MCP sessions
# TYPE mcp_sessions_active gauge
mcp_sessions_active ${metrics.sessions.active} ${timestamp}

# HELP mcp_sessions_created_total Total number of sessions created
# TYPE mcp_sessions_created_total counter
mcp_sessions_created_total ${metrics.sessions.created} ${timestamp}

# HELP mcp_sessions_terminated_total Total number of sessions terminated
# TYPE mcp_sessions_terminated_total counter
mcp_sessions_terminated_total ${metrics.sessions.terminated} ${timestamp}

# HELP mcp_hubspot_api_calls_total Total number of HubSpot API calls
# TYPE mcp_hubspot_api_calls_total counter
mcp_hubspot_api_calls_total ${metrics.hubspot.apiCalls} ${timestamp}

# HELP mcp_hubspot_errors_total Total number of HubSpot API errors
# TYPE mcp_hubspot_errors_total counter
mcp_hubspot_errors_total ${metrics.hubspot.errors} ${timestamp}

# HELP mcp_hubspot_rate_limit_hits_total Total number of HubSpot rate limit hits
# TYPE mcp_hubspot_rate_limit_hits_total counter
mcp_hubspot_rate_limit_hits_total ${metrics.hubspot.rateLimitHits} ${timestamp}

# HELP mcp_memory_usage_bytes Current memory usage in bytes
# TYPE mcp_memory_usage_bytes gauge
mcp_memory_usage_bytes ${metrics.performance.memoryUsage} ${timestamp}

# HELP mcp_response_time_avg_ms Average response time in milliseconds
# TYPE mcp_response_time_avg_ms gauge
mcp_response_time_avg_ms ${metrics.performance.averageResponseTime} ${timestamp}

# HELP mcp_response_time_p95_ms 95th percentile response time in milliseconds
# TYPE mcp_response_time_p95_ms gauge
mcp_response_time_p95_ms ${metrics.performance.p95ResponseTime} ${timestamp}

# HELP mcp_errors_total Total number of errors
# TYPE mcp_errors_total counter
mcp_errors_total ${metrics.errors.total} ${timestamp}

# HELP mcp_errors_by_type Errors by type
# TYPE mcp_errors_by_type counter
${Object.entries(metrics.errors.byType)
  .map(([type, count]) => `mcp_errors_by_type{type="${type}"} ${count} ${timestamp}`)
  .join('\n')}
    `.trim();
  }
  
  reset(): void {
    this.metrics = {
      httpRequests: { total: 0, byStatus: {}, byMethod: {} },
      mcpRequests: { total: 0, byMethod: {}, errors: 0 },
      sessions: { created: 0, terminated: 0, active: 0 },
      hubspot: { apiCalls: 0, errors: 0, rateLimitHits: 0 },
      performance: { averageResponseTime: 0, p95ResponseTime: 0, memoryUsage: 0, cpuUsage: 0 },
      errors: { total: 0, byType: {}, byStatusCode: {} }
    };
    this.responseTimes = [];
  }
}

export const metricsCollector = new MetricsCollector();

// Metrics collection middleware
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    metricsCollector.incrementHttpRequest(req.method, res.statusCode);
    metricsCollector.recordResponseTime(duration);
    
    // Track MCP-specific requests
    if (req.path === '/mcp') {
      const mcpMethod = req.body?.method || 'unknown';
      const isError = res.statusCode >= 400 || req.body?.error;
      metricsCollector.incrementMCPRequest(mcpMethod, isError);
    }
    
    // Track errors
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      metricsCollector.recordError(errorType, res.statusCode);
    }
  });
  
  next();
};

export { MetricsCollector, MetricsData };