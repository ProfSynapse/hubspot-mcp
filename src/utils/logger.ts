/**
 * Structured Logging System
 * Location: src/utils/logger.ts
 * 
 * This module provides structured logging for the HTTP MCP server using Pino.
 * It includes request correlation, security redaction, and environment-specific
 * configuration for development and production environments.
 */

import { pino } from 'pino';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

interface LogConfig {
  level: string;
  environment: string;
  serviceName: string;
  version: string;
}

export const createLogger = (config: LogConfig) => {
  const pinoConfig: pino.LoggerOptions = {
    level: config.level,
    name: config.serviceName,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
        service: config.serviceName,
        version: config.version,
        environment: config.environment
      })
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers["mcp-session-id"]',
        'hubspot_token',
        'jwt_secret',
        'password',
        'token',
        'access_token',
        'bearer',
        'req.body.params.arguments.properties.hubspot_access_token'
      ],
      censor: '[REDACTED]'
    }
  };
  
  // Production logging optimizations
  if (config.environment === 'production') {
    pinoConfig.level = config.level === 'debug' ? 'info' : config.level;
    pinoConfig.serializers = {
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
          'mcp-session-id': req.headers['mcp-session-id'] ? '[REDACTED]' : undefined
        },
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort
      }),
      res: (res) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type': res.getHeader('content-type'),
          'content-length': res.getHeader('content-length')
        }
      }),
      err: pino.stdSerializers.err
    };
  }
  
  return pino(pinoConfig);
};

// Request logging middleware
export const createRequestLogger = (logger: pino.Logger) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Generate request ID for correlation
    const requestId = randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);
    
    // Log request start
    logger.info({
      req,
      requestId,
      event: 'request_start',
      mcpMethod: req.body?.method,
      mcpId: req.body?.id
    }, 'HTTP Request Started');
    
    // Log request completion
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      const logLevel = res.statusCode >= 500 ? 'error' : 
                      res.statusCode >= 400 ? 'warn' : 'info';
      
      logger[logLevel]({
        req,
        res,
        requestId,
        duration,
        event: 'request_complete',
        mcpMethod: req.body?.method,
        mcpId: req.body?.id
      }, 'HTTP Request Completed');
    });
    
    // Log request errors
    res.on('error', (error) => {
      logger.error({
        req,
        res,
        requestId,
        error,
        event: 'request_error'
      }, 'HTTP Request Error');
    });
    
    next();
  };
};

// Error logging middleware
export const createErrorLogger = (logger: pino.Logger) => {
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string;
    
    logger.error({
      req,
      res,
      requestId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      event: 'error_handler'
    }, 'Unhandled Request Error');
    
    next(error);
  };
};

// MCP-specific logging helpers
export const logMCPRequest = (logger: pino.Logger, req: Request, sessionId?: string) => {
  const requestId = req.headers['x-request-id'] as string;
  
  logger.info({
    requestId,
    sessionId,
    mcpMethod: req.body?.method,
    mcpId: req.body?.id,
    mcpParams: req.body?.params ? Object.keys(req.body.params) : undefined,
    event: 'mcp_request'
  }, `MCP Request: ${req.body?.method || 'unknown'}`);
};

export const logMCPResponse = (logger: pino.Logger, req: Request, response: any, sessionId?: string, duration?: number) => {
  const requestId = req.headers['x-request-id'] as string;
  
  logger.info({
    requestId,
    sessionId,
    mcpMethod: req.body?.method,
    mcpId: req.body?.id,
    responseSize: JSON.stringify(response).length,
    isError: response.error ? true : false,
    duration,
    event: 'mcp_response'
  }, `MCP Response: ${req.body?.method || 'unknown'}`);
};

export const logSessionEvent = (logger: pino.Logger, event: string, sessionId: string, details?: any) => {
  logger.info({
    sessionId,
    event: 'session_event',
    sessionEvent: event,
    ...details
  }, `Session ${event}: ${sessionId}`);
};

export const logAuthEvent = (logger: pino.Logger, event: string, userId?: string, details?: any) => {
  logger.info({
    userId,
    event: 'auth_event',
    authEvent: event,
    ...details
  }, `Auth ${event}: ${userId || 'anonymous'}`);
};

export const logHubSpotAPICall = (logger: pino.Logger, method: string, endpoint: string, duration: number, statusCode?: number, error?: Error) => {
  const logLevel = error || (statusCode && statusCode >= 400) ? 'error' : 'info';
  
  logger[logLevel]({
    hubspotMethod: method,
    hubspotEndpoint: endpoint,
    duration,
    statusCode,
    error: error ? {
      name: error.name,
      message: error.message
    } : undefined,
    event: 'hubspot_api_call'
  }, `HubSpot API: ${method} ${endpoint}`);
};