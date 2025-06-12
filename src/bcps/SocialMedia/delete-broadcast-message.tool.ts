import { ToolDefinition } from '../../core/types.js';
import { SocialMediaService } from './socialmedia.service.js';

export const tool: ToolDefinition = {
  name: 'deleteBroadcastMessage',
  description: 'Delete a broadcast message',
  inputSchema: {
    type: 'object',
    properties: {
      broadcastGuid: {
        type: 'string',
        description: 'The GUID of the broadcast message to delete'
      }
    },
    required: ['broadcastGuid']
  },
  handler: async (params) => {
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
    const service = new SocialMediaService({ hubspotAccessToken: apiKey });
    await service.init();

    await service.deleteBroadcastMessage(params.broadcastGuid);
    
    return {
      message: `Broadcast message ${params.broadcastGuid} deleted successfully`,
      data: { deleted: true }
    };
  }
};