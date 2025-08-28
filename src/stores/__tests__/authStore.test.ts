import { useAuthStore } from '../authStore'

// Mock localStorage for testing
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useAuthStore.setState({ isAuthenticated: false })
    jest.clearAllMocks()
  })

  it('should initialize with unauthenticated state', () => {
    const { isAuthenticated } = useAuthStore.getState()
    expect(isAuthenticated).toBe(false)
  })

  it('should login successfully with correct credentials', async () => {
    const { login } = useAuthStore.getState()
    
    const result = await login('admin@email.com', '1234567890')
    
    expect(result).toBe(true)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('should fail login with incorrect credentials', async () => {
    const { login } = useAuthStore.getState()
    
    const result = await login('wrong@email.com', 'wrongpassword')
    
    expect(result).toBe(false)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('should logout successfully', () => {
    // First login
    useAuthStore.setState({ isAuthenticated: true })
    
    const { logout } = useAuthStore.getState()
    logout()
    
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})