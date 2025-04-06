# Hubspot MCP Server

A Model Context Protocol (MCP) server that enables AI models like Claude to interact with the Hubspot CRM API. This server provides tools for managing contacts, companies, deals, and engagements in Hubspot.

## 🌟 Features

- **Contact Management**: Create, find, and retrieve contact details
- **Company Management**: Create, find, and retrieve company details
- **Deal Management**: Create and retrieve deal information
- **Engagement Tracking**: Get recent activities and company history
- **Rate Limiting**: Automatic handling of Hubspot API rate limits
- **Error Handling**: Robust error handling with user-friendly messages

## 📋 Prerequisites

- Node.js v18 or higher
- npm or yarn
- Hubspot API token with appropriate scopes

## 🚀 Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/v4lheru/hubspot-mcp.git
   cd hubspot-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with your Hubspot API token:
   ```
   HUBSPOT_ACCESS_TOKEN=your-hubspot-api-token
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Start the server:
   ```bash
   npm start
   ```

### Integration with Claude Desktop

To use the Hubspot MCP server with Claude Desktop, add the following configuration to your Claude Desktop config file (located at `%APPDATA%\Claude\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "hubspot": {
      "command": "node",
      "args": [
        "/path/to/hubspot-mcp/build/index.js"
      ],
      "env": {
        "HUBSPOT_ACCESS_TOKEN": "your-hubspot-api-token"
      }
    }
  }
}
```

Replace `/path/to/hubspot-mcp` with the actual path to your cloned repository and `your-hubspot-api-token` with your Hubspot API token.

## 🔧 Configuration

The server can be configured using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `HUBSPOT_ACCESS_TOKEN` | Hubspot API token for authentication | (Required) |
| `HUBSPOT_API_URL` | Base URL for Hubspot API | https://api.hubapi.com |
| `SERVICE_TIMEOUT` | Timeout for API requests in milliseconds | 30000 |
| `DEBUG` | Enable debug mode | false |
| `LOG_LEVEL` | Log level (debug, info, warn, error) | info |

## 🛠️ Available Tools

### Contact Tools

- **hubspot_create_contact**: Create a new contact in HubSpot
- **hubspot_get_contact**: Retrieve detailed information about a specific contact by ID
- **hubspot_find_contact_by_email**: Find a contact by their email address
- **hubspot_find_contact_by_name**: Find a contact by their name and optionally company
- **hubspot_get_recent_contacts**: Get most recently active contacts from HubSpot

### Company Tools

- **hubspot_create_company**: Create a new company in HubSpot
- **hubspot_get_company**: Retrieve detailed information about a specific company by ID
- **hubspot_find_company_by_name**: Find a company by its name
- **hubspot_find_company_by_domain**: Find a company by its domain
- **hubspot_get_company_activity**: Get activity history for a specific company
- **hubspot_get_recent_companies**: Get most recently active companies from HubSpot

### Deal Tools

- **hubspot_create_deal**: Create a new deal in HubSpot
- **hubspot_get_deal**: Retrieve detailed information about a specific deal by ID
- **hubspot_get_recent_deals**: Get most recently active deals from HubSpot

### Engagement Tools

- **hubspot_get_recent_engagements**: Get recent engagement activities across all contacts and companies
- **hubspot_get_company_activity**: Get activity history for a specific company

## 📝 Example Usage

Here are some examples of how to use the Hubspot MCP server with Claude:

### Creating a Contact

```
Create a new contact in Hubspot for John Doe with email john.doe@example.com
```

### Finding a Contact

```
Find a contact with email john.doe@example.com in Hubspot
```

### Creating a Company

```
Create a new company in Hubspot called "Acme Corp" with website acme.com
```

### Creating a Deal

```
Create a new deal in Hubspot called "Acme Corp - Enterprise Plan" with amount $10,000
```

## 🧩 Project Structure

```
src/
├── config.ts                 # Configuration management
├── index.ts                  # Entry point and server setup
├── services/                 # Service layer
│   ├── base-service.ts       # Common service functionality
│   └── hubspot-service.ts    # Hubspot API integration
├── tools/                    # Tool definitions and handlers
│   ├── contact-tools.ts      # Contact management tools
│   ├── company-tools.ts      # Company management tools
│   ├── deal-tools.ts         # Deal management tools
│   ├── engagement-tools.ts   # Engagement and activity tools
│   ├── index.ts              # Tool exports
│   └── tool-handlers.ts      # Tool implementation logic
└── types/                    # Type definitions
    └── hubspot-types.ts      # Hubspot data types
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Hubspot API Documentation](https://developers.hubspot.com/docs/api/overview)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Anthropic Claude](https://www.anthropic.com/claude)
