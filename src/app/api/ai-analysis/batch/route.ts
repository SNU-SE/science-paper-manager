import { NextRequest, NextResponse } from 'next/server';
import { AIServiceFactory, AIProvider } from '@/services/ai/AIServiceFactory';
import { MultiModelAnalyzer } from '@/services/ai/MultiModelAnalyzer';
import { AnalysisStorageService } from '@/services/ai/AnalysisStorageService';
import { Paper, AIAnalysisResult } from '@/types';

export interface BatchAnalysisRequest {
  papers: Paper[];
  providers: AIProvider[];
  apiKeys: Record<string, string>;
  options?: {
    maxConcurrency?: number;
    retryAttempts?: number;
    retryDelay?: number;
  };
}

export interface BatchAnalysisResponse {
  success: boolean;
  results: Array<{
    paperId: string;
    analyses: Record<string, AIAnalysisResult>;
    errors: Record<string, string>;
  }>;
  summary: {
    totalPapers: number;
    successfulPapers: number;
    failedPapers: number;
    totalAnalyses: number;
    processingTimeMs: number;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: BatchAnalysisRequest = await request.json();
    const { papers, providers, apiKeys, options = {} } = body;

    // Validate request
    if (!papers || papers.length === 0) {
      return NextResponse.json(
        { error: 'No papers provided for analysis' },
        { status: 400 }
      );
    }

    if (!providers || providers.length === 0) {
      return NextResponse.json(
        { error: 'No AI providers specified' },
        { status: 400 }
      );
    }

    // Validate API keys
    const missingKeys = providers.filter(provider => !apiKeys[provider]);
    if (missingKeys.length > 0) {
      return NextResponse.json(
        { error: `Missing API keys for providers: ${missingKeys.join(', ')}` },
        { status: 400 }
      );
    }

    // Create AI services
    const serviceConfigs = providers.map(provider => ({
      provider,
      apiKey: apiKeys[provider]
    }));

    const services = AIServiceFactory.createServices(serviceConfigs);
    const analyzer = new MultiModelAnalyzer(services);

    // Process papers with controlled concurrency
    const maxConcurrency = options.maxConcurrency || 3;
    const results: BatchAnalysisResponse['results'] = [];
    
    // Process papers in batches to control concurrency
    for (let i = 0; i < papers.length; i += maxConcurrency) {
      const batch = papers.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async (paper) => {
        const paperResult = {
          paperId: paper.id,
          analyses: {} as Record<string, AIAnalysisResult>,
          errors: {} as Record<string, string>
        };

        try {
          const analysis = await analyzer.analyzePaper(paper, providers);
          
          // Store successful analyses
          const analysisResults: AIAnalysisResult[] = [];
          for (const [provider, result] of Object.entries(analysis)) {
            if (result && provider !== 'paperId' && provider !== 'completedAt') {
              paperResult.analyses[provider] = result;
              analysisResults.push(result);
            }
          }

          // Store in database
          if (analysisResults.length > 0) {
            await AnalysisStorageService.storeMultipleResults(analysisResults);
          }

        } catch (error) {
          // Handle paper-level errors
          const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
          providers.forEach(provider => {
            paperResult.errors[provider] = errorMessage;
          });
        }

        return paperResult;
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process batch results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Handle promise rejection
          const paper = batch[index];
          const errorResult = {
            paperId: paper.id,
            analyses: {} as Record<string, AIAnalysisResult>,
            errors: {} as Record<string, string>
          };
          
          providers.forEach(provider => {
            errorResult.errors[provider] = result.reason?.message || 'Unknown error';
          });
          
          results.push(errorResult);
        }
      });
    }

    // Calculate summary statistics
    const summary = {
      totalPapers: papers.length,
      successfulPapers: results.filter(r => Object.keys(r.analyses).length > 0).length,
      failedPapers: results.filter(r => Object.keys(r.errors).length > 0).length,
      totalAnalyses: results.reduce((sum, r) => sum + Object.keys(r.analyses).length, 0),
      processingTimeMs: Date.now() - startTime
    };

    const response: BatchAnalysisResponse = {
      success: true,
      results,
      summary
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Batch analysis failed:', error);
    
    const errorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Batch analysis failed',
      summary: {
        totalPapers: 0,
        successfulPapers: 0,
        failedPapers: 0,
        totalAnalyses: 0,
        processingTimeMs: Date.now() - startTime
      }
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    if (status === 'stats') {
      // Return batch processing statistics
      const stats = await AnalysisStorageService.getAnalysisStats();
      
      return NextResponse.json({
        totalAnalyses: stats.totalAnalyses,
        analysesByProvider: stats.analysesByProvider,
        averageProcessingTime: stats.averageProcessingTime,
        totalTokensUsed: stats.totalTokensUsed,
        recentAnalyses: stats.recentAnalyses
      });
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Failed to get batch analysis stats:', error);
    return NextResponse.json(
      { error: 'Failed to get statistics' },
      { status: 500 }
    );
  }
}