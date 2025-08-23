/**
 * Companies BCP
 * 
 * Provides tools for managing HubSpot companies, including creation,
 * retrieval, updating, and searching for companies.
 */

import { BCP } from '../../core/types.js';
import { tool as createTool } from './companies.create.js';
import { tool as getTool } from './companies.get.js';
import { tool as updateTool } from './companies.update.js';
import { tool as searchTool } from './companies.search.js';
import { tool as recentTool } from './companies.recent.js';

/**
 * Companies BCP definition
 */
export const bcp: BCP = {
  domain: 'Companies',
  description: 'HubSpot company management tools',
  tools: [
    createTool,
    getTool,
    updateTool,
    searchTool,
    recentTool
  ]
};
