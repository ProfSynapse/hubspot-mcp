/**
 * Dashboard HTTP Server
 * Location: src/dashboard/dashboard-server.ts
 * 
 * This is the main Express server for the analytics dashboard. It integrates
 * authentication services, session management, API routes, and middleware to
 * provide a complete backend for the dashboard frontend. This server runs
 * alongside the main MCP server to provide dashboard functionality.
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Dashboard services and middleware
import { createSessionService, SessionConfig } from './session-service.js';
import { dashboardAuthService } from './auth-service.js';
import { createAuthRoutes, requireAuth } from './auth-routes.js';
import { createAnalyticsRoutes } from './analytics-routes.js';
import { 
  createDashboardMiddleware, 
  requireDashboardAuth, 
  dashboardErrorHandler 
} from './middleware.js';

// Core services
import database from '../analytics/database.js';
import { analyticsService } from '../analytics/analytics-service.js';

/**
 * Dashboard Server Configuration
 */
export interface DashboardConfig {
  port: number;
  host: string;
  sessionSecret: string;
  corsOrigin?: string | string[];
  secure?: boolean;
  environment: 'development' | 'production' | 'test';
  sessionMaxAge?: number;
}

/**
 * Dashboard Server Class
 */
export class DashboardServer {
  private app: Express;
  private sessionService: any;
  private config: DashboardConfig;
  private server: any;

