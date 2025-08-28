import { renderHook, act } from '@testing-library/react'
import { useErrorStore, useErrorHandler } from '../errorStore'
import { ErrorType } from '@/types'
import { ErrorHandler } from '@/lib/error-handler'

// Mock ErrorHandler
jest.mock('@/lib/error-handler')
const mockErrorHandler = ErrorHandler as jest.Mocked<typeof ErrorHandler>

describe('useErrorStore', () => {
  beforeEach(() => {
    // Reset store state
    useErrorStore.setState({
      errors: [],
      isGlobalErrorHandlingEnabled: true,
      maxErrors: 10
    })

    jest.clearAllMocks()
    mockErrorHandler.handle.mockReturnValue({
      type: ErrorType.NETWORK_ERROR,
      message: 'Test error',
      timestamp: new Date()
    })
    mockErrorHandler.logError.mockImplementation(() => {})
  })

  it('adds error to store', () => {
    const { result } = renderHook(() => useErrorStore())

    act(() => {
      result.current.addError(new Error('Test error'))
    })

    expect(result.current.errors).toHaveLength(1)
    expect(result.current.errors[0]).toEqual({
      type: ErrorType.NETWORK_ERROR,
      message: 'Test error',
      timestamp: expect.any(Date)
    })
    expect(mockErrorHandler.handle).toHaveBeenCalledWith(new Error('Test error'))
    expect(mockErrorHandler.logError).toHaveBeenCalled()
  })

  it('removes error by index', () => {
    const { result } = renderHook(() => useErrorStore())

    act(() => {
      result.current.addError(new Error('Error 1'))
      result.current.addError(new Error('Error 2'))
    })

    expect(result.current.errors).toHaveLength(2)

    act(() => {
      result.current.removeError(0)
    })

    expect(result.current.errors).toHaveLength(1)
  })

  it('clears all errors', () => {
    const { result } = renderHook(() => useErrorStore())

    act(() => {
      result.current.addError(new Error('Error 1'))
      result.current.addError(new Error('Error 2'))
    })

    expect(result.current.errors).toHaveLength(2)

    act(() => {
      result.current.clearErrors()
    })

    expect(result.current.errors).toHaveLength(0)
  })

  it('clears errors by type', () => {
    const { result } = renderHook(() => useErrorStore())

    mockErrorHandler.handle
      .mockReturnValueOnce({
        type: ErrorType.NETWORK_ERROR,
        message: 'Network error',
        timestamp: new Date()
      })
      .mockReturnValueOnce({
        type: ErrorType.API_KEY_INVALID,
        message: 'API key error',
        timestamp: new Date()
      })

    act(() => {
      result.current.addError(new Error('Network error'))
      result.current.addError(new Error('API key error'))
    })

    expect(result.current.errors).toHaveLength(2)

    act(() => {
      result.current.clearErrorsByType(ErrorType.NETWORK_ERROR)
    })

    expect(result.current.errors).toHaveLength(1)
    expect(result.current.errors[0].type).toBe(ErrorType.API_KEY_INVALID)
  })

  it('respects maxErrors limit', () => {
    const { result } = renderHook(() => useErrorStore())

    // Set max errors to 2
    act(() => {
      useErrorStore.setState({ maxErrors: 2 })
    })

    act(() => {
      result.current.addError(new Error('Error 1'))
      result.current.addError(new Error('Error 2'))
      result.current.addError(new Error('Error 3'))
    })

    expect(result.current.errors).toHaveLength(2)
    // Should keep the most recent errors
    expect(result.current.errors[0].message).toBe('Test error') // Error 3
    expect(result.current.errors[1].message).toBe('Test error') // Error 2
  })

  it('gets errors by type', () => {
    const { result } = renderHook(() => useErrorStore())

    mockErrorHandler.handle
      .mockReturnValueOnce({
        type: ErrorType.NETWORK_ERROR,
        message: 'Network error',
        timestamp: new Date()
      })
      .mockReturnValueOnce({
        type: ErrorType.API_KEY_INVALID,
        message: 'API key error',
        timestamp: new Date()
      })
      .mockReturnValueOnce({
        type: ErrorType.NETWORK_ERROR,
        message: 'Another network error',
        timestamp: new Date()
      })

    act(() => {
      result.current.addError(new Error('Network error'))
      result.current.addError(new Error('API key error'))
      result.current.addError(new Error('Another network error'))
    })

    const networkErrors = result.current.getErrorsByType(ErrorType.NETWORK_ERROR)
    expect(networkErrors).toHaveLength(2)
    expect(networkErrors.every(error => error.type === ErrorType.NETWORK_ERROR)).toBe(true)
  })

  it('checks if has errors', () => {
    const { result } = renderHook(() => useErrorStore())

    expect(result.current.hasErrors()).toBe(false)

    act(() => {
      result.current.addError(new Error('Test error'))
    })

    expect(result.current.hasErrors()).toBe(true)
  })

  it('gets latest error', () => {
    const { result } = renderHook(() => useErrorStore())

    expect(result.current.getLatestError()).toBe(null)

    act(() => {
      result.current.addError(new Error('First error'))
      result.current.addError(new Error('Latest error'))
    })

    const latestError = result.current.getLatestError()
    expect(latestError).not.toBe(null)
    expect(latestError!.message).toBe('Test error') // Mock returns same message
  })

  it('toggles global error handling', () => {
    const { result } = renderHook(() => useErrorStore())

    expect(result.current.isGlobalErrorHandlingEnabled).toBe(true)

    act(() => {
      result.current.setGlobalErrorHandling(false)
    })

    expect(result.current.isGlobalErrorHandlingEnabled).toBe(false)
  })
})

