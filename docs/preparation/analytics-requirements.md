# Analytics Requirements Research

## Executive Summary

Analytics dashboard requirements encompass comprehensive tool usage tracking, error monitoring with full JSON payloads, and performance metrics collection. Key findings indicate the need for real-time data visualization, structured logging patterns, and efficient data aggregation strategies. The system should capture both high-level BCP usage patterns and granular individual tool metrics to provide actionable insights for optimization and monitoring.

**Critical Requirements:**
- Real-time tool usage tracking with parameter capture
- Comprehensive error logging with full context and JSON payloads
- Performance metrics (response times, success rates, throughput)
- User session tracking and authentication analytics
- Data retention policies with automated cleanup

## Analytics Data Categories

### 1. Tool Usage Metrics

| Data Point | Type | Purpose | Storage Requirements |
|------------|------|---------|---------------------|
| Tool Name | String | BCP identification | Indexed field |
| Operation | String | Specific tool function | Indexed field |
| Parameters | JSONB | Input analysis | Searchable JSON |
| Response Time | Integer | Performance tracking | Aggregatable |
| Success Status | Boolean | Reliability metrics | Filterable |
| User Context | Integer | Usage attribution | Foreign key |
| Timestamp | DateTime | Time-series analysis | Partitioned |

### 2. Error Monitoring Data

| Data Point | Type | Purpose | Storage Requirements |
|------------|------|---------|---------------------|
| Error Level | Enum | Severity classification | Indexed (error, warn, info) |
| Message | Text | Human-readable error | Full-text searchable |
| Stack Trace | Text | Debug information | Compressed storage |
| Raw JSON | JSONB | Complete error context | Searchable structure |
| Tool Context | String | Error source tracking | Indexed field |
| User Session | String | Session correlation | Foreign key |

### 3. Performance Analytics

| Metric | Calculation | Dashboard Use | Alert Threshold |
|--------|------------|---------------|----------------|
| Average Response Time | Mean duration per tool | Performance trends | > 5000ms |
| Success Rate | (Successful / Total) * 100 | Reliability dashboard | < 95% |
| Throughput | Requests per minute | Load monitoring | System capacity |
| Error Rate | (Errors / Total) * 100 | Health dashboard | > 5% |
| Peak Usage Hours | Time-based aggregation | Capacity planning | Resource scaling |

## Database Schema Design

### Core Analytics Tables

```sql
-- Tool usage tracking with partitioning
CREATE TABLE tool_usage_logs (
    id BIGSERIAL PRIMARY KEY,
    bcp_name VARCHAR(100) NOT NULL,
    tool_name VARCHAR(100) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    parameters JSONB,
    response_data JSONB,
    user_id INTEGER REFERENCES users(id),
    session_id VARCHAR(255),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) * 1000
    ) STORED,
    success BOOLEAN DEFAULT NULL,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Monthly partitions for performance
CREATE TABLE tool_usage_logs_2024_08 PARTITION OF tool_usage_logs
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');

-- Comprehensive error logging
CREATE TABLE error_logs (
    id BIGSERIAL PRIMARY KEY,
    level error_level_enum NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    error_code VARCHAR(50),
    context JSONB NOT NULL DEFAULT '{}',
    tool_context JSONB,
    user_id INTEGER REFERENCES users(id),
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT
);

-- Create enum for error levels
CREATE TYPE error_level_enum AS ENUM ('debug', 'info', 'warn', 'error', 'fatal');

-- Performance metrics aggregation
CREATE TABLE performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    aggregation_period VARCHAR(20) NOT NULL -- '1m', '5m', '1h', '1d'
);

-- User sessions for analytics
CREATE TABLE user_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    tool_calls_count INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0
);
```

### Optimized Indexes

```sql
-- Tool usage query optimization
CREATE INDEX idx_tool_usage_bcp_time ON tool_usage_logs(bcp_name, created_at DESC);
CREATE INDEX idx_tool_usage_tool_time ON tool_usage_logs(tool_name, created_at DESC);
CREATE INDEX idx_tool_usage_user_time ON tool_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_tool_usage_success ON tool_usage_logs(success) WHERE success = false;
CREATE INDEX idx_tool_usage_duration ON tool_usage_logs(duration_ms) WHERE duration_ms > 5000;

-- JSON parameter searching
CREATE INDEX idx_tool_usage_parameters_gin ON tool_usage_logs USING GIN (parameters);
CREATE INDEX idx_error_logs_context_gin ON error_logs USING GIN (context);

-- Error log optimization
CREATE INDEX idx_error_logs_level_time ON error_logs(level, timestamp DESC);
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved) WHERE resolved = false;
CREATE INDEX idx_error_logs_tool_context_gin ON error_logs USING GIN (tool_context);

-- Performance metrics
CREATE INDEX idx_performance_metrics_name_time ON performance_metrics(metric_name, timestamp DESC);
CREATE INDEX idx_performance_metrics_labels_gin ON performance_metrics USING GIN (labels);
```

