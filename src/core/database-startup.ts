/**
 * Database startup initialization
 * Checks and sets up database during server startup
 */

import { Pool } from 'pg';

export async function initializeDatabaseOnStartup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log('📝 No DATABASE_URL found - activity tracking disabled');
    return;
  }

  console.log('🔍 Checking database setup...');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Test connection
    const client = await pool.connect();

    // Check if activity_logs table exists
    const tableCheckResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'activity_logs'
      );
    `);

    const tableExists = tableCheckResult.rows[0].exists;

    if (tableExists) {
      console.log('✅ Database already configured - activity_logs table exists');
    } else {
      console.log('🔧 Setting up database - creating activity_logs table...');

      await client.query(`
        CREATE TABLE activity_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          domain TEXT NOT NULL,
          operation TEXT NOT NULL,
          parameters JSONB,
          response JSONB,
          success BOOLEAN NOT NULL,
          error_message TEXT
        );

        CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp);
        CREATE INDEX idx_activity_logs_domain_operation ON activity_logs(domain, operation);
      `);

      console.log('✅ Database setup complete - activity tracking enabled');
    }

    client.release();
    await pool.end();

  } catch (error) {
    console.error('❌ Database setup failed:', error instanceof Error ? error.message : String(error));
    console.log('⚠️  Continuing without activity tracking...');
    await pool.end();
  }
}