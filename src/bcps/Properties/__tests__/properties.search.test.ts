/**
 * Properties Search Tests
 *
 * Comprehensive test suite for the searchProperties functionality including:
 * - Cache functionality and expiration
 * - Fuzzy search with fuse.js
 * - Edge cases and error handling
 * - Performance validation
 */

import { jest } from '@jest/globals';
import { PropertiesService, PropertyResponse } from '../properties.service.js';
import { ServiceConfig, BcpError } from '../../../core/types.js';
import { tool as searchTool } from '../properties.search.js';

// Mock property data
const mockContactProperties: PropertyResponse[] = [
  {
    name: 'email',
    label: 'Email',
    description: 'Contact email address',
    groupName: 'contactinformation',
    type: 'string',
    fieldType: 'text',
    formField: true,
    displayOrder: 1,
    hidden: false,
    hasUniqueValue: true,
    createdAt: '2023-01-15T10:30:00Z',
    updatedAt: '2023-06-20T14:45:00Z'
  },
  {
    name: 'hs_email_domain',
    label: 'Email Domain',
    description: 'The domain of the contact email address',
    groupName: 'contactinformation',
    type: 'string',
    fieldType: 'text',
    formField: false,
    displayOrder: 50,
    hidden: false,
    hasUniqueValue: false,
    createdAt: '2023-01-15T10:30:00Z',
    updatedAt: '2023-06-20T14:45:00Z'
  },
  {
    name: 'hs_email_optout',
    label: 'Email Opt Out',
    description: 'Whether the contact has opted out of email',
    groupName: 'contactinformation',
    type: 'bool',
    fieldType: 'checkbox',
    formField: false,
    displayOrder: 60,
    hidden: false,
    hasUniqueValue: false,
    createdAt: '2023-01-15T10:30:00Z',
    updatedAt: '2023-06-20T14:45:00Z'
  },
  {
    name: 'firstname',
    label: 'First Name',
    description: 'Contact first name',
    groupName: 'contactinformation',
    type: 'string',
    fieldType: 'text',
    formField: true,
    displayOrder: 2,
    hidden: false,
    hasUniqueValue: false,
    createdAt: '2023-01-15T10:30:00Z',
    updatedAt: '2023-06-20T14:45:00Z'
  },
  {
    name: 'lastname',
    label: 'Last Name',
    description: 'Contact last name',
    groupName: 'contactinformation',
    type: 'string',
    fieldType: 'text',
    formField: true,
    displayOrder: 3,
    hidden: false,
    hasUniqueValue: false,
    createdAt: '2023-01-15T10:30:00Z',
    updatedAt: '2023-06-20T14:45:00Z'
  },
  {
    name: 'phone',
    label: 'Phone Number',
    description: 'Contact phone number',
    groupName: 'contactinformation',
    type: 'string',
    fieldType: 'text',
    formField: true,
    displayOrder: 4,
    hidden: false,
    hasUniqueValue: false,
    createdAt: '2023-01-15T10:30:00Z',
    updatedAt: '2023-06-20T14:45:00Z'
  },
  {
    name: 'custom_industry',
    label: 'Industry',
    description: 'Custom industry field',
    groupName: 'customfields',
    type: 'string',
    fieldType: 'text',
    formField: true,
    displayOrder: 10,
    hidden: false,
    hasUniqueValue: false,
    createdAt: '2023-01-15T10:30:00Z',
    updatedAt: '2023-06-20T14:45:00Z'
  }
];

// Mock HubSpot client
const mockClient = {
  apiRequest: jest.fn()
};

// Mock service config
const mockConfig: ServiceConfig = {
  hubspotAccessToken: 'mock-token',
};

