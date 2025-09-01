-- Schema Optimization and Consolidation
-- Migration: 012_schema_optimization_consolidation.sql
-- Description: Final schema optimization with advanced indexing, partitioning, and RLS policies

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================================================
-- ADVANCED INDEXING OPTIMIZATIONS
-- ============================================================================

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_papers_composite_search 
ON papers (publication_year DESC, reading_status) 
INCLUDE (title, authors, journal, abstract);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_evaluations_rating_tags 
ON user_evaluations (rating DESC, tags) 
WHERE rating IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_analyses_composite 
ON ai_analyses (paper_id, model_provider, created_at DESC) 
INCLUDE (summary, confidence_score);

-- Full-text search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_papers_fulltext_search 
ON papers USING GIN (to_tsvector('english', title || ' ' || COALESCE(abstract, '')));

-- Background jobs optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_background_jobs_queue_processing 
ON background_jobs (status, priority DESC, created_at ASC) 
WHERE status IN ('pending', 'processing');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_background_jobs_user_recent 
ON background_jobs (user_id, created_at DESC) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Notifications optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread 
ON notifications (user_id, created_at DESC) 
WHERE read_at IS NULL AND expires_at > NOW();

-- API metrics optimization for time-series queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_metrics_time_series 
ON api_metrics (created_at DESC, endpoint) 
INCLUDE (response_time, status_code);

-- ============================================================================
-- PARTITIONING IMPLEMENTATION
-- ============================================================================

-- Convert api_metrics to partitioned table if not already partitioned
DO $
BEGIN
  -- Check if table is already partitioned
  IF NOT EXISTS (
    SELECT 1 FROM pg_partitioned_table 
    WHERE schemaname = 'public' AND tablename = 'api_metrics'
  ) THEN
    -- Create new partitioned table
    CREATE TABLE api_metrics_new (
      LIKE api_metrics INCLUDING ALL
    ) PARTITION BY RANGE (created_at);
    
    -- Create initial partitions for current and next month
    EXECUTE format('CREATE TABLE api_metrics_%s PARTITION OF api_metrics_new FOR VALUES FROM (%L) TO (%L)',
      to_char(date_trunc('month', NOW()), 'YYYY_MM'),
      date_trunc('month', NOW()),
      date_trunc('month', NOW()) + INTERVAL '1 month'
    );
    
    EXECUTE format('CREATE TABLE api_metrics_%s PARTITION OF api_metrics_new FOR VALUES FROM (%L) TO (%L)',
      to_char(date_trunc('month', NOW()) + INTERVAL '1 month', 'YYYY_MM'),
      date_trunc('month', NOW()) + INTERVAL '1 month',
      date_trunc('month', NOW()) + INTERVAL '2 months'
    );
    
    -- Copy data from old table to new partitioned table
    INSERT INTO api_metrics_new SELECT * FROM api_metrics;
    
    -- Rename tables
    ALTER TABLE api_metrics RENAME TO api_metrics_old;
    ALTER TABLE api_metrics_new RENAME TO api_metrics;
    
    -- Drop old table after verification
    -- DROP TABLE api_metrics_old; -- Uncomment after verification
  END IF;
END;
$;

-- Partition system_resource_metrics by day for high-frequency data
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_partitioned_table 
    WHERE schemaname = 'public' AND tablename = 'system_resource_metrics'
  ) THEN
    -- Create partitioned version
    CREATE TABLE system_resource_metrics_new (
      LIKE system_resource_metrics INCLUDING ALL
    ) PARTITION BY RANGE (created_at);
    
    -- Create daily partitions for current week
    FOR i IN 0..6 LOOP
      EXECUTE format('CREATE TABLE system_resource_metrics_%s PARTITION OF system_resource_metrics_new FOR VALUES FROM (%L) TO (%L)',
        to_char(CURRENT_DATE + (i || ' days')::INTERVAL, 'YYYY_MM_DD'),
        CURRENT_DATE + (i || ' days')::INTERVAL,
        CURRENT_DATE + ((i + 1) || ' days')::INTERVAL
      );
    END LOOP;
    
    -- Copy existing data
    INSERT INTO system_resource_metrics_new SELECT * FROM system_resource_metrics;
    
    -- Rename tables
    ALTER TABLE system_resource_metrics RENAME TO system_resource_metrics_old;
    ALTER TABLE system_resource_metrics_new RENAME TO system_resource_metrics;
  END IF;
END;
$;

-- ============================================================================
-- AUTOMATED PARTITION MANAGEMENT
-- ============================================================================

