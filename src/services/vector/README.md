# Vector Database Service

This module provides vector database functionality for the Science Paper Manager using LangChain and OpenAI embeddings with Supabase as the vector store.

## Features

- **Semantic Search**: Find papers based on meaning rather than keywords
- **RAG (Retrieval-Augmented Generation)**: Ask questions about your paper collection
- **Paper Context Embedding**: Store papers with full context including evaluations and AI analyses
- **Vector Operations**: Add, update, remove, and search paper embeddings

## Setup

### Prerequisites

1. **OpenAI API Key**: Required for generating embeddings
2. **Supabase Project**: With pgvector extension enabled
3. **Environment Variables**:
   ```bash
   OPENAI_API_KEY=your_openai_api_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

### Database Schema

The service requires a `documents` table with the following structure:

```sql
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT,
  metadata JSONB,
  embedding VECTOR(1536)
);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 10,
  filter JSONB DEFAULT '{}'
) RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE documents.metadata @> filter
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## Usage

### Basic Usage

```typescript
import { VectorServiceFactory } from '@/services/vector'

// Initialize the service
const vectorService = VectorServiceFactory.getInstance(process.env.OPENAI_API_KEY!)

// Embed a paper with context
await vectorService.embedPaperWithContext({
  paper: {
    id: 'paper-123',
    title: 'Deep Learning for NLP',
    authors: ['John Doe'],
    abstract: 'This paper explores...',
    // ... other paper fields
  },
  evaluation: {
    rating: 5,
    notes: 'Excellent paper',
    tags: ['deep-learning', 'nlp'],
    // ... other evaluation fields
  },
  analyses: {
    openai: {
      summary: 'This paper presents...',
      keywords: ['deep learning', 'nlp'],
      // ... other analysis fields
    }
  }
})

// Perform semantic search
const searchResults = await vectorService.semanticSearch(
  'deep learning natural language processing',
  {
    matchCount: 10,
    similarityThreshold: 0.7,
    filter: { reading_status: 'completed' }
  }
)

// Ask questions using RAG
const ragResponse = await vectorService.ragQuery(
  'What are the latest advances in transformer architectures?'
)
```

### Using the React Hook

```typescript
import { useVectorService } from '@/hooks/useVectorService'

function MyComponent() {
  const {
    isInitialized,
    isSearching,
    searchResults,
    performSearch,
    askRAG,
    ragResponse
  } = useVectorService({ openaiApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY })

  const handleSearch = async () => {
    await performSearch('machine learning transformers')
  }

  const handleRAGQuery = async () => {
    await askRAG('What are the main findings about attention mechanisms?')
  }

  return (
    <div>
      <button onClick={handleSearch} disabled={isSearching}>
        Search Papers
      </button>
      <button onClick={handleRAGQuery} disabled={isSearching}>
        Ask Question
      </button>
      
      {searchResults.map(result => (
        <div key={result.id}>
          <h3>{result.paper.title}</h3>
          <p>Similarity: {result.similarity.toFixed(3)}</p>
        </div>
      ))}
      
      {ragResponse && (
        <div>
          <h3>Answer:</h3>
          <p>{ragResponse.answer}</p>
          <p>Confidence: {ragResponse.confidence.toFixed(3)}</p>
        </div>
      )}
    </div>
  )
}
```

## API Reference

### SupabaseVectorService

#### Constructor
```typescript
new SupabaseVectorService(openaiApiKey: string)
```

#### Methods

##### `embedPaperWithContext(context: PaperContext): Promise<void>`
Embeds a paper with its full context including metadata, evaluations, and AI analyses.

##### `semanticSearch(query: string, options?: VectorSearchOptions): Promise<SearchResult[]>`
Performs semantic search across embedded papers.

Options:
- `matchCount`: Number of results to return (default: 10)
- `similarityThreshold`: Minimum similarity score (default: 0.7)
- `filter`: Metadata filter object

##### `ragQuery(question: string, context?: Record<string, any>): Promise<RAGResponse>`
Performs RAG-based question answering using relevant papers as context.

##### `updatePaperEmbedding(context: PaperContext): Promise<void>`
Updates an existing paper's vector embedding.

##### `removePaperEmbedding(paperId: string): Promise<void>`
Removes a paper's vector embedding from the database.

##### `getEmbeddingStats(): Promise<EmbeddingStats>`
Returns statistics about the vector database.

### VectorServiceFactory

#### Static Methods

##### `getInstance(openaiApiKey?: string): SupabaseVectorService`
Gets or creates a singleton instance of the vector service.

##### `resetInstance(): void`
Resets the singleton instance (useful for testing).

##### `isInitialized(): boolean`
Checks if the service instance is initialized.

## Testing

### Unit Tests
```bash
npm test -- src/services/vector/__tests__
```

### Integration Tests
Set environment variables and run:
```bash
RUN_INTEGRATION_TESTS=true npm test -- src/services/vector/__tests__/integration.test.ts
```

## Performance Considerations

- **Embedding Dimensions**: Uses 1536 dimensions for text-embedding-3-small
- **Batch Operations**: Consider batching multiple embeddings for better performance
- **Vector Index**: Ensure proper pgvector indexes are configured
- **Rate Limiting**: OpenAI API has rate limits for embedding requests

## Error Handling

The service includes comprehensive error handling:
- API key validation
- Network error recovery
- Database connection issues
- Embedding generation failures

All methods throw descriptive errors that can be caught and handled appropriately.

## Examples

See `example-usage.ts` for comprehensive examples of all functionality.