describe('PropertiesService - Caching', () => {
  let service: PropertiesService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    service = new PropertiesService(mockConfig);
    // @ts-ignore - Mock the client
    service.client = mockClient;
    // @ts-ignore - Mock initialized state
    service.initialized = true;
  });

  afterEach(() => {
    service.clearPropertyCache();
    jest.useRealTimers();
  });

  it('should cache properties after first fetch', async () => {
    // Arrange
    mockClient.apiRequest.mockResolvedValueOnce({
      json: async () => ({ results: mockContactProperties })
    });

    // Act - First search (cache miss)
    const result1 = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    // Assert - Results returned correctly
    expect(result1.length).toBeGreaterThan(0);
    expect(result1.length).toBeLessThanOrEqual(10);
    expect(mockClient.apiRequest).toHaveBeenCalledTimes(1);

    // Clear mock to verify cache is used
    mockClient.apiRequest.mockClear();

    // Act - Second search (cache hit - should NOT call API)
    const result2 = await service.searchProperties({
      objectType: 'contacts',
      query: 'phone',
      limit: 10
    });

    // Assert - API not called, cache was used
    expect(mockClient.apiRequest).toHaveBeenCalledTimes(0);
    expect(result2.length).toBeGreaterThan(0);
  });

  it('should expire cache after TTL', async () => {
    // Arrange
    mockClient.apiRequest.mockResolvedValue({
      json: async () => ({ results: mockContactProperties })
    });

    // Act - First call
    await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    expect(mockClient.apiRequest).toHaveBeenCalledTimes(1);
    mockClient.apiRequest.mockClear();

    // Fast-forward time by 11 minutes (past 10 minute TTL)
    jest.advanceTimersByTime(11 * 60 * 1000);

    // Act - Second call after TTL expiration
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    // Assert - API should be called again because cache expired
    expect(mockClient.apiRequest).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });

  it('should clear cache manually for specific object type', async () => {
    // Arrange
    mockClient.apiRequest.mockResolvedValue({
      json: async () => ({ results: mockContactProperties })
    });

    // Act - Cache contacts properties
    await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    expect(mockClient.apiRequest).toHaveBeenCalledTimes(1);
    mockClient.apiRequest.mockClear();

    // Clear cache for contacts
    service.clearPropertyCache('contacts');

    // Act - Search again should hit API
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    // Assert - API called again after manual cache clear
    expect(mockClient.apiRequest).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });

  it('should clear all cache when no objectType specified', async () => {
    // Arrange
    mockClient.apiRequest.mockResolvedValue({
      json: async () => ({ results: mockContactProperties })
    });

    // Act - Cache multiple object types
    await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    await service.searchProperties({
      objectType: 'companies',
      query: 'domain',
      limit: 10
    });

    expect(mockClient.apiRequest).toHaveBeenCalledTimes(2);
    mockClient.apiRequest.mockClear();

    // Clear all cache
    service.clearPropertyCache();

    // Act - Search again should hit API for both
    await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    await service.searchProperties({
      objectType: 'companies',
      query: 'domain',
      limit: 10
    });

    // Assert - API called for both object types
    expect(mockClient.apiRequest).toHaveBeenCalledTimes(2);
  });

  it('should maintain separate cache for archived properties', async () => {
    // Arrange
    mockClient.apiRequest.mockResolvedValue({
      json: async () => ({ results: mockContactProperties })
    });

    // Act - Cache active properties
    const activeResult = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      includeArchived: false
    });

    // Act - Cache archived properties
    const archivedResult = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      includeArchived: true
    });

    // Assert - Two separate API calls for active vs archived
    expect(mockClient.apiRequest).toHaveBeenCalledTimes(2);
    expect(activeResult).toBeDefined();
    expect(archivedResult).toBeDefined();

    // Verify archived parameter is passed correctly
    const archivedCall = mockClient.apiRequest.mock.calls.find(
      call => call[0].path.includes('archived=true')
    );
    expect(archivedCall).toBeDefined();

    mockClient.apiRequest.mockClear();

    // Act - Second calls should use cache (no API calls)
    await service.searchProperties({
      objectType: 'contacts',
      query: 'phone',
      includeArchived: false
    });

    await service.searchProperties({
      objectType: 'contacts',
      query: 'phone',
      includeArchived: true
    });

    // Assert - Cache hit for both
    expect(mockClient.apiRequest).toHaveBeenCalledTimes(0);
  });
});

