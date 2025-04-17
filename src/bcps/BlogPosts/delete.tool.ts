/**
 * Delete Blog Post Tool
 * 
 * Provides functionality to delete/archive a blog post in HubSpot.
 * Part of the BlogPosts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for delete blog post tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'HubSpot blog post ID (required)'
    }
  },
  required: ['id']
};

/**
 * Delete blog post tool definition
 */
export const tool: ToolDefinition = {
  name: 'delete',
  description: 'Delete/archive a blog post in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Delete blog post
      await apiClient.deleteBlogPost(params.id);
      
      return {
        message: `Blog post ${params.id} deleted successfully`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to delete blog post',
        error: errorMessage
      };
    }
  }
};
