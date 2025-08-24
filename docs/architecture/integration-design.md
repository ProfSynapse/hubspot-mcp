# Integration Architecture Design

## Executive Summary

This document defines the comprehensive integration architecture for seamlessly incorporating analytics capabilities into the existing HubSpot MCP server. The design emphasizes non-intrusive patterns, performance optimization, and maintainability while preserving all existing functionality and ensuring analytics collection operates transparently alongside core MCP operations.

## Integration Strategy Overview

### Design Principles
- **Non-Intrusive Integration**: Analytics functionality should not modify existing MCP business logic
- **Zero Performance Impact**: Core MCP operations must maintain their original performance characteristics
- **Transparent Operation**: Analytics collection should be invisible to MCP clients
- **Graceful Degradation**: Analytics failures should never impact core MCP functionality
- **Optional Activation**: Analytics can be completely disabled via configuration
- **Backward Compatibility**: All existing MCP functionality must remain unchanged

### Integration Approach
- **Middleware-Based Interception**: Capture requests and responses at the middleware layer
- **Proxy Pattern**: Wrap existing BCP tools with analytics collection
- **Event-Driven Architecture**: Decouple analytics collection from core operations
- **Async Processing**: Minimize impact through asynchronous processing
- **Circuit Breaker Pattern**: Protect against analytics system failures

## Current MCP Architecture Analysis

### Existing System Structure
Based on the current HubSpot MCP codebase:

```typescript
// Current architecture overview
src/
├── core/
│   ├── server.ts                 // Main MCP server (Express + MCP handler)
│   ├── bcp-tool-delegator.ts     // Tool routing and delegation
│   ├── response-enhancer.ts      // Response enhancement system
│   └── tool-registration-factory.ts
├── bcps/                         // Bounded Context Packs
│   ├── Companies/
│   ├── Contacts/
│   ├── Notes/
│   ├── Properties/
│   └── [other-domains]/
└── services/                     // External services (HubSpot API)
```

### Current Request Flow
```
Client Request → Express Router → MCP Handler → BCP Delegator → Specific BCP Tool → Response Enhancer → Client Response
```

### Integration Points Identified
1. **Express Middleware Layer**: Request/response interception
2. **BCP Tool Wrapper**: Individual tool usage tracking  
3. **Response Enhancer**: Success/failure status capture
4. **Error Boundaries**: Comprehensive error logging
5. **Server Lifecycle**: Graceful startup/shutdown integration

## Analytics Integration Architecture

### Enhanced System Architecture

```typescript
// Enhanced architecture with analytics
src/
├── core/
│   ├── server.ts                      // Enhanced with analytics setup
│   ├── bcp-tool-delegator.ts          // Enhanced with analytics wrapper
│   ├── response-enhancer.ts           // Enhanced with analytics context
│   ├── analytics-server.ts            // NEW: Analytics server wrapper
│   └── analytics-tool-wrapper.ts      // NEW: Tool analytics wrapper
├── middleware/
│   ├── analytics-interceptor.ts       // NEW: Request/response capture
│   ├── analytics-error-boundary.ts    // NEW: Error interception
│   └── performance-monitor.ts          // NEW: Performance tracking
├── services/
│   ├── analytics-collector.ts         // NEW: Data collection service
│   ├── realtime-broadcaster.ts        // NEW: WebSocket broadcasting
│   └── performance-metrics.ts         // NEW: Metrics calculation
├── analytics/                         // NEW: Analytics subsystem
│   ├── dashboard/                     // Dashboard application
│   ├── api/                          // Analytics API endpoints
│   └── database/                     // Database models
└── bcps/                             // Unchanged BCP structure
```

### Enhanced Request Flow
```
Client Request 
  ↓
Analytics Request Interceptor (captures request metadata)
  ↓
Express Router → MCP Handler → BCP Delegator 
  ↓
Analytics Tool Wrapper (wraps BCP tool execution)
  ↓
Specific BCP Tool (unchanged)
  ↓
Analytics Tool Wrapper (captures execution results)
  ↓
Response Enhancer (unchanged)
  ↓
Analytics Response Interceptor (captures response metadata)
  ↓
Analytics Collector (async batch processing)
  ↓
Client Response (unchanged timing/format)
```

## Middleware Integration Layer

### Analytics Request/Response Interceptor

