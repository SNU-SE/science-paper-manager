-- Advanced Search Performance Optimization Indexes
-- Migration 005: Add indexes for advanced search and filtering

-- Full-text search indexes for better text search performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_papers_search_vector 
ON papers USING GIN (to_tsvector('english', 
  COALESCE(title, '') || ' ' || 
  COALESCE(abstract, '') || ' ' || 
  COALESCE(journal, '') || ' ' ||
  COALESCE(array_to_string(authors, ' '), '')
));

-- Composite indexes for common filter combinations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_papers_composite_search 
ON papers (publication_year, reading_status) 
INCLUDE (title, authors, journal, abstract);

-- Index for journal filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_papers_journal_lower 
ON papers (LOWER(journal)) WHERE journal IS NOT NULL;

-- Index for author filtering using GIN for array operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_papers_authors_gin 
ON papers USING GIN (authors);

-- Index for date range filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_papers_date_added_range 
ON papers (date_added, reading_status);

-- Composite index for user evaluations filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_evaluations_rating_tags 
ON user_evaluations (rating, tags) 
WHERE rating IS NOT NULL;

-- Index for tags filtering using GIN
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_evaluations_tags_gin 
ON user_evaluations USING GIN (tags);

-- Composite index for sorting by rating with paper info
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evaluations_rating_paper 
ON user_evaluations (rating DESC, paper_id) 
WHERE rating IS NOT NULL;

-- Index for publication year sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_papers_pub_year_title 
ON papers (publication_year DESC NULLS LAST, title);

-- Index for title sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_papers_title_lower 
ON papers (LOWER(title));

-- Partial indexes for specific reading statuses (commonly filtered)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_papers_unread 
ON papers (date_added DESC) WHERE reading_status = 'unread';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_papers_completed 
ON papers (date_read DESC) WHERE reading_status = 'completed';

-- Index for recent papers (commonly accessed)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_papers_recent 
ON papers (last_modified DESC) 
WHERE last_modified > NOW() - INTERVAL '30 days';

-- Function to improve search performance with ranking
CREATE OR REPLACE FUNCTION search_papers_ranked(
  search_query TEXT,
  limit_count INTEGER DEFAULT 50
) RETURNS TABLE (
  paper_id UUID,
  title TEXT,
  authors TEXT[],
  journal TEXT,
  publication_year INTEGER,
  abstract TEXT,
  reading_status TEXT,
  rank_score REAL
) LANGUAGE plpgsql AS $
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.authors,
    p.journal,
    p.publication_year,
    p.abstract,
    p.reading_status,
    ts_rank(
      to_tsvector('english', 
        COALESCE(p.title, '') || ' ' || 
        COALESCE(p.abstract, '') || ' ' || 
        COALESCE(p.journal, '') || ' ' ||
        COALESCE(array_to_string(p.authors, ' '), '')
      ),
      plainto_tsquery('english', search_query)
    ) AS rank_score
  FROM papers p
  WHERE to_tsvector('english', 
    COALESCE(p.title, '') || ' ' || 
    COALESCE(p.abstract, '') || ' ' || 
    COALESCE(p.journal, '') || ' ' ||
    COALESCE(array_to_string(p.authors, ' '), '')
  ) @@ plainto_tsquery('english', search_query)
  ORDER BY rank_score DESC, p.last_modified DESC
  LIMIT limit_count;
END;
$;

-- Function to get search suggestions
CREATE OR REPLACE FUNCTION get_search_suggestions(
  partial_query TEXT,
  suggestion_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  suggestion TEXT,
  suggestion_type TEXT,
  frequency INTEGER
) LANGUAGE plpgsql AS $
BEGIN
  RETURN QUERY
  -- Title suggestions
  SELECT DISTINCT 
    p.title as suggestion,
    'title'::TEXT as suggestion_type,
    1 as frequency
  FROM papers p
  WHERE p.title ILIKE '%' || partial_query || '%'
  
  UNION ALL
  
  -- Journal suggestions
  SELECT DISTINCT 
    p.journal as suggestion,
    'journal'::TEXT as suggestion_type,
    COUNT(*)::INTEGER as frequency
  FROM papers p
  WHERE p.journal IS NOT NULL 
    AND p.journal ILIKE '%' || partial_query || '%'
  GROUP BY p.journal
  
  UNION ALL
  
  -- Author suggestions
  SELECT DISTINCT 
    unnest(p.authors) as suggestion,
    'author'::TEXT as suggestion_type,
    COUNT(*)::INTEGER as frequency
  FROM papers p
  WHERE p.authors IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM unnest(p.authors) AS author 
      WHERE author ILIKE '%' || partial_query || '%'
    )
  GROUP BY unnest(p.authors)
  
  ORDER BY frequency DESC, suggestion
  LIMIT suggestion_limit;
END;
$;

-- Function to get filter statistics
CREATE OR REPLACE FUNCTION get_filter_statistics()
RETURNS TABLE (
  total_papers INTEGER,
  journals_count INTEGER,
  authors_count INTEGER,
  tags_count INTEGER,
  year_range_min INTEGER,
  year_range_max INTEGER,
  avg_rating NUMERIC,
  papers_with_ratings INTEGER
) LANGUAGE plpgsql AS $
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM papers) as total_papers,
    (SELECT COUNT(DISTINCT journal)::INTEGER FROM papers WHERE journal IS NOT NULL) as journals_count,
    (SELECT COUNT(DISTINCT unnest(authors))::INTEGER FROM papers WHERE authors IS NOT NULL) as authors_count,
    (SELECT COUNT(DISTINCT unnest(tags))::INTEGER FROM user_evaluations WHERE tags IS NOT NULL) as tags_count,
    (SELECT MIN(publication_year)::INTEGER FROM papers WHERE publication_year IS NOT NULL) as year_range_min,
    (SELECT MAX(publication_year)::INTEGER FROM papers WHERE publication_year IS NOT NULL) as year_range_max,
    (SELECT ROUND(AVG(rating), 2) FROM user_evaluations WHERE rating IS NOT NULL) as avg_rating,
    (SELECT COUNT(DISTINCT paper_id)::INTEGER FROM user_evaluations WHERE rating IS NOT NULL) as papers_with_ratings;
END;
$;

-- Create materialized view for search performance (optional, for very large datasets)
-- CREATE MATERIALIZED VIEW IF NOT EXISTS papers_search_cache AS
-- SELECT 
--   p.id,
--   p.title,
--   p.authors,
--   p.journal,
--   p.publication_year,
--   p.reading_status,
--   p.date_added,
--   p.last_modified,
--   ue.rating,
--   ue.tags,
--   to_tsvector('english', 
--     COALESCE(p.title, '') || ' ' || 
--     COALESCE(p.abstract, '') || ' ' || 
--     COALESCE(p.journal, '') || ' ' ||
--     COALESCE(array_to_string(p.authors, ' '), '')
--   ) as search_vector
-- FROM papers p
-- LEFT JOIN user_evaluations ue ON p.id = ue.paper_id;

-- CREATE UNIQUE INDEX ON papers_search_cache (id);
-- CREATE INDEX ON papers_search_cache USING GIN (search_vector);
-- CREATE INDEX ON papers_search_cache (rating, tags) WHERE rating IS NOT NULL;

-- Refresh function for materialized view
-- CREATE OR REPLACE FUNCTION refresh_papers_search_cache()
-- RETURNS VOID LANGUAGE plpgsql AS $
-- BEGIN
--   REFRESH MATERIALIZED VIEW CONCURRENTLY papers_search_cache;
-- END;
-- $;