-- Migration: Backup and Recovery System
-- Description: Creates tables for managing database backups, schedules, and recovery operations

-- 백업 기록 테이블
CREATE TABLE backup_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('full', 'incremental', 'differential')),
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'cancelled')),
  file_path TEXT NOT NULL,
  file_size BIGINT,
  checksum VARCHAR(64),
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- 인덱스
  CONSTRAINT backup_records_file_path_unique UNIQUE (file_path)
);

-- 백업 스케줄 테이블
CREATE TABLE backup_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('full', 'incremental', 'differential')),
  cron_expression VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  retention_days INTEGER DEFAULT 30,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- 제약 조건
  CONSTRAINT backup_schedules_name_unique UNIQUE (name),
  CONSTRAINT backup_schedules_retention_days_positive CHECK (retention_days > 0)
);

-- 백업 복구 로그 테이블
CREATE TABLE backup_restore_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_record_id UUID REFERENCES backup_records(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'cancelled')),
  restore_point TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  error_message TEXT,
  restored_tables TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 인덱스 생성
CREATE INDEX idx_backup_records_status ON backup_records(status);
CREATE INDEX idx_backup_records_type ON backup_records(type);
CREATE INDEX idx_backup_records_created_at ON backup_records(created_at);
CREATE INDEX idx_backup_schedules_is_active ON backup_schedules(is_active);
CREATE INDEX idx_backup_schedules_next_run_at ON backup_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX idx_backup_restore_logs_backup_record_id ON backup_restore_logs(backup_record_id);
CREATE INDEX idx_backup_restore_logs_status ON backup_restore_logs(status);

-- RLS 정책 (관리자만 접근 가능)
ALTER TABLE backup_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_restore_logs ENABLE ROW LEVEL SECURITY;

-- 관리자 권한 확인 함수
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- 실제 구현에서는 사용자 역할을 확인하는 로직 필요
  -- 현재는 인증된 사용자만 허용
  RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS 정책 생성
CREATE POLICY "Admin only access to backup_records" ON backup_records
  FOR ALL USING (is_admin());

CREATE POLICY "Admin only access to backup_schedules" ON backup_schedules
  FOR ALL USING (is_admin());

CREATE POLICY "Admin only access to backup_restore_logs" ON backup_restore_logs
  FOR ALL USING (is_admin());

-- 백업 정리 함수 (오래된 백업 파일 정리)
CREATE OR REPLACE FUNCTION cleanup_old_backups()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  backup_record RECORD;
BEGIN
  -- 보존 기간이 지난 백업 기록 찾기
  FOR backup_record IN
    SELECT br.id, br.file_path, bs.retention_days
    FROM backup_records br
    JOIN backup_schedules bs ON br.type = bs.type
    WHERE br.created_at < (now() - (bs.retention_days || ' days')::INTERVAL)
      AND br.status = 'completed'
  LOOP
    -- 백업 기록 삭제 (파일 삭제는 애플리케이션에서 처리)
    DELETE FROM backup_records WHERE id = backup_record.id;
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 백업 통계 뷰
CREATE VIEW backup_statistics AS
SELECT 
  type,
  COUNT(*) as total_backups,
  COUNT(*) FILTER (WHERE status = 'completed') as successful_backups,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_backups,
  AVG(duration_ms) FILTER (WHERE status = 'completed') as avg_duration_ms,
  SUM(file_size) FILTER (WHERE status = 'completed') as total_size_bytes,
  MAX(created_at) FILTER (WHERE status = 'completed') as last_successful_backup
FROM backup_records
GROUP BY type;

-- 백업 스케줄 트리거 (next_run_at 자동 계산)
CREATE OR REPLACE FUNCTION update_next_run_at()
RETURNS TRIGGER AS $$
BEGIN
  -- cron 표현식을 기반으로 다음 실행 시간 계산 (간단한 구현)
  -- 실제로는 cron 파서 라이브러리 사용 권장
  IF NEW.cron_expression = '0 2 * * *' THEN -- 매일 오전 2시
    NEW.next_run_at := date_trunc('day', now()) + INTERVAL '1 day' + INTERVAL '2 hours';
  ELSIF NEW.cron_expression = '0 2 * * 0' THEN -- 매주 일요일 오전 2시
    NEW.next_run_at := date_trunc('week', now()) + INTERVAL '1 week' + INTERVAL '2 hours';
  ELSIF NEW.cron_expression = '0 2 1 * *' THEN -- 매월 1일 오전 2시
    NEW.next_run_at := date_trunc('month', now()) + INTERVAL '1 month' + INTERVAL '2 hours';
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_next_run_at
  BEFORE INSERT OR UPDATE ON backup_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_next_run_at();

-- 기본 백업 스케줄 삽입
INSERT INTO backup_schedules (name, type, cron_expression, retention_days) VALUES
  ('Daily Full Backup', 'full', '0 2 * * *', 7),
  ('Weekly Full Backup', 'full', '0 2 * * 0', 30),
  ('Monthly Full Backup', 'full', '0 2 1 * *', 90);

-- 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON backup_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON backup_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON backup_restore_logs TO authenticated;
GRANT SELECT ON backup_statistics TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;