# API Specifications and Architecture

## Executive Summary

This document defines the complete API architecture for the HubSpot MCP Analytics Dashboard, including RESTful endpoints, WebSocket real-time communication, authentication mechanisms, and integration patterns. The API is designed for high performance, security, and seamless integration with the existing MCP server infrastructure.

## API Architecture Overview

### Technology Stack
- **Framework**: Express.js 4.18+ with TypeScript
- **Authentication**: JWT tokens with refresh token rotation
- **Validation**: Zod schemas for request/response validation
- **Real-time Communication**: WebSocket (ws library) for live updates
- **Rate Limiting**: express-rate-limit for API protection
- **Security**: helmet, cors, and custom security middleware
- **Documentation**: OpenAPI 3.0 specification with Swagger UI

### API Design Principles
- **RESTful Design**: Resource-based URLs with HTTP methods
- **Stateless Authentication**: JWT-based authentication for API endpoints
- **Consistent Response Format**: Standardized JSON response structure
- **Error Handling**: Comprehensive error responses with proper HTTP status codes
- **Versioning**: URL-based versioning (/api/v1/)
- **Rate Limiting**: Progressive rate limiting based on user type and endpoint

## Authentication Architecture

### JWT Token Strategy

**Token Structure**:
```typescript
// Access Token Payload (15-minute expiry)
interface AccessTokenPayload {
  userId: number
  username: string
  role: 'ADMIN' | 'READ_ONLY' | 'SUPER_ADMIN'
  sessionId: string
  iat: number // Issued at
  exp: number // Expires at
  iss: string // Issuer
  aud: string // Audience
}

// Refresh Token Payload (7-day expiry)
interface RefreshTokenPayload {
  userId: number
  sessionId: string
  tokenVersion: number // For token revocation
  iat: number
  exp: number
  iss: string
  aud: string
}
```

**Authentication Flow**:
```
1. POST /api/v1/auth/login (username/password)
   ↓
2. Validate credentials + account status
   ↓
3. Generate access token (15min) + refresh token (7d)
   ↓
4. Set refresh token in HTTP-only cookie
   ↓
5. Return access token + user info
   ↓
6. Client stores access token (memory/sessionStorage)
   ↓
7. All API requests include: Authorization: Bearer <access_token>
   ↓
8. Token expires → POST /api/v1/auth/refresh (with cookie)
   ↓
9. Return new access token (seamless renewal)
```

### Authentication Middleware
```typescript
// JWT Authentication Middleware
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token required',
          details: 'Include Authorization: Bearer <token> header'
        }
      })
    }

    const payload = JWTService.verifyAccessToken(token)
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired access token'
        }
      })
    }

    // Verify session is still active
    const session = await SessionService.validateSession(payload.sessionId)
    if (!session) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session has expired',
          details: 'Please refresh your token or login again'
        }
      })
    }

    req.user = {
      id: payload.userId,
      username: payload.username,
      role: payload.role,
      sessionId: payload.sessionId
    }

    next()
  } catch (error) {
    console.error('Authentication error:', error)
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed'
      }
    })
  }
}

// Role-based Authorization
export const requireRole = (roles: string[]) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    })
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: { 
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `Access denied. Required roles: ${roles.join(', ')}`,
        userRole: req.user.role
      }
    })
  }

  next()
}
```

## RESTful API Endpoints

### Standard Response Format
```typescript
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
    timestamp?: string
    requestId?: string
  }
  meta?: {
    pagination?: PaginationMeta
    timing?: {
      requestTime: number
      processingTime: number
    }
    version?: string
  }
}

interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}
```

### Authentication Endpoints

#### POST /api/v1/auth/login
```typescript
// Request
interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
}

// Response
interface LoginResponse {
  success: true
  data: {
    user: {
      id: number
      username: string
      role: string
      lastLogin?: string
    }
    accessToken: string
    expiresAt: string
    refreshExpiresAt: string
  }
}

// Implementation
router.post('/login', 
  authRateLimit, // 5 attempts per 15 minutes
  validate(loginSchema),
  async (req: Request, res: Response) => {
    try {
      const { username, password, rememberMe } = req.body
      
      const result = await AuthService.authenticateUser(
        username, 
        password,
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          rememberMe
        }
      )
      
      // Set refresh token cookie
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
      }
      
      res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions)
      
      res.json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          expiresAt: result.session.expiresAt,
          refreshExpiresAt: new Date(Date.now() + cookieOptions.maxAge).toISOString()
        }
      })
      
    } catch (error) {
      res.status(401).json({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: error instanceof Error ? error.message : 'Authentication failed'
        }
      })
    }
  }
)
```