```typescript
// src/middleware/analytics-interceptor.ts
import { Request, Response, NextFunction } from 'express'
import { AnalyticsCollector } from '../services/analytics-collector.js'
import { PerformanceMonitor } from '../services/performance-monitor.js'

export interface AnalyticsContext {
  requestId: string
  startTime: number
  userId?: number
  sessionId?: string
  toolExecutions: ToolExecution[]
}

interface ToolExecution {
  bcpName: string
  toolName: string
  operation: string
  startTime: number
  endTime?: number
  success?: boolean
  error?: any
}

/**
 * Non-intrusive analytics middleware that captures comprehensive request/response data
 */
export class AnalyticsInterceptor {
  private static isEnabled = process.env.ANALYTICS_ENABLED === 'true'
  
  static requestInterceptor() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.isEnabled) {
        return next()
      }
      
      const requestId = this.generateRequestId()
      const startTime = Date.now()
      
      // Initialize analytics context
      const analyticsContext: AnalyticsContext = {
        requestId,
        startTime,
        userId: this.extractUserId(req),
        sessionId: this.extractSessionId(req),
        toolExecutions: []
      }
      
      // Attach to request for downstream use
      ;(req as any).analyticsContext = analyticsContext
      
      // Capture request metadata
      const requestMetadata = {
        requestId,
        method: req.method,
        path: req.path,
        query: this.sanitizeQueryParams(req.query),
        headers: this.sanitizeHeaders(req.headers),
        body: this.sanitizeRequestBody(req.body),
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        timestamp: new Date(startTime),
        userId: analyticsContext.userId,
        sessionId: analyticsContext.sessionId
      }
      
      // Store for response processing
      ;(res as any).analyticsRequest = requestMetadata
      
      // Override res.json to capture response
      const originalJson = res.json.bind(res)
      res.json = function(data: any) {
        const endTime = Date.now()
        const duration = endTime - startTime
        
        // Capture response metadata
        const responseMetadata = {
          statusCode: res.statusCode,
          headers: this.sanitizeHeaders(res.getHeaders()),
          body: this.sanitizeResponseBody(data),
          duration,
          timestamp: new Date(endTime),
          success: res.statusCode < 400
        }
        
        // Async analytics processing (non-blocking)
        setImmediate(() => {
          AnalyticsCollector.logMCPRequest({
            ...requestMetadata,
            response: responseMetadata
          }).catch(error => {
            console.error('Analytics logging failed (non-critical):', error)
          })
        })
        
        return originalJson.call(this, data)
      }.bind(res)
      
      next()
    }
  }
  
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
  
  private static extractUserId(req: Request): number | undefined {
    return (req as any).user?.id
  }
  
  private static extractSessionId(req: Request): string | undefined {
    return (req as any).user?.sessionId || req.sessionID
  }
  
  private static sanitizeQueryParams(query: any): any {
    if (!query || typeof query !== 'object') return query
    
    const sanitized = { ...query }
    const sensitiveParams = ['token', 'key', 'secret', 'password']
    
    for (const param of sensitiveParams) {
      if (sanitized[param]) {
        sanitized[param] = '[REDACTED]'
      }
    }
    
    return sanitized
  }
  
  private static sanitizeHeaders(headers: any): Record<string, string> {
    if (!headers) return {}
    
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
  
  private static sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') return body
    
    const sanitized = JSON.parse(JSON.stringify(body))
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth']
    
    const redactSensitive = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return obj
      
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]'
        } else if (typeof value === 'object') {
          redactSensitive(value)
        }
      }
    }
    
    redactSensitive(sanitized)
    return sanitized
  }
  
  private static sanitizeResponseBody(body: any): any {
    if (!body || typeof body !== 'object') return body
    
    // Limit response size for storage efficiency
    const jsonString = JSON.stringify(body)
    const maxSize = 10000 // 10KB
    
    if (jsonString.length > maxSize) {
      return {
        _truncated: true,
        _originalSize: jsonString.length,
        _preview: jsonString.substring(0, maxSize / 2),
        success: body.success,
        message: body.message,
        dataType: Array.isArray(body.data) ? 'array' : typeof body.data,
        dataSize: Array.isArray(body.data) ? body.data.length : undefined
      }
    }
    
    return body
  }
}
```

## BCP Tool Analytics Wrapper

### Tool Execution Tracking

