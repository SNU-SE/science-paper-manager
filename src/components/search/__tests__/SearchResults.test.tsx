import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchResults } from '../SearchResults'
import type { SearchResult, Paper } from '@/types'

// Mock the UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, onClick, ...props }: any) => (
    <div onClick={onClick} {...props}>{children}</div>
  ),
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, ...props }: any) => (
    <span data-variant={variant} {...props}>{children}</span>
  )
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  )
}))

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, ...props }: any) => (
    <div data-testid="progress" data-value={value} {...props} />
  )
}))

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  FileText: () => <div data-testid="file-text-icon" />,
  ExternalLink: () => <div data-testid="external-link-icon" />,
  Star: () => <div data-testid="star-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  Users: () => <div data-testid="users-icon" />,
  BookOpen: () => <div data-testid="book-open-icon" />,
  Search: ({ className }: any) => <div data-testid="search-icon" className={className} />
}))

describe('SearchResults', () => {
  const mockOnPaperSelect = jest.fn()

  const mockPaper: Paper = {
    id: '1',
    title: 'Test Paper Title',
    authors: ['John Doe', 'Jane Smith'],
    journal: 'Test Journal',
    publicationYear: 2023,
    doi: '10.1000/test',
    abstract: 'Test abstract',
    readingStatus: 'unread',
    dateAdded: new Date('2023-01-01'),
    lastModified: new Date('2023-01-01'),
    googleDriveUrl: 'https://drive.google.com/test'
  }

  const mockSearchResults: SearchResult[] = [
    {
      id: '1',
      paper: mockPaper,
      similarity: 0.85,
      relevantExcerpts: [
        'This is a relevant excerpt from the paper.',
        'Another relevant excerpt with important information.',
        'Third excerpt for testing purposes.'
      ]
    },
    {
      id: '2',
      paper: {
        ...mockPaper,
        id: '2',
        title: 'Second Test Paper',
        readingStatus: 'completed' as const
      },
      similarity: 0.72,
      relevantExcerpts: ['Single excerpt for second paper.']
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state', () => {
    render(
      <SearchResults
        results={[]}
        onPaperSelect={mockOnPaperSelect}
        isLoading={true}
      />
    )

    expect(screen.getByText('Searching your papers...')).toBeInTheDocument()
  })

  it('renders empty state when no results', () => {
    render(
      <SearchResults
        results={[]}
        onPaperSelect={mockOnPaperSelect}
        isLoading={false}
      />
    )

    expect(screen.getByText('No papers found')).toBeInTheDocument()
    expect(screen.getByText(/Try adjusting your search query/)).toBeInTheDocument()
  })

  it('renders search results with statistics', () => {
    render(
      <SearchResults
        results={mockSearchResults}
        onPaperSelect={mockOnPaperSelect}
        query="test query"
      />
    )

    // Check statistics
    expect(screen.getByText('2 papers found')).toBeInTheDocument()
    expect(screen.getByText('1 high-quality matches')).toBeInTheDocument()
    expect(screen.getByText(/Average similarity:/)).toBeInTheDocument()

    // Check query badge
    expect(screen.getByText('"test query"')).toBeInTheDocument()
  })

  it('renders paper information correctly', () => {
    render(
      <SearchResults
        results={mockSearchResults}
        onPaperSelect={mockOnPaperSelect}
      />
    )

    // Check paper title
    expect(screen.getByText('Test Paper Title')).toBeInTheDocument()
    expect(screen.getByText('Second Test Paper')).toBeInTheDocument()

    // Check authors (should appear twice, once for each paper)
    const authorElements = screen.getAllByText('John Doe, Jane Smith')
    expect(authorElements).toHaveLength(2)

    // Check journal (should appear twice, once for each paper)
    const journalElements = screen.getAllByText('Test Journal')
    expect(journalElements).toHaveLength(2)

    // Check publication year (should appear twice, once for each paper)
    const yearElements = screen.getAllByText('2023')
    expect(yearElements).toHaveLength(2)
  })

  it('displays similarity scores correctly', () => {
    render(
      <SearchResults
        results={mockSearchResults}
        onPaperSelect={mockOnPaperSelect}
      />
    )

    // Check similarity percentages
    expect(screen.getByText('85%')).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()

    // Check progress bars
    const progressBars = screen.getAllByTestId('progress')
    expect(progressBars[0]).toHaveAttribute('data-value', '85')
    expect(progressBars[1]).toHaveAttribute('data-value', '72')
  })

  it('displays reading status badges correctly', () => {
    render(
      <SearchResults
        results={mockSearchResults}
        onPaperSelect={mockOnPaperSelect}
      />
    )

    expect(screen.getByText('Unread')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('shows relevant excerpts', () => {
    render(
      <SearchResults
        results={mockSearchResults}
        onPaperSelect={mockOnPaperSelect}
      />
    )

    expect(screen.getByText('This is a relevant excerpt from the paper.')).toBeInTheDocument()
    expect(screen.getByText('Another relevant excerpt with important information.')).toBeInTheDocument()
    
    // Third excerpt should not be visible initially (only shows first 2)
    expect(screen.queryByText('Third excerpt for testing purposes.')).not.toBeInTheDocument()
  })

  it('expands excerpts when show more is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <SearchResults
        results={mockSearchResults}
        onPaperSelect={mockOnPaperSelect}
      />
    )

    // Click show more button
    const showMoreButton = screen.getByText('Show 1 more excerpts')
    await user.click(showMoreButton)

    // Third excerpt should now be visible
    expect(screen.getByText('Third excerpt for testing purposes.')).toBeInTheDocument()
    
    // Button text should change
    expect(screen.getByText('Show less')).toBeInTheDocument()
  })

  it('highlights query terms in text', () => {
    render(
      <SearchResults
        results={mockSearchResults}
        onPaperSelect={mockOnPaperSelect}
        query="test"
      />
    )

    // Check for highlighted text (mark elements)
    const highlightedElements = screen.getAllByText('test')
    expect(highlightedElements.length).toBeGreaterThan(0)
  })

  it('calls onPaperSelect when paper card is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <SearchResults
        results={mockSearchResults}
        onPaperSelect={mockOnPaperSelect}
      />
    )

    // Click on the first paper card
    const paperCard = screen.getByText('Test Paper Title').closest('div')
    if (paperCard) {
      await user.click(paperCard)
    }

    expect(mockOnPaperSelect).toHaveBeenCalledWith('1')
  })

  it('opens external link when external link button is clicked', async () => {
    const user = userEvent.setup()
    const mockOpen = jest.fn()
    
    // Mock window.open
    Object.defineProperty(window, 'open', {
      value: mockOpen,
      writable: true
    })

    render(
      <SearchResults
        results={mockSearchResults}
        onPaperSelect={mockOnPaperSelect}
      />
    )

    // Click external link button
    const externalLinkButton = screen.getAllByTestId('external-link-icon')[0].closest('button')
    if (externalLinkButton) {
      await user.click(externalLinkButton)
    }

    expect(mockOpen).toHaveBeenCalledWith('https://drive.google.com/test', '_blank')
  })

  it('sorts results by similarity score in descending order', () => {
    const unsortedResults = [
      { ...mockSearchResults[1], similarity: 0.6 },
      { ...mockSearchResults[0], similarity: 0.9 }
    ]

    render(
      <SearchResults
        results={unsortedResults}
        onPaperSelect={mockOnPaperSelect}
      />
    )

    // Higher similarity should appear first
    const titles = screen.getAllByText(/Test Paper/)
    expect(titles[0]).toHaveTextContent('Test Paper Title') // 0.9 similarity
    expect(titles[1]).toHaveTextContent('Second Test Paper') // 0.6 similarity
  })

  it('prevents event propagation when clicking show more excerpts', async () => {
    const user = userEvent.setup()
    
    render(
      <SearchResults
        results={mockSearchResults}
        onPaperSelect={mockOnPaperSelect}
      />
    )

    const showMoreButton = screen.getByText('Show 1 more excerpts')
    await user.click(showMoreButton)

    // onPaperSelect should not be called when clicking show more
    expect(mockOnPaperSelect).not.toHaveBeenCalled()
  })

  it('prevents event propagation when clicking external link', async () => {
    const user = userEvent.setup()
    const mockOpen = jest.fn()
    
    Object.defineProperty(window, 'open', {
      value: mockOpen,
      writable: true
    })

    render(
      <SearchResults
        results={mockSearchResults}
        onPaperSelect={mockOnPaperSelect}
      />
    )

    const externalLinkButton = screen.getAllByTestId('external-link-icon')[0].closest('button')
    if (externalLinkButton) {
      await user.click(externalLinkButton)
    }

    // onPaperSelect should not be called when clicking external link
    expect(mockOnPaperSelect).not.toHaveBeenCalled()
  })
})