# Security Architecture Design

## Executive Summary

This document defines the comprehensive security architecture for the HubSpot MCP Analytics Dashboard, encompassing authentication, authorization, data protection, network security, and compliance measures. The security design follows industry best practices including defense-in-depth, least privilege access, and zero-trust principles to protect sensitive analytics data and administrative functions.

## Security Framework Overview

### Security Principles
- **Defense in Depth**: Multiple layers of security controls
- **Least Privilege**: Minimal access rights for users and processes
- **Zero Trust**: Verify every request regardless of source
- **Data Protection**: Encryption at rest and in transit
- **Auditability**: Comprehensive logging and monitoring
- **Secure by Default**: Security controls enabled by default

### Threat Model Analysis

**Assets to Protect**:
- Analytics data (tool usage, performance metrics, error logs)
- User credentials and session data
- System configuration and secrets
- MCP server access and functionality
- Administrative interfaces

**Threat Actors**:
- External attackers (unauthorized access attempts)
- Internal threats (compromised accounts or insider threats)
- Automated attacks (bots, scanners, brute force)
- Supply chain attacks (dependency vulnerabilities)

**Attack Vectors**:
- Authentication bypasses
- Session hijacking and fixation
- Cross-site scripting (XSS) and injection attacks
- Cross-site request forgery (CSRF)
- Man-in-the-middle attacks
- Privilege escalation
- Data exfiltration

## Authentication Architecture

### Multi-Factor Authentication Design

#### Primary Authentication (Username/Password)
```typescript
interface AuthenticationConfig {
  // Password requirements
  passwordPolicy: {
    minLength: 12
    requireUppercase: true
    requireLowercase: true
    requireNumbers: true
    requireSpecialChars: true
    preventCommonPasswords: true
    preventUserInfoInPassword: true
    passwordHistory: 12 // Prevent reuse of last 12 passwords
  }
  
  // Account lockout policy
  lockoutPolicy: {
    maxAttempts: 5
    lockoutDuration: 15 * 60 * 1000 // 15 minutes
    progressiveLockout: true // Increase duration with repeated lockouts
    notifyOnLockout: true
  }
  
  // Session management
  sessionPolicy: {
    maxSessionDuration: 8 * 60 * 60 * 1000 // 8 hours
    idleTimeout: 2 * 60 * 60 * 1000 // 2 hours
    maxConcurrentSessions: 3
    invalidateOnPasswordChange: true
  }
}
```

#### Enhanced Password Security
```typescript
// src/security/password-security.ts
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import zxcvbn from 'zxcvbn'

export class PasswordSecurity {
  private static readonly SALT_ROUNDS = 14 // Increased from 12 for higher security
  private static readonly PEPPER = process.env.PASSWORD_PEPPER // Additional secret
  
  /**
   * Hash password with salt and pepper
   */
  static async hashPassword(password: string, userInfo?: any): Promise<string> {
    // Validate password strength
    this.validatePasswordSecurity(password, userInfo)
    
    // Add pepper before hashing
    const pepperedPassword = this.addPepper(password)
    
    // Generate salt and hash
    const salt = await bcrypt.genSalt(this.SALT_ROUNDS)
    const hash = await bcrypt.hash(pepperedPassword, salt)
    
    return hash
  }
  
  /**
   * Verify password with timing attack protection
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    const pepperedPassword = this.addPepper(password)
    
    // Use constant-time comparison to prevent timing attacks
    const isValid = await bcrypt.compare(pepperedPassword, hash)
    
    // Add random delay to normalize timing
    await this.addRandomDelay()
    
    return isValid
  }
  
  /**
   * Validate password strength and security
   */
  private static validatePasswordSecurity(password: string, userInfo?: any): void {
    // Length check
    if (password.length < 12) {
      throw new SecurityError('Password must be at least 12 characters long')
    }
    
    // Complexity requirements
    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
    
    const complexityScore = [hasUppercase, hasLowercase, hasNumbers, hasSpecialChar]
      .filter(Boolean).length
    
    if (complexityScore < 3) {
      throw new SecurityError('Password must contain at least 3 of: uppercase, lowercase, numbers, special characters')
    }
    
    // Use zxcvbn for advanced password analysis
    const strengthAnalysis = zxcvbn(password, userInfo ? [userInfo.username, userInfo.email] : [])
    
    if (strengthAnalysis.score < 3) {
      throw new SecurityError(`Password is too weak: ${strengthAnalysis.feedback.warning}`)
    }
    
    // Check against common passwords
    if (this.isCommonPassword(password)) {
      throw new SecurityError('Password is too common and easily guessable')
    }
  }
  
  private static addPepper(password: string): string {
    if (!process.env.PASSWORD_PEPPER) {
      throw new Error('PASSWORD_PEPPER environment variable not set')
    }
    return password + process.env.PASSWORD_PEPPER
  }
  
  private static async addRandomDelay(): Promise<void> {
    const delay = Math.random() * 100 + 50 // 50-150ms random delay
    return new Promise(resolve => setTimeout(resolve, delay))
  }
  
  private static isCommonPassword(password: string): boolean {
    // Check against common password list (implement based on requirements)
    const commonPasswords = [
      'password123', 'admin123', 'Password123!', 'qwerty123'
      // Add more common passwords from breach databases
    ]
    return commonPasswords.includes(password.toLowerCase())
  }
}

class SecurityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecurityError'
  }
}
```

