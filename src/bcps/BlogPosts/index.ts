/**
 * BlogPosts BCP
 * 
 * Provides tools for managing HubSpot blog posts, including creation,
 * retrieval, and updating blog posts.
 * Also includes tools for listing blogs to find valid contentGroupIds.
 */

import { BCP } from '../../core/types.js';
import { tool as createTool } from './blogPosts.create.js';
import { tool as getTool } from './blogPosts.get.js';
import { tool as updateTool } from './blogPosts.update.js';
import { tool as recentTool } from './blogPosts.recent.js';
import { tool as listTool } from './blogPosts.list.js';

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
    recentTool,
    listTool
  ]
};