#### POST /api/v1/auth/refresh
```typescript
// No request body (uses HTTP-only cookie)

// Response
interface RefreshResponse {
  success: true
  data: {
    accessToken: string
    expiresAt: string
  }
}

// Implementation
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token required'
        }
      })
    }
    
    const result = await AuthService.refreshAccessToken(refreshToken)
    
    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresAt: result.expiresAt
      }
    })
    
  } catch (error) {
    res.clearCookie('refreshToken')
    res.status(401).json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: error instanceof Error ? error.message : 'Token refresh failed'
      }
    })
  }
})
```

#### POST /api/v1/auth/logout
```typescript
router.post('/logout', 
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      // Invalidate session
      await AuthService.logoutUser(req.user!.sessionId)
      
      // Clear refresh token cookie
      res.clearCookie('refreshToken')
      
      res.json({
        success: true,
        data: {
          message: 'Logged out successfully'
        }
      })
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: 'Failed to logout'
        }
      })
    }
  }
)
```

### Analytics Endpoints

#### GET /api/v1/analytics/overview
```typescript
// Query Parameters
interface OverviewQuery {
  timeRange?: '1h' | '24h' | '7d' | '30d'
  timezone?: string
}

// Response
interface OverviewResponse {
  success: true
  data: {
    summary: {
      totalRequests: number
      totalToolCalls: number
      successRate: number
      avgResponseTime: number
      errorCount: number
      activeUsers: number
    }
    trends: {
      requestsOverTime: Array<{
        timestamp: string
        count: number
      }>
      successRateOverTime: Array<{
        timestamp: string
        rate: number
      }>
      responseTimeOverTime: Array<{
        timestamp: string
        p50: number
        p95: number
        p99: number
      }>
    }
    topTools: Array<{
      bcpName: string
      toolName: string
      operation: string
      count: number
      avgDuration: number
      successRate: number
    }>
    recentErrors: Array<{
      id: string
      level: string
      message: string
      timestamp: string
      toolContext?: any
    }>
  }
}

// Implementation
router.get('/overview',
  authenticateJWT,
  requireRole(['ADMIN', 'READ_ONLY']),
  validate(overviewQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { timeRange = '24h', timezone = 'UTC' } = req.query as OverviewQuery
      
      const startTime = Date.now()
      
      const [summary, trends, topTools, recentErrors] = await Promise.all([
        AnalyticsService.getSummaryMetrics(timeRange, timezone),
        AnalyticsService.getTrends(timeRange, timezone),
        AnalyticsService.getTopTools(timeRange, 10),
        AnalyticsService.getRecentErrors(20)
      ])
      
      const processingTime = Date.now() - startTime
      
      res.json({
        success: true,
        data: {
          summary,
          trends,
          topTools,
          recentErrors
        },
        meta: {
          timing: {
            requestTime: startTime,
            processingTime
          }
        }
      })
      
    } catch (error) {
      console.error('Analytics overview error:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to fetch analytics overview'
        }
      })
    }
  }
)
```

#### GET /api/v1/analytics/tools
```typescript
// Query Parameters
interface ToolsQuery {
  page?: number
  limit?: number
  timeRange?: string
  bcpName?: string
  toolName?: string
  operation?: string
  success?: boolean
  sortBy?: 'timestamp' | 'duration' | 'count'
  sortOrder?: 'asc' | 'desc'
}

// Response
interface ToolsResponse {
  success: true
  data: {
    tools: Array<{
      id: string
      executionId: string
      bcpName: string
      toolName: string
      operation: string
      parameters?: any
      duration: number
      success: boolean
      timestamp: string
      user?: {
        id: number
        username: string
      }
      error?: {
        message: string
        code?: string
      }
    }>
  }
  meta: {
    pagination: PaginationMeta
  }
}

router.get('/tools',
  authenticateJWT,
  requireRole(['ADMIN', 'READ_ONLY']),
  validate(toolsQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const query = req.query as ToolsQuery
      const { page = 1, limit = 50 } = query
      
      const result = await AnalyticsService.getToolUsageLogs({
        ...query,
        page: Math.max(1, page),
        limit: Math.min(100, Math.max(1, limit))
      })
      
      res.json({
        success: true,
        data: {
          tools: result.data
        },
        meta: {
          pagination: result.pagination
        }
      })
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'TOOLS_QUERY_ERROR',
          message: 'Failed to fetch tool usage data'
        }
      })
    }
  }
)
```