### JWT Token Security

#### Secure Token Generation
```typescript
// src/security/jwt-security.ts
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { RedisClient } from '../config/redis'

export class JWTSecurity {
  private static readonly ACCESS_TOKEN_EXPIRY = '15m'
  private static readonly REFRESH_TOKEN_EXPIRY = '7d'
  private static readonly TOKEN_ISSUER = 'hubspot-mcp-analytics'
  
  /**
   * Generate cryptographically secure tokens
   */
  static generateTokenPair(payload: TokenPayload): TokenPair {
    const jti = this.generateSecureId() // JWT ID for tracking
    const refreshTokenId = this.generateSecureId()
    
    const accessToken = jwt.sign(
      {
        ...payload,
        jti,
        type: 'access',
        iat: Math.floor(Date.now() / 1000)
      },
      this.getSecretForType('access'),
      {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        issuer: this.TOKEN_ISSUER,
        audience: 'dashboard-api',
        algorithm: 'HS512' // Use stronger algorithm
      }
    )
    
    const refreshToken = jwt.sign(
      {
        userId: payload.userId,
        sessionId: payload.sessionId,
        jti: refreshTokenId,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000)
      },
      this.getSecretForType('refresh'),
      {
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        issuer: this.TOKEN_ISSUER,
        audience: 'dashboard-refresh',
        algorithm: 'HS512'
      }
    )
    
    // Store token metadata for revocation
    this.storeTokenMetadata(jti, payload.userId, 'access')
    this.storeTokenMetadata(refreshTokenId, payload.userId, 'refresh')
    
    return { accessToken, refreshToken, jti }
  }
  
  /**
   * Verify token with comprehensive checks
   */
  static async verifyToken(token: string, type: 'access' | 'refresh'): Promise<TokenPayload | null> {
    try {
      const decoded = jwt.verify(
        token,
        this.getSecretForType(type),
        {
          issuer: this.TOKEN_ISSUER,
          audience: type === 'access' ? 'dashboard-api' : 'dashboard-refresh',
          algorithms: ['HS512']
        }
      ) as any
      
      // Verify token type matches expected
      if (decoded.type !== type) {
        throw new Error('Token type mismatch')
      }
      
      // Check if token is revoked
      const isRevoked = await this.isTokenRevoked(decoded.jti)
      if (isRevoked) {
        throw new Error('Token has been revoked')
      }
      
      // Additional security checks
      await this.performSecurityChecks(decoded)
      
      return {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        sessionId: decoded.sessionId,
        jti: decoded.jti
      }
      
    } catch (error) {
      console.error('Token verification failed:', error)
      return null
    }
  }
  
  /**
   * Revoke token family (all tokens for a session)
   */
  static async revokeTokenFamily(sessionId: string): Promise<void> {
    const tokens = await this.getTokensBySession(sessionId)
    
    await Promise.all(
      tokens.map(tokenId => this.revokeToken(tokenId))
    )
  }
  
  /**
   * Generate cryptographically secure identifier
   */
  private static generateSecureId(): string {
    return crypto.randomBytes(32).toString('hex')
  }
  
  private static getSecretForType(type: 'access' | 'refresh'): string {
    const secret = type === 'access' 
      ? process.env.JWT_ACCESS_SECRET 
      : process.env.JWT_REFRESH_SECRET
    
    if (!secret) {
      throw new Error(`${type.toUpperCase()}_SECRET environment variable not set`)
    }
    
    return secret
  }
  
  private static async storeTokenMetadata(jti: string, userId: number, type: string): Promise<void> {
    const metadata = {
      userId,
      type,
      issuedAt: Date.now(),
      revoked: false
    }
    
    // Store in Redis with expiration
    const expiry = type === 'access' ? 15 * 60 : 7 * 24 * 60 * 60 // seconds
    await RedisClient.setex(`token:${jti}`, expiry, JSON.stringify(metadata))
  }
  
  private static async isTokenRevoked(jti: string): Promise<boolean> {
    const metadata = await RedisClient.get(`token:${jti}`)
    if (!metadata) return true // Token not found, consider revoked
    
    const parsed = JSON.parse(metadata)
    return parsed.revoked === true
  }
  
  private static async revokeToken(jti: string): Promise<void> {
    const metadata = await RedisClient.get(`token:${jti}`)
    if (metadata) {
      const parsed = JSON.parse(metadata)
      parsed.revoked = true
      parsed.revokedAt = Date.now()
      
      await RedisClient.set(`token:${jti}`, JSON.stringify(parsed))
    }
  }
  
  private static async performSecurityChecks(decoded: any): Promise<void> {
    // Check token age
    const tokenAge = Date.now() / 1000 - decoded.iat
    const maxAge = decoded.type === 'access' ? 15 * 60 : 7 * 24 * 60 * 60
    
    if (tokenAge > maxAge) {
      throw new Error('Token has expired beyond maximum age')
    }
    
    // Additional checks can be added here
    // e.g., IP address validation, device fingerprinting
  }
}

interface TokenPayload {
  userId: number
  username: string
  role: string
  sessionId: string
  jti?: string
}

interface TokenPair {
  accessToken: string
  refreshToken: string
  jti: string
}
```

