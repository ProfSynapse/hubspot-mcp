/**
 * Location: /src/http-server-sdk.ts
 * 
 * MCP HTTP Server using Official SDK with Delegated BCP Tools.
 * 
 * This implementation uses the official MCP SDK StreamableHTTPServerTransport 
 * while reusing all existing BCP tool implementations through a clean delegation 
 * pattern. Follows SOLID principles by separating transport concerns from 
 * business logic.
 * 
 * Used by:
 * - Railway deployment: Entry point for the production server
 * - Development: Local server for testing and development
 * 
 * How it works with other files:
 * - Uses BcpToolDelegator to map operations to existing BCP tools
 * - Uses ToolRegistrationFactory to register consolidated domain tools
 * - Leverages existing configuration, logging, and error handling utilities
 * - Maintains session state and transport management for MCP protocol
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest, JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

// Import our new delegation architecture
import { BcpToolDelegator } from './core/bcp-tool-delegator.js';
import { BcpToolRegistrationFactory } from './core/tool-registration-factory.js';

// Import existing configuration and utilities
import { loadConfig, validateConfiguration, isDevelopment } from './config/environment.js';
import { createLogger } from './utils/logger.js';

// Enhanced event store for resumability with cleanup
class EnhancedEventStore {
  private events: Map<string, { eventId: string; message: JSONRPCMessage; timestamp: number }[]> = new Map();
  private eventCounter = 0;
  private readonly MAX_EVENTS_PER_STREAM = 1000;
  private readonly EVENT_RETENTION_MS = 30 * 60 * 1000; // 30 minutes

  async storeEvent(streamId: string, message: JSONRPCMessage): Promise<string> {
    const eventId = `event_${++this.eventCounter}`;
    const timestamp = Date.now();
    
    if (!this.events.has(streamId)) {
      this.events.set(streamId, []);
    }
    
    const streamEvents = this.events.get(streamId)!;
    streamEvents.push({ eventId, message, timestamp });
    
    // Clean up old events to prevent memory leaks
    this.cleanupOldEvents(streamId);
    
    return eventId;
  }

  async replayEventsAfter(lastEventId: string, { send }: {
    send: (eventId: string, message: JSONRPCMessage) => Promise<void>
  }): Promise<string> {
    const streamId = 'default';
    const events = this.events.get(streamId) || [];
    
    let startIndex = 0;
    if (lastEventId) {
      startIndex = events.findIndex(e => e.eventId === lastEventId) + 1;
    }

    for (let i = startIndex; i < events.length; i++) {
      const event = events[i];
      await send(event.eventId, event.message);
    }

    return streamId;
  }

  private cleanupOldEvents(streamId: string): void {
    const events = this.events.get(streamId);
    if (!events) return;

    const now = Date.now();
    const cutoffTime = now - this.EVENT_RETENTION_MS;
    
    // Remove events older than retention period
    const filteredEvents = events.filter(event => event.timestamp > cutoffTime);
    
    // Limit the number of events per stream
    if (filteredEvents.length > this.MAX_EVENTS_PER_STREAM) {
      filteredEvents.splice(0, filteredEvents.length - this.MAX_EVENTS_PER_STREAM);
    }
    
    this.events.set(streamId, filteredEvents);
  }

  // Cleanup method for specific stream
  cleanupStream(streamId: string): void {
    this.events.delete(streamId);
  }

  // Get stream statistics
  getStats(): { streams: number; totalEvents: number } {
    let totalEvents = 0;
    for (const events of this.events.values()) {
      totalEvents += events.length;
    }
    return {
      streams: this.events.size,
      totalEvents
    };
  }
}

// Load configuration
const config = loadConfig();
validateConfiguration(config);

const logger = createLogger({
  level: config.LOG_LEVEL || 'info',
  environment: config.NODE_ENV || 'development',
  serviceName: 'hubspot-mcp-sdk',
  version: '0.1.0'
});

const PORT = config.PORT || 3000;

// Create Express app
const app = express();
app.use(express.json());

// CORS configuration
app.use(cors({
  origin: '*',
  exposedHeaders: ["Mcp-Session-Id"],
  credentials: true
}));

// Global MCP server instance to prevent duplicate tool registration
let globalMCPServer: McpServer | null = null;
let globalDelegator: BcpToolDelegator | null = null;

/**
 * Create or return existing MCP Server with Delegated BCP Tools
 * This prevents duplicate tool registration on session reconnects
 */
