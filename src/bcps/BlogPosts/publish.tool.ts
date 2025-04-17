/**
 * Publish Blog Post Tool
 * 
 * Provides functionality to publish a blog post draft in HubSpot.
 * Part of the BlogPosts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for publish blog post tool
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
 * Publish blog post tool definition
 */
export const tool: ToolDefinition = {
  name: 'publish',
  description: 'Publish a blog post draft in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Publish blog post
      const blogPost = await apiClient.publishBlogPost(params.id);
      
      return {
        message: 'Blog post published successfully',
        blogPost: {
          id: blogPost.id,
          name: blogPost.name,
          slug: blogPost.slug,
          state: blogPost.state,
          contentGroupId: blogPost.contentGroupId,
          url: `https://app.hubspot.com/content/${blogPost.contentGroupId}/blog-posts/${blogPost.id}`
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to publish blog post',
        error: errorMessage
      };
    }
  }
};
