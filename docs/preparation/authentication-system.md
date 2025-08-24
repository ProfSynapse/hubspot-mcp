# Authentication System Research

## Executive Summary

Authentication for admin dashboards in 2024 emphasizes security through simplicity, with JWT tokens and secure session management being the preferred approaches. Research indicates that for single-admin use cases, username/password authentication with proper hashing, session management, and security headers provides adequate protection. Key considerations include secure password storage using bcrypt, proper session handling, and implementation of security best practices like rate limiting and CSRF protection.

**Primary Recommendations:**
- Use bcrypt for password hashing with minimum 12 rounds
- Implement JWT-based stateless authentication for API endpoints
- Use secure HTTP-only cookies for session management in web interface
- Apply comprehensive security middleware (helmet, rate limiting, CSRF protection)

## Authentication Strategies Comparison

### JWT vs Session-Based Authentication

| Aspect | JWT Tokens | Sessions |
|--------|------------|----------|
| **State** | Stateless | Stateful |
| **Scalability** | Excellent | Limited |
| **Security** | Token-based | Server-side |
| **Revocation** | Complex | Immediate |
| **Storage** | Client-side | Server-side |
| **Best For** | APIs, Microservices | Traditional web apps |

### Hybrid Approach (Recommended)

**Implementation Strategy:**
- JWT tokens for API authentication (dashboard data fetching)
- Secure sessions for web interface authentication
- Refresh token pattern for long-lived sessions
- Secure cookie storage for web sessions

## Implementation Patterns

### User Model and Database Schema

**Prisma Schema:**
```prisma
model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  password  String   // bcrypt hashed
  email     String?  @unique
  role      UserRole @default(ADMIN)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Session management
  sessions  Session[]
  
  // Audit trail
  lastLogin    DateTime?
  loginAttempts Int      @default(0)
  lockedUntil   DateTime?
  
  @@map("users")
}

model Session {
  id        String   @id @default(cuid())
  userId    Int
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  ipAddress String?
  userAgent String?
  isActive  Boolean  @default(true)
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("sessions")
}

enum UserRole {
  ADMIN
  READ_ONLY
}
```

**Migration SQL:**
```sql
-- Users table with security features
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- bcrypt hashed
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50) DEFAULT 'ADMIN',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Security fields
    last_login TIMESTAMP WITH TIME ZONE,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE
);

-- Sessions table for session management
CREATE TABLE sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Indexes for performance
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_user_active ON sessions(user_id, is_active);

-- Default admin user (password: admin123!)
INSERT INTO users (username, password) VALUES 
('admin', '$2b$12$rGx5W3Q4/5L3gJq5z7.ZbeK9H3wRHdKZVs3QKlvxQ1J3L8vRHdKZV');
```

### Password Security Implementation

**Secure Password Hashing:**
```typescript
// src/utils/password.ts
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export class PasswordSecurity {
  private static readonly SALT_ROUNDS = 12
  private static readonly MIN_PASSWORD_LENGTH = 8
  
  /**
   * Hash password using bcrypt with salt rounds
   */
  static async hashPassword(password: string): Promise<string> {
    this.validatePasswordStrength(password)
    return await bcrypt.hash(password, this.SALT_ROUNDS)
  }
  
  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash)
  }
  
  /**
   * Generate secure random password
   */
  static generateSecurePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let password = ''
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length)
      password += charset[randomIndex]
    }
    
    return password
  }
  
  /**
   * Validate password strength
   */
  private static validatePasswordStrength(password: string): void {
    if (password.length < this.MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${this.MIN_PASSWORD_LENGTH} characters long`)
    }
    
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
    
    const criteriaMet = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar]
    const strengthScore = criteriaMet.filter(Boolean).length
    
    if (strengthScore < 3) {
      throw new Error('Password must contain at least 3 of: uppercase, lowercase, numbers, special characters')
    }
  }
}
```

### JWT Token Management

**JWT Service Implementation:**
```typescript
// src/services/jwt.service.ts
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { env } from '../config/environment.js'

interface JWTPayload {
  userId: number
  username: string
  role: string
  sessionId: string
}

interface RefreshTokenPayload {
  userId: number
  sessionId: string
}

export class JWTService {
  private static readonly ACCESS_TOKEN_EXPIRY = '15m'
  private static readonly REFRESH_TOKEN_EXPIRY = '7d'
  
  /**
   * Generate access token
   */
  static generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'hubspot-mcp-analytics',
      audience: 'dashboard-api'
    })
  }
  
  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: RefreshTokenPayload): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: 'hubspot-mcp-analytics',
      audience: 'dashboard-refresh'
    })
  }
  
  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, env.JWT_SECRET) as JWTPayload
    } catch (error) {
      console.error('Access token verification failed:', error)
      return null
    }
  }
  
  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload
    } catch (error) {
      console.error('Refresh token verification failed:', error)
      return null
    }
  }
  
  /**
   * Generate secure random token for sessions
   */
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }
}
```

### Authentication Service

**Core Authentication Logic:**
```typescript
// src/services/auth.service.ts
import { prisma } from '../config/database.js'
import { PasswordSecurity } from '../utils/password.js'
import { JWTService } from './jwt.service.js'

