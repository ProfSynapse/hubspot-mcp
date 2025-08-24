import { analyticsService } from './analytics-service.js';

/**
 * Type definition for MCP tool handler function
 */
type ToolHandler<T = any, R = any> = (params: T) => Promise<R>;

/**
 * Extract operation from parameters object
 */
function extractOperation(params: any): string | null {
  if (params && typeof params === 'object') {
    return params.operation || params.action || null;
  }
  return null;
}

/**
 * Extract error code from error object
 */
function extractErrorCode(error: any): string {
  if (error && typeof error === 'object') {
    return error.code || error.name || 'UNKNOWN_ERROR';
  }
  return 'UNKNOWN_ERROR';
}

/**
 * Analytics middleware wrapper for MCP tool handlers
 * 
 * This middleware:
 * - Measures response time for all tool calls
 * - Logs successful tool calls with parameters and timing
 * - Logs failed tool calls with error details
 * - Maintains the original tool behavior (transparent)
 * - Gracefully handles analytics failures without breaking tools
 * 
 * @param originalHandler - The original tool handler function
 * @param toolName - Name of the tool (e.g., 'hubspotCompany')
 * @param staticOperation - Optional static operation name if not in params
 * @returns Wrapped handler with analytics logging
 */
export function withAnalytics<T = any, R = any>(
  originalHandler: ToolHandler<T, R>,
  toolName: string,
  staticOperation?: string
): ToolHandler<T, R> {
  return async (params: T): Promise<R> => {
    const startTime = Date.now();
    const operation = staticOperation || extractOperation(params);
    
    try {
      // Execute the original handler
      const result = await originalHandler(params);
      const responseTime = Date.now() - startTime;
      
      // Log successful call (fire and forget - don't await)
      analyticsService.logToolCall(toolName, operation, params, true, responseTime).catch(err => {
        console.warn('Analytics logging failed for successful call:', err);
      });
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorCode = extractErrorCode(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stackTrace = error instanceof Error ? error.stack : undefined;
      
      // Log error details (fire and forget)
      analyticsService.logError(
        toolName,
        operation,
        errorMessage,
        errorCode,
        params,
        stackTrace
      ).catch(err => {
        console.warn('Analytics error logging failed:', err);
      });
      
      // Log failed call (fire and forget)
      analyticsService.logToolCall(toolName, operation, params, false, responseTime).catch(err => {
        console.warn('Analytics logging failed for failed call:', err);
      });
      
      // Re-throw the original error to maintain tool behavior
      throw error;
    }
  };
}

/**
 * Convenience function to wrap multiple tool handlers at once
 * Useful for batch wrapping all tools in a BCP
 */
export function wrapToolHandlers<T extends Record<string, ToolHandler>>(
  handlers: T,
  toolName: string
): T {
  const wrappedHandlers: any = {};
  
  for (const [handlerName, handler] of Object.entries(handlers)) {
    wrappedHandlers[handlerName] = withAnalytics(handler, toolName, handlerName);
  }
  
  return wrappedHandlers;
}

/**
 * Create a tool factory wrapper that automatically applies analytics
 * This can be used to wrap the entire tool creation process
 */
export function createAnalyticsToolFactory(toolName: string) {
  return {
    /**
     * Wrap a single handler with analytics
     */
    wrapHandler<T, R>(handler: ToolHandler<T, R>, operation?: string): ToolHandler<T, R> {
      return withAnalytics(handler, toolName, operation);
    },
    
    /**
     * Wrap multiple handlers with analytics
     */
    wrapHandlers<T extends Record<string, ToolHandler>>(handlers: T): T {
      return wrapToolHandlers(handlers, toolName);
    }
  };
}

/**
 * Helper to check if analytics is enabled
 * Can be used to conditionally apply analytics based on environment
 */
export function isAnalyticsEnabled(): boolean {
  return process.env.ANALYTICS_ENABLED !== 'false' && !!process.env.DATABASE_URL;
}

/**
 * Conditional analytics wrapper - only applies analytics if enabled
 */
export function withConditionalAnalytics<T = any, R = any>(
  originalHandler: ToolHandler<T, R>,
  toolName: string,
  staticOperation?: string
): ToolHandler<T, R> {
  if (isAnalyticsEnabled()) {
    return withAnalytics(originalHandler, toolName, staticOperation);
  }
  return originalHandler;
}