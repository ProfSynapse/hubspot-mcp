export interface BroadcastMessage {
  broadcastGuid: string;
  groupGuid?: string;
  portalId: number;
  channelGuid: string;
  createdAt: number;
  createdBy?: string;
  updatedAt?: number;
  updatedBy?: string;
  messageText: string;
  messageUrl?: string;
  status: 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'DRAFT';
  scheduledAt?: number;
  publishedAt?: number;
  clicks?: number;
  impressions?: number;
  reach?: number;
  engagement?: number;
  channel?: {
    accountGuid: string;
    channelGuid: string;
    type: string;
    name: string;
  };
}

export interface BroadcastMessageRequest {
  content: {
    body: string;
  };
  channelKeys?: string[];
  groupGuid?: string;
  status?: 'DRAFT' | 'SCHEDULED';
  publishNow?: boolean;
  publishAt?: number;
}

export interface BroadcastMessagesResponse {
  results: BroadcastMessage[];
  hasMore: boolean;
  offset: number;
  total: number;
}

export interface SocialMediaChannel {
  accountGuid: string;
  channelGuid: string;
  type: 'FACEBOOK' | 'LINKEDIN' | 'INSTAGRAM';
  name: string;
  username?: string;
  profileUrl?: string;
  avatarUrl?: string;
  accountType?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface SocialMediaChannelsResponse {
  results: SocialMediaChannel[];
  hasMore: boolean;
  offset: number;
  total: number;
}