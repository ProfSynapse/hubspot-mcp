# HubSpot BCP Server

A Model Context Protocol server for HubSpot integration using the Bounded Context Packs pattern.

## Features

- **BCP Architecture**: Tools are organized into Bounded Context Packs
- **Simplified Integration**: Single tool per domain with operation parameter
- **Type Safety**: Full TypeScript support with comprehensive types
- **Error Handling**: Consistent error handling across all operations

## Available Tools

### hubspotCompany
- **Operations**: create, get, update, delete, search, recent
- **Examples**:
  - Create: `hubspotCompany({ operation: "create", name: "Acme Inc", domain: "acme.com" })`
  - Get: `hubspotCompany({ operation: "get", id: "123456" })`
  - Search: `hubspotCompany({ operation: "search", searchType: "domain", searchTerm: "acme.com" })`

### hubspotContact
- **Operations**: create, get, update, delete, search, recent
- **Examples**:
  - Create: `hubspotContact({ operation: "create", email: "john@example.com", firstName: "John", lastName: "Doe" })`
  - Get: `hubspotContact({ operation: "get", id: "123456" })`
  - Search: `hubspotContact({ operation: "search", searchType: "email", searchTerm: "john@example.com" })`

### hubspotBlogPost
- **Operations**: create, get, update, delete, search, recent, publish, schedule
- **Examples**:
  - Create: `hubspotBlogPost({ operation: "create", name: "My Blog Post", contentGroupId: "12345", postBody: "<p>Content here</p>" })`
  - Get: `hubspotBlogPost({ operation: "get", id: "123456" })`
  - Publish: `hubspotBlogPost({ operation: "publish", id: "123456" })`
  - Schedule: `hubspotBlogPost({ operation: "schedule", id: "123456", publishDate: "2025-05-01T10:00:00Z" })`

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure Claude Desktop:
   - Add your HubSpot access token to the Claude Desktop config

3. Build the project:
   ```bash
   npm run build
   ```

4. Start the server:
   ```bash
   npm start
   ```

## Claude Desktop Configuration

Add this to your Claude Desktop config:

```json
{
  "mcpServers": {
    "hubspot": {
      "command": "node",
      "args": ["./build/index.js"],
      "env": {
        "HUBSPOT_ACCESS_TOKEN": "your_access_token_here"
      }
    }
  }
}
```

## Project Structure

```
src/
  ├── core/             # Core server and shared types
  │   ├── types.ts      # Type definitions
  │   ├── hubspot-client.ts # HubSpot API client
  │   └── server.ts     # MCP server implementation
  ├── bcps/             # Bounded Context Packs
  │   ├── Companies/    # Companies BCP
  │   │   ├── create.tool.ts
  │   │   ├── get.tool.ts
  │   │   ├── update.tool.ts
  │   │   ├── delete.tool.ts
  │   │   ├── search.tool.ts
  │   │   ├── recent.tool.ts
  │   │   └── index.ts  # BCP definition
  │   ├── Contacts/     # Contacts BCP
  │   │   ├── create.tool.ts
  │   │   ├── get.tool.ts
  │   │   ├── update.tool.ts
  │   │   ├── delete.tool.ts
  │   │   ├── search.tool.ts
  │   │   ├── recent.tool.ts
  │   │   └── index.ts  # BCP definition
  │   └── BlogPosts/    # BlogPosts BCP
  │       ├── create.tool.ts
  │       ├── get.tool.ts
  │       ├── update.tool.ts
  │       ├── delete.tool.ts
  │       ├── search.tool.ts
  │       ├── recent.tool.ts
  │       ├── publish.tool.ts
  │       ├── schedule.tool.ts
  │       └── index.ts  # BCP definition
  └── index.ts          # Entry point
```

## BCP Architecture

This project follows the Bounded Context Packs (BCP) pattern for MCP servers:

1. **Simplified Tool Registration**: Each domain has a single tool with an operation parameter
2. **Modular Structure**: Each BCP is self-contained in its own directory
3. **Clean Separation**: BCPs don't depend on each other
4. **Focused Tools**: Each tool file handles a single operation

## License

MIT License
