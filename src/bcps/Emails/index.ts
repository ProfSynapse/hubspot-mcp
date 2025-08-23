/**
 * Location: /src/bcps/Emails/index.ts
 * 
 * Email BCP (Bounded Context Pack) definition and exports.
 * Provides tools for managing HubSpot marketing emails including creation,
 * retrieval, updating, deletion, listing, and recent email operations.
 * 
 * Used by:
 * - src/core/server.ts: Imports this BCP to register email tools in the MCP server
 * - Individual tool files import and use the service and types
 * 
 * How it works with other files:
 * - Exports all individual tools from their respective files
 * - Defines the BCP structure that follows the established pattern
 * - Server imports this to register the combined hubspotEmail tool
 */

import { BCP } from '../../core/types.js';
import { tool as createTool } from './create.tool.js';
import { tool as getTool } from './get.tool.js';
import { tool as updateTool } from './update.tool.js';
import { tool as listTool } from './list.tool.js';
import { tool as recentTool } from './recent.tool.js';

/**
 * Email BCP definition
 * Follows the standard BCP pattern with domain, description, and tools array
 */
export const bcp: BCP = {
  domain: 'Emails',
  description: 'HubSpot marketing email management tools for Email Marketing API v3. Supports CRUD operations, filtering, and pagination. Does not include email sending functionality.',
  tools: [
    createTool,
    getTool,
    updateTool,
    listTool,
    recentTool
  ]
};

/**
 * Export individual tools for direct access if needed
 */
export const emailTools = [
  createTool,
  getTool,
  updateTool,
  listTool,
  recentTool
];

/**
 * Export types for external use
 */
export type {
  Email,
  EmailCreateInput,
  EmailUpdateInput,
  EmailFilters,
  EmailsPage,
  EmailResponse,
  EmailState,
  EmailType,
  EmailSender,
  EmailContent,
  EmailMetadata
} from './emails.types.js';

/**
 * Export service for direct use if needed
 */
export { EmailsService } from './emails.service.js';