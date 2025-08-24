/**
 * Dashboard Authentication & Security Middleware
 * Location: src/dashboard/middleware.ts
 * 
 * This module provides comprehensive middleware for the dashboard API including
 * session validation, security headers, request logging, error handling, and
 * rate limiting specifically designed for dashboard endpoints.
 */

import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { DashboardSessionService, SessionUser } from './session-service.js';

// Extend Request interface to include user and dashboard-specific properties
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      dashboardContext?: {
        isAuthenticated: boolean;
        sessionId?: string;
        userAgent?: string;
        clientIP?: string;
      };
    }
  }
}

/**
 * Dashboard-specific request logging middleware
 */
export function dashboardRequestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const originalJson = res.json;

    // Override res.json to log response details
    res.json = function(body: any) {
      const duration = Date.now() - start;
      const user = req.user ? req.user.username : 'anonymous';
      
      console.log(`[Dashboard API] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - User: ${user}`);
      
      // Log errors for debugging
      if (res.statusCode >= 400 && body && !body.success) {
        console.error(`[Dashboard API] Error Response:`, {
          url: req.originalUrl,
          method: req.method,
          statusCode: res.statusCode,
          error: body.message || body.error,
          user
        });
      }
      
      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Dashboard authentication middleware - requires valid session
 */
export function requireDashboardAuth(sessionService: DashboardSessionService) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAuthenticated = sessionService.isAuthenticated(req);
      const currentUser = sessionService.getCurrentUser(req);

      if (!isAuthenticated || !currentUser) {
        console.log(`[Dashboard Auth] Unauthorized access attempt to ${req.originalUrl} from ${req.ip}`);
        
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'UNAUTHORIZED',
          redirectTo: '/login'
        });
      }

      // Add user and context to request
      req.user = currentUser;
      req.dashboardContext = {
        isAuthenticated: true,
        sessionId: req.sessionID,
        userAgent: req.get('User-Agent'),
        clientIP: req.ip
      };

      // Touch session to extend expiration
      sessionService.touch(req);

      console.log(`[Dashboard Auth] Authenticated request: ${currentUser.username} accessing ${req.originalUrl}`);
      next();

    } catch (error) {
      console.error('[Dashboard Auth] Authentication middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication service error',
        error: 'AUTH_SERVICE_ERROR'
      });
    }
  };
}

/**
 * Optional dashboard authentication - adds user info if authenticated
 */
export function optionalDashboardAuth(sessionService: DashboardSessionService) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAuthenticated = sessionService.isAuthenticated(req);
      const currentUser = sessionService.getCurrentUser(req);

      if (isAuthenticated && currentUser) {
        req.user = currentUser;
        req.dashboardContext = {
          isAuthenticated: true,
          sessionId: req.sessionID,
          userAgent: req.get('User-Agent'),
          clientIP: req.ip
        };
        
        sessionService.touch(req);
      } else {
        req.dashboardContext = {
          isAuthenticated: false,
          userAgent: req.get('User-Agent'),
          clientIP: req.ip
        };
      }

      next();

    } catch (error) {
      console.error('[Dashboard Auth] Optional auth middleware error:', error);
      req.dashboardContext = {
        isAuthenticated: false,
        userAgent: req.get('User-Agent'),
        clientIP: req.ip
      };
      next();
    }
  };
}

/**
 * Dashboard-specific rate limiting
 */
export function createDashboardRateLimit(options: {
  windowMs?: number;
  max?: number;
  skipAuthenticated?: boolean;
} = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // 100 requests per window
    skipAuthenticated = true
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: 'Too many requests, please try again later',
      error: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting in development
      if (process.env.NODE_ENV === 'development') {
        return true;
      }
      
      // Skip for authenticated users if configured
      if (skipAuthenticated && req.user) {
        return true;
      }
      
      return false;
    },
    keyGenerator: (req) => {
      // Use user ID for authenticated users, IP for anonymous
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    },
    onLimitReached: (req, res, options) => {
      const user = req.user ? req.user.username : 'anonymous';
      console.warn(`[Dashboard Security] Rate limit exceeded for user: ${user}, IP: ${req.ip}`);
    }
  });
}

/**
 * Dashboard security headers middleware
 */
export function dashboardSecurityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Dashboard-specific security headers
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Cache control for API endpoints
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  };
}

/**
 * Request validation middleware for dashboard APIs
 */
export function validateDashboardRequest() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check Content-Type for POST/PUT requests
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.get('Content-Type');
        
        if (!contentType || !contentType.includes('application/json')) {
          return res.status(400).json({
            success: false,
            message: 'Content-Type must be application/json',
            error: 'INVALID_CONTENT_TYPE'
          });
        }
      }

      // Validate request size (should already be handled by express.json limit)
      const contentLength = req.get('Content-Length');
      if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB limit
        return res.status(413).json({
          success: false,
          message: 'Request payload too large',
          error: 'PAYLOAD_TOO_LARGE'
        });
      }

      next();

    } catch (error) {
      console.error('[Dashboard Security] Request validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Request validation error',
        error: 'VALIDATION_ERROR'
      });
    }
  };
}

/**
 * Dashboard error handling middleware
 */
export function dashboardErrorHandler() {
  return (error: any, req: Request, res: Response, next: NextFunction) => {
    const user = req.user ? req.user.username : 'anonymous';
    
    console.error('[Dashboard Error]', {
      error: {
        name: error.name || 'UnknownError',
        message: error.message || 'Unknown error occurred',
        stack: error.stack
      },
      request: {
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        clientIP: req.ip,
        user
      }
    });

    // Handle specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Request validation failed',
        error: 'VALIDATION_ERROR',
        details: error.message
      });
    }

    if (error.name === 'UnauthorizedError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'UNAUTHORIZED'
      });
    }

    if (error.code === 'EBADCSRFTOKEN') {
      return res.status(403).json({
        success: false,
        message: 'Invalid CSRF token',
        error: 'CSRF_ERROR'
      });
    }

    // Generic error response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            name: error.name,
            message: error.message,
            stack: error.stack
          }
        })
      });
    }
  };
}

/**
 * Session activity middleware - logs user activity for analytics
 */
export function sessionActivityTracker(sessionService: DashboardSessionService) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user && req.dashboardContext?.isAuthenticated) {
      // Log significant user actions (optional - for user activity tracking)
      const significantActions = [
        '/api/analytics',
        '/api/analytics/errors',
        '/api/analytics/cleanup'
      ];

      if (significantActions.some(path => req.path.includes(path))) {
        console.log(`[Dashboard Activity] User ${req.user!.username} accessed ${req.path}`);
      }
    }

    next();
  };
}

/**
 * Comprehensive dashboard middleware stack
 */
export function createDashboardMiddleware(sessionService: DashboardSessionService) {
  const router = express.Router();

  // Apply middleware in order
  router.use(dashboardSecurityHeaders());
  router.use(validateDashboardRequest());
  router.use(dashboardRequestLogger());
  router.use(createDashboardRateLimit());
  router.use(optionalDashboardAuth(sessionService));
  router.use(sessionActivityTracker(sessionService));

  return router;
}

export type { SessionUser };