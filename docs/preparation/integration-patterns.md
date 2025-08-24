# MCP Server Integration Patterns Research

## Executive Summary

Integration of analytics capabilities into existing MCP servers requires non-intrusive patterns that maintain performance while capturing comprehensive usage data. Research reveals that middleware-based logging, proxy patterns, and event-driven architectures provide optimal solutions for request/response tracking without disrupting core MCP functionality. Key considerations include performance impact minimization, error boundary implementation, and seamless deployment integration.

**Primary Recommendations:**
- Use Express middleware for request/response interception and logging
- Implement async batch logging to minimize performance impact
- Create analytics proxy layer for tool usage tracking
- Use event-driven patterns for loose coupling between MCP server and analytics
- Implement proper error boundaries to prevent analytics failures from affecting core functionality

## Current MCP Server Architecture Analysis

### Existing HubSpot MCP Structure

Based on codebase analysis, the current architecture follows these patterns:

**Core Components:**
- `src/core/server.ts` - Main MCP server implementation
- `src/core/bcp-tool-delegator.ts` - Tool routing and delegation
- `src/bcps/` - Bounded Context Packs (domain-specific tools)
- `src/core/response-enhancer.ts` - Response enhancement system

**Tool Flow:**
```
Client Request → MCP Server → BCP Delegator → Specific BCP Tool → Response Enhancer → Client
```

## Integration Strategies

### 1. Middleware-Based Logging (Recommended)

**Non-Intrusive Request/Response Capture:**
```typescript
// src/middleware/analytics-logger.ts
import { Request, Response, NextFunction } from 'express'
import { AnalyticsCollector } from '../services/analytics-collector.js'

interface AnalyticsContext {
  startTime: number
  requestId: string
  userId?: number
  sessionId?: string
}

export const analyticsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now()
  const requestId = generateRequestId()
  
  // Add analytics context to request
  const analyticsContext: AnalyticsContext = {
    startTime,
    requestId,
    userId: req.user?.id,
    sessionId: req.sessionID
  }
  
  // Store context for later use
  res.locals.analytics = analyticsContext
  
  // Capture request data
  const requestData = {
    method: req.method,
    path: req.path,
    query: req.query,
    headers: sanitizeHeaders(req.headers),
    body: sanitizeRequestBody(req.body),
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip,
    timestamp: new Date(startTime)
  }
  
  // Override res.json to capture response
  const originalJson = res.json
  res.json = function(data: any) {
    const endTime = Date.now()
    const duration = endTime - startTime
    
    // Log analytics data asynchronously
    setImmediate(() => {
      AnalyticsCollector.logMCPRequest({
        requestId,
        request: requestData,
        response: {
          statusCode: res.statusCode,
          data: sanitizeResponseData(data),
          headers: sanitizeHeaders(res.getHeaders()),
          duration
        },
        userId: analyticsContext.userId,
        sessionId: analyticsContext.sessionId,
        success: res.statusCode < 400
      }).catch(error => {
        console.error('Analytics logging failed:', error)
      })
    })
    
    return originalJson.call(this, data)
  }
  
  next()
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function sanitizeHeaders(headers: any): Record<string, string> {
  const sanitized: Record<string, string> = {}
  const allowedHeaders = [
    'content-type', 'user-agent', 'accept', 'accept-language',
    'content-length', 'host', 'origin', 'referer'
  ]
  
  for (const [key, value] of Object.entries(headers)) {
    if (allowedHeaders.includes(key.toLowerCase())) {
      sanitized[key] = String(value)
    }
  }
  
  return sanitized
}

function sanitizeRequestBody(body: any): any {
  if (!body) return null
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth']
  const sanitized = { ...body }
  
  for (const field of sensitiveFields) {
    if (sensitized[field]) {
      sanitized[field] = '[REDACTED]'
    }
  }
  
  return sanitized
}

function sanitizeResponseData(data: any): any {
  if (!data || typeof data !== 'object') return data
  
  // Limit response data size for storage
  const maxSize = 10000 // 10KB
  const jsonString = JSON.stringify(data)
  
  if (jsonString.length > maxSize) {
    return {
      _truncated: true,
      _originalSize: jsonString.length,
      _preview: jsonString.substring(0, maxSize) + '...'
    }
  }
  
  return data
}
```

### 2. BCP Tool Analytics Integration

