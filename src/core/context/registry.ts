/**
 * Context Registry for Managing Dynamic Schema Context Providers
 *
 * Central registry that manages all context providers and coordinates their
 * initialization and context retrieval. Follows the Registry pattern.
 */

import { ContextProvider, SchemaContext, ContextProviderError } from './types.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  level: 'info',
  environment: 'development',
  serviceName: 'context-registry',
  version: '0.1.0'
});

/**
 * Registry for managing context providers and their initialization
 */
export class ContextRegistry {
  private providers: Map<string, ContextProvider[]> = new Map();
  private allProviders: ContextProvider[] = [];
  private initialized = false;

  /**
   * Register a context provider
   * @param provider The provider to register
   */
  register(provider: ContextProvider): void {
    if (this.initialized) {
      throw new Error('Cannot register providers after initialization');
    }

    // Add to domain-specific collection
    const domainProviders = this.providers.get(provider.domain) || [];
    domainProviders.push(provider);
    this.providers.set(provider.domain, domainProviders);

    // Add to global collection
    this.allProviders.push(provider);

    logger.info(`Registered context provider: ${provider.name} for domain: ${provider.domain}`);
  }

  /**
   * Initialize all registered providers
   * @param apiKey HubSpot API key
   * @throws ContextProviderError if any required provider fails
   */
  async initializeAll(apiKey: string): Promise<void> {
    if (this.initialized) {
      logger.warn('Context registry already initialized, skipping...');
      return;
    }

    logger.info(`Initializing ${this.allProviders.length} context providers...`);

    const initResults = await Promise.allSettled(
      this.allProviders.map(provider => this.initializeProvider(provider, apiKey))
    );

    // Check for any required provider failures
    const failures: string[] = [];
    for (let i = 0; i < initResults.length; i++) {
      const result = initResults[i];
      const provider = this.allProviders[i];

      if (result.status === 'rejected' && provider.isRequired()) {
        failures.push(`${provider.name}: ${result.reason.message}`);
      }
    }

    if (failures.length > 0) {
      const errorMessage = `Required context providers failed:\n${failures.join('\n')}`;
      logger.error(errorMessage);
      throw new ContextProviderError('ContextRegistry', errorMessage);
    }

    this.initialized = true;

    const successCount = initResults.filter(r => r.status === 'fulfilled').length;
    const failureCount = initResults.filter(r => r.status === 'rejected').length;

    logger.info(`Context initialization complete: ${successCount} succeeded, ${failureCount} failed (non-required)`);
  }

  /**
   * Initialize a single provider with error handling
   */
  private async initializeProvider(provider: ContextProvider, apiKey: string): Promise<void> {
    try {
      logger.debug(`Initializing provider: ${provider.name}`);
      await provider.initialize(apiKey);

      if (provider.isInitialized()) {
        const contextCount = provider.getContext().length;
        logger.info(`✅ ${provider.name} initialized successfully (${contextCount} contexts)`);
      } else {
        throw new Error('Provider initialization completed but isInitialized() returned false');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`❌ ${provider.name} initialization failed: ${errorMessage}`);

      if (provider.isRequired()) {
        throw new ContextProviderError(provider.name, errorMessage, error as Error);
      } else {
        logger.warn(`Non-required provider ${provider.name} failed, continuing...`);
      }
    }
  }

  /**
   * Get all context for a specific domain
   * @param domain Domain name (e.g., 'Deals', 'Contacts')
   * @returns Array of schema contexts
   */
  getContextForDomain(domain: string): SchemaContext[] {
    if (!this.initialized) {
      logger.warn('Context registry not initialized, returning empty context');
      return [];
    }

    const contexts: SchemaContext[] = [];

    // Get contexts from domain-specific providers
    const domainProviders = this.providers.get(domain) || [];
    for (const provider of domainProviders) {
      if (provider.isInitialized()) {
        contexts.push(...provider.getContext());
      }
    }

    // Get contexts from universal providers (domain = '*')
    const universalProviders = this.providers.get('*') || [];
    for (const provider of universalProviders) {
      if (provider.isInitialized()) {
        contexts.push(...provider.getContext());
      }
    }

    return contexts;
  }

  /**
   * Get context for a specific field in a domain
   * @param domain Domain name
   * @param field Field name
   * @returns Context for the field, or undefined if not found
   */
  getContextForField(domain: string, field: string): SchemaContext | undefined {
    const contexts = this.getContextForDomain(domain);
    return contexts.find(ctx => ctx.field === field);
  }

  /**
   * Check if the registry has been initialized
   * @returns true if initialized, false otherwise
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get statistics about registered providers
   * @returns Provider statistics
   */
  getStats(): {
    totalProviders: number;
    initializedProviders: number;
    domains: string[];
    providers: Array<{
      name: string;
      domain: string;
      fields: string[];
      initialized: boolean;
      required: boolean;
    }>;
  } {
    return {
      totalProviders: this.allProviders.length,
      initializedProviders: this.allProviders.filter(p => p.isInitialized()).length,
      domains: Array.from(this.providers.keys()),
      providers: this.allProviders.map(p => ({
        name: p.name,
        domain: p.domain,
        fields: p.fields,
        initialized: p.isInitialized(),
        required: p.isRequired()
      }))
    };
  }

  /**
   * Reset the registry (for testing purposes)
   */
  reset(): void {
    this.providers.clear();
    this.allProviders = [];
    this.initialized = false;
    logger.debug('Context registry reset');
  }
}