## Authorization System

### Role-Based Access Control (RBAC)
```typescript
// src/security/authorization.ts
export enum Permission {
  // Dashboard permissions
  VIEW_DASHBOARD = 'dashboard:view',
  VIEW_ANALYTICS = 'analytics:view',
  VIEW_ERRORS = 'errors:view',
  RESOLVE_ERRORS = 'errors:resolve',
  EXPORT_DATA = 'data:export',
  
  // System permissions
  MANAGE_USERS = 'users:manage',
  MANAGE_SETTINGS = 'settings:manage',
  VIEW_SYSTEM_LOGS = 'system:view_logs',
  MANAGE_SESSIONS = 'sessions:manage',
  
  // API permissions
  ACCESS_API = 'api:access',
  ADMIN_API = 'api:admin'
}

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  READ_ONLY = 'READ_ONLY'
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: [
    // All permissions
    ...Object.values(Permission)
  ],
  
  [Role.ADMIN]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ERRORS,
    Permission.RESOLVE_ERRORS,
    Permission.EXPORT_DATA,
    Permission.VIEW_SYSTEM_LOGS,
    Permission.ACCESS_API
  ],
  
  [Role.READ_ONLY]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ANALYTICS,
    Permission.ACCESS_API
  ]
}

export class AuthorizationService {
  /**
   * Check if user has specific permission
   */
  static hasPermission(userRole: Role, permission: Permission): boolean {
    const rolePermissions = ROLE_PERMISSIONS[userRole]
    return rolePermissions.includes(permission)
  }
  
  /**
   * Check multiple permissions (all must be satisfied)
   */
  static hasAllPermissions(userRole: Role, permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(userRole, permission))
  }
  
  /**
   * Check if user has any of the specified permissions
   */
  static hasAnyPermission(userRole: Role, permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(userRole, permission))
  }
  
  /**
   * Get all permissions for a role
   */
  static getRolePermissions(role: Role): Permission[] {
    return ROLE_PERMISSIONS[role] || []
  }
}

/**
 * Express middleware for permission-based authorization
 */
export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      })
    }
    
    const hasPermission = AuthorizationService.hasPermission(req.user.role as Role, permission)
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Access denied',
          requiredPermission: permission,
          userRole: req.user.role
        }
      })
    }
    
    next()
  }
}

/**
 * React hook for client-side authorization
 */
export function usePermission(permission: Permission) {
  const { user } = useAuthStore()
  
  if (!user) return false
  
  return AuthorizationService.hasPermission(user.role as Role, permission)
}
```

## Session Security

