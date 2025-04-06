/**
 * Company Tools
 * 
 * Defines the tools related to Hubspot companies.
 * Each tool includes a name, description, and input schema.
 */

/**
 * Defines the tools related to Hubspot companies
 */
export const companyTools = [
    {
        name: "hubspot_create_company",
        description: "Create a new company in HubSpot. Checks for duplicates before creation based on company name.",
        inputSchema: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "Company name"
                },
                properties: {
                    type: "object",
                    description: "Additional company properties (e.g., domain, website, industry, etc.)"
                }
            },
            required: ["name"]
        }
    },
    {
        name: "hubspot_get_company",
        description: "Retrieve detailed information about a specific company by ID.",
        inputSchema: {
            type: "object",
            properties: {
                company_id: {
                    type: "string",
                    description: "HubSpot company ID"
                },
                properties: {
                    type: "array",
                    items: {
                        type: "string"
                    },
                    description: "Specific properties to include (optional)"
                }
            },
            required: ["company_id"]
        }
    },
    {
        name: "hubspot_find_company_by_name",
        description: "Find a company by its name.",
        inputSchema: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "Company name to search for"
                }
            },
            required: ["name"]
        }
    },
    {
        name: "hubspot_find_company_by_domain",
        description: "Find a company by its domain.",
        inputSchema: {
            type: "object",
            properties: {
                domain: {
                    type: "string",
                    description: "Domain to search for (e.g., 'example.com')"
                }
            },
            required: ["domain"]
        }
    },
    {
        name: "hubspot_get_company_activity",
        description: "Get activity history for a specific company.",
        inputSchema: {
            type: "object",
            properties: {
                company_id: {
                    type: "string",
                    description: "HubSpot company ID"
                }
            },
            required: ["company_id"]
        }
    },
    {
        name: "hubspot_get_recent_companies",
        description: "Get most recently active companies from HubSpot.",
        inputSchema: {
            type: "object",
            properties: {
                limit: {
                    type: "integer",
                    description: "Maximum number of companies to return (default: 10)"
                }
            }
        }
    }
];
