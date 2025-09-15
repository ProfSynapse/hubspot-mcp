/**
 * Context Module - Dynamic Schema Context Injection
 *
 * Exports all context-related types, classes, and providers for
 * dynamic schema context injection.
 */

// Core types and interfaces
export type {
  SchemaContext,
  ContextProvider
} from './types.js';
export {
  BaseContextProvider,
  ContextProviderError
} from './types.js';

// Registry
export { ContextRegistry } from './registry.js';

// Providers
export { DealPipelineContextProvider } from './providers/deal-pipeline.provider.js';