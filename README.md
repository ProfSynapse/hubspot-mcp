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

### hubspotDeal
- **Operations**: create, get, update, delete, search, recent, batchCreate, batchUpdate
- **Examples**:
  - Create: `hubspotDeal({ operation: "create", dealname: "New Deal", pipeline: "default", dealstage: "appointmentscheduled", amount: "50000" })`
  - Get: `hubspotDeal({ operation: "get", id: "123456" })`
  - Search: `hubspotDeal({ operation: "search", searchType: "name", query: "Acme" })`

### hubspotNote
- **Operations**: create, get, update, delete, list, recent
- **Examples**:
  - Create: `hubspotNote({ operation: "create", content: "Meeting notes from call with client" })`
  - Get: `hubspotNote({ operation: "get", id: "123456" })`
  - List: `hubspotNote({ operation: "list", limit: 10 })`

### hubspotAssociation
- **Operations**: create, createDefault, delete, list, batchCreate, batchCreateDefault, batchDelete, batchRead, deleteLabels, getAssociationTypes, getAssociationTypeReference
- **Examples**:
  - Create: `hubspotAssociation({ operation: "createDefault", fromObjectType: "contacts", fromObjectId: "123", toObjectType: "companies", toObjectId: "456" })`
  - List: `hubspotAssociation({ operation: "list", objectType: "contacts", objectId: "123", toObjectType: "companies" })`

### hubspotBlogPost
- **Operations**: create, get, update, delete, recent
- **Examples**:
  - Create: `hubspotBlogPost({ operation: "create", name: "My Blog Post", contentGroupId: "12345", postBody: "<p>Content here</p>" })`
  - Get: `hubspotBlogPost({ operation: "get", id: "123456" })`
  - Update: `hubspotBlogPost({ operation: "update", id: "123456", name: "Updated Title" })`

### hubspotQuote
- **Operations**: create, get, update, delete, search, recent, addLineItem, listLineItems, updateLineItem, removeLineItem
- **Examples**:
  - Create: `hubspotQuote({ operation: "create", title: "Q-2024-001", expirationDate: "2024-12-31", status: "DRAFT" })`
  - Get: `hubspotQuote({ operation: "get", id: "123456" })`
  - Search by status: `hubspotQuote({ operation: "search", searchType: "status", searchTerm: "DRAFT" })`
  - Update: `hubspotQuote({ operation: "update", id: "123456", status: "PENDING_APPROVAL" })`
  - Add line item: `hubspotQuote({ operation: "addLineItem", quoteId: "123456", name: "Product A", quantity: 2, price: 99.99 })`
  - List line items: `hubspotQuote({ operation: "listLineItems", quoteId: "123456" })`
  - Update line item: `hubspotQuote({ operation: "updateLineItem", lineItemId: "789", quantity: 3, discount: 10 })`
  - Remove line item: `hubspotQuote({ operation: "removeLineItem", quoteId: "123456", lineItemId: "789" })`

### hubspotSocialMedia
- **Operations**: getBroadcastMessages, getBroadcastMessage, createBroadcastMessage, updateBroadcastMessage, deleteBroadcastMessage, getChannels
- **Examples**:
  - Get messages: `hubspotSocialMedia({ operation: "getBroadcastMessages", status: "PUBLISHED", limit: 20 })`
  - Get message: `hubspotSocialMedia({ operation: "getBroadcastMessage", broadcastGuid: "abc123" })`
  - Create message: `hubspotSocialMedia({ operation: "createBroadcastMessage", body: "Check out our new product!", channelKeys: ["channel-guid"] })`
  - Update message: `hubspotSocialMedia({ operation: "updateBroadcastMessage", broadcastGuid: "abc123", body: "Updated message" })`
  - Delete message: `hubspotSocialMedia({ operation: "deleteBroadcastMessage", broadcastGuid: "abc123" })`
  - Get channels: `hubspotSocialMedia({ operation: "getChannels", limit: 10 })`

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
  ├── core/                # Core server and shared types
  │   ├── types.ts         # Type definitions
  │   ├── base-service.ts  # Base service class
  │   ├── hubspot-client.ts# HubSpot API client
  │   └── server.ts        # MCP server implementation
  ├── bcps/                # Bounded Context Packs
  │   ├── Companies/       # Companies BCP
  │   ├── Contacts/        # Contacts BCP
  │   ├── Deals/           # Deals BCP
  │   ├── Notes/           # Notes BCP
  │   ├── Associations/    # Associations BCP
  │   ├── BlogPosts/       # BlogPosts BCP
  │   ├── Quotes/          # Quotes BCP
  │   └── SocialMedia/     # Social Media BCP
  │       ├── types.ts
  │       ├── socialmedia.service.ts
  │       ├── get-broadcast-messages.tool.ts
  │       ├── get-broadcast-message.tool.ts
  │       ├── create-broadcast-message.tool.ts
  │       ├── update-broadcast-message.tool.ts
  │       ├── delete-broadcast-message.tool.ts
  │       ├── get-channels.tool.ts
  │       └── index.ts
  └── index.ts             # Entry point
```

## BCP Architecture

This project follows the Bounded Context Packs (BCP) pattern for MCP servers:

1. **Simplified Tool Registration**: Each domain has a single tool with an operation parameter
2. **Modular Structure**: Each BCP is self-contained in its own directory
3. **Clean Separation**: BCPs don't depend on each other
4. **Focused Tools**: Each tool file handles a single operation

## License

MIT License
