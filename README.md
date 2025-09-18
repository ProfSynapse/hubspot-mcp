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

### hubspotActivityHistory 🆕 **Activity Tracking**
- **Operations**: recent, search
- **✨ Features**:
  - Track all MCP tool calls and store them in PostgreSQL
  - View your recent activity across all HubSpot operations
  - Search activity history by domain, operation, and time period
  - See what you did, when you did it, and what the results were
- **Examples**:
  - Recent activity: `hubspotActivityHistory({ operation: "recent", days: 7 })`
  - Search by domain: `hubspotActivityHistory({ operation: "search", domain: "Companies", days: 14 })`
  - Search by operation: `hubspotActivityHistory({ operation: "search", operation: "create", days: 30 })`


## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. **Set up PostgreSQL Database** (for activity tracking):
   - The server will automatically create the required `activity_logs` table
   - Provide a `DATABASE_URL` environment variable pointing to your PostgreSQL instance

3. Build the project:
   ```bash
   npm run build
   ```

4. Start the server:
   ```bash
   HUBSPOT_ACCESS_TOKEN=your_token DATABASE_URL=your_db_url npm start
   ```

## Railway Deployment Setup

### 1. Database Setup
1. **Add PostgreSQL Service**:
   - In your Railway project, click "New Service"
   - Select "Database" → "PostgreSQL"
   - Railway will provision a new PostgreSQL instance

2. **Get Database URL**:
   - Click on your PostgreSQL service
   - Go to "Variables" tab
   - Copy the `DATABASE_URL` value

### 2. Environment Variables
Set these environment variables in your Railway service:

```bash
# Required
HUBSPOT_ACCESS_TOKEN=your_hubspot_access_token_here
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Railway will auto-populate this

# Optional
NODE_ENV=production
PORT=3000
```

### 3. Database Initialization

#### Option A: Automatic (when server starts)
- The activity logging system will try to create tables automatically on first run
- Tables are created when the first tool call happens

#### Option B: Manual Setup (Recommended)
If tables aren't being created automatically, manually initialize:

```bash
# Set your DATABASE_URL then run:
DATABASE_URL=your_postgres_url npm run init-db
```

This will:
- Test the database connection
- Create the `activity_logs` table with proper indexes
- Insert a test record to verify everything works

**Tables created:**
- `activity_logs` - Stores all MCP tool call history with timestamps, parameters, and responses

### 4. Verify Setup
After deployment, check that:
1. Your app starts without database connection errors
2. Activity tracking works by making a test API call
3. Query your activity history with: `hubspotActivityHistory({ operation: "recent" })`

## Claude Desktop Configuration

### Local Development
Add this to your Claude Desktop config:

```json
{
  "mcpServers": {
    "hubspot": {
      "command": "node",
      "args": ["./build/index.js"],
      "env": {
        "HUBSPOT_ACCESS_TOKEN": "your_access_token_here",
        "DATABASE_URL": "postgresql://localhost:5432/your_db_name"
      }
    }
  }
}
```

### Using Railway Deployment
Point Claude Desktop to your Railway deployment:

```json
{
  "mcpServers": {
    "hubspot": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-http", "https://your-railway-app.railway.app/mcp"]
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
  │   ├── Products/        # Products BCP
  │   └── ActivityHistory/ # Activity tracking BCP
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