**Enhanced Tool Wrapper for Usage Tracking:**
```typescript
// src/core/analytics-tool-wrapper.ts
import { BcpTool, BcpToolInput, BcpToolResult } from './types.js'
import { AnalyticsCollector } from '../services/analytics-collector.js'

export function wrapToolWithAnalytics<T extends BcpToolInput>(
  tool: BcpTool<T>,
  bcpName: string
): BcpTool<T> {
  return {
    ...tool,
    handler: async (input: T, context?: any): Promise<BcpToolResult> => {
      const startTime = Date.now()
      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Extract analytics context from request
      const analyticsContext = context?.analytics || {}
      
      try {
        // Call original handler
        const result = await tool.handler(input, context)
        
        const endTime = Date.now()
        const duration = endTime - startTime
        
        // Log successful tool usage asynchronously
        setImmediate(() => {
          AnalyticsCollector.logToolUsage({
            executionId,
            bcpName,
            toolName: tool.name,
            operation: extractOperation(input),
            parameters: sanitizeParameters(input),
            result: sanitizeResult(result),
            duration,
            success: true,
            timestamp: new Date(startTime),
            userId: analyticsContext.userId,
            sessionId: analyticsContext.sessionId,
            requestId: analyticsContext.requestId
          }).catch(error => {
            console.error('Tool analytics logging failed:', error)
          })
        })
        
        return result
      } catch (error) {
        const endTime = Date.now()
        const duration = endTime - startTime
        
        // Log failed tool usage
        setImmediate(() => {
          AnalyticsCollector.logToolUsage({
            executionId,
            bcpName,
            toolName: tool.name,
            operation: extractOperation(input),
            parameters: sanitizeParameters(input),
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            },
            duration,
            success: false,
            timestamp: new Date(startTime),
            userId: analyticsContext.userId,
            sessionId: analyticsContext.sessionId,
            requestId: analyticsContext.requestId
          }).catch(logError => {
            console.error('Error analytics logging failed:', logError)
          })
        })
        
        // Re-throw original error
        throw error
      }
    }
  }
}

function extractOperation(input: any): string {
  // Extract operation from tool input
  if (input && typeof input === 'object') {
    return input.operation || input.action || input.method || 'execute'
  }
  return 'execute'
}

function sanitizeParameters(input: any): any {
  if (!input) return null
  
  const sanitized = { ...input }
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'authorization']
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]'
    }
  }
  
  return sanitized
}

function sanitizeResult(result: any): any {
  if (!result) return null
  
  // Limit result data size for storage
  const maxSize = 5000 // 5KB
  const jsonString = JSON.stringify(result)
  
  if (jsonString.length > maxSize) {
    return {
      _truncated: true,
      _originalSize: jsonString.length,
      success: result.success,
      message: result.message
    }
  }
  
  return result
}
```

### 3. Enhanced BCP Registration with Analytics

**Modified Tool Registration Factory:**
```typescript
// src/core/analytics-enabled-tool-factory.ts
import { BcpTool } from './types.js'
import { wrapToolWithAnalytics } from './analytics-tool-wrapper.js'

export class AnalyticsEnabledToolFactory {
  private static analyticsEnabled = process.env.ANALYTICS_ENABLED === 'true'
  
  static registerBcp(bcpName: string, tools: BcpTool[]): BcpTool[] {
    if (!this.analyticsEnabled) {
      return tools
    }
    
    return tools.map(tool => wrapToolWithAnalytics(tool, bcpName))
  }
  
  static enableAnalytics(): void {
    this.analyticsEnabled = true
  }
  
  static disableAnalytics(): void {
    this.analyticsEnabled = false
  }
}

// Update existing BCP registrations
// src/core/tool-registration-factory.ts (enhanced)
import { AnalyticsEnabledToolFactory } from './analytics-enabled-tool-factory.js'

export class ToolRegistrationFactory {
  static createDelegatedTools() {
    const tools: Record<string, any> = {}
    
    // Register each BCP with analytics wrapper
    tools.hubspotCompany = this.createDelegatedTool(
      AnalyticsEnabledToolFactory.registerBcp('Companies', companyBcpTools),
      companyBcpDefinition
    )
    
    tools.hubspotContact = this.createDelegatedTool(
      AnalyticsEnabledToolFactory.registerBcp('Contacts', contactBcpTools),
      contactBcpDefinition
    )
    
    tools.hubspotNotes = this.createDelegatedTool(
      AnalyticsEnabledToolFactory.registerBcp('Notes', notesBcpTools),
      notesBcpDefinition
    )
    
    // ... continue for other BCPs
    
    return tools
  }
}
```

