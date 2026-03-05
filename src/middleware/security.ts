/**
 * Security and Rate Limiting Middleware
 * Location: src/middleware/security.ts
 * 
 * This module provides comprehensive security middleware for the HTTP MCP server,
 * including rate limiting, input validation, CORS configuration, and security headers.
 * Designed to protect against common web vulnerabilities and abuse.
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { MCPErrorCodes } from './auth.js';
import { AuthenticatedRequest } from './auth.js';

// Rate limiting configuration
export const createRateLimit = (config: {
  windowMs?: number;
  max?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: config.windowMs || 15 * 60 * 1000, // 15 minutes
    max: config.max || 1000, // limit each IP to requests per windowMs
    keyGenerator: (req: AuthenticatedRequest) => {
      // Use user ID if authenticated, session ID if available, otherwise IP
      const userId = req.auth?.userId;
      const sessionId = req.headers['mcp-session-id'] as string;
      const ip = req.ip || 'unknown';
      
      return userId || sessionId || ip;
    },
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || true,
    message: {
      jsonrpc: '2.0',
      error: {
        code: MCPErrorCodes.RATE_LIMIT_EXCEEDED,
        message: 'Rate limit exceeded. Please try again later.'
      }
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Adaptive rate limiting based on user roles
export const createAdaptiveRateLimit = () => {
  const configs = new Map<string, any>();
  
  // Different limits for different user tiers
  configs.set('admin', {
    windowMs: 15 * 60 * 1000,
    max: 5000,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  });
  
  configs.set('user', {
    windowMs: 15 * 60 * 1000,
    max: 1000,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  });
  
  configs.set('guest', {
    windowMs: 15 * 60 * 1000,
    max: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  });
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.auth?.role || 'guest';
    const config = configs.get(role) || configs.get('guest')!;
    
    const limiter = createRateLimit(config);
    limiter(req, res, next);
  };
};

// CORS configuration
export const createCorsMiddleware = (allowedOrigins: string[]) => {
  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'Mcp-Session-Id',
      'X-Request-Id',
      'User-Agent'
    ],
    exposedHeaders: [
      'Mcp-Session-Id',
      'X-Request-Id',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    credentials: false, // MCP doesn't use cookies
    optionsSuccessStatus: 200
  });
};

// Security headers middleware
export const createSecurityHeaders = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.hubapi.com"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false, // Not needed for API
    crossOriginOpenerPolicy: false,   // Not needed for API
    crossOriginResourcePolicy: false, // Not needed for API
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    originAgentCluster: true,
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    permittedCrossDomainPolicies: false,
    hidePoweredBy: true,
    xssFilter: true
  });
};

// MCP request validation schemas
const mcpRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  method: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_/]*$/),
  params: z.any().optional()
});

const mcpNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_/]*$/),
  params: z.any().optional()
});

// Input validation middleware
export const validateMCPRequest = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST') {
    try {
      // Validate basic structure
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: MCPErrorCodes.INVALID_REQUEST,
            message: 'Request body must be a valid JSON object'
          }
        });
      }
      
      // Check if it's a request or notification
      if ('id' in req.body) {
        mcpRequestSchema.parse(req.body);
      } else {
        mcpNotificationSchema.parse(req.body);
      }
      
      // Additional security validations
      if (req.body.method && req.body.method.length > 100) {
        return res.status(400).json({
          jsonrpc: '2.0',
          id: req.body.id || null,
          error: {
            code: MCPErrorCodes.INVALID_REQUEST,
            message: 'Method name too long'
          }
        });
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: MCPErrorCodes.INVALID_REQUEST,
            message: 'Invalid MCP request format',
            data: error.errors
          }
        });
      }
      
      return res.status(400).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: MCPErrorCodes.INVALID_REQUEST,
          message: 'Request validation failed'
        }
      });
    }
  } else {
    next();
  }
};

// Request size limiting middleware
export const requestSizeLimit = (maxSize: number = 10 * 1024 * 1024) => { // 10MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        jsonrpc: '2.0',
        error: {
          code: MCPErrorCodes.INVALID_REQUEST,
          message: `Request too large. Maximum size is ${maxSize} bytes.`
        }
      });
    }
    
    next();
  };
};

// IP filtering middleware (for production use)
export const createIPFilter = (allowedIPs: string[] = [], blockedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || 'unknown';
    
    if (blockedIPs.includes(clientIP)) {
      console.warn(`[Security] Blocked IP access attempt: ${clientIP}`);
      return res.status(403).json({
        jsonrpc: '2.0',
        error: {
          code: MCPErrorCodes.AUTHORIZATION_FAILED,
          message: 'Access denied'
        }
      });
    }
    
    if (allowedIPs.length > 0 && clientIP !== 'unknown' && !allowedIPs.includes(clientIP)) {
      console.warn(`[Security] Non-whitelisted IP access attempt: ${clientIP}`);
      return res.status(403).json({
        jsonrpc: '2.0',
        error: {
          code: MCPErrorCodes.AUTHORIZATION_FAILED,
          message: 'Access denied'
        }
      });
    }
    
    next();
  };
};

// Security event logging middleware
export const securityEventLogger = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(body) {
    // Log suspicious activities
    if (res.statusCode === 401 || res.statusCode === 403) {
      console.warn(`[Security] Authentication/Authorization failure - IP: ${req.ip}, User-Agent: ${req.headers['user-agent']}, Method: ${req.method}, Path: ${req.path}`);
    }
    
    if (res.statusCode === 429) {
      console.warn(`[Security] Rate limit exceeded - IP: ${req.ip}, User-Agent: ${req.headers['user-agent']}`);
    }
    
    return originalSend.call(this, body);
  };
  
  next();
};

// Content type validation middleware
export const validateContentType = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' && req.path === '/mcp') {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: MCPErrorCodes.INVALID_REQUEST,
          message: 'Content-Type must be application/json'
        }
      });
    }
  }
  
  next();
};