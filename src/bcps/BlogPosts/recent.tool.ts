/**
 * Recent Blog Posts Tool
 * 
 * Provides functionality to retrieve recently created or updated blog posts in HubSpot.
 * Part of the BlogPosts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for recent blog posts tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return',
      minimum: 1,
      maximum: 100,
      default: 10
    }
  },
  required: []
};

/**
 * Recent blog posts tool definition
 */
export const tool: ToolDefinition = {
  name: 'recent',
  description: 'Get recently created or updated blog posts',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Get recent blog posts
      const blogPosts = await apiClient.getRecentBlogPosts(params.limit || 10);
      
      // Transform results
      const results = blogPosts.map(post => ({
        id: post.id,
        name: post.name,
        slug: post.slug,
        state: post.state,
        contentGroupId: post.contentGroupId,
        publishDate: post.publishDate,
        url: `https://app.hubspot.com/content/${post.contentGroupId}/blog-posts/${post.id}`
      }));
      
      return {
        message: `Retrieved ${results.length} recent blog posts`,
        blogPosts: results,
        count: results.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to get recent blog posts',
        blogPosts: [],
        count: 0,
        error: errorMessage
      };
    }
  }
};
