/**
 * Contacts BCP
 * 
 * Provides tools for managing HubSpot contacts, including creation,
 * retrieval, updating, and searching for contacts.
 */

import { BCP } from '../../core/types.js';
import { tool as createTool } from './contacts.create.js';
import { tool as getTool } from './contacts.get.js';
import { tool as updateTool } from './contacts.update.js';
import { tool as searchTool } from './contacts.search.js';
import { tool as recentTool } from './contacts.recent.js';

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
