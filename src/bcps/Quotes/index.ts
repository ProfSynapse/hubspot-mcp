/**
 * Quotes BCP
 * 
 * Provides tools for managing HubSpot quotes, including creation,
 * retrieval, updating, and searching for quotes.
 */

import { BCP } from '../../core/types.js';
import { tool as createTool } from './quotes.create.js';
import { tool as getTool } from './quotes.get.js';
import { tool as updateTool } from './quotes.update.js';
import { tool as searchTool } from './quotes.search.js';
import { tool as recentTool } from './quotes.recent.js';
import { tool as addLineItemTool } from './quotes.addLineItem.js';
import { tool as listLineItemsTool } from './quotes.listLineItems.js';
import { tool as updateLineItemTool } from './quotes.updateLineItem.js';
import { tool as removeLineItemTool } from './quotes.removeLineItem.js';

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
    searchTool,
    recentTool,
    addLineItemTool,
    listLineItemsTool,
    updateLineItemTool,
    removeLineItemTool
  ]
};