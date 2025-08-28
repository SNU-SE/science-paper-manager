import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SemanticSearch } from '../SemanticSearch'
import type { SearchFilters } from '@/types'

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
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>
}))

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => (
    <div data-testid="select" onClick={() => onValueChange?.('test')}>
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

describe('SemanticSearch', () => {
  const mockOnSearch = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders search input with placeholder', () => {
    render(
      <SemanticSearch 
        onSearch={mockOnSearch}
        placeholder="Test placeholder"
      />
    )

    expect(screen.getByPlaceholderText('Test placeholder')).toBeInTheDocument()
  })

  it('calls onSearch when search button is clicked', async () => {
    const user = userEvent.setup()
    
    render(<SemanticSearch onSearch={mockOnSearch} />)

    const input = screen.getByRole('textbox')
    const searchButton = screen.getByText('Search')

    await user.type(input, 'test query')
    await user.click(searchButton)

    expect(mockOnSearch).toHaveBeenCalledWith('test query', undefined)
  })

  it('calls onSearch when Enter key is pressed', async () => {
    const user = userEvent.setup()
    
    render(<SemanticSearch onSearch={mockOnSearch} />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'test query{enter}')

    expect(mockOnSearch).toHaveBeenCalledWith('test query', undefined)
  })

  it('does not call onSearch with empty query', async () => {
    const user = userEvent.setup()
    
    render(<SemanticSearch onSearch={mockOnSearch} />)

    const searchButton = screen.getByText('Search')
    await user.click(searchButton)

    expect(mockOnSearch).not.toHaveBeenCalled()
  })

  it('disables search when isSearching is true', () => {
    render(
      <SemanticSearch 
        onSearch={mockOnSearch}
        isSearching={true}
      />
    )

    const input = screen.getByRole('textbox')
    const searchButton = screen.getByText('Searching...')

    expect(input).toBeDisabled()
    expect(searchButton).toBeDisabled()
  })

  it('toggles filter panel when filter button is clicked', async () => {
    const user = userEvent.setup()
    
    render(<SemanticSearch onSearch={mockOnSearch} />)

    // Find filter button by its icon or position (second button)
    const buttons = screen.getAllByRole('button')
    const filterButton = buttons[0] // First button should be the filter button
    
    // Filter panel should not be visible initially
    expect(screen.queryByText('Search Filters')).not.toBeInTheDocument()

    await user.click(filterButton)

    // Filter panel should be visible after clicking
    expect(screen.getByText('Search Filters')).toBeInTheDocument()
  })

  it('shows active filter count badge', async () => {
    const user = userEvent.setup()
    
    render(<SemanticSearch onSearch={mockOnSearch} />)

    // Open filter panel
    const buttons = screen.getAllByRole('button')
    const filterButton = buttons[0]
    await user.click(filterButton)

    // Initially no badge should be visible
    expect(screen.queryByText('1')).not.toBeInTheDocument()

    // Select a reading status filter
    const select = screen.getByTestId('select')
    fireEvent.click(select)

    // Badge should appear (mocked select always returns 'test')
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  it('calls onSearch with filters when filters are applied', async () => {
    const user = userEvent.setup()
    
    render(<SemanticSearch onSearch={mockOnSearch} />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'test query')

    // Open filter panel
    const buttons = screen.getAllByRole('button')
    const filterButton = buttons[0]
    await user.click(filterButton)

    // Apply a filter
    const select = screen.getByTestId('select')
    fireEvent.click(select)

    // Search with filters
    const searchButton = screen.getByText('Search')
    await user.click(searchButton)

    expect(mockOnSearch).toHaveBeenCalledWith('test query', expect.objectContaining({
      readingStatus: ['test']
    }))
  })

  it('clears all filters when clear all button is clicked', async () => {
    const user = userEvent.setup()
    
    render(<SemanticSearch onSearch={mockOnSearch} />)

    // Open filter panel and apply a filter
    const buttons = screen.getAllByRole('button')
    const filterButton = buttons[0]
    await user.click(filterButton)

    const select = screen.getByTestId('select')
    fireEvent.click(select)

    // Clear all filters
    await waitFor(() => {
      const clearButton = screen.getByText('Clear all')
      user.click(clearButton)
    })

    // Badge should disappear
    await waitFor(() => {
      expect(screen.queryByText('1')).not.toBeInTheDocument()
    })
  })

  it('updates year filter with slider', async () => {
    const user = userEvent.setup()
    
    render(<SemanticSearch onSearch={mockOnSearch} />)

    // Open filter panel
    const buttons = screen.getAllByRole('button')
    const filterButton = buttons[0]
    await user.click(filterButton)

    // Find and interact with year sliders
    const sliders = screen.getAllByTestId('slider')
    expect(sliders).toHaveLength(4) // 2 for year, 2 for rating

    // Change year slider
    fireEvent.change(sliders[0], { target: { value: '2020' } })

    const input = screen.getByRole('textbox')
    await user.type(input, 'test query')

    const searchButton = screen.getByText('Search')
    await user.click(searchButton)

    expect(mockOnSearch).toHaveBeenCalledWith('test query', expect.objectContaining({
      publicationYear: expect.objectContaining({
        min: 2020
      })
    }))
  })

  it('removes individual filters when X button is clicked', async () => {
    const user = userEvent.setup()
    
    render(<SemanticSearch onSearch={mockOnSearch} />)

    // Open filter panel and apply a filter
    const buttons = screen.getAllByRole('button')
    const filterButton = buttons[0]
    await user.click(filterButton)

    const select = screen.getByTestId('select')
    fireEvent.click(select)

    // Find and click the X button in the filter badge (it's an SVG icon)
    await waitFor(() => {
      const xIcons = screen.container.querySelectorAll('.lucide-x')
      expect(xIcons.length).toBeGreaterThan(0)
      user.click(xIcons[0] as Element)
    })

    // Badge should disappear
    await waitFor(() => {
      expect(screen.queryByText('1')).not.toBeInTheDocument()
    })
  })
})