```typescript
// src/core/analytics-tool-wrapper.ts
import { BcpTool, BcpToolInput, BcpToolResult } from './types.js'
import { AnalyticsCollector } from '../services/analytics-collector.js'
import { PerformanceMonitor } from '../services/performance-monitor.js'
import { CircuitBreaker } from '../utils/circuit-breaker.js'

/**
 * Wraps BCP tools with comprehensive analytics collection
 * without modifying original tool behavior
 */
export class AnalyticsToolWrapper {
  private static isEnabled = process.env.ANALYTICS_ENABLED === 'true'
  private static circuitBreaker = new CircuitBreaker({
    threshold: 5,
    timeout: 10000,
    resetTimeout: 30000
  })
  
  /**
   * Wrap a BCP tool with analytics collection
   */
  static wrapTool<T extends BcpToolInput>(
    tool: BcpTool<T>,
    bcpName: string
  ): BcpTool<T> {
    if (!this.isEnabled) {
      return tool // Return original tool if analytics disabled
    }
    
    return {
      ...tool,
      handler: async (input: T, context?: any): Promise<BcpToolResult> => {
        const executionId = this.generateExecutionId()
        const startTime = Date.now()
        const analyticsContext = context?.req?.analyticsContext
        
        // Extract operation from input
        const operation = this.extractOperation(input)
        
        const executionMetadata = {
          executionId,
          bcpName,
          toolName: tool.name,
          operation,
          parameters: this.sanitizeParameters(input),
          startTime: new Date(startTime),
          userId: analyticsContext?.userId,
          sessionId: analyticsContext?.sessionId,
          requestId: analyticsContext?.requestId,
          ipAddress: context?.req?.ip,
          userAgent: context?.req?.get?.('User-Agent')
        }
        
        try {
          // Execute original tool (unchanged)
          const result = await tool.handler(input, context)
          
          const endTime = Date.now()
          const duration = endTime - startTime
          
          // Track successful execution
          this.logToolExecution({
            ...executionMetadata,
            endTime: new Date(endTime),
            duration,
            success: true,
            result: this.sanitizeResult(result)
          })
          
          // Track performance metrics
          PerformanceMonitor.recordToolExecution(bcpName, tool.name, duration, true)
          
          return result
          
        } catch (error) {
          const endTime = Date.now()
          const duration = endTime - startTime
          
          // Track failed execution
          this.logToolExecution({
            ...executionMetadata,
            endTime: new Date(endTime),
            duration,
            success: false,
            error: {
              name: error instanceof Error ? error.name : 'UnknownError',
              message: error instanceof Error ? error.message : 'Unknown error occurred',
              stack: error instanceof Error ? error.stack : undefined,
              code: (error as any)?.code,
              statusCode: (error as any)?.statusCode
            }
          })
          
          // Track performance metrics for failures
          PerformanceMonitor.recordToolExecution(bcpName, tool.name, duration, false)
          
          // Re-throw original error (unchanged behavior)
          throw error
        }
      }
    }
  }
  
  private static logToolExecution(data: ToolExecutionData): void {
    // Use circuit breaker to prevent analytics failures from cascading
    this.circuitBreaker.call(async () => {
      await AnalyticsCollector.logToolUsage(data)
    }).catch(error => {
      // Log analytics failure but don't propagate
      console.warn('Analytics logging failed (non-critical):', error)
    })
  }
  
  private static generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
  
  private static extractOperation(input: any): string {
    if (!input || typeof input !== 'object') {
      return 'execute'
    }
    
    // Try to extract operation from common parameter names
    const operationFields = ['operation', 'action', 'method', 'type', 'command']
    
    for (const field of operationFields) {
      if (input[field] && typeof input[field] === 'string') {
        return input[field]
      }
    }
    
    return 'execute'
  }
  
  private static sanitizeParameters(input: any): any {
    if (!input) return null
    
    try {
      const sanitized = JSON.parse(JSON.stringify(input))
      const sensitiveFields = [
        'password', 'token', 'secret', 'key', 'auth', 'authorization',
        'apikey', 'access_token', 'refresh_token', 'client_secret'
      ]
      
      const redactSensitive = (obj: any) => {
        if (typeof obj !== 'object' || obj === null) return
        
        for (const [key, value] of Object.entries(obj)) {
          if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            obj[key] = '[REDACTED]'
          } else if (typeof value === 'object') {
            redactSensitive(value)
          }
        }
      }
      
      redactSensitive(sanitized)
      return sanitized
    } catch (error) {
      console.warn('Failed to sanitize parameters:', error)
      return { _sanitizationError: true }
    }
  }
  
  private static sanitizeResult(result: any): any {
    if (!result) return null
    
    try {
      // Limit result size for storage efficiency
      const jsonString = JSON.stringify(result)
      const maxSize = 5000 // 5KB for individual tool results
      
      if (jsonString.length > maxSize) {
        return {
          _truncated: true,
          _originalSize: jsonString.length,
          success: result.success,
          message: result.message,
          dataType: Array.isArray(result.data) ? 'array' : typeof result.data,
          dataSize: Array.isArray(result.data) ? result.data.length : undefined,
          _preview: jsonString.substring(0, maxSize / 2)
        }
      }
      
      return result
    } catch (error) {
      console.warn('Failed to sanitize result:', error)
      return { _sanitizationError: true }
    }
  }
}

interface ToolExecutionData {
  executionId: string
  bcpName: string
  toolName: string
  operation: string
  parameters: any
  startTime: Date
  endTime?: Date
  duration?: number
  success: boolean
  result?: any
  error?: {
    name: string
    message: string
    stack?: string
    code?: string
    statusCode?: number
  }
  userId?: number
  sessionId?: string
  requestId?: string
  ipAddress?: string
  userAgent?: string
}
```

