/**
 * Response Enhancer Utility
 * 
 * Adds contextual workflow suggestions to tool responses based on parameters
 * and operations to help users navigate between related tools and domains.
 */

import { PARAMETER_SUGGESTIONS, WORKFLOW_SUGGESTIONS, DOMAIN_SUGGESTIONS, ERROR_SUGGESTIONS, METADATA_SUGGESTIONS, DOMAIN_CONFUSION_PATTERNS, WORKFLOW_PATTERNS } from './suggestion-config.js';

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
 * - Error context (to suggest fixes for common errors)
 * 
 * @param result - Original tool response
 * @param operation - Operation name that was performed
 * @param params - Parameters that were used
 * @param domain - Optional domain context
 * @param error - Optional error information for error-specific suggestions
 * @returns Enhanced response with suggestions array
 */
export function enhanceResponse(
  result: any, 
  operation: string, 
  params: Record<string, any>,
  domain?: string,
  error?: Error
): EnhancedResponse {
  const suggestions: string[] = [];
  
  // Add error-specific suggestions first (highest priority)
  if (error) {
    const errorMessage = error.message || '';
    
    // Check for property validation errors
    if (errorMessage.includes('PROPERTY_DOESNT_EXIST') || errorMessage.includes('Property') && errorMessage.includes('does not exist')) {
      suggestions.push(...ERROR_SUGGESTIONS.PROPERTY_DOESNT_EXIST);
    }
    
    // Check for invalid object ID errors
    if (errorMessage.includes('INVALID_OBJECT_ID') || errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      suggestions.push(...ERROR_SUGGESTIONS.INVALID_OBJECT_ID);
    }
    
    // Check for missing required property errors
    if (errorMessage.includes('required') && errorMessage.includes('missing')) {
      suggestions.push(...ERROR_SUGGESTIONS.MISSING_REQUIRED_PROPERTY);
    }
    
    // Check for invalid email errors
    if (errorMessage.includes('email') && errorMessage.includes('invalid')) {
      suggestions.push(...ERROR_SUGGESTIONS.INVALID_EMAIL);
    }
  }
  
  // Add cross-domain confusion detection (highest priority for user experience)
  if (domain && DOMAIN_CONFUSION_PATTERNS[domain]) {
    const confusionPatterns = DOMAIN_CONFUSION_PATTERNS[domain];
    
    // Check for objectType confusion (using Properties domain to list object data)
    if (params.objectType) {
      const confusionKey = `${params.objectType}-objectType`;
      if (confusionPatterns[confusionKey]) {
        suggestions.push(...confusionPatterns[confusionKey]);
      }
    }
  }
  
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
  
  // Add workflow pattern suggestions for common use cases
  if (domain && WORKFLOW_PATTERNS[domain]) {
    const patterns = WORKFLOW_PATTERNS[domain];
    
    // Show workflow patterns based on operation context
    if ((operation === 'search' || operation === 'get') && patterns['contact-lookup'] && domain === 'Contacts') {
      suggestions.push(...patterns['contact-lookup']);
    } else if ((operation === 'search' || operation === 'get') && patterns['company-lookup'] && domain === 'Companies') {
      suggestions.push(...patterns['company-lookup']);
    } else if (operation === 'update' && patterns['contact-update'] && domain === 'Contacts') {
      suggestions.push(...patterns['contact-update']);
    } else if (operation === 'update' && patterns['company-update'] && domain === 'Companies') {
      suggestions.push(...patterns['company-update']);
    } else if ((operation.includes('create') || operation.includes('Note')) && patterns['note-creation'] && domain === 'Notes') {
      suggestions.push(...patterns['note-creation']);
    } else if ((operation === 'list' || operation === 'get') && patterns['note-management'] && domain === 'Notes') {
      suggestions.push(...patterns['note-management']);
    } else if ((operation === 'list' || operation === 'create') && patterns['custom-properties'] && domain === 'Properties') {
      suggestions.push(...patterns['custom-properties']);
    } else if ((operation === 'listGroups' || operation === 'createGroup' || operation === 'updateGroup') && patterns['property-groups'] && domain === 'Properties') {
      suggestions.push(...patterns['property-groups']);
    } else if ((operation === 'create' || operation === 'update' || operation === 'addLineItem') && patterns['quote-management'] && domain === 'Quotes') {
      suggestions.push(...patterns['quote-management']);
    } else if ((operation === 'addLineItem' || operation === 'updateLineItem' || operation === 'removeLineItem') && patterns['line-item-management'] && domain === 'Quotes') {
      suggestions.push(...patterns['line-item-management']);
    }
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

/**
 * Enhanced error response with contextual suggestions for fixing the error
 */
export function enhanceErrorResponse(
  error: Error,
  operation: string,
  params: Record<string, any>,
  domain?: string
): EnhancedResponse {
  const errorResponse = {
    success: false,
    error: error.message,
    message: `Failed to execute ${operation}`
  };
  
  return enhanceResponse(errorResponse, operation, params, domain, error);
}