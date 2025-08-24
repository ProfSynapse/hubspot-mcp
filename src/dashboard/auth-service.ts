/**
 * Dashboard Authentication Service
 * Location: src/dashboard/auth-service.ts
 * 
 * This service handles authentication for the analytics dashboard using bcrypt
 * password hashing and session management. It provides login/logout functionality
 * and user validation against the PostgreSQL database.
 */

import bcrypt from 'bcrypt';
import { z } from 'zod';
import database from '../analytics/database.js';

// Validation schemas
const LoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(128)
});

const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  password_hash: z.string(),
  created_at: z.date()
});

// Types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: Date;
}

export interface AuthResult {
  success: boolean;
  message: string;
  user?: Omit<User, 'password_hash'>;
}

/**
 * Dashboard Authentication Service
 * Handles user authentication for analytics dashboard
 */
export class DashboardAuthService {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(password, DashboardAuthService.SALT_ROUNDS);
      return hash;
    } catch (error) {
      console.error('Error hashing password:', error);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  /**
   * Authenticate user with username and password
   */
  async authenticateUser(credentials: LoginRequest): Promise<AuthResult> {
    try {
      // Validate input
      const validatedCredentials = LoginSchema.parse(credentials);
      const { username, password } = validatedCredentials;

      // Find user in database
      const userResult = await database.query(
        'SELECT id, username, password_hash, created_at FROM users WHERE username = $1',
        [username]
      );

      if (userResult.rows.length === 0) {
        return {
          success: false,
          message: 'Invalid username or password'
        };
      }

      const user = userResult.rows[0];
      
      // Verify password
      const isValidPassword = await this.verifyPassword(password, user.password_hash);
      
      if (!isValidPassword) {
        return {
          success: false,
          message: 'Invalid username or password'
        };
      }

      // Return success with user info (excluding password hash)
      return {
        success: true,
        message: 'Authentication successful',
        user: {
          id: user.id,
          username: user.username,
          created_at: user.created_at
        }
      };

    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        message: 'Authentication failed due to server error'
      };
    }
  }

  /**
   * Create a new user (for setup purposes)
   */
  async createUser(username: string, password: string): Promise<AuthResult> {
    try {
      // Validate input
      const validatedCredentials = LoginSchema.parse({ username, password });

      // Check if user already exists
      const existingUserResult = await database.query(
        'SELECT id FROM users WHERE username = $1',
        [validatedCredentials.username]
      );

      if (existingUserResult.rows.length > 0) {
        return {
          success: false,
          message: 'User already exists'
        };
      }

      // Hash password
      const passwordHash = await this.hashPassword(validatedCredentials.password);

      // Create user
      const createResult = await database.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
        [validatedCredentials.username, passwordHash]
      );

      const newUser = createResult.rows[0];

      return {
        success: true,
        message: 'User created successfully',
        user: {
          id: newUser.id,
          username: newUser.username,
          created_at: newUser.created_at
        }
      };

    } catch (error) {
      console.error('User creation error:', error);
      return {
        success: false,
        message: 'Failed to create user'
      };
    }
  }

  /**
   * Get user by ID (for session validation)
   */
  async getUserById(id: number): Promise<Omit<User, 'password_hash'> | null> {
    try {
      const result = await database.query(
        'SELECT id, username, created_at FROM users WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      return null;
    }
  }

  /**
   * Check if any users exist (for initial setup)
   */
  async hasUsers(): Promise<boolean> {
    try {
      const result = await database.query('SELECT COUNT(*) as count FROM users');
      const count = parseInt(result.rows[0].count);
      return count > 0;
    } catch (error) {
      console.error('Error checking for existing users:', error);
      return false;
    }
  }

  /**
   * Health check for auth service
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      // Test database connection
      await database.query('SELECT 1');
      
      // Check if users table exists
      const tableResult = await database.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users'
        )
      `);
      
      if (!tableResult.rows[0].exists) {
        return {
          status: 'unhealthy',
          message: 'Users table does not exist'
        };
      }

      return {
        status: 'healthy',
        message: 'Dashboard auth service operational'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Auth service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Export singleton instance
export const dashboardAuthService = new DashboardAuthService();