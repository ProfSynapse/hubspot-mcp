/**
 * Activity History BCP
 * Provides tools for querying MCP tool call history stored in PostgreSQL
 */

import { BCP } from '../../core/types.js';
import { activityHistoryRecentTool } from './activityHistory.recent.js';
import { activityHistorySearchTool } from './activityHistory.search.js';

export const activityHistoryTools = [
  activityHistoryRecentTool,
  activityHistorySearchTool
];

export const bcp: BCP = {
  domain: 'ActivityHistory',
  description: 'Query and search MCP tool call history',
  tools: activityHistoryTools
};

export { ActivityHistoryService } from './activityHistory.service.js';