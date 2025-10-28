/**
 * Location: /src/bcps/Lists/lists.service.ts
 *
 * Service for managing HubSpot Lists API v3 operations.
 * Extends HubspotBaseService to provide list CRUD operations, filter management,
 * and membership operations supporting MANUAL, DYNAMIC, and SNAPSHOT list types.
 *
 * Used by: List tool files in /src/bcps/Lists/*.ts
 */

import { HubspotBaseService } from '../../core/base-service.js';
import { ServiceConfig, BcpError } from '../../core/types.js';
import {
  List,
  CreateListParams,
  SearchListsParams,
  SearchListsResponse,
  GetMembersParams,
  MembersPage,
  ListMember,
  MembershipResult,
  FilterBranch,
  ProcessingType,
  isDynamicList,
  canAddMembersManually,
  requiresFilters
} from './lists.types.js';

export class ListsService extends HubspotBaseService {
  constructor(config: ServiceConfig) {
    super(config);
  }

  /**
   * Creates a new list in HubSpot
   *
   * @param params - List creation parameters
   * @returns Created List object
   * @throws BcpError for validation failures, missing scopes, or API errors
   */
  async createList(params: CreateListParams): Promise<List> {
    this.checkInitialized();

    // Validate required fields
    this.validateRequired(params, ['name', 'objectTypeId', 'processingType']);

    // Validate filterBranch requirement for DYNAMIC and SNAPSHOT
    if (requiresFilters(params.processingType)) {
      if (!params.filterBranch) {
        throw new BcpError(
          `${params.processingType} lists require filterBranch definition`,
          'VALIDATION_ERROR',
          400
        );
      }
      // Validate filter structure
      this.validateFilterStructure(params.filterBranch);
    }

    // Prevent filterBranch on MANUAL lists
    if (params.processingType === 'MANUAL' && params.filterBranch) {
      throw new BcpError(
        'MANUAL lists cannot have filters. Use DYNAMIC or SNAPSHOT for filtered lists.',
        'VALIDATION_ERROR',
        400
      );
    }

    try {
      const requestBody = {
        name: params.name,
        objectTypeId: params.objectTypeId,
        processingType: params.processingType,
        ...(params.filterBranch && { filterBranch: params.filterBranch })
      };

      const response = await this.client.apiRequest({
        method: 'POST',
        path: '/crm/v3/lists/',
        body: requestBody
      });

      // Check if response is wrapped in body/data field
      const responseAny = response as any;
      const actualData = responseAny.body || responseAny.data || response;

      // Return response with debug info for troubleshooting
      const result = this.transformListResponse(actualData);
      (result as any).__debug = {
        rawApiResponse: response,
        actualData: actualData,
        requestSent: requestBody,
        availableFields: Object.keys(actualData || {}),
        responseType: typeof response,
        hasBody: !!responseAny.body,
        hasData: !!responseAny.data
      };

      return result;
    } catch (e: any) {
      this.handleListsApiError(e, 'createList');
    }
  }

