import { ToolDefinition } from '../../core/types.js';
import { SocialMediaService } from './socialmedia.service.js';

export const tool: ToolDefinition = {
  name: 'updateBroadcastMessage',
  description: 'Update an existing broadcast message',
  inputSchema: {
    type: 'object',
    properties: {
      broadcastGuid: {
        type: 'string',
        description: 'The GUID of the broadcast message to update'
      },
      body: {
        type: 'string',
        description: 'The updated content of the social media post'
      },
      channelKeys: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated array of channel GUIDs to post to'
      },
      groupGuid: {
        type: 'string',
        description: 'Updated group GUID to associate the message with'
      },
      status: {
        type: 'string',
        enum: ['DRAFT', 'SCHEDULED'],
        description: 'Updated status of the broadcast message'
      },
      publishNow: {
        type: 'boolean',
        description: 'Whether to publish the message immediately'
      },
      publishAt: {
        type: 'number',
        description: 'Updated Unix timestamp (milliseconds) to schedule the message for publishing'
      }
    },
    required: ['broadcastGuid']
  },
  handler: async (params) => {
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
    const service = new SocialMediaService({ hubspotAccessToken: apiKey });
    await service.init();

    const { broadcastGuid, ...updateData } = params;
    
    const requestData: any = {};
    if (updateData.body) {
      requestData.content = { body: updateData.body };
    }
    if (updateData.channelKeys) requestData.channelKeys = updateData.channelKeys;
    if (updateData.groupGuid) requestData.groupGuid = updateData.groupGuid;
    if (updateData.status) requestData.status = updateData.status;
    if (updateData.publishNow !== undefined) requestData.publishNow = updateData.publishNow;
    if (updateData.publishAt) requestData.publishAt = updateData.publishAt;

    const message = await service.updateBroadcastMessage(broadcastGuid, requestData);
    
    return {
      message: `Broadcast message ${broadcastGuid} updated successfully`,
      data: message
    };
  }
};