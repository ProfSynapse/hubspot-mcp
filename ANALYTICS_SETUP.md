# Analytics Database Setup

This document provides setup instructions for the HubSpot MCP analytics database system that tracks tool usage and errors.

## Prerequisites

- PostgreSQL database (local or cloud)
- Node.js environment with `pg` library installed

## Environment Variables

Add these variables to your `.env` file:

```bash
# Analytics Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/hubspot_analytics
ANALYTICS_ENABLED=true
```

## Database Setup

### 1. Create Database

Create a PostgreSQL database for analytics:

```sql
CREATE DATABASE hubspot_analytics;
```

### 2. Run Migrations

Execute the schema migration to create tables:

```bash
# Using psql
psql $DATABASE_URL -f migrations/001-initial-schema.sql

# Or using Railway CLI (for production)
railway run psql $DATABASE_URL -f migrations/001-initial-schema.sql
```

### 3. Verify Setup

Check that all tables were created:

```sql
\dt
```

You should see:
- `users` (for dashboard authentication)
- `tool_calls` (for tracking all tool invocations)
- `errors` (for detailed error logging)
- `sessions` (for express-session storage)

## Features

### Automatic Tracking

The analytics system automatically tracks:

- **Tool Calls**: All MCP tool invocations with response times
- **Errors**: Detailed error information with stack traces
- **Performance**: Response time metrics and success rates
- **Usage Patterns**: Tool and operation frequency statistics

### Data Privacy

- Parameters are stored as JSON but can be filtered/sanitized
- Stack traces are only stored for debugging purposes
- No sensitive data like tokens are logged

### Performance Impact

- Analytics logging is asynchronous (fire-and-forget)
- Database connection pooling prevents resource exhaustion
- Analytics failures don't affect tool functionality

## Usage

### Querying Analytics Data

```typescript
import { analyticsService } from './src/analytics/index.js';

// Get usage statistics for last 7 days
const stats = await analyticsService.getUsageStats(7);

// Get error statistics
const errors = await analyticsService.getErrorStats(7);

// Get complete dashboard data
const dashboard = await analyticsService.getAnalyticsData(7);
```

### Health Check

Test the analytics system:

```typescript
const health = await analyticsService.healthCheck();
console.log(health.status); // 'healthy' or 'unhealthy'
```

### Data Cleanup

Remove old data (optional maintenance):

```typescript
const result = await analyticsService.cleanupOldData(90); // Keep 90 days
console.log(`Deleted ${result.toolCallsDeleted} tool calls, ${result.errorsDeleted} errors`);
```

## Schema Details

### tool_calls Table

Tracks every MCP tool invocation:

- `tool_name`: Name of the tool (e.g., 'hubspotCompany')
- `operation`: Operation performed (e.g., 'search', 'create')
- `params`: JSON parameters passed to the tool
- `success`: Whether the call succeeded
- `response_time_ms`: Response time in milliseconds
- `timestamp`: When the call was made

### errors Table

Detailed error tracking:

- `tool_name`: Tool that failed
- `operation`: Operation that failed
- `error_message`: Error message
- `error_code`: Error code or type
- `params`: Parameters that caused the error
- `stack_trace`: Full stack trace for debugging
- `timestamp`: When the error occurred

## Integration

The analytics system integrates seamlessly with existing BCP tools through middleware:

```typescript
// Analytics is automatically applied to all registered tools
// No changes needed to existing BCP code
```

### Conditional Analytics

Analytics can be disabled with environment variables:

```bash
ANALYTICS_ENABLED=false
# or remove DATABASE_URL to disable
```

When disabled, tools run without any analytics overhead.

## Monitoring

### Key Metrics to Monitor

1. **Error Rate**: `errors.count / tool_calls.count`
2. **Response Time**: Average `response_time_ms` by tool/operation
3. **Usage Patterns**: Most frequently used tools and operations
4. **Performance Trends**: Response time changes over time

### Indexes

The schema includes optimized indexes for:

- Timestamp-based queries (common for dashboards)
- Tool name filtering (for per-tool analysis)
- Success/error filtering (for error rate calculations)

## Production Considerations

### Railway Deployment

For Railway deployment:

1. Add PostgreSQL addon to your Railway project
2. `DATABASE_URL` will be set automatically
3. Run migrations: `railway run psql $DATABASE_URL -f migrations/001-initial-schema.sql`

### Performance Tuning

- Adjust connection pool size in `src/analytics/database.ts`
- Consider partitioning tables for very high volume
- Monitor index usage with `EXPLAIN ANALYZE`

### Backup Strategy

- Include analytics database in backup procedures
- Consider data retention policies for `tool_calls` and `errors` tables
- Test recovery procedures regularly

## Troubleshooting

### Common Issues

**Database Connection Errors**
- Verify `DATABASE_URL` format and credentials
- Check PostgreSQL server is running
- Verify network connectivity and firewall rules

**Migration Failures**
- Check if tables already exist
- Verify PostgreSQL user has CREATE privileges
- Check for syntax errors in migration file

**Analytics Not Logging**
- Verify `ANALYTICS_ENABLED=true`
- Check `DATABASE_URL` is set correctly
- Look for console warnings about analytics failures

### Debug Mode

Enable debug logging:

```bash
NODE_ENV=development
```

This will log:
- Database connections
- Query execution times
- Analytics operations