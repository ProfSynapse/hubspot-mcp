# PostgreSQL Integration Research

## Executive Summary

PostgreSQL integration with Node.js/TypeScript projects in 2024 emphasizes type safety, performance optimization, and production readiness. Key recommendations include using Prisma ORM for type-safe database operations with connection pooling, implementing proper environment variable management for Railway deployment, and following established patterns for analytics data storage.

**Primary Recommendations:**
- Use Prisma ORM with TypeScript for type safety and developer experience
- Implement connection pooling for optimal performance
- Structure analytics data with separate tables for tool usage, errors, and sessions
- Configure for Railway's managed PostgreSQL service

## Technology Overview

### Database Libraries Comparison

| Library | Type Safety | Learning Curve | Performance | Railway Compatibility |
|---------|------------|----------------|-------------|---------------------|
| Prisma ORM | Excellent | Low | Good | Native Support |
| node-postgres (pg) | Manual | Medium | Excellent | Native Support |
| TypeORM | Good | High | Good | Supported |
| Drizzle ORM | Excellent | Medium | Excellent | Supported |

### Prisma ORM (Recommended)

**Advantages:**
- Auto-generated TypeScript types from schema
- Intuitive query API with IntelliSense
- Built-in connection pooling
- Migration system
- Railway integration support

**Installation:**
```bash
npm install prisma @prisma/client
npm install prisma @prisma/adapter-pg pg
npm install -D @types/pg
```

### Alternative: Direct PostgreSQL (pg library)

**Use Cases:**
- High-performance requirements
- Custom query optimization needed
- Existing SQL expertise

**Installation:**
```bash
npm install pg
npm install -D @types/pg
```

## Detailed Implementation Patterns

### Prisma Configuration

**Schema Definition (schema.prisma):**
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  password  String
  createdAt DateTime @default(now())
  sessions  Session[]
  
  @@map("users")
}

model Session {
  id        String   @id @default(cuid())
  userId    Int
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("sessions")
}

model ToolUsage {
  id          Int      @id @default(autoincrement())
  toolName    String
  operation   String
  parameters  Json
  userId      Int?
  timestamp   DateTime @default(now())
  duration    Int?     // milliseconds
  success     Boolean  @default(true)
  
  @@map("tool_usage")
}

model ErrorLog {
  id        Int      @id @default(autoincrement())
  level     String   // error, warn, info
  message   String
  stack     String?
  context   Json?    // additional context
  toolName  String?
  operation String?
  userId    Int?
  timestamp DateTime @default(now())
  
  @@map("error_logs")
}
```

**Connection Setup:**
```typescript
// src/config/database.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? 
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Connection health check
export const checkDatabaseConnection = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};
```

### Direct PostgreSQL Pattern

**Connection Pool Setup:**
```typescript
// src/config/database-pg.ts
import { Pool, PoolConfig } from 'pg';

const config: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

export const pool = new Pool(config);

// Connection health check
export const checkConnection = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
```

## Railway Configuration

### Environment Variables

Railway automatically provides these variables for PostgreSQL addon:
- `DATABASE_URL` - Primary connection string
- `DATABASE_PUBLIC_URL` - External connection URL
- `POSTGRES_HOST` - Database host
- `POSTGRES_PORT` - Database port (usually 5432)
- `POSTGRES_DB` - Database name
- `POSTGRES_USER` - Username
- `POSTGRES_PASSWORD` - Password

### Railway-Specific Configuration

**railway.json:**
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Migration Strategy:**
```typescript
// src/scripts/migrate.ts
import { execSync } from 'child_process';

