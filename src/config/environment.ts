/**
 * Environment Configuration and Validation
 * Location: src/config/environment.ts
 * 
 * This module provides comprehensive environment variable validation and configuration
 * management for the HubSpot MCP server. It ensures all required variables are present
 * and validates their formats before the server starts.
 */

import { z } from 'zod';

const environmentSchema = z.object({
  // Core Configuration
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('0.0.0.0'),
  
  // Authentication
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ISSUER: z.string().url().optional(),
  JWT_AUDIENCE: z.string().optional(),
  JWKS_URI: z.string().url().optional(),
  JWKS_CACHE_TTL: z.string().transform(Number).default('3600'),
  
  // HubSpot Configuration
  HUBSPOT_ACCESS_TOKEN: z.string().min(20),
  HUBSPOT_API_BASE_URL: z.string().url().default('https://api.hubapi.com'),
  HUBSPOT_RATE_LIMIT: z.string().transform(Number).default('10'),
  
  // Security
  CORS_ORIGIN: z.string().transform(origins => origins.split(',')).default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('1000'),
  SESSION_MAX_AGE: z.string().transform(Number).default('1800000'),
  SESSION_CLEANUP_INTERVAL: z.string().transform(Number).default('300000'),
  
  // Monitoring
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  METRICS_ENABLED: z.string().transform(v => v === 'true').default('true'),
  HEALTH_CHECK_ENABLED: z.string().transform(v => v === 'true').default('true'),
  
  // Optional Redis Configuration
  REDIS_URL: z.string().url().optional(),
  REDIS_SESSION_PREFIX: z.string().default('mcp:session:'),
  
  // Deployment Metadata
  RAILWAY_DEPLOYMENT_ID: z.string().optional(),
  RAILWAY_ENVIRONMENT: z.string().optional(),
  RAILWAY_SERVICE_NAME: z.string().optional()
});

export type EnvironmentConfig = z.infer<typeof environmentSchema>;

export const loadConfig = (): EnvironmentConfig => {
  try {
    const config = environmentSchema.parse(process.env);
    console.log('✅ Environment configuration loaded successfully');
    return config;
  } catch (error) {
    console.error('❌ Environment configuration validation failed:');
    
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    
    process.exit(1);
  }
};

// Configuration validation on startup
export const validateConfiguration = (config: EnvironmentConfig): void => {
  const issues: string[] = [];
  
  // Production-specific validations
  if (config.NODE_ENV === 'production') {
    if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
      issues.push('JWT_SECRET must be at least 32 characters in production');
    }
    
    if (config.CORS_ORIGIN.includes('*')) {
      issues.push('CORS_ORIGIN should not include wildcards in production');
    }
    
    if (config.LOG_LEVEL === 'debug') {
      issues.push('LOG_LEVEL should not be debug in production');
    }
  }
  
  // Security validations
  if (config.HUBSPOT_ACCESS_TOKEN.length < 40) {
    console.warn('⚠️  HUBSPOT_ACCESS_TOKEN appears to be short - ensure it is a valid token');
  }
  
  if (config.SESSION_MAX_AGE < 300000) { // 5 minutes
    issues.push('SESSION_MAX_AGE should be at least 5 minutes');
  }
  
  if (issues.length > 0) {
    console.error('❌ Configuration validation failed:');
    issues.forEach(issue => console.error(`  ${issue}`));
    process.exit(1);
  }
  
  console.log('✅ Configuration validation passed');
};

// Environment helper functions
export const isDevelopment = (config: EnvironmentConfig): boolean => config.NODE_ENV === 'development';
export const isProduction = (config: EnvironmentConfig): boolean => config.NODE_ENV === 'production';
export const isStaging = (config: EnvironmentConfig): boolean => config.NODE_ENV === 'staging';

// Default configuration for development
export const getDefaultDevelopmentConfig = (): Partial<EnvironmentConfig> => ({
  NODE_ENV: 'development',
  PORT: 3000,
  HOST: '0.0.0.0',
  CORS_ORIGIN: ['http://localhost:3000', 'http://localhost:3001'],
  LOG_LEVEL: 'debug',
  METRICS_ENABLED: true,
  HEALTH_CHECK_ENABLED: true,
  RATE_LIMIT_MAX: 10000, // More lenient for development
  SESSION_MAX_AGE: 3600000, // 1 hour for development
});