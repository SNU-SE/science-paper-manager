import { render, screen, fireEvent } from '@testing-library/react'
import { PaperCard } from '../PaperCard'
import { Paper, UserEvaluation, MultiModelAnalysis } from '@/types'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

const mockPaper: Paper = {
  id: '1',
  title: 'Test Paper Title',
  authors: ['John Doe', 'Jane Smith'],
  journal: 'Test Journal',
  publicationYear: 2023,
  doi: '10.1000/test',
  abstract: 'This is a test abstract for the paper.',
  readingStatus: 'unread',
  dateAdded: new Date('2023-01-01'),
  lastModified: new Date('2023-01-01')
}

const mockEvaluation: UserEvaluation = {
  id: '1',
  paperId: '1',
  rating: 4,
  notes: 'Great paper!',
  tags: ['machine learning', 'AI'],
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01')
}

const mockAnalyses: MultiModelAnalysis = {
  openai: {
    id: '1',
    paperId: '1',
    modelProvider: 'openai',
    modelName: 'gpt-4',
    summary: 'AI-generated summary',
    keywords: ['AI', 'ML'],
    confidenceScore: 0.95,
    tokensUsed: 1000,
    processingTimeMs: 2000,
    createdAt: new Date('2023-01-01')
  }
}

describe('PaperCard', () => {
  const mockOnStatusChange = jest.fn()
  const mockOnRatingChange = jest.fn()
  const mockOnCardClick = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders paper information correctly', () => {
    render(
      <PaperCard
        paper={mockPaper}
        userEvaluation={mockEvaluation}
        aiAnalyses={mockAnalyses}
        onStatusChange={mockOnStatusChange}
        onRatingChange={mockOnRatingChange}
        onCardClick={mockOnCardClick}
      />
    )

    expect(screen.getByText('Test Paper Title')).toBeInTheDocument()
    expect(screen.getByText('John Doe, Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Test Journal')).toBeInTheDocument()
    expect(screen.getByText('2023')).toBeInTheDocument()
  })

  it('displays reading status badge', () => {
    render(
      <PaperCard
        paper={mockPaper}
        onStatusChange={mockOnStatusChange}
        onRatingChange={mockOnRatingChange}
      />
    )

    expect(screen.getByText('unread')).toBeInTheDocument()
  })

  it('shows AI analysis indicator when analyses are present', () => {
    render(
      <PaperCard
        paper={mockPaper}
        aiAnalyses={mockAnalyses}
        onStatusChange={mockOnStatusChange}
        onRatingChange={mockOnRatingChange}
      />
    )

    expect(screen.getByText('1 AI')).toBeInTheDocument()
  })

  it('displays user tags', () => {
    render(
      <PaperCard
        paper={mockPaper}
        userEvaluation={mockEvaluation}
        onStatusChange={mockOnStatusChange}
        onRatingChange={mockOnRatingChange}
      />
    )

    expect(screen.getByText('machine learning')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('calls onCardClick when card is clicked', () => {
    render(
      <PaperCard
        paper={mockPaper}
        onStatusChange={mockOnStatusChange}
        onRatingChange={mockOnRatingChange}
        onCardClick={mockOnCardClick}
      />
    )

    // Click on the card container
    const cardElement = screen.getByText('Test Paper Title').closest('[data-slot="card"]')
    if (cardElement) {
      fireEvent.click(cardElement)
      expect(mockOnCardClick).toHaveBeenCalledTimes(1)
    }
  })

  it('calls onRatingChange when star is clicked', () => {
    render(
      <PaperCard
        paper={mockPaper}
        userEvaluation={mockEvaluation}
        onStatusChange={mockOnStatusChange}
        onRatingChange={mockOnRatingChange}
      />
    )

    // Find star elements by their SVG class
    const stars = document.querySelectorAll('.lucide-star')
    expect(stars).toHaveLength(5)
    
    // Click the fifth star (index 4)
    fireEvent.click(stars[4])
    expect(mockOnRatingChange).toHaveBeenCalledWith(5)
  })
})