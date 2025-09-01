-- Security Enhancement Migration
-- This migration adds tables and functions for enhanced security features

-- User sessions table for secure session management
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  fingerprint VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CSRF tokens table
CREATE TABLE IF NOT EXISTS csrf_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) NOT NULL UNIQUE,
  session_id VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User security status table for account locking
CREATE TABLE IF NOT EXISTS user_security_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  is_locked BOOLEAN DEFAULT false,
  lock_reason TEXT,
  locked_at TIMESTAMP WITH TIME ZONE,
  lock_expires_at TIMESTAMP WITH TIME ZONE,
  failed_login_attempts INTEGER DEFAULT 0,
  last_failed_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Security logs table for audit trail
CREATE TABLE IF NOT EXISTS security_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  risk_level VARCHAR(20) DEFAULT 'low',
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Encrypted API keys table (enhanced version)
CREATE TABLE IF NOT EXISTS user_encrypted_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  encrypted_value TEXT NOT NULL,
  iv VARCHAR(32) NOT NULL,
  salt VARCHAR(32) NOT NULL,
  hash VARCHAR(64) NOT NULL,
  auth_tag VARCHAR(32) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(user_id, provider)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_csrf_tokens_token ON csrf_tokens(token);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_session_id ON csrf_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires_at ON csrf_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_security_status_user_id ON user_security_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_security_status_is_locked ON user_security_status(is_locked);

CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_action ON security_logs(action);
CREATE INDEX IF NOT EXISTS idx_security_logs_risk_level ON security_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_user_encrypted_api_keys_user_id ON user_encrypted_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_encrypted_api_keys_provider ON user_encrypted_api_keys(provider);

-- Partitioning for security_logs (by month for better performance)
-- Create partitions for current and next few months
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    -- Create partitions for the next 12 months
    FOR i IN 0..11 LOOP
        start_date := date_trunc('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'security_logs_' || to_char(start_date, 'YYYY_MM');
        
        -- Check if partition already exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_class WHERE relname = partition_name
        ) THEN
            EXECUTE format('CREATE TABLE %I PARTITION OF security_logs FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date);
        END IF;
    END LOOP;
END $$;

-- RLS Policies for security
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE csrf_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_security_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_encrypted_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_sessions
CREATE POLICY "Users can view their own sessions" ON user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON user_sessions
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all sessions" ON user_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for user_security_status
CREATE POLICY "Users can view their own security status" ON user_security_status
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all security status" ON user_security_status
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for security_logs
CREATE POLICY "Users can view their own security logs" ON security_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all security logs" ON security_logs
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for user_encrypted_api_keys
CREATE POLICY "Users can manage their own encrypted API keys" ON user_encrypted_api_keys
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all encrypted API keys" ON user_encrypted_api_keys
  FOR ALL USING (auth.role() = 'service_role');

-- Functions for security operations

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions WHERE expires_at < now();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    DELETE FROM csrf_tokens WHERE expires_at < now();
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update session last accessed time
CREATE OR REPLACE FUNCTION update_session_access(session_token_hash TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE user_sessions 
    SET last_accessed_at = now() 
    WHERE token_hash = session_token_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment failed login attempts
CREATE OR REPLACE FUNCTION increment_failed_login_attempts(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_security_status (user_id, failed_login_attempts, last_failed_login_at)
    VALUES (user_uuid, 1, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        failed_login_attempts = user_security_status.failed_login_attempts + 1,
        last_failed_login_at = now(),
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset failed login attempts on successful login
CREATE OR REPLACE FUNCTION reset_failed_login_attempts(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE user_security_status 
    SET 
        failed_login_attempts = 0,
        last_failed_login_at = NULL,
        updated_at = now()
    WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if account should be locked due to failed attempts
CREATE OR REPLACE FUNCTION should_lock_account(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    attempts INTEGER;
    last_attempt TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT failed_login_attempts, last_failed_login_at 
    INTO attempts, last_attempt
    FROM user_security_status 
    WHERE user_id = user_uuid;
    
    -- Lock if more than 5 failed attempts in the last 15 minutes
    IF attempts >= 5 AND last_attempt > (now() - INTERVAL '15 minutes') THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to relevant tables
CREATE TRIGGER update_user_security_status_updated_at
    BEFORE UPDATE ON user_security_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_encrypted_api_keys_updated_at
    BEFORE UPDATE ON user_encrypted_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a scheduled job to clean up expired data (requires pg_cron extension)
-- This would typically be set up separately in production
-- SELECT cron.schedule('cleanup-expired-security-data', '0 2 * * *', 'SELECT cleanup_expired_sessions();');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON csrf_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_security_status TO authenticated;
GRANT SELECT, INSERT ON security_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_encrypted_api_keys TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION update_session_access(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION increment_failed_login_attempts(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION reset_failed_login_attempts(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION should_lock_account(UUID) TO service_role;

-- Comments for documentation
COMMENT ON TABLE user_sessions IS 'Secure session management with fingerprinting';
COMMENT ON TABLE csrf_tokens IS 'CSRF tokens for request validation';
COMMENT ON TABLE user_security_status IS 'User account security status and locking';
COMMENT ON TABLE security_logs IS 'Audit trail for security events';
COMMENT ON TABLE user_encrypted_api_keys IS 'AES-256 encrypted API keys storage';

COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Removes expired sessions and CSRF tokens';
COMMENT ON FUNCTION update_session_access(TEXT) IS 'Updates last accessed time for session';
COMMENT ON FUNCTION increment_failed_login_attempts(UUID) IS 'Increments failed login counter';
COMMENT ON FUNCTION reset_failed_login_attempts(UUID) IS 'Resets failed login counter on success';
COMMENT ON FUNCTION should_lock_account(UUID) IS 'Determines if account should be locked';