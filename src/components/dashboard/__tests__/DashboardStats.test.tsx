import { render, screen } from '@testing-library/react'
import { DashboardStats } from '../DashboardStats'
import { Paper, UserEvaluation, AIAnalysisResult } from '@/types'

const mockPapers: Paper[] = [
  {
    id: '1',
    title: 'Test Paper 1',
    authors: ['Author 1'],
    readingStatus: 'completed',
    dateAdded: new Date('2024-01-01'),
    dateRead: new Date('2024-01-05'),
    lastModified: new Date('2024-01-05')
  },
  {
    id: '2',
    title: 'Test Paper 2',
    authors: ['Author 2'],
    readingStatus: 'reading',
    dateAdded: new Date('2024-01-10'),
    lastModified: new Date('2024-01-10')
  },
  {
    id: '3',
    title: 'Test Paper 3',
    authors: ['Author 3'],
    readingStatus: 'unread',
    dateAdded: new Date('2024-01-15'),
    lastModified: new Date('2024-01-15')
  }
]

const mockEvaluations: UserEvaluation[] = [
  {
    id: '1',
    paperId: '1',
    rating: 5,
    notes: 'Great paper',
    tags: ['excellent'],
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05')
  },
  {
    id: '2',
    paperId: '2',
    rating: 4,
    notes: 'Good paper',
    tags: ['good'],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10')
  }
]

const mockAnalyses: AIAnalysisResult[] = [
  {
    id: '1',
    paperId: '1',
    modelProvider: 'openai',
    modelName: 'gpt-4',
    summary: 'Test summary',
    keywords: ['test'],
    confidenceScore: 0.9,
    tokensUsed: 100,
    processingTimeMs: 1000,
    createdAt: new Date('2024-01-05')
  }
]

describe('DashboardStats', () => {
  it('renders statistics correctly', () => {
    render(
      <DashboardStats
        papers={mockPapers}
        evaluations={mockEvaluations}
        aiAnalyses={mockAnalyses}
      />
    )

    // Check total papers
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Total Papers')).toBeInTheDocument()

    // Check reading progress
    expect(screen.getByText('33%')).toBeInTheDocument() // 1 completed out of 3
    expect(screen.getByText('Reading Progress')).toBeInTheDocument()

    // Check AI analyses
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('AI Analyses')).toBeInTheDocument()

    // Check average rating
    expect(screen.getByText('4.5')).toBeInTheDocument() // (5 + 4) / 2
    expect(screen.getByText('Average Rating')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(
      <DashboardStats
        papers={[]}
        evaluations={[]}
        aiAnalyses={[]}
        isLoading={true}
      />
    )

    // Should show loading skeletons
    const loadingElements = document.querySelectorAll('.animate-pulse')
    expect(loadingElements.length).toBeGreaterThan(0)
  })

  it('handles empty data', () => {
    render(
      <DashboardStats
        papers={[]}
        evaluations={[]}
        aiAnalyses={[]}
      />
    )

    // Should show zeros for empty data
    expect(screen.getByText('No papers yet')).toBeInTheDocument()
    expect(screen.getByText('0 rated papers')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})