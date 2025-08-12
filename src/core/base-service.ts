/**
 * Base Service
 * 
 * Provides foundational HubSpot service functionality that all BCP-specific services extend.
 * Handles authentication, basic configuration, and shared utility methods.
 */

import { Client } from '@hubspot/api-client';
import { BaseService, ServiceConfig, BcpError } from './types.js';

export class HubspotBaseService implements BaseService {
  protected client: Client;
  private initialized = false;
  
  constructor(protected config: ServiceConfig) {
    if (!config.hubspotAccessToken) {
      throw new BcpError(
        'HubSpot access token is required',
        'CONFIG_ERROR',
        400
      );
    }
    
    this.client = new Client({
      accessToken: config.hubspotAccessToken
    });
  }

  /**
   * Initialize the service and verify credentials
   */
  async init(): Promise<void> {
    // Skip initialization if we don't have a real token
    // This allows the DXT extension to start without a token
    const token = this.config.hubspotAccessToken;
    if (!token || token === 'placeholder') {
      console.error('HubSpot service not initialized: No valid access token provided');
      this.initialized = false;
      return;
    }
    
    try {
      // Test API access by making a simple request
      await this.client.apiRequest({
        method: 'GET',
        path: '/crm/v3/objects/contacts'
      });
      this.initialized = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BcpError(
        `Failed to initialize HubSpot service: ${message}`,
        'INIT_ERROR',
        500
      );
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current service configuration
   */
  getConfig(): ServiceConfig {
    return this.config;
  }

  /**
   * Protected helper to ensure service is initialized before use
   */
  protected checkInitialized(): void {
    if (!this.initialized) {
      throw new BcpError(
        'HubSpot service not initialized. Please configure your HubSpot access token in the extension settings.',
        'AUTH_ERROR',
        401
      );
    }
  }

  /**
   * Protected helper to handle API errors consistently
   */
  protected handleApiError(error: unknown, context: string): never {
    const message = error instanceof Error ? error.message : String(error);
    throw new BcpError(
      `${context}: ${message}`,
      'API_ERROR',
      500
    );
  }

  /**
   * Protected helper to validate required parameters
   */
  protected validateRequired<T extends object>(
    params: T,
    required: (keyof T)[]
  ): void {
    for (const key of required) {
      if (params[key] === undefined || params[key] === null) {
        throw new BcpError(
          `Missing required parameter: ${String(key)}`,
          'VALIDATION_ERROR',
          400
        );
      }
    }
  }
}
