# HubSpot BCP Server

A comprehensive Model Context Protocol server for HubSpot integration using the Bounded Context Packs pattern. This server provides complete access to HubSpot's CRM functionality including advanced features like quote management with line items and product integration.

## ✨ Features

- **🏗️ BCP Architecture**: Tools are organized into Bounded Context Packs for modular, maintainable code
- **🔧 Simplified Integration**: Single tool per domain with operation parameter for easy use
- **🛡️ Type Safety**: Full TypeScript support with comprehensive types and validation
- **🚨 Error Handling**: Consistent error handling across all operations with detailed debugging
- **💰 Quote Management**: Complete quote lifecycle management with line items support
- **📦 Product Integration**: Full product catalog integration with line item associations
- **📧 Email Marketing**: Complete marketing email management with CRUD operations
- **🔗 Advanced Associations**: Comprehensive CRM object association management using HubSpot's v4 API
- **⚡ Performance Optimized**: Built with modern Node.js and optimized API calls

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

### hubspotQuote ⭐ **Fully Featured**
- **Operations**: create, get, update, delete, search, recent, addLineItem, listLineItems, updateLineItem, removeLineItem
- **✨ Advanced Features**: 
  - Complete quote lifecycle management
  - Line item associations with automatic total calculation
  - Product catalog integration
  - Multi-currency support
  - E-signature and payment collection options
- **Examples**:
  - Create quote: `hubspotQuote({ operation: "create", title: "Q-2025-001", expirationDate: "2025-12-31", status: "DRAFT", currency: "USD", language: "en" })`
  - Get quote: `hubspotQuote({ operation: "get", id: "123456" })`
  - Search by status: `hubspotQuote({ operation: "search", searchType: "status", searchTerm: "DRAFT" })`
  - Update quote: `hubspotQuote({ operation: "update", id: "123456", status: "PENDING_APPROVAL" })`
  - **Line Item Management**:
    - Add with product: `hubspotQuote({ operation: "addLineItem", quoteId: "123456", name: "Laptop", quantity: 2, price: 999.99, productId: "12345", description: "MacBook Pro" })`
    - Add custom item: `hubspotQuote({ operation: "addLineItem", quoteId: "123456", name: "Consulting", quantity: 10, price: 150.00, description: "Technical consulting hours" })`
    - List all items: `hubspotQuote({ operation: "listLineItems", quoteId: "123456" })`
    - Update item: `hubspotQuote({ operation: "updateLineItem", lineItemId: "789", quantity: 3, price: 899.99, discount: 100 })`
    - Remove item: `hubspotQuote({ operation: "removeLineItem", quoteId: "123456", lineItemId: "789" })`

### hubspotProduct 🆕 **New Feature**
- **Operations**: list, search, get
- **Features**: Complete product catalog access for line item integration
- **Examples**:
  - List products: `hubspotProduct({ operation: "list", limit: 20 })`
  - Search products: `hubspotProduct({ operation: "search", name: "laptop" })`
  - Get product details: `hubspotProduct({ operation: "get", id: "12345" })`

### hubspotEmail ⭐ **Latest Addition**
- **Operations**: create, get, update, delete, list, recent
- **✨ Features**: 
  - Complete marketing email management using HubSpot's Marketing Email API v3
  - CRUD operations for email creation, editing, and organization
  - Advanced filtering by state, type, and date ranges
  - Email content management (subject, preview text, sender information)
  - Template-based email creation support
  - **Note**: Email sending functionality is intentionally excluded for security
- **Examples**:
  - Create email: `hubspotEmail({ operation: "create", name: "Newsletter Q1 2025", subject: "Welcome to our newsletter" })`
  - Get email: `hubspotEmail({ operation: "get", id: "123456" })`
  - Update email: `hubspotEmail({ operation: "update", id: "123456", subject: "Updated Subject Line" })`
  - List emails: `hubspotEmail({ operation: "list", state: "DRAFT", limit: 10 })`
  - Filter by date: `hubspotEmail({ operation: "list", createdAfter: "2025-01-01", createdBefore: "2025-12-31" })`
  - Recent emails: `hubspotEmail({ operation: "recent", limit: 5 })`
  - Delete email: `hubspotEmail({ operation: "delete", id: "123456" })`


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
  │   ├── Emails/          # Emails BCP
  │   └── Products/        # Products BCP
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
