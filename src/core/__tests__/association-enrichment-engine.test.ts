/**
 * Association Enrichment Engine Tests
 *
 * Comprehensive unit tests for the AssociationEnrichmentEngine class.
 * Tests cover all association types, error handling, batch operations,
 * and performance characteristics.
 */

import { AssociationEnrichmentEngine, AssociationType, AssociationOptions, BaseContact, EnhancedContact } from '../association-enrichment-engine.js';
import { ApiError } from '../types.js';

// Mock HubSpot client
const createMockClient = () => ({
  apiRequest: jest.fn(),
});

// Test data fixtures
const createTestContact = (id: string = '12345'): BaseContact => ({
  id,
  properties: {
    email: 'test@example.com',
    firstname: 'John',
    lastname: 'Doe'
  },
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z'
});

const createMockAssociationResponse = (count: number = 3) => ({
  results: Array.from({ length: count }, (_, i) => ({
    toObjectId: `obj-${i + 1}`,
    associationSpec: {
      associationTypeId: 1
    }
  }))
});

const createMockObjectResponse = (objectType: string, count: number = 3) => {
  const baseResponse = {
    results: Array.from({ length: count }, (_, i) => ({
      id: `obj-${i + 1}`,
      properties: {},
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }))
  };

  // Add type-specific properties
  baseResponse.results.forEach((obj, i) => {
    switch (objectType) {
      case 'companies':
        obj.properties = {
          name: `Company ${i + 1}`,
          domain: `company${i + 1}.com`,
          industry: 'Technology'
        };
        break;
      case 'deals':
        obj.properties = {
          dealname: `Deal ${i + 1}`,
          amount: '10000',
          dealstage: 'proposal',
          pipeline: 'sales'
        };
        break;
      case 'notes':
        obj.properties = {
          hs_note_body: `Note content ${i + 1}`,
          hs_timestamp: '1640995200000'
        };
        break;
      case 'emails':
        obj.properties = {
          hs_email_subject: `Email Subject ${i + 1}`,
          hs_email_text: `Email body ${i + 1}`,
          hs_email_direction: 'OUTGOING',
          hs_timestamp: '1640995200000'
        };
        break;
      case 'tasks':
        obj.properties = {
          hs_task_subject: `Task ${i + 1}`,
          hs_task_status: 'NOT_STARTED',
          hs_task_priority: 'HIGH'
        };
        break;
      case 'meetings':
        obj.properties = {
          hs_meeting_title: `Meeting ${i + 1}`,
          hs_meeting_start_time: '1640995200000',
          hs_meeting_end_time: '1640998800000'
        };
        break;
      case 'calls':
        obj.properties = {
          hs_call_title: `Call ${i + 1}`,
          hs_call_duration: '1800',
          hs_call_status: 'COMPLETED'
        };
        break;
      case 'tickets':
        obj.properties = {
          subject: `Ticket ${i + 1}`,
          hs_ticket_priority: 'HIGH',
          hs_ticket_category: 'TECHNICAL_ISSUE'
        };
        break;
      case 'quotes':
        obj.properties = {
          hs_title: `Quote ${i + 1}`,
          hs_quote_amount: '5000',
          hs_expiration_date: '1672531200000'
        };
        break;
    }
  });

  return baseResponse;
};