async function getOrCreateMCPServer(): Promise<{ server: McpServer; delegator: BcpToolDelegator }> {
  // Return existing server if already created
  if (globalMCPServer && globalDelegator) {
    logger.debug('♻️ Reusing existing MCP Server instance');
    return { server: globalMCPServer, delegator: globalDelegator };
  }

  logger.info('🚀 Creating new MCP Server with delegated BCP tools...');
  
  // Validate HubSpot API token
  const apiKey = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!apiKey) {
    throw new Error('HUBSPOT_ACCESS_TOKEN environment variable is required');
  }
  
  // Create the MCP server instance
  const server = new McpServer({
    name: 'hubspot-mcp',
    version: '0.1.0',
  }, {
    capabilities: {
      tools: {},
      logging: {}
    }
  });

  // Create delegation architecture components
  const delegator = new BcpToolDelegator();
  const toolFactory = new BcpToolRegistrationFactory();
  
  // Register all domain tools using the delegation pattern
  try {
    await toolFactory.registerAllTools(server, delegator);
    logger.info('✅ All BCP tools registered successfully through delegation layer');
    
    // Log cache statistics
    const cacheStats = delegator.getCacheStats();
    logger.info(`📊 Cache initialized: ${cacheStats.bcpCount} BCPs, ${cacheStats.toolCount} tools`);
  } catch (error) {
    logger.error('❌ Failed to register BCP tools:', error);
    throw error;
  }

  // Store global references
  globalMCPServer = server;
  globalDelegator = delegator;

  return { server, delegator };
}

// Session state management
interface SessionInfo {
  transport: StreamableHTTPServerTransport;
  mcpServer: McpServer;
  eventStore: EnhancedEventStore;
  createdAt: number;
  lastActivity: number;
  status: 'initializing' | 'active' | 'closing' | 'closed';
  heartbeatInterval?: NodeJS.Timeout;
}

class SessionManager {
  private sessions: Map<string, SessionInfo> = new Map();
  private readonly SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  private readonly HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Start periodic cleanup of stale sessions
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, 60 * 1000); // Check every minute
  }

  createSession(sessionId: string, transport: StreamableHTTPServerTransport, mcpServer: McpServer, eventStore: EnhancedEventStore): void {
    const now = Date.now();
    
    // Clean up existing session if it exists
    if (this.sessions.has(sessionId)) {
      logger.warn({ sessionId }, 'Replacing existing session');
      this.closeSession(sessionId);
    }

    const sessionInfo: SessionInfo = {
      transport,
      mcpServer,
      eventStore,
      createdAt: now,
      lastActivity: now,
      status: 'initializing'
    };

    // Setup heartbeat
    sessionInfo.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat(sessionId);
    }, this.HEARTBEAT_INTERVAL_MS);

    this.sessions.set(sessionId, sessionInfo);
    logger.info({ sessionId, totalSessions: this.sessions.size }, 'Session created');
  }

  getSession(sessionId: string): SessionInfo | undefined {
    const session = this.sessions.get(sessionId);
    if (session && session.status !== 'closed') {
      session.lastActivity = Date.now();
      return session;
    }
    return undefined;
  }

  updateSessionStatus(sessionId: string, status: SessionInfo['status']): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      session.lastActivity = Date.now();
      logger.debug({ sessionId, status }, 'Session status updated');
    }
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    logger.info({ sessionId }, 'Closing session');
    
    try {
      // Clear heartbeat
      if (session.heartbeatInterval) {
        clearInterval(session.heartbeatInterval);
      }

      // Clean up event store
      session.eventStore.cleanupStream(sessionId);

      // Close transport
      session.transport.close?.();
      
      // Update status
      session.status = 'closed';
    } catch (error) {
      logger.error({ error, sessionId }, 'Error during session cleanup');
    } finally {
      this.sessions.delete(sessionId);
      logger.info({ sessionId, remainingSessions: this.sessions.size }, 'Session closed and removed');
    }
  }

  private async sendHeartbeat(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return;
    }

    try {
      // Simple heartbeat - could be enhanced with ping/pong mechanism
      logger.debug({ sessionId }, 'Heartbeat sent');
      session.lastActivity = Date.now();
    } catch (error) {
      logger.error({ error, sessionId }, 'Heartbeat failed, marking session for cleanup');
      session.status = 'closing';
    }
  }

  private cleanupStaleSessions(): void {
    const now = Date.now();
    const staleSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const inactiveTime = now - session.lastActivity;
      
      if (inactiveTime > this.SESSION_TIMEOUT_MS || session.status === 'closing') {
        staleSessions.push(sessionId);
      }
    }

    if (staleSessions.length > 0) {
      logger.info({ count: staleSessions.length, sessions: staleSessions }, 'Cleaning up stale sessions');
      
      for (const sessionId of staleSessions) {
        this.closeSession(sessionId);
      }
    }
  }

  getStats(): { active: number; total: number; avgAge: number } {
    const now = Date.now();
    let totalAge = 0;
    let activeCount = 0;

    for (const session of this.sessions.values()) {
      if (session.status === 'active') {
        activeCount++;
      }
      totalAge += now - session.createdAt;
    }

    return {
      active: activeCount,
      total: this.sessions.size,
      avgAge: this.sessions.size > 0 ? totalAge / this.sessions.size : 0
    };
  }

  shutdown(): void {
    logger.info('Shutting down session manager');
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all sessions
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      this.closeSession(sessionId);
    }
  }
}

