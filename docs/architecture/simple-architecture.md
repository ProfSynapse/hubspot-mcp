# Simple Analytics Architecture

## Executive Summary

This document provides a minimal, implementation-ready architecture for tracking HubSpot MCP tool usage and errors. The system uses PostgreSQL for data storage, basic username/password authentication, and a Next.js dashboard with simple charts. This architecture focuses on immediate implementation needs without over-engineering.

## Database Design

### Complete SQL Schema

```sql
-- 1. Users table for basic authentication
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tool calls tracking table
CREATE TABLE tool_calls (
  id SERIAL PRIMARY KEY,
  tool_name VARCHAR(100) NOT NULL,
  operation VARCHAR(100),
  params JSONB,
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Errors tracking table
CREATE TABLE errors (
  id SERIAL PRIMARY KEY,
  tool_name VARCHAR(100) NOT NULL,
  operation VARCHAR(100),
  error_message TEXT NOT NULL,
  error_code VARCHAR(50),
  params JSONB,
  stack_trace TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Sessions table for express-session
CREATE TABLE sessions (
  sid VARCHAR(255) PRIMARY KEY,
  data TEXT NOT NULL,
  expires TIMESTAMP NOT NULL
);

-- Performance indexes
CREATE INDEX idx_tool_calls_timestamp ON tool_calls(timestamp);
CREATE INDEX idx_tool_calls_tool_name ON tool_calls(tool_name);
CREATE INDEX idx_errors_timestamp ON errors(timestamp);
CREATE INDEX idx_errors_tool_name ON errors(tool_name);
```

### Database Initialization Script

```sql
-- Create initial admin user (run once after table creation)
INSERT INTO users (username, password_hash) 
VALUES ('admin', '$2b$12$yourBcryptHashHere');
```

## File Structure

```
hubspot-mcp/
├── src/
│   ├── analytics/
│   │   ├── database.js              # PostgreSQL connection pool
│   │   ├── analytics-service.js     # Core analytics operations
│   │   ├── auth-service.js          # Authentication logic
│   │   └── middleware.js            # MCP tool call wrapper
│   └── existing-mcp-code/           # Your existing MCP server files
├── dashboard/
│   ├── app/
│   │   ├── login/
│   │   │   └── page.tsx             # Login page
│   │   ├── dashboard/
│   │   │   └── page.tsx             # Main analytics dashboard
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── route.ts         # POST /api/auth (login/logout)
│   │   │   └── analytics/
│   │   │       └── route.ts         # GET /api/analytics (dashboard data)
│   │   └── layout.tsx               # Root layout with auth checking
│   ├── components/
│   │   ├── ui/                      # shadcn/ui components
│   │   ├── login-form.tsx           # Login form component
│   │   ├── usage-chart.tsx          # Tool usage bar chart
│   │   └── error-table.tsx          # Error log table
│   ├── lib/
│   │   ├── auth.ts                  # Auth utilities
│   │   └── analytics-api.ts         # API client
│   ├── package.json                 # Next.js dependencies
│   └── tailwind.config.js           # Tailwind + shadcn config
├── migrations/
│   └── 001-initial-schema.sql       # Database schema file
└── railway.json                     # Railway deployment config
```

## API Endpoints

### Authentication API

```typescript
// POST /api/auth
// Request body: { username: string, password: string, action: 'login' | 'logout' }

interface LoginRequest {
  username: string;
  password: string;
  action: 'login';
}

interface LoginResponse {
  success: boolean;
  message: string;
}
```

### Analytics API

```typescript
// GET /api/analytics?days=7
// Returns dashboard data for the last N days

interface AnalyticsResponse {
  toolUsage: Array<{
    tool_name: string;
    operation: string;
    call_count: number;
    avg_response_time: number;
  }>;
  errors: Array<{
    tool_name: string;
    operation: string;
    error_code: string;
    error_count: number;
  }>;
  summary: {
    totalCalls: number;
    errorRate: number;
    avgResponseTime: number;
  };
}
```

## MCP Integration Point

### Analytics Middleware

```javascript
// src/analytics/middleware.js
import { AnalyticsService } from './analytics-service.js';

const analytics = new AnalyticsService();

export function withAnalytics(originalHandler, toolName, operation) {
  return async (params) => {
    const startTime = Date.now();
    
    try {
      const result = await originalHandler(params);
      const responseTime = Date.now() - startTime;
      
      // Log successful call
      await analytics.logToolCall(toolName, operation, params, true, responseTime);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Log error details
      await analytics.logError(
        toolName,
        operation,
        error.message,
        error.code || 'UNKNOWN',
        params,
        error.stack
      );
      
      // Log failed call
      await analytics.logToolCall(toolName, operation, params, false, responseTime);
      throw error;
    }
  };
}
```

### Integration with Existing Tools

Apply the middleware to existing BCP tools:

```javascript
// In your tool registration (e.g., src/core/tool-registration-factory.ts)
import { withAnalytics } from '../analytics/middleware.js';

// Wrap each tool handler
const wrappedHandler = withAnalytics(
  originalHandler, 
  'hubspotCompany',    // tool name
  params.operation     // operation name
);
```

## Authentication Flow

### Session Configuration

```javascript
// In your Next.js API routes or Express server
import session from 'express-session';
import pgSession from 'connect-pg-simple';

const pgStore = pgSession(session);

const sessionConfig = {
  store: new pgStore({
    conString: process.env.DATABASE_URL,
    tableName: 'sessions'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production'
  }
};
```

