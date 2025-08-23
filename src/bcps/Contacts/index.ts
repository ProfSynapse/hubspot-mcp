/**
 * Contacts BCP
 * 
 * Provides tools for managing HubSpot contacts, including creation,
 * retrieval, updating, and searching for contacts.
 */

import { BCP } from '../../core/types.js';
import { tool as createTool } from './create.tool.js';
import { tool as getTool } from './get.tool.js';
import { tool as updateTool } from './update.tool.js';
import { tool as searchTool } from './search.tool.js';
import { tool as recentTool } from './recent.tool.js';

/**
 * Contacts BCP definition
 */
export const bcp: BCP = {
  domain: 'Contacts',
  description: 'HubSpot contact management tools',
  tools: [
    createTool,
    getTool,
    updateTool,
    searchTool,
    recentTool
  ]
};
