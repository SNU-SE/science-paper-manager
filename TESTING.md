# Testing Guide

This document provides comprehensive information about the testing setup and practices for the Science Paper Manager project.

## Testing Stack

- **Unit Testing**: Jest + React Testing Library
- **Integration Testing**: Jest with mocked services
- **End-to-End Testing**: Playwright
- **Coverage**: Jest coverage reports
- **Linting**: ESLint

## Test Structure

```
science-paper-manager/
├── src/
│   ├── components/
│   │   └── **/__tests__/          # Component unit tests
│   ├── services/
│   │   └── **/__tests__/          # Service unit tests
│   ├── hooks/
│   │   └── __tests__/             # Custom hooks tests
│   ├── stores/
│   │   └── __tests__/             # State management tests
│   ├── lib/
│   │   └── __tests__/             # Utility function tests
│   ├── app/api/
│   │   └── __tests__/             # API route integration tests
│   └── test-utils.tsx             # Test utilities and setup
├── e2e/                           # End-to-end tests
│   ├── auth.spec.ts
│   ├── paper-management.spec.ts
│   ├── search-and-rag.spec.ts
│   └── ai-analysis.spec.ts
├── jest.config.js                 # Jest configuration
├── jest.setup.js                  # Jest setup and mocks
├── playwright.config.ts           # Playwright configuration
└── scripts/run-tests.sh          # Test runner script
```

## Running Tests

### All Tests
```bash
npm run test:all
```

### Unit Tests Only
```bash
npm run test
```

### Unit Tests with Watch Mode
```bash
npm run test:watch
```

### Unit Tests with Coverage
```bash
npm run test:coverage
```

### End-to-End Tests
```bash
npm run test:e2e
```

### End-to-End Tests with UI
```bash
npm run test:e2e:ui
```

### Using the Test Script
```bash
# Run all tests
./scripts/run-tests.sh

# Skip E2E tests (faster for development)
./scripts/run-tests.sh --skip-e2e

# Run tests and open reports in browser
./scripts/run-tests.sh --skip-e2e --open-reports
```

## Test Categories

### 1. Component Tests

Component tests verify that React components render correctly and handle user interactions properly.

**Example**: `src/components/papers/__tests__/PaperCard.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import PaperCard from '../PaperCard'

describe('PaperCard Component', () => {
  it('should render paper information', () => {
    render(<PaperCard paper={mockPaper} />)
    expect(screen.getByText('Paper Title')).toBeInTheDocument()
  })
})
```

### 2. Service Tests

Service tests verify business logic and external API interactions with proper mocking.

**Example**: `src/services/ai/__tests__/MultiModelAnalyzer.test.ts`

```typescript
import { MultiModelAnalyzer } from '../MultiModelAnalyzer'

describe('MultiModelAnalyzer', () => {
  it('should analyze paper with multiple models', async () => {
    const analyzer = new MultiModelAnalyzer(mockServices)
    const result = await analyzer.analyzePaper(mockPaper, ['openai'])
    expect(result.openai).toBeDefined()
  })
})
```

### 3. Hook Tests

Custom hook tests verify React hooks behavior and state management.

**Example**: `src/hooks/__tests__/useAIAnalysis.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react'
import { useAIAnalysis } from '../useAIAnalysis'

describe('useAIAnalysis', () => {
  it('should trigger analysis', async () => {
    const { result } = renderHook(() => useAIAnalysis())
    await act(async () => {
      await result.current.analyzeWithModels('paper-id', ['openai'])
    })
    expect(result.current.isAnalyzing).toBe(false)
  })
})
```

### 4. Store Tests

Store tests verify Zustand state management logic.

**Example**: `src/stores/__tests__/paperStore.test.ts`

```typescript
import { usePaperStore } from '../paperStore'

describe('Paper Store', () => {
  it('should add paper to store', () => {
    const store = usePaperStore.getState()
    store.addPaper(mockPaper)
    expect(store.papers.has(mockPaper.id)).toBe(true)
  })
})
```

### 5. API Integration Tests

API tests verify Next.js API routes with mocked external dependencies.

**Example**: `src/app/api/__tests__/api-routes.test.ts`

```typescript
import { POST } from '../auth/login/route'

describe('Auth API', () => {
  it('should authenticate valid user', async () => {
    const request = new NextRequest(url, { method: 'POST', body: credentials })
    const response = await POST(request)
    expect(response.status).toBe(200)
  })
})
```

### 6. End-to-End Tests

E2E tests verify complete user workflows across the entire application.

**Example**: `e2e/auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('should login with valid credentials', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[type="email"]', 'admin@email.com')
  await page.fill('input[type="password"]', '1234567890')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/dashboard')
})
```

## Mocking Strategy

### External Services

All external services are mocked to ensure tests are:
- Fast and reliable
- Independent of external dependencies
- Deterministic in their results

**Mocked Services:**
- Supabase client
- OpenAI API
- Anthropic API
- Google Drive API
- Zotero API

### Browser APIs

Browser APIs are mocked in Jest setup:
- `localStorage`
- `fetch`
- `IntersectionObserver`
- `ResizeObserver`
- `matchMedia`

### Next.js Features

Next.js specific features are mocked:
- `useRouter`
- `usePathname`
- `useSearchParams`
- Image component

## Test Data

Test data is defined in individual test files or shared utilities:

```typescript
const mockPaper = {
  id: 'test-paper-id',
  title: 'Test Paper',
  authors: ['Author 1'],
  abstract: 'Test abstract',
  // ... other properties
}
```

## Coverage Requirements

The project aims for:
- **Unit Tests**: >80% code coverage
- **Integration Tests**: All API routes covered
- **E2E Tests**: All major user workflows covered

Coverage reports are generated in `coverage/lcov-report/index.html`.

## Test Environment Variables

For E2E tests, you may need to set:

```bash
# .env.test
NEXT_PUBLIC_SUPABASE_URL=test-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-key
OPENAI_API_KEY=test-key
```

## Debugging Tests

### Jest Tests
```bash
# Run specific test file
npm test -- PaperCard.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="should render"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Playwright Tests
```bash
# Run specific test file
npx playwright test auth.spec.ts

# Run with headed browser
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

## Continuous Integration

Tests are designed to run in CI environments:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: |
    npm ci
    npm run test:coverage
    npm run test:e2e
```

## Best Practices

1. **Test Naming**: Use descriptive test names that explain the expected behavior
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
3. **Mock External Dependencies**: Always mock external APIs and services
4. **Test User Behavior**: Focus on testing what users actually do
5. **Keep Tests Independent**: Each test should be able to run in isolation
6. **Use Data Test IDs**: Use `data-testid` attributes for reliable element selection
7. **Test Error Cases**: Include tests for error scenarios and edge cases

## Troubleshooting

### Common Issues

1. **Tests timing out**: Increase timeout or check for unresolved promises
2. **Mock not working**: Ensure mocks are defined before imports
3. **E2E tests flaky**: Add proper waits and use stable selectors
4. **Coverage not accurate**: Check for untested code paths

### Getting Help

- Check Jest documentation: https://jestjs.io/docs/getting-started
- Check Playwright documentation: https://playwright.dev/docs/intro
- Check React Testing Library documentation: https://testing-library.com/docs/react-testing-library/intro/

## Contributing

When adding new features:

1. Write tests for new components and services
2. Update existing tests when modifying functionality
3. Ensure all tests pass before submitting PR
4. Maintain or improve test coverage
5. Add E2E tests for new user workflows