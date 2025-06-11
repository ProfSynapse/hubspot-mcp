/**
 * Owners BCP
 *
 * Provides tools for managing HubSpot owners.
 */

import { BCP } from '../../core/types.js';
import { tool as listTool } from './list.tool.js';
import { tool as getTool } from './get.tool.js';
import { tool as searchTool } from './search.tool.js';
import { tool as getCurrentUserTool } from './getCurrentUser.tool.js';

export const ownersBcp: BCP = {
  domain: 'hubspotOwners',
  description: 'Manage HubSpot owners - list, get, search for owner information, and get current user',
  tools: [
    listTool,
    getTool,
    searchTool,
    getCurrentUserTool,
  ],
};