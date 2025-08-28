import { ZoteroSyncService } from '../ZoteroSyncService'
import { ZoteroService, ZoteroItem } from '../ZoteroService'

// Mock the database
jest.mock('@/lib/database', () => ({
  database: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      insert: jest.fn(),
      update: jest.fn(() => ({
        eq: jest.fn()
      }))
    }))
  }
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

describe('ZoteroSyncService', () => {
  let syncService: ZoteroSyncService
  let mockZoteroService: jest.Mocked<ZoteroService>

  beforeEach(() => {
    mockZoteroService = {
      isConfigured: jest.fn(),
      fetchAllItems: jest.fn(),
      getLibraryVersion: jest.fn(),
      convertToPaper: jest.fn()
    } as any

    syncService = new ZoteroSyncService(mockZoteroService)
    
    mockLocalStorage.getItem.mockClear()
    mockLocalStorage.setItem.mockClear()
  })

  describe('performFullSync', () => {
    it('should perform full sync successfully', async () => {
      const mockItems: ZoteroItem[] = [
        {
          key: 'item1',
          version: 1,
          itemType: 'journalArticle',
          title: 'Test Paper 1',
          dateAdded: '2023-01-01T00:00:00Z',
          dateModified: '2023-01-01T00:00:00Z'
        },
        {
          key: 'item2',
          version: 1,
          itemType: 'journalArticle',
          title: 'Test Paper 2',
          dateAdded: '2023-01-02T00:00:00Z',
          dateModified: '2023-01-02T00:00:00Z'
        }
      ]

      mockZoteroService.isConfigured.mockReturnValue(true)
      mockZoteroService.fetchAllItems.mockResolvedValue(mockItems)
      mockZoteroService.getLibraryVersion.mockResolvedValue(100)
      mockZoteroService.convertToPaper.mockImplementation((item) => ({
        title: item.title,
        zoteroKey: item.key,
        dateAdded: new Date(item.dateAdded),
        lastModified: new Date(item.dateModified)
      }))

      // Mock database responses
      const { database } = require('@/lib/database')
      const mockSelect = jest.fn()
      const mockEq = jest.fn()
      const mockSingle = jest.fn()
      const mockInsert = jest.fn()
      
      database.from.mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
        update: jest.fn(() => ({ eq: jest.fn() }))
      })
      
      mockSelect.mockReturnValue({ eq: mockEq })
      mockEq.mockReturnValue({ single: mockSingle })
      
      mockSingle
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // Not found
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // Not found
      
      mockInsert
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: null })

      const result = await syncService.performFullSync()

      expect(result.totalItems).toBe(2)
      expect(result.newItems).toBe(2)
      expect(result.updatedItems).toBe(0)
      expect(result.errors).toHaveLength(0)
      expect(mockZoteroService.fetchAllItems).toHaveBeenCalledWith()
    })

    it('should throw error if sync already running', async () => {
      // Start a sync to set isRunning to true
      mockZoteroService.isConfigured.mockReturnValue(true)
      mockZoteroService.fetchAllItems.mockImplementation(() => new Promise(() => {})) // Never resolves

      const syncPromise = syncService.performFullSync()
      
      await expect(syncService.performFullSync()).rejects.toThrow('Sync already in progress')
      
      // Clean up the hanging promise
      syncPromise.catch(() => {})
    })

    it('should throw error if not configured', async () => {
      mockZoteroService.isConfigured.mockReturnValue(false)

      await expect(syncService.performFullSync()).rejects.toThrow('Zotero not configured')
    })
  })

  describe('performIncrementalSync', () => {
    it('should skip sync if no changes detected', async () => {
      mockZoteroService.isConfigured.mockReturnValue(true)
      mockZoteroService.getLibraryVersion.mockResolvedValue(100)

      // Set last sync version to same as current
      const syncService = new ZoteroSyncService(mockZoteroService)
      syncService['syncStatus'].lastSyncVersion = 100

      const result = await syncService.performIncrementalSync()

      expect(result.totalItems).toBe(0)
      expect(result.newItems).toBe(0)
      expect(result.updatedItems).toBe(0)
      expect(mockZoteroService.fetchAllItems).not.toHaveBeenCalled()
    })

    it('should sync only changed items', async () => {
      const mockItems: ZoteroItem[] = [
        {
          key: 'item1',
          version: 2,
          itemType: 'journalArticle',
          title: 'Updated Paper',
          dateAdded: '2023-01-01T00:00:00Z',
          dateModified: '2023-01-03T00:00:00Z'
        }
      ]

      mockZoteroService.isConfigured.mockReturnValue(true)
      mockZoteroService.getLibraryVersion.mockResolvedValue(150)
      mockZoteroService.fetchAllItems.mockResolvedValue(mockItems)
      mockZoteroService.convertToPaper.mockReturnValue({
        title: 'Updated Paper',
        zoteroKey: 'item1'
      })

      // Set last sync version to trigger incremental sync
      syncService['syncStatus'].lastSyncVersion = 100

      // Mock existing paper found
      const { database } = require('@/lib/database')
      const mockSelect = jest.fn()
      const mockEq = jest.fn()
      const mockSingle = jest.fn()
      const mockUpdate = jest.fn()
      const mockUpdateEq = jest.fn()
      
      database.from.mockReturnValue({
        select: mockSelect,
        update: mockUpdate
      })
      
      mockSelect.mockReturnValue({ eq: mockEq })
      mockEq.mockReturnValue({ single: mockSingle })
      mockUpdate.mockReturnValue({ eq: mockUpdateEq })
      
      mockSingle.mockResolvedValue({
        data: { id: 'existing-id', title: 'Old Title' },
        error: null
      })
      mockUpdateEq.mockResolvedValue({ error: null })

      const result = await syncService.performIncrementalSync()

      expect(result.totalItems).toBe(1)
      expect(result.newItems).toBe(0)
      expect(result.updatedItems).toBe(1)
      expect(mockZoteroService.fetchAllItems).toHaveBeenCalledWith(100)
    })
  })

  describe('getSyncStatus', () => {
    it('should return current sync status', () => {
      const status = syncService.getSyncStatus()

      expect(status).toHaveProperty('isRunning')
      expect(status).toHaveProperty('lastSyncTime')
      expect(status).toHaveProperty('lastSyncVersion')
      expect(status).toHaveProperty('totalItems')
      expect(status).toHaveProperty('errors')
    })
  })

  describe('resetSyncStatus', () => {
    it('should reset sync status to initial state', () => {
      syncService.resetSyncStatus()

      const status = syncService.getSyncStatus()
      expect(status.isRunning).toBe(false)
      expect(status.lastSyncTime).toBeNull()
      expect(status.lastSyncVersion).toBe(0)
      expect(status.totalItems).toBe(0)
      expect(status.errors).toHaveLength(0)
    })
  })

  describe('isDocumentItem', () => {
    it('should identify document items correctly', () => {
      const documentTypes = [
        'journalArticle',
        'conferencePaper',
        'preprint',
        'report',
        'thesis',
        'book',
        'bookSection'
      ]

      const nonDocumentTypes = [
        'note',
        'attachment',
        'webpage',
        'blogPost'
      ]

      documentTypes.forEach(itemType => {
        const item = { itemType } as ZoteroItem
        expect(syncService['isDocumentItem'](item)).toBe(true)
      })

      nonDocumentTypes.forEach(itemType => {
        const item = { itemType } as ZoteroItem
        expect(syncService['isDocumentItem'](item)).toBe(false)
      })
    })
  })
})