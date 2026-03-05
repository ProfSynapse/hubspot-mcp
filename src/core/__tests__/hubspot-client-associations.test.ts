/**
 * HubSpot Client Associations Integration Tests
 *
 * Integration tests for the enhanced HubSpot client with association enrichment.
 * These tests verify the integration between the client and the Association Enrichment Engine.
 */

import { HubspotApiClient } from '../hubspot-client.js';
import { AssociationOptions, EnhancedContact } from '../association-enrichment-engine.js';
import { ApiError } from '../types.js';

// Mock the @hubspot/api-client
jest.mock('@hubspot/api-client', () => ({
  Client: jest.fn().mockImplementation(() => ({
    crm: {
      contacts: {
        basicApi: {
          create: jest.fn(),
          getById: jest.fn(),
          update: jest.fn()
        },
        searchApi: {
          doSearch: jest.fn()
        }
      }
    },
    apiRequest: jest.fn()
  }))
}));

// Test data fixtures
const createMockContact = (id: string = '12345') => ({
  id,
  properties: {
    email: 'test@example.com',
    firstname: 'John',
    lastname: 'Doe',
    company: 'Test Company'
  },
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z'
});

const createMockSearchResponse = (contacts: any[], total: number = contacts.length) => ({
  results: contacts,
  total,
  paging: {}
});

const createMockAssociationResponse = (objectType: string, count: number = 2) => ({
  results: Array.from({ length: count }, (_, i) => ({
    toObjectId: `${objectType}-${i + 1}`,
    associationSpec: {
      associationTypeId: 1
    }
  }))
});

const createMockBatchObjectResponse = (objectType: string, count: number = 2) => {
  const results = Array.from({ length: count }, (_, i) => ({
    id: `${objectType}-${i + 1}`,
    properties: {},
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  }));

  // Add type-specific properties
  results.forEach((obj, i) => {
    switch (objectType) {
      case 'companies':
        obj.properties = {
          name: `Test Company ${i + 1}`,
          domain: `test${i + 1}.com`,
          industry: 'Technology'
        };
        break;
      case 'deals':
        obj.properties = {
          dealname: `Test Deal ${i + 1}`,
          amount: '50000',
          dealstage: 'proposal',
          pipeline: 'sales'
        };
        break;
      case 'notes':
        obj.properties = {
          hs_note_body: `Test note ${i + 1}`,
          hs_timestamp: Date.now().toString()
        };
        break;
    }
  });

  return { results };
};