### Secure Session Management
```typescript
// src/security/session-security.ts
import crypto from 'crypto'
import { RedisClient } from '../config/redis'

export class SessionSecurity {
  private static readonly SESSION_TIMEOUT = 8 * 60 * 60 * 1000 // 8 hours
  private static readonly IDLE_TIMEOUT = 2 * 60 * 60 * 1000 // 2 hours
  private static readonly MAX_CONCURRENT_SESSIONS = 3
  
  /**
   * Create secure session with comprehensive metadata
   */
  static async createSession(userId: number, loginContext: LoginContext): Promise<SessionData> {
    const sessionId = this.generateSessionId()
    const csrfToken = this.generateCSRFToken()
    
    const sessionData: SessionData = {
      id: sessionId,
      userId,
      csrfToken,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: Date.now() + this.SESSION_TIMEOUT,
      ipAddress: loginContext.ipAddress,
      userAgent: loginContext.userAgent,
      deviceFingerprint: await this.generateDeviceFingerprint(loginContext),
      loginMethod: loginContext.method,
      mfaVerified: loginContext.mfaVerified || false,
      isActive: true
    }
    
    // Enforce concurrent session limits
    await this.enforceSessionLimits(userId)
    
    // Store session in Redis with expiration
    await RedisClient.setex(
      `session:${sessionId}`, 
      Math.floor(this.SESSION_TIMEOUT / 1000),
      JSON.stringify(sessionData)
    )
    
    // Track active sessions for user
    await this.addToUserSessions(userId, sessionId)
    
    return sessionData
  }
  
  /**
   * Validate session with security checks
   */
  static async validateSession(sessionId: string, requestContext?: RequestContext): Promise<SessionData | null> {
    const sessionData = await this.getSession(sessionId)
    
    if (!sessionData) {
      return null
    }
    
    // Check if session is active
    if (!sessionData.isActive) {
      return null
    }
    
    // Check expiration
    if (Date.now() > sessionData.expiresAt) {
      await this.destroySession(sessionId)
      return null
    }
    
    // Check idle timeout
    if (Date.now() - sessionData.lastAccessed > this.IDLE_TIMEOUT) {
      await this.destroySession(sessionId)
      return null
    }
    
    // Additional security checks
    if (requestContext) {
      const securityChecksPass = await this.performSecurityChecks(sessionData, requestContext)
      if (!securityChecksPass) {
        await this.destroySession(sessionId)
        return null
      }
    }
    
    // Update last accessed time
    await this.updateSessionActivity(sessionId)
    
    return sessionData
  }
  
  /**
   * Generate and validate CSRF tokens
   */
  static generateCSRFToken(): string {
    return crypto.randomBytes(32).toString('base64url')
  }
  
  static validateCSRFToken(sessionToken: string, requestToken: string): boolean {
    return crypto.timingSafeEqual(
      Buffer.from(sessionToken, 'base64url'),
      Buffer.from(requestToken, 'base64url')
    )
  }
  
  /**
   * Session hijacking protection
   */
  private static async performSecurityChecks(
    sessionData: SessionData, 
    requestContext: RequestContext
  ): Promise<boolean> {
    // IP address validation (with allowance for NAT/proxy changes)
    if (sessionData.ipAddress !== requestContext.ipAddress) {
      // Allow IP changes but log for monitoring
      console.warn('Session IP address changed', {
        sessionId: sessionData.id,
        originalIp: sessionData.ipAddress,
        newIp: requestContext.ipAddress
      })
      
      // Update session with new IP
      await this.updateSessionMetadata(sessionData.id, { ipAddress: requestContext.ipAddress })
    }
    
    // User agent validation (basic check)
    if (sessionData.userAgent !== requestContext.userAgent) {
      console.warn('Session user agent changed', {
        sessionId: sessionData.id,
        originalUA: sessionData.userAgent,
        newUA: requestContext.userAgent
      })
      
      // This could indicate session hijacking, implement policy based on requirements
      // For now, we'll allow but log
    }
    
    // Device fingerprint validation
    const currentFingerprint = await this.generateDeviceFingerprint(requestContext)
    if (sessionData.deviceFingerprint !== currentFingerprint) {
      console.warn('Device fingerprint mismatch', {
        sessionId: sessionData.id,
        userId: sessionData.userId
      })
      
      // Implement fingerprint validation policy
      // Could require re-authentication for high-security operations
    }
    
    return true
  }
  
  private static generateSessionId(): string {
    return crypto.randomBytes(32).toString('base64url')
  }
  
  private static async generateDeviceFingerprint(context: LoginContext | RequestContext): Promise<string> {
    const fingerprintData = {
      userAgent: context.userAgent,
      // Add more fingerprinting data as needed
      // Screen resolution, timezone, etc. (from client-side)
    }
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex')
  }
  
  private static async enforceSessionLimits(userId: number): Promise<void> {
    const userSessions = await this.getUserActiveSessions(userId)
    
    if (userSessions.length >= this.MAX_CONCURRENT_SESSIONS) {
      // Remove oldest session
      const oldestSession = userSessions[0]
      await this.destroySession(oldestSession)
    }
  }
  
  private static async getSession(sessionId: string): Promise<SessionData | null> {
    const sessionJson = await RedisClient.get(`session:${sessionId}`)
    return sessionJson ? JSON.parse(sessionJson) : null
  }
  
  private static async updateSessionActivity(sessionId: string): Promise<void> {
    const sessionData = await this.getSession(sessionId)
    if (sessionData) {
      sessionData.lastAccessed = Date.now()
      await RedisClient.setex(
        `session:${sessionId}`,
        Math.floor((sessionData.expiresAt - Date.now()) / 1000),
        JSON.stringify(sessionData)
      )
    }
  }
  
  static async destroySession(sessionId: string): Promise<void> {
    const sessionData = await this.getSession(sessionId)
    if (sessionData) {
      await this.removeFromUserSessions(sessionData.userId, sessionId)
    }
    await RedisClient.del(`session:${sessionId}`)
  }
  
  private static async addToUserSessions(userId: number, sessionId: string): Promise<void> {
    await RedisClient.lpush(`user_sessions:${userId}`, sessionId)
    await RedisClient.expire(`user_sessions:${userId}`, this.SESSION_TIMEOUT / 1000)
  }
  
  private static async removeFromUserSessions(userId: number, sessionId: string): Promise<void> {
    await RedisClient.lrem(`user_sessions:${userId}`, 0, sessionId)
  }
  
  private static async getUserActiveSessions(userId: number): Promise<string[]> {
    return await RedisClient.lrange(`user_sessions:${userId}`, 0, -1)
  }
}

interface SessionData {
  id: string
  userId: number
  csrfToken: string
  createdAt: number
  lastAccessed: number
  expiresAt: number
  ipAddress: string
  userAgent: string
  deviceFingerprint: string
  loginMethod: string
  mfaVerified: boolean
  isActive: boolean
}

interface LoginContext {
  ipAddress: string
  userAgent: string
  method: 'password' | 'api_key'
  mfaVerified?: boolean
}

interface RequestContext {
  ipAddress: string
  userAgent: string
}
```

## Input Validation and Sanitization

