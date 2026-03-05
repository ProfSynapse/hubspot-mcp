/**
 * Lists Service Unit Tests
 *
 * Comprehensive unit tests for the ListsService class.
 * Tests all service methods with mocked HubSpot API client.
 */

import { jest } from '@jest/globals';
import { ListsService } from '../lists.service.js';
import {
  List,
  CreateListParams,
  SearchListsParams,
  GetMembersParams,
  FilterBranch,
  ProcessingType,
  isDynamicList,
  isManualList,
  isSnapshotList,
  canAddMembersManually,
  requiresFilters
} from '../lists.types.js';
import { ServiceConfig, BcpError } from '../../../core/types.js';

// Mock HubSpot client
const mockClient = {
  apiRequest: jest.fn(),
};

// Mock service config
const mockConfig: ServiceConfig = {
  hubspotAccessToken: 'mock-token',
};

// Test data factories
const createMockList = (overrides?: Partial<List>): List => ({
  listId: '123',
  name: 'Test List',
  objectTypeId: '0-1',
  processingType: 'MANUAL',
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  archived: false,
  ...overrides,
});

const createValidFilterBranch = (): FilterBranch => ({
  filterBranchType: 'OR',
  filters: [],
  filterBranches: [
    {
      filterBranchType: 'AND',
      filters: [
        {
          filterType: 'PROPERTY',
          property: 'email',
          operation: {
            operationType: 'MULTISTRING',
            operator: 'CONTAINS',
            values: ['@example.com'],
          },
        },
      ],
      filterBranches: [],
    },
  ],
});

