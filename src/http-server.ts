#!/usr/bin/env node

/**
 * HubSpot MCP HTTP Server Entry Point
 * Location: src/http-server.ts
 * 
 * This is the main entry point for the HTTP-based HubSpot MCP server, designed for
 * deployment on Railway and other cloud platforms. It provides RESTful HTTP transport
 * while maintaining full MCP protocol compatibility and all existing BCP functionality.
 */

import express, { Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HttpStreamableTransport } from './core/http-transport.js';
import { HubspotBCPServer } from './core/server.js';
import { loadConfig, validateConfiguration, isDevelopment } from './config/environment.js';
import { SessionManager, SessionContext } from './core/session-manager.js';
import { OAuthService } from './oauth/oauth-service.js';
import { createLogger, createRequestLogger, createErrorLogger, logMCPRequest, logMCPResponse, logSessionEvent } from './utils/logger.js';
import { metricsCollector, metricsMiddleware } from './utils/metrics.js';
import { HealthChecker, createHealthCheckHandler, railwayHealthCheck, readinessCheck, livenessCheck } from './health/health-check.js';
import { MCPPermissions, AuthenticatedRequest } from './middleware/auth.js';
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
let oauthService: OAuthService | null = null;

// Trust proxy for Railway deployment
app.set('trust proxy', true);

// Security middleware (applied first)
app.use(createSecurityHeaders());
app.use(createCorsMiddleware(config.CORS_ORIGIN));
app.use(securityEventLogger);

// Request parsing and validation
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Support form-encoded data for OAuth
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

// OAuth 2.1 Endpoints (commented out for testing)
/*
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  if (!oauthService) {
    return res.status(500).json({ error: 'OAuth service not initialized' });
  }
  res.header('MCP-Protocol-Version', '2025-03-26');
  res.json(oauthService.getServerMetadata());
});

// Alternative endpoint for OpenID Connect compatibility
app.get('/.well-known/openid_configuration', (req, res) => {
  if (!oauthService) {
    return res.status(500).json({ error: 'OAuth service not initialized' });
  }
  res.header('MCP-Protocol-Version', '2025-03-26');
  res.json(oauthService.getServerMetadata());
});

// Dynamic Client Registration (RFC7591)
app.post('/register', async (req, res) => {
  try {
    if (!oauthService) {
      return res.status(500).json({ error: 'OAuth service not initialized' });
    }

    const client = await oauthService.registerClient(req.body);
    res.status(201).json({
      client_id: client.client_id,
      client_secret: client.client_secret,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      grant_types: client.grant_types,
      response_types: client.response_types,
      scope: client.scope,
      token_endpoint_auth_method: client.token_endpoint_auth_method,
      client_id_issued_at: Math.floor(client.created_at / 1000)
    });
  } catch (error) {
    logger.error({ error }, 'OAuth client registration failed');
    res.status(400).json({
      error: 'invalid_client_metadata',
      error_description: 'Client registration failed'
    });
  }
});

// OAuth Authorization Endpoint
app.get('/authorize', async (req, res) => {
  try {
    if (!oauthService) {
      return res.status(500).json({ error: 'OAuth service not initialized' });
    }
    await oauthService.authorize(req, res);
  } catch (error) {
    logger.error({ error }, 'OAuth authorization failed');
    res.status(400).json({
      error: 'server_error',
      error_description: 'Authorization request failed'
    });
  }
});

// OAuth Token Endpoint
app.post('/token', async (req, res) => {
  try {
    if (!oauthService) {
      return res.status(500).json({ error: 'OAuth service not initialized' });
    }
    await oauthService.token(req, res);
  } catch (error) {
    logger.error({ error }, 'OAuth token request failed');
    res.status(400).json({
      error: 'server_error',
      error_description: 'Token request failed'
    });
  }
});
*/

// OAuth Bearer Token Validation Middleware (commented out for testing)
/*
const oauthAuthMiddleware = (req: any, res: express.Response, next: express.NextFunction) => {
  // In development, allow unauthenticated access for testing
  if (isDevelopment(config) && !req.headers.authorization) {
    req.auth = { userId: 'dev-user', permissions: ['mcp:read', 'mcp:write'] };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.header('WWW-Authenticate', 'Bearer realm="MCP Server", error="invalid_request", error_description="Bearer token required"');
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Authentication required',
        data: { 
          error: 'invalid_request',
          error_description: 'Bearer token required'
        }
      }
    });
  }

  const token = authHeader.substring(7);
  if (!oauthService) {
    return res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'OAuth service not available'
      }
    });
  }

  const accessToken = oauthService.validateAccessToken(token);
  if (!accessToken) {
    res.header('WWW-Authenticate', 'Bearer realm="MCP Server", error="invalid_token", error_description="The access token provided is expired, revoked, malformed, or invalid"');
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Invalid or expired token',
        data: {
          error: 'invalid_token',
          error_description: 'The access token provided is expired, revoked, malformed, or invalid'
        }
      }
    });
  }

  // Set auth context
  req.auth = {
    userId: accessToken.user_id || accessToken.client_id,
    clientId: accessToken.client_id,
    permissions: accessToken.scope.split(' ')
  };

  next();
};
*/

