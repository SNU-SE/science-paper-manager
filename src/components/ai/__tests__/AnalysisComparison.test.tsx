import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnalysisComparison } from '../AnalysisComparison'
import { MultiModelAnalysis, AIAnalysisResult } from '@/types'

const mockAnalysisResult: AIAnalysisResult = {
  id: 'test-analysis-1',
  paperId: 'test-paper-1',
  modelProvider: 'openai',
  modelName: 'gpt-4',
  summary: 'This is a comprehensive analysis of the research paper covering key findings and methodologies.',
  keywords: ['machine learning', 'neural networks', 'deep learning', 'artificial intelligence', 'research'],
  scientificRelevance: {
    score: 0.85,
    reasoning: 'High relevance due to novel approach'
  },
  confidenceScore: 0.92,
  tokensUsed: 1500,
  processingTimeMs: 3200,
  createdAt: new Date('2024-01-15T10:00:00Z')
}

const mockAnalysisResult2: AIAnalysisResult = {
  id: 'test-analysis-2',
  paperId: 'test-paper-1',
  modelProvider: 'anthropic',
  modelName: 'claude-3-sonnet-20240229',
  summary: 'Detailed examination of the paper reveals significant contributions to the field with robust methodology.',
  keywords: ['machine learning', 'methodology', 'research', 'innovation', 'analysis'],
  scientificRelevance: {
    score: 0.78,
    reasoning: 'Good relevance with solid methodology'
  },
  confidenceScore: 0.88,
  tokensUsed: 1800,
  processingTimeMs: 4100,
  createdAt: new Date('2024-01-15T10:05:00Z')
}

const mockMultiModelAnalysis: MultiModelAnalysis = {
  openai: mockAnalysisResult,
  anthropic: mockAnalysisResult2
}

const mockProps = {
  analyses: mockMultiModelAnalysis,
  paperId: 'test-paper-1',
  isLoading: false,
  onModelSelect: jest.fn(),
  onReanalyze: jest.fn()
}