describe('HubspotApiClient - Association Integration', () => {
  let client: HubspotApiClient;
  let mockHubspotClient: any;

  beforeEach(() => {
    client = new HubspotApiClient('test-token');
    mockHubspotClient = (client as any).client;
    jest.clearAllMocks();
  });

  describe('searchContactsByEmail with associations', () => {
    it('should search contacts without associations (backward compatibility)', async () => {
      const mockContacts = [createMockContact('1'), createMockContact('2')];
      mockHubspotClient.crm.contacts.searchApi.doSearch.mockResolvedValueOnce(
        createMockSearchResponse(mockContacts)
      );

      const result = await client.searchContactsByEmail('test@example.com', 10);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].associations).toBeUndefined();
      expect(mockHubspotClient.crm.contacts.searchApi.doSearch).toHaveBeenCalledWith({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: 'test@example.com'
          }]
        }],
        sorts: [],
        after: 0,
        limit: 10,
        properties: ['email', 'firstname', 'lastname', 'company', 'phone']
      });
    });

    it('should search contacts with association enrichment', async () => {
      const mockContacts = [createMockContact('1')];
      const associationOptions: AssociationOptions = {
        associationTypes: ['companies', 'deals'],
        associationLimit: 25
      };

      // Mock the contact search
      mockHubspotClient.crm.contacts.searchApi.doSearch.mockResolvedValueOnce(
        createMockSearchResponse(mockContacts)
      );

      // Mock association enrichment calls
      mockHubspotClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse('companies', 2))
        .mockResolvedValueOnce(createMockBatchObjectResponse('companies', 2))
        .mockResolvedValueOnce(createMockAssociationResponse('deals', 1))
        .mockResolvedValueOnce(createMockBatchObjectResponse('deals', 1));

      const result = await client.searchContactsByEmail(
        'test@example.com',
        10,
        false,
        associationOptions
      );

      expect(result).toHaveLength(1);
      expect(result[0].associations?.companies).toHaveLength(2);
      expect(result[0].associations?.deals).toHaveLength(1);
      expect(result[0].associationMetadata?.totalAssociationCount).toEqual({
        companies: 2,
        deals: 1
      });
    });

    it('should handle legacy includeAssociations parameter', async () => {
      const mockContacts = [createMockContact('1')];

      mockHubspotClient.crm.contacts.searchApi.doSearch.mockResolvedValueOnce(
        createMockSearchResponse(mockContacts)
      );

      // Mock legacy company enrichment
      mockHubspotClient.crm.contacts.basicApi.getById.mockResolvedValueOnce({
        ...mockContacts[0],
        associations: {
          companies: {
            results: [{ id: 'company-123' }]
          }
        }
      });

      mockHubspotClient.crm.companies.basicApi.getById.mockResolvedValueOnce({
        id: 'company-123',
        properties: { name: 'Test Company' }
      });

      const result = await client.searchContactsByEmail('test@example.com', 10, true);

      expect(result).toHaveLength(1);
      expect(result[0].properties.associatedCompanyId).toBe('company-123');
      expect(result[0].properties.associatedCompanyName).toBe('Test Company');
    });

    it('should handle association enrichment errors gracefully', async () => {
      const mockContacts = [createMockContact('1')];
      const associationOptions: AssociationOptions = {
        associationTypes: ['companies', 'deals']
      };

      mockHubspotClient.crm.contacts.searchApi.doSearch.mockResolvedValueOnce(
        createMockSearchResponse(mockContacts)
      );

      // Mock successful companies, failed deals
      mockHubspotClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse('companies', 1))
        .mockResolvedValueOnce(createMockBatchObjectResponse('companies', 1))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'));

      const result = await client.searchContactsByEmail(
        'test@example.com',
        10,
        false,
        associationOptions
      );

      expect(result).toHaveLength(1);
      expect(result[0].associations?.companies).toHaveLength(1);
      expect(result[0].associations?.deals).toHaveLength(0);
      expect(result[0].associationMetadata?.partialFailures).toContain('deals');
    });
  });

  describe('searchContactsByName with associations', () => {
    it('should search by single name with associations', async () => {
      const mockContacts = [createMockContact('1')];
      const associationOptions: AssociationOptions = {
        associationTypes: ['companies']
      };

      // Mock exact match (should not be found for single name)
      mockHubspotClient.crm.contacts.searchApi.doSearch
        .mockResolvedValueOnce(createMockSearchResponse([])) // Exact match
        .mockResolvedValueOnce(createMockSearchResponse(mockContacts)); // Token search

      // Mock association enrichment
      mockHubspotClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse('companies', 1))
        .mockResolvedValueOnce(createMockBatchObjectResponse('companies', 1));

      const result = await client.searchContactsByName(
        'John',
        10,
        false,
        associationOptions
      );

      expect(result).toHaveLength(1);
      expect(result[0].associations?.companies).toHaveLength(1);
    });

    it('should search by full name with exact match and associations', async () => {
      const mockContacts = [createMockContact('1')];
      const associationOptions: AssociationOptions = {
        associationTypes: ['deals']
      };

      // Mock exact match found
      mockHubspotClient.crm.contacts.searchApi.doSearch.mockResolvedValueOnce(
        createMockSearchResponse(mockContacts)
      );

      // Mock association enrichment
      mockHubspotClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse('deals', 2))
        .mockResolvedValueOnce(createMockBatchObjectResponse('deals', 2));

      const result = await client.searchContactsByName(
        'John Doe',
        10,
        false,
        associationOptions
      );

      expect(result).toHaveLength(1);
      expect(result[0].associations?.deals).toHaveLength(2);
    });
  });

  describe('getContact with associations', () => {
    it('should get contact without associations (backward compatibility)', async () => {
      const mockContact = createMockContact('123');
      mockHubspotClient.crm.contacts.basicApi.getById.mockResolvedValueOnce(mockContact);

      const result = await client.getContact('123');

      expect(result.id).toBe('123');
      expect(result.associations).toBeUndefined();
      expect(mockHubspotClient.crm.contacts.basicApi.getById).toHaveBeenCalledWith('123');
    });

    it('should get contact with association enrichment', async () => {
      const mockContact = createMockContact('123');
      const associationOptions: AssociationOptions = {
        associationTypes: ['companies', 'notes'],
        associationLimit: 30
      };

      mockHubspotClient.crm.contacts.basicApi.getById.mockResolvedValueOnce(mockContact);

      // Mock association enrichment
      mockHubspotClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse('companies', 1))
        .mockResolvedValueOnce(createMockBatchObjectResponse('companies', 1))
        .mockResolvedValueOnce(createMockAssociationResponse('notes', 3))
        .mockResolvedValueOnce(createMockBatchObjectResponse('notes', 3));

      const result = await client.getContact('123', associationOptions);

      expect(result.id).toBe('123');
      expect(result.associations?.companies).toHaveLength(1);
      expect(result.associations?.notes).toHaveLength(3);
      expect(result.associationMetadata?.totalAssociationCount).toEqual({
        companies: 1,
        notes: 3
      });
    });

    it('should handle contact not found error', async () => {
      const error = new Error('Contact not found');
      mockHubspotClient.crm.contacts.basicApi.getById.mockRejectedValueOnce(error);

      await expect(client.getContact('999')).rejects.toThrow();
    });
  });

  describe('getRecentContacts with associations', () => {
    it('should get recent contacts without associations', async () => {
      const mockContacts = [createMockContact('1'), createMockContact('2')];
      mockHubspotClient.crm.contacts.searchApi.doSearch.mockResolvedValueOnce(
        createMockSearchResponse(mockContacts)
      );

      const result = await client.getRecentContacts(5);

      expect(result).toHaveLength(2);
      expect(result[0].associations).toBeUndefined();
      expect(mockHubspotClient.crm.contacts.searchApi.doSearch).toHaveBeenCalledWith({
        filterGroups: [],
        sorts: [{
          propertyName: 'createdate',
          direction: 'DESCENDING'
        }],
        after: 0,
        limit: 5,
        properties: ['email', 'firstname', 'lastname']
      });
    });

    it('should get recent contacts with association enrichment', async () => {
      const mockContacts = [createMockContact('1'), createMockContact('2')];
      const associationOptions: AssociationOptions = {
        associationTypes: ['companies', 'deals']
      };

      mockHubspotClient.crm.contacts.searchApi.doSearch.mockResolvedValueOnce(
        createMockSearchResponse(mockContacts)
      );

      // Mock association enrichment for both contacts
      mockHubspotClient.apiRequest
        // Contact 1 associations
        .mockResolvedValueOnce(createMockAssociationResponse('companies', 1))
        .mockResolvedValueOnce(createMockBatchObjectResponse('companies', 1))
        .mockResolvedValueOnce(createMockAssociationResponse('deals', 2))
        .mockResolvedValueOnce(createMockBatchObjectResponse('deals', 2))
        // Contact 2 associations
        .mockResolvedValueOnce(createMockAssociationResponse('companies', 1))
        .mockResolvedValueOnce(createMockBatchObjectResponse('companies', 1))
        .mockResolvedValueOnce(createMockAssociationResponse('deals', 1))
        .mockResolvedValueOnce(createMockBatchObjectResponse('deals', 1));

      const result = await client.getRecentContacts(5, associationOptions);

      expect(result).toHaveLength(2);
      expect(result[0].associations?.companies).toHaveLength(1);
      expect(result[0].associations?.deals).toHaveLength(2);
      expect(result[1].associations?.companies).toHaveLength(1);
      expect(result[1].associations?.deals).toHaveLength(1);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle API errors consistently', async () => {
      const error = new Error('HubSpot API Error');
      mockHubspotClient.crm.contacts.searchApi.doSearch.mockRejectedValueOnce(error);

      await expect(client.searchContactsByEmail('test@example.com')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      const networkError = new TypeError('Failed to fetch');
      mockHubspotClient.crm.contacts.searchApi.doSearch.mockRejectedValueOnce(networkError);

      await expect(client.searchContactsByEmail('test@example.com')).rejects.toThrow();
    });

    it('should continue search when association enrichment fails', async () => {
      const mockContacts = [createMockContact('1')];
      const associationOptions: AssociationOptions = {
        associationTypes: ['companies']
      };

      mockHubspotClient.crm.contacts.searchApi.doSearch.mockResolvedValueOnce(
        createMockSearchResponse(mockContacts)
      );

      // Mock association enrichment failure
      mockHubspotClient.apiRequest.mockRejectedValueOnce(new Error('Association API failed'));

      const result = await client.searchContactsByEmail(
        'test@example.com',
        10,
        false,
        associationOptions
      );

      // Should still return the contact, but without associations
      expect(result).toHaveLength(1);
      expect(result[0].associations?.companies).toEqual([]);
      expect(result[0].associationMetadata?.partialFailures).toContain('companies');
    });
  });

  describe('Performance Integration', () => {
    it('should handle multiple association types efficiently', async () => {
      const mockContacts = [createMockContact('1')];
      const associationOptions: AssociationOptions = {
        associationTypes: ['companies', 'deals', 'notes', 'emails', 'tasks'],
        associationLimit: 100
      };

      mockHubspotClient.crm.contacts.searchApi.doSearch.mockResolvedValueOnce(
        createMockSearchResponse(mockContacts)
      );

      // Mock all association calls
      associationOptions.associationTypes.forEach(type => {
        mockHubspotClient.apiRequest
          .mockResolvedValueOnce(createMockAssociationResponse(type, 5))
          .mockResolvedValueOnce(createMockBatchObjectResponse(type, 5));
      });

      const startTime = Date.now();
      const result = await client.searchContactsByEmail(
        'test@example.com',
        10,
        false,
        associationOptions
      );
      const duration = Date.now() - startTime;

      expect(result).toHaveLength(1);
      expect(result[0].associations?.companies).toHaveLength(5);
      expect(result[0].associations?.deals).toHaveLength(5);
      expect(result[0].associations?.notes).toHaveLength(5);
      expect(result[0].associations?.emails).toHaveLength(5);
      expect(result[0].associations?.tasks).toHaveLength(5);
      expect(duration).toBeLessThan(1000); // Should complete reasonably fast with mocks
    });

    it('should handle large contact lists with associations', async () => {
      const mockContacts = Array.from({ length: 50 }, (_, i) => createMockContact(`contact-${i}`));
      const associationOptions: AssociationOptions = {
        associationTypes: ['companies']
      };

      mockHubspotClient.crm.contacts.searchApi.doSearch.mockResolvedValueOnce(
        createMockSearchResponse(mockContacts)
      );

      // Mock association calls for all contacts
      mockContacts.forEach(() => {
        mockHubspotClient.apiRequest
          .mockResolvedValueOnce(createMockAssociationResponse('companies', 1))
          .mockResolvedValueOnce(createMockBatchObjectResponse('companies', 1));
      });

      const result = await client.searchContactsByEmail(
        'test@example.com',
        50,
        false,
        associationOptions
      );

      expect(result).toHaveLength(50);
      result.forEach(contact => {
        expect(contact.associations?.companies).toHaveLength(1);
      });
    });
  });

  describe('Type Safety Integration', () => {
    it('should maintain type safety with enriched contacts', async () => {
      const mockContacts = [createMockContact('1')];
      const associationOptions: AssociationOptions = {
        associationTypes: ['companies']
      };

      mockHubspotClient.crm.contacts.searchApi.doSearch.mockResolvedValueOnce(
        createMockSearchResponse(mockContacts)
      );

      mockHubspotClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse('companies', 1))
        .mockResolvedValueOnce(createMockBatchObjectResponse('companies', 1));

      const result: EnhancedContact[] = await client.searchContactsByEmail(
        'test@example.com',
        10,
        false,
        associationOptions
      );

      // TypeScript should enforce these types at compile time
      expect(typeof result[0].id).toBe('string');
      expect(typeof result[0].properties).toBe('object');
      expect(Array.isArray(result[0].associations?.companies)).toBe(true);
      expect(typeof result[0].associationMetadata?.enrichmentTimestamp).toBe('string');
    });
  });
});