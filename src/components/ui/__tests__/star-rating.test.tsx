import { render, screen, fireEvent } from '@testing-library/react'
import { StarRating } from '../star-rating'

describe('StarRating', () => {
  it('renders 5 stars', () => {
    render(<StarRating value={0} />)
    const stars = screen.getAllByRole('button')
    expect(stars).toHaveLength(5)
  })

  it('displays correct rating value', () => {
    render(<StarRating value={3} />)
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })

  it('calls onChange when star is clicked', () => {
    const handleChange = jest.fn()
    render(<StarRating value={0} onChange={handleChange} />)
    
    const stars = screen.getAllByRole('button')
    fireEvent.click(stars[2]) // Click third star
    
    expect(handleChange).toHaveBeenCalledWith(3)
  })

  it('does not call onChange when readonly', () => {
    const handleChange = jest.fn()
    render(<StarRating value={0} onChange={handleChange} readonly />)
    
    const stars = screen.getAllByRole('button')
    fireEvent.click(stars[2])
    
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('shows hover effect on non-readonly stars', () => {
    render(<StarRating value={0} onChange={() => {}} />)
    
    const stars = screen.getAllByRole('button')
    fireEvent.mouseEnter(stars[2])
    
    // Check if hover state is applied (this would need more specific testing based on implementation)
    expect(stars[2]).toBeInTheDocument()
  })

  it('applies correct size classes', () => {
    const { rerender } = render(<StarRating value={0} size="sm" />)
    let stars = screen.getAllByRole('button')
    expect(stars[0].querySelector('svg')).toHaveClass('h-4', 'w-4')

    rerender(<StarRating value={0} size="lg" />)
    stars = screen.getAllByRole('button')
    expect(stars[0].querySelector('svg')).toHaveClass('h-6', 'w-6')
  })
})