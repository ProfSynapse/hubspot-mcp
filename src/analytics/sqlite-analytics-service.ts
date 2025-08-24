/**
 * SQLite Analytics Service
 * Implements analytics logging using SQLite for local development
 */

import { getSQLiteDatabase, SQLiteDatabase } from './sqlite-database.js';

export class SQLiteAnalyticsService {
  private db: SQLiteDatabase;

  constructor() {
    this.db = getSQLiteDatabase();
  }

  async initialize(): Promise<void> {
    await this.db.initialize();
  }

  async logToolCall(
    domain: string,
    operation: string,
    success: boolean,
    responseTime: number,
    parameters?: any,
    responseSize?: number
  ): Promise<void> {
    try {
      await this.db.run(
        `INSERT INTO tool_calls (domain, operation, success, response_time, parameters, response_size)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          domain,
          operation,
          success,
          responseTime,
          parameters ? JSON.stringify(parameters) : null,
          responseSize || null
        ]
      );
    } catch (error) {
      console.error('Failed to log tool call:', error);
    }
  }

  async logError(
    domain: string,
    operation: string,
    errorType: string,
    errorMessage: string,
    stackTrace?: string,
    parameters?: any
  ): Promise<void> {
    try {
      await this.db.run(
        `INSERT INTO errors (domain, operation, error_type, error_message, stack_trace, parameters)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          domain,
          operation,
          errorType,
          errorMessage,
          stackTrace || null,
          parameters ? JSON.stringify(parameters) : null
        ]
      );
    } catch (error) {
      console.error('Failed to log error:', error);
    }
  }

  async getUsageStats(days: number = 7): Promise<any> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const [totalCalls, successfulCalls, toolUsage, dailyStats] = await Promise.all([
      this.db.query(`SELECT COUNT(*) as count FROM tool_calls WHERE timestamp >= ?`, [since]),
      this.db.query(`SELECT COUNT(*) as count FROM tool_calls WHERE timestamp >= ? AND success = 1`, [since]),
      this.db.query(`
        SELECT domain, operation, COUNT(*) as count, AVG(response_time) as avg_response_time
        FROM tool_calls 
        WHERE timestamp >= ?
        GROUP BY domain, operation
        ORDER BY count DESC
      `, [since]),
      this.db.query(`
        SELECT DATE(timestamp) as date, COUNT(*) as calls, 
               AVG(response_time) as avg_response_time,
               COUNT(CASE WHEN success = 0 THEN 1 END) as errors
        FROM tool_calls 
        WHERE timestamp >= ?
        GROUP BY DATE(timestamp)
        ORDER BY date
      `, [since])
    ]);

    return {
      totalCalls: totalCalls[0]?.count || 0,
      successfulCalls: successfulCalls[0]?.count || 0,
      errorRate: totalCalls[0]?.count ? ((totalCalls[0].count - successfulCalls[0]?.count) / totalCalls[0].count) * 100 : 0,
      toolUsage,
      dailyStats
    };
  }

  async getErrorStats(days: number = 7): Promise<any[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    return await this.db.query(`
      SELECT domain, operation, error_type, error_message, COUNT(*) as count,
             MAX(timestamp) as last_occurrence
      FROM errors 
      WHERE timestamp >= ?
      GROUP BY domain, operation, error_type, error_message
      ORDER BY count DESC, last_occurrence DESC
    `, [since]);
  }

  async getSummaryStats(): Promise<any> {
    const [summary] = await this.db.query(`
      SELECT 
        COUNT(*) as total_calls,
        AVG(response_time) as avg_response_time,
        COUNT(CASE WHEN success = 0 THEN 1 END) as total_errors,
        COUNT(DISTINCT domain) as domains_used
      FROM tool_calls
    `);

    return summary || {
      total_calls: 0,
      avg_response_time: 0,
      total_errors: 0,
      domains_used: 0
    };
  }
}