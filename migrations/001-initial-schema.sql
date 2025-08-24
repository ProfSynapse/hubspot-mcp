-- HubSpot MCP Analytics Database Schema
-- Migration 001: Initial schema setup
-- Created: 2025-08-24

BEGIN;

-- 1. Users table for basic authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tool calls tracking table
CREATE TABLE IF NOT EXISTS tool_calls (
  id SERIAL PRIMARY KEY,
  tool_name VARCHAR(100) NOT NULL,
  operation VARCHAR(100),
  params JSONB,
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Errors tracking table
CREATE TABLE IF NOT EXISTS errors (
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
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR(255) PRIMARY KEY,
  data TEXT NOT NULL,
  expires TIMESTAMP NOT NULL
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_tool_calls_timestamp ON tool_calls(timestamp);
CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name ON tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_calls_success ON tool_calls(success);
CREATE INDEX IF NOT EXISTS idx_tool_calls_operation ON tool_calls(operation);

CREATE INDEX IF NOT EXISTS idx_errors_timestamp ON errors(timestamp);
CREATE INDEX IF NOT EXISTS idx_errors_tool_name ON errors(tool_name);
CREATE INDEX IF NOT EXISTS idx_errors_code ON errors(error_code);
CREATE INDEX IF NOT EXISTS idx_errors_operation ON errors(operation);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);

-- Comment on tables for documentation
COMMENT ON TABLE users IS 'Authentication users for analytics dashboard';
COMMENT ON TABLE tool_calls IS 'Log of all MCP tool invocations with performance metrics';
COMMENT ON TABLE errors IS 'Detailed error logs for failed tool calls';
COMMENT ON TABLE sessions IS 'Session storage for express-session middleware';

-- Comment on key columns
COMMENT ON COLUMN tool_calls.params IS 'JSON parameters passed to the tool call';
COMMENT ON COLUMN tool_calls.response_time_ms IS 'Response time in milliseconds';
COMMENT ON COLUMN errors.params IS 'JSON parameters that caused the error';
COMMENT ON COLUMN errors.stack_trace IS 'Full error stack trace for debugging';

COMMIT;