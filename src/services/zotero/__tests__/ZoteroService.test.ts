import { ZoteroService, ZoteroItem } from '../ZoteroService'

// Mock fetch
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

describe('ZoteroService', () => {
  let service: ZoteroService

  beforeEach(() => {
    service = new ZoteroService()
    mockFetch.mockClear()
    mockLocalStorage.getItem.mockClear()
    mockLocalStorage.setItem.mockClear()
    mockLocalStorage.removeItem.mockClear()
  })

  describe('configure', () => {
    it('should configure the service with valid config', () => {
      const config = {
        userId: 'test-user',
        apiKey: 'test-key',
        libraryType: 'user' as const
      }

      service.configure(config)

      expect(service.isConfigured()).toBe(true)
      expect(service.getConfig()).toEqual(config)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'zotero-config',
        JSON.stringify(config)
      )
    })
  })

  describe('validateCredentials', () => {
    it('should validate credentials successfully', async () => {
      service.configure({
        userId: 'test-user',
        apiKey: 'test-key',
        libraryType: 'user'
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response)

      const result = await service.validateCredentials()

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.zotero.org/keys/current',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key'
          })
        })
      )
    })

    it('should return false for invalid credentials', async () => {
      service.configure({
        userId: 'test-user',
        apiKey: 'invalid-key',
        libraryType: 'user'
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403
      } as Response)

      const result = await service.validateCredentials()

      expect(result).toBe(false)
    })

    it('should throw error if not configured', async () => {
      await expect(service.validateCredentials()).rejects.toThrow('Zotero not configured')
    })
  })

  describe('fetchAllItems', () => {
    beforeEach(() => {
      service.configure({
        userId: 'test-user',
        apiKey: 'test-key',
        libraryType: 'user'
      })
    })

    it('should fetch all items successfully', async () => {
      const mockItems = [
        { data: { key: 'item1', title: 'Test Paper 1' } },
        { data: { key: 'item2', title: 'Test Paper 2' } }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems
      } as Response)

      const result = await service.fetchAllItems()

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ key: 'item1', title: 'Test Paper 1' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/test-user/items'),
        expect.any(Object)
      )
    })

    it('should handle pagination correctly', async () => {
      const firstBatch = Array.from({ length: 100 }, (_, i) => ({
        data: { key: `item${i}`, title: `Paper ${i}` }
      }))
      const secondBatch = [
        { data: { key: 'item100', title: 'Paper 100' } }
      ]

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => firstBatch
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => secondBatch
        } as Response)

      const result = await service.fetchAllItems()

      expect(result).toHaveLength(101)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should include since parameter for incremental sync', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)

      await service.fetchAllItems(12345)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('since=12345'),
        expect.any(Object)
      )
    })
  })

  describe('convertToPaper', () => {
    it('should convert Zotero item to Paper format', () => {
      const zoteroItem: ZoteroItem = {
        key: 'TEST123',
        version: 1,
        itemType: 'journalArticle',
        title: 'Test Paper',
        creators: [
          { creatorType: 'author', firstName: 'John', lastName: 'Doe' },
          { creatorType: 'author', firstName: 'Jane', lastName: 'Smith' }
        ],
        abstractNote: 'This is a test abstract',
        publicationTitle: 'Test Journal',
        date: '2023-01-15',
        DOI: '10.1000/test',
        dateAdded: '2023-01-01T00:00:00Z',
        dateModified: '2023-01-02T00:00:00Z'
      }

      const result = service.convertToPaper(zoteroItem)

      expect(result).toEqual({
        title: 'Test Paper',
        authors: ['John Doe', 'Jane Smith'],
        journal: 'Test Journal',
        publicationYear: 2023,
        doi: '10.1000/test',
        abstract: 'This is a test abstract',
        zoteroKey: 'TEST123',
        dateAdded: new Date('2023-01-01T00:00:00Z'),
        lastModified: new Date('2023-01-02T00:00:00Z')
      })
    })

    it('should handle missing fields gracefully', () => {
      const zoteroItem: ZoteroItem = {
        key: 'TEST123',
        version: 1,
        itemType: 'journalArticle',
        dateAdded: '2023-01-01T00:00:00Z',
        dateModified: '2023-01-02T00:00:00Z'
      }

      const result = service.convertToPaper(zoteroItem)

      expect(result).toEqual({
        title: 'Untitled',
        authors: [],
        journal: undefined,
        publicationYear: undefined,
        doi: undefined,
        abstract: undefined,
        zoteroKey: 'TEST123',
        dateAdded: new Date('2023-01-01T00:00:00Z'),
        lastModified: new Date('2023-01-02T00:00:00Z')
      })
    })

    it('should extract year from various date formats', () => {
      const testCases = [
        { date: '2023', expected: 2023 },
        { date: '2023-01-15', expected: 2023 },
        { date: 'January 2023', expected: 2023 },
        { date: 'invalid date', expected: undefined }
      ]

      testCases.forEach(({ date, expected }) => {
        const zoteroItem: ZoteroItem = {
          key: 'TEST',
          version: 1,
          itemType: 'journalArticle',
          date,
          dateAdded: '2023-01-01T00:00:00Z',
          dateModified: '2023-01-02T00:00:00Z'
        }

        const result = service.convertToPaper(zoteroItem)
        expect(result.publicationYear).toBe(expected)
      })
    })
  })

  describe('getLibraryVersion', () => {
    beforeEach(() => {
      service.configure({
        userId: 'test-user',
        apiKey: 'test-key',
        libraryType: 'user'
      })
    })

    it('should get library version from headers', async () => {
      const mockHeaders = new Headers()
      mockHeaders.set('Last-Modified-Version', '12345')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders
      } as Response)

      const result = await service.getLibraryVersion()

      expect(result).toBe(12345)
    })

    it('should return 0 if no version header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers()
      } as Response)

      const result = await service.getLibraryVersion()

      expect(result).toBe(0)
    })
  })
})