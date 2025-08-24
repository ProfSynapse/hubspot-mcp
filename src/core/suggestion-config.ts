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
  ],
  
  // Metadata parameters
  metadata: [
    "🏷️ Metadata uses custom properties - ensure they exist in HubSpot first",
    "🔍 List valid properties: Use Properties domain with objectType matching your object type",
    "⚙️ Create custom properties in HubSpot Settings > Properties first"
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
 * Error-specific suggestions - shown when specific errors occur
 */
export const ERROR_SUGGESTIONS: Record<string, string[]> = {
  PROPERTY_DOESNT_EXIST: [
    "🔍 List valid properties: {operation: 'list', objectType: 'notes'}",
    "📋 Use Properties domain to see all available custom properties",
    "💡 Standard note properties: 'hs_note_body', 'hs_timestamp', 'hubspot_owner_id'",
    "⚠️ Custom properties must be created in HubSpot settings first"
  ],
  
  INVALID_OBJECT_ID: [
    "🔍 Search for the correct ID first using search operations",
    "💡 HubSpot IDs are typically 8+ digit numbers",
    "📋 Use recent operations to find valid object IDs"
  ],
  
  MISSING_REQUIRED_PROPERTY: [
    "📋 Check required properties: {operation: 'get', objectType: 'properties'}",
    "💡 Common required fields: email (contacts), name (companies), dealname (deals)"
  ],
  
  INVALID_EMAIL: [
    "📧 Use valid email format: user@domain.com",
    "🔍 Search existing contacts to avoid duplicates"
  ]
};

/**
 * Metadata-specific suggestions - shown when metadata parameter is used
 */
export const METADATA_SUGGESTIONS: string[] = [
  "🏷️ Metadata uses custom properties - ensure they exist in HubSpot first",
  "🔍 List note properties: Use Properties domain with objectType: 'notes'",
  "⚙️ Create custom properties in HubSpot Settings > Properties > Notes",
  "📝 Standard note properties don't need to be in metadata - use direct parameters"
];

/**
 * Cross-domain confusion patterns - detect when users are using wrong domain
 */
export const DOMAIN_CONFUSION_PATTERNS: Record<string, Record<string, string[]>> = {
  Properties: {
    // When using Properties domain but trying to work with object data
    'notes-objectType': [
      "🔄 To list notes: Use Notes domain with {operation: 'listContactNotes', contactId: 'contact_id'}",
      "📋 Properties domain lists property schemas, not object data",
      "💡 For note data: Use Notes domain operations instead"
    ],
    'contacts-objectType': [
      "🔄 To list contacts: Use Contacts domain with {operation: 'recent', limit: 10}",
      "📋 Properties domain lists property schemas, not contact data"
    ],
    'companies-objectType': [
      "🔄 To list companies: Use Companies domain with {operation: 'recent', limit: 10}",
      "📋 Properties domain lists property schemas, not company data"
    ],
    'deals-objectType': [
      "🔄 To list deals: Use Deals domain with {operation: 'recent', limit: 10}",
      "📋 Properties domain lists property schemas, not deal data"
    ]
  }
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