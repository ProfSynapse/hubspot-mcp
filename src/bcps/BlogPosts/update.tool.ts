/**
 * Update Blog Post Tool
 * 
 * Provides functionality to update blog post properties in HubSpot.
 * Part of the BlogPosts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for update blog post tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'HubSpot blog post ID (required), use list tool to find valid IDs'
    },
    name: {
      type: 'string',
      description: 'Blog post title'
    },
    slug: {
      type: 'string',
      description: 'URL slug for the blog post'
    },
    postBody: {
      type: 'string',
      description: 'HTML content of the blog post'
    },
    updateDraftOnly: {
      type: 'boolean',
      description: 'Whether to update only the draft version (true) or publish changes immediately (false)',
      default: false
    }
  },
  required: ['id']
};

/**
 * Update blog post tool definition
 */
export const tool: ToolDefinition = {
  name: 'update',
  description: 'Update a blog post in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Prepare blog post properties
      const properties: Record<string, any> = {
        ...(params.name && { name: params.name }),
        ...(params.slug && { slug: params.slug }),
        ...(params.postBody && { postBody: params.postBody })
      };
      
      // Update blog post
      let blogPost;
      if (params.updateDraftOnly) {
        blogPost = await apiClient.updateBlogPostDraft(params.id, properties);
      } else {
        blogPost = await apiClient.updateBlogPost(params.id, properties);
      }
      
      return {
        message: `Blog post ${params.updateDraftOnly ? 'draft ' : ''}updated successfully`,
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
        message: 'Failed to update blog post',
        error: errorMessage
      };
    }
  }
};