### 4. Analytics Data Collector Service

**Batch Processing for Performance:**
```typescript
// src/services/analytics-collector.ts
import { prisma } from '../config/database.js'
import { EventEmitter } from 'events'

interface ToolUsageLog {
  executionId: string
  bcpName: string
  toolName: string
  operation: string
  parameters?: any
  result?: any
  error?: { message: string; stack?: string }
  duration: number
  success: boolean
  timestamp: Date
  userId?: number
  sessionId?: string
  requestId?: string
}

interface MCPRequestLog {
  requestId: string
  request: {
    method: string
    path: string
    query: any
    headers: Record<string, string>
    body?: any
    userAgent?: string
    ipAddress?: string
    timestamp: Date
  }
  response: {
    statusCode: number
    data?: any
    headers: Record<string, string>
    duration: number
  }
  userId?: number
  sessionId?: string
  success: boolean
}

export class AnalyticsCollector extends EventEmitter {
  private static instance: AnalyticsCollector
  private toolUsageBuffer: ToolUsageLog[] = []
  private requestLogBuffer: MCPRequestLog[] = []
  private readonly batchSize = 50
  private readonly flushInterval = 5000 // 5 seconds
  private flushTimer?: NodeJS.Timeout
  
  constructor() {
    super()
    this.startBatchFlush()
  }
  
  static getInstance(): AnalyticsCollector {
    if (!this.instance) {
      this.instance = new AnalyticsCollector()
    }
    return this.instance
  }
  
  async logToolUsage(data: ToolUsageLog): Promise<void> {
    this.toolUsageBuffer.push(data)
    
    // Emit event for real-time processing
    this.emit('toolUsage', data)
    
    if (this.toolUsageBuffer.length >= this.batchSize) {
      await this.flushToolUsage()
    }
  }
  
  async logMCPRequest(data: MCPRequestLog): Promise<void> {
    this.requestLogBuffer.push(data)
    
    // Emit event for real-time processing
    this.emit('mcpRequest', data)
    
    if (this.requestLogBuffer.length >= this.batchSize) {
      await this.flushRequestLogs()
    }
  }
  
  private async flushToolUsage(): Promise<void> {
    if (this.toolUsageBuffer.length === 0) return
    
    const logs = [...this.toolUsageBuffer]
    this.toolUsageBuffer = []
    
    try {
      await prisma.toolUsageLogs.createMany({
        data: logs.map(log => ({
          executionId: log.executionId,
          bcpName: log.bcpName,
          toolName: log.toolName,
          operation: log.operation,
          parameters: log.parameters ? JSON.stringify(log.parameters) : null,
          responseData: log.result ? JSON.stringify(log.result) : null,
          errorMessage: log.error?.message,
          errorStack: log.error?.stack,
          durationMs: log.duration,
          success: log.success,
          userId: log.userId,
          sessionId: log.sessionId,
          requestId: log.requestId,
          timestamp: log.timestamp
        })),
        skipDuplicates: true
      })
    } catch (error) {
      console.error('Failed to flush tool usage logs:', error)
      // Could implement retry logic or dead letter queue here
    }
  }
  
  private async flushRequestLogs(): Promise<void> {
    if (this.requestLogBuffer.length === 0) return
    
    const logs = [...this.requestLogBuffer]
    this.requestLogBuffer = []
    
    try {
      await prisma.mcpRequestLogs.createMany({
        data: logs.map(log => ({
          requestId: log.requestId,
          method: log.request.method,
          path: log.request.path,
          queryParams: JSON.stringify(log.request.query),
          requestHeaders: JSON.stringify(log.request.headers),
          requestBody: log.request.body ? JSON.stringify(log.request.body) : null,
          responseStatusCode: log.response.statusCode,
          responseData: log.response.data ? JSON.stringify(log.response.data) : null,
          responseHeaders: JSON.stringify(log.response.headers),
          durationMs: log.response.duration,
          success: log.success,
          userId: log.userId,
          sessionId: log.sessionId,
          userAgent: log.request.userAgent,
          ipAddress: log.request.ipAddress,
          timestamp: log.request.timestamp
        })),
        skipDuplicates: true
      })
    } catch (error) {
      console.error('Failed to flush request logs:', error)
    }
  }
  
  private startBatchFlush(): void {
    this.flushTimer = setInterval(async () => {
      await this.flushToolUsage()
      await this.flushRequestLogs()
    }, this.flushInterval)
  }
  
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    
    // Flush remaining data
    await this.flushToolUsage()
    await this.flushRequestLogs()
  }
}

// Export singleton instance
export const analyticsCollector = AnalyticsCollector.getInstance()

// Static methods for convenience
export const AnalyticsCollector = {
  logToolUsage: (data: ToolUsageLog) => analyticsCollector.logToolUsage(data),
  logMCPRequest: (data: MCPRequestLog) => analyticsCollector.logMCPRequest(data)
}
```

