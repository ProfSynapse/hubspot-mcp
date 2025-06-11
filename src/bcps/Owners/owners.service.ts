import { HubspotBaseService } from '../../core/base-service.js';
import { ServiceConfig, BcpError } from '../../core/types.js';

export interface Owner {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
}

export interface OwnersListResponse {
  results: Owner[];
  pagination?: {
    after?: string;
  };
  total?: number;
}

export class OwnersService extends HubspotBaseService {
  constructor(config: ServiceConfig) {
    super(config);
  }

  /**
   * Lists all owners in the HubSpot account
   * @param limit - Maximum number of owners to return (default: 100, max: 100)
   * @param after - Pagination cursor for the next page
   * @returns List of owners
   */
  public async listOwners(limit: number = 100, after?: string): Promise<OwnersListResponse> {
    this.checkInitialized();
    
    // Debug: Starting owners list request
    
    if (limit <= 0 || limit > 100) {
      throw new BcpError('Limit must be between 1 and 100', 'VALIDATION_ERROR', 400);
    }

    try {
      // Try to find owners using multiple possible endpoints
      
      const queryParams = new URLSearchParams();
      queryParams.append('limit', limit.toString());
      if (after) {
        queryParams.append('after', after);
      }

      // Try different possible endpoints for owners
      let response;
      const endpoints = [
        `/crm/v3/owners?${queryParams.toString()}`,
        `/owners?${queryParams.toString()}`,
        `/crm/v3/objects/owners?${queryParams.toString()}`,
        `/settings/v3/users?${queryParams.toString()}`
      ];
      
      let lastError;
      for (const endpoint of endpoints) {
        try {
          response = await this.client.apiRequest({
            method: 'GET',
            path: endpoint
          });
          break; // Success, stop trying other endpoints
        } catch (error) {
          lastError = error;
          continue;
        }
      }
      
      if (!response) {
        throw lastError || new Error('All owner endpoints failed');
      }
      const typedResponse = response as any;
      const owners: Owner[] = [];

      if (typedResponse?.results && Array.isArray(typedResponse.results)) {
        for (const owner of typedResponse.results) {
          owners.push({
            id: owner.id,
            email: owner.email,
            firstName: owner.firstName,
            lastName: owner.lastName,
            fullName: owner.firstName && owner.lastName ? `${owner.firstName} ${owner.lastName}` : owner.firstName || owner.lastName,
            userId: owner.userId,
            createdAt: owner.createdAt,
            updatedAt: owner.updatedAt,
            archived: owner.archived || false,
          });
        }
      }

      return {
        results: owners,
        pagination: typedResponse?.paging?.next ? { after: typedResponse.paging.next.after } : undefined,
        total: typedResponse?.total,
      };
    } catch (e: any) {
      if (e.code === 403 || (e.body && e.body.category === 'FORBIDDEN')) {
        throw new BcpError(
          'Access denied to HubSpot Owners API. Your access token may be missing the required scope "crm.objects.owners.read". Please check your HubSpot app permissions and ensure the owners scope is enabled.',
          'PERMISSION_ERROR',
          403
        );
      }
      this.handleApiError(e, 'Failed to list owners');
    }
  }

  /**
   * Gets a specific owner by ID
   * @param ownerId - The ID of the owner to retrieve
   * @returns The owner object
   */
  public async getOwner(ownerId: string): Promise<Owner> {
    this.checkInitialized();
    
    if (!ownerId) {
      throw new BcpError('Owner ID is required', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v3/owners/${ownerId}`
      });

      // Process the owner response
      const owner = response as any;
      return {
        id: owner.id,
        email: owner.email,
        firstName: owner.firstName,
        lastName: owner.lastName,
        fullName: owner.firstName && owner.lastName ? `${owner.firstName} ${owner.lastName}` : owner.firstName || owner.lastName,
        userId: owner.userId,
        createdAt: owner.createdAt,
        updatedAt: owner.updatedAt,
        archived: owner.archived || false,
      };
    } catch (e: any) {
      if (e.code === 404) {
        throw new BcpError(`Owner with ID '${ownerId}' not found`, 'NOT_FOUND', 404);
      }
      if (e.code === 403 || (e.body && e.body.category === 'FORBIDDEN')) {
        throw new BcpError(
          'Access denied to HubSpot Owners API. Your access token may be missing the required scope "crm.objects.owners.read". Please check your HubSpot app permissions and ensure the owners scope is enabled.',
          'PERMISSION_ERROR',
          403
        );
      }
      this.handleApiError(e, `Failed to get owner with ID ${ownerId}`);
    }
  }

  /**
   * Gets the current user information
   * @returns Current user as owner
   */
  public async getCurrentUser(): Promise<Owner> {
    this.checkInitialized();

    try {
      // Try to get current user info
      const endpoints = [
        '/integrations/v1/me',
        '/oauth/v1/access-tokens/me',
        '/settings/v3/users/me'
      ];
      
      let response;
      let lastError;
      
      for (const endpoint of endpoints) {
        try {
          response = await this.client.apiRequest({
            method: 'GET',
            path: endpoint
          });
          break; // Success, stop trying other endpoints
        } catch (error) {
          lastError = error;
          continue;
        }
      }
      
      if (!response) {
        throw lastError || new Error('Could not get current user info');
      }
      
      // Process the current user response
      const user = response as any;
      
      return {
        id: user.user_id || user.id || user.userId || 'unknown',
        email: user.user || user.email || 'unknown@example.com',
        firstName: user.given_name || user.firstName,
        lastName: user.family_name || user.lastName,
        fullName: user.given_name && user.family_name ? `${user.given_name} ${user.family_name}` : user.given_name || user.family_name,
        userId: user.user_id || user.id || user.userId,
        createdAt: user.created_at || user.createdAt,
        updatedAt: user.updated_at || user.updatedAt,
        archived: false,
      };
    } catch (e: any) {
      this.handleApiError(e, 'Failed to get current user');
    }
  }

  /**
   * Searches for owners by email
   * @param email - Email address to search for
   * @returns List of matching owners
   */
  public async searchOwnersByEmail(email: string): Promise<OwnersListResponse> {
    this.checkInitialized();
    
    if (!email) {
      throw new BcpError('Email is required for search', 'VALIDATION_ERROR', 400);
    }

    try {
      const allOwners = await this.listOwners(100);
      const matchingOwners = allOwners.results.filter(owner => 
        owner.email.toLowerCase().includes(email.toLowerCase())
      );

      return {
        results: matchingOwners,
        total: matchingOwners.length,
      };
    } catch (e: any) {
      if (e.code === 403 || (e.body && e.body.category === 'FORBIDDEN')) {
        throw new BcpError(
          'Access denied to HubSpot Owners API. Your access token may be missing the required scope "crm.objects.owners.read". Please check your HubSpot app permissions and ensure the owners scope is enabled.',
          'PERMISSION_ERROR',
          403
        );
      }
      this.handleApiError(e, 'Failed to search owners by email');
    }
  }
}