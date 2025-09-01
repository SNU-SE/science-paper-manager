-- Migration: Add background jobs support
-- Description: Creates tables for background job tracking and management

-- Background jobs table for tracking all job types
CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 0,
  data JSONB NOT NULL,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  result JSONB,
  error_message TEXT,
  error_stack TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Constraints
  CONSTRAINT valid_completion_time CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR 
    (status != 'completed' AND completed_at IS NULL)
  ),
  CONSTRAINT valid_start_time CHECK (
    (status IN ('processing', 'completed', 'failed') AND started_at IS NOT NULL) OR 
    (status NOT IN ('processing', 'completed', 'failed'))
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_type ON background_jobs(type);
CREATE INDEX IF NOT EXISTS idx_background_jobs_user_id ON background_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_created_at ON background_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_background_jobs_priority ON background_jobs(priority DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_background_jobs_user_status_type ON background_jobs(user_id, status, type);

-- Job progress tracking table for real-time updates
CREATE TABLE IF NOT EXISTS job_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES background_jobs(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100),
  message TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for job progress queries
CREATE INDEX IF NOT EXISTS idx_job_progress_job_id ON job_progress(job_id);
CREATE INDEX IF NOT EXISTS idx_job_progress_created_at ON job_progress(created_at);

-- Job failure tracking for analytics
CREATE TABLE IF NOT EXISTS job_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES background_jobs(id) ON DELETE CASCADE,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  error_code VARCHAR(50),
  is_retryable BOOLEAN DEFAULT true,
  paper_id UUID,
  providers TEXT[],
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for job failures
CREATE INDEX IF NOT EXISTS idx_job_failures_job_id ON job_failures(job_id);
CREATE INDEX IF NOT EXISTS idx_job_failures_user_id ON job_failures(user_id);
CREATE INDEX IF NOT EXISTS idx_job_failures_created_at ON job_failures(created_at);
CREATE INDEX IF NOT EXISTS idx_job_failures_error_code ON job_failures(error_code);

-- Function to update job status
CREATE OR REPLACE FUNCTION update_job_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update started_at when status changes to processing
  IF NEW.status = 'processing' AND OLD.status != 'processing' THEN
    NEW.started_at = now();
  END IF;
  
  -- Update completed_at when status changes to completed or failed
  IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
    NEW.completed_at = now();
  END IF;
  
  -- Increment attempts when status changes to processing
  IF NEW.status = 'processing' AND OLD.status = 'pending' THEN
    NEW.attempts = OLD.attempts + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic job status updates
DROP TRIGGER IF EXISTS trigger_update_job_status ON background_jobs;
CREATE TRIGGER trigger_update_job_status
  BEFORE UPDATE ON background_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_job_status();

-- Function to clean up old jobs
CREATE OR REPLACE FUNCTION cleanup_old_jobs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete completed jobs older than 7 days
  DELETE FROM background_jobs 
  WHERE status = 'completed' 
    AND completed_at < now() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete failed jobs older than 30 days
  DELETE FROM background_jobs 
  WHERE status = 'failed' 
    AND completed_at < now() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  -- Delete job progress entries older than 24 hours
  DELETE FROM job_progress 
  WHERE created_at < now() - INTERVAL '24 hours';
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_failures ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY "Users can view their own jobs" ON background_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs" ON background_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update jobs" ON background_jobs
  FOR UPDATE USING (true); -- System processes need to update job status

-- Job progress policies
CREATE POLICY "Users can view progress for their jobs" ON job_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM background_jobs 
      WHERE id = job_progress.job_id 
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert job progress" ON job_progress
  FOR INSERT WITH CHECK (true); -- System processes need to insert progress

-- Job failures policies
CREATE POLICY "Users can view their job failures" ON job_failures
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert job failures" ON job_failures
  FOR INSERT WITH CHECK (true); -- System processes need to insert failures

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON background_jobs TO authenticated;
GRANT SELECT, INSERT ON job_progress TO authenticated;
GRANT SELECT ON job_failures TO authenticated;

-- Grant system permissions (for service role)
GRANT ALL ON background_jobs TO service_role;
GRANT ALL ON job_progress TO service_role;
GRANT ALL ON job_failures TO service_role;

-- Comments for documentation
COMMENT ON TABLE background_jobs IS 'Tracks all background jobs including AI analysis, backups, etc.';
COMMENT ON TABLE job_progress IS 'Real-time progress tracking for background jobs';
COMMENT ON TABLE job_failures IS 'Detailed failure tracking for analytics and debugging';

COMMENT ON COLUMN background_jobs.type IS 'Job type: ai-analysis, backup, sync, etc.';
COMMENT ON COLUMN background_jobs.status IS 'Current job status';
COMMENT ON COLUMN background_jobs.priority IS 'Job priority (higher number = higher priority)';
COMMENT ON COLUMN background_jobs.data IS 'Job-specific data and parameters';
COMMENT ON COLUMN background_jobs.progress IS 'Job completion percentage (0-100)';
COMMENT ON COLUMN background_jobs.result IS 'Job result data when completed';