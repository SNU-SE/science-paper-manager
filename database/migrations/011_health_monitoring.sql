-- Health monitoring tables
-- This migration adds tables for storing health check results and system metrics

-- Health check results table
CREATE TABLE IF NOT EXISTS health_check_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overall_status VARCHAR(20) NOT NULL CHECK (overall_status IN ('healthy', 'degraded', 'unhealthy')),
  services JSONB NOT NULL DEFAULT '[]',
  uptime BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for querying recent health checks
CREATE INDEX IF NOT EXISTS idx_health_check_results_created_at 
ON health_check_results(created_at DESC);

-- Create index for querying by status
CREATE INDEX IF NOT EXISTS idx_health_check_results_status 
ON health_check_results(overall_status);

-- System resource metrics table
CREATE TABLE IF NOT EXISTS system_resource_metrics (
  id BIGSERIAL PRIMARY KEY,
  memory_used BIGINT NOT NULL,
  memory_total BIGINT NOT NULL,
  memory_percentage DECIMAL(5,2) NOT NULL,
  heap_used BIGINT NOT NULL,
  heap_total BIGINT NOT NULL,
  external_memory BIGINT NOT NULL,
  cpu_user BIGINT NOT NULL,
  cpu_system BIGINT NOT NULL,
  cpu_percentage DECIMAL(5,2) NOT NULL,
  load_average DECIMAL[] DEFAULT '{}',
  process_uptime DECIMAL NOT NULL,
  process_pid INTEGER NOT NULL,
  active_handles INTEGER DEFAULT 0,
  active_requests INTEGER DEFAULT 0,
  event_loop_delay DECIMAL(10,3) NOT NULL,
  event_loop_utilization DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Partition the metrics table by month for better performance
-- Note: This requires manual partition creation or automated partition management
CREATE INDEX IF NOT EXISTS idx_system_resource_metrics_created_at 
ON system_resource_metrics(created_at DESC);

-- Resource alerts table
CREATE TABLE IF NOT EXISTS resource_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('memory', 'cpu', 'eventloop', 'process')),
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('warning', 'critical')),
  message TEXT NOT NULL,
  value DECIMAL(10,3) NOT NULL,
  threshold DECIMAL(10,3) NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for alert queries
CREATE INDEX IF NOT EXISTS idx_resource_alerts_type_severity 
ON resource_alerts(alert_type, severity);

CREATE INDEX IF NOT EXISTS idx_resource_alerts_active 
ON resource_alerts(created_at DESC) 
WHERE resolved_at IS NULL;

-- Recovery attempts table
CREATE TABLE IF NOT EXISTS recovery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id VARCHAR(100) NOT NULL,
  action_name VARCHAR(200) NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  success BOOLEAN NOT NULL,
  attempt_number INTEGER NOT NULL,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for recovery queries
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_action_id 
ON recovery_attempts(action_id);

CREATE INDEX IF NOT EXISTS idx_recovery_attempts_service 
ON recovery_attempts(service_name);

CREATE INDEX IF NOT EXISTS idx_recovery_attempts_created_at 
ON recovery_attempts(created_at DESC);