  constructor(config: DashboardConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Trust proxy for Railway/cloud deployment
    this.app.set('trust proxy', 1);

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          scriptSrc: ["'self'"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration
    const corsOptions = {
      origin: this.config.corsOrigin || false,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Set-Cookie']
    };

    this.app.use(cors(corsOptions));

    // Rate limiting (global)
    const globalRateLimit = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 500, // 500 requests per window
      message: {
        success: false,
        message: 'Too many requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => this.config.environment === 'development'
    });

    this.app.use(globalRateLimit);

    // Body parsing
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Session configuration
    const sessionConfig: SessionConfig = {
      secret: this.config.sessionSecret,
      maxAge: this.config.sessionMaxAge || 24 * 60 * 60 * 1000, // 24 hours
      secure: this.config.secure || this.config.environment === 'production',
      httpOnly: true,
      sameSite: 'strict'
    };

    // Initialize session service
    this.sessionService = createSessionService(sessionConfig);
    
    // Apply session middleware
    this.app.use(this.sessionService.getMiddleware());

    // Dashboard-specific middleware
    this.app.use(createDashboardMiddleware(this.sessionService));

    console.log('✅ Dashboard middleware initialized');
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const [authHealth, sessionHealth] = await Promise.all([
          dashboardAuthService.healthCheck(),
          this.sessionService.healthCheck()
        ]);

        const overallHealth = authHealth.status === 'healthy' && sessionHealth.status === 'healthy';

        res.status(overallHealth ? 200 : 503).json({
          success: true,
          status: overallHealth ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString(),
          services: {
            authentication: authHealth,
            sessions: sessionHealth
          }
        });
      } catch (error) {
        res.status(503).json({
          success: false,
          status: 'unhealthy',
          message: 'Health check failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      const user = (req as any).user;
      res.json({
        success: true,
        message: 'HubSpot MCP Analytics Dashboard API',
        version: '0.1.0',
        authenticated: !!user,
        user: user ? { username: user.username } : undefined,
        endpoints: {
          auth: '/api/auth',
          analytics: '/api/analytics',
          health: '/health'
        }
      });
    });

    // Authentication routes (no auth required)
    this.app.use('/api', createAuthRoutes(this.sessionService));

    // Protected analytics routes (authentication required)
    const analyticsRoutes = createAnalyticsRoutes(this.sessionService);
    this.app.use('/api', requireDashboardAuth(this.sessionService), analyticsRoutes);

    // Admin routes (authentication required)
    this.app.get('/api/admin/stats', requireDashboardAuth(this.sessionService), async (req: Request, res: Response) => {
      try {
        const [sessionStats, userCount] = await Promise.all([
          this.sessionService.getSessionStats(),
          database.query('SELECT COUNT(*) as count FROM users')
        ]);

        res.json({
          success: true,
          data: {
            sessions: sessionStats,
            users: parseInt(userCount.rows[0].count),
            server: {
              uptime: process.uptime(),
              memory: process.memoryUsage(),
              environment: this.config.environment
            }
          }
        });
      } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to fetch admin statistics'
        });
      }
    });

    // Session cleanup endpoint (admin only)
    this.app.post('/api/admin/cleanup-sessions', requireDashboardAuth(this.sessionService), async (req: Request, res: Response) => {
      try {
        const deletedCount = await this.sessionService.cleanupExpiredSessions();
        
        res.json({
          success: true,
          message: 'Session cleanup completed',
          data: { deletedSessions: deletedCount }
        });
      } catch (error) {
        console.error('Session cleanup error:', error);
        res.status(500).json({
          success: false,
          message: 'Session cleanup failed'
        });
      }
    });

    console.log('✅ Dashboard routes initialized');
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.originalUrl
      });
    });

    // Global error handler
    this.app.use(dashboardErrorHandler());

    console.log('✅ Dashboard error handling initialized');
  }

  /**
   * Start the dashboard server
   */
  async start(): Promise<void> {
    try {
      // Test database connection
      console.log('🔌 Testing database connection...');
      await database.testConnection();
      console.log('✅ Database connection established');

      // Test analytics service
      console.log('📊 Testing analytics service...');
      const analyticsHealth = await analyticsService.healthCheck();
      if (analyticsHealth.status !== 'healthy') {
        console.warn('⚠️  Analytics service health check failed:', analyticsHealth.message);
      } else {
        console.log('✅ Analytics service operational');
      }

      // Test auth service
      console.log('🔐 Testing auth service...');
      const authHealth = await dashboardAuthService.healthCheck();
      if (authHealth.status !== 'healthy') {
        console.warn('⚠️  Auth service health check failed:', authHealth.message);
      } else {
        console.log('✅ Auth service operational');
      }

      // Start HTTP server
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        console.log('');
        console.log('🎉 HubSpot MCP Dashboard Server Started');
        console.log('=======================================');
        console.log(`🌐 Server: http://${this.config.host}:${this.config.port}`);
        console.log(`📊 Environment: ${this.config.environment}`);
        console.log(`🔒 Sessions: PostgreSQL-backed`);
        console.log(`🛡️  Security: ${this.config.secure ? 'HTTPS' : 'HTTP'} mode`);
        console.log('');
        console.log('Available endpoints:');
        console.log('  • Health: GET /health');
        console.log('  • Auth: POST /api/auth');
        console.log('  • Analytics: GET /api/analytics');
        console.log('  • Errors: GET /api/analytics/errors');
        console.log('  • Performance: GET /api/analytics/performance');
        console.log('  • Admin: GET /api/admin/stats');
        console.log('');
        console.log('🚀 Dashboard server ready for connections!');
      });

    } catch (error) {
      console.error('❌ Failed to start dashboard server:', error);
      throw error;
    }
  }

  /**
   * Stop the dashboard server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((error: any) => {
          if (error) {
            reject(error);
          } else {
            console.log('Dashboard server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the Express app instance
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Get session service
   */
  getSessionService(): any {
    return this.sessionService;
  }
}

/**
 * Factory function to create and configure dashboard server
 */
export function createDashboardServer(config: Partial<DashboardConfig>): DashboardServer {
  const defaultConfig: DashboardConfig = {
    port: parseInt(process.env.DASHBOARD_PORT || '3001'),
    host: process.env.DASHBOARD_HOST || '0.0.0.0',
    sessionSecret: process.env.SESSION_SECRET || 'dashboard-secret-key-change-in-production',
    corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    secure: process.env.NODE_ENV === 'production',
    environment: (process.env.NODE_ENV as any) || 'development',
    sessionMaxAge: 24 * 60 * 60 * 1000 // 24 hours
  };

  const finalConfig = { ...defaultConfig, ...config };

  // Validate required configuration
  if (!finalConfig.sessionSecret || finalConfig.sessionSecret === 'dashboard-secret-key-change-in-production') {
    if (finalConfig.environment === 'production') {
      throw new Error('SESSION_SECRET environment variable is required in production');
    }
    console.warn('⚠️  Using default session secret. Set SESSION_SECRET environment variable for security.');
  }

  return new DashboardServer(finalConfig);
}

export type { DashboardConfig };