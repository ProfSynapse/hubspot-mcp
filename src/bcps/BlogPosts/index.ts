/**
 * BlogPosts BCP
 * 
 * Provides tools for managing HubSpot blog posts, including creation,
 * retrieval, updating, publishing, and searching for blog posts.
 */

import { BCP } from '../../core/types.js';
import { tool as createTool } from './create.tool.js';
import { tool as getTool } from './get.tool.js';
import { tool as updateTool } from './update.tool.js';
import { tool as deleteTool } from './delete.tool.js';
import { tool as searchTool } from './search.tool.js';
import { tool as recentTool } from './recent.tool.js';
import { tool as publishTool } from './publish.tool.js';
import { tool as scheduleTool } from './schedule.tool.js';

/**
 * BlogPosts BCP definition
 */
export const bcp: BCP = {
  domain: 'BlogPosts',
  description: 'HubSpot blog post management tools',
  tools: [
    createTool,
    getTool,
    updateTool,
    deleteTool,
    searchTool,
    recentTool,
    publishTool,
    scheduleTool
  ]
};