### Comprehensive Input Security
```typescript
// src/security/input-validation.ts
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'
import validator from 'validator'

export class InputSecurity {
  /**
   * Sanitize HTML content to prevent XSS
   */
  static sanitizeHTML(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [], // No HTML tags allowed in analytics data
      ALLOWED_ATTR: [],
      FORBID_SCRIPTS: true,
      FORBID_TAGS: ['script', 'object', 'embed', 'link', 'style'],
      STRIP_COMMENTS: true
    })
  }
  
  /**
   * Sanitize SQL input to prevent injection
   */
  static sanitizeSQLInput(input: string): string {
    // Basic SQL injection prevention
    return input
      .replace(/['";\\]/g, '') // Remove SQL special characters
      .replace(/\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|EXEC|UNION|SELECT)\b/gi, '') // Remove SQL keywords
      .trim()
  }
  
  /**
   * Validate and sanitize JSON input
   */
  static sanitizeJSON(input: any, maxDepth: number = 5, maxSize: number = 1024 * 1024): any {
    if (typeof input === 'string') {
      if (input.length > maxSize) {
        throw new ValidationError('JSON input too large')
      }
      
      try {
        input = JSON.parse(input)
      } catch (error) {
        throw new ValidationError('Invalid JSON format')
      }
    }
    
    return this.sanitizeObjectRecursive(input, maxDepth, 0)
  }
  
  /**
   * Comprehensive request validation schemas
   */
  static getValidationSchemas() {
    return {
      // Authentication schemas
      login: z.object({
        username: z.string()
          .min(1, 'Username required')
          .max(255, 'Username too long')
          .regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid username format')
          .transform(this.sanitizeHTML),
        password: z.string()
          .min(1, 'Password required')
          .max(128, 'Password too long'),
        rememberMe: z.boolean().optional()
      }),
      
      // Analytics query schemas
      analyticsQuery: z.object({
        timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
        page: z.coerce.number().int().min(1).max(1000).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        sortBy: z.enum(['timestamp', 'duration', 'name']).default('timestamp'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
        search: z.string()
          .max(1000, 'Search term too long')
          .transform(this.sanitizeHTML)
          .optional(),
        filters: z.record(
          z.string().max(100),
          z.string().max(1000).transform(this.sanitizeHTML)
        ).optional()
      }),
      
      // Error resolution schema
      errorResolution: z.object({
        resolutionNotes: z.string()
          .max(2000, 'Resolution notes too long')
          .transform(this.sanitizeHTML)
          .optional()
      }),
      
      // Export schema
      exportRequest: z.object({
        type: z.enum(['tools', 'errors', 'requests']),
        format: z.enum(['csv', 'json']),
        timeRange: z.string().max(50),
        filters: z.record(z.string(), z.any()).optional()
      })
    }
  }
  
  private static sanitizeObjectRecursive(obj: any, maxDepth: number, currentDepth: number): any {
    if (currentDepth >= maxDepth) {
      throw new ValidationError('Object nesting too deep')
    }
    
    if (obj === null || obj === undefined) {
      return obj
    }
    
    if (typeof obj === 'string') {
      return this.sanitizeHTML(obj)
    }
    
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj
    }
    
    if (Array.isArray(obj)) {
      if (obj.length > 1000) {
        throw new ValidationError('Array too large')
      }
      return obj.map(item => this.sanitizeObjectRecursive(item, maxDepth, currentDepth + 1))
    }
    
    if (typeof obj === 'object') {
      const keys = Object.keys(obj)
      if (keys.length > 100) {
        throw new ValidationError('Object has too many properties')
      }
      
      const sanitized: any = {}
      for (const key of keys) {
        const sanitizedKey = this.sanitizeHTML(key)
        sanitized[sanitizedKey] = this.sanitizeObjectRecursive(obj[key], maxDepth, currentDepth + 1)
      }
      return sanitized
    }
    
    return obj
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Express middleware for request validation and sanitization
 */
export const validateAndSanitizeRequest = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request size
      const requestSize = JSON.stringify(req.body).length
      if (requestSize > 1024 * 1024) { // 1MB limit
        return res.status(413).json({
          success: false,
          error: {
            code: 'REQUEST_TOO_LARGE',
            message: 'Request payload too large'
          }
        })
      }
      
      // Validate against schema
      const validated = await schema.parseAsync(req.body)
      
      // Replace request body with validated/sanitized data
      req.body = validated
      
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          }
        })
      }
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: error instanceof Error ? error.message : 'Request validation failed'
        }
      })
    }
  }
}
```

## Network Security

