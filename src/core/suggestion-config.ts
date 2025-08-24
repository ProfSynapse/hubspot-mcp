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
  
  // Quote ID parameters
  quoteId: [
    "💡 Find quote: {operation: 'search', objectType: 'quotes', query: 'quote name'}",
    "💡 List recent quotes: {operation: 'recent', objectType: 'quotes', limit: 10}"
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
  ],
  
  // Template ID parameters
  templateId: [
    "📧 Template ID is required for HubSpot Marketing Email API v3",
    "💡 Find templates: {operation: 'list'} to see available email templates",
    "🔍 Templates must exist in HubSpot before use"
  ],
  
  // Campaign ID parameters
  campaignId: [
    "🎯 Campaign ID associates emails with marketing campaigns",
    "💡 Find campaigns: Use HubSpot Campaigns API or interface to get valid IDs",
    "📋 Campaign association is optional but recommended for organization"
  ],
  
  // Object Type parameters
  objectType: [
    "📋 Common object types: contacts, companies, deals, tickets, notes, products",
    "🔍 Use Properties domain to list/create/update custom properties for any object type",
    "⚙️ Each object type has its own set of property groups and custom fields"
  ],
  
  // Group Name parameters  
  groupName: [
    "🏗️ Property groups organize custom fields in HubSpot",
    "💡 Find groups: {operation: 'listGroups', objectType: 'contacts'} to see available groups",
    "📋 Common groups: contactinformation, companyinformation, dealinformation"
  ],
  
  // Product ID parameters
  productId: [
    "📦 Product IDs are long numeric strings in HubSpot",
    "💡 Find products: {operation: 'search', name: 'product name'} or {operation: 'list', limit: 10}",
    "🔍 Use product search if you don't have the exact ID"
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
 * Workflow pattern suggestions - show complete workflows for common use cases
 */
export const WORKFLOW_PATTERNS: Record<string, Record<string, string[]>> = {
  Contacts: {
    'contact-lookup': [
      "📋 Contact Lookup Workflow:",
      "1️⃣ {operation: 'search', objectType: 'contacts', query: 'user@domain.com'}",
      "2️⃣ If found: {operation: 'get', id: 'contact_id'} for full details",
      "3️⃣ If not found: {operation: 'create', email: 'user@domain.com', firstName: 'John', lastName: 'Doe'}"
    ],
    'contact-update': [
      "📋 Contact Update Workflow:",
      "1️⃣ {operation: 'get', id: 'contact_id'} to verify current state",
      "2️⃣ {operation: 'update', id: 'contact_id', field1: 'value1'} with changes",
      "3️⃣ {operation: 'get', id: 'contact_id'} again to verify updates"
    ]
  },
  
  Companies: {
    'company-lookup': [
      "📋 Company Lookup Workflow:",
      "1️⃣ {operation: 'search', objectType: 'companies', query: 'Acme Corp'}",
      "2️⃣ If found: {operation: 'get', id: 'company_id'} for full details", 
      "3️⃣ If not found: {operation: 'create', name: 'Acme Corp', domain: 'acme.com'}"
    ],
    'company-update': [
      "📋 Company Update Workflow:",
      "1️⃣ {operation: 'get', id: 'company_id'} to verify current state",
      "2️⃣ {operation: 'update', id: 'company_id', field1: 'value1'} with changes",
      "3️⃣ {operation: 'get', id: 'company_id'} again to verify updates"
    ]
  },
  
  Notes: {
    'note-creation': [
      "📋 Note Creation Workflow:",
      "1️⃣ Find object ID: Use Contacts/Companies/Deals domain to search for the object",
      "2️⃣ Create note: {operation: 'createContactNote', contactId: 'found_id', content: 'Note text'}",
      "3️⃣ Verify: {operation: 'listContactNotes', contactId: 'found_id'} to see the created note"
    ],
    'note-management': [
      "📋 Note Management Workflow:",
      "1️⃣ List notes: {operation: 'listContactNotes', contactId: 'contact_id'}",
      "2️⃣ Get details: {operation: 'get', noteId: 'note_id'} for specific note",
      "3️⃣ Update note: {operation: 'update', noteId: 'note_id', content: 'Updated text'}"
    ]
  },
  
  Properties: {
    'custom-properties': [
      "📋 Custom Properties Workflow:",
      "1️⃣ List existing: {operation: 'list', objectType: 'contacts'} to see available properties",
      "2️⃣ List groups: {operation: 'listGroups', objectType: 'contacts'} to find valid group names",
      "3️⃣ Create property: {operation: 'create', objectType: 'contacts', name: 'custom_field', label: 'Custom Field', groupName: 'contactinformation', type: 'string', fieldType: 'text'}",
      "4️⃣ Use in objects: Include custom property in create/update operations"
    ],
    'property-groups': [
      "🏗️ Property Groups Workflow:",
      "1️⃣ List groups: {operation: 'listGroups', objectType: 'companies'} to see existing groups",
      "2️⃣ Create group: {operation: 'createGroup', objectType: 'companies', name: 'custom_section', displayName: 'Custom Section'}",
      "3️⃣ Update group: {operation: 'updateGroup', objectType: 'companies', groupName: 'custom_section', displayName: 'Updated Name'}"
    ]
  },
  
  Quotes: {
    'quote-management': [
      "📋 Quote Management Workflow:",
      "1️⃣ Create quote: {operation: 'create', title: 'Quote Name', dealId: 'deal_id'}",
      "2️⃣ Add line items: {operation: 'addLineItem', quoteId: 'quote_id', name: 'Product Name', price: 100}",
      "3️⃣ Update status: {operation: 'update', id: 'quote_id', status: 'APPROVED'}"
    ],
    'line-item-management': [
      "📋 Line Item Workflow:",
      "1️⃣ Add item: {operation: 'addLineItem', quoteId: 'quote_id', name: 'Item Name', quantity: 1, price: 100}",
      "2️⃣ Update item: {operation: 'updateLineItem', lineItemId: 'item_id', quantity: 2}",
      "3️⃣ Remove item: {operation: 'removeLineItem', lineItemId: 'item_id'}"
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
  ],
  
  Quotes: [
    "💼 Quotes are typically associated with deals and contacts",
    "📋 Use line item operations to add products and services to quotes",
    "🔍 Search for existing products using the Products domain before adding line items"
  ],
  
  BlogPosts: [
    "📝 Blog posts are automatically saved as drafts to prevent accidental publishing",
    "📋 Use list operations to find contentGroupId values for blog creation",
    "🔍 Blog posts support slug customization and SEO meta descriptions"
  ],
  
  Emails: [
    "📧 Template ID is required for HubSpot Marketing Email API v3 - you must use an existing template",
    "📋 Use list operations to find available templates before creating emails",
    "🎯 Campaign ID and email type parameters are now supported for better organization",
    "⚡ Updates now work correctly with the v3 API structure"
  ],
  
  Properties: [
    "🏗️ Properties must be associated with a valid property group - use listGroups to see available options",
    "📋 Common object types: contacts, companies, deals, tickets, notes, products",
    "🔧 Property names must be unique, lowercase, and contain no spaces",
    "⚙️ Property groups help organize custom fields in HubSpot forms and records"
  ],
  
  Products: [
    "📦 Products are used in quotes, line items, and e-commerce integrations",
    "💰 Product properties include name, price, SKU, and description",
    "🔍 Use search operations to find products by name if you don't have the ID",
    "📋 Product IDs are typically long numeric strings in HubSpot"
  ]
};