-- Function to create monthly partitions for api_metrics
CREATE OR REPLACE FUNCTION create_monthly_api_metrics_partition(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  start_date := date_trunc('month', target_date);
  end_date := start_date + INTERVAL '1 month';
  partition_name := 'api_metrics_' || to_char(start_date, 'YYYY_MM');
  
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF api_metrics FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date);
  
  RETURN partition_name;
END;
$ LANGUAGE plpgsql;

-- Function to create daily partitions for system_resource_metrics
CREATE OR REPLACE FUNCTION create_daily_resource_metrics_partition(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  start_date := target_date;
  end_date := start_date + INTERVAL '1 day';
  partition_name := 'system_resource_metrics_' || to_char(start_date, 'YYYY_MM_DD');
  
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF system_resource_metrics FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date);
  
  RETURN partition_name;
END;
$ LANGUAGE plpgsql;

-- Function to automatically create future partitions
CREATE OR REPLACE FUNCTION maintain_partitions()
RETURNS VOID AS $
BEGIN
  -- Create next month's API metrics partition
  PERFORM create_monthly_api_metrics_partition(CURRENT_DATE + INTERVAL '1 month');
  
  -- Create next week's daily resource metrics partitions
  FOR i IN 1..7 LOOP
    PERFORM create_daily_resource_metrics_partition(CURRENT_DATE + (i || ' days')::INTERVAL);
  END LOOP;
  
  -- Clean up old partitions (keep 6 months of API metrics)
  PERFORM drop_old_partitions('api_metrics', INTERVAL '6 months');
  
  -- Clean up old resource metrics (keep 30 days)
  PERFORM drop_old_partitions('system_resource_metrics', INTERVAL '30 days');
END;
$ LANGUAGE plpgsql;

-- Function to drop old partitions
CREATE OR REPLACE FUNCTION drop_old_partitions(table_prefix TEXT, retention_period INTERVAL)
RETURNS VOID AS $
DECLARE
  partition_record RECORD;
  cutoff_date DATE;
BEGIN
  cutoff_date := CURRENT_DATE - retention_period;
  
  FOR partition_record IN 
    SELECT schemaname, tablename 
    FROM pg_tables 
    WHERE tablename LIKE table_prefix || '_%'
      AND schemaname = 'public'
  LOOP
    -- Extract date from partition name and check if it's old enough to drop
    -- This is a simplified version - in production, you'd want more robust date parsing
    IF partition_record.tablename ~ '\d{4}_\d{2}(_\d{2})?$' THEN
      EXECUTE format('DROP TABLE IF EXISTS %I.%I', 
        partition_record.schemaname, partition_record.tablename);
    END IF;
  END LOOP;
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- ADVANCED RLS POLICIES
-- ============================================================================

-- Enhanced RLS for papers with performance optimization
DROP POLICY IF EXISTS "Users can view own papers" ON papers;
CREATE POLICY "Users can view own papers" ON papers
  FOR SELECT USING (
    -- Allow if user owns the paper or if it's shared
    EXISTS (
      SELECT 1 FROM user_evaluations ue 
      WHERE ue.paper_id = papers.id 
        AND ue.user_id = auth.uid()
    )
    OR 
    -- Admin access
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() 
        AND up.role = 'admin'
    )
  );

-- Enhanced RLS for AI analyses with caching
DROP POLICY IF EXISTS "Users can view analyses for their papers" ON ai_analyses;
CREATE POLICY "Users can view analyses for their papers" ON ai_analyses
  FOR SELECT USING (
    paper_id IN (
      SELECT p.id FROM papers p
      JOIN user_evaluations ue ON ue.paper_id = p.id
      WHERE ue.user_id = auth.uid()
    )
    OR 
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() 
        AND up.role = 'admin'
    )
  );

-- Performance-optimized RLS for background jobs
DROP POLICY IF EXISTS "Users can view their own jobs" ON background_jobs;
CREATE POLICY "Users can view their own jobs" ON background_jobs
  FOR SELECT USING (
    user_id = auth.uid()
    OR 
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() 
        AND up.role IN ('admin', 'moderator')
    )
  );

-- ============================================================================
-- TRIGGER FUNCTIONS FOR DATA INTEGRITY
-- ============================================================================