describe('ListsService', () => {
  let service: ListsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.apiRequest.mockReset();
    service = new ListsService(mockConfig);
    // @ts-ignore - Mock the client
    service.client = mockClient;
    // @ts-ignore - Mock initialized state
    service.initialized = true;
  });

  describe('Service Initialization', () => {
    it('should create service with valid access token', () => {
      const newService = new ListsService({ hubspotAccessToken: 'test-token' });
      expect(newService).toBeInstanceOf(ListsService);
    });

    it('should extend HubspotBaseService', () => {
      expect(service).toHaveProperty('checkInitialized');
      expect(service).toHaveProperty('validateRequired');
      expect(service).toHaveProperty('handleApiError');
    });
  });

  describe('createList()', () => {
    describe('MANUAL list creation', () => {
      it('should create a MANUAL list successfully', async () => {
        const params: CreateListParams = {
          name: 'Test Manual List',
          objectTypeId: '0-1',
          processingType: 'MANUAL',
        };

        const expectedResponse = createMockList({
          name: 'Test Manual List',
          processingType: 'MANUAL',
        });

        mockClient.apiRequest.mockResolvedValueOnce(expectedResponse);

        const result = await service.createList(params);

        expect(mockClient.apiRequest).toHaveBeenCalledWith({
          method: 'POST',
          path: '/crm/v3/lists/',
          body: {
            name: 'Test Manual List',
            objectTypeId: '0-1',
            processingType: 'MANUAL',
          },
        });
        expect(result).toEqual(expect.objectContaining({
          name: 'Test Manual List',
          processingType: 'MANUAL',
        }));
      });

      it('should reject MANUAL list with filterBranch', async () => {
        const params: CreateListParams = {
          name: 'Invalid Manual List',
          objectTypeId: '0-1',
          processingType: 'MANUAL',
          filterBranch: createValidFilterBranch(),
        };

        await expect(service.createList(params)).rejects.toThrow(BcpError);
        await expect(service.createList(params)).rejects.toMatchObject({
          code: 'VALIDATION_ERROR',
          status: 400,
          message: expect.stringContaining('MANUAL lists cannot have filters'),
        });
      });
    });

    describe('DYNAMIC list creation', () => {
      it('should create a DYNAMIC list with filters successfully', async () => {
        const filterBranch = createValidFilterBranch();
        const params: CreateListParams = {
          name: 'Test Dynamic List',
          objectTypeId: '0-1',
          processingType: 'DYNAMIC',
          filterBranch,
        };

        const expectedResponse = createMockList({
          name: 'Test Dynamic List',
          processingType: 'DYNAMIC',
          filterBranch,
        });

        mockClient.apiRequest.mockResolvedValueOnce(expectedResponse);

        const result = await service.createList(params);

        expect(mockClient.apiRequest).toHaveBeenCalledWith({
          method: 'POST',
          path: '/crm/v3/lists/',
          body: {
            name: 'Test Dynamic List',
            objectTypeId: '0-1',
            processingType: 'DYNAMIC',
            filterBranch,
          },
        });
        expect(result.processingType).toBe('DYNAMIC');
        expect(result.filterBranch).toBeDefined();
      });

      it('should require filterBranch for DYNAMIC lists', async () => {
        const params: CreateListParams = {
          name: 'Invalid Dynamic List',
          objectTypeId: '0-1',
          processingType: 'DYNAMIC',
          // Missing filterBranch
        };

        await expect(service.createList(params)).rejects.toThrow(BcpError);
        await expect(service.createList(params)).rejects.toMatchObject({
          code: 'VALIDATION_ERROR',
          status: 400,
          message: expect.stringContaining('DYNAMIC lists require filterBranch'),
        });
      });

      it('should validate filter structure for DYNAMIC lists', async () => {
        const invalidFilterBranch: FilterBranch = {
          filterBranchType: 'AND', // Should be OR
          filters: [],
          filterBranches: [],
        };

        const params: CreateListParams = {
          name: 'Invalid Filter List',
          objectTypeId: '0-1',
          processingType: 'DYNAMIC',
          filterBranch: invalidFilterBranch,
        };

        await expect(service.createList(params)).rejects.toThrow(BcpError);
        await expect(service.createList(params)).rejects.toMatchObject({
          code: 'VALIDATION_ERROR',
          status: 400,
          message: expect.stringContaining('Root filter branch must be of type OR'),
        });
      });
    });

    describe('SNAPSHOT list creation', () => {
      it('should create a SNAPSHOT list with filters successfully', async () => {
        const filterBranch = createValidFilterBranch();
        const params: CreateListParams = {
          name: 'Test Snapshot List',
          objectTypeId: '0-1',
          processingType: 'SNAPSHOT',
          filterBranch,
        };

        const expectedResponse = createMockList({
          name: 'Test Snapshot List',
          processingType: 'SNAPSHOT',
          filterBranch,
        });

        mockClient.apiRequest.mockResolvedValueOnce(expectedResponse);

        const result = await service.createList(params);

        expect(result.processingType).toBe('SNAPSHOT');
        expect(result.filterBranch).toBeDefined();
      });

      it('should require filterBranch for SNAPSHOT lists', async () => {
        const params: CreateListParams = {
          name: 'Invalid Snapshot List',
          objectTypeId: '0-1',
          processingType: 'SNAPSHOT',
        };

        await expect(service.createList(params)).rejects.toThrow(BcpError);
        await expect(service.createList(params)).rejects.toMatchObject({
          code: 'VALIDATION_ERROR',
          status: 400,
        });
      });
    });

    describe('Validation', () => {
      it('should require name', async () => {
        const params = {
          objectTypeId: '0-1',
          processingType: 'MANUAL',
        } as CreateListParams;

        await expect(service.createList(params)).rejects.toThrow();
      });

      it('should require objectTypeId', async () => {
        const params = {
          name: 'Test List',
          processingType: 'MANUAL',
        } as CreateListParams;

        await expect(service.createList(params)).rejects.toThrow();
      });

      it('should require processingType', async () => {
        const params = {
          name: 'Test List',
          objectTypeId: '0-1',
        } as CreateListParams;

        await expect(service.createList(params)).rejects.toThrow();
      });
    });
  });

  describe('getList()', () => {
    it('should retrieve a list by ID successfully', async () => {
      const mockList = createMockList();
      mockClient.apiRequest.mockResolvedValueOnce(mockList);

      const result = await service.getList('123');

      expect(mockClient.apiRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/crm/v3/lists/123?includeFilters=true',
      });
      expect(result).toEqual(expect.objectContaining({
        listId: '123',
        name: 'Test List',
      }));
    });

    it('should support includeFilters parameter', async () => {
      const mockList = createMockList();
      mockClient.apiRequest.mockResolvedValueOnce(mockList);

      await service.getList('123', false);

      expect(mockClient.apiRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/crm/v3/lists/123?includeFilters=false',
      });
    });

    it('should throw NOT_FOUND error for non-existent list', async () => {
      const error: any = new Error('Not found');
      error.code = 404;
      error.body = { category: 'OBJECT_NOT_FOUND' };
      mockClient.apiRequest.mockRejectedValue(error);

      try {
        await service.getList('999');
        fail('Should have thrown error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BcpError);
        expect(err.code).toBe('NOT_FOUND');
        expect(err.status).toBe(404);
      }
    });

    it('should require listId parameter', async () => {
      await expect(service.getList('')).rejects.toThrow(BcpError);
      await expect(service.getList('')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
      });
    });
  });

  describe('searchLists()', () => {
    it('should search lists without filters', async () => {
      const mockResponse = {
        lists: [createMockList()],
      };
      mockClient.apiRequest.mockResolvedValueOnce(mockResponse);

      const result = await service.searchLists();

      expect(mockClient.apiRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/crm/v3/lists/search',
        body: {
          listIds: [],
          offset: 0,
          count: 50,
          processingTypes: [],
          additionalProperties: [],
          query: '',
          includeFilters: true,
        },
      });
      expect(result.lists).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should search with query parameter', async () => {
      const mockResponse = {
        lists: [createMockList({ name: 'VIP Customers' })],
      };
      mockClient.apiRequest.mockResolvedValueOnce(mockResponse);

      const params: SearchListsParams = {
        query: 'VIP',
        count: 20,
      };

      const result = await service.searchLists(params);

      expect(mockClient.apiRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: 'VIP',
            count: 20,
          }),
        })
      );
      expect(result.lists[0].name).toBe('VIP Customers');
    });

    it('should filter by processingType', async () => {
      const mockResponse = {
        lists: [
          createMockList({ processingType: 'DYNAMIC' }),
          createMockList({ processingType: 'MANUAL' }),
        ],
      };
      mockClient.apiRequest.mockResolvedValueOnce(mockResponse);

      const params: SearchListsParams = {
        processingTypes: ['MANUAL', 'DYNAMIC'],
      };

      await service.searchLists(params);

      expect(mockClient.apiRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            processingTypes: ['MANUAL', 'DYNAMIC'],
          }),
        })
      );
    });

    it('should support pagination', async () => {
      const mockResponse = {
        lists: Array(50)
          .fill(null)
          .map((_, i) => createMockList({ listId: `${i}` })),
      };
      mockClient.apiRequest.mockResolvedValueOnce(mockResponse);

      const params: SearchListsParams = {
        offset: 50,
        count: 50,
      };

      const result = await service.searchLists(params);

      expect(mockClient.apiRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            offset: 50,
            count: 50,
          }),
        })
      );
      expect(result.hasMore).toBe(true);
    });
  });

  describe('updateListName()', () => {
    it('should update list name successfully', async () => {
      mockClient.apiRequest.mockResolvedValueOnce({});
      const updatedList = createMockList({ name: 'Updated Name' });
      mockClient.apiRequest.mockResolvedValueOnce(updatedList);

      const result = await service.updateListName('123', 'Updated Name');

      expect(mockClient.apiRequest).toHaveBeenNthCalledWith(1, {
        method: 'PUT',
        path: '/crm/v3/lists/123/update-list-name',
        body: { name: 'Updated Name' },
      });
      expect(result.name).toBe('Updated Name');
    });

    it('should require listId', async () => {
      await expect(service.updateListName('', 'New Name')).rejects.toThrow(
        BcpError
      );
    });

    it('should require name', async () => {
      await expect(service.updateListName('123', '')).rejects.toThrow(
        BcpError
      );
    });

    it('should throw NOT_FOUND for non-existent list', async () => {
      const error: any = new Error('Not found');
      error.code = 404;
      error.body = { category: 'OBJECT_NOT_FOUND' };
      mockClient.apiRequest.mockRejectedValue(error);

      try {
        await service.updateListName('999', 'New Name');
        fail('Should have thrown error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BcpError);
        expect(err.code).toBe('NOT_FOUND');
        expect(err.status).toBe(404);
      }
    });
  });

  describe('deleteList()', () => {
    it('should delete list successfully', async () => {
      mockClient.apiRequest.mockResolvedValueOnce({});

      await service.deleteList('123');

      expect(mockClient.apiRequest).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/crm/v3/lists/123',
      });
    });

    it('should require listId', async () => {
      await expect(service.deleteList('')).rejects.toThrow(BcpError);
    });

    it('should throw NOT_FOUND for non-existent list', async () => {
      const error: any = new Error('Not found');
      error.code = 404;
      error.body = { category: 'OBJECT_NOT_FOUND' };
      mockClient.apiRequest.mockRejectedValue(error);

      try {
        await service.deleteList('999');
        fail('Should have thrown error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BcpError);
        expect(err.code).toBe('NOT_FOUND');
        expect(err.status).toBe(404);
      }
    });
  });

  describe('updateListFilters()', () => {
    it('should update filters for DYNAMIC list successfully', async () => {
      const dynamicList = createMockList({ processingType: 'DYNAMIC' });
      mockClient.apiRequest.mockResolvedValueOnce(dynamicList);

      const newFilterBranch = createValidFilterBranch();
      mockClient.apiRequest.mockResolvedValueOnce({});

      const updatedList = createMockList({
        processingType: 'DYNAMIC',
        filterBranch: newFilterBranch,
      });
      mockClient.apiRequest.mockResolvedValueOnce(updatedList);

      const result = await service.updateListFilters('123', newFilterBranch);

      expect(mockClient.apiRequest).toHaveBeenNthCalledWith(2, {
        method: 'PUT',
        path: '/crm/v3/lists/123/update-list-filters',
        body: { filterBranch: newFilterBranch },
      });
      expect(result.filterBranch).toBeDefined();
    });

    it('should reject updating filters on MANUAL list', async () => {
      const manualList = createMockList({ processingType: 'MANUAL' });
      // Need to mock getList call (which is called internally)
      mockClient.apiRequest.mockResolvedValueOnce(manualList);

      const filterBranch = createValidFilterBranch();

      try {
        await service.updateListFilters('123', filterBranch);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BcpError);
        expect(error.code).toBe('CONFLICT');
        expect(error.status).toBe(409);
        expect(error.message).toContain('Only DYNAMIC lists');
      }
    });

    it('should reject updating filters on SNAPSHOT list', async () => {
      const snapshotList = createMockList({ processingType: 'SNAPSHOT' });
      // Need to mock getList call (which is called internally)
      mockClient.apiRequest.mockResolvedValueOnce(snapshotList);

      const filterBranch = createValidFilterBranch();

      try {
        await service.updateListFilters('123', filterBranch);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BcpError);
        expect(error.code).toBe('CONFLICT');
        expect(error.status).toBe(409);
      }
    });

    it('should validate filter structure', async () => {
      const dynamicList = createMockList({ processingType: 'DYNAMIC' });
      mockClient.apiRequest.mockResolvedValueOnce(dynamicList);

      const invalidFilterBranch: FilterBranch = {
        filterBranchType: 'OR',
        filters: [
          {
            filterType: 'PROPERTY',
            property: 'email',
            operation: {
              operationType: 'MULTISTRING',
              operator: 'CONTAINS',
              values: ['test'],
            },
          },
        ], // Should be empty
        filterBranches: [],
      };

      await expect(
        service.updateListFilters('123', invalidFilterBranch)
      ).rejects.toThrow(BcpError);
      await expect(
        service.updateListFilters('123', invalidFilterBranch)
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: expect.stringContaining('Root OR branch must have empty filters'),
      });
    });
  });

  describe('addMembers()', () => {
    it('should add members to MANUAL list successfully', async () => {
      const manualList = createMockList({ processingType: 'MANUAL' });
      // Mock getList call
      mockClient.apiRequest.mockResolvedValueOnce(manualList);
      // Mock addMembers call
      mockClient.apiRequest.mockResolvedValueOnce({});

      const recordIds = ['contact1', 'contact2', 'contact3'];
      const result = await service.addMembers('123', recordIds);

      expect(mockClient.apiRequest).toHaveBeenCalledTimes(2);
      expect(mockClient.apiRequest).toHaveBeenNthCalledWith(2, {
        method: 'PUT',
        path: '/crm/v3/lists/123/memberships/add',
        body: { recordIds },
      });
      expect(result.success).toBe(true);
      expect(result.recordsAdded).toBe(3);
      expect(result.listId).toBe('123');
    });

    it('should add members to SNAPSHOT list successfully', async () => {
      const snapshotList = createMockList({ processingType: 'SNAPSHOT' });
      mockClient.apiRequest.mockResolvedValueOnce(snapshotList);
      mockClient.apiRequest.mockResolvedValueOnce({});

      const recordIds = ['contact1', 'contact2'];
      const result = await service.addMembers('123', recordIds);

      expect(result.success).toBe(true);
      expect(result.recordsAdded).toBe(2);
    });

    it('should reject adding members to DYNAMIC list', async () => {
      const dynamicList = createMockList({ processingType: 'DYNAMIC' });
      // Mock getList call
      mockClient.apiRequest.mockResolvedValueOnce(dynamicList);

      const recordIds = ['contact1'];

      try {
        await service.addMembers('123', recordIds);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BcpError);
        expect(error.code).toBe('CONFLICT');
        expect(error.status).toBe(409);
        expect(error.message).toContain('Cannot manually add members to DYNAMIC');
      }
    });

    it('should validate batch size limit (100k)', async () => {
      const recordIds = Array(100001)
        .fill(null)
        .map((_, i) => `record${i}`);

      await expect(service.addMembers('123', recordIds)).rejects.toThrow(
        BcpError
      );
      await expect(service.addMembers('123', recordIds)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: expect.stringContaining('100,000 records'),
      });
    });

    it('should require at least one record ID', async () => {
      await expect(service.addMembers('123', [])).rejects.toThrow(BcpError);
    });

    it('should require listId', async () => {
      await expect(service.addMembers('', ['contact1'])).rejects.toThrow(
        BcpError
      );
    });
  });

  describe('removeMembers()', () => {
    it('should remove members from MANUAL list successfully', async () => {
      const manualList = createMockList({ processingType: 'MANUAL' });
      // Mock getList call
      mockClient.apiRequest.mockResolvedValueOnce(manualList);
      // Mock removeMembers call
      mockClient.apiRequest.mockResolvedValueOnce({});

      const recordIds = ['contact1', 'contact2'];
      const result = await service.removeMembers('123', recordIds);

      expect(mockClient.apiRequest).toHaveBeenCalledTimes(2);
      expect(mockClient.apiRequest).toHaveBeenNthCalledWith(2, {
        method: 'PUT',
        path: '/crm/v3/lists/123/memberships/remove',
        body: { recordIds },
      });
      expect(result.success).toBe(true);
      expect(result.recordsRemoved).toBe(2);
    });

    it('should remove members from SNAPSHOT list successfully', async () => {
      const snapshotList = createMockList({ processingType: 'SNAPSHOT' });
      mockClient.apiRequest.mockResolvedValueOnce(snapshotList);
      mockClient.apiRequest.mockResolvedValueOnce({});

      const result = await service.removeMembers('123', ['contact1']);

      expect(result.success).toBe(true);
      expect(result.recordsRemoved).toBe(1);
    });

    it('should reject removing members from DYNAMIC list', async () => {
      const dynamicList = createMockList({ processingType: 'DYNAMIC' });
      // Mock getList call
      mockClient.apiRequest.mockResolvedValueOnce(dynamicList);

      try {
        await service.removeMembers('123', ['contact1']);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BcpError);
        expect(error.code).toBe('CONFLICT');
        expect(error.status).toBe(409);
        expect(error.message).toContain('Cannot manually remove members');
      }
    });

    it('should validate batch size limit', async () => {
      const recordIds = Array(100001).fill('record');

      await expect(service.removeMembers('123', recordIds)).rejects.toThrow(
        BcpError
      );
    });
  });

  describe('getMembers()', () => {
    it('should get list members with default pagination', async () => {
      const mockResponse = {
        results: [
          'contact1',
          'contact2',
        ],
        paging: {
          next: {
            after: 'cursor-token',
          },
        },
        total: 2,
      };
      mockClient.apiRequest.mockResolvedValueOnce(mockResponse);

      const result = await service.getMembers('123');

      expect(mockClient.apiRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/crm/v3/lists/123/memberships?limit=100',
      });
      expect(result.members).toHaveLength(2);
      expect(result.members[0].recordId).toBe('contact1');
      expect(result.pagination?.after).toBe('cursor-token');
      expect(result.total).toBe(2);
    });

    it('should support custom limit', async () => {
      const mockResponse = { results: [], total: 0 };
      mockClient.apiRequest.mockResolvedValueOnce(mockResponse);

      const params: GetMembersParams = { limit: 250 };
      await service.getMembers('123', params);

      expect(mockClient.apiRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/crm/v3/lists/123/memberships?limit=250',
      });
    });

    it('should support cursor-based pagination', async () => {
      const mockResponse = { results: [], total: 0 };
      mockClient.apiRequest.mockResolvedValueOnce(mockResponse);

      const params: GetMembersParams = {
        limit: 100,
        after: 'cursor-token',
      };
      await service.getMembers('123', params);

      expect(mockClient.apiRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/crm/v3/lists/123/memberships?limit=100&after=cursor-token',
      });
    });

    it('should enforce maximum limit of 500', async () => {
      const mockResponse = { results: [], total: 0 };
      mockClient.apiRequest.mockResolvedValueOnce(mockResponse);

      const params: GetMembersParams = { limit: 1000 }; // Over limit
      await service.getMembers('123', params);

      // Should cap at 100 (default) since 1000 > 500
      expect(mockClient.apiRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/crm/v3/lists/123/memberships?limit=100',
      });
    });

    it('should require listId', async () => {
      await expect(service.getMembers('')).rejects.toThrow(BcpError);
    });

    it('should throw NOT_FOUND for non-existent list', async () => {
      const error: any = new Error('Not found');
      error.code = 404;
      error.body = { category: 'OBJECT_NOT_FOUND' };
      mockClient.apiRequest.mockRejectedValue(error);

      try {
        await service.getMembers('999');
        fail('Should have thrown error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BcpError);
        expect(err.code).toBe('NOT_FOUND');
        expect(err.status).toBe(404);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle 400 validation errors', async () => {
      const error: any = new Error('Bad request');
      error.response = {
        statusCode: 400,
        body: { message: 'Invalid filter structure' },
      };
      error.statusCode = 400;
      mockClient.apiRequest.mockRejectedValueOnce(error);

      const params: CreateListParams = {
        name: 'Test',
        objectTypeId: '0-1',
        processingType: 'MANUAL',
      };

      await expect(service.createList(params)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
      });
    });

    it('should handle 403 missing scopes errors', async () => {
      const error: any = new Error('Forbidden');
      error.response = {
        statusCode: 403,
        body: {},
      };
      error.statusCode = 403;
      mockClient.apiRequest.mockRejectedValueOnce(error);

      await expect(service.searchLists()).rejects.toMatchObject({
        code: 'MISSING_SCOPES',
        status: 403,
        message: expect.stringContaining('crm.lists.read or crm.lists.write'),
      });
    });

    it('should handle 429 rate limit errors', async () => {
      const error: any = new Error('Rate limited');
      error.response = {
        statusCode: 429,
        body: {},
      };
      error.statusCode = 429;
      mockClient.apiRequest.mockRejectedValueOnce(error);

      await expect(service.searchLists()).rejects.toMatchObject({
        code: 'RATE_LIMIT',
        status: 429,
      });
    });
  });

  describe('Filter Structure Validation', () => {
    it('should reject non-OR root branch', () => {
      const invalidFilter: FilterBranch = {
        filterBranchType: 'AND',
        filters: [],
        filterBranches: [],
      };

      expect(() => {
        // @ts-ignore - Testing private method behavior through public API
        service['validateFilterStructure'](invalidFilter);
      }).toThrow('Root filter branch must be of type OR');
    });

    it('should reject OR root with non-empty filters', () => {
      const invalidFilter: FilterBranch = {
        filterBranchType: 'OR',
        filters: [
          {
            filterType: 'PROPERTY',
            property: 'email',
            operation: { operationType: 'MULTISTRING', operator: 'IS_KNOWN' },
          },
        ],
        filterBranches: [],
      };

      expect(() => {
        // @ts-ignore
        service['validateFilterStructure'](invalidFilter);
      }).toThrow('Root OR branch must have empty filters array');
    });

    it('should reject OR root without child branches', () => {
      const invalidFilter: FilterBranch = {
        filterBranchType: 'OR',
        filters: [],
        filterBranches: [],
      };

      expect(() => {
        // @ts-ignore
        service['validateFilterStructure'](invalidFilter);
      }).toThrow('must contain at least one child AND branch');
    });

    it('should reject non-AND child branches', () => {
      const invalidFilter: FilterBranch = {
        filterBranchType: 'OR',
        filters: [],
        filterBranches: [
          {
            filterBranchType: 'OR', // Should be AND
            filters: [],
            filterBranches: [],
          },
        ],
      };

      expect(() => {
        // @ts-ignore
        service['validateFilterStructure'](invalidFilter);
      }).toThrow('Child branch 0 must be of type AND');
    });

    it('should reject AND branches without filters', () => {
      const invalidFilter: FilterBranch = {
        filterBranchType: 'OR',
        filters: [],
        filterBranches: [
          {
            filterBranchType: 'AND',
            filters: [], // Empty
            filterBranches: [],
          },
        ],
      };

      expect(() => {
        // @ts-ignore
        service['validateFilterStructure'](invalidFilter);
      }).toThrow('AND branch 0 must contain at least one filter');
    });

    it('should accept valid filter structure', () => {
      const validFilter = createValidFilterBranch();

      // Should not throw
      expect(() => {
        // @ts-ignore
        service['validateFilterStructure'](validFilter);
      }).not.toThrow();
    });
  });

  describe('Type Guards', () => {
    it('isDynamicList should identify DYNAMIC lists', () => {
      const dynamicList = createMockList({ processingType: 'DYNAMIC' });
      expect(isDynamicList(dynamicList)).toBe(true);

      const manualList = createMockList({ processingType: 'MANUAL' });
      expect(isDynamicList(manualList)).toBe(false);
    });

    it('isManualList should identify MANUAL lists', () => {
      const manualList = createMockList({ processingType: 'MANUAL' });
      expect(isManualList(manualList)).toBe(true);

      const dynamicList = createMockList({ processingType: 'DYNAMIC' });
      expect(isManualList(dynamicList)).toBe(false);
    });

    it('isSnapshotList should identify SNAPSHOT lists', () => {
      const snapshotList = createMockList({ processingType: 'SNAPSHOT' });
      expect(isSnapshotList(snapshotList)).toBe(true);

      const manualList = createMockList({ processingType: 'MANUAL' });
      expect(isSnapshotList(manualList)).toBe(false);
    });

    it('canAddMembersManually should work correctly', () => {
      const manualList = createMockList({ processingType: 'MANUAL' });
      expect(canAddMembersManually(manualList)).toBe(true);

      const snapshotList = createMockList({ processingType: 'SNAPSHOT' });
      expect(canAddMembersManually(snapshotList)).toBe(true);

      const dynamicList = createMockList({ processingType: 'DYNAMIC' });
      expect(canAddMembersManually(dynamicList)).toBe(false);
    });

    it('requiresFilters should work correctly', () => {
      expect(requiresFilters('DYNAMIC')).toBe(true);
      expect(requiresFilters('SNAPSHOT')).toBe(true);
      expect(requiresFilters('MANUAL')).toBe(false);
    });
  });
});
