import { render, screen } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import Navigation from '../Navigation'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/dashboard'),
}))

// Mock auth store
jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    isAuthenticated: true,
    logout: jest.fn(),
  })),
}))

describe('Navigation Component', () => {
  const mockPush = jest.fn()
  
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
  })

  it('should render navigation links when authenticated', () => {
    render(<Navigation />)
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Papers')).toBeInTheDocument()
    expect(screen.getByText('Search')).toBeInTheDocument()
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('should highlight active navigation item', () => {
    render(<Navigation />)
    
    const dashboardLink = screen.getByText('Dashboard').closest('a')
    expect(dashboardLink).toHaveClass('bg-primary')
  })

  it('should render logout button', () => {
    render(<Navigation />)
    
    expect(screen.getByTestId('logout-button')).toBeInTheDocument()
  })
})