/**
 * Notes Service Tests
 * 
 * Tests for the NotesService class.
 */

import { NotesService } from '../notes.service.js';
import { NoteCreateInput, NoteUpdateInput } from '../notes.types.js';
import { ServiceConfig, BcpError } from '../../../core/types.js';

// Mock HubSpot client
const mockClient = {
  crm: {
    objects: {
      basicApi: {
        create: jest.fn(),
        getById: jest.fn(),
        update: jest.fn(),
        archive: jest.fn(),
      },
      searchApi: {
        doSearch: jest.fn(),
      },
    },
  },
};

// Mock service config
const mockConfig: ServiceConfig = {
  hubspotAccessToken: 'mock-token',
};

// Mock note data
const mockNote = {
  id: '123',
  properties: {
    hs_note_body: 'Test note content',
    hs_timestamp: '1620000000000',
    hubspot_owner_id: '456',
  },
  createdAt: new Date('2021-05-03T00:00:00Z'),
  updatedAt: new Date('2021-05-03T00:00:00Z'),
  archived: false,
};

// Mock collection response
const mockCollectionResponse = {
  results: [mockNote],
  paging: {
    next: {
      after: 'next-page-token',
    },
  },
  total: 1,
};

describe('NotesService', () => {
  let service: NotesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotesService(mockConfig);
    // @ts-ignore - Mock the client
    service.client = mockClient;
    // @ts-ignore - Mock initialized state
    service.initialized = true;
  });

  describe('createNote', () => {
    it('should create a note successfully', async () => {
      // Arrange
      const input: NoteCreateInput = {
        content: 'Test note content',
        ownerId: '456',
      };

      mockClient.crm.objects.basicApi.create.mockResolvedValueOnce(mockNote);

      // Act
      const result = await service.createNote(input);

      // Assert
      expect(mockClient.crm.objects.basicApi.create).toHaveBeenCalledWith(
        'notes',
        expect.objectContaining({
          properties: expect.objectContaining({
            hs_note_body: 'Test note content',
            hubspot_owner_id: '456',
          }),
        })
      );
      expect(result).toEqual(expect.objectContaining({
        id: '123',
        content: 'Test note content',
        ownerId: '456',
      }));
    });

    it('should throw an error if content is missing', async () => {
      // Arrange
      const input = {} as NoteCreateInput;

      // Act & Assert
      await expect(service.createNote(input)).rejects.toThrow();
    });
  });

  describe('getNote', () => {
    it('should get a note by ID successfully', async () => {
      // Arrange
      mockClient.crm.objects.basicApi.getById.mockResolvedValueOnce(mockNote);

      // Act
      const result = await service.getNote('123');

      // Assert
      expect(mockClient.crm.objects.basicApi.getById).toHaveBeenCalledWith(
        'notes',
        '123',
        expect.any(Array)
      );
      expect(result).toEqual(expect.objectContaining({
        id: '123',
        content: 'Test note content',
        ownerId: '456',
      }));
    });

    it('should throw a NOT_FOUND error if note does not exist', async () => {
      // Arrange
      const error = new Error('Not found');
      // @ts-ignore - Mock error code
      error.code = 404;
      mockClient.crm.objects.basicApi.getById.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(service.getNote('999')).rejects.toThrow(BcpError);
      await expect(service.getNote('999')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    });
  });

  describe('updateNote', () => {
    it('should update a note successfully', async () => {
      // Arrange
      const input: NoteUpdateInput = {
        content: 'Updated content',
      };

      const updatedNote = {
        ...mockNote,
        properties: {
          ...mockNote.properties,
          hs_note_body: 'Updated content',
        },
      };

      mockClient.crm.objects.basicApi.update.mockResolvedValueOnce(updatedNote);

      // Act
      const result = await service.updateNote('123', input);

      // Assert
      expect(mockClient.crm.objects.basicApi.update).toHaveBeenCalledWith(
        'notes',
        '123',
        expect.objectContaining({
          properties: expect.objectContaining({
            hs_note_body: 'Updated content',
          }),
        })
      );
      expect(result).toEqual(expect.objectContaining({
        id: '123',
        content: 'Updated content',
        ownerId: '456',
      }));
    });

    it('should throw an error if no properties are provided', async () => {
      // Arrange
      const input = {} as NoteUpdateInput;

      // Act & Assert
      await expect(service.updateNote('123', input)).rejects.toThrow();
    });
  });

  describe('deleteNote', () => {
    it('should delete a note successfully', async () => {
      // Arrange
      mockClient.crm.objects.basicApi.archive.mockResolvedValueOnce(undefined);

      // Act
      await service.deleteNote('123');

      // Assert
      expect(mockClient.crm.objects.basicApi.archive).toHaveBeenCalledWith(
        'notes',
        '123'
      );
    });

    it('should throw a NOT_FOUND error if note does not exist', async () => {
      // Arrange
      const error = new Error('Not found');
      // @ts-ignore - Mock error code
      error.code = 404;
      mockClient.crm.objects.basicApi.archive.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(service.deleteNote('999')).rejects.toThrow(BcpError);
      await expect(service.deleteNote('999')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    });
  });

  describe('listNotes', () => {
    it('should list notes with filters', async () => {
      // Arrange
      mockClient.crm.objects.searchApi.doSearch.mockResolvedValueOnce(mockCollectionResponse);

      // Act
      const result = await service.listNotes({
        ownerId: '456',
        limit: 10,
      });

      // Assert
      expect(mockClient.crm.objects.searchApi.doSearch).toHaveBeenCalledWith(
        'notes',
        expect.objectContaining({
          filterGroups: expect.arrayContaining([
            expect.objectContaining({
              filters: expect.arrayContaining([
                expect.objectContaining({
                  propertyName: 'hubspot_owner_id',
                  operator: 'EQ',
                  value: '456',
                }),
              ]),
            }),
          ]),
          limit: 10,
        })
      );
      expect(result).toEqual(expect.objectContaining({
        results: expect.arrayContaining([
          expect.objectContaining({
            id: '123',
            content: 'Test note content',
            ownerId: '456',
          }),
        ]),
        pagination: expect.objectContaining({
          after: 'next-page-token',
        }),
        total: 1,
      }));
    });
  });

  describe('getRecentNotes', () => {
    it('should get recent notes', async () => {
      // Arrange
      mockClient.crm.objects.searchApi.doSearch.mockResolvedValueOnce(mockCollectionResponse);

      // Act
      const result = await service.getRecentNotes(5);

      // Assert
      expect(mockClient.crm.objects.searchApi.doSearch).toHaveBeenCalledWith(
        'notes',
        expect.objectContaining({
          sorts: ['-hs_timestamp'],
          limit: 5,
        })
      );
      expect(result).toEqual(expect.objectContaining({
        results: expect.arrayContaining([
          expect.objectContaining({
            id: '123',
            content: 'Test note content',
            ownerId: '456',
          }),
        ]),
        pagination: expect.objectContaining({
          after: 'next-page-token',
        }),
        total: 1,
      }));
    });

    it('should throw an error if limit is invalid', async () => {
      // Act & Assert
      await expect(service.getRecentNotes(0)).rejects.toThrow();
      await expect(service.getRecentNotes(-1)).rejects.toThrow();
    });
  });
});
