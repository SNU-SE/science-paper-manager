# Database Setup Guide

This directory contains the database schema and setup utilities for the Science Paper Manager application.

## Prerequisites

1. **Supabase Project**: Create a new project at [supabase.com](https://supabase.com)
2. **pgvector Extension**: Enable the pgvector extension in your Supabase project
3. **Environment Variables**: Configure your `.env.local` file with Supabase credentials

## Quick Setup

### 1. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Update the following variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for admin operations)

### 2. Enable pgvector Extension

In your Supabase dashboard:
1. Go to **Database** → **Extensions**
2. Search for "vector" and enable the **pgvector** extension

### 3. Run Database Setup

#### Option A: Automated Setup (Recommended)

```bash
npm run setup-db
```

#### Option B: Manual Setup

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `database/schema.sql`
4. Paste and execute the SQL

## Database Schema

### Tables

#### `papers`
Stores research paper metadata and reading status.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| title | TEXT | Paper title |
| authors | TEXT[] | Array of author names |
| journal | TEXT | Journal name |
| publication_year | INTEGER | Year of publication |
| doi | TEXT | Digital Object Identifier |
| abstract | TEXT | Paper abstract |
| zotero_key | TEXT | Zotero item key |
| google_drive_id | TEXT | Google Drive file ID |
| google_drive_url | TEXT | Google Drive view URL |
| pdf_path | TEXT | Local PDF file path |
| reading_status | TEXT | 'unread', 'reading', or 'completed' |
| date_added | TIMESTAMP | When paper was added |
| date_read | TIMESTAMP | When paper was marked as read |
| last_modified | TIMESTAMP | Last modification time |

#### `user_evaluations`
Stores user ratings, notes, and tags for papers.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| paper_id | UUID | Foreign key to papers table |
| rating | INTEGER | 1-5 star rating |
| notes | TEXT | User notes |
| tags | TEXT[] | Array of tags |
| highlights | JSONB | Highlighted text and annotations |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

#### `ai_analyses`
Stores AI analysis results from different models.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| paper_id | UUID | Foreign key to papers table |
| model_provider | TEXT | 'openai', 'anthropic', 'xai', or 'gemini' |
| model_name | TEXT | Specific model name |
| summary | TEXT | AI-generated summary |
| keywords | TEXT[] | Extracted keywords |
| scientific_relevance | JSONB | Relevance analysis |
| confidence_score | FLOAT | Analysis confidence (0-1) |
| tokens_used | INTEGER | API tokens consumed |
| processing_time_ms | INTEGER | Processing time in milliseconds |
| created_at | TIMESTAMP | Analysis time |

#### `documents`
LangChain-compatible table for vector embeddings.

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| content | TEXT | Document content |
| metadata | JSONB | Document metadata |
| embedding | VECTOR(1536) | OpenAI embedding vector |

### Functions

#### `match_documents(query_embedding, match_count, filter)`
Vector similarity search function for semantic search and RAG.

**Parameters:**
- `query_embedding`: VECTOR(1536) - Query embedding vector
- `match_count`: INT - Number of results to return (default: 10)
- `filter`: JSONB - Metadata filter (default: {})

**Returns:**
- `id`: Document ID
- `content`: Document content
- `metadata`: Document metadata
- `similarity`: Cosine similarity score

### Indexes

The schema includes optimized indexes for:
- Paper filtering by status and date
- User evaluation lookups
- AI analysis queries
- Vector similarity search
- Metadata filtering

## Validation

### Check Database Health

```typescript
import { validateDatabaseSetup } from '@/lib/database-validator'

const health = await validateDatabaseSetup()
console.log(health)
```

### Test Database Operations

```typescript
import { testDatabaseOperations } from '@/lib/database-validator'

const success = await testDatabaseOperations()
console.log('Database test:', success ? 'PASSED' : 'FAILED')
```

### Get Database Statistics

```typescript
import { getDatabaseStats } from '@/lib/database-validator'

const stats = await getDatabaseStats()
console.log('Database stats:', stats)
```

## Troubleshooting

### Common Issues

1. **pgvector extension not found**
   - Ensure pgvector is enabled in Supabase dashboard
   - Check that your Supabase project supports extensions

2. **Permission denied errors**
   - Verify your service role key is correct
   - Check RLS policies if enabled

3. **Function not found errors**
   - Ensure the `match_documents` function was created
   - Check SQL execution logs in Supabase dashboard

4. **Vector dimension mismatch**
   - Ensure embeddings are exactly 1536 dimensions (OpenAI text-embedding-3-small)
   - Check embedding generation code

### Manual Verification

You can manually verify the setup in Supabase SQL Editor:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('papers', 'user_evaluations', 'ai_analyses', 'documents');

-- Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Test match_documents function
SELECT match_documents(
  array_fill(0, ARRAY[1536])::vector,
  5,
  '{}'::jsonb
);
```

## Performance Considerations

- **Vector Index**: The `documents_embedding_idx` uses IVFFlat with 100 lists
- **Metadata Index**: GIN index on JSONB metadata for fast filtering
- **Composite Indexes**: Optimized for common query patterns
- **Automatic Timestamps**: Triggers maintain `last_modified` and `updated_at`

For large datasets (>100k papers), consider:
- Increasing IVFFlat lists parameter
- Partitioning tables by date
- Implementing connection pooling
- Using read replicas for analytics queries