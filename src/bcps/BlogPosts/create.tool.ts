/**
 * Create Blog Post Tool
 * 
 * Provides functionality to create new blog posts in HubSpot.
 * Part of the BlogPosts BCP.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

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
      description: 'ID of the parent blog to publish the post to (required)'
    },
    slug: {
      type: 'string',
      description: 'URL slug for the blog post'
    },
    blogAuthorId: {
      type: 'string',
      description: 'ID of the blog author'
    },
    metaDescription: {
      type: 'string',
      description: 'Meta description for the blog post'
    },
    postBody: {
      type: 'string',
      description: 'HTML content of the blog post'
    },
    featuredImage: {
      type: 'string',
      description: 'URL of the featured image'
    },
    useFeaturedImage: {
      type: 'boolean',
      description: 'Whether to include a featured image',
      default: true
    },
    state: {
      type: 'string',
      description: 'Publish state of the post (DRAFT, PUBLISHED, SCHEDULED)',
      enum: ['DRAFT', 'PUBLISHED', 'SCHEDULED'],
      default: 'DRAFT'
    },
    publishDate: {
      type: 'string',
      description: 'Date to publish the post (ISO8601 format, required for SCHEDULED state)'
    },
    tagIds: {
      type: 'array',
      description: 'IDs of tags to associate with the post',
      items: {
        type: 'string'
      }
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
        ...(params.slug && { slug: params.slug }),
        ...(params.blogAuthorId && { blogAuthorId: params.blogAuthorId }),
        ...(params.metaDescription && { metaDescription: params.metaDescription }),
        ...(params.postBody && { postBody: params.postBody }),
        ...(params.featuredImage && { featuredImage: params.featuredImage }),
        ...(params.useFeaturedImage !== undefined && { useFeaturedImage: params.useFeaturedImage }),
        ...(params.state && { state: params.state }),
        ...(params.publishDate && { publishDate: params.publishDate }),
        ...(params.tagIds && { tagIds: params.tagIds })
      };
      
      // Create blog post
      const blogPost = await apiClient.createBlogPost(properties);
      
      return {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to create blog post',
        error: errorMessage
      };
    }
  }
};
