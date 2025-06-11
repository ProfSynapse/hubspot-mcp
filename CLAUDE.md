# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Watch mode for TypeScript compilation during development
- `npm start` - Start the compiled MCP server
- `npm test` - Run Jest tests

### Testing Individual Tests
- `npm test -- path/to/test.ts` - Run a specific test file
- `npm test -- --testNamePattern="test name"` - Run tests matching a pattern

## Architecture Overview

This project implements a HubSpot integration using the Model Context Protocol (MCP) with a Bounded Context Packs (BCP) architecture.

### Key Architectural Patterns

1. **BCP Structure**: Each domain (Companies, Contacts, Notes, etc.) is organized as a self-contained BCP under `src/bcps/`. Each BCP contains:
   - `index.ts` - Exports the BCP definition with all tools
   - `*.service.ts` - Domain service handling API operations
   - `*.tool.ts` - Individual tool definitions with schemas and handlers

2. **Tool Registration**: The server combines individual tools into domain-specific tools (e.g., `hubspotCompany`) with an `operation` parameter. This simplifies the MCP interface by exposing one tool per domain rather than many individual tools.

3. **Service Pattern**: All services extend `HubspotBaseService` and follow a consistent pattern:
   - Initialize and verify API credentials
   - Provide typed methods for API operations
   - Handle errors consistently with `BcpError`

4. **Type Safety**: The project uses:
   - TypeScript interfaces for all data structures
   - Zod schemas for runtime validation
   - Strict typing throughout the codebase

### Adding New BCPs

To add a new HubSpot domain:
1. Create a new directory under `src/bcps/YourDomain/`
2. Implement a service extending `HubspotBaseService`
3. Create tool files following the existing pattern
4. Export tools in an `index.ts` file
5. Register the BCP in `src/core/server.ts` in the `registerAllTools()` method

### Environment Configuration

The server requires:
- `HUBSPOT_ACCESS_TOKEN` - HubSpot API access token

This is typically configured in Claude Desktop's MCP server configuration.