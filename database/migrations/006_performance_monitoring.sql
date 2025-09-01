-- Performance Monitoring Tables
-- Migration: 006_performance_monitoring.sql

-- API 성능 메트릭 테이블
CREATE TABLE api_metrics (
  id BIGSERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time INTEGER NOT NULL, -- milliseconds
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  request_size INTEGER,
  response_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 데이터베이스 쿼리 메트릭 테이블
CREATE TABLE db_query_metrics (
  id BIGSERIAL PRIMARY KEY,
  query_hash VARCHAR(64) NOT NULL,
  query_type VARCHAR(20) NOT NULL,
  execution_time INTEGER NOT NULL, -- milliseconds
  rows_affected INTEGER,
  table_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 사용자 활동 메트릭 테이블
CREATE TABLE user_activity_metrics (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  feature VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  session_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 시스템 성능 메트릭 테이블
CREATE TABLE system_metrics (
  id BIGSERIAL PRIMARY KEY,
  metric_type VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  value NUMERIC NOT NULL,
  unit VARCHAR(20),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 성능 최적화를 위한 인덱스
CREATE INDEX idx_api_metrics_endpoint_time ON api_metrics(endpoint, created_at DESC);
CREATE INDEX idx_api_metrics_user_time ON api_metrics(user_id, created_at DESC);
CREATE INDEX idx_api_metrics_status_time ON api_metrics(status_code, created_at DESC);
CREATE INDEX idx_api_metrics_response_time ON api_metrics(response_time DESC, created_at DESC);

CREATE INDEX idx_db_query_metrics_hash ON db_query_metrics(query_hash);
CREATE INDEX idx_db_query_metrics_type_time ON db_query_metrics(query_type, created_at DESC);
CREATE INDEX idx_db_query_metrics_execution_time ON db_query_metrics(execution_time DESC, created_at DESC);

CREATE INDEX idx_user_activity_user_time ON user_activity_metrics(user_id, created_at DESC);
CREATE INDEX idx_user_activity_action_time ON user_activity_metrics(action, created_at DESC);
CREATE INDEX idx_user_activity_feature_time ON user_activity_metrics(feature, created_at DESC);

CREATE INDEX idx_system_metrics_type_time ON system_metrics(metric_type, created_at DESC);
CREATE INDEX idx_system_metrics_name_time ON system_metrics(metric_name, created_at DESC);

-- 시계열 데이터 파티셔닝을 위한 함수
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name TEXT, start_date DATE)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
    table_name || '_' || to_char(start_date, 'YYYY_MM'),
    table_name,
    start_date,
    start_date + INTERVAL '1 month'
  );
END;
$$ LANGUAGE plpgsql;

-- 성능 메트릭 집계 뷰
CREATE VIEW performance_summary AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  endpoint,
  COUNT(*) as request_count,
  AVG(response_time) as avg_response_time,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95_response_time,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time) as p99_response_time,
  COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
  COUNT(CASE WHEN status_code >= 500 THEN 1 END) as server_error_count
FROM api_metrics
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), endpoint
ORDER BY hour DESC, avg_response_time DESC;

-- 느린 쿼리 뷰
CREATE VIEW slow_queries AS
SELECT 
  query_hash,
  query_type,
  table_name,
  COUNT(*) as execution_count,
  AVG(execution_time) as avg_execution_time,
  MAX(execution_time) as max_execution_time,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time) as p95_execution_time
FROM db_query_metrics
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY query_hash, query_type, table_name
HAVING AVG(execution_time) > 100 -- 100ms 이상
ORDER BY avg_execution_time DESC;

-- 사용자 활동 통계 뷰
CREATE VIEW user_activity_summary AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  feature,
  action,
  COUNT(*) as activity_count,
  COUNT(DISTINCT user_id) as unique_users
FROM user_activity_metrics
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), feature, action
ORDER BY hour DESC, activity_count DESC;

-- RLS 정책 설정
ALTER TABLE api_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_query_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- 관리자만 성능 메트릭에 접근 가능
CREATE POLICY "Admin access to api_metrics" ON api_metrics
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin access to db_query_metrics" ON db_query_metrics
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin access to system_metrics" ON system_metrics
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- 사용자는 자신의 활동 메트릭만 조회 가능
CREATE POLICY "Users can view own activity metrics" ON user_activity_metrics
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

-- 메트릭 데이터 자동 정리 함수
CREATE OR REPLACE FUNCTION cleanup_old_metrics()
RETURNS void AS $$
BEGIN
  -- 30일 이상 된 API 메트릭 삭제
  DELETE FROM api_metrics WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- 30일 이상 된 DB 쿼리 메트릭 삭제
  DELETE FROM db_query_metrics WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- 90일 이상 된 사용자 활동 메트릭 삭제
  DELETE FROM user_activity_metrics WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- 30일 이상 된 시스템 메트릭 삭제
  DELETE FROM system_metrics WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 매일 자정에 오래된 메트릭 정리
SELECT cron.schedule('cleanup-metrics', '0 0 * * *', 'SELECT cleanup_old_metrics();');