export class AuthService {
  private static readonly MAX_LOGIN_ATTEMPTS = 5
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes
  
  /**
   * Authenticate user with username/password
   */
  static async authenticateUser(
    username: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Find user and check if account is locked
    const user = await prisma.user.findUnique({
      where: { username, isActive: true }
    })
    
    if (!user) {
      throw new Error('Invalid credentials')
    }
    
    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const unlockTime = user.lockedUntil.toLocaleString()
      throw new Error(`Account is locked until ${unlockTime}`)
    }
    
    // Verify password
    const isValidPassword = await PasswordSecurity.verifyPassword(password, user.password)
    
    if (!isValidPassword) {
      await this.handleFailedLogin(user.id)
      throw new Error('Invalid credentials')
    }
    
    // Reset login attempts on successful login
    await this.handleSuccessfulLogin(user.id, ipAddress, userAgent)
    
    // Generate session and tokens
    const sessionId = JWTService.generateSecureToken()
    const session = await this.createSession(user.id, sessionId, ipAddress, userAgent)
    
    const accessToken = JWTService.generateAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      sessionId: session.id
    })
    
    const refreshToken = JWTService.generateRefreshToken({
      userId: user.id,
      sessionId: session.id
    })
    
    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      tokens: {
        accessToken,
        refreshToken
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt
      }
    }
  }
  
  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string) {
    const payload = JWTService.verifyRefreshToken(refreshToken)
    if (!payload) {
      throw new Error('Invalid refresh token')
    }
    
    // Verify session exists and is active
    const session = await prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.userId,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    })
    
    if (!session) {
      throw new Error('Session not found or expired')
    }
    
    // Generate new access token
    const newAccessToken = JWTService.generateAccessToken({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      sessionId: session.id
    })
    
    return {
      accessToken: newAccessToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    }
  }
  
  /**
   * Logout user and invalidate session
   */
  static async logoutUser(sessionId: string) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false }
    })
  }
  
  /**
   * Create session record
   */
  private static async createSession(
    userId: number,
    token: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return await prisma.session.create({
      data: {
        id: JWTService.generateSecureToken(),
        userId,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress,
        userAgent
      }
    })
  }
  
  /**
   * Handle failed login attempt
   */
  private static async handleFailedLogin(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })
    
    if (!user) return
    
    const newAttempts = user.loginAttempts + 1
    const updateData: any = { loginAttempts: newAttempts }
    
    // Lock account after max attempts
    if (newAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION)
    }
    
    await prisma.user.update({
      where: { id: userId },
      data: updateData
    })
  }
  
  /**
   * Handle successful login
   */
  private static async handleSuccessfulLogin(
    userId: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date()
      }
    })
  }
}
```

### Authentication Middleware

**Express Middleware Implementation:**
```typescript
// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express'
import { JWTService } from '../services/jwt.service.js'
import { prisma } from '../config/database.js'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number
        username: string
        role: string
        sessionId: string
      }
    }
  }
}

/**
 * JWT Authentication middleware
 */
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' })
    }
    
    const payload = JWTService.verifyAccessToken(token)
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    
    // Verify session is still active
    const session = await prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        isActive: true,
        expiresAt: { gt: new Date() }
      }
    })
    
    if (!session) {
      return res.status(401).json({ error: 'Session expired' })
    }
    
    req.user = payload
    next()
  } catch (error) {
    console.error('Authentication error:', error)
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

/**
 * Admin role check middleware
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  
  next()
}

/**
 * Session-based authentication for web interface
 */
export const authenticateSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const sessionToken = req.cookies?.sessionToken
  
  if (!sessionToken) {
    return res.redirect('/login')
  }
  
  try {
    const session = await prisma.session.findFirst({
      where: {
        token: sessionToken,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    })
    
    if (!session) {
      res.clearCookie('sessionToken')
      return res.redirect('/login')
    }
    
    req.user = {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role,
      sessionId: session.id
    }
    
    next()
  } catch (error) {
    console.error('Session authentication error:', error)
    return res.redirect('/login')
  }
}
```

### Security Middleware

**Comprehensive Security Implementation:**
```typescript
// src/middleware/security.ts
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { Request } from 'express'

/**
 * Authentication rate limiting
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Include username in key to prevent lockout of entire IP
    const username = req.body?.username || 'anonymous'
    return `${req.ip}-${username}`
  },
  skip: (req: Request) => {
    // Skip rate limiting for successful authentication
    return req.path === '/api/auth/refresh'
  }
})

/**
 * General API rate limiting
 */
export const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per minute
  message: {
    error: 'Too many requests, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false
})

