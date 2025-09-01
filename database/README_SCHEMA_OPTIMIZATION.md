# Database Schema Optimization Guide

This document describes the comprehensive database schema optimizations implemented for the Science Paper Manager system.

## Overview

The database schema has been optimized for:
- **Performance**: Advanced indexing, partitioning, and query optimization
- **Scalability**: Automated partition management and data archiving
- **Security**: Enhanced RLS policies and data protection
- **Monitoring**: Comprehensive performance and health tracking
- **Maintenance**: Automated cleanup and optimization tasks

## Schema Components

### Core Tables

#### Papers and Evaluations
- `papers` - Core paper storage with full-text search optimization
- `user_evaluations` - User ratings and notes with advanced indexing
- `ai_analyses` - AI analysis results with provider-specific optimization

#### Background Processing
- `background_jobs` - Job queue with priority and status tracking
- `job_progress` - Real-time progress updates
- `job_failures` - Detailed failure analysis and retry logic

#### Notifications
- `notifications` - Real-time notification storage
- `notification_settings` - User preference management
- `notification_delivery_log` - Delivery tracking and analytics

#### Performance Monitoring
- `api_metrics` - API performance tracking (partitioned by month)
- `db_query_metrics` - Database query performance
- `user_activity_metrics` - User behavior analytics
- `system_metrics` - System-wide performance metrics

#### Usage Tracking
- `api_usage_tracking` - Detailed API usage logs (partitioned)
- `daily_usage_summary` - Aggregated daily statistics
- `user_rate_limits` - Dynamic rate limiting
- `suspicious_activity_log` - Security monitoring

#### System Health
- `health_check_results` - System health snapshots
- `system_resource_metrics` - Resource usage tracking (partitioned by day)
- `resource_alerts` - Automated alerting
- `recovery_attempts` - Auto-recovery tracking

#### Backup and Maintenance
- `backup_records` - Backup tracking and validation
- `backup_schedules` - Automated backup scheduling
- `maintenance_log` - Maintenance task tracking

## Performance Optimizations

### Advanced Indexing

#### Composite Indexes
```sql
-- Multi-column indexes for complex queries
CREATE INDEX idx_papers_composite_search 
ON papers (publication_year DESC, reading_status) 
INCLUDE (title, authors, journal, abstract);

CREATE INDEX idx_user_evaluations_rating_tags 
ON user_evaluations (rating DESC, tags) 
WHERE rating IS NOT NULL;
```

#### Full-Text Search
```sql
-- Optimized full-text search
CREATE INDEX idx_papers_fulltext_search 
ON papers USING GIN (to_tsvector('english', title || ' ' || COALESCE(abstract, '')));
```

#### Time-Series Optimization
```sql
-- Optimized for time-series queries
CREATE INDEX idx_api_metrics_time_series 
ON api_metrics (created_at DESC, endpoint) 
INCLUDE (response_time, status_code);
```

### Partitioning Strategy

#### Monthly Partitioning (API Metrics)
- Automatic monthly partition creation
- 6-month retention policy
- Optimized for time-range queries

#### Daily Partitioning (Resource Metrics)
- High-frequency data partitioned by day
- 30-day retention policy
- Automated cleanup

### Materialized Views

#### User Statistics
```sql
CREATE MATERIALIZED VIEW user_statistics AS
SELECT 
  u.id as user_id,
  COUNT(DISTINCT p.id) as total_papers,
  COUNT(DISTINCT ue.id) as evaluated_papers,
  AVG(ue.rating) as avg_rating,
  MAX(p.date_added) as last_paper_added
FROM auth.users u
LEFT JOIN user_evaluations ue ON ue.user_id = u.id
LEFT JOIN papers p ON p.id = ue.paper_id
GROUP BY u.id;
```

## Security Enhancements

### Row Level Security (RLS)

#### Performance-Optimized Policies
```sql
-- Optimized user access policy
CREATE POLICY "Users can view own papers" ON papers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_evaluations ue 
      WHERE ue.paper_id = papers.id 
        AND ue.user_id = auth.uid()
    )
  );
```

#### Admin Access Patterns
```sql
-- Efficient admin access
CREATE POLICY "Admins can view all data" ON papers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() 
        AND up.role = 'admin'
    )
  );
```

## Automated Maintenance

### Partition Management
```sql
-- Automated partition creation and cleanup
CREATE OR REPLACE FUNCTION maintain_partitions()
RETURNS VOID AS $
BEGIN
  -- Create future partitions
  PERFORM create_monthly_api_metrics_partition(CURRENT_DATE + INTERVAL '1 month');
  
  -- Clean up old partitions
  PERFORM drop_old_partitions('api_metrics', INTERVAL '6 months');
END;
$ LANGUAGE plpgsql;
```