#### GET /api/v1/analytics/errors
```typescript
// Query Parameters
interface ErrorsQuery {
  page?: number
  limit?: number
  level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  resolved?: boolean
  category?: string
  timeRange?: string
  search?: string
}

// Response
interface ErrorsResponse {
  success: true
  data: {
    errors: Array<{
      id: string
      level: string
      message: string
      category?: string
      timestamp: string
      context?: any
      toolContext?: any
      resolved: boolean
      resolvedBy?: string
      resolvedAt?: string
      severity?: number
      occurrenceCount: number
    }>
  }
  meta: {
    pagination: PaginationMeta
    aggregations: {
      byLevel: Record<string, number>
      byCategory: Record<string, number>
      byResolved: { resolved: number; unresolved: number }
    }
  }
}

router.get('/errors',
  authenticateJWT,
  requireRole(['ADMIN']),
  validate(errorsQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const query = req.query as ErrorsQuery
      
      const [result, aggregations] = await Promise.all([
        AnalyticsService.getErrorLogs(query),
        AnalyticsService.getErrorAggregations(query)
      ])
      
      res.json({
        success: true,
        data: {
          errors: result.data
        },
        meta: {
          pagination: result.pagination,
          aggregations
        }
      })
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'ERRORS_QUERY_ERROR',
          message: 'Failed to fetch error data'
        }
      })
    }
  }
)
```

#### PATCH /api/v1/analytics/errors/:id/resolve
```typescript
// Request
interface ResolveErrorRequest {
  resolutionNotes?: string
}

// Response
interface ResolveErrorResponse {
  success: true
  data: {
    id: string
    resolved: boolean
    resolvedBy: string
    resolvedAt: string
    resolutionNotes?: string
  }
}

router.patch('/:id/resolve',
  authenticateJWT,
  requireRole(['ADMIN']),
  validate(resolveErrorSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const { resolutionNotes } = req.body
      
      const result = await AnalyticsService.resolveError(
        id, 
        req.user!.id,
        resolutionNotes
      )
      
      res.json({
        success: true,
        data: result
      })
      
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ERROR_NOT_FOUND',
            message: 'Error log not found'
          }
        })
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'RESOLVE_ERROR_FAILED',
            message: 'Failed to resolve error'
          }
        })
      }
    }
  }
)
```

### Performance Metrics Endpoints

#### GET /api/v1/analytics/metrics
```typescript
// Query Parameters
interface MetricsQuery {
  metricName?: string
  timeRange?: string
  aggregation?: '1m' | '5m' | '1h' | '1d'
  labels?: Record<string, string>
}

// Response
interface MetricsResponse {
  success: true
  data: {
    metrics: Array<{
      metricName: string
      values: Array<{
        timestamp: string
        value: number
        labels?: Record<string, string>
      }>
      aggregation: string
    }>
  }
}

router.get('/metrics',
  authenticateJWT,
  requireRole(['ADMIN', 'READ_ONLY']),
  validate(metricsQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const query = req.query as MetricsQuery
      
      const metrics = await AnalyticsService.getPerformanceMetrics(query)
      
      res.json({
        success: true,
        data: {
          metrics
        }
      })
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_ERROR',
          message: 'Failed to fetch performance metrics'
        }
      })
    }
  }
)
```

### Export Endpoints

#### GET /api/v1/analytics/export/csv
```typescript
// Query Parameters
interface ExportQuery {
  type: 'tools' | 'errors' | 'requests'
  timeRange: string
  format?: 'csv' | 'json'
  filters?: Record<string, any>
}

router.get('/export/:format',
  authenticateJWT,
  requireRole(['ADMIN']),
  validate(exportQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { format } = req.params as { format: 'csv' | 'json' }
      const query = req.query as ExportQuery
      
      const exportService = new AnalyticsExportService()
      const result = await exportService.exportData({
        ...query,
        format
      })
      
      res.setHeader('Content-Type', 
        format === 'csv' ? 'text/csv' : 'application/json'
      )
      res.setHeader('Content-Disposition', 
        `attachment; filename="analytics_${query.type}_${Date.now()}.${format}"`
      )
      
      res.send(result.data)
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'EXPORT_ERROR',
          message: 'Failed to export data'
        }
      })
    }
  }
)
```