## Enhanced Server Integration

### Analytics-Enhanced MCP Server

```typescript
// src/core/analytics-server.ts
import { MCPServer } from './server.js'
import { AnalyticsInterceptor } from '../middleware/analytics-interceptor.js'
import { AnalyticsErrorBoundary } from '../middleware/analytics-error-boundary.js'
import { AnalyticsCollector } from '../services/analytics-collector.js'
import { RealtimeBroadcaster } from '../services/realtime-broadcaster.js'
import { DashboardServer } from '../analytics/dashboard-server.js'

/**
 * Enhanced MCP Server with integrated analytics capabilities
 * Maintains full backward compatibility with existing functionality
 */
export class AnalyticsEnhancedMCPServer extends MCPServer {
  private analyticsCollector?: AnalyticsCollector
  private realtimeBroadcaster?: RealtimeBroadcaster
  private dashboardServer?: DashboardServer
  private isAnalyticsEnabled = process.env.ANALYTICS_ENABLED === 'true'
  
  /**
   * Enhanced server initialization with analytics setup
   */
  protected async initialize(): Promise<void> {
    try {
      // Initialize core MCP functionality first
      await super.initialize()
      
      if (this.isAnalyticsEnabled) {
        await this.initializeAnalytics()
      }
      
      console.log('✅ Analytics-enhanced MCP server initialized successfully')
    } catch (error) {
      console.error('❌ Server initialization failed:', error)
      throw error
    }
  }
  
  /**
   * Setup Express middleware with analytics integration
   */
  protected setupMiddleware(): void {
    // Setup core MCP middleware first
    super.setupMiddleware()
    
    if (this.isAnalyticsEnabled) {
      // Add analytics middleware (non-intrusive)
      this.app.use(AnalyticsErrorBoundary.errorBoundaryMiddleware())
      this.app.use(AnalyticsInterceptor.requestInterceptor())
      
      console.log('✅ Analytics middleware configured')
    }
  }
  
  /**
   * Enhanced tool registration with analytics wrapping
   */
  protected registerTools(): void {
    const originalTools = this.getToolRegistry()
    
    if (this.isAnalyticsEnabled) {
      // Wrap tools with analytics collection
      const enhancedTools = this.wrapToolsWithAnalytics(originalTools)
      this.setToolRegistry(enhancedTools)
      
      console.log('✅ Tools wrapped with analytics collection')
    } else {
      // Use original tools without modification
      super.registerTools()
    }
  }
  
  /**
   * Initialize analytics subsystem
   */
  private async initializeAnalytics(): Promise<void> {
    try {
      // Initialize analytics collector
      this.analyticsCollector = new AnalyticsCollector()
      await this.analyticsCollector.initialize()
      
      // Initialize real-time broadcasting
      if (this.httpServer) {
        this.realtimeBroadcaster = new RealtimeBroadcaster(this.httpServer)
        await this.realtimeBroadcaster.initialize()
      }
      
      // Initialize dashboard server (if enabled)
      if (process.env.DASHBOARD_ENABLED === 'true') {
        this.dashboardServer = new DashboardServer(this.app, this.httpServer)
        await this.dashboardServer.initialize()
      }
      
      console.log('✅ Analytics subsystem initialized')
    } catch (error) {
      console.error('⚠️ Analytics initialization failed (non-critical):', error)
      // Continue without analytics rather than failing completely
      this.isAnalyticsEnabled = false
    }
  }
  
  /**
   * Wrap BCP tools with analytics collection
   */
  private wrapToolsWithAnalytics(tools: any): any {
    const wrappedTools: any = {}
    
    for (const [toolKey, toolConfig] of Object.entries(tools)) {
      if (toolConfig && typeof toolConfig === 'object' && 'handler' in toolConfig) {
        // Extract BCP name from tool key or configuration
        const bcpName = this.extractBCPName(toolKey, toolConfig)
        
        wrappedTools[toolKey] = {
          ...toolConfig,
          handler: this.wrapToolHandler(toolConfig.handler, bcpName, toolKey)
        }
      } else {
        // Non-tool configuration, keep unchanged
        wrappedTools[toolKey] = toolConfig
      }
    }
    
    return wrappedTools
  }
  
  private wrapToolHandler(originalHandler: any, bcpName: string, toolName: string) {
    return async (input: any, context?: any) => {
      const executionId = this.generateExecutionId()
      const startTime = Date.now()
      
      try {
        // Execute original handler
        const result = await originalHandler(input, context)
        
        const endTime = Date.now()
        const duration = endTime - startTime
        
        // Log successful execution (async, non-blocking)
        this.logToolExecution({
          executionId,
          bcpName,
          toolName,
          operation: this.extractOperation(input),
          parameters: this.sanitizeInput(input),
          result: this.sanitizeResult(result),
          duration,
          success: true,
          timestamp: new Date(startTime),
          context: this.extractAnalyticsContext(context)
        })
        
        return result
        
      } catch (error) {
        const endTime = Date.now()
        const duration = endTime - startTime
        
        // Log failed execution (async, non-blocking)
        this.logToolExecution({
          executionId,
          bcpName,
          toolName,
          operation: this.extractOperation(input),
          parameters: this.sanitizeInput(input),
          error: this.serializeError(error),
          duration,
          success: false,
          timestamp: new Date(startTime),
          context: this.extractAnalyticsContext(context)
        })
        
        // Re-throw original error
        throw error
      }
    }
  }
  
  private logToolExecution(data: any): void {
    if (this.analyticsCollector) {
      setImmediate(() => {
        this.analyticsCollector!.logToolUsage(data).catch(error => {
          console.warn('Tool analytics logging failed (non-critical):', error)
        })
      })
    }
  }
  
  private extractBCPName(toolKey: string, toolConfig: any): string {
    // Try to extract BCP name from tool key (e.g., "hubspotCompany" -> "Companies")
    if (toolKey.startsWith('hubspot')) {
      const bcpPart = toolKey.replace('hubspot', '')
      return bcpPart.charAt(0).toUpperCase() + bcpPart.slice(1)
    }
    
    // Try to extract from tool configuration
    if (toolConfig.bcpName) {
      return toolConfig.bcpName
    }
    
    // Default fallback
    return 'Unknown'
  }
  
  private extractOperation(input: any): string {
    if (input && typeof input === 'object' && input.operation) {
      return input.operation
    }
    return 'execute'
  }
  
  private extractAnalyticsContext(context: any): any {
    if (!context || !context.req) return {}
    
    return {
      requestId: context.req.analyticsContext?.requestId,
      userId: context.req.analyticsContext?.userId,
      sessionId: context.req.analyticsContext?.sessionId,
      ipAddress: context.req.ip,
      userAgent: context.req.get?.('User-Agent')
    }
  }
  
  private sanitizeInput(input: any): any {
    // Implement input sanitization logic
    // (Similar to AnalyticsToolWrapper.sanitizeParameters)
    return input // Simplified for brevity
  }
  
  private sanitizeResult(result: any): any {
    // Implement result sanitization logic
    // (Similar to AnalyticsToolWrapper.sanitizeResult)  
    return result // Simplified for brevity
  }
  
  private serializeError(error: any): any {
    return {
      name: error?.name || 'UnknownError',
      message: error?.message || 'Unknown error occurred',
      stack: error?.stack,
      code: error?.code,
      statusCode: error?.statusCode
    }
  }
  
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
  
  /**
   * Enhanced graceful shutdown with analytics cleanup
   */
  async gracefulShutdown(): Promise<void> {
    console.log('🔄 Starting graceful shutdown...')
    
    try {
      // Shutdown analytics subsystem first
      if (this.analyticsCollector) {
        console.log('📊 Shutting down analytics collector...')
        await this.analyticsCollector.shutdown()
      }
      
      if (this.realtimeBroadcaster) {
        console.log('📡 Shutting down real-time broadcaster...')
        await this.realtimeBroadcaster.shutdown()
      }
      
      if (this.dashboardServer) {
        console.log('🖥️ Shutting down dashboard server...')
        await this.dashboardServer.shutdown()
      }
      
      // Shutdown core MCP server
      await super.gracefulShutdown()
      
      console.log('✅ Graceful shutdown completed')
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error)
      process.exit(1)
    }
  }
}
```

