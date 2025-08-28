import { render, screen, fireEvent } from '@testing-library/react'
import PaperDetail from '../PaperDetail'

// Mock child components
jest.mock('../UserEvaluation', () => {
  return function MockUserEvaluation({ evaluation, onUpdate }: any) {
    return (
      <div data-testid="user-evaluation">
        <button onClick={() => onUpdate({ rating: 5 })}>Update Rating</button>
      </div>
    )
  }
})

jest.mock('../../ai/AnalysisComparison', () => {
  return function MockAnalysisComparison({ analyses }: any) {
    return (
      <div data-testid="analysis-comparison">
        {Object.keys(analyses).map(model => (
          <div key={model} data-testid={`${model}-analysis`}>
            {model}: {analyses[model]?.summary}
          </div>
        ))}
      </div>
    )
  }
})

jest.mock('../GoogleDriveViewer', () => {
  return function MockGoogleDriveViewer({ url }: any) {
    return <div data-testid="google-drive-viewer">PDF: {url}</div>
  }
})

const mockPaper = {
  id: 'test-paper-id',
  title: 'Test Paper Title',
  authors: ['Author 1', 'Author 2'],
  abstract: 'This is a test abstract about machine learning and AI.',
  journal: 'Test Journal',
  publicationYear: 2024,
  doi: '10.1000/test.doi',
  googleDriveUrl: 'https://drive.google.com/file/test',
  readingStatus: 'unread' as const,
  dateAdded: new Date('2024-01-01'),
  lastModified: new Date('2024-01-01'),
}

const mockEvaluation = {
  id: 'eval-id',
  paperId: 'test-paper-id',
  rating: 4,
  notes: 'Great paper with interesting insights',
  tags: ['machine-learning', 'ai'],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const mockAnalyses = {
  openai: {
    id: 'openai-analysis-id',
    paperId: 'test-paper-id',
    modelProvider: 'openai' as const,
    modelName: 'gpt-4',
    summary: 'OpenAI generated summary',
    keywords: ['ml', 'ai'],
    confidenceScore: 0.9,
    tokensUsed: 150,
    processingTimeMs: 2000,
    createdAt: new Date('2024-01-01'),
  },
  anthropic: {
    id: 'anthropic-analysis-id',
    paperId: 'test-paper-id',
    modelProvider: 'anthropic' as const,
    modelName: 'claude-3',
    summary: 'Anthropic generated summary',
    keywords: ['machine-learning', 'artificial-intelligence'],
    confidenceScore: 0.85,
    tokensUsed: 120,
    processingTimeMs: 1800,
    createdAt: new Date('2024-01-01'),
  },
}

describe('PaperDetail Component', () => {
  const mockOnClose = jest.fn()
  const mockOnUpdate = jest.fn()

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should render paper information', () => {
    render(
      <PaperDetail
        paper={mockPaper}
        evaluation={mockEvaluation}
        analyses={mockAnalyses}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    expect(screen.getByText('Test Paper Title')).toBeInTheDocument()
    expect(screen.getByText('Author 1, Author 2')).toBeInTheDocument()
    expect(screen.getByText('Test Journal (2024)')).toBeInTheDocument()
    expect(screen.getByText(mockPaper.abstract)).toBeInTheDocument()
  })

  it('should display DOI link when available', () => {
    render(
      <PaperDetail
        paper={mockPaper}
        evaluation={mockEvaluation}
        analyses={mockAnalyses}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    const doiLink = screen.getByText('10.1000/test.doi')
    expect(doiLink).toBeInTheDocument()
    expect(doiLink.closest('a')).toHaveAttribute('href', 'https://doi.org/10.1000/test.doi')
  })

  it('should render tabs for different sections', () => {
    render(
      <PaperDetail
        paper={mockPaper}
        evaluation={mockEvaluation}
        analyses={mockAnalyses}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'PDF' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'AI Analysis' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'My Notes' })).toBeInTheDocument()
  })

  it('should switch between tabs', () => {
    render(
      <PaperDetail
        paper={mockPaper}
        evaluation={mockEvaluation}
        analyses={mockAnalyses}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    // Click on AI Analysis tab
    fireEvent.click(screen.getByRole('tab', { name: 'AI Analysis' }))
    
    expect(screen.getByTestId('analysis-comparison')).toBeInTheDocument()
    expect(screen.getByTestId('openai-analysis')).toBeInTheDocument()
    expect(screen.getByTestId('anthropic-analysis')).toBeInTheDocument()
  })

  it('should display PDF viewer when PDF tab is selected', () => {
    render(
      <PaperDetail
        paper={mockPaper}
        evaluation={mockEvaluation}
        analyses={mockAnalyses}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    // Click on PDF tab
    fireEvent.click(screen.getByRole('tab', { name: 'PDF' }))
    
    expect(screen.getByTestId('google-drive-viewer')).toBeInTheDocument()
  })

  it('should display user evaluation in My Notes tab', () => {
    render(
      <PaperDetail
        paper={mockPaper}
        evaluation={mockEvaluation}
        analyses={mockAnalyses}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    // Click on My Notes tab
    fireEvent.click(screen.getByRole('tab', { name: 'My Notes' }))
    
    expect(screen.getByTestId('user-evaluation')).toBeInTheDocument()
  })

  it('should handle evaluation updates', () => {
    render(
      <PaperDetail
        paper={mockPaper}
        evaluation={mockEvaluation}
        analyses={mockAnalyses}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    // Click on My Notes tab and update rating
    fireEvent.click(screen.getByRole('tab', { name: 'My Notes' }))
    fireEvent.click(screen.getByText('Update Rating'))
    
    expect(mockOnUpdate).toHaveBeenCalledWith({ rating: 5 })
  })

  it('should handle close action', () => {
    render(
      <PaperDetail
        paper={mockPaper}
        evaluation={mockEvaluation}
        analyses={mockAnalyses}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    fireEvent.click(screen.getByTestId('close-button'))
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should handle missing PDF gracefully', () => {
    const paperWithoutPdf = { ...mockPaper, googleDriveUrl: undefined }
    
    render(
      <PaperDetail
        paper={paperWithoutPdf}
        evaluation={mockEvaluation}
        analyses={mockAnalyses}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    fireEvent.click(screen.getByRole('tab', { name: 'PDF' }))
    
    expect(screen.getByText('PDF not available')).toBeInTheDocument()
  })

  it('should handle missing analyses gracefully', () => {
    render(
      <PaperDetail
        paper={mockPaper}
        evaluation={mockEvaluation}
        analyses={{}}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    fireEvent.click(screen.getByRole('tab', { name: 'AI Analysis' }))
    
    expect(screen.getByText('No AI analyses available')).toBeInTheDocument()
  })
})