## WebSocket Real-time API

### Connection Architecture

**WebSocket Server Setup**:
```typescript
import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { parse } from 'url'

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number
  username?: string
  role?: string
  sessionId?: string
  isAuthenticated: boolean
  subscriptions: Set<string>
}

class AnalyticsWebSocketServer {
  private wss: WebSocketServer
  private clients: Set<AuthenticatedWebSocket> = new Set()
  
  constructor(server: any) {
    this.wss = new WebSocketServer({
      server,
      path: '/api/v1/ws/analytics',
      verifyClient: this.verifyClient.bind(this)
    })
    
    this.setupEventHandlers()
  }
  
  private async verifyClient(info: { req: IncomingMessage }): Promise<boolean> {
    try {
      const url = parse(info.req.url || '', true)
      const token = url.query.token as string
      
      if (!token) return false
      
      const payload = JWTService.verifyAccessToken(token)
      if (!payload) return false
      
      const session = await SessionService.validateSession(payload.sessionId)
      return !!session
      
    } catch (error) {
      console.error('WebSocket verification error:', error)
      return false
    }
  }
  
  private setupEventHandlers(): void {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      this.handleConnection(ws, req)
    })
    
    // Listen to analytics events
    analyticsCollector.on('toolUsage', this.broadcastToolUsage.bind(this))
    analyticsCollector.on('error', this.broadcastError.bind(this))
    analyticsCollector.on('metrics', this.broadcastMetrics.bind(this))
    
    // Periodic metrics broadcast
    setInterval(() => {
      this.broadcastPeriodicMetrics()
    }, 10000) // Every 10 seconds
  }
}
```

### WebSocket Message Types

**Client → Server Messages**:
```typescript
// Subscribe to specific data streams
interface SubscribeMessage {
  type: 'subscribe'
  streams: Array<'tools' | 'errors' | 'metrics' | 'overview'>
}

// Unsubscribe from data streams
interface UnsubscribeMessage {
  type: 'unsubscribe'
  streams: Array<string>
}

// Request historical data
interface HistoryRequestMessage {
  type: 'history'
  dataType: 'tools' | 'errors' | 'metrics'
  timeRange: string
  filters?: Record<string, any>
}

// Ping for connection keep-alive
interface PingMessage {
  type: 'ping'
  timestamp: number
}
```

**Server → Client Messages**:
```typescript
// Real-time tool usage update
interface ToolUsageMessage {
  type: 'toolUsage'
  data: {
    executionId: string
    bcpName: string
    toolName: string
    operation: string
    duration: number
    success: boolean
    timestamp: string
    user?: {
      id: number
      username: string
    }
  }
}

// Real-time error notification
interface ErrorMessage {
  type: 'error'
  data: {
    id: string
    level: string
    message: string
    category?: string
    toolContext?: any
    timestamp: string
  }
}

// Performance metrics update
interface MetricsMessage {
  type: 'metrics'
  data: {
    activeRequests: number
    avgResponseTime: number
    errorRate: number
    successRate: number
    throughput: number
    timestamp: string
  }
}

// Periodic overview update
interface OverviewMessage {
  type: 'overview'
  data: {
    totalRequests: number
    totalErrors: number
    averageResponseTime: number
    successRate: number
    timestamp: string
  }
}

// Connection status messages
interface StatusMessage {
  type: 'status'
  status: 'connected' | 'authenticated' | 'error'
  message?: string
  clientId?: string
}

// Pong response
interface PongMessage {
  type: 'pong'
  timestamp: number
}
```

### WebSocket Client Implementation Example

