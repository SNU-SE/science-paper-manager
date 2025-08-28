import { render, screen, fireEvent } from '@testing-library/react'
import { ReadingStatus } from '../reading-status'

describe('ReadingStatus', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('renders current status', () => {
    render(<ReadingStatus status="reading" />)
    expect(screen.getByText('Reading')).toBeInTheDocument()
  })

  it('calls onChange when status button is clicked', () => {
    render(<ReadingStatus status="unread" onChange={mockOnChange} />)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    expect(mockOnChange).toHaveBeenCalledWith('reading')
  })

  it('does not call onChange when readonly', () => {
    render(<ReadingStatus status="unread" onChange={mockOnChange} readonly />)
    
    // In readonly mode, there should be no clickable button
    const buttons = screen.queryAllByRole('button')
    expect(buttons).toHaveLength(0)
  })

  it('shows progress when status is reading and showProgress is true', () => {
    render(
      <ReadingStatus 
        status="reading" 
        showProgress 
        progress={50} 
      />
    )
    
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('does not show progress when status is not reading', () => {
    render(
      <ReadingStatus 
        status="completed" 
        showProgress 
        progress={100} 
      />
    )
    
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
  })

  it('renders compact variant correctly', () => {
    render(
      <ReadingStatus 
        status="reading" 
        onChange={mockOnChange} 
        variant="compact" 
      />
    )
    
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  it('renders detailed variant with all status options', () => {
    render(
      <ReadingStatus 
        status="reading" 
        onChange={mockOnChange} 
        variant="detailed" 
      />
    )
    
    expect(screen.getByText('Reading Status')).toBeInTheDocument()
    expect(screen.getByText('Unread')).toBeInTheDocument()
    expect(screen.getByText('Reading')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('cycles through statuses correctly', () => {
    const { rerender } = render(
      <ReadingStatus status="unread" onChange={mockOnChange} />
    )
    
    const button = screen.getByRole('button')
    
    // unread -> reading
    fireEvent.click(button)
    expect(mockOnChange).toHaveBeenCalledWith('reading')
    
    // reading -> completed
    rerender(<ReadingStatus status="reading" onChange={mockOnChange} />)
    fireEvent.click(button)
    expect(mockOnChange).toHaveBeenCalledWith('completed')
    
    // completed -> unread
    rerender(<ReadingStatus status="completed" onChange={mockOnChange} />)
    fireEvent.click(button)
    expect(mockOnChange).toHaveBeenCalledWith('unread')
  })
})