### Data Cleanup
```sql
-- Automated data cleanup
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS VOID AS $
BEGIN
  -- Clean up completed jobs
  DELETE FROM background_jobs 
  WHERE status = 'completed' 
    AND completed_at < NOW() - INTERVAL '7 days';
  
  -- Archive old notifications
  INSERT INTO notification_archive 
  SELECT * FROM notifications 
  WHERE read_at < NOW() - INTERVAL '30 days';
END;
$ LANGUAGE plpgsql;
```

## Monitoring and Analytics

### Performance Metrics
```sql
-- Database performance monitoring
CREATE OR REPLACE FUNCTION get_database_performance_metrics()
RETURNS TABLE (
  metric_name TEXT,
  metric_value NUMERIC,
  metric_unit TEXT
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    'cache_hit_ratio'::TEXT,
    ROUND((sum(blks_hit) * 100.0 / NULLIF(sum(blks_hit) + sum(blks_read), 0))::NUMERIC, 2),
    'percentage'::TEXT
  FROM pg_stat_database;
END;
$ LANGUAGE plpgsql;
```

### Slow Query Analysis
```sql
-- Identify performance bottlenecks
CREATE OR REPLACE FUNCTION analyze_slow_queries(time_threshold INTEGER DEFAULT 1000)
RETURNS TABLE (
  query_hash TEXT,
  calls BIGINT,
  mean_time NUMERIC,
  total_time NUMERIC
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    md5(pss.query)::TEXT,
    pss.calls,
    ROUND(pss.mean_exec_time::NUMERIC, 2),
    ROUND(pss.total_exec_time::NUMERIC, 2)
  FROM pg_stat_statements pss
  WHERE pss.mean_exec_time > time_threshold
  ORDER BY pss.mean_exec_time DESC;
END;
$ LANGUAGE plpgsql;
```

## Setup and Deployment

### Initial Setup
```bash
# Run optimized database setup
npm run setup-db:optimized

# Validate schema optimization
npm run validate-db:schema
```

### Migration Process
1. **Backup existing data**
2. **Run migration 012_schema_optimization_consolidation.sql**
3. **Create initial partitions**
4. **Refresh materialized views**
5. **Update table statistics**
6. **Validate optimization**

### Monitoring Setup
```bash
# Set up automated maintenance (requires pg_cron)
SELECT cron.schedule('partition-maintenance', '0 2 * * *', 'SELECT maintain_partitions();');
SELECT cron.schedule('data-cleanup', '0 3 * * 0', 'SELECT cleanup_old_data();');
SELECT cron.schedule('stats-refresh', '0 1 * * *', 'SELECT refresh_materialized_views();');
```

## Performance Benchmarks

### Expected Improvements
- **Query Performance**: 60-80% improvement for complex searches
- **Insert Performance**: 40-60% improvement with partitioning
- **Storage Efficiency**: 30-50% reduction with automated cleanup
- **Concurrent Users**: Support for 10x more concurrent users

### Key Metrics to Monitor
- Cache hit ratio (target: >95%)
- Average query time (target: <100ms)
- Partition efficiency (automatic management)
- RLS policy performance (optimized for common patterns)

## Troubleshooting

### Common Issues

#### Partition Creation Failures
```sql
-- Manual partition creation
SELECT create_monthly_api_metrics_partition('2024-02-01'::DATE);
```

#### RLS Performance Issues
```sql
-- Check policy efficiency
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM papers WHERE user_id = 'user-uuid';
```

#### Index Usage Analysis
```sql
-- Verify index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Best Practices

### Query Optimization
1. **Use appropriate indexes** for your query patterns
2. **Leverage partitioning** for time-series data
3. **Monitor slow queries** regularly
4. **Update table statistics** after bulk operations

### Maintenance
1. **Schedule regular maintenance** during low-traffic periods
2. **Monitor partition growth** and adjust retention policies
3. **Review RLS policies** for performance impact
4. **Archive old data** to maintain performance

### Security
1. **Regularly audit RLS policies**
2. **Monitor suspicious activity logs**
3. **Review admin access patterns**
4. **Validate data encryption** for sensitive fields

## Future Enhancements

### Planned Optimizations
- **Read replicas** for analytics workloads
- **Connection pooling** optimization
- **Advanced caching** strategies
- **Real-time analytics** with streaming

### Monitoring Improvements
- **Custom metrics** for business logic
- **Automated alerting** for performance degradation
- **Capacity planning** based on usage trends
- **Cost optimization** recommendations

---

For questions or issues with the database optimization, please refer to the troubleshooting section or contact the development team.