## Data Collection Patterns

### High-Frequency Logging Strategy

```typescript
// Batch logging for performance
class AnalyticsCollector {
  private logBuffer: ToolUsageLog[] = [];
  private bufferSize = 100;
  private flushInterval = 5000; // 5 seconds

  constructor(private prisma: PrismaClient) {
    this.startBatchFlush();
  }

  async logToolUsage(data: ToolUsageData) {
    this.logBuffer.push({
      bcpName: data.bcpName,
      toolName: data.toolName,
      operation: data.operation,
      parameters: data.parameters,
      userId: data.userId,
      sessionId: data.sessionId,
      startTime: data.startTime,
      endTime: data.endTime,
      success: data.success,
      errorMessage: data.error?.message,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent
    });

    if (this.logBuffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }
  }

  private async flushBuffer() {
    if (this.logBuffer.length === 0) return;

    const logs = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await this.prisma.toolUsageLogs.createMany({
        data: logs,
        skipDuplicates: true
      });
    } catch (error) {
      console.error('Failed to flush analytics buffer:', error);
      // Implement fallback storage or retry mechanism
    }
  }

  private startBatchFlush() {
    setInterval(async () => {
      await this.flushBuffer();
    }, this.flushInterval);
  }
}
```

### Error Context Capture

```typescript
// Comprehensive error logging with full context
interface ErrorContext {
  toolName?: string;
  operation?: string;
  parameters?: any;
  userId?: number;
  sessionId?: string;
  requestId?: string;
  timestamp?: Date;
  environment?: string;
  version?: string;
  additionalContext?: Record<string, any>;
}

class ErrorLogger {
  static async logError(
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    message: string,
    error: Error,
    context: ErrorContext = {}
  ) {
    const errorData = {
      level,
      message,
      stackTrace: error.stack,
      errorCode: (error as any).code,
      context: {
        ...context,
        errorName: error.name,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
      },
      toolContext: context.toolName ? {
        tool: context.toolName,
        operation: context.operation,
        parameters: context.parameters
      } : null,
      userId: context.userId,
      sessionId: context.sessionId,
      requestId: context.requestId || this.generateRequestId()
    };

    // Immediate logging for critical errors
    if (level === 'error' || level === 'fatal') {
      await this.immediateLog(errorData);
    } else {
      this.bufferLog(errorData);
    }
  }

  private static generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Real-Time Analytics Implementation

### WebSocket Data Streaming

```typescript
// Real-time analytics streaming
class AnalyticsStreamer {
  private wsServer: WebSocketServer;
  private activeConnections: Set<WebSocket> = new Set();

  constructor(server: http.Server) {
    this.wsServer = new WebSocketServer({ server, path: '/analytics-stream' });
    this.setupWebSocketHandlers();
    this.startMetricsStream();
  }

  private setupWebSocketHandlers() {
    this.wsServer.on('connection', (ws, request) => {
      // Authenticate admin connection
      if (!this.authenticateAdmin(request)) {
        ws.close(1008, 'Unauthorized');
        return;
      }

      this.activeConnections.add(ws);
      
      ws.on('close', () => {
        this.activeConnections.delete(ws);
      });

      // Send initial data
      this.sendInitialMetrics(ws);
    });
  }

  async broadcastMetric(metric: RealtimeMetric) {
    const message = JSON.stringify({
      type: 'metric',
      data: metric,
      timestamp: new Date().toISOString()
    });

    this.activeConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  private startMetricsStream() {
    setInterval(async () => {
      const metrics = await this.getRealtimeMetrics();
      await this.broadcastMetric(metrics);
    }, 1000); // 1-second intervals
  }
}
```

### Aggregation Strategies

```typescript
// Efficient data aggregation for dashboard queries
class MetricsAggregator {
  async getToolUsageStats(timeRange: TimeRange): Promise<ToolUsageStats> {
    const { start, end, interval } = this.getTimeParams(timeRange);
    
    // Use materialized view for common aggregations
    const query = `
      SELECT 
        bcp_name,
        tool_name,
        COUNT(*) as call_count,
        AVG(duration_ms) as avg_duration,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration,
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate,
        DATE_TRUNC('${interval}', created_at) as time_bucket
      FROM tool_usage_logs 
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY bcp_name, tool_name, time_bucket
      ORDER BY time_bucket DESC, call_count DESC
    `;

    return await this.prisma.$queryRaw`${query}` as ToolUsageStats[];
  }