/**
 * Security headers configuration
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  frameguard: { action: 'deny' }
})

/**
 * CSRF protection for session-based routes
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET') {
    return next()
  }
  
  const token = req.headers['x-csrf-token'] || req.body._csrf
  const sessionToken = req.cookies?.csrfToken
  
  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' })
  }
  
  next()
}
```

### Login API Routes

**Authentication Endpoints:**
```typescript
// src/routes/auth.routes.ts
import { Router } from 'express'
import { AuthService } from '../services/auth.service.js'
import { authRateLimit } from '../middleware/security.js'
import { z } from 'zod'

const router = Router()

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
})

/**
 * POST /api/auth/login
 */
router.post('/login', authRateLimit, async (req, res) => {
  try {
    const { username, password } = loginSchema.parse(req.body)
    
    const result = await AuthService.authenticateUser(
      username,
      password,
      req.ip,
      req.get('User-Agent')
    )
    
    // Set secure HTTP-only cookie for refresh token
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })
    
    res.json({
      success: true,
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresAt: result.session.expiresAt
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(401).json({
      error: error instanceof Error ? error.message : 'Authentication failed'
    })
  }
})

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' })
    }
    
    const result = await AuthService.refreshToken(refreshToken)
    
    res.json({
      success: true,
      accessToken: result.accessToken,
      expiresAt: result.expiresAt
    })
  } catch (error) {
    res.clearCookie('refreshToken')
    res.status(401).json({
      error: error instanceof Error ? error.message : 'Token refresh failed'
    })
  }
})

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticateJWT, async (req, res) => {
  try {
    if (req.user?.sessionId) {
      await AuthService.logoutUser(req.user.sessionId)
    }
    
    res.clearCookie('refreshToken')
    res.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ error: 'Logout failed' })
  }
})

export { router as authRoutes }
```

## Admin User Management

### Initial Admin Setup

**Setup Script:**
```typescript
// scripts/setup-admin.ts
import { prisma } from '../src/config/database.js'
import { PasswordSecurity } from '../src/utils/password.js'
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve))
}

async function setupInitialAdmin() {
  try {
    console.log('🔐 Setting up initial admin user...\n')
    
    const username = await question('Enter admin username: ')
    const password = await question('Enter admin password: ')
    const confirmPassword = await question('Confirm password: ')
    
    if (password !== confirmPassword) {
      console.error('❌ Passwords do not match')
      process.exit(1)
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username }
    })
    
    if (existingUser) {
      console.error('❌ User already exists')
      process.exit(1)
    }
    
    // Hash password and create user
    const hashedPassword = await PasswordSecurity.hashPassword(password)
    
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: 'ADMIN'
      }
    })
    
    console.log(`✅ Admin user created successfully`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Username: ${user.username}`)
    console.log(`   Created: ${user.createdAt}`)
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error)
    process.exit(1)
  } finally {
    rl.close()
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  setupInitialAdmin()
}
```

### Password Reset Functionality

**Password Reset Implementation:**
```typescript
// src/services/password-reset.service.ts
import crypto from 'crypto'
import { prisma } from '../config/database.js'
import { PasswordSecurity } from '../utils/password.js'

export class PasswordResetService {
  private static readonly RESET_TOKEN_EXPIRY = 60 * 60 * 1000 // 1 hour
  
  /**
   * Generate password reset token
   */
  static async generateResetToken(username: string) {
    const user = await prisma.user.findUnique({
      where: { username, isActive: true }
    })
    
    if (!user) {
      // Don't reveal if user exists
      throw new Error('If the user exists, a reset link will be generated')
    }
    
    const resetToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + this.RESET_TOKEN_EXPIRY)
    
    // Store reset token (you might want a separate table for this)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        // Store in a separate password_resets table in production
        // This is simplified for demo
      }
    })
    
    return { resetToken, expiresAt }
  }
  
  /**
   * Reset password using token
   */
  static async resetPassword(token: string, newPassword: string) {
    // Verify token and get user
    // In production, use a separate password_resets table
    
    const hashedPassword = await PasswordSecurity.hashPassword(newPassword)
    
    // Update password and clear reset token
    // Also invalidate all existing sessions
    
    return { success: true }
  }
}
```

## Resource Links

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [bcrypt Documentation](https://www.npmjs.com/package/bcryptjs)
- [JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

## Recommendations

1. **Use bcrypt with minimum 12 salt rounds** for password hashing
2. **Implement account lockout** after failed login attempts to prevent brute force
3. **Use JWT for API authentication** with short expiry times (15 minutes)
4. **Implement refresh token rotation** for enhanced security
5. **Store refresh tokens in HTTP-only cookies** to prevent XSS attacks
6. **Apply comprehensive rate limiting** especially on authentication endpoints
7. **Use security headers** (helmet) and CSRF protection for web interface
8. **Implement proper session management** with secure cookie settings
9. **Set up audit logging** for all authentication events
10. **Regularly review and rotate secrets** used for JWT signing