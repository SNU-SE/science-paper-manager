-- Test migration to verify syntax
-- This file tests the key components of the schema optimization

-- Test function creation
CREATE OR REPLACE FUNCTION test_schema_optimization()
RETURNS BOOLEAN AS $
BEGIN
  -- Test that we can create a simple partition function
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'create_monthly_api_metrics_partition'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Test that materialized view can be created
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_name = 'user_statistics'
  ) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$ LANGUAGE plpgsql;

-- Test basic table structure
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'papers', 
    'background_jobs', 
    'notifications', 
    'api_metrics'
  )
ORDER BY table_name;

-- Test index existence
SELECT 
  indexname,
  tablename
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Clean up test function
DROP FUNCTION IF EXISTS test_schema_optimization();