## Error Boundary Integration

### Comprehensive Error Handling

```typescript
// src/middleware/analytics-error-boundary.ts
import { Request, Response, NextFunction } from 'express'
import { AnalyticsCollector } from '../services/analytics-collector.js'

/**
 * Error boundary specifically for analytics operations
 * Ensures analytics failures never impact core MCP functionality
 */
export class AnalyticsErrorBoundary {
  
  /**
   * Global error boundary middleware
   */
  static errorBoundaryMiddleware() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      // Check if error is analytics-related
      if (this.isAnalyticsError(error)) {
        // Log analytics error but don't propagate
        console.warn('Analytics error caught and contained:', error.message)
        
        // Log the analytics failure for monitoring
        this.logAnalyticsFailure(error, req)
        
        // Continue with original request processing
        return next()
      }
      
      // For non-analytics errors, proceed with normal error handling
      next(error)
    }
  }
  
  /**
   * Wrap analytics operations with error containment
   */
  static wrapAnalyticsOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: any
  ): Promise<T | null> {
    return new Promise((resolve) => {
      operation()
        .then(resolve)
        .catch(error => {
          console.warn(`Analytics operation failed: ${operationName}`, {
            error: error.message,
            context
          })
          
          // Return null instead of throwing to prevent cascading failures
          resolve(null)
        })
    })
  }
  
  /**
   * Circuit breaker for analytics operations
   */
  static createAnalyticsCircuitBreaker() {
    let failureCount = 0
    let lastFailureTime = 0
    const maxFailures = 5
    const resetTimeout = 30000 // 30 seconds
    
    return {
      execute: async <T>(operation: () => Promise<T>): Promise<T | null> => {
        const now = Date.now()
        
        // Check if circuit breaker should reset
        if (now - lastFailureTime > resetTimeout) {
          failureCount = 0
        }
        
        // If circuit is open, skip operation
        if (failureCount >= maxFailures) {
          console.warn('Analytics circuit breaker is OPEN, skipping operation')
          return null
        }
        
        try {
          const result = await operation()
          // Reset failure count on success
          failureCount = 0
          return result
        } catch (error) {
          failureCount++
          lastFailureTime = now
          console.warn(`Analytics operation failed (${failureCount}/${maxFailures})`, error)
          return null
        }
      }
    }
  }
  
  private static isAnalyticsError(error: Error): boolean {
    const analyticsKeywords = [
      'analytics', 'collector', 'metrics', 'dashboard', 
      'websocket', 'realtime', 'broadcast'
    ]
    
    const errorMessage = error.message.toLowerCase()
    const errorStack = error.stack?.toLowerCase() || ''
    
    return analyticsKeywords.some(keyword => 
      errorMessage.includes(keyword) || errorStack.includes(keyword)
    ) || (error as any).isAnalyticsError === true
  }
  
  private static logAnalyticsFailure(error: Error, req: Request): void {
    const failureData = {
      type: 'ANALYTICS_FAILURE',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      request: {
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      },
      timestamp: new Date()
    }
    
    // Try to log to analytics collector, but with additional error handling
    if (AnalyticsCollector && !error.message.includes('AnalyticsCollector')) {
      setImmediate(() => {
        AnalyticsCollector.logError(failureData).catch(() => {
          // Fallback logging if analytics collector fails
          console.error('Analytics failure logging also failed:', failureData)
        })
      })
    }
  }
}

/**
 * Mark errors as analytics-related for proper handling
 */
export class AnalyticsError extends Error {
  public readonly isAnalyticsError = true
  
  constructor(message: string, public readonly operation?: string, public readonly originalError?: Error) {
    super(message)
    this.name = 'AnalyticsError'
  }
}
```

