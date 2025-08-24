/**
 * SQLite Database Service for Local Development
 * Provides SQLite implementation for analytics tracking
 */

import * as sqlite3 from 'sqlite3';
import { promisify } from 'util';
import * as path from 'path';

export class SQLiteDatabase {
  private db: sqlite3.Database;
  private initialized = false;

  constructor(dbPath: string = './analytics.db') {
    this.db = new sqlite3.Database(dbPath);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const run = promisify(this.db.run.bind(this.db));

    // Create tables
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS tool_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        domain TEXT NOT NULL,
        operation TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        response_time INTEGER,
        parameters TEXT,
        response_size INTEGER
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        domain TEXT NOT NULL,
        operation TEXT NOT NULL,
        error_type TEXT NOT NULL,
        error_message TEXT NOT NULL,
        stack_trace TEXT,
        parameters TEXT
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire DATETIME NOT NULL
      )
    `);

    // Create indexes for performance
    await run(`CREATE INDEX IF NOT EXISTS idx_tool_calls_timestamp ON tool_calls(timestamp)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_tool_calls_domain ON tool_calls(domain)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_errors_timestamp ON errors(timestamp)`);

    this.initialized = true;
    console.log('SQLite database initialized');
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// Singleton instance
let dbInstance: SQLiteDatabase;

export function getSQLiteDatabase(): SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = new SQLiteDatabase();
  }
  return dbInstance;
}