### Login Flow

1. User submits username/password on `/login`
2. Server validates credentials against `users` table
3. On success, create session and redirect to `/dashboard`
4. Dashboard pages check session before rendering
5. Logout destroys session and redirects to `/login`

## Dashboard Design

### Login Page Features

- Simple form with username/password fields
- Basic validation (required fields, min password length)
- Error messages for invalid credentials
- Responsive design with shadcn/ui components

### Dashboard Page Features

- **Usage Chart**: Bar chart showing tool call counts by tool/operation
- **Response Time Chart**: Line chart showing average response times over time
- **Error Table**: Sortable table showing recent errors with details
- **Summary Cards**: Total calls, error rate, average response time
- **Time Filter**: Dropdown to select 1, 7, or 30 days of data

### Key Components

```typescript
// components/usage-chart.tsx
interface UsageData {
  tool_name: string;
  call_count: number;
  avg_response_time: number;
}

export function UsageChart({ data }: { data: UsageData[] }) {
  return (
    <BarChart width={600} height={300} data={data}>
      <Bar dataKey="call_count" fill="#8884d8" />
    </BarChart>
  );
}
```

## Railway Deployment

### Environment Variables

```bash
# Automatically provided by Railway PostgreSQL addon
DATABASE_URL=postgresql://postgres:password@host:port/database

# Add manually in Railway dashboard
SESSION_SECRET=your-secure-random-string-here
NODE_ENV=production
```

### Deployment Steps

1. **Create Railway Project**
   ```bash
   railway login
   railway init
   railway add postgresql
   ```

2. **Deploy Database Schema**
   ```bash
   # Upload and run migrations/001-initial-schema.sql
   railway run psql $DATABASE_URL -f migrations/001-initial-schema.sql
   ```

3. **Create Admin User**
   ```bash
   # Generate bcrypt hash locally, then insert
   railway run psql $DATABASE_URL -c "INSERT INTO users (username, password_hash) VALUES ('admin', 'your-bcrypt-hash');"
   ```

4. **Deploy Application**
   ```bash
   railway up
   ```

### Railway Configuration

```json
// railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start",
    "healthcheckPath": "/api/health"
  }
}
```

## Core Service Implementation

### Database Connection

```javascript
// src/analytics/database.js
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

export default pool;
```

### Analytics Service

```javascript
// src/analytics/analytics-service.js
import pool from './database.js';

export class AnalyticsService {
  async logToolCall(toolName, operation, params, success, responseTime) {
    await pool.query(
      'INSERT INTO tool_calls (tool_name, operation, params, success, response_time_ms) VALUES ($1, $2, $3, $4, $5)',
      [toolName, operation, JSON.stringify(params), success, responseTime]
    );
  }

  async logError(toolName, operation, errorMessage, errorCode, params, stackTrace) {
    await pool.query(
      'INSERT INTO errors (tool_name, operation, error_message, error_code, params, stack_trace) VALUES ($1, $2, $3, $4, $5, $6)',
      [toolName, operation, errorMessage, errorCode, JSON.stringify(params), stackTrace]
    );
  }

  async getUsageStats(days = 7) {
    const result = await pool.query(`
      SELECT tool_name, operation, COUNT(*) as call_count, 
             AVG(response_time_ms) as avg_response_time
      FROM tool_calls 
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY tool_name, operation 
      ORDER BY call_count DESC
    `);
    return result.rows;
  }

  async getErrorStats(days = 7) {
    const result = await pool.query(`
      SELECT tool_name, operation, error_code, COUNT(*) as error_count
      FROM errors 
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY tool_name, operation, error_code
      ORDER BY error_count DESC
    `);
    return result.rows;
  }

  async getSummaryStats(days = 7) {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE success = false) as error_count,
        AVG(response_time_ms) as avg_response_time
      FROM tool_calls 
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
    `);
    
    const stats = result.rows[0];
    return {
      totalCalls: parseInt(stats.total_calls),
      errorRate: stats.total_calls > 0 ? (stats.error_count / stats.total_calls * 100).toFixed(2) : 0,
      avgResponseTime: Math.round(stats.avg_response_time || 0)
    };
  }
}
```

## Security Considerations

### Database Security
- Use parameterized queries (already implemented above)
- Connection pooling prevents connection exhaustion
- Indexes on timestamp columns for query performance

### Authentication Security
- bcrypt with salt rounds 12+ for password hashing
- Secure session configuration with proper expiration
- Session data stored server-side in PostgreSQL

### Dashboard Security
- Server-side session validation on all protected routes
- Input validation with Zod schemas
- Environment variables for sensitive configuration

## Implementation Priority

1. **Phase 1**: Database setup and basic analytics service
2. **Phase 2**: MCP middleware integration and testing
3. **Phase 3**: Next.js dashboard with login functionality
4. **Phase 4**: Chart components and dashboard features
5. **Phase 5**: Railway deployment and production configuration

## Next Steps for Implementation

1. Create the database connection and analytics service files
2. Apply the middleware wrapper to your existing BCP tools
3. Set up the Next.js dashboard project with shadcn/ui
4. Implement the login and dashboard pages
5. Deploy to Railway with PostgreSQL addon
6. Create initial admin user and test the complete flow

This architecture provides everything needed to start coding immediately while maintaining simplicity and avoiding over-engineering.