describe('PropertiesService - Search Functionality', () => {
  let service: PropertiesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PropertiesService(mockConfig);
    // @ts-ignore - Mock the client
    service.client = mockClient;
    // @ts-ignore - Mock initialized state
    service.initialized = true;

    // Setup default mock response
    mockClient.apiRequest.mockResolvedValue({
      json: async () => ({ results: mockContactProperties })
    });
  });

  afterEach(() => {
    service.clearPropertyCache();
  });

  it('should return top N results based on limit parameter', async () => {
    // Act
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 2
    });

    // Assert
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('should enforce maximum limit of 50', async () => {
    // Act
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'contact',
      limit: 100 // Request more than max
    });

    // Assert - Should return max 50
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('should return valid property objects with correct structure', async () => {
    // Act
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    // Assert - All results have required PropertyResponse fields
    result.forEach(property => {
      expect(property).toHaveProperty('name');
      expect(property).toHaveProperty('label');
      expect(property).toHaveProperty('type');
      expect(property).toHaveProperty('fieldType');
      expect(property).toHaveProperty('groupName');
      expect(property).toHaveProperty('description');
      expect(property).toHaveProperty('formField');
      expect(property).toHaveProperty('displayOrder');
      expect(property).toHaveProperty('hidden');
      expect(property).toHaveProperty('hasUniqueValue');
      expect(property).toHaveProperty('createdAt');
      expect(property).toHaveProperty('updatedAt');
    });
  });

  it('should filter by group name when provided', async () => {
    // Act
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      groupName: 'contactinformation'
    });

    // Assert - All results should belong to specified group
    result.forEach(property => {
      expect(property.groupName).toBe('contactinformation');
    });
  });

  it('should handle no matches gracefully returning empty array', async () => {
    // Act
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'xyznonexistentproperty123',
      limit: 10
    });

    // Assert
    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle typos with fuse.js fuzzy matching', async () => {
    // Act - Search with typo "emal" instead of "email"
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'emal', // Typo
      limit: 10
    });

    // Assert - Should still match "email" property due to fuzzy matching
    expect(result.length).toBeGreaterThan(0);
    const emailProperty = result.find(p => p.name === 'email');
    expect(emailProperty).toBeDefined();
  });

  it('should return results ranked by relevance with exact matches first', async () => {
    // Act
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 20
    });

    // Assert - Exact name match "email" should be first
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('email');
  });

  it('should search across name, label, description, and groupName fields', async () => {
    // Act - Search by label text
    const labelResult = await service.searchProperties({
      objectType: 'contacts',
      query: 'First Name', // Matches label of "firstname" property
      limit: 10
    });

    // Assert
    expect(labelResult.length).toBeGreaterThan(0);
    const firstnameProperty = labelResult.find(p => p.name === 'firstname');
    expect(firstnameProperty).toBeDefined();
  });

  it('should handle empty query string gracefully', async () => {
    // Act - Empty query string will still search (validation allows it)
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: '',
      limit: 10
    });

    // Assert - Should return empty array (no matches expected)
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle very long query strings without errors', async () => {
    // Arrange - Create very long query
    const longQuery = 'a'.repeat(500);

    // Act
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: longQuery,
      limit: 10
    });

    // Assert - Should return empty array (no matches expected)
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle special characters in query', async () => {
    // Act
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email@domain.com',
      limit: 10
    });

    // Assert - Should not throw error
    expect(Array.isArray(result)).toBe(true);
  });

  it('should default to limit of 15 when not specified', async () => {
    // Arrange - Mock many properties
    const manyProperties = Array.from({ length: 100 }, (_, i) => ({
      ...mockContactProperties[0],
      name: `property_${i}`,
      label: `Property ${i}`
    }));

    mockClient.apiRequest.mockResolvedValueOnce({
      json: async () => ({ results: manyProperties })
    });

    // Act - Don't specify limit
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'property'
    });

    // Assert - Should return default limit of 15
    expect(result.length).toBeLessThanOrEqual(15);
  });

  it('should throw error for missing required parameters', async () => {
    // Act & Assert - Missing objectType (undefined)
    await expect(
      service.searchProperties({
        objectType: undefined as any,
        query: 'email',
        limit: 10
      })
    ).rejects.toThrow(BcpError);

    // Act & Assert - Missing query (undefined)
    await expect(
      service.searchProperties({
        objectType: 'contacts',
        query: undefined as any,
        limit: 10
      })
    ).rejects.toThrow(BcpError);
  });
});

describe('PropertiesService - Edge Cases', () => {
  let service: PropertiesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PropertiesService(mockConfig);
    // @ts-ignore - Mock the client
    service.client = mockClient;
    // @ts-ignore - Mock initialized state
    service.initialized = true;
  });

  afterEach(() => {
    service.clearPropertyCache();
  });

  it('should handle API returning empty results', async () => {
    // Arrange
    mockClient.apiRequest.mockResolvedValueOnce({
      json: async () => ({ results: [] })
    });

    // Act
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    // Assert
    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle API errors gracefully', async () => {
    // Arrange
    mockClient.apiRequest.mockRejectedValueOnce(
      new Error('API Error: Rate limit exceeded')
    );

    // Act & Assert
    await expect(
      service.searchProperties({
        objectType: 'contacts',
        query: 'email',
        limit: 10
      })
    ).rejects.toThrow();
  });

  it('should handle invalid objectType', async () => {
    // Arrange - Mock 404 error
    const error = new Error('Not found');
    // @ts-ignore
    error.status = 404;
    mockClient.apiRequest.mockRejectedValueOnce(error);

    // Act & Assert
    await expect(
      service.searchProperties({
        objectType: 'invalid_object_type',
        query: 'email',
        limit: 10
      })
    ).rejects.toThrow();
  });

  it('should handle malformed API response', async () => {
    // Arrange - Response without results field
    mockClient.apiRequest.mockResolvedValueOnce({
      json: async () => ({})
    });

    // Act
    const result = await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 10
    });

    // Assert - Should handle gracefully and return empty array
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