// Global session manager instance
const sessionManager = new SessionManager();

// Legacy compatibility - map interface
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = new Proxy({}, {
  get(target, sessionId: string) {
    const session = sessionManager.getSession(sessionId);
    return session?.transport;
  },
  has(target, sessionId: string) {
    return sessionManager.getSession(sessionId) !== undefined;
  },
  set() {
    throw new Error('Use sessionManager.createSession() instead');
  },
  deleteProperty(target, sessionId: string) {
    sessionManager.closeSession(sessionId);
    return true;
  }
});

/**
 * Handle MCP POST requests (client-to-server communication)
 */
const handleMCPPost = async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  
  logger.info({ 
    sessionId, 
    method: req.body?.method,
    hasSessionId: !!sessionId,
    isInitialize: !sessionId && isInitializeRequest(req.body)
  }, 'MCP POST request received');

  try {
    // Handle existing session
    if (sessionId) {
      const session = sessionManager.getSession(sessionId);
      if (session && session.status === 'active') {
        logger.debug({ sessionId }, 'Using existing session');
        await session.transport.handleRequest(req, res, req.body);
        logger.debug({ sessionId }, 'Request handled with existing session');
        return;
      } else if (session && session.status !== 'active') {
        logger.warn({ sessionId, status: session.status }, 'Session not active, cleaning up');
        sessionManager.closeSession(sessionId);
      } else {
        logger.warn({ sessionId }, 'Session not found, client may need to reinitialize');
      }
      
      // Invalid session - return error
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Invalid or expired session ID',
        },
        id: null,
      });
      return;
    }

    // Handle initialization request
    if (isInitializeRequest(req.body)) {
      logger.info('Creating new session for initialization request');
      
      const eventStore = new EnhancedEventStore();
      let newSessionId: string | null = null;
      
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore,
        onsessioninitialized: (sessionId) => {
          newSessionId = sessionId;
          logger.info({ sessionId }, 'Transport session initialized');
        }
      });

      // Enhanced transport error handling
      transport.onclose = () => {
        if (newSessionId) {
          logger.info({ sessionId: newSessionId }, 'Transport closed, cleaning up session');
          sessionManager.closeSession(newSessionId);
        }
      };

      // Add error handler for transport
      transport.onerror = (error) => {
        logger.error({ error, sessionId: newSessionId }, 'Transport error occurred');
        if (newSessionId) {
          sessionManager.updateSessionStatus(newSessionId, 'closing');
        }
      };

      // Get or create MCP server (reuses existing server to prevent duplicate tool registration)
      const { server: mcpServer } = await getOrCreateMCPServer();
      
      try {
        await mcpServer.connect(transport);
        logger.info('MCP server connected to new transport');
      } catch (connectError) {
        logger.error({ error: connectError }, 'Failed to connect MCP server to transport');
        throw connectError;
      }

      // Handle the initialization request
      await transport.handleRequest(req, res, req.body);
      
      // Create session record after successful initialization
      if (newSessionId) {
        sessionManager.createSession(newSessionId, transport, mcpServer, eventStore);
        sessionManager.updateSessionStatus(newSessionId, 'active');
        logger.info({ sessionId: newSessionId }, 'Session created and activated successfully');
      } else {
        logger.error('Session ID not generated during initialization');
      }
      
      return;
    }

    // Invalid request - no session ID and not an initialize request
    logger.error({ body: req.body }, 'Invalid MCP request - missing session or not initialization');
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided and not an initialization request',
      },
      id: null,
    });
    return;

  } catch (error) {
    logger.error({ error, sessionId }, 'Error handling MCP request');
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
};

/**
 * Handle MCP GET requests (Server-Sent Events for notifications)
 */
