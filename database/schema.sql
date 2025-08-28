-- Science Paper Manager Database Schema
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Papers table
CREATE TABLE IF NOT EXISTS papers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  authors TEXT[],
  journal TEXT,
  publication_year INTEGER,
  doi TEXT UNIQUE,
  abstract TEXT,
  zotero_key TEXT UNIQUE,
  google_drive_id TEXT,
  google_drive_url TEXT,
  pdf_path TEXT,
  reading_status TEXT DEFAULT 'unread' CHECK (reading_status IN ('unread', 'reading', 'completed')),
  date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_read TIMESTAMP WITH TIME ZONE,
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User evaluations table
CREATE TABLE IF NOT EXISTS user_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  tags TEXT[],
  highlights JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(paper_id)
);

-- AI analyses table
CREATE TABLE IF NOT EXISTS ai_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  model_provider TEXT NOT NULL CHECK (model_provider IN ('openai', 'anthropic', 'xai', 'gemini')),
  model_name TEXT NOT NULL,
  summary TEXT,
  keywords TEXT[],
  scientific_relevance JSONB,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(paper_id, model_provider, model_name)
);

-- LangChain compatible documents table for vector search
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding VECTOR(1536)
);

-- Vector similarity search function for LangChain integration
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

-- Performance optimization indexes
-- Papers table indexes
CREATE INDEX IF NOT EXISTS idx_papers_reading_status ON papers(reading_status);
CREATE INDEX IF NOT EXISTS idx_papers_publication_year ON papers(publication_year);
CREATE INDEX IF NOT EXISTS idx_papers_date_added ON papers(date_added);
CREATE INDEX IF NOT EXISTS idx_papers_last_modified ON papers(last_modified);
CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers(doi) WHERE doi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_papers_zotero_key ON papers(zotero_key) WHERE zotero_key IS NOT NULL;

-- User evaluations indexes
CREATE INDEX IF NOT EXISTS idx_evaluations_paper_id ON user_evaluations(paper_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_rating ON user_evaluations(rating) WHERE rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evaluations_tags ON user_evaluations USING GIN (tags);

-- AI analyses indexes
CREATE INDEX IF NOT EXISTS idx_ai_analyses_paper_id ON ai_analyses(paper_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_model ON ai_analyses(model_provider, model_name);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_created_at ON ai_analyses(created_at);

-- Documents table indexes for vector search
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN (metadata);
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_last_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_papers_last_modified ON papers;
CREATE TRIGGER update_papers_last_modified 
    BEFORE UPDATE ON papers 
    FOR EACH ROW EXECUTE FUNCTION update_last_modified_column();

DROP TRIGGER IF EXISTS update_user_evaluations_updated_at ON user_evaluations;
CREATE TRIGGER update_user_evaluations_updated_at 
    BEFORE UPDATE ON user_evaluations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();