/**
 * Get recent activity history
 */

import { ToolDefinition } from '../../core/types.js';
import { ActivityHistoryService } from './activityHistory.service.js';

export const activityHistoryRecentTool: ToolDefinition = {
  name: 'recent',
  description: 'Get recent activity history',
  inputSchema: {
    type: 'object',
    properties: {
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
      const activities = await service.getRecentActivities(days);

      return {
        success: true,
        data: activities,
        message: `Retrieved ${activities.length} activities from the last ${days} days`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve recent activities'
      };
    }
  }
};