const handleMCPGet = async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  
  if (!sessionId) {
    logger.error('Missing session ID for SSE request');
    res.status(400).send('Missing session ID');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    logger.error({ sessionId }, 'Invalid session ID for SSE request');
    res.status(400).send('Invalid or expired session ID');
    return;
  }

  if (session.status !== 'active') {
    logger.error({ sessionId, status: session.status }, 'Session not active for SSE request');
    res.status(400).send('Session not active');
    return;
  }

  const lastEventId = req.headers['last-event-id'] as string | undefined;
  logger.info({ sessionId, lastEventId }, 'SSE connection request');

  try {
    // Set up connection monitoring
    const onClose = () => {
      logger.info({ sessionId }, 'SSE connection closed');
    };

    const onError = (error: Error) => {
      logger.error({ error, sessionId }, 'SSE connection error');
      sessionManager.updateSessionStatus(sessionId, 'closing');
    };

    res.on('close', onClose);
    res.on('error', onError);

    await session.transport.handleRequest(req, res);
    logger.info({ sessionId }, 'SSE stream established');
  } catch (error) {
    logger.error({ error, sessionId }, 'Error handling SSE request');
    sessionManager.updateSessionStatus(sessionId, 'closing');
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
};

/**
 * Handle MCP DELETE requests (session termination)
 */
const handleMCPDelete = async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  
  if (!sessionId) {
    logger.error('Missing session ID for termination request');
    res.status(400).send('Missing session ID');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    logger.warn({ sessionId }, 'Session not found for termination request, may already be terminated');
    res.status(200).send('Session not found or already terminated');
    return;
  }

  logger.info({ sessionId }, 'Session termination request');
  sessionManager.updateSessionStatus(sessionId, 'closing');

  try {
    await session.transport.handleRequest(req, res);
    logger.info({ sessionId }, 'Session termination handled by transport');
    
    // Clean up the session
    sessionManager.closeSession(sessionId);
    
  } catch (error) {
    logger.error({ error, sessionId }, 'Error handling session termination');
    
    // Ensure session cleanup even on error
    sessionManager.closeSession(sessionId);
    
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
  }
};

// Register MCP endpoints
app.post('/mcp', handleMCPPost);
app.get('/mcp', handleMCPGet);
app.delete('/mcp', handleMCPDelete);

// Health check endpoint with enhanced session information
app.get('/health', (req, res) => {
  const sessionStats = sessionManager.getStats();
  const hasGlobalServer = globalMCPServer !== null;
  const delegatorStats = globalDelegator ? globalDelegator.getCacheStats() : { bcpCount: 0, toolCount: 0 };
  
  res.json({ 
    status: 'healthy', 
    service: 'hubspot-mcp-sdk',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    sessions: {
      active: sessionStats.active,
      total: sessionStats.total,
      averageAgeMs: Math.round(sessionStats.avgAge)
    },
    server: {
      hasGlobalInstance: hasGlobalServer,
      bcpCount: delegatorStats.bcpCount,
      toolCount: delegatorStats.toolCount
    },
    architecture: 'enhanced-delegated-bcp-with-session-management'
  });
});

// Debug endpoint for session details (only in development)
if (isDevelopment(config)) {
  app.get('/debug/sessions', (req, res) => {
    const sessionStats = sessionManager.getStats();
    const eventStoreStats = globalDelegator ? globalDelegator.getCacheStats() : null;
    
    res.json({
      sessionManager: sessionStats,
      eventStore: eventStoreStats,
      hasGlobalServer: globalMCPServer !== null,
      timestamp: new Date().toISOString()
    });
  });
}

// Start server
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, '🚀 HubSpot MCP Server (SDK + Delegated BCP) listening');
  logger.info('🔧 Test with: /health endpoint');
  logger.info('📡 MCP endpoint: /mcp');
  logger.info(`🌐 Connect Claude Desktop to: ${isDevelopment(config) ? 'http://localhost:' + PORT : 'https://hubspot.synapticlabs.ai'}/mcp`);
  logger.info('🏗️ Architecture: Official MCP SDK + Delegated BCP Tools');
});

// Enhanced graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, '🛑 Shutting down server...');

  try {
    // Shutdown session manager (closes all sessions)
    sessionManager.shutdown();
    
    // Clear global references
    globalMCPServer = null;
    globalDelegator = null;
    
    logger.info('✅ Session cleanup complete');
  } catch (error) {
    logger.error({ error }, 'Error during session cleanup');
  }

  // Close HTTP server
  server.close((err) => {
    if (err) {
      logger.error({ error: err }, 'Error closing HTTP server');
      process.exit(1);
    } else {
      logger.info('✅ Server shutdown complete');
      process.exit(0);
    }
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.warn('Force shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled rejection');
  shutdown('unhandledRejection');
});

export default app;