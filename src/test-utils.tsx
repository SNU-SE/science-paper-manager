import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Zustand stores
jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn(),
  })),
}))

jest.mock('@/stores/paperStore', () => ({
  usePaperStore: jest.fn(() => ({
    papers: new Map(),
    evaluations: new Map(),
    aiAnalyses: new Map(),
    selectedPaper: null,
    isLoading: false,
    fetchPapers: jest.fn(),
    addPaper: jest.fn(),
    updatePaper: jest.fn(),
    deletePaper: jest.fn(),
  })),
}))

jest.mock('@/stores/aiStore', () => ({
  useAIStore: jest.fn(() => ({
    apiKeys: {},
    activeModels: new Set(['openai']),
    usage: {},
    updateApiKey: jest.fn(),
    validateApiKey: jest.fn(),
    toggleModel: jest.fn(),
  })),
}))

jest.mock('@/stores/searchStore', () => ({
  useSearchStore: jest.fn(() => ({
    searchResults: [],
    ragMessages: [],
    isSearching: false,
    performSearch: jest.fn(),
    askRAG: jest.fn(),
    clearResults: jest.fn(),
  })),
}))

// Test wrapper component
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      {children}
    </ThemeProvider>
  )
}

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }