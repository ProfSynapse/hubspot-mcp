/**
 * Response Enhancer Utility
 * 
 * Adds contextual workflow suggestions to tool responses based on parameters
 * and operations to help users navigate between related tools and domains.
 */

import { PARAMETER_SUGGESTIONS, WORKFLOW_SUGGESTIONS, DOMAIN_SUGGESTIONS } from './suggestion-config.js';

/**
 * Enhanced response with contextual suggestions
 */
export interface EnhancedResponse {
  success?: boolean;
  data?: any;
  message?: string;
  suggestions?: string[];
  [key: string]: any;
}

/**
 * Enhances a tool response with contextual suggestions based on:
 * - Parameters used (to suggest related operations)
 * - Operation performed (to suggest workflow steps)
 * - Domain context (to suggest cross-domain operations)
 * 
 * @param result - Original tool response
 * @param operation - Operation name that was performed
 * @param params - Parameters that were used
 * @param domain - Optional domain context
 * @returns Enhanced response with suggestions array
 */
export function enhanceResponse(
  result: any, 
  operation: string, 
  params: Record<string, any>,
  domain?: string
): EnhancedResponse {
  const suggestions: string[] = [];
  
  // Add parameter-based suggestions
  // These help users find IDs they might not have
  Object.keys(params).forEach(param => {
    if (PARAMETER_SUGGESTIONS[param]) {
      suggestions.push(...PARAMETER_SUGGESTIONS[param]);
    }
  });
  
  // Add workflow-based suggestions
  // These guide users through common operation sequences
  if (WORKFLOW_SUGGESTIONS[operation]) {
    suggestions.push(...WORKFLOW_SUGGESTIONS[operation]);
  }
  
  // Add domain-specific suggestions
  // These provide context about the domain being used
  if (domain && DOMAIN_SUGGESTIONS[domain]) {
    suggestions.push(...DOMAIN_SUGGESTIONS[domain]);
  }
  
  // Remove duplicates and limit to most relevant suggestions
  const uniqueSuggestions = Array.from(new Set(suggestions));
  const limitedSuggestions = uniqueSuggestions.slice(0, 5); // Max 5 suggestions
  
  // Return enhanced response
  if (limitedSuggestions.length > 0) {
    return {
      ...result,
      suggestions: limitedSuggestions
    };
  }
  
  return result;
}

/**
 * Convenience function for Notes domain operations
 */
export function enhanceNotesResponse(
  result: any,
  operation: string,
  params: Record<string, any>
): EnhancedResponse {
  return enhanceResponse(result, operation, params, 'Notes');
}

/**
 * Convenience function for Contacts domain operations
 */
export function enhanceContactsResponse(
  result: any,
  operation: string,
  params: Record<string, any>
): EnhancedResponse {
  return enhanceResponse(result, operation, params, 'Contacts');
}

/**
 * Convenience function for Companies domain operations
 */
export function enhanceCompaniesResponse(
  result: any,
  operation: string,
  params: Record<string, any>
): EnhancedResponse {
  return enhanceResponse(result, operation, params, 'Companies');
}

/**
 * Convenience function for Deals domain operations
 */
export function enhanceDealsResponse(
  result: any,
  operation: string,
  params: Record<string, any>
): EnhancedResponse {
  return enhanceResponse(result, operation, params, 'Deals');
}