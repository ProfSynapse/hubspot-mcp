/**
 * Context Types for Dynamic Schema Injection
 *
 * Provides base interfaces for injecting dynamic context (like pipeline options)
 * into tool schemas at server startup. Follows SOLID principles for extensibility.
 */

/**
 * Represents a single context field with its possible values
 */
export interface SchemaContext {
  /** The field name this context applies to (e.g., 'pipeline', 'dealstage') */
  field: string;

  /** Available values for this field */
  values: Array<{
    value: string;
    label: string;
    description?: string;
  }>;

  /** Human-readable description of what this field represents */
  description?: string;

  /** Whether this field should be required in schemas */
  required?: boolean;
}

/**
 * Interface for providers that can supply dynamic context to schemas
 */
export interface ContextProvider {
  /** Domain this provider applies to (e.g., 'Deals', 'Contacts', or '*' for all) */
  readonly domain: string;

  /** Field names this provider can supply context for */
  readonly fields: string[];

  /** Human-readable name for this provider */
  readonly name: string;

  /**
   * Initialize the provider with API credentials
   * @param apiKey HubSpot API key
   * @throws Error if initialization fails and isRequired() is true
   */
  initialize(apiKey: string): Promise<void>;

  /**
   * Get all context this provider can supply
   * @returns Array of schema contexts
   */
  getContext(): SchemaContext[];

  /**
   * Get context for a specific field
   * @param field Field name
   * @returns Context for the field, or undefined if not provided
   */
  getContextForField(field: string): SchemaContext | undefined;

  /**
   * Whether server startup should fail if this provider fails to initialize
   * @returns true if required, false if optional
   */
  isRequired(): boolean;

  /**
   * Whether this provider has been successfully initialized
   * @returns true if initialized, false otherwise
   */
  isInitialized(): boolean;
}

/**
 * Base abstract class for context providers
 */
export abstract class BaseContextProvider implements ContextProvider {
  private initialized = false;

  abstract readonly domain: string;
  abstract readonly fields: string[];
  abstract readonly name: string;

  abstract initialize(apiKey: string): Promise<void>;
  abstract getContext(): SchemaContext[];
  abstract isRequired(): boolean;

  getContextForField(field: string): SchemaContext | undefined {
    if (!this.fields.includes(field)) {
      return undefined;
    }

    return this.getContext().find(ctx => ctx.field === field);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  protected setInitialized(value: boolean): void {
    this.initialized = value;
  }
}

/**
 * Error thrown when a required context provider fails to initialize
 */
export class ContextProviderError extends Error {
  constructor(
    public readonly providerName: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(`Context provider '${providerName}' failed: ${message}`);
    this.name = 'ContextProviderError';
  }
}