/**
 * Search activity history with filters
 */

import { ToolDefinition } from '../../core/types.js';
import { ActivityHistoryService, ActivityLog } from './activityHistory.service.js';

export const activityHistorySearchTool: ToolDefinition = {
  name: 'search',
  description: 'Search activity history with filters',
  inputSchema: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'Filter by domain (e.g., Companies, Contacts)'
      },
      operation: {
        type: 'string',
        description: 'Filter by operation (e.g., create, search, update)'
      },
      days: {
        type: 'number',
        description: 'Number of days to look back (default: 7, max: 30)',
        minimum: 1,
        maximum: 30
      }
    },
    required: []
  },
  handler: async (params: any, context?: { activityService?: ActivityHistoryService }) => {
    try {
      const service = context?.activityService || new ActivityHistoryService();
      const days = params.days || 7;

      // Get all activities within the time range
      let activities = await service.getRecentActivities(days);

      // Apply filters
      if (params.domain) {
        activities = activities.filter((a: ActivityLog) =>
          a.domain.toLowerCase() === params.domain.toLowerCase()
        );
      }

      if (params.operation) {
        activities = activities.filter((a: ActivityLog) =>
          a.operation.toLowerCase() === params.operation.toLowerCase()
        );
      }

      return {
        success: true,
        data: activities,
        message: `Found ${activities.length} matching activities`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search activities'
      };
    }
  }
};