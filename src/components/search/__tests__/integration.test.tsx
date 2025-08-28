import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SemanticSearch } from '../SemanticSearch'
import { SearchResults } from '../SearchResults'

// Define types locally for testing
interface SearchResult {
  id: string
  paper: {
    id: string
    title: string
    authors: string[]
    journal?: string
    publicationYear: number
    readingStatus: 'unread' | 'reading' | 'completed'
    dateAdded: Date
    lastModified: Date
  }
  similarity: number
  relevantExcerpts: string[]
}

interface SearchFilters {
  readingStatus?: string
  yearRange?: [number, number]
  authors?: string[]
}

// Mock the UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}))

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, onKeyPress, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      onKeyPress={onKeyPress}
      {...props}
    />
  )
}))

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, onClick, ...props }: any) => (
    <div onClick={onClick} {...props}>{children}</div>
  ),
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, ...props }: any) => (
    <span data-variant={variant} {...props}>{children}</span>
  )
}))

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, ...props }: any) => (
    <div data-testid="progress" data-value={value} {...props} />
  )
}))

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => (
    <div data-testid="select" onClick={() => onValueChange?.('unread')}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <div>{placeholder}</div>
}))

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, min, max }: any) => (
    <input
      type="range"
      value={value?.[0] || min}
      onChange={(e) => onValueChange?.([parseInt(e.target.value)])}
      min={min}
      max={max}
      data-testid="slider"
    />
  )
}))

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>
}))

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: any) => <div {...props}>{children}</div>
}))

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Search: ({ className }: any) => <div data-testid="search-icon" className={className} />,
  Filter: () => <div data-testid="filter-icon" />,
  X: () => <div data-testid="x-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  ExternalLink: () => <div data-testid="external-link-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  Users: () => <div data-testid="users-icon" />,
  BookOpen: () => <div data-testid="book-open-icon" />
}))

describe('Search Integration', () => {
  const mockSearchResults: SearchResult[] = [
    {
      id: '1',
      paper: {
        id: '1',
        title: 'Machine Learning in Healthcare',
        authors: ['Dr. Smith', 'Dr. Johnson'],
        journal: 'Nature Medicine',
        publicationYear: 2023,
        readingStatus: 'unread',
        dateAdded: new Date('2023-01-01'),
        lastModified: new Date('2023-01-01')
      },
      similarity: 0.92,
      relevantExcerpts: [
        'Machine learning algorithms show promising results in medical diagnosis.',
        'The study demonstrates improved accuracy in disease prediction.'
      ]
    },
    {
      id: '2',
      paper: {
        id: '2',
        title: 'Deep Learning Applications',
        authors: ['Prof. Wilson'],
        journal: 'AI Research',
        publicationYear: 2022,
        readingStatus: 'completed',
        dateAdded: new Date('2022-12-01'),
        lastModified: new Date('2022-12-01')
      },
      similarity: 0.78,
      relevantExcerpts: [
        'Deep neural networks excel at pattern recognition tasks.'
      ]
    }
  ]

  function SearchApp() {
    const [results, setResults] = React.useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = React.useState(false)
    const [lastQuery, setLastQuery] = React.useState('')

    const handleSearch = async (query: string, filters?: SearchFilters) => {
      setIsSearching(true)
      setLastQuery(query)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Filter results based on query
      const filteredResults = mockSearchResults.filter(result =>
        result.paper.title.toLowerCase().includes(query.toLowerCase()) ||
        result.relevantExcerpts.some(excerpt => 
          excerpt.toLowerCase().includes(query.toLowerCase())
        )
      )
      
      setResults(filteredResults)
      setIsSearching(false)
    }

    const handlePaperSelect = (paperId: string) => {
      console.log('Selected paper:', paperId)
    }

    return (
      <div>
        <SemanticSearch
          onSearch={handleSearch}
          isSearching={isSearching}
        />
        <SearchResults
          results={results}
          onPaperSelect={handlePaperSelect}
          isLoading={isSearching}
          query={lastQuery}
        />
      </div>
    )
  }

  it('performs end-to-end search workflow', async () => {
    const user = userEvent.setup()
    
    render(<SearchApp />)

    // Enter search query
    const searchInput = screen.getByRole('textbox')
    await user.type(searchInput, 'machine learning')

    // Click search button
    const searchButton = screen.getByText('Search')
    await user.click(searchButton)

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Searching your papers...')).not.toBeInTheDocument()
    })

    // Verify results are displayed
    expect(screen.getByText(/papers found/)).toBeInTheDocument()
    expect(screen.getAllByText('92%')).toHaveLength(2) // Appears in stats and similarity score
    expect(screen.getByText(/in Healthcare/)).toBeInTheDocument()

    // Verify excerpts are shown
    expect(screen.getByText(/algorithms show promising results/)).toBeInTheDocument()
  })

  it('handles search with filters', async () => {
    const user = userEvent.setup()
    
    render(<SearchApp />)

    // Open filter panel
    const buttons = screen.getAllByRole('button')
    const filterButton = buttons[0] // First button should be filter
    await user.click(filterButton)

    // Apply reading status filter
    const select = screen.getByTestId('select')
    fireEvent.click(select)

    // Perform search
    const searchInput = screen.getByRole('textbox')
    await user.type(searchInput, 'learning')

    const searchButton = screen.getByText('Search')
    await user.click(searchButton)

    // Wait for results
    await waitFor(() => {
      expect(screen.queryByText('Searching your papers...')).not.toBeInTheDocument()
    })

    // Should show filtered results
    expect(screen.getByText(/papers found/)).toBeInTheDocument()
  })

  it('shows empty state when no results found', async () => {
    const user = userEvent.setup()
    
    render(<SearchApp />)

    // Search for something that won't match
    const searchInput = screen.getByRole('textbox')
    await user.type(searchInput, 'nonexistent topic')

    const searchButton = screen.getByText('Search')
    await user.click(searchButton)

    // Wait for search to complete
    await waitFor(() => {
      expect(screen.queryByText('Searching your papers...')).not.toBeInTheDocument()
    })

    // Should show empty state
    expect(screen.getByText('No papers found')).toBeInTheDocument()
    expect(screen.getByText(/Try adjusting your search query/)).toBeInTheDocument()
  })

  it('displays loading state during search', async () => {
    const user = userEvent.setup()
    
    render(<SearchApp />)

    const searchInput = screen.getByRole('textbox')
    await user.type(searchInput, 'test')

    const searchButton = screen.getByText('Search')
    await user.click(searchButton)

    // Should show loading state immediately
    expect(screen.getByText('Searching your papers...')).toBeInTheDocument()
    expect(searchButton).toHaveTextContent('Searching...')
    expect(searchInput).toBeDisabled()
  })
})