  /**
   * Retrieves a list by ID
   *
   * @param listId - List ID to retrieve
   * @param includeFilters - Whether to include filter definitions (default: true)
   * @returns List object
   * @throws BcpError if list not found
   */
  async getList(listId: string, includeFilters: boolean = true): Promise<List> {
    this.checkInitialized();

    if (!listId) {
      throw new BcpError('List ID is required', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v3/lists/${listId}?includeFilters=${includeFilters}`
      });

      return this.transformListResponse(response);
    } catch (e: any) {
      if (e.code === 404 || e.body?.category === 'OBJECT_NOT_FOUND') {
        throw new BcpError(`List with ID '${listId}' not found`, 'NOT_FOUND', 404);
      }
      this.handleListsApiError(e, 'getList');
    }
  }

  /**
   * Searches lists with optional filters
   *
   * @param params - Search parameters
   * @returns Search results with pagination
   */
  async searchLists(params: SearchListsParams = {}): Promise<SearchListsResponse> {
    this.checkInitialized();

    const searchRequest: any = {
      listIds: params.listIds || [],
      offset: params.offset || 0,
      count: params.count || 50,
      processingTypes: params.processingTypes || [],
      additionalProperties: params.additionalProperties || [],
      query: params.query || '',
      includeFilters: params.includeFilters !== false
    };

    try {
      const response = await this.client.apiRequest({
        method: 'POST',
        path: '/crm/v3/lists/search',
        body: searchRequest
      });

      const typedResponse = response as any;
      const lists = typedResponse.lists || [];

      return {
        lists: lists.map((list: any) => this.transformListResponse(list)),
        total: lists.length,
        hasMore: lists.length === searchRequest.count
      };
    } catch (e: any) {
      this.handleListsApiError(e, 'searchLists');
    }
  }

  /**
   * Updates a list name
   *
   * @param listId - List ID
   * @param name - New list name
   * @returns Updated List object
   */
  async updateListName(listId: string, name: string): Promise<List> {
    this.checkInitialized();

    if (!listId || !name) {
      throw new BcpError('List ID and name are required', 'VALIDATION_ERROR', 400);
    }

    try {
      await this.client.apiRequest({
        method: 'PUT',
        path: `/crm/v3/lists/${listId}/update-list-name`,
        body: { name }
      });
      return this.getList(listId, false);
    } catch (e: any) {
      if (e.code === 404 || e.body?.category === 'OBJECT_NOT_FOUND') {
        throw new BcpError(`List with ID '${listId}' not found`, 'NOT_FOUND', 404);
      }
      this.handleListsApiError(e, 'updateListName');
    }
  }

  /**
   * Deletes (archives) a list
   *
   * @param listId - List ID to delete
   */
  async deleteList(listId: string): Promise<void> {
    this.checkInitialized();

    if (!listId) {
      throw new BcpError('List ID is required', 'VALIDATION_ERROR', 400);
    }

    try {
      await this.client.apiRequest({
        method: 'DELETE',
        path: `/crm/v3/lists/${listId}`
      });
    } catch (e: any) {
      if (e.code === 404 || e.body?.category === 'OBJECT_NOT_FOUND') {
        throw new BcpError(`List with ID '${listId}' not found`, 'NOT_FOUND', 404);
      }
      this.handleListsApiError(e, 'deleteList');
    }
  }

  /**
   * Updates filter definitions for DYNAMIC lists
   *
   * @param listId - List ID
   * @param filterBranch - New filter branch structure
   * @returns Updated List object
   * @throws BcpError if list is not DYNAMIC or validation failures
   */
  async updateListFilters(
    listId: string,
    filterBranch: FilterBranch
  ): Promise<List> {
    this.checkInitialized();

    if (!listId || !filterBranch) {
      throw new BcpError(
        'List ID and filterBranch are required',
        'VALIDATION_ERROR',
        400
      );
    }

    // Validate filter structure
    this.validateFilterStructure(filterBranch);

    // Fetch list to validate processing type
    const list = await this.getList(listId, false);

    if (!isDynamicList(list)) {
      throw new BcpError(
        `Cannot update filters on ${list.processingType} lists. Only DYNAMIC lists support filter updates.`,
        'CONFLICT',
        409
      );
    }

    try {
      await this.client.apiRequest({
        method: 'PUT',
        path: `/crm/v3/lists/${listId}/update-list-filters`,
        body: { filterBranch }
      });

      // Fetch updated list to return
      return this.getList(listId, true);
    } catch (e: any) {
      this.handleListsApiError(e, 'updateListFilters');
    }
  }

  /**
   * Adds members to a list (MANUAL or SNAPSHOT only)
   *
   * @param listId - List ID
   * @param recordIds - Array of record IDs to add (max 100,000)
   * @returns Membership operation result
   * @throws BcpError if list is DYNAMIC or other validation failures
   */
  async addMembers(listId: string, recordIds: string[]): Promise<MembershipResult> {
    this.checkInitialized();

    if (!listId || !recordIds || recordIds.length === 0) {
      throw new BcpError(
        'List ID and at least one record ID are required',
        'VALIDATION_ERROR',
        400
      );
    }

    if (recordIds.length > 100000) {
      throw new BcpError(
        'Maximum 100,000 records can be added per operation',
        'VALIDATION_ERROR',
        400
      );
    }

    // Fetch list to validate processing type
    const list = await this.getList(listId, false);

    if (!canAddMembersManually(list)) {
      throw new BcpError(
        'Cannot manually add members to DYNAMIC lists. Update filters instead using updateListFilters.',
        'CONFLICT',
        409
      );
    }

    try {
      await this.client.apiRequest({
        method: 'PUT',
        path: `/crm/v3/lists/${listId}/memberships/add`,
        body: { recordIds }
      });

      return {
        success: true,
        recordsAdded: recordIds.length,
        listId: listId
      };
    } catch (e: any) {
      this.handleListsApiError(e, 'addMembers');
    }
  }

  /**
   * Removes members from a list (MANUAL or SNAPSHOT only)
   *
   * @param listId - List ID
   * @param recordIds - Array of record IDs to remove (max 100,000)
   * @returns Membership operation result
   */
  async removeMembers(listId: string, recordIds: string[]): Promise<MembershipResult> {
    this.checkInitialized();

    if (!listId || !recordIds || recordIds.length === 0) {
      throw new BcpError(
        'List ID and at least one record ID are required',
        'VALIDATION_ERROR',
        400
      );
    }

    if (recordIds.length > 100000) {
      throw new BcpError(
        'Maximum 100,000 records can be removed per operation',
        'VALIDATION_ERROR',
        400
      );
    }

    // Fetch list to validate processing type
    const list = await this.getList(listId, false);

    if (!canAddMembersManually(list)) {
      throw new BcpError(
        'Cannot manually remove members from DYNAMIC lists. Update filters instead using updateListFilters.',
        'CONFLICT',
        409
      );
    }

    try {
      await this.client.apiRequest({
        method: 'PUT',
        path: `/crm/v3/lists/${listId}/memberships/remove`,
        body: { recordIds }
      });

      return {
        success: true,
        recordsRemoved: recordIds.length,
        listId: listId
      };
    } catch (e: any) {
      this.handleListsApiError(e, 'removeMembers');
    }
  }

  /**
   * Gets list members with pagination
   *
   * @param listId - List ID
   * @param params - Pagination parameters
   * @returns Paginated members page
   */
  async getMembers(listId: string, params?: GetMembersParams): Promise<MembersPage> {
    this.checkInitialized();

    if (!listId) {
      throw new BcpError('List ID is required', 'VALIDATION_ERROR', 400);
    }

    const limit = params?.limit && params.limit > 0 && params.limit <= 500 ? params.limit : 100;
    const after = params?.after;

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('limit', limit.toString());
      if (after) {
        queryParams.append('after', after);
      }

      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v3/lists/${listId}/memberships?${queryParams.toString()}`
      });

      const typedResponse = response as any;
      const results = typedResponse.results || [];

      const members: ListMember[] = results.map((result: any) => ({
        recordId: result.id || result.recordId || String(result),
        addedAt: result.addedAt || undefined
      }));

      return {
        members,
        pagination: typedResponse.paging?.next ? { after: typedResponse.paging.next.after } : undefined,
        total: typedResponse.total || members.length
      };
    } catch (e: any) {
      if (e.code === 404 || e.body?.category === 'OBJECT_NOT_FOUND') {
        throw new BcpError(`List with ID '${listId}' not found`, 'NOT_FOUND', 404);
      }
      this.handleListsApiError(e, 'getMembers');
    }
  }

  /**
   * Validates that a filter branch follows HubSpot's required structure:
   * - Root must be OR branch
   * - Root must have empty filters array
   * - Children must be AND branches
   * - AND branches contain actual filters
   */
  private validateFilterStructure(filterBranch: FilterBranch): void {
    // Root must be OR
    if (filterBranch.filterBranchType !== 'OR') {
      throw new BcpError(
        'Root filter branch must be of type OR',
        'VALIDATION_ERROR',
        400
      );
    }

    // Root must have empty filters
    if (filterBranch.filters && filterBranch.filters.length > 0) {
      throw new BcpError(
        'Root OR branch must have empty filters array. Place filters in child AND branches.',
        'VALIDATION_ERROR',
        400
      );
    }

    // Must have at least one AND branch
    if (!filterBranch.filterBranches || filterBranch.filterBranches.length === 0) {
      throw new BcpError(
        'Filter branch must contain at least one child AND branch',
        'VALIDATION_ERROR',
        400
      );
    }

    // Validate AND branches
    filterBranch.filterBranches.forEach((andBranch, index) => {
      if (andBranch.filterBranchType !== 'AND') {
        throw new BcpError(
          `Child branch ${index} must be of type AND`,
          'VALIDATION_ERROR',
          400
        );
      }

      if (!andBranch.filters || andBranch.filters.length === 0) {
        throw new BcpError(
          `AND branch ${index} must contain at least one filter`,
          'VALIDATION_ERROR',
          400
        );
      }
    });
  }

  /**
   * Specialized error handler for Lists API errors
   */
  private handleListsApiError(error: any, context: string): never {
    const statusCode = error.response?.statusCode || error.statusCode || error.code;
    const body = error.response?.body || error.body || {};

    switch (statusCode) {
      case 400:
        throw new BcpError(
          `Invalid request: ${body.message || 'Check filter structure and parameters'}`,
          'VALIDATION_ERROR',
          400
        );

      case 403:
        throw new BcpError(
          'Missing required scope: crm.lists.read or crm.lists.write',
          'MISSING_SCOPES',
          403
        );

      case 404:
        throw new BcpError(
          'List not found',
          'NOT_FOUND',
          404
        );

      case 409:
        throw new BcpError(
          'Cannot perform operation: conflict with list processing type',
          'CONFLICT',
          409
        );

      case 429:
        throw new BcpError(
          'Rate limit exceeded',
          'RATE_LIMIT',
          429
        );

      default:
        return this.handleApiError(error, context);
    }
  }

  /**
   * Transforms HubSpot API response to our List interface
   */
  private transformListResponse(response: any): List {
    // Validate required fields exist
    if (!response) {
      throw new BcpError(
        'API returned null/undefined response',
        'INVALID_RESPONSE',
        500
      );
    }

    const listId = response.listId || response.id || response.IlsListId;
    if (!listId) {
      throw new BcpError(
        `Response missing listId field. Available fields: ${Object.keys(response).join(', ')}. Response: ${JSON.stringify(response)}`,
        'INVALID_RESPONSE',
        500
      );
    }

    if (!response.name) {
      throw new BcpError(
        `Response missing name field. Available fields: ${Object.keys(response).join(', ')}. Response: ${JSON.stringify(response)}`,
        'INVALID_RESPONSE',
        500
      );
    }

    return {
      listId,
      name: response.name,
      objectTypeId: response.objectTypeId || '0-1',
      processingType: response.processingType || 'MANUAL',
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
      archived: response.archived || false,
      filterBranch: response.filterBranch,
      membershipCount: response.membershipCount
    };
  }
}
