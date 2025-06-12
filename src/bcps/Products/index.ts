/**
 * Products BCP
 * 
 * Bounded Context Pack for HubSpot Products operations.
 * Provides tools for managing products in HubSpot.
 */

import { tool as listTool } from './list.tool.js';
import { tool as searchTool } from './search.tool.js';
import { tool as getTool } from './get.tool.js';

export const productTools = {
  list: listTool,
  search: searchTool,
  get: getTool
};

export * from './products.service.js';