const runMigrations = async () => {
  try {
    console.log('Running database migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  runMigrations();
}
```

**package.json build script:**
```json
{
  "scripts": {
    "build": "npm run migrate && tsc",
    "migrate": "prisma migrate deploy",
    "postinstall": "prisma generate"
  }
}
```

## Analytics Schema Design

### Tool Usage Tracking

```sql
CREATE TABLE tool_usage (
  id SERIAL PRIMARY KEY,
  tool_name VARCHAR(255) NOT NULL,
  operation VARCHAR(255) NOT NULL,
  parameters JSONB,
  user_id INTEGER REFERENCES users(id),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration INTEGER, -- milliseconds
  success BOOLEAN DEFAULT true,
  response_size INTEGER -- bytes
);

-- Indexes for analytics queries
CREATE INDEX idx_tool_usage_timestamp ON tool_usage(timestamp);
CREATE INDEX idx_tool_usage_tool_name ON tool_usage(tool_name);
CREATE INDEX idx_tool_usage_success ON tool_usage(success);
```

### Error Logging Schema

```sql
CREATE TABLE error_logs (
  id SERIAL PRIMARY KEY,
  level VARCHAR(10) NOT NULL, -- error, warn, info
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB,
  tool_name VARCHAR(255),
  operation VARCHAR(255),
  user_id INTEGER REFERENCES users(id),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for error analysis
CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX idx_error_logs_level ON error_logs(level);
CREATE INDEX idx_error_logs_tool_name ON error_logs(tool_name);
```

## Performance Considerations

### Connection Pooling Configuration

```typescript
// Production-optimized pool settings
const poolConfig = {
  min: 5,           // Minimum connections
  max: 50,          // Maximum connections
  acquire: 30000,   // Maximum time to acquire connection (ms)
  idle: 10000,      // Maximum time connection can be idle (ms)
  evict: 1000,      // Check interval for eviction (ms)
};
```

### Query Optimization

```typescript
// Efficient analytics queries
export class AnalyticsService {
  async getToolUsageStats(timeRange: 'day' | 'week' | 'month') {
    const interval = timeRange === 'day' ? '24 hours' : 
                    timeRange === 'week' ? '7 days' : '30 days';
    
    return await prisma.toolUsage.groupBy({
      by: ['toolName', 'operation'],
      _count: { id: true },
      _avg: { duration: true },
      where: {
        timestamp: {
          gte: new Date(Date.now() - this.getIntervalMs(timeRange))
        }
      }
    });
  }
  
  private getIntervalMs(range: string): number {
    const intervals = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };
    return intervals[range] || intervals.day;
  }
}
```

## Security Best Practices

### Connection Security

```typescript
// Secure connection configuration
const secureConfig = {
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: process.env.DATABASE_SSL_CERT,
  } : false,
  // Connection timeout
  connectionTimeoutMillis: 5000,
  // Query timeout
  query_timeout: 30000,
  // Idle timeout
  idle_in_transaction_session_timeout: 30000
};
```

### Query Parameterization

```typescript
// Always use parameterized queries
const getUserByUsername = async (username: string) => {
  // GOOD - Using Prisma (automatically parameterized)
  return await prisma.user.findUnique({
    where: { username }
  });
  
  // GOOD - Using pg with parameters
  const result = await pool.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  return result.rows[0];
};
```

## Migration Strategy

### Development to Production

```typescript
// src/migrations/001_initial_schema.sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL
);

-- Tool usage tracking
CREATE TABLE tool_usage (
  id SERIAL PRIMARY KEY,
  tool_name VARCHAR(255) NOT NULL,
  operation VARCHAR(255) NOT NULL,
  parameters JSONB,
  user_id INTEGER REFERENCES users(id),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration INTEGER,
  success BOOLEAN DEFAULT true
);

-- Error logging
CREATE TABLE error_logs (
  id SERIAL PRIMARY KEY,
  level VARCHAR(10) NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB,
  tool_name VARCHAR(255),
  operation VARCHAR(255),
  user_id INTEGER REFERENCES users(id),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_tool_usage_timestamp ON tool_usage(timestamp);
CREATE INDEX idx_tool_usage_tool_name ON tool_usage(tool_name);
CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX idx_error_logs_level ON error_logs(level);
```

## Resource Links

- [Prisma PostgreSQL Documentation](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [Railway PostgreSQL Guide](https://docs.railway.com/guides/postgresql)
- [node-postgres Documentation](https://node-postgres.com/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

## Recommendations

1. **Use Prisma ORM** for type safety and developer experience
2. **Implement proper connection pooling** to handle concurrent requests
3. **Design analytics schema** with proper indexing for query performance  
4. **Set up automated migrations** for Railway deployment
5. **Monitor connection health** with periodic health checks
6. **Use JSONB columns** for flexible parameter and context storage
7. **Implement proper error handling** with retry mechanisms