describe('AssociationEnrichmentEngine', () => {
  let engine: AssociationEnrichmentEngine;
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockClient();
    engine = new AssociationEnrichmentEngine(mockClient);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with HubSpot client', () => {
      expect(engine).toBeInstanceOf(AssociationEnrichmentEngine);
      expect(engine['client']).toBe(mockClient);
    });
  });

  describe('enrichContacts', () => {
    it('should return unchanged contacts when no contacts provided', async () => {
      const options: AssociationOptions = {
        associationTypes: ['companies']
      };

      const result = await engine.enrichContacts([], options);
      expect(result).toEqual([]);
      expect(mockClient.apiRequest).not.toHaveBeenCalled();
    });

    it('should return unchanged contacts when no association types provided', async () => {
      const contacts = [createTestContact()];
      const options: AssociationOptions = {
        associationTypes: []
      };

      const result = await engine.enrichContacts(contacts, options);
      expect(result).toEqual(contacts);
      expect(mockClient.apiRequest).not.toHaveBeenCalled();
    });

    it('should enrich multiple contacts in parallel', async () => {
      const contacts = [
        createTestContact('contact-1'),
        createTestContact('contact-2')
      ];
      const options: AssociationOptions = {
        associationTypes: ['companies']
      };

      // Mock successful association fetching
      mockClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse(2))
        .mockResolvedValueOnce(createMockObjectResponse('companies', 2))
        .mockResolvedValueOnce(createMockAssociationResponse(1))
        .mockResolvedValueOnce(createMockObjectResponse('companies', 1));

      const result = await engine.enrichContacts(contacts, options);

      expect(result).toHaveLength(2);
      expect(result[0].associations?.companies).toHaveLength(2);
      expect(result[1].associations?.companies).toHaveLength(1);
      expect(mockClient.apiRequest).toHaveBeenCalledTimes(4);
    });

    it('should handle partial failures gracefully', async () => {
      const contacts = [createTestContact()];
      const options: AssociationOptions = {
        associationTypes: ['companies', 'deals']
      };

      // Mock companies success, deals failure
      mockClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse(2))
        .mockResolvedValueOnce(createMockObjectResponse('companies', 2))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'));

      const result = await engine.enrichContacts(contacts, options);

      expect(result).toHaveLength(1);
      expect(result[0].associations?.companies).toHaveLength(2);
      expect(result[0].associations?.deals).toHaveLength(0);
      expect(result[0].associationMetadata?.partialFailures).toContain('deals');
    });
  });

  describe('enrichSingleContact', () => {
    it('should enrich contact with company associations', async () => {
      const contact = createTestContact();
      const options: AssociationOptions = {
        associationTypes: ['companies'],
        associationLimit: 10
      };

      mockClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse(3))
        .mockResolvedValueOnce(createMockObjectResponse('companies', 3));

      const result = await engine.enrichSingleContact(contact, options);

      expect(result.associations?.companies).toHaveLength(3);
      expect(result.associations?.companies?.[0]).toMatchObject({
        id: 'obj-1',
        name: 'Company 1',
        domain: 'company1.com',
        industry: 'Technology',
        associationType: 1
      });
      expect(result.associationMetadata?.totalAssociationCount.companies).toBe(3);
    });

    it('should enrich contact with deal associations', async () => {
      const contact = createTestContact();
      const options: AssociationOptions = {
        associationTypes: ['deals']
      };

      mockClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse(2))
        .mockResolvedValueOnce(createMockObjectResponse('deals', 2));

      const result = await engine.enrichSingleContact(contact, options);

      expect(result.associations?.deals).toHaveLength(2);
      expect(result.associations?.deals?.[0]).toMatchObject({
        id: 'obj-1',
        dealname: 'Deal 1',
        amount: 10000,
        dealstage: 'proposal',
        pipeline: 'sales',
        associationType: 1
      });
    });

    it('should enrich contact with note associations', async () => {
      const contact = createTestContact();
      const options: AssociationOptions = {
        associationTypes: ['notes']
      };

      mockClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse(1))
        .mockResolvedValueOnce(createMockObjectResponse('notes', 1));

      const result = await engine.enrichSingleContact(contact, options);

      expect(result.associations?.notes).toHaveLength(1);
      expect(result.associations?.notes?.[0]).toMatchObject({
        id: 'obj-1',
        body: 'Note content 1',
        timestamp: '1640995200000',
        associationType: 1
      });
    });

    it('should enrich contact with email associations', async () => {
      const contact = createTestContact();
      const options: AssociationOptions = {
        associationTypes: ['emails']
      };

      mockClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse(1))
        .mockResolvedValueOnce(createMockObjectResponse('emails', 1));

      const result = await engine.enrichSingleContact(contact, options);

      expect(result.associations?.emails).toHaveLength(1);
      expect(result.associations?.emails?.[0]).toMatchObject({
        id: 'obj-1',
        subject: 'Email Subject 1',
        text: 'Email body 1',
        direction: 'OUTGOING',
        associationType: 1
      });
    });

    it('should enrich contact with all association types', async () => {
      const contact = createTestContact();
      const options: AssociationOptions = {
        associationTypes: ['companies', 'deals', 'notes', 'emails', 'tasks', 'meetings', 'calls', 'tickets', 'quotes']
      };

      // Mock responses for all association types
      const associationTypes = options.associationTypes;
      associationTypes.forEach(type => {
        mockClient.apiRequest
          .mockResolvedValueOnce(createMockAssociationResponse(1))
          .mockResolvedValueOnce(createMockObjectResponse(type, 1));
      });

      const result = await engine.enrichSingleContact(contact, options);

      expect(result.associations?.companies).toHaveLength(1);
      expect(result.associations?.deals).toHaveLength(1);
      expect(result.associations?.notes).toHaveLength(1);
      expect(result.associations?.emails).toHaveLength(1);
      expect(result.associations?.tasks).toHaveLength(1);
      expect(result.associations?.meetings).toHaveLength(1);
      expect(result.associations?.calls).toHaveLength(1);
      expect(result.associations?.tickets).toHaveLength(1);
      expect(result.associations?.quotes).toHaveLength(1);
      expect(result.associationMetadata?.totalAssociationCount).toEqual({
        companies: 1,
        deals: 1,
        notes: 1,
        emails: 1,
        tasks: 1,
        meetings: 1,
        calls: 1,
        tickets: 1,
        quotes: 1
      });
    });

    it('should add enrichment timestamp metadata', async () => {
      const contact = createTestContact();
      const options: AssociationOptions = {
        associationTypes: ['companies']
      };

      mockClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse(1))
        .mockResolvedValueOnce(createMockObjectResponse('companies', 1));

      const beforeTime = new Date().toISOString();
      const result = await engine.enrichSingleContact(contact, options);
      const afterTime = new Date().toISOString();

      expect(result.associationMetadata?.enrichmentTimestamp).toBeDefined();
      expect(result.associationMetadata?.enrichmentTimestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.associationMetadata?.enrichmentTimestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('fetchAssociationsByType', () => {
    it('should return empty array when no associations exist', async () => {
      mockClient.apiRequest.mockResolvedValueOnce({ results: [] });

      const result = await engine['fetchAssociationsByType']('contact-123', 'companies', 50);

      expect(result).toEqual([]);
      expect(mockClient.apiRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/crm/v4/objects/contacts/contact-123/associations/companies?limit=50'
      });
    });

    it('should fetch and transform association data', async () => {
      mockClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse(2))
        .mockResolvedValueOnce(createMockObjectResponse('companies', 2));

      const result = await engine['fetchAssociationsByType']('contact-123', 'companies', 50);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'obj-1',
        name: 'Company 1',
        domain: 'company1.com',
        industry: 'Technology',
        associationType: 1
      });
    });

    it('should throw ApiError on API failure', async () => {
      mockClient.apiRequest.mockRejectedValueOnce(new Error('API Error'));

      await expect(
        engine['fetchAssociationsByType']('contact-123', 'companies', 50)
      ).rejects.toThrow(ApiError);
    });

    it('should respect association limit parameter', async () => {
      mockClient.apiRequest.mockResolvedValueOnce({ results: [] });

      await engine['fetchAssociationsByType']('contact-123', 'deals', 25);

      expect(mockClient.apiRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/crm/v4/objects/contacts/contact-123/associations/deals?limit=25'
      });
    });
  });

  describe('batchFetchObjects', () => {
    it('should return empty array for empty input', async () => {
      const result = await engine['batchFetchObjects']('companies', []);
      expect(result).toEqual([]);
      expect(mockClient.apiRequest).not.toHaveBeenCalled();
    });

    it('should use batch API for small datasets', async () => {
      const objectIds = ['1', '2', '3'];
      mockClient.apiRequest.mockResolvedValueOnce(createMockObjectResponse('companies', 3));

      const result = await engine['batchFetchObjects']('companies', objectIds);

      expect(result).toHaveLength(3);
      expect(mockClient.apiRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/crm/v3/objects/companies/batch/read',
        body: {
          inputs: [{ id: '1' }, { id: '2' }, { id: '3' }],
          properties: ['name', 'domain', 'industry', 'description', 'website']
        }
      });
    });

    it('should use individual fetches for large datasets', async () => {
      const objectIds = Array.from({ length: 150 }, (_, i) => `id-${i}`);

      // Mock individual fetch responses
      objectIds.forEach(() => {
        mockClient.apiRequest.mockResolvedValueOnce({
          id: 'test-id',
          properties: { name: 'Test Company' }
        });
      });

      const result = await engine['batchFetchObjects']('companies', objectIds);

      expect(result).toHaveLength(150);
      expect(mockClient.apiRequest).toHaveBeenCalledTimes(150);
    });

    it('should handle partial failures in individual fetches', async () => {
      const objectIds = ['1', '2', '3'];

      mockClient.apiRequest
        .mockResolvedValueOnce({ id: '1', properties: {} })
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({ id: '3', properties: {} });

      const result = await engine['batchFetchObjects']('companies', objectIds);

      expect(result).toHaveLength(2); // Only successful fetches
    });
  });

  describe('getPropertiesForObjectType', () => {
    it('should return correct properties for companies', () => {
      const properties = engine['getPropertiesForObjectType']('companies');
      expect(properties).toEqual(['name', 'domain', 'industry', 'description', 'website']);
    });

    it('should return correct properties for deals', () => {
      const properties = engine['getPropertiesForObjectType']('deals');
      expect(properties).toEqual(['dealname', 'amount', 'closedate', 'dealstage', 'pipeline', 'description']);
    });

    it('should return correct properties for notes', () => {
      const properties = engine['getPropertiesForObjectType']('notes');
      expect(properties).toEqual(['hs_note_body', 'hs_timestamp']);
    });

    it('should return default properties for unknown types', () => {
      const properties = engine['getPropertiesForObjectType']('unknown');
      expect(properties).toEqual(['name', 'description']);
    });
  });

  describe('transformAssociatedObject', () => {
    it('should transform company object correctly', () => {
      const obj = {
        id: 'comp-123',
        properties: {
          name: 'Test Company',
          domain: 'test.com',
          industry: 'Tech'
        },
        createdAt: '2023-01-01T00:00:00Z'
      };
      const associationMeta = {
        associationSpec: { associationTypeId: 1 }
      };

      const result = engine['transformAssociatedObject'](obj, 'companies', associationMeta);

      expect(result).toMatchObject({
        id: 'comp-123',
        name: 'Test Company',
        domain: 'test.com',
        industry: 'Tech',
        associationType: 1,
        associationTimestamp: '2023-01-01T00:00:00Z'
      });
    });

    it('should transform deal object correctly', () => {
      const obj = {
        id: 'deal-123',
        properties: {
          dealname: 'Test Deal',
          amount: '10000',
          dealstage: 'proposal'
        }
      };
      const associationMeta = {
        associationSpec: { associationTypeId: 2 }
      };

      const result = engine['transformAssociatedObject'](obj, 'deals', associationMeta);

      expect(result).toMatchObject({
        id: 'deal-123',
        dealname: 'Test Deal',
        amount: 10000,
        dealstage: 'proposal',
        associationType: 2
      });
    });

    it('should handle missing association metadata', () => {
      const obj = {
        id: 'test-123',
        properties: { name: 'Test' }
      };
      const associationMeta = {};

      const result = engine['transformAssociatedObject'](obj, 'companies', associationMeta);

      expect(result.associationType).toBe('unknown');
    });
  });

  describe('getRecoveryAction', () => {
    it('should suggest retry for rate limit errors', () => {
      const error = new Error('rate limit exceeded');
      const action = engine['getRecoveryAction'](error);
      expect(action).toBe('retry_after_60_seconds');
    });

    it('should suggest permission check for auth errors', () => {
      const error = new Error('unauthorized access');
      const action = engine['getRecoveryAction'](error);
      expect(action).toBe('check_api_permissions');
    });

    it('should suggest verification for not found errors', () => {
      const error = new Error('object not found');
      const action = engine['getRecoveryAction'](error);
      expect(action).toBe('verify_association_exists');
    });

    it('should suggest generic retry for unknown errors', () => {
      const error = new Error('unknown error');
      const action = engine['getRecoveryAction'](error);
      expect(action).toBe('retry_later');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const contact = createTestContact();
      const options: AssociationOptions = {
        associationTypes: ['companies']
      };

      mockClient.apiRequest.mockRejectedValueOnce(new Error('Network error'));

      const result = await engine.enrichSingleContact(contact, options);

      expect(result.associations?.companies).toEqual([]);
      expect(result.associationMetadata?.partialFailures).toContain('companies');
    });

    it('should handle malformed API responses', async () => {
      const contact = createTestContact();
      const options: AssociationOptions = {
        associationTypes: ['companies']
      };

      mockClient.apiRequest
        .mockResolvedValueOnce({ results: null }) // Malformed response
        .mockResolvedValueOnce(createMockObjectResponse('companies', 0));

      const result = await engine.enrichSingleContact(contact, options);

      expect(result.associations?.companies).toEqual([]);
    });

    it('should continue with other types when one fails', async () => {
      const contact = createTestContact();
      const options: AssociationOptions = {
        associationTypes: ['companies', 'deals']
      };

      mockClient.apiRequest
        .mockRejectedValueOnce(new Error('Companies API failed'))
        .mockResolvedValueOnce(createMockAssociationResponse(1))
        .mockResolvedValueOnce(createMockObjectResponse('deals', 1));

      const result = await engine.enrichSingleContact(contact, options);

      expect(result.associations?.companies).toEqual([]);
      expect(result.associations?.deals).toHaveLength(1);
      expect(result.associationMetadata?.partialFailures).toContain('companies');
      expect(result.associationMetadata?.partialFailures).not.toContain('deals');
    });
  });

  describe('Performance Characteristics', () => {
    it('should process association types in parallel', async () => {
      const contact = createTestContact();
      const options: AssociationOptions = {
        associationTypes: ['companies', 'deals', 'notes']
      };

      let callOrder: string[] = [];
      mockClient.apiRequest.mockImplementation((request: any) => {
        callOrder.push(request.path);
        return Promise.resolve({ results: [] });
      });

      await engine.enrichSingleContact(contact, options);

      // All association API calls should be made before any batch fetch calls
      const associationCalls = callOrder.filter(path => path.includes('/associations/'));
      expect(associationCalls).toHaveLength(3);
    });

    it('should handle large numbers of associations efficiently', async () => {
      const contact = createTestContact();
      const options: AssociationOptions = {
        associationTypes: ['companies'],
        associationLimit: 500
      };

      mockClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse(500))
        .mockResolvedValueOnce(createMockObjectResponse('companies', 500));

      const startTime = Date.now();
      const result = await engine.enrichSingleContact(contact, options);
      const duration = Date.now() - startTime;

      expect(result.associations?.companies).toHaveLength(500);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Type Safety', () => {
    it('should enforce valid association types at runtime', () => {
      const validTypes: AssociationType[] = [
        'companies', 'deals', 'tickets', 'notes', 'tasks', 'meetings', 'calls', 'emails', 'quotes'
      ];

      validTypes.forEach(type => {
        expect(() => {
          const options: AssociationOptions = { associationTypes: [type] };
          expect(options.associationTypes).toContain(type);
        }).not.toThrow();
      });
    });

    it('should maintain type consistency in enriched contacts', async () => {
      const contact = createTestContact();
      const options: AssociationOptions = {
        associationTypes: ['companies']
      };

      mockClient.apiRequest
        .mockResolvedValueOnce(createMockAssociationResponse(1))
        .mockResolvedValueOnce(createMockObjectResponse('companies', 1));

      const result: EnhancedContact = await engine.enrichSingleContact(contact, options);

      // TypeScript should enforce these types
      expect(result.id).toBe(contact.id);
      expect(result.properties).toBeDefined();
      expect(result.associations).toBeDefined();
      expect(result.associationMetadata).toBeDefined();
    });
  });
});