### Security Headers and Middleware
```typescript
// src/security/network-security.ts
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { Request } from 'express'

export class NetworkSecurity {
  /**
   * Configure comprehensive security headers
   */
  static getSecurityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Required for some dashboard components
            "https://cdn.jsdelivr.net" // For external dependencies if needed
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Required for Tailwind and styled components
            "https://fonts.googleapis.com"
          ],
          fontSrc: [
            "'self'",
            "https://fonts.gstatic.com"
          ],
          imgSrc: [
            "'self'",
            "data:",
            "https:" // For user avatars or external images
          ],
          connectSrc: [
            "'self'",
            "wss:", // For WebSocket connections
            "https:" // For API calls
          ],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          childSrc: ["'none'"],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          baseUri: ["'self'"],
          formAction: ["'self'"]
        },
        reportOnly: false
      },
      crossOriginEmbedderPolicy: false, // Disable if causing issues with external resources
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      xssFilter: true
    })
  }
  
  /**
   * Configure CORS with strict policies
   */
  static getCORSConfig() {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      /^https:\/\/.*\.railway\.app$/,
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://localhost:3001'] : [])
    ].filter(Boolean)
    
    return cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true)
        
        const isAllowed = allowedOrigins.some(allowed => {
          if (typeof allowed === 'string') {
            return origin === allowed
          }
          return allowed.test(origin)
        })
        
        if (isAllowed) {
          callback(null, true)
        } else {
          callback(new Error(`CORS policy violation: ${origin} not allowed`))
        }
      },
      credentials: true, // Allow cookies
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-CSRF-Token'
      ],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      maxAge: 86400 // 24 hours
    })
  }
  
  /**
   * Advanced rate limiting with different policies
   */
  static getRateLimiters() {
    return {
      // Authentication endpoints - very strict
      auth: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 attempts per window
        message: {
          success: false,
          error: {
            code: 'AUTH_RATE_LIMIT',
            message: 'Too many authentication attempts. Try again later.'
          }
        },
        keyGenerator: (req: Request) => `auth:${req.ip}:${req.body?.username || 'unknown'}`,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
          console.warn('Authentication rate limit hit', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            username: req.body?.username
          })
          res.status(429).json({
            success: false,
            error: {
              code: 'AUTH_RATE_LIMIT',
              message: 'Too many authentication attempts. Try again later.',
              retryAfter: Math.round(res.getHeader('Retry-After') as number || 900)
            }
          })
        }
      }),
      
      // API endpoints - moderate limits based on user role
      api: rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: (req: Request) => {
          const userRole = (req as any).user?.role
          switch (userRole) {
            case 'SUPER_ADMIN': return 300
            case 'ADMIN': return 200
            case 'READ_ONLY': return 100
            default: return 60 // Unauthenticated or unknown
          }
        },
        message: {
          success: false,
          error: {
            code: 'API_RATE_LIMIT',
            message: 'API rate limit exceeded. Please slow down your requests.'
          }
        },
        keyGenerator: (req: Request) => {
          const userId = (req as any).user?.id
          return userId ? `api:user:${userId}` : `api:ip:${req.ip}`
        }
      }),
      
      // Export operations - very restrictive
      export: rateLimit({
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 3, // 3 exports per 5 minutes
        message: {
          success: false,
          error: {
            code: 'EXPORT_RATE_LIMIT',
            message: 'Too many export requests. Please wait before requesting another export.'
          }
        }
      }),
      
      // Global fallback rate limit
      global: rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 500, // 500 requests per minute globally per IP
        message: {
          success: false,
          error: {
            code: 'GLOBAL_RATE_LIMIT',
            message: 'Too many requests from this IP address.'
          }
        }
      })
    }
  }
}

/**
 * Request logging for security monitoring
 */
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - startTime
    const logData = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      userId: (req as any).user?.id,
      contentLength: res.get('Content-Length'),
      
      // Security-relevant headers
      xForwardedFor: req.get('X-Forwarded-For'),
      xRealIp: req.get('X-Real-IP'),
      
      // Suspicious patterns
      suspicious: {
        sqlInjection: this.detectSQLInjection(req),
        xssAttempt: this.detectXSS(req),
        pathTraversal: this.detectPathTraversal(req),
        unusualUserAgent: this.detectUnusualUserAgent(req)
      }
    }
    
    // Log security events
    if (Object.values(logData.suspicious).some(Boolean)) {
      console.warn('Suspicious request detected', logData)
    }
    
    // Log failed authentication attempts
    if (req.path.includes('/auth/') && res.statusCode >= 400) {
      console.warn('Authentication failure', logData)
    }
  })
  
  next()
}
```

## Data Protection

### Encryption and Data Security
```typescript
// src/security/data-protection.ts
import crypto from 'crypto'

export class DataProtection {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY_LENGTH = 32
  private static readonly IV_LENGTH = 16
  private static readonly TAG_LENGTH = 16
  
  /**
   * Encrypt sensitive data
   */
  static encryptSensitiveData(data: string, key?: string): EncryptedData {
    const encryptionKey = key ? Buffer.from(key, 'hex') : this.getDefaultKey()
    const iv = crypto.randomBytes(this.IV_LENGTH)
    
    const cipher = crypto.createCipher(this.ALGORITHM, encryptionKey)
    cipher.setAAD(Buffer.from('analytics-data')) // Additional authenticated data
    
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const tag = cipher.getAuthTag()
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: this.ALGORITHM
    }
  }
  
  /**
   * Decrypt sensitive data
   */
  static decryptSensitiveData(encryptedData: EncryptedData, key?: string): string {
    const encryptionKey = key ? Buffer.from(key, 'hex') : this.getDefaultKey()
    const iv = Buffer.from(encryptedData.iv, 'hex')
    const tag = Buffer.from(encryptedData.tag, 'hex')
    
    const decipher = crypto.createDecipher(this.ALGORITHM, encryptionKey)
    decipher.setAAD(Buffer.from('analytics-data'))
    decipher.setAuthTag(tag)
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
  
  /**
   * Hash sensitive data for comparison (one-way)
   */
  static hashSensitiveData(data: string, salt?: string): HashedData {
    const actualSalt = salt || crypto.randomBytes(32).toString('hex')
    const hash = crypto.pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512')
    
    return {
      hash: hash.toString('hex'),
      salt: actualSalt,
      iterations: 100000
    }
  }
  
  /**
   * Anonymize personally identifiable information
   */
  static anonymizePII(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data
    }
    
    const anonymized = { ...data }
    const piiFields = [
      'email', 'phone', 'ssn', 'creditCard', 'address', 
      'firstName', 'lastName', 'fullName', 'personalInfo'
    ]
    
    for (const field of piiFields) {
      if (anonymized[field]) {
        anonymized[field] = this.generateConsistentHash(anonymized[field])
      }
    }
    
    // Handle nested objects
    for (const [key, value] of Object.entries(anonymized)) {
      if (typeof value === 'object' && value !== null) {
        anonymized[key] = this.anonymizePII(value)
      }
    }
    
    return anonymized
  }
  
  /**
   * Generate consistent hash for data anonymization
   */
  private static generateConsistentHash(input: string): string {
    const hash = crypto.createHash('sha256')
    hash.update(input + process.env.ANONYMIZATION_SALT)
    return hash.digest('hex').substring(0, 16) // Shortened hash for display
  }
  
  private static getDefaultKey(): Buffer {
    const key = process.env.DATA_ENCRYPTION_KEY
    if (!key) {
      throw new Error('DATA_ENCRYPTION_KEY environment variable not set')
    }
    return Buffer.from(key, 'hex')
  }
  
  /**
   * Secure data deletion (overwrite memory)
   */
  static secureDelete(buffer: Buffer): void {
    if (buffer) {
      crypto.randomFillSync(buffer)
      buffer.fill(0)
    }
  }
}

interface EncryptedData {
  encrypted: string
  iv: string
  tag: string
  algorithm: string
}

interface HashedData {
  hash: string
  salt: string
  iterations: number
}
```

