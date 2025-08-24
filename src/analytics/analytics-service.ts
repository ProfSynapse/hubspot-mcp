import database from './database.js';

/**
 * Interface for tool usage statistics
 */
export interface ToolUsageStats {
  tool_name: string;
  operation: string;
  call_count: number;
  avg_response_time: number;
}

/**
 * Interface for error statistics
 */
export interface ErrorStats {
  tool_name: string;
  operation: string;
  error_code: string;
  error_count: number;
}

/**
 * Interface for summary statistics
 */
export interface SummaryStats {
  totalCalls: number;
  errorRate: string;
  avgResponseTime: number;
}

/**
 * Interface for analytics dashboard response
 */
export interface AnalyticsResponse {
  toolUsage: ToolUsageStats[];
  errors: ErrorStats[];
  summary: SummaryStats;
}

/**
 * Core analytics service for tracking HubSpot MCP tool usage and errors
 */
export class AnalyticsService {
  /**
   * Log a successful or failed tool call
   */
  async logToolCall(
    toolName: string, 
    operation: string | null, 
    params: any, 
    success: boolean, 
    responseTime: number
  ): Promise<void> {
    try {
      await database.query(
        'INSERT INTO tool_calls (tool_name, operation, params, success, response_time_ms) VALUES ($1, $2, $3, $4, $5)',
        [toolName, operation, JSON.stringify(params), success, responseTime]
      );
    } catch (error) {
      console.error('Failed to log tool call:', error);
      // Don't throw - analytics logging should not break main functionality
    }
  }

  /**
   * Log detailed error information
   */
  async logError(
    toolName: string,
    operation: string | null,
    errorMessage: string,
    errorCode: string,
    params: any,
    stackTrace?: string
  ): Promise<void> {
    try {
      await database.query(
        'INSERT INTO errors (tool_name, operation, error_message, error_code, params, stack_trace) VALUES ($1, $2, $3, $4, $5, $6)',
        [toolName, operation, errorMessage, errorCode, JSON.stringify(params), stackTrace]
      );
    } catch (error) {
      console.error('Failed to log error:', error);
      // Don't throw - analytics logging should not break main functionality
    }
  }

  /**
   * Get tool usage statistics for the last N days
   */
  async getUsageStats(days: number = 7): Promise<ToolUsageStats[]> {
    const result = await database.query(`
      SELECT 
        tool_name, 
        operation, 
        COUNT(*)::int as call_count, 
        ROUND(AVG(response_time_ms))::int as avg_response_time
      FROM tool_calls 
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY tool_name, operation 
      ORDER BY call_count DESC
    `);
    
    return result.rows;
  }

  /**
   * Get error statistics for the last N days
   */
  async getErrorStats(days: number = 7): Promise<ErrorStats[]> {
    const result = await database.query(`
      SELECT 
        tool_name, 
        operation, 
        error_code, 
        COUNT(*)::int as error_count
      FROM errors 
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY tool_name, operation, error_code
      ORDER BY error_count DESC
    `);
    
    return result.rows;
  }

  /**
   * Get summary statistics for the last N days
   */
  async getSummaryStats(days: number = 7): Promise<SummaryStats> {
    const result = await database.query(`
      SELECT 
        COUNT(*)::int as total_calls,
        COUNT(*) FILTER (WHERE success = false)::int as error_count,
        ROUND(AVG(response_time_ms))::int as avg_response_time
      FROM tool_calls 
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
    `);
    
    const stats = result.rows[0];
    const totalCalls = parseInt(stats.total_calls) || 0;
    const errorCount = parseInt(stats.error_count) || 0;
    
    return {
      totalCalls,
      errorRate: totalCalls > 0 ? ((errorCount / totalCalls) * 100).toFixed(2) : '0.00',
      avgResponseTime: parseInt(stats.avg_response_time) || 0
    };
  }

  /**
   * Get complete analytics data for dashboard
   */
  async getAnalyticsData(days: number = 7): Promise<AnalyticsResponse> {
    const [toolUsage, errors, summary] = await Promise.all([
      this.getUsageStats(days),
      this.getErrorStats(days),
      this.getSummaryStats(days)
    ]);

    return {
      toolUsage,
      errors,
      summary
    };
  }

  /**
   * Get recent errors with full details
   */
  async getRecentErrors(limit: number = 50, days: number = 7): Promise<any[]> {
    const result = await database.query(`
      SELECT 
        id,
        tool_name,
        operation,
        error_message,
        error_code,
        params,
        timestamp
      FROM errors 
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
      ORDER BY timestamp DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  }

  /**
   * Get performance metrics over time
   */
  async getPerformanceMetrics(days: number = 7, intervalHours: number = 1): Promise<any[]> {
    const result = await database.query(`
      SELECT 
        DATE_TRUNC('hour', timestamp) as time_bucket,
        COUNT(*)::int as call_count,
        COUNT(*) FILTER (WHERE success = false)::int as error_count,
        ROUND(AVG(response_time_ms))::int as avg_response_time
      FROM tool_calls 
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE_TRUNC('hour', timestamp)
      ORDER BY time_bucket
    `);
    
    return result.rows;
  }

  /**
   * Clean up old data (for maintenance)
   */
  async cleanupOldData(daysToKeep: number = 90): Promise<{ toolCallsDeleted: number; errorsDeleted: number }> {
    const toolCallsResult = await database.query(`
      DELETE FROM tool_calls 
      WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'
    `);

    const errorsResult = await database.query(`
      DELETE FROM errors 
      WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'
    `);

    return {
      toolCallsDeleted: toolCallsResult.rowCount || 0,
      errorsDeleted: errorsResult.rowCount || 0
    };
  }

  /**
   * Test the analytics service and database connection
   */
  async healthCheck(): Promise<{ status: string; message: string; timestamp: Date }> {
    try {
      const testResult = await database.query('SELECT COUNT(*) FROM tool_calls LIMIT 1');
      
      return {
        status: 'healthy',
        message: 'Analytics service operational',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Analytics service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();