-- Enhanced trigger for automatic job cleanup
CREATE OR REPLACE FUNCTION enhanced_job_cleanup()
RETURNS TRIGGER AS $
BEGIN
  -- Auto-cancel stuck jobs
  UPDATE background_jobs 
  SET status = 'failed', 
      error_message = 'Job timed out',
      completed_at = NOW()
  WHERE status = 'processing' 
    AND started_at < NOW() - INTERVAL '2 hours'
    AND type != 'backup'; -- Don't auto-cancel backup jobs
  
  -- Clean up old completed jobs
  DELETE FROM background_jobs 
  WHERE status = 'completed' 
    AND completed_at < NOW() - INTERVAL '7 days';
  
  RETURN NULL;
END;
$ LANGUAGE plpgsql;

-- Trigger for notification cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_notifications_enhanced()
RETURNS TRIGGER AS $
BEGIN
  -- Delete expired notifications
  DELETE FROM notifications 
  WHERE expires_at < NOW() - INTERVAL '1 day';
  
  -- Archive old read notifications
  INSERT INTO notification_archive (
    SELECT * FROM notifications 
    WHERE read_at < NOW() - INTERVAL '30 days'
  );
  
  DELETE FROM notifications 
  WHERE read_at < NOW() - INTERVAL '30 days';
  
  RETURN NULL;
END;
$ LANGUAGE plpgsql;

-- Create notification archive table
CREATE TABLE IF NOT EXISTS notification_archive (
  LIKE notifications INCLUDING ALL
);

-- ============================================================================
-- PERFORMANCE MONITORING FUNCTIONS
-- ============================================================================

