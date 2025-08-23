/**
 * Products BCP
 * 
 * Bounded Context Pack for HubSpot Products operations.
 * Provides tools for managing products in HubSpot.
 */

import { tool as listTool } from './products.list.js';
import { tool as searchTool } from './products.search.js';
import { tool as getTool } from './products.get.js';

export const productTools = {
  list: listTool,
  search: searchTool,
  get: getTool
};

export * from './products.service.js';