-- API Usage Tracking and Rate Limiting System
-- Migration: 010_api_usage_tracking.sql

-- API usage tracking table
CREATE TABLE api_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  provider VARCHAR(50), -- AI provider for analysis requests
  cost_units INTEGER DEFAULT 1, -- Cost in usage units
  request_size INTEGER, -- Request payload size in bytes
  response_size INTEGER, -- Response payload size in bytes
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Daily usage summary table for efficient querying
CREATE TABLE daily_usage_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_requests INTEGER DEFAULT 0,
  total_cost_units INTEGER DEFAULT 0,
  ai_analysis_requests INTEGER DEFAULT 0,
  search_requests INTEGER DEFAULT 0,
  upload_requests INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id, date)
);

-- User rate limits table
CREATE TABLE user_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  limit_type VARCHAR(50) NOT NULL, -- 'daily', 'hourly', 'monthly'
  endpoint_pattern VARCHAR(255), -- NULL for global limits
  max_requests INTEGER NOT NULL,
  max_cost_units INTEGER NOT NULL,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  current_requests INTEGER DEFAULT 0,
  current_cost_units INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id, limit_type, endpoint_pattern)
);

-- Suspicious activity detection table
CREATE TABLE suspicious_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- 'rate_limit_exceeded', 'unusual_pattern', 'burst_requests'
  severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Usage statistics aggregation table
CREATE TABLE usage_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type VARCHAR(20) NOT NULL, -- 'hour', 'day', 'week', 'month'
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  total_users INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  total_cost_units INTEGER DEFAULT 0,
  avg_requests_per_user DECIMAL(10,2) DEFAULT 0,
  top_endpoints JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(period_type, period_start)
);

-- Indexes for performance
CREATE INDEX idx_api_usage_tracking_user_id ON api_usage_tracking(user_id);
CREATE INDEX idx_api_usage_tracking_created_at ON api_usage_tracking(created_at);
CREATE INDEX idx_api_usage_tracking_endpoint ON api_usage_tracking(endpoint);
CREATE INDEX idx_api_usage_tracking_user_date ON api_usage_tracking(user_id, created_at);

CREATE INDEX idx_daily_usage_summary_user_date ON daily_usage_summary(user_id, date);
CREATE INDEX idx_daily_usage_summary_date ON daily_usage_summary(date);

CREATE INDEX idx_user_rate_limits_user_id ON user_rate_limits(user_id);
CREATE INDEX idx_user_rate_limits_active ON user_rate_limits(is_active) WHERE is_active = true;

