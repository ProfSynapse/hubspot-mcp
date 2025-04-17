/**
 * Search Blog Posts Tool
 * 
 * Provides functionality to search for blog posts in HubSpot.
 * Part of the BlogPosts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for search blog posts tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Search query (required)'
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return',
      minimum: 1,
      maximum: 100,
      default: 10
    }
  },
  required: ['query']
};

/**
 * Search blog posts tool definition
 */
export const tool: ToolDefinition = {
  name: 'search',
  description: 'Search for blog posts in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Search blog posts
      const blogPosts = await apiClient.searchBlogPosts(
        params.query,
        params.limit || 10
      );
      
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
        message: `Found ${results.length} blog posts`,
        blogPosts: results,
        count: results.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to search blog posts',
        blogPosts: [],
        count: 0,
        error: errorMessage
      };
    }
  }
};
