import { ToolDefinition } from '../../core/types.js';
import { SocialMediaService } from './socialmedia.service.js';

export const tool: ToolDefinition = {
  name: 'getBroadcastMessage',
  description: 'Get a specific broadcast message by its GUID',
  inputSchema: {
    type: 'object',
    properties: {
      broadcastGuid: {
        type: 'string',
        description: 'The GUID of the broadcast message to retrieve'
      }
    },
    required: ['broadcastGuid']
  },
  handler: async (params) => {
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
    const service = new SocialMediaService({ hubspotAccessToken: apiKey });
    await service.init();

    const message = await service.getBroadcastMessage(params.broadcastGuid);
    
    return {
      message: `Retrieved broadcast message ${params.broadcastGuid}`,
      data: message
    };
  }
};