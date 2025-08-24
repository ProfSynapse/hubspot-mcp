import { Pool } from 'pg';

/**
 * PostgreSQL connection pool for analytics database
 * Provides optimized connections for analytics operations
 */
class DatabaseManager {
  private pool: Pool;
  private static instance: DatabaseManager;

  private constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });

    // Log successful connections in development
    this.pool.on('connect', (client) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('New database connection established');
      }
    });
  }

  /**
   * Get singleton instance of database manager
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Get the connection pool
   */
  public getPool(): Pool {
    return this.pool;
  }

  /**
   * Execute a query with parameters
   */
  public async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Query executed', { text, duration, rows: res.rowCount });
      }
      
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.pool.query('SELECT NOW()');
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Close all connections in the pool
   */
  public async close(): Promise<void> {
    await this.pool.end();
  }
}

// Export singleton instance
const database = DatabaseManager.getInstance();
export default database;

// Export pool directly for compatibility
export const pool = database.getPool();