```typescript
class AnalyticsWebSocketClient {
  private ws: WebSocket | null = null
  private token: string
  private subscriptions: Set<string> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private eventCallbacks: Map<string, Function[]> = new Map()
  
  constructor(token: string) {
    this.token = token
  }
  
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${WS_BASE_URL}/api/v1/ws/analytics?token=${this.token}`
      
      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {
        console.log('Analytics WebSocket connected')
        this.reconnectAttempts = 0
        resolve()
      }
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
      
      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason)
        this.handleReconnection()
      }
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        reject(error)
      }
    })
  }
  
  subscribe(streams: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected')
      return
    }
    
    streams.forEach(stream => this.subscriptions.add(stream))
    
    this.ws.send(JSON.stringify({
      type: 'subscribe',
      streams
    }))
  }
  
  on(eventType: string, callback: Function): void {
    if (!this.eventCallbacks.has(eventType)) {
      this.eventCallbacks.set(eventType, [])
    }
    this.eventCallbacks.get(eventType)!.push(callback)
  }
  
  private handleMessage(message: any): void {
    const callbacks = this.eventCallbacks.get(message.type)
    if (callbacks) {
      callbacks.forEach(callback => callback(message.data))
    }
  }
  
  private handleReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.pow(2, this.reconnectAttempts) * 1000
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
        this.connect().catch(console.error)
      }, delay)
    } else {
      console.error('Max reconnection attempts reached')
    }
  }
}

// Usage example
const wsClient = new AnalyticsWebSocketClient(accessToken)

await wsClient.connect()

// Subscribe to real-time updates
wsClient.subscribe(['tools', 'errors', 'metrics'])

// Listen for events
wsClient.on('toolUsage', (data) => {
  console.log('New tool usage:', data)
  updateDashboard(data)
})

wsClient.on('error', (data) => {
  console.log('New error:', data)
  showErrorNotification(data)
})

wsClient.on('metrics', (data) => {
  console.log('Metrics update:', data)
  updateMetricsDisplay(data)
})
```

## Rate Limiting and Security

### Rate Limiting Configuration

```typescript
// Authentication endpoints - stricter limits
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window per IP
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `auth:${req.ip}:${req.body?.username || 'unknown'}`,
  skip: (req) => req.path.includes('/refresh')
})

// General API endpoints
export const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: (req) => {
    // Different limits based on user role
    const userRole = req.user?.role
    switch (userRole) {
      case 'SUPER_ADMIN': return 200
      case 'ADMIN': return 100
      case 'READ_ONLY': return 60
      default: return 30
    }
  },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'API rate limit exceeded. Please slow down your requests.'
    }
  },
  keyGenerator: (req) => req.user?.id?.toString() || req.ip
})

// Heavy operations (exports, large queries)
export const heavyOperationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 operations per 5 minutes
  message: {
    success: false,
    error: {
      code: 'HEAVY_OPERATION_LIMIT',
      message: 'Too many heavy operations. Please wait before trying again.'
    }
  }
})
```

### Input Validation Schemas

```typescript
import { z } from 'zod'

// Authentication schemas
export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1, 'Username is required').max(255),
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional()
  })
})

// Analytics query schemas
export const overviewQuerySchema = z.object({
  query: z.object({
    timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
    timezone: z.string().default('UTC')
  })
})

export const toolsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    timeRange: z.string().optional(),
    bcpName: z.string().optional(),
    toolName: z.string().optional(),
    operation: z.string().optional(),
    success: z.coerce.boolean().optional(),
    sortBy: z.enum(['timestamp', 'duration', 'count']).default('timestamp'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  })
})

export const errorsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).optional(),
    resolved: z.coerce.boolean().optional(),
    category: z.string().optional(),
    timeRange: z.string().optional(),
    search: z.string().optional()
  })
})
```

### Security Headers and CORS

```typescript
import helmet from 'helmet'
import cors from 'cors'

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}))

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3001',
      'https://*.railway.app'
    ]
    
    if (!origin || allowedOrigins.some(allowed => 
      origin.match(allowed.replace('*', '.*'))
    )) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
}))
```

## API Documentation

### OpenAPI Specification

The API includes comprehensive OpenAPI 3.0 documentation available at `/api/v1/docs` with:

- Interactive Swagger UI interface
- Complete endpoint documentation
- Request/response schemas
- Authentication examples
- Rate limiting information
- Error response formats

### API Testing and Development

**Health Check Endpoint**:
```typescript
GET /api/v1/health

Response:
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-08-24T12:00:00.000Z",
    "uptime": 3600,
    "version": "1.0.0",
    "environment": "production",
    "services": {
      "database": "healthy",
      "redis": "healthy",
      "websocket": "healthy"
    }
  }
}
```

This API specification provides a robust, secure, and scalable foundation for the analytics dashboard with comprehensive authentication, real-time capabilities, and extensive monitoring features.