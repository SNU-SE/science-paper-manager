import { renderHook, act, waitFor } from '@testing-library/react'
import { useZoteroSync } from '../useZoteroSync'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock the toast hook
jest.mock('../use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}))

// Mock fetch
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('useZoteroSync', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('should initialize with null state', () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { isConfigured: false } })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null })
      } as Response)

    const { result } = renderHook(() => useZoteroSync())

    expect(result.current.syncStatus).toBeNull()
    expect(result.current.config).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isConfigured).toBe(false)
    expect(result.current.isSyncing).toBe(false)
  })

  it('should fetch configuration and sync status on mount', async () => {
    const mockConfig = {
      isConfigured: true,
      config: {
        userId: 'test-user',
        libraryType: 'user',
        hasApiKey: true
      }
    }

    const mockSyncStatus = {
      isRunning: false,
      lastSyncTime: '2023-01-01T00:00:00Z',
      lastSyncVersion: 100,
      totalItems: 50,
      errors: []
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockConfig })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSyncStatus })
      } as Response)

    const { result } = renderHook(() => useZoteroSync())

    await waitFor(() => {
      expect(result.current.config).toEqual(mockConfig)
      expect(result.current.syncStatus).toEqual(mockSyncStatus)
      expect(result.current.isConfigured).toBe(true)
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/zotero/config')
    expect(mockFetch).toHaveBeenCalledWith('/api/zotero/sync')
  })

  it('should configure Zotero successfully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { isConfigured: false } })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Configured successfully' })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { isConfigured: true } })
      } as Response)

    const { result } = renderHook(() => useZoteroSync())

    await act(async () => {
      const success = await result.current.configure({
        userId: 'test-user',
        apiKey: 'test-key',
        libraryType: 'user'
      })
      expect(success).toBe(true)
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/zotero/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: 'test-user',
        apiKey: 'test-key',
        libraryType: 'user'
      })
    })
  })

  it('should handle configuration errors', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { isConfigured: false } })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Invalid API key' })
      } as Response)

    const { result } = renderHook(() => useZoteroSync())

    await act(async () => {
      const success = await result.current.configure({
        userId: 'test-user',
        apiKey: 'invalid-key',
        libraryType: 'user'
      })
      expect(success).toBe(false)
    })
  })

  it('should disconnect Zotero successfully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { isConfigured: true } })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Disconnected successfully' })
      } as Response)

    const { result } = renderHook(() => useZoteroSync())

    await act(async () => {
      const success = await result.current.disconnect()
      expect(success).toBe(true)
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/zotero/config', {
      method: 'DELETE'
    })

    expect(result.current.config).toBeNull()
    expect(result.current.syncStatus).toBeNull()
  })

  it('should perform sync successfully', async () => {
    const mockSyncResult = {
      totalItems: 10,
      newItems: 2,
      updatedItems: 1,
      errors: [],
      lastSyncTime: '2023-01-01T00:00:00Z'
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { isConfigured: false } })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSyncResult })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { isRunning: false } })
      } as Response)

    const { result } = renderHook(() => useZoteroSync())

    await act(async () => {
      const syncResult = await result.current.performSync('incremental')
      expect(syncResult).toEqual(mockSyncResult)
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/zotero/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type: 'incremental' })
    })
  })

  it('should handle sync errors', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { isConfigured: false } })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Sync failed' })
      } as Response)

    const { result } = renderHook(() => useZoteroSync())

    await act(async () => {
      const syncResult = await result.current.performSync('full')
      expect(syncResult).toBeNull()
    })
  })

  it('should poll sync status when sync is running', async () => {
    const mockSyncStatus = {
      isRunning: true,
      lastSyncTime: null,
      lastSyncVersion: 0,
      totalItems: 0,
      errors: []
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { isConfigured: false } })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSyncStatus })
      } as Response)

    const { result } = renderHook(() => useZoteroSync())

    await waitFor(() => {
      expect(result.current.syncStatus).toEqual(mockSyncStatus)
      expect(result.current.isSyncing).toBe(true)
    })

    // Should have made initial fetch calls
    expect(mockFetch).toHaveBeenCalledTimes(2)
  }, 10000)

  it('should compute derived state correctly', async () => {
    const mockConfig = {
      isConfigured: true,
      config: { userId: 'test', libraryType: 'user', hasApiKey: true }
    }

    const mockSyncStatus = {
      isRunning: false,
      lastSyncTime: '2023-01-01T00:00:00Z',
      lastSyncVersion: 100,
      totalItems: 50,
      errors: ['Test error']
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockConfig })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSyncStatus })
      } as Response)

    const { result } = renderHook(() => useZoteroSync())

    await waitFor(() => {
      expect(result.current.config).toEqual(mockConfig)
      expect(result.current.syncStatus).toEqual(mockSyncStatus)
    })

    // Check derived state
    expect(result.current.isConfigured).toBe(true)
    expect(result.current.isSyncing).toBe(false)
    expect(result.current.hasErrors).toBe(true)
  })
})