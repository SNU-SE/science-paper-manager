import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PaperList from '../PaperList'
import { usePaperStore } from '@/stores/paperStore'

// Mock the paper store
jest.mock('@/stores/paperStore', () => ({
  usePaperStore: jest.fn(),
}))

// Mock PaperCard component
jest.mock('../PaperCard', () => {
  return function MockPaperCard({ paper, onSelect }: any) {
    return (
      <div data-testid="paper-card" onClick={() => onSelect(paper)}>
        <h3 data-testid="paper-title">{paper.title}</h3>
        <p data-testid="paper-authors">{paper.authors.join(', ')}</p>
      </div>
    )
  }
})

const mockPapers = [
  {
    id: '1',
    title: 'Machine Learning Paper',
    authors: ['Author 1', 'Author 2'],
    abstract: 'Abstract about ML',
    journal: 'ML Journal',
    publicationYear: 2024,
    readingStatus: 'unread' as const,
    dateAdded: new Date('2024-01-01'),
    lastModified: new Date('2024-01-01'),
  },
  {
    id: '2',
    title: 'Deep Learning Paper',
    authors: ['Author 3'],
    abstract: 'Abstract about DL',
    journal: 'DL Journal',
    publicationYear: 2023,
    readingStatus: 'reading' as const,
    dateAdded: new Date('2024-01-02'),
    lastModified: new Date('2024-01-02'),
  },
]

describe('PaperList Component', () => {
  const mockFetchPapers = jest.fn()
  const mockOnPaperSelect = jest.fn()

  beforeEach(() => {
    (usePaperStore as jest.Mock).mockReturnValue({
      papers: new Map(mockPapers.map(p => [p.id, p])),
      fetchPapers: mockFetchPapers,
      isLoading: false,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should render list of papers', () => {
    render(<PaperList onPaperSelect={mockOnPaperSelect} />)
    
    expect(screen.getAllByTestId('paper-card')).toHaveLength(2)
    expect(screen.getByText('Machine Learning Paper')).toBeInTheDocument()
    expect(screen.getByText('Deep Learning Paper')).toBeInTheDocument()
  })

  it('should display loading state', () => {
    (usePaperStore as jest.Mock).mockReturnValue({
      papers: new Map(),
      fetchPapers: mockFetchPapers,
      isLoading: true,
    })

    render(<PaperList onPaperSelect={mockOnPaperSelect} />)
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('should display empty state when no papers', () => {
    (usePaperStore as jest.Mock).mockReturnValue({
      papers: new Map(),
      fetchPapers: mockFetchPapers,
      isLoading: false,
    })

    render(<PaperList onPaperSelect={mockOnPaperSelect} />)
    
    expect(screen.getByText('No papers found')).toBeInTheDocument()
  })

  it('should handle paper selection', () => {
    render(<PaperList onPaperSelect={mockOnPaperSelect} />)
    
    fireEvent.click(screen.getAllByTestId('paper-card')[0])
    
    expect(mockOnPaperSelect).toHaveBeenCalledWith(mockPapers[0])
  })

  it('should filter papers by search query', async () => {
    render(<PaperList onPaperSelect={mockOnPaperSelect} />)
    
    const searchInput = screen.getByPlaceholderText('Search papers...')
    fireEvent.change(searchInput, { target: { value: 'Machine Learning' } })
    
    await waitFor(() => {
      expect(screen.getByText('Machine Learning Paper')).toBeInTheDocument()
      expect(screen.queryByText('Deep Learning Paper')).not.toBeInTheDocument()
    })
  })

  it('should filter papers by reading status', async () => {
    render(<PaperList onPaperSelect={mockOnPaperSelect} />)
    
    const statusFilter = screen.getByTestId('status-filter')
    fireEvent.change(statusFilter, { target: { value: 'reading' } })
    
    await waitFor(() => {
      expect(screen.getByText('Deep Learning Paper')).toBeInTheDocument()
      expect(screen.queryByText('Machine Learning Paper')).not.toBeInTheDocument()
    })
  })

  it('should sort papers by date', async () => {
    render(<PaperList onPaperSelect={mockOnPaperSelect} />)
    
    const sortSelect = screen.getByTestId('sort-select')
    fireEvent.change(sortSelect, { target: { value: 'dateAdded' } })
    
    await waitFor(() => {
      const paperCards = screen.getAllByTestId('paper-card')
      expect(paperCards[0]).toHaveTextContent('Deep Learning Paper') // More recent
      expect(paperCards[1]).toHaveTextContent('Machine Learning Paper')
    })
  })

  it('should fetch papers on mount', () => {
    render(<PaperList onPaperSelect={mockOnPaperSelect} />)
    
    expect(mockFetchPapers).toHaveBeenCalledTimes(1)
  })
})