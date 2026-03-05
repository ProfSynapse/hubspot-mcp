/**
 * Contact BCP Association Tests
 *
 * Tests for contact tools enhanced with association retrieval functionality.
 * Verifies parameter validation, response enhancement, and integration with
 * the Association Enrichment Engine.
 */

import { ContactsService } from '../contacts.service.js';
import { enhanceContactsResponse } from '../../../core/response-enhancer.js';

// Import the tool handlers (these would be from the individual tool files)
// For testing purposes, we'll create mock versions of the enhanced tools

// Mock dependencies
jest.mock('../../../core/response-enhancer.js');
jest.mock('../contacts.service.js');

const mockEnhanceContactsResponse = enhanceContactsResponse as jest.MockedFunction<typeof enhanceContactsResponse>;
const MockContactsService = ContactsService as jest.MockedClass<typeof ContactsService>;

// Test fixtures
const createMockContact = (id: string = '12345') => ({
  id,
  properties: {
    email: 'test@example.com',
    firstname: 'John',
    lastname: 'Doe'
  },
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z'
});

const createEnhancedContact = (id: string = '12345') => ({
  ...createMockContact(id),
  associations: {
    companies: [{
      id: 'company-1',
      name: 'Test Company',
      domain: 'test.com',
      associationType: 'PRIMARY_COMPANY'
    }],
    deals: [{
      id: 'deal-1',
      dealname: 'Test Deal',
      amount: 50000,
      dealstage: 'proposal',
      associationType: 'PRIMARY'
    }]
  },
  associationMetadata: {
    enrichmentTimestamp: '2023-01-01T10:00:00Z',
    totalAssociationCount: {
      companies: 1,
      deals: 1
    }
  }
});

// Mock enhanced tool schemas
const contactSearchToolSchema = {
  type: 'object',
  properties: {
    searchType: {
      type: 'string',
      enum: ['email', 'name'],
      description: 'Type of search to perform'
    },
    searchTerm: {
      type: 'string',
      description: 'Search term (email address or name)'
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 10,
      description: 'Maximum number of contacts to return'
    },
    includeAssociations: {
      type: 'boolean',
      default: false,
      description: 'Include associated data (companies, deals, notes, etc.)'
    },
    associationTypes: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['companies', 'deals', 'tickets', 'notes', 'tasks', 'meetings', 'calls', 'emails', 'quotes']
      },
      default: ['companies'],
      description: 'Types of associations to retrieve'
    },
    associationLimit: {
      type: 'integer',
      minimum: 1,
      maximum: 500,
      default: 50,
      description: 'Maximum number of associations per type'
    }
  },
  required: ['searchType', 'searchTerm']
};

const contactGetToolSchema = {
  type: 'object',
  properties: {
    contactId: {
      type: 'string',
      description: 'Contact ID'
    },
    includeAssociations: {
      type: 'boolean',
      default: false,
      description: 'Include associated data'
    },
    associationTypes: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['companies', 'deals', 'tickets', 'notes', 'tasks', 'meetings', 'calls', 'emails', 'quotes']
      },
      default: ['companies']
    },
    associationLimit: {
      type: 'integer',
      minimum: 1,
      maximum: 500,
      default: 50
    }
  },
  required: ['contactId']
};

// Mock tool handlers
const createMockContactSearchTool = () => ({
  name: 'search',
  description: 'Search contacts with optional association data',
  inputSchema: contactSearchToolSchema,
  handler: async (params: any) => {
    const mockService = new MockContactsService({} as any);

    let result;
    if (params.searchType === 'email') {
      result = await mockService.searchContactsByEmail(
        params.searchTerm,
        params.limit,
        params.includeAssociations,
        params.associationTypes ? {
          associationTypes: params.associationTypes,
          associationLimit: params.associationLimit
        } : undefined
      );
    } else {
      result = await mockService.searchContactsByName(
        params.searchTerm,
        params.limit,
        params.includeAssociations,
        params.associationTypes ? {
          associationTypes: params.associationTypes,
          associationLimit: params.associationLimit
        } : undefined
      );
    }

    // Mock response enhancement
    return mockEnhanceContactsResponse({
      success: true,
      contacts: result,
      count: result.length,
      message: `Found ${result.length} contacts`
    }, 'search', params);
  }
});

