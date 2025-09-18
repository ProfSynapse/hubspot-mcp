/**
 * Database initialization script
 * Run this to manually create the activity_logs table
 */

const { Pool } = require('pg');

async function initializeDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🔗 Connecting to database...');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');

    // Create table
    console.log('📋 Creating activity_logs table...');
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

      CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_domain_operation ON activity_logs(domain, operation);
    `);

    console.log('✅ Table and indexes created successfully');

    // Test insert
    console.log('🧪 Testing insert...');
    await client.query(`
      INSERT INTO activity_logs (domain, operation, parameters, response, success)
      VALUES ('Test', 'initialize', '{}', '{"message": "Database initialized"}', true)
    `);

    console.log('✅ Test insert successful');

    // Check table
    const result = await client.query('SELECT COUNT(*) FROM activity_logs');
    console.log(`📊 Current activity log count: ${result.rows[0].count}`);

    client.release();

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log('🎉 Database initialization complete!');
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };