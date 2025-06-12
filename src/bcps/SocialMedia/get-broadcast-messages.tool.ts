import { ToolDefinition } from '../../core/types.js';
import { SocialMediaService } from './socialmedia.service.js';

export const tool: ToolDefinition = {
  name: 'getBroadcastMessages',
  description: 'Get a list of broadcast messages from HubSpot social media',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['SCHEDULED', 'PUBLISHED', 'FAILED', 'DRAFT'],
        description: 'Filter by broadcast message status'
      },
      since: {
        type: 'number',
        description: 'Filter messages created since this timestamp (Unix timestamp in milliseconds)'
      },
      until: {
        type: 'number',
        description: 'Filter messages created until this timestamp (Unix timestamp in milliseconds)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 20, max: 100)'
      },
      offset: {
        type: 'number',
        description: 'Number of results to skip for pagination'
      }
    },
    required: []
  },
  handler: async (params) => {
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
    const service = new SocialMediaService({ hubspotAccessToken: apiKey });
    await service.init();

    const messages = await service.getBroadcastMessages(params);
    
    return {
      message: `Retrieved ${messages.results.length} broadcast messages`,
      data: messages
    };
  }
};