-- Service status history table
CREATE TABLE IF NOT EXISTS service_status_history (
  id BIGSERIAL PRIMARY KEY,
  service_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  response_time INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for service status queries
CREATE INDEX IF NOT EXISTS idx_service_status_history_service_time 
ON service_status_history(service_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_status_history_status 
ON service_status_history(status, created_at DESC);

-- Function to clean up old health monitoring data
CREATE OR REPLACE FUNCTION cleanup_health_monitoring_data()
RETURNS void AS $$
BEGIN
  -- Keep only last 30 days of health check results
  DELETE FROM health_check_results 
  WHERE created_at < now() - INTERVAL '30 days';
  
  -- Keep only last 7 days of detailed resource metrics
  DELETE FROM system_resource_metrics 
  WHERE created_at < now() - INTERVAL '7 days';
  
  -- Keep only last 90 days of resolved alerts
  DELETE FROM resource_alerts 
  WHERE resolved_at IS NOT NULL 
  AND resolved_at < now() - INTERVAL '90 days';
  
  -- Keep only last 30 days of recovery attempts
  DELETE FROM recovery_attempts 
  WHERE created_at < now() - INTERVAL '30 days';
  
  -- Keep only last 30 days of service status history
  DELETE FROM service_status_history 
  WHERE created_at < now() - INTERVAL '30 days';
  
  -- Log cleanup completion
  RAISE NOTICE 'Health monitoring data cleanup completed at %', now();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup weekly (requires pg_cron extension)
-- This is commented out as it requires the pg_cron extension to be installed
-- SELECT cron.schedule('health-monitoring-cleanup', '0 2 * * 0', 'SELECT cleanup_health_monitoring_data();');

-- Function to get system health summary
CREATE OR REPLACE FUNCTION get_system_health_summary(
  time_range INTERVAL DEFAULT INTERVAL '24 hours'
)
RETURNS TABLE (
  overall_status VARCHAR(20),
  total_checks INTEGER,
  healthy_percentage DECIMAL(5,2),
  degraded_percentage DECIMAL(5,2),
  unhealthy_percentage DECIMAL(5,2),
  avg_uptime BIGINT,
  last_check TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.overall_status,
    COUNT(*)::INTEGER as total_checks,
    ROUND(
      (COUNT(*) FILTER (WHERE h.overall_status = 'healthy')::DECIMAL / COUNT(*)) * 100, 
      2
    ) as healthy_percentage,
    ROUND(
      (COUNT(*) FILTER (WHERE h.overall_status = 'degraded')::DECIMAL / COUNT(*)) * 100, 
      2
    ) as degraded_percentage,
    ROUND(
      (COUNT(*) FILTER (WHERE h.overall_status = 'unhealthy')::DECIMAL / COUNT(*)) * 100, 
      2
    ) as unhealthy_percentage,
    AVG(h.uptime)::BIGINT as avg_uptime,
    MAX(h.created_at) as last_check
  FROM health_check_results h
  WHERE h.created_at >= now() - time_range
  GROUP BY h.overall_status
  ORDER BY 
    CASE h.overall_status 
      WHEN 'healthy' THEN 1 
      WHEN 'degraded' THEN 2 
      WHEN 'unhealthy' THEN 3 
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to get resource usage trends
CREATE OR REPLACE FUNCTION get_resource_usage_trends(
  time_range INTERVAL DEFAULT INTERVAL '1 hour',
  sample_interval INTERVAL DEFAULT INTERVAL '5 minutes'
)
RETURNS TABLE (
  time_bucket TIMESTAMP WITH TIME ZONE,
  avg_memory_percentage DECIMAL(5,2),
  max_memory_percentage DECIMAL(5,2),
  avg_cpu_percentage DECIMAL(5,2),
  max_cpu_percentage DECIMAL(5,2),
  avg_event_loop_delay DECIMAL(10,3),
  max_event_loop_delay DECIMAL(10,3)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date_trunc('minute', m.created_at) + 
    (EXTRACT(minute FROM m.created_at)::INTEGER / EXTRACT(minutes FROM sample_interval)::INTEGER) * 
    sample_interval as time_bucket,
    AVG(m.memory_percentage)::DECIMAL(5,2) as avg_memory_percentage,
    MAX(m.memory_percentage)::DECIMAL(5,2) as max_memory_percentage,
    AVG(m.cpu_percentage)::DECIMAL(5,2) as avg_cpu_percentage,
    MAX(m.cpu_percentage)::DECIMAL(5,2) as max_cpu_percentage,
    AVG(m.event_loop_delay)::DECIMAL(10,3) as avg_event_loop_delay,
    MAX(m.event_loop_delay)::DECIMAL(10,3) as max_event_loop_delay
  FROM system_resource_metrics m
  WHERE m.created_at >= now() - time_range
  GROUP BY time_bucket
  ORDER BY time_bucket;
END;
$$ LANGUAGE plpgsql;

-- RLS policies for health monitoring tables
ALTER TABLE health_check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_resource_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_status_history ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all health monitoring data
CREATE POLICY "Service role can access health check results" ON health_check_results
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access resource metrics" ON system_resource_metrics
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access resource alerts" ON resource_alerts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access recovery attempts" ON recovery_attempts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access service status history" ON service_status_history
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read health monitoring data (for admin dashboard)
CREATE POLICY "Authenticated users can read health check results" ON health_check_results
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read resource metrics" ON system_resource_metrics
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read resource alerts" ON resource_alerts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read recovery attempts" ON recovery_attempts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read service status history" ON service_status_history
  FOR SELECT USING (auth.role() = 'authenticated');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Create a view for the latest system health status
CREATE OR REPLACE VIEW latest_system_health AS
SELECT 
  h.*,
  EXTRACT(EPOCH FROM (now() - h.created_at)) as seconds_since_check
FROM health_check_results h
WHERE h.created_at = (
  SELECT MAX(created_at) 
  FROM health_check_results
);

-- Grant access to the view
GRANT SELECT ON latest_system_health TO service_role;
GRANT SELECT ON latest_system_health TO authenticated;