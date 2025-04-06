/**
 * Contact Tools
 * 
 * Defines the tools related to Hubspot contacts.
 * Each tool includes a name, description, and input schema.
 */

/**
 * Defines the tools related to Hubspot contacts
 */
export const contactTools = [
    {
        name: "hubspot_create_contact",
        description: "Create a new contact in HubSpot. Checks for duplicates before creation based on first name, last name, and company (if provided).",
        inputSchema: {
            type: "object",
            properties: {
                firstname: {
                    type: "string",
                    description: "Contact's first name"
                },
                lastname: {
                    type: "string",
                    description: "Contact's last name"
                },
                email: {
                    type: "string",
                    description: "Contact's email address"
                },
                properties: {
                    type: "object",
                    description: "Additional contact properties (e.g., phone, company, jobtitle, etc.)"
                }
            },
            required: ["firstname", "lastname"]
        }
    },
    {
        name: "hubspot_get_contact",
        description: "Retrieve detailed information about a specific contact by ID.",
        inputSchema: {
            type: "object",
            properties: {
                contact_id: {
                    type: "string",
                    description: "HubSpot contact ID"
                },
                properties: {
                    type: "array",
                    items: {
                        type: "string"
                    },
                    description: "Specific properties to include (optional)"
                }
            },
            required: ["contact_id"]
        }
    },
    {
        name: "hubspot_find_contact_by_email",
        description: "Find a contact by their email address.",
        inputSchema: {
            type: "object",
            properties: {
                email: {
                    type: "string",
                    description: "Email address to search for"
                }
            },
            required: ["email"]
        }
    },
    {
        name: "hubspot_find_contact_by_name",
        description: "Find a contact by their name and optionally company.",
        inputSchema: {
            type: "object",
            properties: {
                firstname: {
                    type: "string",
                    description: "Contact's first name"
                },
                lastname: {
                    type: "string",
                    description: "Contact's last name"
                },
                company: {
                    type: "string",
                    description: "Company name (optional)"
                }
            },
            required: ["firstname", "lastname"]
        }
    },
    {
        name: "hubspot_get_recent_contacts",
        description: "Get most recently active contacts from HubSpot.",
        inputSchema: {
            type: "object",
            properties: {
                limit: {
                    type: "integer",
                    description: "Maximum number of contacts to return (default: 10)"
                }
            }
        }
    }
];
