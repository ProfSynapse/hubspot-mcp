/**
 * Deal Tools
 * 
 * Defines the tools related to Hubspot deals.
 * Each tool includes a name, description, and input schema.
 */

/**
 * Defines the tools related to Hubspot deals
 */
export const dealTools = [
    {
        name: "hubspot_create_deal",
        description: "Create a new deal in HubSpot.",
        inputSchema: {
            type: "object",
            properties: {
                dealname: {
                    type: "string",
                    description: "Name of the deal"
                },
                amount: {
                    type: "string",
                    description: "Deal amount (as string)"
                },
                dealstage: {
                    type: "string",
                    description: "Deal stage (e.g., 'appointmentscheduled', 'qualifiedtobuy', etc.)"
                },
                pipeline: {
                    type: "string",
                    description: "Pipeline ID"
                },
                closedate: {
                    type: "string",
                    description: "Close date (YYYY-MM-DD format)"
                },
                properties: {
                    type: "object",
                    description: "Additional deal properties"
                },
                associations: {
                    type: "object",
                    properties: {
                        contactIds: {
                            type: "array",
                            items: {
                                type: "string"
                            },
                            description: "Contact IDs to associate with the deal"
                        },
                        companyIds: {
                            type: "array",
                            items: {
                                type: "string"
                            },
                            description: "Company IDs to associate with the deal"
                        }
                    },
                    description: "Associations with contacts and companies"
                }
            },
            required: ["dealname"]
        }
    },
    {
        name: "hubspot_get_deal",
        description: "Retrieve detailed information about a specific deal by ID.",
        inputSchema: {
            type: "object",
            properties: {
                deal_id: {
                    type: "string",
                    description: "HubSpot deal ID"
                },
                properties: {
                    type: "array",
                    items: {
                        type: "string"
                    },
                    description: "Specific properties to include (optional)"
                }
            },
            required: ["deal_id"]
        }
    },
    {
        name: "hubspot_get_recent_deals",
        description: "Get most recently active deals from HubSpot.",
        inputSchema: {
            type: "object",
            properties: {
                limit: {
                    type: "integer",
                    description: "Maximum number of deals to return (default: 10)"
                }
            }
        }
    }
];