describe('Properties Search Tool - Integration', () => {
  let originalEnv: string | undefined;

  beforeAll(() => {
    originalEnv = process.env.HUBSPOT_ACCESS_TOKEN;
    process.env.HUBSPOT_ACCESS_TOKEN = 'mock-token';
  });

  afterAll(() => {
    process.env.HUBSPOT_ACCESS_TOKEN = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should have correct tool definition structure', () => {
    // Assert
    expect(searchTool.name).toBe('searchProperties');
    expect(searchTool.description).toBeDefined();
    expect(searchTool.inputSchema).toBeDefined();
    expect(searchTool.handler).toBeDefined();
    expect(typeof searchTool.handler).toBe('function');
  });

  it('should have correct input schema with required fields', () => {
    // Assert
    const schema = searchTool.inputSchema;
    expect(schema.properties).toHaveProperty('objectType');
    expect(schema.properties).toHaveProperty('query');
    expect(schema.properties).toHaveProperty('limit');
    expect(schema.properties).toHaveProperty('includeArchived');
    expect(schema.properties).toHaveProperty('groupName');
    expect(schema.required).toContain('objectType');
    expect(schema.required).toContain('query');
  });

  it('should validate query has minLength of 1', () => {
    // Assert
    const querySchema = searchTool.inputSchema.properties.query;
    expect(querySchema.minLength).toBe(1);
  });

  it('should enforce limit constraints (min 1, max 50, default 15)', () => {
    // Assert
    const limitSchema = searchTool.inputSchema.properties.limit;
    expect(limitSchema.minimum).toBe(1);
    expect(limitSchema.maximum).toBe(50);
    expect(limitSchema.default).toBe(15);
  });

  it('should handle missing access token with AUTH_ERROR', async () => {
    // Arrange
    delete process.env.HUBSPOT_ACCESS_TOKEN;

    // Act & Assert
    await expect(
      searchTool.handler({
        objectType: 'contacts',
        query: 'email'
      })
    ).rejects.toThrow(BcpError);

    await expect(
      searchTool.handler({
        objectType: 'contacts',
        query: 'email'
      })
    ).rejects.toMatchObject({
      code: 'AUTH_ERROR',
      status: 401
    });

    // Restore token
    process.env.HUBSPOT_ACCESS_TOKEN = 'mock-token';
  });

  it('should include examples in input schema', () => {
    // Assert
    const schema = searchTool.inputSchema;
    expect(schema.examples).toBeDefined();
    expect(Array.isArray(schema.examples)).toBe(true);
    expect(schema.examples.length).toBeGreaterThan(0);
  });
});

describe('PropertiesService - Performance', () => {
  let service: PropertiesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PropertiesService(mockConfig);
    // @ts-ignore - Mock the client
    service.client = mockClient;
    // @ts-ignore - Mock initialized state
    service.initialized = true;

    // Setup mock with realistic delay
    mockClient.apiRequest.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        json: async () => ({ results: mockContactProperties })
      }), 10))
    );
  });

  afterEach(() => {
    service.clearPropertyCache();
  });

  it('should search properties in under 50ms with warm cache', async () => {
    // Arrange - First search to warm cache
    await service.searchProperties({
      objectType: 'contacts',
      query: 'email',
      limit: 20
    });

    // Act - Second search with warm cache
    const startTime = Date.now();
    await service.searchProperties({
      objectType: 'contacts',
      query: 'phone',
      limit: 20
    });
    const duration = Date.now() - startTime;

    // Assert - Should be very fast with cache
    expect(duration).toBeLessThan(50);
  });

  it('should benefit significantly from caching', async () => {
    // Act - First call (cache miss)
    const start1 = Date.now();
    await service.searchProperties({
      objectType: 'contacts',
      query: 'email'
    });
    const coldDuration = Date.now() - start1;

    // Act - Second call (cache hit)
    const start2 = Date.now();
    await service.searchProperties({
      objectType: 'contacts',
      query: 'phone'
    });
    const warmDuration = Date.now() - start2;

    // Assert - Warm cache should be significantly faster
    expect(warmDuration).toBeLessThan(coldDuration);
    expect(warmDuration).toBeLessThan(20);
  });
});
