'use client';

import { useState, useCallback, useRef } from 'react';
import { Paper, AIModel } from '@/types';

export interface BatchAnalysisProgress {
  stage: 'preparing' | 'analyzing' | 'storing' | 'completed' | 'error' | 'cancelled';
  currentPaper: number;
  totalPapers: number;
  currentProvider?: AIModel;
  completedAnalyses: number;
  failedAnalyses: number;
  message: string;
  estimatedTimeRemaining?: number;
}

export interface BatchAnalysisResult {
  paperId: string;
  analyses: Record<string, any>;
  errors: Record<string, string>;
}

export interface BatchAnalysisOptions {
  maxConcurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
  onProgress?: (progress: BatchAnalysisProgress) => void;
  onPaperComplete?: (paperId: string, result: BatchAnalysisResult) => void;
}

export function useBatchAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<BatchAnalysisProgress | null>(null);
  const [results, setResults] = useState<BatchAnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const startBatchAnalysis = useCallback(async (
    papers: Paper[],
    providers: AIModel[],
    apiKeys: Record<string, string>,
    options: BatchAnalysisOptions = {}
  ) => {
    if (papers.length === 0 || providers.length === 0) {
      setError('No papers or providers specified');
      return;
    }

    // Validate API keys
    const missingKeys = providers.filter(provider => !apiKeys[provider]);
    if (missingKeys.length > 0) {
      setError(`Missing API keys for: ${missingKeys.join(', ')}`);
      return;
    }

    // Create abort controller
    abortControllerRef.current = new AbortController();
    
    setIsAnalyzing(true);
    setError(null);
    setResults([]);
    
    const startTime = Date.now();
    
    try {
      // Initial progress
      const initialProgress: BatchAnalysisProgress = {
        stage: 'preparing',
        currentPaper: 0,
        totalPapers: papers.length,
        completedAnalyses: 0,
        failedAnalyses: 0,
        message: 'Preparing batch analysis...'
      };
      
      setProgress(initialProgress);
      options.onProgress?.(initialProgress);

      // Send batch request to API
      const response = await fetch('/api/ai-analysis/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          papers,
          providers,
          apiKeys,
          options: {
            maxConcurrency: options.maxConcurrency || 3,
            retryAttempts: options.retryAttempts || 2,
            retryDelay: options.retryDelay || 5000
          }
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Batch analysis failed');
      }

      const batchResult = await response.json();
      
      if (!batchResult.success) {
        throw new Error(batchResult.error || 'Batch analysis failed');
      }

      // Update results
      setResults(batchResult.results);

      // Final progress
      const finalProgress: BatchAnalysisProgress = {
        stage: 'completed',
        currentPaper: papers.length,
        totalPapers: papers.length,
        completedAnalyses: batchResult.summary.totalAnalyses,
        failedAnalyses: batchResult.summary.failedPapers * providers.length - batchResult.summary.totalAnalyses,
        message: `Completed ${batchResult.summary.totalAnalyses} analyses in ${(batchResult.summary.processingTimeMs / 1000).toFixed(1)}s`
      };

      setProgress(finalProgress);
      options.onProgress?.(finalProgress);

      // Notify about individual paper completions
      batchResult.results.forEach((result: BatchAnalysisResult) => {
        options.onPaperComplete?.(result.paperId, result);
      });

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const cancelledProgress: BatchAnalysisProgress = {
          stage: 'cancelled',
          currentPaper: 0,
          totalPapers: papers.length,
          completedAnalyses: 0,
          failedAnalyses: 0,
          message: 'Analysis cancelled by user'
        };
        
        setProgress(cancelledProgress);
        options.onProgress?.(cancelledProgress);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Batch analysis failed';
        setError(errorMessage);
        
        const errorProgress: BatchAnalysisProgress = {
          stage: 'error',
          currentPaper: 0,
          totalPapers: papers.length,
          completedAnalyses: 0,
          failedAnalyses: papers.length * providers.length,
          message: errorMessage
        };
        
        setProgress(errorProgress);
        options.onProgress?.(errorProgress);
      }
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  }, []);

  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setProgress(null);
    setError(null);
  }, []);

  const getAnalysisStats = useCallback(async () => {
    try {
      const response = await fetch('/api/ai-analysis/batch?status=stats');
      
      if (!response.ok) {
        throw new Error('Failed to get analysis stats');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting analysis stats:', error);
      return null;
    }
  }, []);

  return {
    // State
    isAnalyzing,
    progress,
    results,
    error,

    // Actions
    startBatchAnalysis,
    cancelAnalysis,
    clearResults,
    getAnalysisStats
  };
}