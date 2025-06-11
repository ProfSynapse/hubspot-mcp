/**
 * Quotes BCP
 * 
 * Provides tools for managing HubSpot quotes, including creation,
 * retrieval, updating, and searching for quotes.
 */

import { BCP } from '../../core/types.js';
import { tool as createTool } from './create.tool.js';
import { tool as getTool } from './get.tool.js';
import { tool as updateTool } from './update.tool.js';
import { tool as deleteTool } from './delete.tool.js';
import { tool as searchTool } from './search.tool.js';
import { tool as recentTool } from './recent.tool.js';
import { tool as addLineItemTool } from './addLineItem.tool.js';
import { tool as listLineItemsTool } from './listLineItems.tool.js';
import { tool as updateLineItemTool } from './updateLineItem.tool.js';
import { tool as removeLineItemTool } from './removeLineItem.tool.js';

/**
 * Quotes BCP definition
 */
export const bcp: BCP = {
  domain: 'Quotes',
  description: 'HubSpot quote management tools with line item support',
  tools: [
    createTool,
    getTool,
    updateTool,
    deleteTool,
    searchTool,
    recentTool,
    addLineItemTool,
    listLineItemsTool,
    updateLineItemTool,
    removeLineItemTool
  ]
};