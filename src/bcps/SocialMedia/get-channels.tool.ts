import { ToolDefinition } from '../../core/types.js';
import { SocialMediaService } from './socialmedia.service.js';

export const tool: ToolDefinition = {
  name: 'getChannels',
  description: 'Get a list of connected social media channels',
  inputSchema: {
    type: 'object',
    properties: {
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

    const channels = await service.getSocialMediaChannels(params);
    
    return {
      message: `Retrieved ${channels.results.length} social media channels`,
      data: channels
    };
  }
};