CREATE INDEX idx_suspicious_activity_user_id ON suspicious_activity_log(user_id);
CREATE INDEX idx_suspicious_activity_unresolved ON suspicious_activity_log(is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_suspicious_activity_created_at ON suspicious_activity_log(created_at);

-- Partitioning for api_usage_tracking table (by month)
CREATE TABLE api_usage_tracking_y2024m01 PARTITION OF api_usage_tracking
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE api_usage_tracking_y2024m02 PARTITION OF api_usage_tracking
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Function to create monthly partitions automatically
CREATE OR REPLACE FUNCTION create_usage_tracking_partition(start_date DATE)
RETURNS VOID AS $$
DECLARE
  table_name TEXT;
  end_date DATE;
BEGIN
  table_name := 'api_usage_tracking_y' || to_char(start_date, 'YYYY') || 'm' || to_char(start_date, 'MM');
  end_date := start_date + INTERVAL '1 month';
  
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF api_usage_tracking FOR VALUES FROM (%L) TO (%L)',
    table_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Function to update daily usage summary
CREATE OR REPLACE FUNCTION update_daily_usage_summary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO daily_usage_summary (user_id, date, total_requests, total_cost_units, ai_analysis_requests, search_requests, upload_requests)
  VALUES (
    NEW.user_id,
    NEW.created_at::date,
    1,
    COALESCE(NEW.cost_units, 1),
    CASE WHEN NEW.endpoint LIKE '%ai-analysis%' THEN 1 ELSE 0 END,
    CASE WHEN NEW.endpoint LIKE '%search%' THEN 1 ELSE 0 END,
    CASE WHEN NEW.endpoint LIKE '%upload%' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    total_requests = daily_usage_summary.total_requests + 1,
    total_cost_units = daily_usage_summary.total_cost_units + COALESCE(NEW.cost_units, 1),
    ai_analysis_requests = daily_usage_summary.ai_analysis_requests + 
      CASE WHEN NEW.endpoint LIKE '%ai-analysis%' THEN 1 ELSE 0 END,
    search_requests = daily_usage_summary.search_requests + 
      CASE WHEN NEW.endpoint LIKE '%search%' THEN 1 ELSE 0 END,
    upload_requests = daily_usage_summary.upload_requests + 
      CASE WHEN NEW.endpoint LIKE '%upload%' THEN 1 ELSE 0 END,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update daily usage summary
CREATE TRIGGER trigger_update_daily_usage_summary
  AFTER INSERT ON api_usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_usage_summary();

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_endpoint VARCHAR(255),
  p_cost_units INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
  rate_limit_record RECORD;
  is_allowed BOOLEAN := true;
  limit_info JSONB := '{}';
BEGIN
  -- Check for specific endpoint limits first, then global limits
  FOR rate_limit_record IN 
    SELECT * FROM user_rate_limits 
    WHERE user_id = p_user_id 
      AND is_active = true 
      AND (endpoint_pattern IS NULL OR p_endpoint LIKE endpoint_pattern)
    ORDER BY endpoint_pattern NULLS LAST
  LOOP
    -- Reset window if needed
    IF rate_limit_record.limit_type = 'daily' AND 
       rate_limit_record.window_start::date < CURRENT_DATE THEN
      UPDATE user_rate_limits 
      SET current_requests = 0, 
          current_cost_units = 0, 
          window_start = CURRENT_DATE,
          updated_at = now()
      WHERE id = rate_limit_record.id;
      rate_limit_record.current_requests := 0;
      rate_limit_record.current_cost_units := 0;
    ELSIF rate_limit_record.limit_type = 'hourly' AND 
          rate_limit_record.window_start < date_trunc('hour', now()) THEN
      UPDATE user_rate_limits 
      SET current_requests = 0, 
          current_cost_units = 0, 
          window_start = date_trunc('hour', now()),
          updated_at = now()
      WHERE id = rate_limit_record.id;
      rate_limit_record.current_requests := 0;
      rate_limit_record.current_cost_units := 0;
    END IF;
    
    -- Check if limit would be exceeded
    IF rate_limit_record.current_requests + 1 > rate_limit_record.max_requests OR
       rate_limit_record.current_cost_units + p_cost_units > rate_limit_record.max_cost_units THEN
      is_allowed := false;
      limit_info := jsonb_build_object(
        'allowed', false,
        'limit_type', rate_limit_record.limit_type,
        'max_requests', rate_limit_record.max_requests,
        'current_requests', rate_limit_record.current_requests,
        'max_cost_units', rate_limit_record.max_cost_units,
        'current_cost_units', rate_limit_record.current_cost_units,
        'window_start', rate_limit_record.window_start,
        'endpoint_pattern', rate_limit_record.endpoint_pattern
      );
      EXIT;
    END IF;
  END LOOP;
  
  -- If allowed, update the counters
  IF is_allowed THEN
    UPDATE user_rate_limits 
    SET current_requests = current_requests + 1,
        current_cost_units = current_cost_units + p_cost_units,
        updated_at = now()
    WHERE user_id = p_user_id 
      AND is_active = true 
      AND (endpoint_pattern IS NULL OR p_endpoint LIKE endpoint_pattern);
    
    limit_info := jsonb_build_object('allowed', true);
  END IF;
  
  RETURN limit_info;
END;
$$ LANGUAGE plpgsql;

-- Function to detect suspicious activity patterns
CREATE OR REPLACE FUNCTION detect_suspicious_activity(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  recent_requests INTEGER;
  burst_threshold INTEGER := 100; -- requests per minute
  daily_requests INTEGER;
  daily_threshold INTEGER := 1000; -- requests per day
BEGIN
  -- Check for burst requests (too many requests in short time)
  SELECT COUNT(*) INTO recent_requests
  FROM api_usage_tracking
  WHERE user_id = p_user_id 
    AND created_at > now() - INTERVAL '1 minute';
  
  IF recent_requests > burst_threshold THEN
    INSERT INTO suspicious_activity_log (user_id, activity_type, severity, description, metadata)
    VALUES (
      p_user_id,
      'burst_requests',
      'high',
      format('User made %s requests in the last minute, exceeding threshold of %s', recent_requests, burst_threshold),
      jsonb_build_object('requests_per_minute', recent_requests, 'threshold', burst_threshold)
    );
  END IF;
  
  -- Check for unusual daily volume
  SELECT COUNT(*) INTO daily_requests
  FROM api_usage_tracking
  WHERE user_id = p_user_id 
    AND created_at::date = CURRENT_DATE;
  
  IF daily_requests > daily_threshold THEN
    INSERT INTO suspicious_activity_log (user_id, activity_type, severity, description, metadata)
    VALUES (
      p_user_id,
      'unusual_pattern',
      'medium',
      format('User made %s requests today, exceeding normal threshold of %s', daily_requests, daily_threshold),
      jsonb_build_object('daily_requests', daily_requests, 'threshold', daily_threshold)
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Insert default rate limits for new users
CREATE OR REPLACE FUNCTION create_default_rate_limits()
RETURNS TRIGGER AS $$
BEGIN
  -- Daily global limit
  INSERT INTO user_rate_limits (user_id, limit_type, max_requests, max_cost_units)
  VALUES (NEW.id, 'daily', 1000, 500);
  
  -- Hourly global limit
  INSERT INTO user_rate_limits (user_id, limit_type, max_requests, max_cost_units)
  VALUES (NEW.id, 'hourly', 100, 50);
  
  -- Daily AI analysis limit
  INSERT INTO user_rate_limits (user_id, limit_type, endpoint_pattern, max_requests, max_cost_units)
  VALUES (NEW.id, 'daily', '%ai-analysis%', 50, 100);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default rate limits for new users
CREATE TRIGGER trigger_create_default_rate_limits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_rate_limits();

-- RLS Policies
ALTER TABLE api_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_statistics ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage data
CREATE POLICY "Users can view own usage tracking" ON api_usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own daily summary" ON daily_usage_summary
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own rate limits" ON user_rate_limits
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can see all data
CREATE POLICY "Admins can view all usage data" ON api_usage_tracking
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all rate limits" ON user_rate_limits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can view suspicious activity" ON suspicious_activity_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can view usage statistics" ON usage_statistics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- System can insert usage tracking data
CREATE POLICY "System can insert usage tracking" ON api_usage_tracking
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update daily summary" ON daily_usage_summary
  FOR ALL WITH CHECK (true);

CREATE POLICY "System can insert suspicious activity" ON suspicious_activity_log
  FOR INSERT WITH CHECK (true);