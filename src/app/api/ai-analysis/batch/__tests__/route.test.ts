/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';
import { AIServiceFactory } from '@/services/ai/AIServiceFactory';
import { MultiModelAnalyzer } from '@/services/ai/MultiModelAnalyzer';
import { AnalysisStorageService } from '@/services/ai/AnalysisStorageService';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock dependencies
jest.mock('@/services/ai/AIServiceFactory');
jest.mock('@/services/ai/MultiModelAnalyzer');
jest.mock('@/services/ai/AnalysisStorageService');

const mockAIServiceFactory = AIServiceFactory as jest.Mocked<typeof AIServiceFactory>;
const mockMultiModelAnalyzer = MultiModelAnalyzer as jest.MockedClass<typeof MultiModelAnalyzer>;
const mockAnalysisStorageService = AnalysisStorageService as jest.Mocked<typeof AnalysisStorageService>;

describe('/api/ai-analysis/batch', () => {
  const mockPapers = [
    {
      id: '1',
      title: 'Test Paper 1',
      authors: ['Author 1'],
      abstract: 'Abstract 1',
      readingStatus: 'unread' as const,
      dateAdded: new Date(),
      lastModified: new Date()
    },
    {
      id: '2',
      title: 'Test Paper 2',
      authors: ['Author 2'],
      abstract: 'Abstract 2',
      readingStatus: 'unread' as const,
      dateAdded: new Date(),
      lastModified: new Date()
    }
  ];

  const mockProviders = ['openai', 'anthropic'];
  const mockApiKeys = {
    openai: 'test-openai-key',
    anthropic: 'test-anthropic-key'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('validates request body', async () => {
      const request = new NextRequest('http://localhost/api/ai-analysis/batch', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No papers provided for analysis');
    });

    it('validates providers', async () => {
      const request = new NextRequest('http://localhost/api/ai-analysis/batch', {
        method: 'POST',
        body: JSON.stringify({
          papers: mockPapers,
          providers: [],
          apiKeys: mockApiKeys
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No AI providers specified');
    });

    it('validates API keys', async () => {
      const request = new NextRequest('http://localhost/api/ai-analysis/batch', {
        method: 'POST',
        body: JSON.stringify({
          papers: mockPapers,
          providers: mockProviders,
          apiKeys: { openai: 'test-key' } // Missing anthropic key
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing API keys for providers: anthropic');
    });

    it('processes batch analysis successfully', async () => {
      const mockServices = new Map();
      const mockAnalyzer = {
        analyzePaper: jest.fn().mockResolvedValue({
          openai: {
            id: '1-openai',
            paperId: '1',
            modelProvider: 'openai',
            summary: 'Test summary',
            keywords: ['test'],
            confidenceScore: 0.9,
            tokensUsed: 100,
            processingTimeMs: 1000,
            createdAt: new Date()
          },
          anthropic: {
            id: '1-anthropic',
            paperId: '1',
            modelProvider: 'anthropic',
            summary: 'Test summary',
            keywords: ['test'],
            confidenceScore: 0.8,
            tokensUsed: 120,
            processingTimeMs: 1200,
            createdAt: new Date()
          }
        })
      };

      mockAIServiceFactory.createServices.mockReturnValue(mockServices);
      mockMultiModelAnalyzer.mockImplementation(() => mockAnalyzer as any);
      mockAnalysisStorageService.storeMultipleResults.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/ai-analysis/batch', {
        method: 'POST',
        body: JSON.stringify({
          papers: [mockPapers[0]],
          providers: mockProviders,
          apiKeys: mockApiKeys
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(1);
      expect(data.results[0].paperId).toBe('1');
      expect(data.results[0].analyses).toHaveProperty('openai');
      expect(data.results[0].analyses).toHaveProperty('anthropic');
      expect(data.summary.totalPapers).toBe(1);
      expect(data.summary.totalAnalyses).toBe(2);
    });

    it('handles analysis errors gracefully', async () => {
      const mockServices = new Map();
      const mockAnalyzer = {
        analyzePaper: jest.fn().mockRejectedValue(new Error('Analysis failed'))
      };

      mockAIServiceFactory.createServices.mockReturnValue(mockServices);
      mockMultiModelAnalyzer.mockImplementation(() => mockAnalyzer as any);

      const request = new NextRequest('http://localhost/api/ai-analysis/batch', {
        method: 'POST',
        body: JSON.stringify({
          papers: [mockPapers[0]],
          providers: mockProviders,
          apiKeys: mockApiKeys
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(1);
      expect(data.results[0].errors).toHaveProperty('openai');
      expect(data.results[0].errors).toHaveProperty('anthropic');
      expect(data.summary.failedPapers).toBe(1);
    });

    it('respects concurrency limits', async () => {
      const mockServices = new Map();
      const mockAnalyzer = {
        analyzePaper: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return {
            openai: {
              id: 'test-id',
              paperId: 'test',
              modelProvider: 'openai',
              summary: 'Test',
              keywords: [],
              confidenceScore: 0.9,
              tokensUsed: 100,
              processingTimeMs: 100,
              createdAt: new Date()
            }
          };
        })
      };

      mockAIServiceFactory.createServices.mockReturnValue(mockServices);
      mockMultiModelAnalyzer.mockImplementation(() => mockAnalyzer as any);
      mockAnalysisStorageService.storeMultipleResults.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/ai-analysis/batch', {
        method: 'POST',
        body: JSON.stringify({
          papers: mockPapers,
          providers: ['openai'],
          apiKeys: { openai: 'test-key' },
          options: {
            maxConcurrency: 1
          }
        })
      });

      const startTime = Date.now();
      const response = await POST(request);
      const endTime = Date.now();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(2);
      
      // With concurrency 1, should take at least 200ms (2 papers * 100ms each)
      expect(endTime - startTime).toBeGreaterThanOrEqual(150);
    });

    it('handles storage errors', async () => {
      const mockServices = new Map();
      const mockAnalyzer = {
        analyzePaper: jest.fn().mockResolvedValue({
          openai: {
            id: '1-openai',
            paperId: '1',
            modelProvider: 'openai',
            summary: 'Test summary',
            keywords: ['test'],
            confidenceScore: 0.9,
            tokensUsed: 100,
            processingTimeMs: 1000,
            createdAt: new Date()
          }
        })
      };

      mockAIServiceFactory.createServices.mockReturnValue(mockServices);
      mockMultiModelAnalyzer.mockImplementation(() => mockAnalyzer as any);
      mockAnalysisStorageService.storeMultipleResults.mockRejectedValue(new Error('Storage failed'));

      const request = new NextRequest('http://localhost/api/ai-analysis/batch', {
        method: 'POST',
        body: JSON.stringify({
          papers: [mockPapers[0]],
          providers: ['openai'],
          apiKeys: { openai: 'test-key' }
        })
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still succeed even if storage fails
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results[0].analyses).toHaveProperty('openai');
    });
  });

  describe('GET', () => {
    it('returns analysis statistics', async () => {
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

      mockAnalysisStorageService.getAnalysisStats.mockResolvedValue(mockStats);

      const request = new NextRequest('http://localhost/api/ai-analysis/batch?status=stats');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockStats);
    });

    it('handles invalid requests', async () => {
      const request = new NextRequest('http://localhost/api/ai-analysis/batch?status=invalid');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('handles stats errors', async () => {
      mockAnalysisStorageService.getAnalysisStats.mockRejectedValue(new Error('Stats error'));

      const request = new NextRequest('http://localhost/api/ai-analysis/batch?status=stats');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get statistics');
    });
  });
});