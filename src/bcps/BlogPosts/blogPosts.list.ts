/**
 * List Blogs Tool
 * 
 * Provides functionality to list all blogs in HubSpot.
 * Part of the BlogPosts BCP.
 * This tool helps users find valid contentGroupIds to use when creating blog posts.
 */

import { ToolDefinition, InputSchema } from '../../core/types.js';
import { createHubspotApiClient } from '../../core/hubspot-client.js';

/**
 * Input schema for list blogs tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      description: 'Operation type (always "list" for this tool)',
      enum: ['list'],
      default: 'list'
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of blogs to return',
      minimum: 1,
      maximum: 100,
      default: 20
    },
    offset: {
      type: 'integer',
      description: 'Offset for pagination',
      minimum: 0,
      default: 0
    }
  },
  required: []
};

/**
 * List blogs tool definition
 */
export const tool: ToolDefinition = {
  name: 'list',
  description: 'List all blogs in HubSpot to find valid contentGroupIds for blog post creation',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create API client
      const apiClient = createHubspotApiClient(apiKey);
      
      // Get blogs
      const blogs = await apiClient.getBlogs(params.limit || 20, params.offset || 0);
      
      // Transform results
      const results = blogs.map(blog => ({
        id: blog.id,
        name: blog.name,
        domain: blog.domain || blog.resolved_domain || '',
        slug: blog.slug,
        createdAt: blog.created
      }));
      
      return {
        message: `Retrieved ${results.length} blogs`,
        blogs: results,
        count: results.length,
        note: 'Use the blog ID as the contentGroupId when creating blog posts'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to list blogs',
        blogs: [],
        count: 0,
        error: errorMessage
      };
    }
  }
};
