import { renderHook, act } from '@testing-library/react'
import { useRetry, useAutoRetry } from '../useRetry'
import { ErrorHandler } from '@/lib/error-handler'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock ErrorHandler
jest.mock('@/lib/error-handler')
const mockErrorHandler = ErrorHandler as jest.Mocked<typeof ErrorHandler>

describe('useRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockErrorHandler.retryWithBackoff.mockImplementation(async (fn) => fn())
    mockErrorHandler.handle.mockReturnValue({
      type: 'NETWORK_ERROR' as any,
      message: 'Test error',
      timestamp: new Date()
    })
  })

  it('executes function successfully', async () => {
    const mockFn = jest.fn().mockResolvedValue('success')
    const { result } = renderHook(() => useRetry(mockFn))

    let response: string
    await act(async () => {
      response = await result.current.execute()
    })

    expect(response!).toBe('success')
    expect(result.current.isRetrying).toBe(false)
    expect(result.current.retryCount).toBe(0)
    expect(result.current.lastError).toBe(null)
  })

  it('handles errors and updates state', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Test error'))
    const { result } = renderHook(() => useRetry(mockFn))

    await act(async () => {
      try {
        await result.current.execute()
      } catch (error) {
        // Expected to throw
      }
    })

    expect(result.current.isRetrying).toBe(false)
    expect(result.current.lastError).toEqual({
      type: 'NETWORK_ERROR',
      message: 'Test error',
      timestamp: expect.any(Date)
    })
  })

  it('allows manual retry', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce('success')

    const { result } = renderHook(() => useRetry(mockFn, { maxRetries: 2 }))

    // First execution fails
    await act(async () => {
      try {
        await result.current.execute()
      } catch (error) {
        // Expected to throw
      }
    })

    expect(result.current.canRetry).toBe(true)

    // Retry succeeds
    let response: string
    await act(async () => {
      response = await result.current.retry()
    })

    expect(response!).toBe('success')
    expect(result.current.retryCount).toBe(0) // Reset after success
  })

  it('respects maxRetries limit', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Persistent error'))
    const { result } = renderHook(() => useRetry(mockFn, { maxRetries: 1 }))

    // First execution fails
    await act(async () => {
      try {
        await result.current.execute()
      } catch (error) {
        // Expected to throw
      }
    })

    // First retry fails
    await act(async () => {
      try {
        await result.current.retry()
      } catch (error) {
        // Expected to throw
      }
    })

    expect(result.current.canRetry).toBe(false)
  })

  it('calls onRetry callback', async () => {
    const onRetry = jest.fn()
    const mockFn = jest.fn().mockRejectedValue(new Error('Test error'))
    const { result } = renderHook(() => useRetry(mockFn, { onRetry }))

    await act(async () => {
      try {
        await result.current.execute()
      } catch (error) {
        // Expected to throw
      }
    })

    await act(async () => {
      try {
        await result.current.retry()
      } catch (error) {
        // Expected to throw
      }
    })

    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Object))
  })

  it('resets state correctly', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Test error'))
    const { result } = renderHook(() => useRetry(mockFn))

    await act(async () => {
      try {
        await result.current.execute()
      } catch (error) {
        // Expected to throw
      }
    })

    expect(result.current.lastError).not.toBe(null)

    act(() => {
      result.current.reset()
    })

    expect(result.current.lastError).toBe(null)
    expect(result.current.retryCount).toBe(0)
  })
})

describe('useAutoRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockErrorHandler.retryWithBackoff.mockImplementation(async (fn) => fn())
    mockErrorHandler.handle.mockReturnValue({
      type: 'NETWORK_ERROR' as any,
      message: 'Test error',
      timestamp: new Date()
    })
  })

  it('manages data state correctly', async () => {
    const mockFn = jest.fn().mockResolvedValue('test data')
    const { result } = renderHook(() => useAutoRetry(mockFn, []))

    await act(async () => {
      await result.current.execute()
    })

    expect(result.current.data).toBe('test data')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('handles loading state', async () => {
    const mockFn = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('data'), 100))
    )
    const { result } = renderHook(() => useAutoRetry(mockFn, []))

    act(() => {
      result.current.execute()
    })

    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150))
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBe('data')
  })

  it('handles error state', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Test error'))
    const { result } = renderHook(() => useAutoRetry(mockFn, []))

    await act(async () => {
      try {
        await result.current.execute()
      } catch (error) {
        // Expected to throw
      }
    })

    expect(result.current.error).toEqual({
      type: 'NETWORK_ERROR',
      message: 'Test error',
      timestamp: expect.any(Date)
    })
    expect(result.current.data).toBe(null)
  })
})