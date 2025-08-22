/**
 * Session Management System
 * Location: src/core/session-manager.ts
 * 
 * This module provides HTTP session management for the MCP server, including session
 * creation, cleanup, and state tracking. It's designed to work with the StreamableHTTPServerTransport
 * and support multiple concurrent client sessions.
 */

import { randomUUID } from 'crypto';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

export interface AuthContext {
  userId: string;
  permissions: string[];
  sessionId?: string;
  exp: number;
  iat: number;
  role?: string;
}

export interface SessionMetadata {
  userAgent?: string;
  clientIP?: string;
  clientInfo?: {
    name: string;
    version: string;
  };
  protocolVersion?: string;
  capabilities?: any;
}

export enum SessionState {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  IDLE = 'idle',
  EXPIRED = 'expired',
  TERMINATED = 'terminated'
}

export interface SessionContext {
  id: string;
  transport: SSEServerTransport;
  auth?: AuthContext;
  created: Date;
  lastActivity: Date;
  metadata: SessionMetadata;
  state: SessionState;
}

interface SessionConfig {
  maxAge: number;                // Session TTL in milliseconds
  cleanupInterval: number;       // Cleanup interval in milliseconds
  maxSessions: number;          // Maximum concurrent sessions
  idleTimeout: number;          // Idle timeout in milliseconds
}

export class SessionManager {
  private sessions = new Map<string, SessionContext>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  
  constructor(private config: SessionConfig) {
    console.log(`[SessionManager] Initializing with maxSessions: ${config.maxSessions}, maxAge: ${config.maxAge}ms`);
    this.startCleanup();
  }
  
  createSession(auth?: AuthContext, metadata: Partial<SessionMetadata> = {}): SessionContext {
    if (this.sessions.size >= this.config.maxSessions) {
      throw new Error(`Maximum session limit reached (${this.config.maxSessions})`);
    }
    
    const sessionId = this.generateSessionId();
    const now = new Date();
    
    const session: SessionContext = {
      id: sessionId,
      transport: new SSEServerTransport('/mcp', {} as any), // Will be properly initialized in HTTP server
      auth,
      created: now,
      lastActivity: now,
      metadata: {
        ...metadata,
        protocolVersion: '2025-03-26'
      },
      state: SessionState.INITIALIZING
    };
    
    this.sessions.set(sessionId, session);
    
    // Log session creation
    console.log(`[SessionManager] Session created: ${sessionId} for user ${auth?.userId || 'anonymous'}`);
    
    return session;
  }
  
  getSession(sessionId: string): SessionContext | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    // Check if session is expired
    if (this.isExpired(session)) {
      this.terminateSession(sessionId);
      return null;
    }
    
    // Update activity timestamp
    session.lastActivity = new Date();
    session.state = SessionState.ACTIVE;
    
    return session;
  }
  
  updateActivity(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    session.lastActivity = new Date();
    session.state = SessionState.ACTIVE;
    return true;
  }
  
  terminateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    try {
      session.transport.close();
      session.state = SessionState.TERMINATED;
    } catch (error) {
      console.warn(`[SessionManager] Error closing transport for session ${sessionId}:`, error);
    }
    
    this.sessions.delete(sessionId);
    console.log(`[SessionManager] Session terminated: ${sessionId}`);
    return true;
  }
  
  terminateUserSessions(userId: string): number {
    let terminated = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.auth?.userId === userId) {
        this.terminateSession(sessionId);
        terminated++;
      }
    }
    
    if (terminated > 0) {
      console.log(`[SessionManager] Terminated ${terminated} sessions for user ${userId}`);
    }
    
    return terminated;
  }
  
  private generateSessionId(): string {
    return randomUUID();
  }
  
  private isExpired(session: SessionContext): boolean {
    const now = Date.now();
    const maxAge = this.config.maxAge;
    const idleTimeout = this.config.idleTimeout;
    
    return (
      now - session.created.getTime() > maxAge ||
      now - session.lastActivity.getTime() > idleTimeout
    );
  }
  
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
    
    console.log(`[SessionManager] Started cleanup timer with ${this.config.cleanupInterval}ms interval`);
  }
  
  private cleanup(): void {
    const expiredSessions: string[] = [];
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (this.isExpired(session)) {
        expiredSessions.push(sessionId);
      } else if (Date.now() - session.lastActivity.getTime() > this.config.idleTimeout / 2) {
        // Mark sessions as idle if they've been inactive for half the idle timeout
        session.state = SessionState.IDLE;
      }
    }
    
    expiredSessions.forEach(sessionId => {
      this.terminateSession(sessionId);
    });
    
    if (expiredSessions.length > 0) {
      console.log(`[SessionManager] Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }
  
  getStats() {
    const states = Object.values(SessionState);
    const stats = {
      total: this.sessions.size,
      maxSessions: this.config.maxSessions,
      byState: {} as Record<SessionState, number>,
      userSessions: new Map<string, number>()
    };
    
    // Count sessions by state
    states.forEach(state => {
      stats.byState[state] = 0;
    });
    
    for (const session of this.sessions.values()) {
      stats.byState[session.state]++;
      
      // Count sessions per user
      if (session.auth?.userId) {
        const count = stats.userSessions.get(session.auth.userId) || 0;
        stats.userSessions.set(session.auth.userId, count + 1);
      }
    }
    
    return stats;
  }
  
  getSessionsByUser(userId: string): SessionContext[] {
    return Array.from(this.sessions.values()).filter(
      session => session.auth?.userId === userId
    );
  }
  
  getActiveSessionCount(): number {
    return Array.from(this.sessions.values()).filter(
      session => session.state === SessionState.ACTIVE
    ).length;
  }
  
  shutdown(): void {
    console.log('[SessionManager] Shutting down...');
    
    // Clear cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // Terminate all sessions
    const sessionIds = Array.from(this.sessions.keys());
    sessionIds.forEach(sessionId => {
      this.terminateSession(sessionId);
    });
    
    console.log(`[SessionManager] Shutdown complete, terminated ${sessionIds.length} sessions`);
  }
}