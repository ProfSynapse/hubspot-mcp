/**
 * Authentication Middleware
 * Location: src/middleware/auth.ts
 * 
 * This module provides JWT-based authentication middleware for the HTTP MCP server.
 * It supports both simple JWT validation for development and JWKS-based validation
 * for production environments. Used by the HTTP transport to secure MCP endpoints.
 */

import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthContext } from '../core/session-manager.js';

// Error codes for MCP protocol compliance
export enum MCPErrorCodes {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  
  // Custom error codes
  AUTHENTICATION_FAILED = -32001,
  AUTHORIZATION_FAILED = -32002,
  INSUFFICIENT_PERMISSIONS = -32003,
  RATE_LIMIT_EXCEEDED = -32000,
  SESSION_INVALID = -32004
}

// Permissions enum for HubSpot MCP operations
export enum MCPPermissions {
  // Core MCP operations
  MCP_INITIALIZE = 'mcp:initialize',
  MCP_LIST_TOOLS = 'mcp:list_tools',
  MCP_CALL_TOOLS = 'mcp:call_tools',
  MCP_LIST_RESOURCES = 'mcp:list_resources',
  MCP_READ_RESOURCES = 'mcp:read_resources',
  
  // HubSpot specific permissions
  HUBSPOT_READ = 'hubspot:read',
  HUBSPOT_WRITE = 'hubspot:write',
  
  // Domain-specific permissions
  COMPANIES_READ = 'companies:read',
  COMPANIES_WRITE = 'companies:write',
  CONTACTS_READ = 'contacts:read',
  CONTACTS_WRITE = 'contacts:write',
  DEALS_READ = 'deals:read',
  DEALS_WRITE = 'deals:write',
  
  // Administrative permissions
  ADMIN_METRICS = 'admin:metrics',
  ADMIN_HEALTH = 'admin:health',
  ADMIN_SESSIONS = 'admin:sessions'
}

interface AuthConfig {
  jwtSecret?: string;
  jwtIssuer?: string;
  jwtAudience?: string;
  jwksUri?: string;
  jwksConfig?: {
    cache: boolean;
    cacheMaxAge: number;
    cacheMaxEntries: number;
    rateLimit: boolean;
    jwksRequestsPerMinute: number;
  };
  requiredPermissions: MCPPermissions[];
  allowAnonymous?: boolean;
}

interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
  sessionId?: string;
}

class JWTAuthenticator {
  private client?: jwksClient.JwksClient;
  
  constructor(private config: AuthConfig) {
    if (config.jwksUri) {
      this.client = jwksClient({
        jwksUri: config.jwksUri,
        cache: config.jwksConfig?.cache ?? true,
        cacheMaxAge: config.jwksConfig?.cacheMaxAge ?? 600000,
        cacheMaxEntries: config.jwksConfig?.cacheMaxEntries ?? 5,
        rateLimit: config.jwksConfig?.rateLimit ?? true,
        jwksRequestsPerMinute: config.jwksConfig?.jwksRequestsPerMinute ?? 5
      });
    }
  }
  
  private getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
    if (!this.client) {
      callback(new Error('JWKS client not configured'));
      return;
    }
    
    this.client.getSigningKey(header.kid!, (err, key) => {
      if (err) {
        callback(err);
        return;
      }
      const signingKey = key!.getPublicKey();
      callback(null, signingKey);
    });
  };
  
  async verifyToken(token: string): Promise<AuthContext> {
    return new Promise((resolve, reject) => {
      const options: jwt.VerifyOptions = {
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience,
        algorithms: ['RS256', 'HS256']
      };
      
      if (this.config.jwksUri && this.client) {
        // Use JWKS for verification
        jwt.verify(token, this.getKey, options, (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded as AuthContext);
          }
        });
      } else if (this.config.jwtSecret) {
        // Use shared secret for verification
        jwt.verify(token, this.config.jwtSecret, options, (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded as AuthContext);
          }
        });
      } else {
        reject(new Error('No JWT verification method configured'));
      }
    });
  }
}

class PermissionValidator {
  private permissionHierarchy = new Map<MCPPermissions, MCPPermissions[]>();
  
  constructor() {
    // Define permission implications
    this.permissionHierarchy.set(MCPPermissions.HUBSPOT_WRITE, [MCPPermissions.HUBSPOT_READ]);
    this.permissionHierarchy.set(MCPPermissions.COMPANIES_WRITE, [MCPPermissions.COMPANIES_READ, MCPPermissions.HUBSPOT_READ]);
    this.permissionHierarchy.set(MCPPermissions.CONTACTS_WRITE, [MCPPermissions.CONTACTS_READ, MCPPermissions.HUBSPOT_READ]);
    this.permissionHierarchy.set(MCPPermissions.DEALS_WRITE, [MCPPermissions.DEALS_READ, MCPPermissions.HUBSPOT_READ]);
  }
  
