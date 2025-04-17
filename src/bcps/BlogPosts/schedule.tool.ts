/**
 * Schedule Blog Post Tool
 * 
 * Provides functionality to schedule a blog post for future publishing in HubSpot.
 * Part of the BlogPosts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for schedule blog post tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'HubSpot blog post ID (required)'
    },
    publishDate: {
      type: 'string',
      description: 'Date to publish the blog post (ISO8601 format, required)'
    }
  },
  required: ['id', 'publishDate']
};

/**
 * Schedule blog post tool definition
 */
export const tool: ToolDefinition = {
  name: 'schedule',
  description: 'Schedule a blog post for future publishing in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Schedule blog post
      const blogPost = await apiClient.scheduleBlogPost(params.id, params.publishDate);
      
      return {
        message: `Blog post scheduled for publishing on ${params.publishDate}`,
        blogPost: {
          id: blogPost.id,
          name: blogPost.name,
          slug: blogPost.slug,
          state: blogPost.state,
          contentGroupId: blogPost.contentGroupId,
          publishDate: blogPost.publishDate,
          url: `https://app.hubspot.com/content/${blogPost.contentGroupId}/blog-posts/${blogPost.id}`
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to schedule blog post',
        error: errorMessage
      };
    }
  }
};