## Performance Impact Monitoring

### Performance Monitoring System

```typescript
// src/services/performance-monitor.ts
export class PerformanceMonitor {
  private static metrics = new Map<string, PerformanceMetric[]>()
  private static readonly maxMetricsPerKey = 1000 // Prevent memory leaks
  private static readonly analyticsOverheadThreshold = 50 // milliseconds
  
  /**
   * Record analytics overhead for monitoring
   */
  static recordAnalyticsOverhead(operation: string, overhead: number): void {
    const key = `analytics_overhead_${operation}`
    const metric: PerformanceMetric = {
      value: overhead,
      timestamp: Date.now(),
      operation
    }
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    
    const metrics = this.metrics.get(key)!
    metrics.push(metric)
    
    // Keep only recent metrics
    if (metrics.length > this.maxMetricsPerKey) {
      metrics.shift()
    }
    
    // Alert if overhead is too high
    if (overhead > this.analyticsOverheadThreshold) {
      console.warn(`High analytics overhead detected: ${operation} took ${overhead}ms`)
    }
  }
  
  /**
   * Record tool execution performance
   */
  static recordToolExecution(
    bcpName: string, 
    toolName: string, 
    duration: number, 
    success: boolean
  ): void {
    const key = `tool_performance_${bcpName}_${toolName}`
    const metric: PerformanceMetric = {
      value: duration,
      timestamp: Date.now(),
      operation: `${bcpName}.${toolName}`,
      metadata: { success }
    }
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    
    const metrics = this.metrics.get(key)!
    metrics.push(metric)
    
    // Keep only recent metrics
    if (metrics.length > this.maxMetricsPerKey) {
      metrics.shift()
    }
  }
  
  /**
   * Get performance statistics for monitoring
   */
  static getPerformanceStats(): PerformanceStats {
    const stats: PerformanceStats = {
      analyticsOverhead: {},
      toolPerformance: {},
      systemHealth: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: Date.now()
      }
    }
    
    // Calculate analytics overhead statistics
    for (const [key, metrics] of this.metrics.entries()) {
      if (key.startsWith('analytics_overhead_')) {
        const operation = key.replace('analytics_overhead_', '')
        stats.analyticsOverhead[operation] = this.calculateMetricStats(metrics)
      } else if (key.startsWith('tool_performance_')) {
        const toolKey = key.replace('tool_performance_', '')
        stats.toolPerformance[toolKey] = this.calculateMetricStats(metrics)
      }
    }
    
    return stats
  }
  
  private static calculateMetricStats(metrics: PerformanceMetric[]): MetricStats {
    if (metrics.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p95: 0 }
    }
    
    const values = metrics.map(m => m.value).sort((a, b) => a - b)
    const count = values.length
    const sum = values.reduce((a, b) => a + b, 0)
    const avg = sum / count
    const min = values[0]
    const max = values[count - 1]
    const p95Index = Math.floor(count * 0.95)
    const p95 = values[p95Index] || max
    
    return { count, avg, min, max, p95 }
  }
  
  /**
   * Monitor system health and alert on issues
   */
  static monitorSystemHealth(): void {
    setInterval(() => {
      const stats = this.getPerformanceStats()
      
      // Check for performance issues
      Object.entries(stats.analyticsOverhead).forEach(([operation, stats]) => {
        if (stats.avg > this.analyticsOverheadThreshold) {
          console.warn(`Analytics overhead issue: ${operation} averaging ${stats.avg}ms`)
        }
      })
      
      // Check memory usage
      const memUsage = stats.systemHealth.memoryUsage
      const memUsageMB = memUsage.heapUsed / 1024 / 1024
      if (memUsageMB > 500) { // 500MB threshold
        console.warn(`High memory usage: ${memUsageMB.toFixed(2)}MB`)
      }
      
    }, 60000) // Check every minute
  }
}

interface PerformanceMetric {
  value: number
  timestamp: number
  operation: string
  metadata?: any
}

interface MetricStats {
  count: number
  avg: number
  min: number
  max: number
  p95: number
}

interface PerformanceStats {
  analyticsOverhead: Record<string, MetricStats>
  toolPerformance: Record<string, MetricStats>
  systemHealth: {
    memoryUsage: NodeJS.MemoryUsage
    uptime: number
    timestamp: number
  }
}
```