  hasPermission(userPermissions: string[], required: MCPPermissions): boolean {
    // Direct permission check
    if (userPermissions.includes(required)) {
      return true;
    }
    
    // Check for implied permissions
    for (const [permission, implied] of this.permissionHierarchy.entries()) {
      if (userPermissions.includes(permission) && implied.includes(required)) {
        return true;
      }
    }
    
    return false;
  }
  
  validateToolPermission(userPermissions: string[], toolName: string, operation: string): boolean {
    const permissionMap: Record<string, Record<string, MCPPermissions>> = {
      'hubspotCompany': {
        'get': MCPPermissions.COMPANIES_READ,
        'search': MCPPermissions.COMPANIES_READ,
        'recent': MCPPermissions.COMPANIES_READ,
        'create': MCPPermissions.COMPANIES_WRITE,
        'update': MCPPermissions.COMPANIES_WRITE
      },
      'hubspotContact': {
        'get': MCPPermissions.CONTACTS_READ,
        'search': MCPPermissions.CONTACTS_READ,
        'recent': MCPPermissions.CONTACTS_READ,
        'create': MCPPermissions.CONTACTS_WRITE,
        'update': MCPPermissions.CONTACTS_WRITE
      },
      'hubspotDeal': {
        'get': MCPPermissions.DEALS_READ,
        'search': MCPPermissions.DEALS_READ,
        'recent': MCPPermissions.DEALS_READ,
        'create': MCPPermissions.DEALS_WRITE,
        'update': MCPPermissions.DEALS_WRITE
      }
    };
    
    const requiredPermission = permissionMap[toolName]?.[operation];
    if (!requiredPermission) {
      // If no specific permission required, check for general MCP access
      return this.hasPermission(userPermissions, MCPPermissions.MCP_CALL_TOOLS);
    }
    
    return this.hasPermission(userPermissions, requiredPermission);
  }
}

const permissionValidator = new PermissionValidator();

export const createAuthMiddleware = (config: AuthConfig) => {
  const authenticator = new JWTAuthenticator(config);
  
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const token = extractBearerToken(req);
      
      // Handle anonymous access if allowed
      if (!token && config.allowAnonymous) {
        console.log('[Auth] Anonymous access allowed');
        next();
        return;
      }
      
      if (!token) {
        return res.status(401).json({
          jsonrpc: '2.0',
          error: {
            code: MCPErrorCodes.AUTHENTICATION_FAILED,
            message: 'Missing authorization token'
          }
        });
      }
      
      const auth = await authenticator.verifyToken(token);
      
      // Check required permissions
      const hasPermissions = config.requiredPermissions.every(
        perm => permissionValidator.hasPermission(auth.permissions || [], perm)
      );
      
      if (!hasPermissions) {
        return res.status(403).json({
          jsonrpc: '2.0',
          error: {
            code: MCPErrorCodes.INSUFFICIENT_PERMISSIONS,
            message: 'Insufficient permissions'
          }
        });
      }
      
      // Attach auth context to request
      req.auth = auth;
      
      console.log(`[Auth] Authenticated user: ${auth.userId} with permissions: ${auth.permissions?.join(', ') || 'none'}`);
      next();
    } catch (error) {
      console.error('[Auth] Authentication error:', error);
      return res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: MCPErrorCodes.AUTHENTICATION_FAILED,
          message: 'Invalid or expired token'
        }
      });
    }
  };
};

export const createToolPermissionValidator = () => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Only validate for tool calls
    if (req.body?.method !== 'tools/call') {
      next();
      return;
    }
    
    const toolName = req.body?.params?.name;
    const operation = req.body?.params?.arguments?.operation;
    
    if (!toolName || !operation) {
      next();
      return;
    }
    
    const userPermissions = req.auth?.permissions || [];
    
    if (!permissionValidator.validateToolPermission(userPermissions, toolName, operation)) {
      return res.status(403).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: MCPErrorCodes.INSUFFICIENT_PERMISSIONS,
          message: `Insufficient permissions for ${toolName}:${operation}`
        }
      });
    }
    
    next();
  };
};

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Development auth helper - creates simple tokens for testing
export const createDevelopmentToken = (payload: Partial<AuthContext>, secret: string): string => {
  const defaultPayload: AuthContext = {
    userId: 'dev-user',
    permissions: [
      MCPPermissions.MCP_CALL_TOOLS,
      MCPPermissions.HUBSPOT_READ,
      MCPPermissions.HUBSPOT_WRITE,
      MCPPermissions.COMPANIES_READ,
      MCPPermissions.COMPANIES_WRITE,
      MCPPermissions.CONTACTS_READ,
      MCPPermissions.CONTACTS_WRITE,
      MCPPermissions.DEALS_READ,
      MCPPermissions.DEALS_WRITE
    ],
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
    iat: Math.floor(Date.now() / 1000),
    role: 'developer'
  };
  
  return jwt.sign({ ...defaultPayload, ...payload }, secret);
};

export type { AuthenticatedRequest, AuthConfig };
export { permissionValidator };