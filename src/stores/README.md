# Zustand State Management

This directory contains the Zustand stores that manage the application's state. Each store is responsible for a specific domain of the application and provides a clean, type-safe API for components to interact with.

## Store Architecture

### 1. AuthStore (`authStore.ts`)
Manages user authentication state with simple email/password authentication.

**Features:**
- Hardcoded admin credentials (`admin@email.com` / `1234567890`)
- Persistent login state
- Simple login/logout functionality

**Usage:**
```typescript
import { useAuthStore } from '@/stores'

const { isAuthenticated, login, logout } = useAuthStore()

// Login
const success = await login('admin@email.com', '1234567890')

// Logout
logout()
```

### 2. PaperStore (`paperStore.ts`)
Manages papers, user evaluations, and AI analyses with full CRUD operations.

**Features:**
- Paper management (CRUD operations)
- User evaluations (ratings, notes, tags)
- AI analysis results storage
- Selected paper state
- Error handling and loading states

**Usage:**
```typescript
import { usePaperStore } from '@/stores'

const {
  papers,
  selectedPaper,
  isLoading,
  fetchPapers,
  addPaper,
  updatePaper,
  selectPaper,
  updateEvaluation,
  getEvaluation
} = usePaperStore()

// Fetch all papers
await fetchPapers()

// Add a new paper
await addPaper(newPaper)

// Update paper status
await updatePaper(paperId, { readingStatus: 'completed' })

// Update evaluation
await updateEvaluation(paperId, { rating: 5, notes: 'Excellent paper' })
```

### 3. AIStore (`aiStore.ts`)
Manages AI service configuration, API keys, and usage tracking.

**Features:**
- API key management for multiple AI services
- Model activation/deactivation
- API key validation
- Usage statistics tracking
- Cost estimation

**Usage:**
```typescript
import { useAIStore } from '@/stores'

const {
  apiKeys,
  activeModels,
  updateApiKey,
  validateApiKey,
  toggleModel,
  hasValidKey,
  getActiveModelsWithKeys
} = useAIStore()

// Update API key
updateApiKey('openai', 'sk-...')

// Validate API key
const isValid = await validateApiKey('openai', 'sk-...')

// Toggle model activation
toggleModel('openai')

// Get active models with valid keys
const activeModels = getActiveModelsWithKeys()
```

### 4. SearchStore (`searchStore.ts`)
Manages semantic search results and RAG chat functionality.

**Features:**
- Semantic search with filters
- Search result management
- RAG chat message history
- Persistent chat history
- Error handling for search operations

**Usage:**
```typescript
import { useSearchStore } from '@/stores'

const {
  searchResults,
  ragMessages,
  isSearching,
  performSearch,
  askRAG,
  clearSearchResults
} = useSearchStore()

// Perform semantic search
await performSearch('machine learning in healthcare', {
  readingStatus: ['unread'],
  publicationYear: { min: 2020 }
})

// Ask RAG question
await askRAG('What are the main themes in my papers?')

// Clear search results
clearSearchResults()
```

## Enhanced Components

The stores are used by enhanced components that provide a better user experience:

### PaperCardEnhanced & PaperListEnhanced
- Automatic state synchronization
- Integrated evaluation management
- Real-time updates across components

### AIModelSelectorEnhanced
- Persistent API key storage
- Real-time validation
- Usage tracking display

### SemanticSearchEnhanced & RAGChatEnhanced
- Centralized search state
- Persistent chat history
- Advanced filtering options

## Persistence

Stores use Zustand's `persist` middleware to automatically save and restore state:

- **AuthStore**: Saves authentication status
- **PaperStore**: Saves papers, evaluations, and analyses
- **AIStore**: Saves API keys, active models, and usage stats
- **SearchStore**: Saves chat history and search preferences

## Error Handling

All stores implement consistent error handling:

- Network errors are caught and displayed to users
- Loading states prevent multiple simultaneous operations
- Error messages are user-friendly and actionable
- Recovery mechanisms allow users to retry failed operations

## Type Safety

All stores are fully typed with TypeScript:

- Strong typing for all state properties
- Type-safe action parameters
- Proper return type inference
- Integration with existing type definitions

## Testing

Each store has comprehensive test coverage:

- Unit tests for all actions
- Mock API responses for async operations
- State persistence testing
- Error handling verification

Run store tests:
```bash
npm test -- --testPathPatterns="stores"
```

## Best Practices

### Using Stores in Components

1. **Import only what you need:**
```typescript
const { papers, fetchPapers, isLoading } = usePaperStore()
```

2. **Handle loading states:**
```typescript
if (isLoading) return <LoadingSpinner />
```

3. **Handle errors gracefully:**
```typescript
if (error) return <ErrorMessage error={error} onRetry={clearError} />
```

4. **Use async actions properly:**
```typescript
const handleSubmit = async () => {
  try {
    await addPaper(newPaper)
    // Success handling
  } catch (error) {
    // Error is already handled by the store
  }
}
```

### Store Design Principles

1. **Single Responsibility**: Each store manages one domain
2. **Immutable Updates**: State is updated immutably
3. **Async Handling**: All API calls are properly handled
4. **Error Recovery**: Users can recover from errors
5. **Persistence**: Important state is automatically saved

## Migration from Props

To migrate existing components to use stores:

1. Remove props that are now managed by stores
2. Import and use the appropriate store hooks
3. Replace prop callbacks with store actions
4. Remove local state that's now centralized
5. Update tests to use store state

Example migration:
```typescript
// Before
interface PaperCardProps {
  paper: Paper
  onStatusChange: (status: string) => void
  onRatingChange: (rating: number) => void
}

// After
interface PaperCardEnhancedProps {
  paper: Paper
  // Props removed, now using stores
}

const { updatePaper, updateEvaluation } = usePaperStore()
```

This architecture provides a scalable, maintainable state management solution that grows with the application's needs while maintaining excellent developer experience and type safety.