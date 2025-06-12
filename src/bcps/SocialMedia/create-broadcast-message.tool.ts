import { ToolDefinition } from '../../core/types.js';
import { SocialMediaService } from './socialmedia.service.js';

export const tool: ToolDefinition = {
  name: 'createBroadcastMessage',
  description: 'Create a new broadcast message for social media channels',
  inputSchema: {
    type: 'object',
    properties: {
      body: {
        type: 'string',
        description: 'The content of the social media post'
      },
      channelKeys: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of channel GUIDs to post to'
      },
      groupGuid: {
        type: 'string',
        description: 'Optional group GUID to associate the message with'
      },
      status: {
        type: 'string',
        enum: ['DRAFT', 'SCHEDULED'],
        description: 'Status of the broadcast message (default: DRAFT)'
      },
      publishNow: {
        type: 'boolean',
        description: 'Whether to publish the message immediately'
      },
      publishAt: {
        type: 'number',
        description: 'Unix timestamp (milliseconds) to schedule the message for publishing'
      }
    },
    required: ['body']
  },
  handler: async (params) => {
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
    const service = new SocialMediaService({ hubspotAccessToken: apiKey });
    await service.init();

    const requestData = {
      content: {
        body: params.body
      },
      channelKeys: params.channelKeys,
      groupGuid: params.groupGuid,
      status: params.status,
      publishNow: params.publishNow,
      publishAt: params.publishAt
    };

    const message = await service.createBroadcastMessage(requestData);
    
    return {
      message: 'Broadcast message created successfully',
      data: message
    };
  }
};