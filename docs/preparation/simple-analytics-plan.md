# Simple Analytics Plan for HubSpot MCP Server

## Executive Summary

This document outlines a minimal viable analytics solution for tracking HubSpot MCP tool usage and errors. The system focuses on simplicity with a PostgreSQL database, basic authentication, and a Next.js dashboard using shadcn/ui components. This approach provides essential monitoring capabilities without over-engineering.

**Key Goals:**
- Track MCP tool usage patterns and frequency
- Monitor errors for debugging and reliability
- Provide basic admin dashboard for insights
- Keep implementation minimal and maintainable

## Technology Overview

### Database: PostgreSQL with node-postgres
- **Library**: `pg` (node-postgres) - industry standard, built-in connection pooling
- **Connection**: Railway PostgreSQL addon with automatic environment variables
- **Architecture**: Simple connection pool with error handling

### Authentication: Basic bcrypt + Express Sessions
- **Password Hashing**: bcrypt with salt rounds 12+ for production security
- **Session Management**: Express-session with server-side storage
- **Storage**: PostgreSQL session store for persistence

### Dashboard: Next.js 15 + shadcn/ui + recharts
- **Framework**: Next.js 15 with TypeScript support
- **UI Components**: shadcn/ui for consistent, accessible design
- **Charts**: recharts for simple analytics visualization
- **Forms**: react-hook-form + Zod validation

## Database Schema (4 Tables Maximum)

### 1. users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. tool_calls Table
```sql
CREATE TABLE tool_calls (
  id SERIAL PRIMARY KEY,
  tool_name VARCHAR(100) NOT NULL,
  operation VARCHAR(100),
  params JSONB,
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tool_calls_timestamp (timestamp),
  INDEX idx_tool_calls_tool_name (tool_name)
);
```

### 3. errors Table
```sql
CREATE TABLE errors (
  id SERIAL PRIMARY KEY,
  tool_name VARCHAR(100) NOT NULL,
  operation VARCHAR(100),
  error_message TEXT NOT NULL,
  error_code VARCHAR(50),
  params JSONB,
  stack_trace TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_errors_timestamp (timestamp),
  INDEX idx_errors_tool_name (tool_name)
);
```

### 4. sessions Table (for express-session)
```sql
CREATE TABLE sessions (
  sid VARCHAR(255) PRIMARY KEY,
  data TEXT NOT NULL,
  expires TIMESTAMP NOT NULL
);
```

## Implementation Components

### 1. Database Connection (database.js)
```javascript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err, client) => {
  console.error('Database pool error:', err);
});

export default pool;
```

### 2. Analytics Service (analytics-service.js)
```javascript
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
}
```

### 3. Basic Authentication (auth.js)
```javascript
import bcrypt from 'bcrypt';
import pool from './database.js';

export class AuthService {
  async createUser(username, password) {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, passwordHash]
    );
  }

  async validateUser(username, password) {
    const result = await pool.query(
      'SELECT id, password_hash FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) return null;
    
    const isValid = await bcrypt.compare(password, result.rows[0].password_hash);
    return isValid ? { id: result.rows[0].id, username } : null;
  }
}
```

## Railway Deployment Setup

### 1. Add PostgreSQL Service
```bash
# In Railway dashboard:
# 1. Create new PostgreSQL service
# 2. Railway automatically provides these environment variables:
#    - DATABASE_URL
#    - PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
```

### 2. Environment Variables
```bash
# Railway automatically provides:
DATABASE_URL=postgresql://postgres:password@host:port/database
SESSION_SECRET=your-session-secret-key
NODE_ENV=production
```

### 3. Database Initialization
```sql
-- Run once during deployment
-- Create tables using migration script or manual execution
```

## Dashboard Implementation

### 1. Next.js Project Structure
```
dashboard/
├── app/
│   ├── login/
│   │   └── page.tsx          # Login form with shadcn/ui
│   ├── dashboard/
│   │   ├── page.tsx          # Main dashboard with charts
│   │   └── errors/
│   │       └── page.tsx      # Error log table
│   └── layout.tsx
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── login-form.tsx        # Login form component
│   ├── usage-chart.tsx       # Tool usage charts
│   └── error-table.tsx       # Error log display
└── lib/
    ├── auth.ts              # Authentication utilities
    └── analytics-api.ts     # API client for analytics
```

### 2. Key Components

#### Login Form (components/login-form.tsx)
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';

const loginSchema = z.object({
  username: z.string().min(1, 'Username required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export function LoginForm() {
  const form = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    // Handle login logic
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        {/* Password field similar structure */}
        <Button type="submit">Login</Button>
      </form>
    </Form>
  );
}
```

#### Usage Chart (components/usage-chart.tsx)
```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface UsageChartProps {
  data: Array<{
    tool_name: string;
    call_count: number;
    avg_response_time: number;
  }>;
}

export function UsageChart({ data }: UsageChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="tool_name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="call_count" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

## Integration with MCP Server

### 1. Middleware Integration
```javascript
// Add to your MCP server's tool handlers
import { AnalyticsService } from './analytics-service.js';

const analytics = new AnalyticsService();

// Wrap tool handlers
export function withAnalytics(originalHandler, toolName, operation) {
  return async (params) => {
    const startTime = Date.now();
    
    try {
      const result = await originalHandler(params);
      const responseTime = Date.now() - startTime;
      
      await analytics.logToolCall(toolName, operation, params, true, responseTime);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await analytics.logError(
        toolName,
        operation,
        error.message,
        error.code,
        params,
        error.stack
      );
      
      await analytics.logToolCall(toolName, operation, params, false, responseTime);
      throw error;
    }
  };
}
```

### 2. Apply to Existing Tools
```javascript
// Example: Wrap your existing HubSpot tools
const originalCompanyGet = companies.get;
companies.get = withAnalytics(originalCompanyGet, 'hubspotCompany', 'get');

const originalContactCreate = contacts.create;
contacts.create = withAnalytics(originalContactCreate, 'hubspotContact', 'create');
```

## Security Considerations

### 1. Database Security
- Use connection pooling to prevent connection exhaustion
- Parameterized queries to prevent SQL injection
- Index frequently queried columns for performance

### 2. Authentication Security
- bcrypt with salt rounds 12+ for password hashing
- Secure session configuration with proper expiration
- Environment variables for sensitive data

### 3. Dashboard Security
- Server-side session validation
- CSRF protection for forms
- Input validation with Zod schemas

## Deployment Checklist

- [ ] Railway PostgreSQL service created
- [ ] Environment variables configured (DATABASE_URL, SESSION_SECRET)
- [ ] Database tables created via migration
- [ ] Initial admin user created
- [ ] MCP server middleware integrated
- [ ] Dashboard deployed with authentication
- [ ] Basic monitoring and error alerting

## Monitoring and Maintenance

### Key Metrics to Track
1. **Tool Usage**: Calls per hour/day, most used tools
2. **Performance**: Average response times, slow operations
3. **Errors**: Error rates, common failure patterns
4. **System Health**: Database connection status, memory usage

### Simple Alerting
- Log critical errors to console/file
- Monitor error rate increases
- Track unusual usage patterns

This plan provides a solid foundation for MCP analytics while maintaining simplicity and avoiding over-engineering. The system can be extended as needed but starts with essential functionality only.