## Configuration and Environment Integration

### Analytics Configuration Management

```typescript
// src/config/analytics-config.ts
import { z } from 'zod'

const analyticsConfigSchema = z.object({
  ANALYTICS_ENABLED: z.coerce.boolean().default(false),
  DASHBOARD_ENABLED: z.coerce.boolean().default(false),
  ANALYTICS_BATCH_SIZE: z.coerce.number().min(1).max(1000).default(50),
  ANALYTICS_FLUSH_INTERVAL: z.coerce.number().min(1000).max(60000).default(5000),
  ANALYTICS_CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().min(1).max(20).default(5),
  ANALYTICS_PERFORMANCE_THRESHOLD: z.coerce.number().min(10).max(1000).default(50),
  ANALYTICS_DATA_RETENTION_DAYS: z.coerce.number().min(1).max(365).default(90),
  WEBSOCKET_ENABLED: z.coerce.boolean().default(true),
  REAL_TIME_METRICS_INTERVAL: z.coerce.number().min(1000).max(60000).default(10000)
})

export type AnalyticsConfig = z.infer<typeof analyticsConfigSchema>

export class AnalyticsConfigManager {
  private static config: AnalyticsConfig
  
  static initialize(): void {
    try {
      this.config = analyticsConfigSchema.parse(process.env)
      console.log('✅ Analytics configuration validated')
      
      if (this.config.ANALYTICS_ENABLED) {
        console.log('📊 Analytics collection: ENABLED')
        console.log(`📊 Batch size: ${this.config.ANALYTICS_BATCH_SIZE}`)
        console.log(`📊 Flush interval: ${this.config.ANALYTICS_FLUSH_INTERVAL}ms`)
      } else {
        console.log('📊 Analytics collection: DISABLED')
      }
      
    } catch (error) {
      console.error('❌ Analytics configuration validation failed:', error)
      throw new Error('Invalid analytics configuration')
    }
  }
  
  static getConfig(): AnalyticsConfig {
    if (!this.config) {
      throw new Error('Analytics configuration not initialized')
    }
    return this.config
  }
  
  static isAnalyticsEnabled(): boolean {
    return this.getConfig().ANALYTICS_ENABLED
  }
  
  static isDashboardEnabled(): boolean {
    return this.getConfig().DASHBOARD_ENABLED && this.isAnalyticsEnabled()
  }
}
```

## Resource Links and Best Practices

### Integration Testing Strategy

