#!/usr/bin/env node

/**
 * Setup script for HubSpot MCP Analytics Database
 * 
 * This script:
 * 1. Tests database connection
 * 2. Runs schema migrations
 * 3. Verifies table creation
 * 4. Provides setup status
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testConnection() {
  console.log('🔍 Testing database connection...');
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    console.log(`   Server time: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(`   ${error.message}`);
    return false;
  }
}

async function runMigrations() {
  console.log('\n📋 Running database migrations...');
  try {
    const migrationPath = join(__dirname, '..', 'migrations', '001-initial-schema.sql');
    const migrationSQL = await readFile(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    console.log('✅ Schema migration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(`   ${error.message}`);
    return false;
  }
}

async function verifyTables() {
  console.log('\n🔍 Verifying table creation...');
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'tool_calls', 'errors', 'sessions')
      ORDER BY table_name
    `);
    
    const expectedTables = ['errors', 'sessions', 'tool_calls', 'users'];
    const actualTables = result.rows.map(row => row.table_name);
    
    console.log('   Expected tables:', expectedTables);
    console.log('   Found tables:', actualTables);
    
    const allTablesFound = expectedTables.every(table => actualTables.includes(table));
    
    if (allTablesFound) {
      console.log('✅ All tables created successfully');
      return true;
    } else {
      console.error('❌ Some tables are missing');
      return false;
    }
  } catch (error) {
    console.error('❌ Table verification failed:');
    console.error(`   ${error.message}`);
    return false;
  }
}

async function showIndexes() {
  console.log('\n📊 Checking indexes...');
  try {
    const result = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename IN ('tool_calls', 'errors', 'sessions')
      ORDER BY tablename, indexname
    `);
    
    if (result.rows.length > 0) {
      console.log('   Indexes found:');
      result.rows.forEach(row => {
        console.log(`   - ${row.tablename}.${row.indexname}`);
      });
    } else {
      console.log('   No custom indexes found');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Index check failed:');
    console.error(`   ${error.message}`);
    return false;
  }
}

async function showSetupInstructions() {
  console.log('\n📝 Setup Instructions:');
  console.log('   1. Add to your .env file:');
  console.log('      DATABASE_URL=postgresql://user:pass@host:port/database');
  console.log('      ANALYTICS_ENABLED=true');
  console.log('');
  console.log('   2. Install dependencies:');
  console.log('      npm install pg @types/pg');
  console.log('');
  console.log('   3. Run this setup script:');
  console.log('      node scripts/setup-analytics.js');
  console.log('');
  console.log('   4. Start your MCP server with analytics enabled!');
}

async function main() {
  console.log('🚀 HubSpot MCP Analytics Database Setup\n');
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    await showSetupInstructions();
    process.exit(1);
  }
  
  console.log(`   Database: ${process.env.DATABASE_URL.replace(/\/\/.*:.*@/, '//****:****@')}`);
  console.log(`   Analytics: ${process.env.ANALYTICS_ENABLED || 'not set'}`);
  
  let success = true;
  
  // Test connection
  success = await testConnection() && success;
  
  if (!success) {
    console.log('\n❌ Setup failed at connection test');
    await showSetupInstructions();
    await pool.end();
    process.exit(1);
  }
  
  // Run migrations
  success = await runMigrations() && success;
  
  // Verify tables
  success = await verifyTables() && success;
  
  // Show indexes
  await showIndexes();
  
  if (success) {
    console.log('\n✅ Analytics database setup completed successfully!');
    console.log('   Your HubSpot MCP server is now ready to track analytics.');
    console.log('   Tool calls and errors will be automatically logged to the database.');
  } else {
    console.log('\n❌ Setup completed with errors');
    console.log('   Please check the error messages above and resolve issues.');
  }
  
  await pool.end();
  process.exit(success ? 0 : 1);
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error during setup:');
  console.error(error);
  pool.end().finally(() => process.exit(1));
});

main().catch((error) => {
  console.error('\n❌ Setup script failed:');
  console.error(error);
  pool.end().finally(() => process.exit(1));
});