### 5. Real-time Analytics Events

**Event-Driven Real-time Updates:**
```typescript
// src/services/realtime-analytics.ts
import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { analyticsCollector } from './analytics-collector.js'
import { AuthService } from './auth.service.js'

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number
  isAuthenticated: boolean
}

export class RealtimeAnalytics {
  private wss: WebSocketServer
  private clients: Set<AuthenticatedWebSocket> = new Set()
  
  constructor(server: any) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/analytics-stream',
      verifyClient: this.verifyClient.bind(this)
    })
    
    this.setupWebSocketHandlers()
    this.setupAnalyticsEventHandlers()
  }
  
  private async verifyClient(info: { req: IncomingMessage }): Promise<boolean> {
    // Verify authentication token from query params or headers
    const token = this.extractToken(info.req)
    
    if (!token) return false
    
    try {
      // Verify JWT token or session
      const isValid = await AuthService.verifyToken(token)
      return isValid
    } catch {
      return false
    }
  }
  
  private extractToken(req: IncomingMessage): string | null {
    const url = new URL(req.url || '', 'http://localhost')
    return url.searchParams.get('token') || 
           req.headers.authorization?.replace('Bearer ', '') || 
           null
  }
  
  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      ws.isAuthenticated = true
      this.clients.add(ws)
      
      // Send initial metrics
      this.sendInitialMetrics(ws)
      
      ws.on('close', () => {
        this.clients.delete(ws)
      })
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        this.clients.delete(ws)
      })
    })
  }
  
  private setupAnalyticsEventHandlers(): void {
    // Listen to tool usage events
    analyticsCollector.on('toolUsage', (data) => {
      this.broadcast({
        type: 'toolUsage',
        data: {
          bcpName: data.bcpName,
          toolName: data.toolName,
          operation: data.operation,
          duration: data.duration,
          success: data.success,
          timestamp: data.timestamp
        }
      })
    })
    
    // Listen to request events
    analyticsCollector.on('mcpRequest', (data) => {
      this.broadcast({
        type: 'mcpRequest',
        data: {
          method: data.request.method,
          path: data.request.path,
          statusCode: data.response.statusCode,
          duration: data.response.duration,
          success: data.success,
          timestamp: data.request.timestamp
        }
      })
    })
    
    // Send periodic metrics
    setInterval(() => {
      this.sendPeriodicMetrics()
    }, 10000) // Every 10 seconds
  }
  
  private broadcast(message: any): void {
    const messageString = JSON.stringify(message)
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString)
      }
    })
  }
  
  private async sendInitialMetrics(client: AuthenticatedWebSocket): Promise<void> {
    try {
      const metrics = await this.getRealtimeMetrics()
      client.send(JSON.stringify({
        type: 'initialMetrics',
        data: metrics
      }))
    } catch (error) {
      console.error('Failed to send initial metrics:', error)
    }
  }
  
  private async sendPeriodicMetrics(): Promise<void> {
    try {
      const metrics = await this.getRealtimeMetrics()
      this.broadcast({
        type: 'periodicMetrics',
        data: metrics
      })
    } catch (error) {
      console.error('Failed to send periodic metrics:', error)
    }
  }
  
  private async getRealtimeMetrics() {
    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60000)
    
    // Get metrics from last minute
    const [toolUsageCount, requestCount, errorCount] = await Promise.all([
      prisma.toolUsageLogs.count({
        where: {
          timestamp: { gte: oneMinuteAgo }
        }
      }),
      prisma.mcpRequestLogs.count({
        where: {
          timestamp: { gte: oneMinuteAgo }
        }
      }),
      prisma.toolUsageLogs.count({
        where: {
          timestamp: { gte: oneMinuteAgo },
          success: false
        }
      })
    ])
    
    return {
      toolUsageCount,
      requestCount,
      errorCount,
      successRate: toolUsageCount > 0 ? ((toolUsageCount - errorCount) / toolUsageCount) * 100 : 100,
      timestamp: now
    }
  }
}
```