## Security Monitoring and Audit

### Security Event Logging
```typescript
// src/security/audit-logger.ts
export class SecurityAuditLogger {
  /**
   * Log security events with comprehensive context
   */
  static async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const auditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      sessionId: event.sessionId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      description: event.description,
      metadata: event.metadata,
      environment: process.env.NODE_ENV,
      service: 'hubspot-mcp-analytics'
    }
    
    // Store in database for persistent audit trail
    await prisma.securityAuditLog.create({
      data: auditEntry
    })
    
    // Send to external SIEM if configured
    if (process.env.SIEM_WEBHOOK_URL) {
      await this.sendToSIEM(auditEntry)
    }
    
    // Log to console for immediate visibility
    console.log('Security Event:', auditEntry)
    
    // Trigger alerts for high-severity events
    if (event.severity === 'HIGH' || event.severity === 'CRITICAL') {
      await this.triggerSecurityAlert(auditEntry)
    }
  }
  
  /**
   * Common security event types
   */
  static async logAuthenticationFailure(context: AuthFailureContext): Promise<void> {
    await this.logSecurityEvent({
      type: 'AUTHENTICATION_FAILURE',
      severity: context.attemptCount > 3 ? 'HIGH' : 'MEDIUM',
      userId: null,
      sessionId: null,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      description: `Authentication failure for username: ${context.username}`,
      metadata: {
        username: context.username,
        attemptCount: context.attemptCount,
        reason: context.failureReason
      }
    })
  }
  
  static async logSuspiciousActivity(context: SuspiciousActivityContext): Promise<void> {
    await this.logSecurityEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      severity: 'HIGH',
      userId: context.userId,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      description: context.description,
      metadata: context.details
    })
  }
  
  static async logPrivilegeEscalation(context: PrivilegeContext): Promise<void> {
    await this.logSecurityEvent({
      type: 'PRIVILEGE_ESCALATION_ATTEMPT',
      severity: 'CRITICAL',
      userId: context.userId,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      description: `Unauthorized access attempt to: ${context.resource}`,
      metadata: {
        resource: context.resource,
        requiredPermission: context.requiredPermission,
        userRole: context.userRole
      }
    })
  }
  
  private static async sendToSIEM(auditEntry: any): Promise<void> {
    try {
      await fetch(process.env.SIEM_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditEntry)
      })
    } catch (error) {
      console.error('Failed to send security event to SIEM:', error)
    }
  }
  
  private static async triggerSecurityAlert(auditEntry: any): Promise<void> {
    // Implement alerting logic (email, Slack, PagerDuty, etc.)
    console.error('SECURITY ALERT:', auditEntry)
  }
}

interface SecurityEvent {
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  userId?: number
  sessionId?: string
  ipAddress: string
  userAgent: string
  description: string
  metadata?: any
}

interface AuthFailureContext {
  username: string
  ipAddress: string
  userAgent: string
  attemptCount: number
  failureReason: string
}

interface SuspiciousActivityContext {
  userId?: number
  sessionId?: string
  ipAddress: string
  userAgent: string
  description: string
  details: any
}

interface PrivilegeContext {
  userId: number
  sessionId: string
  ipAddress: string
  userAgent: string
  resource: string
  requiredPermission: string
  userRole: string
}
```

## Environment Security

