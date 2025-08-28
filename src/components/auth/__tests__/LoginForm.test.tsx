import { render, screen, fireEvent } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { LoginForm } from '../LoginForm'
import { useAuthStore } from '@/stores/authStore'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}))

// Mock the auth store
jest.mock('@/stores/authStore')

const mockPush = jest.fn()
const mockLogin = jest.fn()

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
    ;(useAuthStore as unknown as jest.Mock).mockReturnValue(mockLogin)
  })

  it('renders login form with email and password fields', () => {
    render(<LoginForm />)
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('displays demo credentials', () => {
    render(<LoginForm />)
    
    expect(screen.getByText(/demo credentials/i)).toBeInTheDocument()
    expect(screen.getByText(/admin@email.com/)).toBeInTheDocument()
    expect(screen.getByText(/1234567890/)).toBeInTheDocument()
  })

  it('allows user to enter email and password', () => {
    render(<LoginForm />)
    
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    
    expect(emailInput.value).toBe('test@example.com')
    expect(passwordInput.value).toBe('password123')
  })

  it('shows loading state when submitting', async () => {
    mockLogin.mockResolvedValue(true)
    
    render(<LoginForm />)
    
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(emailInput, { target: { value: 'admin@email.com' } })
    fireEvent.change(passwordInput, { target: { value: '1234567890' } })
    fireEvent.click(submitButton)
    
    expect(screen.getByText(/signing in/i)).toBeInTheDocument()
  })
})