  async getErrorAnalysis(timeRange: TimeRange): Promise<ErrorAnalysis> {
    return await this.prisma.errorLogs.groupBy({
      by: ['level', 'toolContext'],
      _count: { id: true },
      where: {
        timestamp: {
          gte: timeRange.start,
          lt: timeRange.end
        }
      },
      orderBy: {
        _count: { id: 'desc' }
      }
    });
  }
}
```

## Data Retention and Cleanup

### Automated Data Lifecycle Management

```sql
-- Data retention policies
CREATE TABLE data_retention_policies (
    table_name VARCHAR(100) PRIMARY KEY,
    retention_days INTEGER NOT NULL,
    archive_before_delete BOOLEAN DEFAULT true,
    cleanup_enabled BOOLEAN DEFAULT true
);

INSERT INTO data_retention_policies VALUES
('tool_usage_logs', 90, true, true),
('error_logs', 365, true, true),
('performance_metrics', 30, false, true),
('user_sessions', 30, false, true);

-- Cleanup procedure
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE(table_name TEXT, deleted_count BIGINT) AS $$
DECLARE
    policy RECORD;
    cleanup_date TIMESTAMP WITH TIME ZONE;
    deleted BIGINT;
BEGIN
    FOR policy IN 
        SELECT * FROM data_retention_policies 
        WHERE cleanup_enabled = true
    LOOP
        cleanup_date := CURRENT_TIMESTAMP - (policy.retention_days || ' days')::INTERVAL;
        
        CASE policy.table_name
            WHEN 'tool_usage_logs' THEN
                DELETE FROM tool_usage_logs WHERE created_at < cleanup_date;
                GET DIAGNOSTICS deleted = ROW_COUNT;
            WHEN 'error_logs' THEN
                DELETE FROM error_logs WHERE timestamp < cleanup_date;
                GET DIAGNOSTICS deleted = ROW_COUNT;
            -- Add other tables as needed
        END CASE;
        
        RETURN QUERY SELECT policy.table_name::TEXT, deleted;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### Data Archiving Strategy

```typescript
// Archive old data to compressed storage
class DataArchiver {
  async archiveOldData(tableName: string, cutoffDate: Date): Promise<void> {
    // Export to JSON files for long-term storage
    const archiveData = await this.exportToJSON(tableName, cutoffDate);
    
    // Compress and store in cloud storage (S3, GCS, etc.)
    const compressedData = await this.compressData(archiveData);
    await this.uploadToStorage(compressedData, this.getArchivePath(tableName, cutoffDate));
    
    // Clean up original data after successful archive
    await this.deleteArchivedData(tableName, cutoffDate);
  }

  private async exportToJSON(tableName: string, cutoffDate: Date): Promise<any[]> {
    const query = `
      SELECT * FROM ${tableName} 
      WHERE created_at < $1 
      ORDER BY created_at
    `;
    return await this.prisma.$queryRawUnsafe(query, cutoffDate);
  }
}
```

## Privacy and Compliance

### Data Anonymization

```typescript
// Anonymize sensitive data for analytics
class DataAnonymizer {
  static anonymizeParameters(parameters: any): any {
    const sensitiveFields = ['email', 'phone', 'ssn', 'creditCard', 'password'];
    
    return this.deepClone(parameters, (key, value) => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        return '[REDACTED]';
      }
      if (typeof value === 'string' && this.isPersonalData(value)) {
        return this.hashValue(value);
      }
      return value;
    });
  }

  private static isPersonalData(value: string): boolean {
    // Email pattern
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true;
    // Phone pattern
    if (/^\+?[\d\s\-\(\)]{10,}$/.test(value)) return true;
    // SSN pattern
    if (/^\d{3}-?\d{2}-?\d{4}$/.test(value)) return true;
    return false;
  }

  private static hashValue(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex').substring(0, 8);
  }
}
```

## Dashboard Query Optimization

### Materialized Views for Common Queries

```sql
-- Hourly tool usage summary
CREATE MATERIALIZED VIEW hourly_tool_usage AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    bcp_name,
    tool_name,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE success = true) as successful_calls,
    AVG(duration_ms) as avg_duration_ms,
    MAX(duration_ms) as max_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration_ms
FROM tool_usage_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY hour, bcp_name, tool_name;

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_tool_usage;
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_error_summary;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh every 5 minutes
SELECT cron.schedule('refresh-analytics', '*/5 * * * *', 'SELECT refresh_analytics_views();');
```

## Resource Links

- [PostgreSQL JSONB Performance](https://www.postgresql.org/docs/current/datatype-json.html)
- [Time-Series Data in PostgreSQL](https://www.timescale.com/blog/time-series-data-postgresql-10-vs-timescaledb/)
- [Node.js Monitoring Best Practices](https://betterstack.com/community/comparisons/nodejs-application-monitoring-tools/)
- [Real-time Analytics Patterns](https://cube.dev/blog/node-express-analytics-dashboard-with-cubejs)

## Recommendations

1. **Implement batch logging** to minimize database load during high-traffic periods
2. **Use JSONB columns** for flexible parameter and error context storage with GIN indexes
3. **Set up table partitioning** by date for tool usage logs to improve query performance
4. **Create materialized views** for common dashboard queries and refresh them periodically
5. **Implement data retention policies** with automated cleanup and archiving
6. **Use WebSocket streaming** for real-time dashboard updates
7. **Anonymize sensitive data** before storing in analytics tables
8. **Set up proper monitoring** for the analytics system itself to prevent data loss