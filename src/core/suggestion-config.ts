/**
 * Suggestion Configuration
 * 
 * Centralized configuration for contextual workflow suggestions that help users
 * navigate between related operations across different BCPs.
 */

/**
 * Parameter-based suggestions - shown when specific parameters are detected
 */
export const PARAMETER_SUGGESTIONS: Record<string, string[]> = {
  // Contact ID parameters
  contactId: [
    "💡 Find contact: {operation: 'search', objectType: 'contacts', query: 'user@company.com'}",
    "💡 List recent contacts: {operation: 'recent', objectType: 'contacts', limit: 10}"
  ],
  
  // Company ID parameters
  companyId: [
    "💡 Find company: {operation: 'search', objectType: 'companies', query: 'Company Name'}",
    "💡 List recent companies: {operation: 'recent', objectType: 'companies', limit: 10}"
  ],
  
  // Deal ID parameters
  dealId: [
    "💡 Find deal: {operation: 'search', objectType: 'deals', query: 'deal name'}",
    "💡 List recent deals: {operation: 'recent', objectType: 'deals', limit: 10}"
  ],
  
  // Note ID parameters
  noteId: [
    "💡 List notes for contact: {operation: 'listContactNotes', contactId: 'contact_id'}",
    "💡 List notes for company: {operation: 'listCompanyNotes', companyId: 'company_id'}"
  ],
  
  // Owner ID parameters
  ownerId: [
    "💡 Get your user ID from HubSpot account settings or use the current user's ID"
  ]
};

/**
 * Workflow-based suggestions - shown for specific operations
 */
export const WORKFLOW_SUGGESTIONS: Record<string, string[]> = {
  // Create operations
  createContactNote: [
    "🔄 Workflow: First search for the contact, then create the note with the found contactId"
  ],
  createCompanyNote: [
    "🔄 Workflow: First search for the company, then create the note with the found companyId"
  ],
  createDealNote: [
    "🔄 Workflow: First search for the deal, then create the note with the found dealId"
  ],
  
  // Update operations
  update: [
    "🔄 Workflow: Get the current state first to see what fields are available to update"
  ],
  
  // Get operations
  get: [
    "🔄 Workflow: If you don't have the ID, use list operations to find the item first"
  ],
  
  // List operations with associations
  listContactNotes: [
    "📋 Related: Use 'get' operation with a noteId from the results to see full note details"
  ],
  listCompanyNotes: [
    "📋 Related: Use 'get' operation with a noteId from the results to see full note details"
  ],
  listDealNotes: [
    "📋 Related: Use 'get' operation with a noteId from the results to see full note details"
  ]
};

/**
 * Domain-specific suggestions - shown based on the domain being used
 */
export const DOMAIN_SUGGESTIONS: Record<string, string[]> = {
  Notes: [
    "📝 Notes are always associated with contacts, companies, or deals",
    "🔍 Use search operations in other domains to find the correct IDs before creating notes"
  ],
  
  Contacts: [
    "👥 Contact search supports email addresses, names, and company domains",
    "📝 Create notes for contacts using the Notes domain operations"
  ],
  
  Companies: [
    "🏢 Company search supports company names and domains",
    "📝 Create notes for companies using the Notes domain operations"
  ],
  
  Deals: [
    "💰 Deal search supports deal names and pipeline stages",
    "📝 Create notes for deals using the Notes domain operations"
  ]
};