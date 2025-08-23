/**
 * Deals BCP (Bounded Context Pack)
 * 
 * This module exports all deal-related tools for the HubSpot MCP server.
 * It provides a complete set of operations for managing deals in HubSpot.
 */

import { BCP } from '../../core/types.js';
import { tool as createTool } from './create.tool.js';
import { tool as getTool } from './get.tool.js';
import { tool as updateTool } from './update.tool.js';
import { tool as searchTool } from './search.tool.js';
import { tool as recentTool } from './recent.tool.js';
import { tool as batchCreateTool } from './batchCreate.tool.js';
import { tool as batchUpdateTool } from './batchUpdate.tool.js';

/**
 * Deals BCP definition
 * Exports all deal-related tools
 */
export const dealsBcp: BCP = {
  domain: 'Deals',
  description: 'Tools for managing HubSpot deals',
  tools: [
    createTool,
    getTool,
    updateTool,
    searchTool,
    recentTool,
    batchCreateTool,
    batchUpdateTool
  ]
};