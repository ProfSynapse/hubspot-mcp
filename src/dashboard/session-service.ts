/**
 * Dashboard Session Management Service
 * Location: src/dashboard/session-service.ts
 * 
 * This service provides Express session configuration with PostgreSQL storage
 * for the analytics dashboard. It handles session creation, validation, and cleanup
 * using the connect-pg-simple package for PostgreSQL session storage.
 */

import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from '../analytics/database.js';

// Create PostgreSQL session store
const PgSession = connectPgSimple(session);

// Session configuration interface
export interface SessionConfig {
  secret: string;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none' | boolean;
}

// User session data
export interface SessionUser {
  id: number;
  username: string;
  loginTime: Date;
}

// Extend express session data
declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
    isAuthenticated?: boolean;
  }
}

/**
 * Dashboard Session Service
 * Manages Express sessions with PostgreSQL storage
 */
export class DashboardSessionService {
  private store: connectPgSimple.PGStore;
  private sessionConfig: session.SessionOptions;

  constructor(config: SessionConfig) {
    // Create PostgreSQL session store
    this.store = new PgSession({
      pool: pool,
      tableName: 'sessions',
      createTableIfMissing: false, // Table should already exist from migrations
      pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
      errorLog: (error: Error) => {
        console.error('Session store error:', error);
      }
    });

    // Configure session options
    this.sessionConfig = {
      store: this.store,
      secret: config.secret,
      resave: false,
      saveUninitialized: false,
      rolling: true, // Reset expiration on activity
      cookie: {
        maxAge: config.maxAge || 24 * 60 * 60 * 1000, // 24 hours default
        secure: config.secure || process.env.NODE_ENV === 'production',
        httpOnly: config.httpOnly !== false, // Default to true
        sameSite: config.sameSite || 'strict'
      },
      name: 'hubspot-mcp-dashboard', // Custom session name
      genid: () => {
        // Generate custom session ID
        return `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
    };
  }

  /**
   * Get the configured session middleware
   */
  getMiddleware(): session.RequestHandler {
    return session(this.sessionConfig);
  }

  /**
   * Create a user session (called after successful login)
   */
  createUserSession(req: any, user: { id: number; username: string }): void {
    req.session.user = {
      id: user.id,
      username: user.username,
      loginTime: new Date()
    };
    req.session.isAuthenticated = true;
  }

  /**
   * Destroy a user session (for logout)
   */
  destroySession(req: any): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.destroy((error: any) => {
        if (error) {
          console.error('Session destruction error:', error);
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(req: any): boolean {
    return !!(req.session && req.session.isAuthenticated && req.session.user);
  }

  /**
   * Get current user from session
   */
  getCurrentUser(req: any): SessionUser | null {
    if (this.isAuthenticated(req)) {
      return req.session.user || null;
    }
    return null;
  }

  /**
   * Update session activity (extend expiration)
   */
  touch(req: any): void {
    if (req.session) {
      req.session.touch();
    }
  }

  /**
   * Get session statistics from database
   */
  async getSessionStats(): Promise<{
    activeSessions: number;
    totalSessions: number;
    oldestSession: Date | null;
  }> {
    try {
      const activeResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM sessions 
        WHERE expires > NOW()
      `);

      const totalResult = await pool.query('SELECT COUNT(*) as count FROM sessions');

      const oldestResult = await pool.query(`
        SELECT MIN(expires - INTERVAL '24 hours') as oldest
        FROM sessions 
        WHERE expires > NOW()
      `);

      return {
        activeSessions: parseInt(activeResult.rows[0]?.count || '0'),
        totalSessions: parseInt(totalResult.rows[0]?.count || '0'),
        oldestSession: oldestResult.rows[0]?.oldest || null
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      return {
        activeSessions: 0,
        totalSessions: 0,
        oldestSession: null
      };
    }
  }

  /**
   * Cleanup expired sessions manually
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await pool.query(`
        DELETE FROM sessions 
        WHERE expires < NOW()
      `);
      
      const deletedCount = result.rowCount || 0;
      console.log(`Cleaned up ${deletedCount} expired sessions`);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  /**
   * Get all active user sessions (for admin purposes)
   */
  async getActiveSessions(): Promise<Array<{
    sessionId: string;
    userId?: number;
    username?: string;
    loginTime?: Date;
    expires: Date;
  }>> {
    try {
      const result = await pool.query(`
        SELECT sid, data, expires 
        FROM sessions 
        WHERE expires > NOW()
        ORDER BY expires DESC
      `);

      return result.rows.map(row => {
        let sessionData: any = {};
        
        try {
          sessionData = JSON.parse(row.data);
        } catch (error) {
          console.warn('Failed to parse session data for session:', row.sid);
        }

        return {
          sessionId: row.sid,
          userId: sessionData?.user?.id,
          username: sessionData?.user?.username,
          loginTime: sessionData?.user?.loginTime ? new Date(sessionData.user.loginTime) : undefined,
          expires: new Date(row.expires)
        };
      });
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }

  /**
   * Revoke a specific session by ID (for admin purposes)
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'DELETE FROM sessions WHERE sid = $1',
        [sessionId]
      );
      
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error revoking session:', error);
      return false;
    }
  }

  /**
   * Health check for session service
   */
  async healthCheck(): Promise<{ status: string; message: string; stats?: any }> {
    try {
      // Test session store connection
      await pool.query('SELECT COUNT(*) FROM sessions');
      
      const stats = await this.getSessionStats();
      
      return {
        status: 'healthy',
        message: 'Session service operational',
        stats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Session service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get the session store instance (for advanced usage)
   */
  getStore(): connectPgSimple.PGStore {
    return this.store;
  }
}

// Factory function to create session service
export function createSessionService(config: SessionConfig): DashboardSessionService {
  return new DashboardSessionService(config);
}

export type { SessionUser, SessionConfig };