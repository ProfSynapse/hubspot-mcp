/**
 * Lists BCP
 *
 * Provides tools for managing HubSpot lists (segments), including creation,
 * retrieval, updating, searching, filter management, and membership operations.
 * Supports MANUAL (static), DYNAMIC (auto-updating), and SNAPSHOT (initially filtered)
 * list types.
 */

import { BCP } from '../../core/types.js';
import { tool as createTool } from './lists.create.js';
import { tool as getTool } from './lists.get.js';
import { tool as searchTool } from './lists.search.js';
import { tool as updateTool } from './lists.update.js';
import { tool as deleteTool } from './lists.delete.js';
import { tool as updateFiltersTool } from './lists.updateFilters.js';
import { tool as addMembersTool } from './lists.addMembers.js';
import { tool as removeMembersTool } from './lists.removeMembers.js';
import { tool as getMembersTool } from './lists.getMembers.js';

/**
 * Lists BCP definition
 */
export const bcp: BCP = {
  domain: 'Lists',
  description: 'HubSpot list management with MANUAL, DYNAMIC, and SNAPSHOT support',
  tools: [
    createTool,
    getTool,
    searchTool,
    updateTool,
    deleteTool,
    updateFiltersTool,
    addMembersTool,
    removeMembersTool,
    getMembersTool
  ]
};

// Export types for external use
export * from './lists.types.js';
export { ListsService } from './lists.service.js';
