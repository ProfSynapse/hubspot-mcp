#!/usr/bin/env node

/**
 * HubSpot MCP HTTP Server Entry Point
 * Location: src/http-server.ts
 * 
 * This is the main entry point for the HTTP-based HubSpot MCP server, designed for
 * deployment on Railway and other cloud platforms. It provides RESTful HTTP transport
 * while maintaining full MCP protocol compatibility and all existing BCP functionality.
 */

import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { HubspotBCPServer } from './core/server.js';
import { loadConfig, validateConfiguration, isDevelopment } from './config/environment.js';
import { SessionManager, SessionContext } from './core/session-manager.js';
import { createLogger, createRequestLogger, createErrorLogger, logMCPRequest, logMCPResponse, logSessionEvent } from './utils/logger.js';
import { metricsCollector, metricsMiddleware } from './utils/metrics.js';
import { HealthChecker, createHealthCheckHandler, railwayHealthCheck, readinessCheck, livenessCheck } from './health/health-check.js';
import { createAuthMiddleware, createToolPermissionValidator, createDevelopmentToken, MCPPermissions, AuthenticatedRequest } from './middleware/auth.js';
import { createRateLimit, createCorsMiddleware, createSecurityHeaders, validateMCPRequest, requestSizeLimit, validateContentType, securityEventLogger } from './middleware/security.js';

// Load and validate configuration
const config = loadConfig();
validateConfiguration(config);

// Create logger
const logger = createLogger({
  level: config.LOG_LEVEL,
  environment: config.NODE_ENV,
  serviceName: 'hubspot-mcp-http',
  version: process.env.npm_package_version || '0.1.0'
});

// Create Express app
const app = express();

// Session management
const sessionManager = new SessionManager({
  maxAge: config.SESSION_MAX_AGE,
  cleanupInterval: config.SESSION_CLEANUP_INTERVAL,
  maxSessions: 1000,
  idleTimeout: config.SESSION_MAX_AGE / 2
});

// Global BCP server instance (will be initialized)
let hubspotBCPServer: HubspotBCPServer | null = null;
let healthChecker: HealthChecker | null = null;

// Trust proxy for Railway deployment
app.set('trust proxy', true);

// Security middleware (applied first)
app.use(createSecurityHeaders());
app.use(createCorsMiddleware(config.CORS_ORIGIN));
app.use(securityEventLogger);

// Request parsing and validation
app.use(express.json({ limit: '10mb' }));
app.use(requestSizeLimit(10 * 1024 * 1024)); // 10MB limit
app.use(validateContentType);

// Logging and metrics
app.use(createRequestLogger(logger));
app.use(metricsMiddleware);

// Rate limiting
app.use(createRateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  skipSuccessfulRequests: false,
  skipFailedRequests: true
}));

// Health check endpoints (before authentication)
app.get('/health', railwayHealthCheck);
app.get('/health/detailed', healthChecker ? createHealthCheckHandler(healthChecker) : railwayHealthCheck);
app.get('/ready', readinessCheck(sessionManager));
app.get('/live', livenessCheck);

// Metrics endpoint (before authentication for monitoring)
if (config.METRICS_ENABLED) {
  app.get('/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(metricsCollector.toPrometheusFormat());
  });
}

// MCP Protocol endpoint with authentication
const authMiddleware = createAuthMiddleware({
  jwtSecret: config.JWT_SECRET,
  jwtIssuer: config.JWT_ISSUER,
  jwtAudience: config.JWT_AUDIENCE,
  jwksUri: config.JWKS_URI,
  requiredPermissions: [MCPPermissions.MCP_CALL_TOOLS],
  allowAnonymous: isDevelopment(config) // Allow anonymous access in development
});

// Main MCP endpoint
app.all('/mcp', [
  validateMCPRequest,
  authMiddleware,
  createToolPermissionValidator()
], async (req: AuthenticatedRequest, res) => {
  const startTime = Date.now();
  let session: SessionContext | null = null;
  
  try {
    // Extract or generate session ID
    let sessionId = req.headers['mcp-session-id'] as string;
    
    if (!sessionId) {
      // Create new session
      session = sessionManager.createSession(req.auth, {
        userAgent: req.headers['user-agent'],
        clientIP: req.ip
      });
      sessionId = session.id;
      logSessionEvent(logger, 'created', sessionId, { userId: req.auth?.userId });
    } else {
      // Get existing session
      session = sessionManager.getSession(sessionId);
      if (!session) {
        // Session expired or invalid, create new one
        session = sessionManager.createSession(req.auth, {
          userAgent: req.headers['user-agent'],
          clientIP: req.ip
        });
        sessionId = session.id;
        logSessionEvent(logger, 'recreated', sessionId, { userId: req.auth?.userId, reason: 'expired' });
      }
    }
    
    // Set session ID in response header
    res.setHeader('Mcp-Session-Id', sessionId);
    res.setHeader('Content-Type', 'application/json');
    
    // Update session activity
    sessionManager.updateActivity(sessionId);
    
    // Handle different HTTP methods
    if (req.method === 'POST') {
      // Handle MCP request
      logMCPRequest(logger, req, sessionId);
      
      if (!hubspotBCPServer) {
        throw new Error('MCP server not initialized');
      }
      
      // Connect the session transport if not already connected
      if (!session.transport) {
        session.transport = new StreamableHTTPServerTransport();
        await hubspotBCPServer.getServer().connect(session.transport);
      }
      
      // Process the MCP request
      const response = await session.transport.handleRequest(req.body);
      
      const duration = Date.now() - startTime;
      logMCPResponse(logger, req, response, sessionId, duration);
      
      // Update session state
      session.state = 'active' as any;
      
      res.json(response);
    } else if (req.method === 'GET') {
      // Handle Server-Sent Events for notifications
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
      if (session.transport) {
        session.transport.handleSSE(res);
      } else {
        res.write('data: {"error": "Session not initialized"}\n\n');
        res.end();
      }
    } else {
      res.status(405).json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not allowed'
        }
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      },
      sessionId: session?.id,
      duration,
      event: 'mcp_error'
    }, 'MCP Request Error');
    
    metricsCollector.recordError('mcp_request_error', 500);
    
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: 'Internal server error',
        data: {
          type: error instanceof Error ? error.name : 'UnknownError',
          timestamp: new Date().toISOString()
        }
      }
    });
  }
});

