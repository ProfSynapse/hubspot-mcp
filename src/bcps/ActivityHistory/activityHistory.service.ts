/**
 * Activity History Service
 * Manages activity logging and retrieval from PostgreSQL
 */

import { Pool } from 'pg';

export interface ActivityLog {
  id: string;
  timestamp: Date;
  domain: string;
  operation: string;
  parameters: any;
  response: any;
  success: boolean;
  error_message?: string;
  context?: string;
  goals?: string;
}

export class ActivityHistoryService {
  private pool: Pool;
  private initialized = false;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🔗 Initializing ActivityHistory database connection...');

    try {
      // Test connection first
      const client = await this.pool.connect();
      console.log('✅ Database connection successful');

      console.log('📋 Creating/updating activity_logs table and indexes...');

      // First create table with base structure if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          domain TEXT NOT NULL,
          operation TEXT NOT NULL,
          parameters JSONB,
          response JSONB,
          success BOOLEAN NOT NULL,
          error_message TEXT
        );
      `);

      // Then add new columns if they don't exist (migration)
      try {
        await client.query(`ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS context TEXT;`);
        console.log('✅ Added context column');
      } catch (error) {
        console.log('⚠️ Context column already exists or could not be added');
      }

      try {
        await client.query(`ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS goals TEXT;`);
        console.log('✅ Added goals column');
      } catch (error) {
        console.log('⚠️ Goals column already exists or could not be added');
      }

      // Create basic indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_domain_operation ON activity_logs(domain, operation);
      `);

      // Create text search indexes if columns exist
      try {
        await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_context ON activity_logs USING gin(to_tsvector('english', COALESCE(context, '')));`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_goals ON activity_logs USING gin(to_tsvector('english', COALESCE(goals, '')));`);
        console.log('✅ Created text search indexes');
      } catch (error) {
        console.log('⚠️ Text search indexes skipped:', error instanceof Error ? error.message : String(error));
      }

      console.log('✅ ActivityHistory database initialization complete');
      client.release();
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize activity history service:', error);
      console.error('   Database URL present:', !!process.env.DATABASE_URL);
      console.error('   Error details:', error instanceof Error ? error.message : String(error));
      // Don't throw - allow system to run without logging if DB is unavailable
    }
  }

  async logActivity(
    domain: string,
    operation: string,
    parameters: any,
    response: any,
    success: boolean,
    errorMessage?: string,
    contextData?: { context?: string; goals?: string }
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this.pool.query(
        `INSERT INTO activity_logs (domain, operation, parameters, response, success, error_message, context, goals)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [domain, operation, parameters, response, success, errorMessage, contextData?.context, contextData?.goals]
      );
    } catch (error) {
      console.error('Failed to log activity:', error);
      // Don't throw - logging failures shouldn't break the app
    }
  }

  async getRecentActivities(days: number = 7): Promise<ActivityLog[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const result = await this.pool.query<ActivityLog>(
        `SELECT id, timestamp, domain, operation, parameters, response, success, error_message, context, goals
         FROM activity_logs
         WHERE timestamp > NOW() - INTERVAL '${days} days'
         ORDER BY timestamp DESC
         LIMIT 1000`,
        []
      );

      return result.rows;
    } catch (error) {
      console.error('Failed to retrieve activities:', error);
      throw new Error(`Failed to retrieve activity history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cleanup(retentionDays: number = 30): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this.pool.query(
        `DELETE FROM activity_logs WHERE timestamp < NOW() - INTERVAL '${retentionDays} days'`
      );
    } catch (error) {
      console.error('Failed to cleanup old activities:', error);
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}