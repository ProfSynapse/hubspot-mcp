/**
 * Deals BCP (Bounded Context Pack)
 * 
 * This module exports all deal-related tools for the HubSpot MCP server.
 * It provides a complete set of operations for managing deals in HubSpot.
 */

import { BCP } from '../../core/types.js';
import { tool as createTool } from './deals.create.js';
import { tool as getTool } from './deals.get.js';
import { tool as updateTool } from './deals.update.js';
import { tool as searchTool } from './deals.search.js';
import { tool as recentTool } from './deals.recent.js';

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
    recentTool
  ]
};