describe('AnalysisComparison', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly with analysis results', () => {
    render(<AnalysisComparison {...mockProps} />)
    
    expect(screen.getByText('Analysis Results')).toBeInTheDocument()
    expect(screen.getByText('Compare AI analysis results across different models')).toBeInTheDocument()
  })

  it('displays overview statistics correctly', () => {
    render(<AnalysisComparison {...mockProps} />)
    
    // Should show 2 completed models
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Models Completed')).toBeInTheDocument()
    
    // Should show average confidence (92% + 88%) / 2 = 90%
    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('Avg Confidence')).toBeInTheDocument()
    
    // Should show total tokens (1500 + 1800 = 3300)
    expect(screen.getByText('3,300')).toBeInTheDocument()
    expect(screen.getByText('Total Tokens')).toBeInTheDocument()
  })

  it('displays model analysis cards in overview tab', () => {
    render(<AnalysisComparison {...mockProps} />)
    
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    
    // Should show summaries
    expect(screen.getByText(/This is a comprehensive analysis/)).toBeInTheDocument()
    expect(screen.getByText(/Detailed examination of the paper/)).toBeInTheDocument()
  })

  it('handles model selection correctly', async () => {
    const user = userEvent.setup()
    render(<AnalysisComparison {...mockProps} />)
    
    // Click on OpenAI card
    const openaiCard = screen.getByText('OpenAI').closest('.cursor-pointer')
    if (openaiCard) {
      await user.click(openaiCard)
    }
    
    expect(mockProps.onModelSelect).toHaveBeenCalledWith('openai')
  })

  it('switches between tabs correctly', async () => {
    const user = userEvent.setup()
    render(<AnalysisComparison {...mockProps} />)
    
    // Click Detailed tab
    await user.click(screen.getByText('Detailed'))
    
    // Should show message to select a model
    expect(screen.getByText(/Select a specific model from the Overview tab/)).toBeInTheDocument()
    
    // Click Comparison tab
    await user.click(screen.getByText('Comparison'))
    
    // Should show keyword analysis
    expect(screen.getByText('Keyword Analysis')).toBeInTheDocument()
    expect(screen.getByText('Performance Comparison')).toBeInTheDocument()
  })

  it('displays detailed analysis when model is selected', async () => {
    const user = userEvent.setup()
    render(<AnalysisComparison {...mockProps} />)
    
    // First select a model by clicking on it
    const openaiCard = screen.getByText('OpenAI').closest('.cursor-pointer')
    if (openaiCard) {
      await user.click(openaiCard)
    }
    
    // Then switch to detailed tab
    await user.click(screen.getByText('Detailed'))
    
    // Should show detailed OpenAI analysis
    expect(screen.getByText('OpenAI Analysis')).toBeInTheDocument()
    expect(screen.getByText('92.0%')).toBeInTheDocument() // Confidence score
    expect(screen.getByText('1,500')).toBeInTheDocument() // Tokens used
    expect(screen.getByText('3.2s')).toBeInTheDocument() // Processing time
  })

  it('displays keyword overlap in comparison tab', async () => {
    const user = userEvent.setup()
    render(<AnalysisComparison {...mockProps} />)
    
    // Switch to comparison tab
    await user.click(screen.getByText('Comparison'))
    
    // Should show overlapping keywords
    expect(screen.getByText('machine learning')).toBeInTheDocument()
    expect(screen.getByText('research')).toBeInTheDocument()
    
    // Should show provider counts
    expect(screen.getByText('(2/2 models)')).toBeInTheDocument()
  })

  it('shows loading state correctly', () => {
    const loadingProps = { ...mockProps, isLoading: true }
    render(<AnalysisComparison {...loadingProps} />)
    
    expect(screen.getByText('Analyzing paper with AI models...')).toBeInTheDocument()
  })

  it('shows empty state when no analyses available', () => {
    const emptyProps = { ...mockProps, analyses: {} }
    render(<AnalysisComparison {...emptyProps} />)
    
    expect(screen.getByText(/No analysis results available/)).toBeInTheDocument()
  })

  it('handles reanalyze button click', async () => {
    const user = userEvent.setup()
    const analysesWithMissing = {
      openai: mockAnalysisResult,
      // anthropic missing
    }
    const propsWithMissing = { ...mockProps, analyses: analysesWithMissing }
    
    render(<AnalysisComparison {...propsWithMissing} />)
    
    // Should show Analyze button for missing analysis
    const analyzeButton = screen.getByText('Analyze')
    await user.click(analyzeButton)
    
    expect(mockProps.onReanalyze).toHaveBeenCalledWith('anthropic')
  })

  it('formats processing time correctly', () => {
    const fastAnalysis = {
      ...mockAnalysisResult,
      processingTimeMs: 500
    }
    const slowAnalysis = {
      ...mockAnalysisResult2,
      processingTimeMs: 15000
    }
    
    const analysesWithDifferentTimes = {
      openai: fastAnalysis,
      anthropic: slowAnalysis
    }
    
    render(<AnalysisComparison {...mockProps} analyses={analysesWithDifferentTimes} />)
    
    // Should show milliseconds for fast analysis
    expect(screen.getByText('500ms')).toBeInTheDocument()
    
    // Should show seconds for slow analysis
    expect(screen.getByText('15.0s')).toBeInTheDocument()
  })

  it('displays scientific relevance in detailed view', async () => {
    const user = userEvent.setup()
    render(<AnalysisComparison {...mockProps} />)
    
    // Select OpenAI model
    const openaiCard = screen.getByText('OpenAI').closest('.cursor-pointer')
    if (openaiCard) {
      await user.click(openaiCard)
    }
    
    // Switch to detailed tab
    await user.click(screen.getByText('Detailed'))
    
    // Should show scientific relevance section
    expect(screen.getByText('Scientific Relevance')).toBeInTheDocument()
    expect(screen.getByText(/"score": 0.85/)).toBeInTheDocument()
  })

  it('displays progress bars for confidence scores', () => {
    render(<AnalysisComparison {...mockProps} />)
    
    // Switch to comparison tab to see progress bars
    fireEvent.click(screen.getByText('Comparison'))
    
    // Should have progress bars (role="progressbar")
    const progressBars = screen.getAllByRole('progressbar')
    expect(progressBars.length).toBeGreaterThan(0)
  })

  it('handles missing scientific relevance gracefully', async () => {
    const user = userEvent.setup()
    const analysisWithoutRelevance = {
      ...mockAnalysisResult,
      scientificRelevance: undefined
    }
    const analysesWithoutRelevance = {
      openai: analysisWithoutRelevance
    }
    
    render(<AnalysisComparison {...mockProps} analyses={analysesWithoutRelevance} />)
    
    // Select model and go to detailed view
    const openaiCard = screen.getByText('OpenAI').closest('.cursor-pointer')
    if (openaiCard) {
      await user.click(openaiCard)
    }
    
    await user.click(screen.getByText('Detailed'))
    
    // Should not show scientific relevance section
    expect(screen.queryByText('Scientific Relevance')).not.toBeInTheDocument()
  })
})