### 6. Server Integration Points

**Enhanced Server Setup:**
```typescript
// src/core/analytics-enabled-server.ts
import express from 'express'
import { createServer } from 'http'
import { MCPServer } from './server.js'
import { analyticsMiddleware } from '../middleware/analytics-logger.js'
import { AnalyticsCollector } from '../services/analytics-collector.js'
import { RealtimeAnalytics } from '../services/realtime-analytics.js'

export class AnalyticsEnabledMCPServer extends MCPServer {
  private realtimeAnalytics?: RealtimeAnalytics
  
  protected setupExpress(): express.Application {
    const app = super.setupExpress()
    
    // Add analytics middleware before other middleware
    if (process.env.ANALYTICS_ENABLED === 'true') {
      app.use('/api', analyticsMiddleware)
      app.use('/mcp', analyticsMiddleware)
    }
    
    return app
  }
  
  protected setupHttpServer(): void {
    super.setupHttpServer()
    
    // Setup real-time analytics WebSocket server
    if (process.env.ANALYTICS_ENABLED === 'true' && this.httpServer) {
      this.realtimeAnalytics = new RealtimeAnalytics(this.httpServer)
    }
  }
  
  async shutdown(): Promise<void> {
    // Gracefully shutdown analytics collector
    if (AnalyticsCollector) {
      await AnalyticsCollector.getInstance().shutdown()
    }
    
    await super.shutdown()
  }
}
```

## Error Handling and Resilience

### Analytics Error Boundaries

```typescript
// src/middleware/analytics-error-boundary.ts
import { Request, Response, NextFunction } from 'express'

export const analyticsErrorBoundary = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Wrap all analytics operations in try-catch
  const originalNext = next
  
  next = (error?: any) => {
    if (error && error.isAnalyticsError) {
      // Log analytics error but don't propagate to client
      console.error('Analytics error (non-critical):', error)
      return originalNext() // Continue without error
    }
    
    return originalNext(error)
  }
  
  originalNext()
}

// Mark analytics errors
export class AnalyticsError extends Error {
  public readonly isAnalyticsError = true
  
  constructor(message: string, public readonly originalError?: Error) {
    super(message)
    this.name = 'AnalyticsError'
  }
}
```

### Performance Impact Monitoring

```typescript
// src/services/performance-monitor.ts
export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map()
  
  static recordAnalyticsOverhead(operation: string, overhead: number): void {
    const metrics = this.metrics.get(operation) || []
    metrics.push(overhead)
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift()
    }
    
    this.metrics.set(operation, metrics)
    
    // Log warning if analytics overhead is too high
    const avgOverhead = metrics.reduce((a, b) => a + b) / metrics.length
    if (avgOverhead > 50) { // 50ms threshold
      console.warn(`High analytics overhead for ${operation}: ${avgOverhead}ms`)
    }
  }
  
  static getMetrics(): Record<string, { avg: number; max: number; min: number }> {
    const result: Record<string, { avg: number; max: number; min: number }> = {}
    
    for (const [operation, values] of this.metrics) {
      if (values.length > 0) {
        result[operation] = {
          avg: values.reduce((a, b) => a + b) / values.length,
          max: Math.max(...values),
          min: Math.min(...values)
        }
      }
    }
    
    return result
  }
}
```

## Resource Links

- [Express Middleware Documentation](https://expressjs.com/en/guide/using-middleware.html)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [WebSocket Server Implementation](https://github.com/websockets/ws)
- [Event-Driven Architecture Patterns](https://nodejs.org/api/events.html)
- [Morgan HTTP Logger](https://github.com/expressjs/morgan)

## Recommendations

1. **Use middleware-based logging** for non-intrusive request/response capture
2. **Implement async batch processing** to minimize performance impact on core MCP operations
3. **Create tool wrapper functions** to capture detailed usage analytics without modifying existing BCP tools
4. **Use event-driven patterns** for loose coupling between MCP server and analytics
5. **Implement proper error boundaries** to prevent analytics failures from affecting core functionality
6. **Add performance monitoring** to track analytics overhead and optimize accordingly
7. **Use WebSocket streaming** for real-time dashboard updates without polling
8. **Sanitize sensitive data** before storing in analytics database
9. **Implement graceful shutdown** procedures to ensure analytics data is not lost
10. **Make analytics optional** via environment configuration for flexibility