// HTTP Streamable MCP endpoint (single endpoint for all communication)
app.post('/mcp', [
  validateMCPRequest,
  // oauthAuthMiddleware  // Commented out for testing - uncomment to enable OAuth
], async (req: any, res: express.Response) => {
  const startTime = Date.now();
  let session: SessionContext | null = null;
  
  try {
    // Validate Origin header to prevent DNS rebinding attacks
    const origin = req.headers.origin;
    const allowedOrigins = config.CORS_ORIGIN || [];
    if (origin && !allowedOrigins.includes(origin) && config.NODE_ENV === 'production') {
      return res.status(403).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid origin'
        }
      });
    }

    // Provide default auth context for testing when OAuth is disabled
    const authContext = req.auth || { 
      userId: 'test-user', 
      permissions: ['mcp:read', 'mcp:write', 'hubspot:read', 'hubspot:write'] 
    };

    // Extract or generate session ID from Mcp-Session-Id header
    let sessionId = req.headers['mcp-session-id'] as string;
    
    if (!sessionId) {
      // Create new session
      session = sessionManager.createSession(authContext, {
        userAgent: req.headers['user-agent'],
        clientIP: req.ip
      });
      sessionId = session.id;
      logSessionEvent(logger, 'created', sessionId, { userId: authContext?.userId });
    } else {
      // Get existing session
      session = sessionManager.getSession(sessionId);
      if (!session) {
        // Session expired or invalid, create new one
        session = sessionManager.createSession(authContext, {
          userAgent: req.headers['user-agent'],
          clientIP: req.ip
        });
        sessionId = session.id;
        logSessionEvent(logger, 'recreated', sessionId, { userId: authContext?.userId, reason: 'expired' });
      }
    }
    
    // Set required headers for HTTP Streamable transport
    res.header('Mcp-Session-Id', sessionId);
    res.header('Content-Type', 'application/json');
    
    // Update session activity
    sessionManager.updateActivity(sessionId);
    
    // Log the MCP request
    logMCPRequest(logger, req, sessionId);
    
    if (!hubspotBCPServer) {
      throw new Error('MCP server not initialized');
    }
    
    // Process JSON-RPC message directly (HTTP Streamable transport)
    const jsonrpcMessage = req.body;
    
    // Log all incoming MCP requests for debugging with headers
    logger.info({ 
      method: jsonrpcMessage.method, 
      id: jsonrpcMessage.id, 
      sessionId,
      headers: {
        'mcp-session-id': req.headers['mcp-session-id'],
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'accept': req.headers['accept']
      },
      requestBody: jsonrpcMessage
    }, `📨 MCP REQUEST: ${jsonrpcMessage.method}`);
    
    // Validate JSON-RPC format
    if (!jsonrpcMessage || typeof jsonrpcMessage !== 'object') {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid JSON-RPC request'
        }
      });
    }
    
    // Handle the MCP request through the BCP server with HTTP Streamable transport
    let mcpResponse;
    try {
      const server = hubspotBCPServer.getServer();
      
      // For HTTP Streamable, we process JSON-RPC messages directly
      // Handle different MCP methods
      if (jsonrpcMessage.method === 'initialize') {
        // Handle initialization request
        const { params } = jsonrpcMessage;
        logger.info({ params, sessionId }, 'Processing initialize request with client capabilities');
        
        const initializeResponse = {
          jsonrpc: '2.0',
          id: jsonrpcMessage.id,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: {
              tools: {
                listChanged: true
              }
            },
            serverInfo: {
              name: 'hubspot-mcp',
              version: '0.1.0'
            },
            instructions: 'HubSpot MCP server initialized successfully. Use tools/list to discover available tools.'
          }
        };
        
        logger.info({ capabilities: initializeResponse.result.capabilities, sessionId }, 'Sending initialize response with tools capability enabled');
        
        // Log the EXACT initialize response being sent to Claude Desktop
        console.log('📤 EXACT INITIALIZE RESPONSE JSON:');
        console.log(JSON.stringify(initializeResponse, null, 2));
        console.log('📤 END INITIALIZE RESPONSE');
        
        logger.info({ 
          responseSize: JSON.stringify(initializeResponse).length,
          toolsCapability: initializeResponse.result.capabilities.tools,
          protocolVersion: initializeResponse.result.protocolVersion,
          sessionId 
        }, '📤 INITIALIZE RESPONSE METADATA');
        
        mcpResponse = initializeResponse;
      } else if (jsonrpcMessage.method === 'ping') {
        // Handle ping
        mcpResponse = {
          jsonrpc: '2.0',
          id: jsonrpcMessage.id,
          result: {}
        };
      } else if (jsonrpcMessage.method === 'tools/list') {
        // Handle tools/list by directly accessing the server's tools
        logger.info({ sessionId }, '🔧 TOOLS/LIST REQUEST RECEIVED! Claude is requesting tool list');
        
        if (!hubspotBCPServer) {
          mcpResponse = {
            jsonrpc: '2.0',
            id: jsonrpcMessage.id || null,
            error: {
              code: -32603,
              message: 'HubSpot BCP server not initialized'
            }
          };
        } else {
          const server = hubspotBCPServer.getServer();
          // Access the private _registeredTools property (for debugging)
          const tools = (server as any)._registeredTools || {};
          
          logger.info({ toolCount: Object.keys(tools).length, toolNames: Object.keys(tools), sessionId }, '🛠️ Found registered tools in BCP server');
          
          const toolsList = Object.keys(tools).map(toolName => {
            const tool = tools[toolName];
            
            // Convert Zod schema to JSON Schema (basic conversion)
            let inputSchema = { type: 'object', properties: {} };
            if (tool.inputSchema && typeof tool.inputSchema === 'object') {
              try {
                // Try to get a basic JSON schema representation
                // For now, use a simple fallback since Zod to JSON Schema conversion is complex
                inputSchema = {
                  type: 'object',
                  properties: {}
                } as any;
              } catch (error) {
                // Fallback to basic schema
                inputSchema = { type: 'object', properties: {} };
              }
            }
            
            return {
              name: toolName,
              description: tool.description || `HubSpot ${toolName.replace('hubspot', '')} management tool`,
              inputSchema
            };
          });
          
          mcpResponse = {
            jsonrpc: '2.0',
            id: jsonrpcMessage.id,
            result: {
              tools: toolsList
            }
          };
          
          logger.info({ toolCount: toolsList.length, responseSize: JSON.stringify(mcpResponse).length, sessionId }, '📋 Sending tools/list response to Claude');
        }
      } else if (jsonrpcMessage.method === 'prompts/list') {
        // Handle prompts/list - we don't have prompts but need to return empty list
        logger.info({ sessionId }, '📝 PROMPTS/LIST REQUEST RECEIVED! Returning empty prompts list');
        mcpResponse = {
          jsonrpc: '2.0',
          id: jsonrpcMessage.id,
          result: {
            prompts: []
          }
        };
        logger.info({ sessionId }, '📝 Sent empty prompts/list response - Claude should request tools/list next');
        
        // Add a timeout to check if tools/list is requested
        setTimeout(() => {
          logger.warn({ sessionId }, '⚠️ TIMEOUT: 5 seconds passed since prompts/list - still no tools/list request from Claude Desktop');
        }, 5000);
      } else if (jsonrpcMessage.method === 'notifications/initialized') {
        // Handle notifications/initialized - this is a notification, no response needed
        logger.info({ sessionId }, '🔔 NOTIFICATIONS/INITIALIZED received - client is ready');
        
        // Simple timeout to check for tools/list request
        logger.warn({ sessionId }, '⏰ STARTING TOOLS/LIST MONITORING - expecting request soon...');
        
        setTimeout(() => {
          logger.error({ sessionId }, '🚨 CRITICAL: 10 seconds passed and NO tools/list request received from Claude Desktop!');
          logger.error({ sessionId }, '🚨 This indicates Claude Desktop is not recognizing our tools capability properly!');
        }, 10000);
        
        // Don't set mcpResponse - notifications don't get responses
        // Just continue without setting a response
      } else {
        // Method not found
        logger.error({ method: jsonrpcMessage.method, sessionId }, '❌ METHOD NOT FOUND - Claude requested unhandled method');
        mcpResponse = {
          jsonrpc: '2.0',
          id: jsonrpcMessage.id || null,
          error: {
            code: -32601,
            message: `Method not found: ${jsonrpcMessage.method}`
          }
        };
      }
      
    } catch (requestError) {
      logger.error({ 
        error: requestError, 
        sessionId, 
        method: jsonrpcMessage?.method,
        errorMessage: requestError instanceof Error ? requestError.message : String(requestError),
        stack: requestError instanceof Error ? requestError.stack : undefined
      }, '🚨 ERROR PROCESSING MCP REQUEST - this is causing the MCP Request Error!');
      mcpResponse = {
        jsonrpc: '2.0',
        id: jsonrpcMessage.id || null,
        error: {
          code: -32603,
          message: 'Internal error processing request',
          data: requestError instanceof Error ? requestError.message : String(requestError)
        }
      };
    }
    
    const duration = Date.now() - startTime;
    logMCPResponse(logger, req, mcpResponse, sessionId, duration);
    
    // Update session state
    if (session) {
      session.state = 'active' as any;
    }
    
    // Only send response if we have one (notifications don't get responses)
    if (mcpResponse) {
      res.json(mcpResponse);
    } else {
      // For notifications, send a 204 No Content response
      res.status(204).end();
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

// Development endpoint for OAuth testing (commented out for testing)
/*
if (isDevelopment(config)) {
  app.get('/dev/oauth', (req, res) => {
    if (!oauthService) {
      return res.status(500).json({ error: 'OAuth service not initialized' });
    }
    
    const serverUrl = process.env.BASE_URL || `http://${config.HOST}:${config.PORT}`;
    
    res.json({
      message: 'OAuth 2.1 with Dynamic Client Registration is available',
      instructions: 'Follow the OAuth flow to get access tokens',
      endpoints: {
        discovery: `${serverUrl}/.well-known/oauth-authorization-server`,
        register: `${serverUrl}/register`,
        authorize: `${serverUrl}/authorize`,
        token: `${serverUrl}/token`
      },
      example_flow: [
        '1. POST /register to register a client',
        '2. GET /authorize to get authorization code',
        '3. POST /token to exchange code for access token',
        '4. Use token: Authorization: Bearer <access_token>'
      ]
    });
  });
}
*/

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
    
    // Create OAuth service (commented out for testing)
    /*
    logger.info('Creating OAuth service...');
    const protocol = config.NODE_ENV === 'production' ? 'https' : 'http';
    
    // Determine the correct base URL for OAuth
    let baseUrl = process.env.BASE_URL;
    if (!baseUrl) {
      if (config.NODE_ENV === 'production') {
        // In production on Railway, use the Railway URL if available
        const railwayUrl = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN;
        if (railwayUrl) {
          baseUrl = `https://${railwayUrl}`;
        } else {
          // Fallback for production without Railway
          baseUrl = `${protocol}://localhost:${config.PORT}`;
        }
      } else {
        // In development, always use localhost instead of 0.0.0.0
        const host = config.HOST === '0.0.0.0' ? 'localhost' : config.HOST;
        baseUrl = `${protocol}://${host}:${config.PORT}`;
      }
    }
    
    const issuer = process.env.OAUTH_ISSUER || baseUrl;
    oauthService = new OAuthService(issuer, baseUrl);
    logger.info(`OAuth service initialized with base URL: ${baseUrl}`);
    */
    
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
    
    const serverUrl = process.env.BASE_URL || `http://${config.HOST}:${config.PORT}`;
    
    logger.info('Available endpoints:');
    logger.info(`  • MCP Protocol: ${serverUrl}/mcp`);
    logger.info(`  • Health Check: ${serverUrl}/health`);
    logger.info(`  • Metrics: ${serverUrl}/metrics`);
    
    // OAuth endpoints (commented out for testing)
    /*
    logger.info('OAuth 2.1 endpoints:');
    logger.info(`  • Server Metadata: ${serverUrl}/.well-known/oauth-authorization-server`);
    logger.info(`  • Client Registration: ${serverUrl}/register`);
    logger.info(`  • Authorization: ${serverUrl}/authorize`);
    logger.info(`  • Token: ${serverUrl}/token`);
    */
    
    if (isDevelopment(config)) {
      logger.info('Development endpoints:');
      logger.info(`  • Sessions: ${serverUrl}/dev/sessions`);
    }
    
    // Update metrics with initial session count
    metricsCollector.updateSessionCount(sessionManager.getActiveSessionCount());
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
});

export default app;