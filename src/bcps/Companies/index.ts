/**
 * Companies BCP
 * 
 * Provides tools for managing HubSpot companies, including creation,
 * retrieval, updating, and searching for companies.
 */

import { BCP } from '../../core/types.js';
import { tool as createTool } from './create.tool.js';
import { tool as getTool } from './get.tool.js';
import { tool as updateTool } from './update.tool.js';
import { tool as deleteTool } from './delete.tool.js';
import { tool as searchTool } from './search.tool.js';
import { tool as recentTool } from './recent.tool.js';

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
    deleteTool,
    searchTool,
    recentTool
  ]
};
