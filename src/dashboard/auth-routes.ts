/**
 * Dashboard Authentication API Routes
 * Location: src/dashboard/auth-routes.ts
 * 
 * This module defines the Express routes for dashboard authentication including
 * login, logout, and session status endpoints. It integrates with the auth service
 * and session service to provide secure authentication for the analytics dashboard.
 */

import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { dashboardAuthService } from './auth-service.js';
import { DashboardSessionService } from './session-service.js';

// Request validation schemas
const LoginRequestSchema = z.object({
  username: z.string().min(3).max(50).trim(),
  password: z.string().min(8).max(128),
  action: z.literal('login').optional()
});

const LogoutRequestSchema = z.object({
  action: z.literal('logout')
});

// API Response interfaces
interface LoginResponse {
  success: boolean;
  message: string;
  user?: {
    id: number;
    username: string;
  };
}

interface LogoutResponse {
  success: boolean;
  message: string;
}

interface SessionStatusResponse {
  isAuthenticated: boolean;
  user?: {
    id: number;
    username: string;
    loginTime: Date;
  };
}

// Rate limiting for login attempts
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again in 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development';
  }
});

/**
 * Create authentication routes
 */
export function createAuthRoutes(sessionService: DashboardSessionService): express.Router {
  const router = express.Router();

  // Add JSON parsing middleware for auth routes
  router.use(express.json({ limit: '1mb' }));

  /**
   * POST /api/auth - Handle login and logout
   */
  router.post('/auth', loginRateLimit, async (req: Request, res: Response) => {
    try {
      const requestBody = req.body;

      // Determine action type
      if (requestBody.action === 'logout' || (!requestBody.username && !requestBody.password)) {
        // Handle logout
        try {
          LogoutRequestSchema.parse(requestBody);
          
          if (sessionService.isAuthenticated(req)) {
            await sessionService.destroySession(req);
            
            const response: LogoutResponse = {
              success: true,
              message: 'Logged out successfully'
            };
            
            console.log(`[Dashboard Auth] User logged out`);
            return res.json(response);
          } else {
            const response: LogoutResponse = {
              success: true,
              message: 'Already logged out'
            };
            
            return res.json(response);
          }
        } catch (validationError) {
          return res.status(400).json({
            success: false,
            message: 'Invalid logout request'
          });
        }
      } else {
        // Handle login
        try {
          const validatedRequest = LoginRequestSchema.parse(requestBody);
          const { username, password } = validatedRequest;

          console.log(`[Dashboard Auth] Login attempt for user: ${username}`);

          // Authenticate user
          const authResult = await dashboardAuthService.authenticateUser({
            username,
            password
          });

          if (!authResult.success || !authResult.user) {
            console.log(`[Dashboard Auth] Failed login attempt for user: ${username}`);
            return res.status(401).json({
              success: false,
              message: authResult.message
            } as LoginResponse);
          }

          // Create session
          sessionService.createUserSession(req, authResult.user);

          const response: LoginResponse = {
            success: true,
            message: 'Login successful',
            user: {
              id: authResult.user.id,
              username: authResult.user.username
            }
          };

          console.log(`[Dashboard Auth] Successful login for user: ${username}`);
          res.json(response);

        } catch (validationError) {
          console.log(`[Dashboard Auth] Invalid login request:`, validationError);
          return res.status(400).json({
            success: false,
            message: 'Invalid login request format'
          } as LoginResponse);
        }
      }

    } catch (error) {
      console.error('[Dashboard Auth] Authentication endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication server error'
      });
    }
  });

  /**
   * GET /api/auth/status - Check current authentication status
   */
  router.get('/auth/status', (req: Request, res: Response) => {
    try {
      const isAuthenticated = sessionService.isAuthenticated(req);
      const currentUser = sessionService.getCurrentUser(req);

      const response: SessionStatusResponse = {
        isAuthenticated,
        user: currentUser || undefined
      };

      res.json(response);

    } catch (error) {
      console.error('[Dashboard Auth] Status check error:', error);
      res.status(500).json({
        isAuthenticated: false,
        error: 'Status check failed'
      });
    }
  });

  /**
   * POST /api/auth/refresh - Refresh session (extend expiration)
   */
  router.post('/auth/refresh', (req: Request, res: Response) => {
    try {
      if (!sessionService.isAuthenticated(req)) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }

      // Touch session to extend expiration
      sessionService.touch(req);
      const currentUser = sessionService.getCurrentUser(req);

      res.json({
        success: true,
        message: 'Session refreshed',
        user: currentUser
      });

    } catch (error) {
      console.error('[Dashboard Auth] Session refresh error:', error);
      res.status(500).json({
        success: false,
        message: 'Session refresh failed'
      });
    }
  });

  /**
   * GET /api/auth/sessions - Get active sessions (admin only)
   */
  router.get('/auth/sessions', async (req: Request, res: Response) => {
    try {
      // Check authentication
      if (!sessionService.isAuthenticated(req)) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // For now, any authenticated user can see sessions
      // In a real app, you'd check for admin role
      const sessions = await sessionService.getActiveSessions();
      const stats = await sessionService.getSessionStats();

      res.json({
        success: true,
        sessions,
        stats
      });

    } catch (error) {
      console.error('[Dashboard Auth] Sessions endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sessions'
      });
    }
  });

  /**
   * DELETE /api/auth/sessions/:sessionId - Revoke a specific session (admin only)
   */
  router.delete('/auth/sessions/:sessionId', async (req: Request, res: Response) => {
    try {
      // Check authentication
      if (!sessionService.isAuthenticated(req)) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID required'
        });
      }

      const revoked = await sessionService.revokeSession(sessionId);

      if (revoked) {
        res.json({
          success: true,
          message: 'Session revoked successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

    } catch (error) {
      console.error('[Dashboard Auth] Session revocation error:', error);
      res.status(500).json({
        success: false,
        message: 'Session revocation failed'
      });
    }
  });

  return router;
}

/**
 * Authentication middleware for protecting dashboard routes
 */
export function requireAuth(sessionService: DashboardSessionService) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!sessionService.isAuthenticated(req)) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        redirectTo: '/login'
      });
    }

    // Add user info to request for downstream use
    (req as any).user = sessionService.getCurrentUser(req);
    next();
  };
}

/**
 * Optional authentication middleware (doesn't block if not authenticated)
 */
export function optionalAuth(sessionService: DashboardSessionService) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (sessionService.isAuthenticated(req)) {
      (req as any).user = sessionService.getCurrentUser(req);
    }
    next();
  };
}

export type { LoginResponse, LogoutResponse, SessionStatusResponse };