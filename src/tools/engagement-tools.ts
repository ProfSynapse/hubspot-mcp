/**
 * Engagement Tools
 * 
 * Defines the tools related to Hubspot engagements (activities, notes, emails, etc.).
 * Each tool includes a name, description, and input schema.
 */

/**
 * Defines the tools related to Hubspot engagements
 */
export const engagementTools = [
    {
        name: "hubspot_get_recent_engagements",
        description: "Get recent engagement activities across all contacts and companies.",
        inputSchema: {
            type: "object",
            properties: {
                days: {
                    type: "integer",
                    description: "Number of days to look back (default: 7)"
                },
                limit: {
                    type: "integer",
                    description: "Maximum number of engagements to return (default: 50)"
                }
            }
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
    }
];