### Secure Configuration Management
```typescript
// src/security/config-security.ts
export class ConfigSecurity {
  /**
   * Validate all security-critical environment variables
   */
  static validateSecurityConfig(): void {
    const requiredSecrets = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'PASSWORD_PEPPER',
      'DATA_ENCRYPTION_KEY',
      'ANONYMIZATION_SALT'
    ]
    
    const missingSecrets = requiredSecrets.filter(secret => !process.env[secret])
    
    if (missingSecrets.length > 0) {
      throw new Error(`Missing required security environment variables: ${missingSecrets.join(', ')}`)
    }
    
    // Validate secret strength
    this.validateSecretStrength('JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET!)
    this.validateSecretStrength('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET!)
    this.validateSecretStrength('PASSWORD_PEPPER', process.env.PASSWORD_PEPPER!)
    
    // Validate encryption key format
    this.validateEncryptionKey()
    
    console.log('✅ Security configuration validated successfully')
  }
  
  private static validateSecretStrength(name: string, secret: string): void {
    if (secret.length < 32) {
      throw new Error(`${name} must be at least 32 characters long`)
    }
    
    // Check entropy (basic check)
    const uniqueChars = new Set(secret).size
    if (uniqueChars < 16) {
      throw new Error(`${name} has insufficient entropy`)
    }
  }
  
  private static validateEncryptionKey(): void {
    const key = process.env.DATA_ENCRYPTION_KEY
    if (!key) {
      throw new Error('DATA_ENCRYPTION_KEY not set')
    }
    
    try {
      const keyBuffer = Buffer.from(key, 'hex')
      if (keyBuffer.length !== 32) {
        throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes (64 hex characters)')
      }
    } catch (error) {
      throw new Error('DATA_ENCRYPTION_KEY must be valid hex string')
    }
  }
  
  /**
   * Generate secure secrets for deployment
   */
  static generateSecrets(): SecretBundle {
    return {
      JWT_ACCESS_SECRET: crypto.randomBytes(64).toString('hex'),
      JWT_REFRESH_SECRET: crypto.randomBytes(64).toString('hex'),
      PASSWORD_PEPPER: crypto.randomBytes(32).toString('hex'),
      DATA_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
      ANONYMIZATION_SALT: crypto.randomBytes(32).toString('hex')
    }
  }
}

interface SecretBundle {
  JWT_ACCESS_SECRET: string
  JWT_REFRESH_SECRET: string
  PASSWORD_PEPPER: string
  DATA_ENCRYPTION_KEY: string
  ANONYMIZATION_SALT: string
}
```

## Security Testing and Compliance

### Security Test Suite
```typescript
// src/__tests__/security.test.ts
describe('Security Tests', () => {
  describe('Authentication Security', () => {
    test('should reject weak passwords', async () => {
      const weakPasswords = [
        'password123',
        'admin',
        '12345678',
        'Password!', // Too short
        'passwordpassword' // No complexity
      ]
      
      for (const password of weakPasswords) {
        await expect(
          PasswordSecurity.hashPassword(password)
        ).rejects.toThrow('Password')
      }
    })
    
    test('should enforce account lockout', async () => {
      const username = 'testuser'
      
      // Simulate failed login attempts
      for (let i = 0; i < 5; i++) {
        try {
          await AuthService.authenticateUser(username, 'wrongpassword')
        } catch (error) {
          // Expected to fail
        }
      }
      
      // Next attempt should be blocked
      await expect(
        AuthService.authenticateUser(username, 'correctpassword')
      ).rejects.toThrow('locked')
    })
  })
  
  describe('Input Validation', () => {
    test('should sanitize XSS attempts', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
        'onclick="alert(1)"'
      ]
      
      xssPayloads.forEach(payload => {
        const sanitized = InputSecurity.sanitizeHTML(payload)
        expect(sanitized).not.toContain('<script')
        expect(sanitized).not.toContain('javascript:')
        expect(sanitized).not.toContain('onerror')
        expect(sanitized).not.toContain('onclick')
      })
    })
    
    test('should prevent SQL injection', () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "UNION SELECT * FROM passwords"
      ]
      
      sqlPayloads.forEach(payload => {
        const sanitized = InputSecurity.sanitizeSQLInput(payload)
        expect(sanitized).not.toContain('DROP')
        expect(sanitized).not.toContain('UNION')
        expect(sanitized).not.toContain("'")
      })
    })
  })
  
  describe('Encryption Security', () => {
    test('should encrypt and decrypt data correctly', () => {
      const originalData = 'sensitive-user-data'
      
      const encrypted = DataProtection.encryptSensitiveData(originalData)
      expect(encrypted.encrypted).not.toBe(originalData)
      expect(encrypted.iv).toBeDefined()
      expect(encrypted.tag).toBeDefined()
      
      const decrypted = DataProtection.decryptSensitiveData(encrypted)
      expect(decrypted).toBe(originalData)
    })
    
    test('should anonymize PII correctly', () => {
      const userData = {
        email: 'user@example.com',
        phone: '+1234567890',
        analytics: {
          toolUsage: 50
        }
      }
      
      const anonymized = DataProtection.anonymizePII(userData)
      expect(anonymized.email).not.toBe(userData.email)
      expect(anonymized.phone).not.toBe(userData.phone)
      expect(anonymized.analytics.toolUsage).toBe(userData.analytics.toolUsage)
    })
  })
})
```

This comprehensive security architecture provides multiple layers of protection for the HubSpot MCP Analytics Dashboard, implementing industry best practices for authentication, authorization, data protection, and security monitoring. The design ensures that sensitive analytics data and administrative functions are properly protected while maintaining usability and performance.