describe('useErrorHandler', () => {
  beforeEach(() => {
    useErrorStore.setState({
      errors: [],
      isGlobalErrorHandlingEnabled: true,
      maxErrors: 10
    })

    jest.clearAllMocks()
    mockErrorHandler.handle.mockReturnValue({
      type: ErrorType.NETWORK_ERROR,
      message: 'Test error',
      timestamp: new Date()
    })
    mockErrorHandler.logError.mockImplementation(() => {})
  })

  it('handles error and adds to store', () => {
    const { result } = renderHook(() => useErrorHandler())
    const { result: storeResult } = renderHook(() => useErrorStore())

    act(() => {
      result.current.handleError(new Error('Test error'))
    })

    expect(storeResult.current.errors).toHaveLength(1)
    expect(mockErrorHandler.handle).toHaveBeenCalledWith(new Error('Test error'))
  })

  it('handles async errors', async () => {
    const { result } = renderHook(() => useErrorHandler())
    const { result: storeResult } = renderHook(() => useErrorStore())

    const asyncFn = jest.fn().mockRejectedValue(new Error('Async error'))

    let response: any
    await act(async () => {
      response = await result.current.handleAsyncError(asyncFn)
    })

    expect(response).toBe(null)
    expect(storeResult.current.errors).toHaveLength(1)
    expect(mockErrorHandler.handle).toHaveBeenCalledWith(new Error('Async error'))
  })

  it('handles successful async operations', async () => {
    const { result } = renderHook(() => useErrorHandler())
    const { result: storeResult } = renderHook(() => useErrorStore())

    const asyncFn = jest.fn().mockResolvedValue('success')

    let response: any
    await act(async () => {
      response = await result.current.handleAsyncError(asyncFn)
    })

    expect(response).toBe('success')
    expect(storeResult.current.errors).toHaveLength(0)
  })

  it('calls onError callback for async errors', async () => {
    const { result } = renderHook(() => useErrorHandler())
    const onError = jest.fn()

    const asyncFn = jest.fn().mockRejectedValue(new Error('Async error'))

    await act(async () => {
      await result.current.handleAsyncError(asyncFn, { onError })
    })

    expect(onError).toHaveBeenCalledWith({
      type: ErrorType.NETWORK_ERROR,
      message: 'Test error',
      timestamp: expect.any(Date)
    })
  })
})