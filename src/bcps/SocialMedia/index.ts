import { BCP } from '../../core/types.js';
import { tool as getBroadcastMessagesToolDef } from './get-broadcast-messages.tool.js';
import { tool as getBroadcastMessageToolDef } from './get-broadcast-message.tool.js';
import { tool as createBroadcastMessageToolDef } from './create-broadcast-message.tool.js';
import { tool as updateBroadcastMessageToolDef } from './update-broadcast-message.tool.js';
import { tool as deleteBroadcastMessageToolDef } from './delete-broadcast-message.tool.js';
import { tool as getChannelsToolDef } from './get-channels.tool.js';

export const bcp: BCP = {
  domain: 'SocialMedia',
  description: 'Tools for managing HubSpot social media broadcast messages and channels',
  tools: [
    getBroadcastMessagesToolDef,
    getBroadcastMessageToolDef,
    createBroadcastMessageToolDef,
    updateBroadcastMessageToolDef,
    deleteBroadcastMessageToolDef,
    getChannelsToolDef
  ]
};