import { renderHook, act } from '@testing-library/react';
import { useBatchAnalysis } from '../useBatchAnalysis';
import { Paper, AIModel } from '@/types';

// Mock fetch
global.fetch = jest.fn();

describe('useBatchAnalysis', () => {
  const mockPapers: Paper[] = [
    {
      id: '1',
      title: 'Test Paper 1',
      authors: ['Author 1'],
      readingStatus: 'unread',
      dateAdded: new Date(),
      lastModified: new Date()
    },
    {
      id: '2',
      title: 'Test Paper 2',
      authors: ['Author 2'],
      readingStatus: 'unread',
      dateAdded: new Date(),
      lastModified: new Date()
    }
  ];

  const mockProviders: AIModel[] = ['openai', 'anthropic'];
  const mockApiKeys = {
    openai: 'test-openai-key',
    anthropic: 'test-anthropic-key'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useBatchAnalysis());

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.results).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('validates input parameters', async () => {
    const { result } = renderHook(() => useBatchAnalysis());

    await act(async () => {
      await result.current.startBatchAnalysis([], mockProviders, mockApiKeys);
    });

    expect(result.current.error).toBe('No papers or providers specified');
  });

  it('validates API keys', async () => {
    const { result } = renderHook(() => useBatchAnalysis());

    await act(async () => {
      await result.current.startBatchAnalysis(
        mockPapers,
        mockProviders,
        { openai: 'test-key' } // Missing anthropic key
      );
    });

    expect(result.current.error).toBe('Missing API keys for: anthropic');
  });

  it('handles successful batch analysis', async () => {
    const mockResponse = {
      success: true,
      results: [
        {
          paperId: '1',
          analyses: {
            openai: { id: '1-openai', summary: 'Summary 1' },
            anthropic: { id: '1-anthropic', summary: 'Summary 1' }
          },
          errors: {}
        },
        {
          paperId: '2',
          analyses: {
            openai: { id: '2-openai', summary: 'Summary 2' }
          },
          errors: {
            anthropic: 'Analysis failed'
          }
        }
      ],
      summary: {
        totalPapers: 2,
        successfulPapers: 2,
        failedPapers: 0,
        totalAnalyses: 3,
        processingTimeMs: 5000
      }
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const { result } = renderHook(() => useBatchAnalysis());

    await act(async () => {
      await result.current.startBatchAnalysis(mockPapers, mockProviders, mockApiKeys);
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.results).toEqual(mockResponse.results);
    expect(result.current.error).toBeNull();
    expect(result.current.progress?.stage).toBe('completed');
  });

  it('handles API errors', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' })
    });

    const { result } = renderHook(() => useBatchAnalysis());

    await act(async () => {
      await result.current.startBatchAnalysis(mockPapers, mockProviders, mockApiKeys);
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.error).toBe('Server error');
    expect(result.current.progress?.stage).toBe('error');
  });

  it('handles network errors', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useBatchAnalysis());

    await act(async () => {
      await result.current.startBatchAnalysis(mockPapers, mockProviders, mockApiKeys);
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.error).toBe('Network error');
    expect(result.current.progress?.stage).toBe('error');
  });

  it('calls progress callback during analysis', async () => {
    const mockResponse = {
      success: true,
      results: [],
      summary: {
        totalPapers: 2,
        successfulPapers: 2,
        failedPapers: 0,
        totalAnalyses: 2,
        processingTimeMs: 1000
      }
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const onProgress = jest.fn();
    const onPaperComplete = jest.fn();

    const { result } = renderHook(() => useBatchAnalysis());

    await act(async () => {
      await result.current.startBatchAnalysis(
        mockPapers,
        mockProviders,
        mockApiKeys,
        { onProgress, onPaperComplete }
      );
    });

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'preparing',
        totalPapers: 2,
        message: 'Preparing batch analysis...'
      })
    );

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'completed',
        totalPapers: 2
      })
    );
  });

  it('supports cancellation', async () => {
    // Mock a long-running request
    (fetch as jest.Mock).mockImplementationOnce(() => 
      new Promise((_, reject) => {
        setTimeout(() => {
          const error = new Error('Request cancelled');
          error.name = 'AbortError';
          reject(error);
        }, 100);
      })
    );

    const { result } = renderHook(() => useBatchAnalysis());

    act(() => {
      result.current.startBatchAnalysis(mockPapers, mockProviders, mockApiKeys);
    });

    // Cancel after starting
    act(() => {
      result.current.cancelAnalysis();
    });

    // Wait for cancellation to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(result.current.progress?.stage).toBe('cancelled');
    expect(result.current.isAnalyzing).toBe(false);
  });

  it('clears results and state', () => {
    const { result } = renderHook(() => useBatchAnalysis());

    // Set some state
    act(() => {
      result.current.clearResults();
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('gets analysis statistics', async () => {
    const mockStats = {
      totalAnalyses: 100,
      analysesByProvider: {
        openai: 50,
        anthropic: 30,
        xai: 20
      },
      averageProcessingTime: 2500,
      totalTokensUsed: 50000,
      recentAnalyses: 10
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats
    });

    const { result } = renderHook(() => useBatchAnalysis());

    let stats;
    await act(async () => {
      stats = await result.current.getAnalysisStats();
    });

    expect(stats).toEqual(mockStats);
    expect(fetch).toHaveBeenCalledWith('/api/ai-analysis/batch?status=stats');
  });

  it('handles stats API errors gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Stats error'));

    const { result } = renderHook(() => useBatchAnalysis());

    let stats;
    await act(async () => {
      stats = await result.current.getAnalysisStats();
    });

    expect(stats).toBeNull();
  });

  it('passes custom options to API', async () => {
    const mockResponse = {
      success: true,
      results: [],
      summary: {
        totalPapers: 1,
        successfulPapers: 1,
        failedPapers: 0,
        totalAnalyses: 1,
        processingTimeMs: 1000
      }
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const { result } = renderHook(() => useBatchAnalysis());

    const customOptions = {
      maxConcurrency: 5,
      retryAttempts: 3,
      retryDelay: 10000
    };

    await act(async () => {
      await result.current.startBatchAnalysis(
        [mockPapers[0]],
        mockProviders,
        mockApiKeys,
        customOptions
      );
    });

    expect(fetch).toHaveBeenCalledWith('/api/ai-analysis/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        papers: [mockPapers[0]],
        providers: mockProviders,
        apiKeys: mockApiKeys,
        options: customOptions
      }),
      signal: expect.any(AbortSignal)
    });
  });
});