// Development endpoint to get a test token
if (isDevelopment(config)) {
  app.get('/dev/token', (req, res) => {
    if (!config.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }
    
    const token = createDevelopmentToken({
      userId: req.query.userId as string || 'dev-user',
      permissions: [
        MCPPermissions.MCP_CALL_TOOLS,
        MCPPermissions.HUBSPOT_READ,
        MCPPermissions.HUBSPOT_WRITE,
        MCPPermissions.COMPANIES_READ,
        MCPPermissions.COMPANIES_WRITE,
        MCPPermissions.CONTACTS_READ,
        MCPPermissions.CONTACTS_WRITE,
        MCPPermissions.DEALS_READ,
        MCPPermissions.DEALS_WRITE
      ]
    }, config.JWT_SECRET);
    
    res.json({
      token,
      usage: 'Include this token in the Authorization header as "Bearer <token>"',
      example: `curl -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' http://localhost:${config.PORT}/mcp`
    });
  });
}

// Session management endpoint (for debugging)
if (isDevelopment(config)) {
  app.get('/dev/sessions', (req, res) => {
    const stats = sessionManager.getStats();
    res.json(stats);
  });
}

// Error handling middleware
app.use(createErrorLogger(logger));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: 'Endpoint not found'
    }
  });
});

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    event: 'global_error'
  }, 'Global Error Handler');
  
  if (!res.headersSent) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error'
      }
    });
  }
});

// Server initialization
async function initializeServer(): Promise<void> {
  try {
    logger.info('Initializing HubSpot MCP HTTP Server...');
    
    // Create HubSpot BCP Server
    logger.info('Creating HubSpot BCP Server...');
    hubspotBCPServer = new HubspotBCPServer(config.HUBSPOT_ACCESS_TOKEN);
    
    // Initialize the BCP server (this will fetch property groups and register tools)
    logger.info('Initializing BCP server...');
    await hubspotBCPServer.init();
    
    // Create health checker
    healthChecker = new HealthChecker(
      hubspotBCPServer.getApiClient(),
      sessionManager
    );
    
    logger.info('HubSpot MCP HTTP Server initialization complete');
  } catch (error) {
    logger.error({
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to initialize server');
    throw error;
  }
}

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Cleanup session manager
    sessionManager.shutdown();
    
    // Exit process
    process.exit(0);
  });
  
  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Forced exit after 30 seconds');
    process.exit(1);
  }, 30000);
};

// Process signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled error handlers
process.on('uncaughtException', (error) => {
  logger.error({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    event: 'uncaught_exception'
  }, 'Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    reason,
    promise,
    event: 'unhandled_rejection'
  }, 'Unhandled Promise Rejection');
  process.exit(1);
});

// Start server
const server = app.listen(config.PORT, config.HOST, async () => {
  try {
    await initializeServer();
    
    logger.info({
      port: config.PORT,
      host: config.HOST,
      environment: config.NODE_ENV,
      version: process.env.npm_package_version || '0.1.0'
    }, `🚀 HubSpot MCP HTTP Server running on http://${config.HOST}:${config.PORT}`);
    
    logger.info('Available endpoints:');
    logger.info(`  • MCP Protocol: http://${config.HOST}:${config.PORT}/mcp`);
    logger.info(`  • Health Check: http://${config.HOST}:${config.PORT}/health`);
    logger.info(`  • Metrics: http://${config.HOST}:${config.PORT}/metrics`);
    
    if (isDevelopment(config)) {
      logger.info('Development endpoints:');
      logger.info(`  • Dev Token: http://${config.HOST}:${config.PORT}/dev/token`);
      logger.info(`  • Sessions: http://${config.HOST}:${config.PORT}/dev/sessions`);
    }
    
    // Update metrics with initial session count
    metricsCollector.updateSessionCount(sessionManager.getActiveSessionCount());
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
});

export default app;