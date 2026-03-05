/**
 * Create Blog Post Tool
 * 
 * Provides functionality to create new blog posts in HubSpot.
 * Part of the BlogPosts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for create blog post tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      description: 'Operation type (always "create" for this tool)',
      enum: ['create'],
      default: 'create'
    },
    name: {
      type: 'string',
      description: 'Blog post title (required)'
    },
    contentGroupId: {
      type: 'string',
      description: 'ID of the parent blog to publish the post to (required - use list tool to find valid IDs)'
    },
    slug: {
      type: 'string',
      description: 'URL slug for the blog post'
    },
    metaDescription: {
      type: 'string',
      description: 'Meta description for SEO (recommended for search engine optimization)'
    },
    postBody: {
      type: 'string',
      description: 'HTML content of the blog post'
    }
  },
  required: ['name', 'contentGroupId']
};

/**
 * Create blog post tool definition
 */
export const tool: ToolDefinition = {
  name: 'create',
  description: 'Create a new blog post in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Prepare blog post properties
      const properties: Record<string, any> = {
        name: params.name,
        contentGroupId: params.contentGroupId,
        state: 'DRAFT', // Always set to DRAFT
        ...(params.slug && { slug: params.slug }),
        ...(params.metaDescription && { metaDescription: params.metaDescription }),
        ...(params.postBody && { postBody: params.postBody })
      };
      
      // Create blog post
      const blogPost = await apiClient.createBlogPost(properties);
      
      const response = {
        message: 'Blog post created successfully',
        blogPost: {
          id: blogPost.id,
          name: blogPost.name,
          slug: blogPost.slug,
          state: blogPost.state,
          contentGroupId: blogPost.contentGroupId,
          url: `https://app.hubspot.com/content/${blogPost.contentGroupId}/blog-posts/${blogPost.id}`
        }
      };
      
      return enhanceResponse(response, 'create', params, 'BlogPosts');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return enhanceResponse(
        {
          message: 'Failed to create blog post',
          error: errorMessage
        },
        'create',
        params,
        'BlogPosts',
        error instanceof Error ? error : undefined
      );
    }
  }
};