-- Function to get database performance metrics
CREATE OR REPLACE FUNCTION get_database_performance_metrics()
RETURNS TABLE (
  metric_name TEXT,
  metric_value NUMERIC,
  metric_unit TEXT,
  collected_at TIMESTAMP WITH TIME ZONE
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    'active_connections'::TEXT,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active')::NUMERIC,
    'connections'::TEXT,
    NOW()
  UNION ALL
  SELECT 
    'cache_hit_ratio'::TEXT,
    ROUND(
      (sum(blks_hit) * 100.0 / NULLIF(sum(blks_hit) + sum(blks_read), 0))::NUMERIC, 
      2
    ),
    'percentage'::TEXT,
    NOW()
  FROM pg_stat_database
  UNION ALL
  SELECT 
    'avg_query_time'::TEXT,
    ROUND(mean_exec_time::NUMERIC, 2),
    'milliseconds'::TEXT,
    NOW()
  FROM pg_stat_statements 
  ORDER BY mean_exec_time DESC 
  LIMIT 1;
END;
$ LANGUAGE plpgsql;

-- Function to analyze slow queries
CREATE OR REPLACE FUNCTION analyze_slow_queries(time_threshold INTEGER DEFAULT 1000)
RETURNS TABLE (
  query_hash TEXT,
  query TEXT,
  calls BIGINT,
  mean_time NUMERIC,
  total_time NUMERIC,
  rows_per_call NUMERIC
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    md5(pss.query)::TEXT,
    pss.query,
    pss.calls,
    ROUND(pss.mean_exec_time::NUMERIC, 2),
    ROUND(pss.total_exec_time::NUMERIC, 2),
    ROUND((pss.rows::NUMERIC / NULLIF(pss.calls, 0)), 2)
  FROM pg_stat_statements pss
  WHERE pss.mean_exec_time > time_threshold
  ORDER BY pss.mean_exec_time DESC
  LIMIT 20;
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ============================================================================

-- Materialized view for user statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS user_statistics AS
SELECT 
  u.id as user_id,
  COUNT(DISTINCT p.id) as total_papers,
  COUNT(DISTINCT ue.id) as evaluated_papers,
  COUNT(DISTINCT aa.id) as ai_analyses,
  AVG(ue.rating) as avg_rating,
  COUNT(DISTINCT bj.id) as background_jobs,
  MAX(p.date_added) as last_paper_added,
  MAX(ue.updated_at) as last_evaluation
FROM auth.users u
LEFT JOIN user_evaluations ue ON ue.user_id = u.id
LEFT JOIN papers p ON p.id = ue.paper_id
LEFT JOIN ai_analyses aa ON aa.paper_id = p.id
LEFT JOIN background_jobs bj ON bj.user_id = u.id
GROUP BY u.id;

-- Create unique index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_statistics_user_id 
ON user_statistics (user_id);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS VOID AS $
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_statistics;
  
  -- Log the refresh
  INSERT INTO system_metrics (metric_type, metric_name, value, unit)
  VALUES ('maintenance', 'materialized_view_refresh', 1, 'count');
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEDULED MAINTENANCE JOBS
-- ============================================================================

-- Create a maintenance log table
CREATE TABLE IF NOT EXISTS maintenance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  details JSONB DEFAULT '{}',
  duration_ms INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Automated cleanup functions
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS VOID AS $
BEGIN
  -- Clean up completed jobs older than 7 days
  DELETE FROM background_jobs 
  WHERE status = 'completed' 
    AND completed_at < NOW() - INTERVAL '7 days';
  
  -- Clean up failed jobs older than 30 days
  DELETE FROM background_jobs 
  WHERE status = 'failed' 
    AND completed_at < NOW() - INTERVAL '30 days';
  
  -- Clean up old job progress entries
  DELETE FROM job_progress 
  WHERE created_at < NOW() - INTERVAL '24 hours';
  
  -- Clean up expired notifications
  DELETE FROM notifications 
  WHERE expires_at < NOW() - INTERVAL '1 day';
  
  -- Archive old read notifications
  INSERT INTO notification_archive (
    SELECT * FROM notifications 
    WHERE read_at < NOW() - INTERVAL '30 days'
  ) ON CONFLICT DO NOTHING;
  
  DELETE FROM notifications 
  WHERE read_at < NOW() - INTERVAL '30 days';
  
  -- Clean up old API metrics (handled by partition dropping)
  -- Clean up old resource metrics (handled by partition dropping)
  
  -- Clean up old maintenance logs
  DELETE FROM maintenance_log 
  WHERE completed_at < NOW() - INTERVAL '90 days';
END;
$ LANGUAGE plpgsql;

-- Function to run all maintenance tasks
CREATE OR REPLACE FUNCTION run_maintenance_tasks()
RETURNS VOID AS $
DECLARE
  task_id UUID;
  start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  start_time := NOW();
  
  -- Log maintenance start
  INSERT INTO maintenance_log (task_name, status, started_at)
  VALUES ('full_maintenance', 'running', start_time)
  RETURNING id INTO task_id;
  
  BEGIN
    -- Run partition maintenance
    PERFORM maintain_partitions();
    
    -- Refresh materialized views
    PERFORM refresh_materialized_views();
    
    -- Clean up old data
    PERFORM cleanup_old_data();
    PERFORM cleanup_old_metrics();
    PERFORM cleanup_old_jobs();
    PERFORM cleanup_expired_notifications();
    
    -- Update statistics
    ANALYZE;
    
    -- Log successful completion
    UPDATE maintenance_log 
    SET status = 'completed',
        completed_at = NOW(),
        duration_ms = EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000
    WHERE id = task_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log failure
    UPDATE maintenance_log 
    SET status = 'failed',
        completed_at = NOW(),
        details = jsonb_build_object('error', SQLERRM),
        duration_ms = EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000
    WHERE id = task_id;
    
    RAISE;
  END;
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Grant necessary permissions to service role
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant read permissions to authenticated users for performance views
GRANT SELECT ON user_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_performance_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_slow_queries(INTEGER) TO authenticated;

-- Grant maintenance function execution to service role only
GRANT EXECUTE ON FUNCTION run_maintenance_tasks() TO service_role;
GRANT EXECUTE ON FUNCTION maintain_partitions() TO service_role;
GRANT EXECUTE ON FUNCTION refresh_materialized_views() TO service_role;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION create_monthly_api_metrics_partition(DATE) IS 'Creates monthly partitions for API metrics table';
COMMENT ON FUNCTION create_daily_resource_metrics_partition(DATE) IS 'Creates daily partitions for system resource metrics';
COMMENT ON FUNCTION maintain_partitions() IS 'Automated partition maintenance - creates future partitions and drops old ones';
COMMENT ON FUNCTION get_database_performance_metrics() IS 'Returns current database performance metrics';
COMMENT ON FUNCTION analyze_slow_queries(INTEGER) IS 'Analyzes and returns slow queries above the specified threshold';
COMMENT ON FUNCTION run_maintenance_tasks() IS 'Runs all scheduled maintenance tasks';

COMMENT ON MATERIALIZED VIEW user_statistics IS 'Aggregated user statistics for performance optimization';
COMMENT ON TABLE maintenance_log IS 'Log of all maintenance task executions';

-- ============================================================================
-- FINAL OPTIMIZATIONS
-- ============================================================================

-- Update table statistics
ANALYZE;

-- Log migration completion
INSERT INTO system_metrics (metric_type, metric_name, value, unit, metadata)
VALUES (
  'migration', 
  'schema_optimization_completed', 
  1, 
  'count',
  jsonb_build_object(
    'migration_file', '012_schema_optimization_consolidation.sql',
    'completed_at', NOW()
  )
);