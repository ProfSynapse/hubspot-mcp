/**
 * Get Blog Post Tool
 * 
 * Provides functionality to retrieve a blog post by ID from HubSpot.
 * Part of the BlogPosts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for get blog post tool
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
 * Get blog post tool definition
 */
export const tool: ToolDefinition = {
  name: 'get',
  description: 'Get a blog post by ID from HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Get blog post
      const blogPost = await apiClient.getBlogPost(params.id);
      
      return {
        blogPost: {
          id: blogPost.id,
          name: blogPost.name,
          slug: blogPost.slug,
          state: blogPost.state,
          contentGroupId: blogPost.contentGroupId,
          blogAuthorId: blogPost.blogAuthorId,
          tagIds: blogPost.tagIds,
          postBody: blogPost.postBody,
          publishDate: blogPost.publishDate,
          createdAt: blogPost.createdAt,
          updatedAt: blogPost.updatedAt,
          url: `https://app.hubspot.com/content/${blogPost.contentGroupId}/blog-posts/${blogPost.id}`
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to get blog post',
        error: errorMessage
      };
    }
  }
};
