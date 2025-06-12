import { HubspotBaseService } from '../../core/base-service.js';
import { BcpError } from '../../core/types.js';
import type { 
  BroadcastMessage, 
  BroadcastMessageRequest, 
  BroadcastMessagesResponse,
  SocialMediaChannel,
  SocialMediaChannelsResponse 
} from './types.js';

export class SocialMediaService extends HubspotBaseService {
  async getBroadcastMessages(params?: {
    status?: 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'DRAFT';
    since?: number;
    until?: number;
    limit?: number;
    offset?: number;
  }): Promise<BroadcastMessagesResponse> {
    this.checkInitialized();

    try {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.since) queryParams.append('since', params.since.toString());
      if (params?.until) queryParams.append('until', params.until.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());

      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/broadcast/v1/broadcasts${queryParams.toString() ? '?' + queryParams.toString() : ''}`
      });

      return response as unknown as BroadcastMessagesResponse;
    } catch (error) {
      this.handleApiError(error, 'Error fetching broadcast messages');
    }
  }

  async getBroadcastMessage(broadcastGuid: string): Promise<BroadcastMessage> {
    this.checkInitialized();
    
    if (!broadcastGuid) {
      throw new BcpError('Broadcast GUID is required', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/broadcast/v1/broadcasts/${broadcastGuid}`
      });

      return response as unknown as BroadcastMessage;
    } catch (error) {
      this.handleApiError(error, 'Error fetching broadcast message');
    }
  }

  async createBroadcastMessage(data: BroadcastMessageRequest): Promise<BroadcastMessage> {
    this.checkInitialized();

    if (!data.content?.body) {
      throw new BcpError('Message body is required', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.client.apiRequest({
        method: 'POST',
        path: '/broadcast/v1/broadcasts',
        body: data
      });

      return response as unknown as BroadcastMessage;
    } catch (error) {
      this.handleApiError(error, 'Error creating broadcast message');
    }
  }

  async updateBroadcastMessage(
    broadcastGuid: string, 
    data: Partial<BroadcastMessageRequest>
  ): Promise<BroadcastMessage> {
    this.checkInitialized();
    
    if (!broadcastGuid) {
      throw new BcpError('Broadcast GUID is required', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.client.apiRequest({
        method: 'PATCH',
        path: `/broadcast/v1/broadcasts/${broadcastGuid}`,
        body: data
      });

      return response as unknown as BroadcastMessage;
    } catch (error) {
      this.handleApiError(error, 'Error updating broadcast message');
    }
  }

  async deleteBroadcastMessage(broadcastGuid: string): Promise<void> {
    this.checkInitialized();
    
    if (!broadcastGuid) {
      throw new BcpError('Broadcast GUID is required', 'VALIDATION_ERROR', 400);
    }

    try {
      await this.client.apiRequest({
        method: 'DELETE',
        path: `/broadcast/v1/broadcasts/${broadcastGuid}`
      });
    } catch (error) {
      this.handleApiError(error, 'Error deleting broadcast message');
    }
  }

  async getSocialMediaChannels(params?: {
    limit?: number;
    offset?: number;
  }): Promise<SocialMediaChannelsResponse> {
    this.checkInitialized();

    try {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());

      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/broadcast/v1/channels${queryParams.toString() ? '?' + queryParams.toString() : ''}`
      });

      return response as unknown as SocialMediaChannelsResponse;
    } catch (error) {
      this.handleApiError(error, 'Error fetching social media channels');
    }
  }
}