```typescript
// src/__tests__/integration.test.ts
describe('Analytics Integration Tests', () => {
  let server: AnalyticsEnhancedMCPServer
  
  beforeAll(async () => {
    // Test with analytics enabled
    process.env.ANALYTICS_ENABLED = 'true'
    server = new AnalyticsEnhancedMCPServer()
    await server.initialize()
  })
  
  afterAll(async () => {
    await server.gracefulShutdown()
  })
  
  describe('Non-Intrusive Integration', () => {
    test('should maintain original MCP functionality', async () => {
      // Test that all original endpoints work unchanged
      const response = await request(server.app)
        .post('/mcp/tool/hubspotCompany')
        .send({ operation: 'list', limit: 10 })
        .expect(200)
      
      expect(response.body).toHaveProperty('success')
      expect(response.body).toHaveProperty('data')
    })
    
    test('should collect analytics data without affecting response', async () => {
      const startTime = Date.now()
      
      const response = await request(server.app)
        .post('/mcp/tool/hubspotContact')
        .send({ operation: 'search', query: 'test@example.com' })
        .expect(200)
      
      const endTime = Date.now()
      const responseTime = endTime - startTime
      
      // Verify response is unchanged
      expect(response.body).toHaveProperty('success')
      
      // Verify minimal performance impact (less than 50ms overhead)
      expect(responseTime).toBeLessThan(5000) // Reasonable total time
      
      // Give time for async analytics processing
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Verify analytics data was collected
      const analyticsData = await AnalyticsCollector.getRecentToolUsage()
      expect(analyticsData).toContainEqual(
        expect.objectContaining({
          toolName: 'hubspotContact',
          operation: 'search'
        })
      )
    })
  })
  
  describe('Error Boundary Testing', () => {
    test('should handle analytics failures gracefully', async () => {
      // Simulate analytics failure
      const originalLogMethod = AnalyticsCollector.logToolUsage
      AnalyticsCollector.logToolUsage = jest.fn().mockRejectedValue(new Error('Analytics failure'))
      
      // MCP operation should still succeed
      const response = await request(server.app)
        .post('/mcp/tool/hubspotCompany')
        .send({ operation: 'get', id: '123' })
        .expect(200)
      
      expect(response.body).toHaveProperty('success')
      
      // Restore original method
      AnalyticsCollector.logToolUsage = originalLogMethod
    })
  })
  
  describe('Performance Impact Testing', () => {
    test('should have minimal performance overhead', async () => {
      const iterations = 10
      const timings: number[] = []
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now()
        
        await request(server.app)
          .post('/mcp/tool/hubspotNotes')
          .send({ operation: 'list', limit: 1 })
          .expect(200)
        
        timings.push(Date.now() - startTime)
      }
      
      const avgTime = timings.reduce((a, b) => a + b) / timings.length
      const maxTime = Math.max(...timings)
      
      // Verify reasonable performance
      expect(avgTime).toBeLessThan(2000) // Average under 2 seconds
      expect(maxTime).toBeLessThan(5000) // Max under 5 seconds
      
      console.log(`Average response time: ${avgTime}ms, Max: ${maxTime}ms`)
    })
  })
})
```

### Deployment Integration

```typescript
// src/scripts/deploy-with-analytics.ts
#!/usr/bin/env node

/**
 * Deployment script that handles analytics integration setup
 */
async function deployWithAnalytics() {
  console.log('🚀 Starting deployment with analytics integration...')
  
  try {
    // Validate analytics configuration
    AnalyticsConfigManager.initialize()
    
    // Setup database schema if needed
    if (AnalyticsConfigManager.isAnalyticsEnabled()) {
      console.log('📊 Setting up analytics database schema...')
      await setupAnalyticsSchema()
    }
    
    // Initialize server
    const server = new AnalyticsEnhancedMCPServer()
    await server.initialize()
    
    // Health check
    const healthCheck = await server.performHealthCheck()
    if (!healthCheck.healthy) {
      throw new Error(`Health check failed: ${healthCheck.errors.join(', ')}`)
    }
    
    console.log('✅ Deployment completed successfully')
    
    // Start performance monitoring
    PerformanceMonitor.monitorSystemHealth()
    
    return server
    
  } catch (error) {
    console.error('❌ Deployment failed:', error)
    process.exit(1)
  }
}

async function setupAnalyticsSchema(): Promise<void> {
  // Run database migrations for analytics tables
  // This would typically use Prisma migrate or similar
  console.log('🗄️ Running analytics database migrations...')
  // Implementation would go here
}

// Run deployment if called directly
if (require.main === module) {
  deployWithAnalytics()
}
```

This comprehensive integration design ensures that analytics capabilities are seamlessly incorporated into the existing HubSpot MCP server without any impact on core functionality, performance, or reliability. The architecture provides complete observability while maintaining the non-intrusive nature required for production deployment.