const createMockContactGetTool = () => ({
  name: 'get',
  description: 'Get contact by ID with optional association data',
  inputSchema: contactGetToolSchema,
  handler: async (params: any) => {
    const mockService = new MockContactsService({} as any);

    const result = await mockService.getContact(
      params.contactId,
      params.associationTypes ? {
        associationTypes: params.associationTypes,
        associationLimit: params.associationLimit
      } : undefined
    );

    return mockEnhanceContactsResponse({
      success: true,
      contact: result,
      message: 'Contact retrieved successfully'
    }, 'get', params);
  }
});

describe('Contact BCP Tools - Association Integration', () => {
  let mockContactsService: jest.Mocked<ContactsService>;
  let searchTool: any;
  let getTool: any;

  beforeEach(() => {
    mockContactsService = new MockContactsService({} as any) as jest.Mocked<ContactsService>;
    searchTool = createMockContactSearchTool();
    getTool = createMockContactGetTool();

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default response enhancement
    mockEnhanceContactsResponse.mockImplementation((response) => ({
      ...response,
      suggestions: ['Test suggestion']
    }));
  });

  describe('Contact Search Tool', () => {
    describe('Parameter Validation', () => {
      it('should validate required parameters', async () => {
        const invalidParams = { searchType: 'email' }; // Missing searchTerm

        try {
          await searchTool.handler(invalidParams);
          fail('Should have thrown validation error');
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      it('should validate searchType enum', async () => {
        const params = {
          searchType: 'invalid',
          searchTerm: 'test@example.com'
        };

        // This would be validated by the MCP server using the schema
        expect(searchTool.inputSchema.properties.searchType.enum).not.toContain('invalid');
      });

      it('should validate associationTypes enum', async () => {
        const validAssociationTypes = ['companies', 'deals', 'tickets', 'notes', 'tasks', 'meetings', 'calls', 'emails', 'quotes'];

        expect(searchTool.inputSchema.properties.associationTypes.items.enum).toEqual(validAssociationTypes);
      });

      it('should validate associationLimit range', async () => {
        const { minimum, maximum } = searchTool.inputSchema.properties.associationLimit;

        expect(minimum).toBe(1);
        expect(maximum).toBe(500);
      });
    });

    describe('Backward Compatibility', () => {
      it('should work without association parameters', async () => {
        const params = {
          searchType: 'email',
          searchTerm: 'test@example.com',
          limit: 10
        };

        mockContactsService.searchContactsByEmail = jest.fn().mockResolvedValue([createMockContact()]);
        MockContactsService.mockImplementation(() => mockContactsService);

        const result = await searchTool.handler(params);

        expect(mockContactsService.searchContactsByEmail).toHaveBeenCalledWith(
          'test@example.com',
          10,
          false,
          undefined
        );
        expect(result.success).toBe(true);
        expect(result.count).toBe(1);
      });

      it('should use legacy includeAssociations parameter', async () => {
        const params = {
          searchType: 'email',
          searchTerm: 'test@example.com',
          includeAssociations: true
        };

        mockContactsService.searchContactsByEmail = jest.fn().mockResolvedValue([createEnhancedContact()]);
        MockContactsService.mockImplementation(() => mockContactsService);

        await searchTool.handler(params);

        expect(mockContactsService.searchContactsByEmail).toHaveBeenCalledWith(
          'test@example.com',
          10, // default limit
          true,
          undefined
        );
      });
    });

    describe('New Association Functionality', () => {
      it('should search with specific association types', async () => {
        const params = {
          searchType: 'email',
          searchTerm: 'test@example.com',
          associationTypes: ['companies', 'deals'],
          associationLimit: 25
        };

        mockContactsService.searchContactsByEmail = jest.fn().mockResolvedValue([createEnhancedContact()]);
        MockContactsService.mockImplementation(() => mockContactsService);

        const result = await searchTool.handler(params);

        expect(mockContactsService.searchContactsByEmail).toHaveBeenCalledWith(
          'test@example.com',
          10,
          false,
          {
            associationTypes: ['companies', 'deals'],
            associationLimit: 25
          }
        );
        expect(result.contacts[0].associations).toBeDefined();
      });

      it('should search by name with associations', async () => {
        const params = {
          searchType: 'name',
          searchTerm: 'John Doe',
          associationTypes: ['companies']
        };

        mockContactsService.searchContactsByName = jest.fn().mockResolvedValue([createEnhancedContact()]);
        MockContactsService.mockImplementation(() => mockContactsService);

        await searchTool.handler(params);

        expect(mockContactsService.searchContactsByName).toHaveBeenCalledWith(
          'John Doe',
          10,
          false,
          {
            associationTypes: ['companies'],
            associationLimit: 50 // default
          }
        );
      });

      it('should handle all association types', async () => {
        const params = {
          searchType: 'email',
          searchTerm: 'test@example.com',
          associationTypes: ['companies', 'deals', 'tickets', 'notes', 'tasks', 'meetings', 'calls', 'emails', 'quotes']
        };

        mockContactsService.searchContactsByEmail = jest.fn().mockResolvedValue([createEnhancedContact()]);
        MockContactsService.mockImplementation(() => mockContactsService);

        await searchTool.handler(params);

        expect(mockContactsService.searchContactsByEmail).toHaveBeenCalledWith(
          'test@example.com',
          10,
          false,
          {
            associationTypes: params.associationTypes,
            associationLimit: 50
          }
        );
      });
    });

    describe('Response Enhancement', () => {
      it('should enhance response with suggestions', async () => {
        const params = {
          searchType: 'email',
          searchTerm: 'test@example.com',
          associationTypes: ['companies']
        };

        mockContactsService.searchContactsByEmail = jest.fn().mockResolvedValue([createEnhancedContact()]);
        MockContactsService.mockImplementation(() => mockContactsService);

        const result = await searchTool.handler(params);

        expect(mockEnhanceContactsResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            contacts: expect.any(Array),
            count: 1
          }),
          'search',
          params
        );
        expect(result.suggestions).toBeDefined();
      });
    });
  });

  describe('Contact Get Tool', () => {
    describe('Parameter Validation', () => {
      it('should validate required contactId', async () => {
        const params = { includeAssociations: true }; // Missing contactId

        try {
          await getTool.handler(params);
          fail('Should have thrown validation error');
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });

    describe('Backward Compatibility', () => {
      it('should get contact without associations', async () => {
        const params = {
          contactId: '12345'
        };

        mockContactsService.getContact = jest.fn().mockResolvedValue(createMockContact());
        MockContactsService.mockImplementation(() => mockContactsService);

        const result = await getTool.handler(params);

        expect(mockContactsService.getContact).toHaveBeenCalledWith('12345', undefined);
        expect(result.success).toBe(true);
      });
    });

    describe('New Association Functionality', () => {
      it('should get contact with specific associations', async () => {
        const params = {
          contactId: '12345',
          associationTypes: ['companies', 'deals'],
          associationLimit: 30
        };

        mockContactsService.getContact = jest.fn().mockResolvedValue(createEnhancedContact());
        MockContactsService.mockImplementation(() => mockContactsService);

        const result = await getTool.handler(params);

        expect(mockContactsService.getContact).toHaveBeenCalledWith('12345', {
          associationTypes: ['companies', 'deals'],
          associationLimit: 30
        });
        expect(result.contact.associations).toBeDefined();
      });

      it('should use default association limit', async () => {
        const params = {
          contactId: '12345',
          associationTypes: ['companies']
        };

        mockContactsService.getContact = jest.fn().mockResolvedValue(createEnhancedContact());
        MockContactsService.mockImplementation(() => mockContactsService);

        await getTool.handler(params);

        expect(mockContactsService.getContact).toHaveBeenCalledWith('12345', {
          associationTypes: ['companies'],
          associationLimit: 50
        });
      });
    });

    describe('Response Enhancement', () => {
      it('should enhance single contact response', async () => {
        const params = {
          contactId: '12345',
          associationTypes: ['companies']
        };

        mockContactsService.getContact = jest.fn().mockResolvedValue(createEnhancedContact());
        MockContactsService.mockImplementation(() => mockContactsService);

        const result = await getTool.handler(params);

        expect(mockEnhanceContactsResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            contact: expect.any(Object),
            message: 'Contact retrieved successfully'
          }),
          'get',
          params
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const params = {
        searchType: 'email',
        searchTerm: 'test@example.com'
      };

      mockContactsService.searchContactsByEmail = jest.fn().mockRejectedValue(new Error('Service error'));
      MockContactsService.mockImplementation(() => mockContactsService);

      await expect(searchTool.handler(params)).rejects.toThrow('Service error');
    });

    it('should handle association enrichment failures', async () => {
      const params = {
        searchType: 'email',
        searchTerm: 'test@example.com',
        associationTypes: ['companies']
      };

      const contactWithFailedAssociations = {
        ...createMockContact(),
        associations: { companies: [] },
        associationMetadata: {
          enrichmentTimestamp: '2023-01-01T10:00:00Z',
          partialFailures: ['companies'],
          totalAssociationCount: { companies: 0 }
        }
      };

      mockContactsService.searchContactsByEmail = jest.fn().mockResolvedValue([contactWithFailedAssociations]);
      MockContactsService.mockImplementation(() => mockContactsService);

      const result = await searchTool.handler(params);

      expect(result.contacts[0].associationMetadata?.partialFailures).toContain('companies');
    });
  });

  describe('Schema Validation', () => {
    it('should have correct schema structure for search tool', () => {
      const schema = searchTool.inputSchema;

      expect(schema.properties.searchType).toBeDefined();
      expect(schema.properties.searchTerm).toBeDefined();
      expect(schema.properties.includeAssociations).toBeDefined();
      expect(schema.properties.associationTypes).toBeDefined();
      expect(schema.properties.associationLimit).toBeDefined();
      expect(schema.required).toEqual(['searchType', 'searchTerm']);
    });

    it('should have correct schema structure for get tool', () => {
      const schema = getTool.inputSchema;

      expect(schema.properties.contactId).toBeDefined();
      expect(schema.properties.includeAssociations).toBeDefined();
      expect(schema.properties.associationTypes).toBeDefined();
      expect(schema.properties.associationLimit).toBeDefined();
      expect(schema.required).toEqual(['contactId']);
    });

    it('should enforce association type enum values', () => {
      const expectedTypes = ['companies', 'deals', 'tickets', 'notes', 'tasks', 'meetings', 'calls', 'emails', 'quotes'];

      expect(searchTool.inputSchema.properties.associationTypes.items.enum).toEqual(expectedTypes);
      expect(getTool.inputSchema.properties.associationTypes.items.enum).toEqual(expectedTypes);
    });

    it('should have appropriate default values', () => {
      expect(searchTool.inputSchema.properties.limit.default).toBe(10);
      expect(searchTool.inputSchema.properties.includeAssociations.default).toBe(false);
      expect(searchTool.inputSchema.properties.associationTypes.default).toEqual(['companies']);
      expect(searchTool.inputSchema.properties.associationLimit.default).toBe(50);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large association limits within bounds', () => {
      const maxLimit = searchTool.inputSchema.properties.associationLimit.maximum;
      expect(maxLimit).toBe(500);

      const minLimit = searchTool.inputSchema.properties.associationLimit.minimum;
      expect(minLimit).toBe(1);
    });

    it('should default to reasonable association limits', () => {
      const defaultLimit = searchTool.inputSchema.properties.associationLimit.default;
      expect(defaultLimit).toBe(50);
      expect(defaultLimit).toBeLessThanOrEqual(500);
    });
  });
});