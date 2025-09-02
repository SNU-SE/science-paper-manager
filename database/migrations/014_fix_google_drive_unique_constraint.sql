-- Fix Google Drive settings unique constraint issue
-- The ON CONFLICT clause requires a unique constraint on user_id alone

-- Drop the existing composite unique constraint if it exists
ALTER TABLE user_google_drive_settings 
DROP CONSTRAINT IF EXISTS unique_active_user_config;

-- Drop the old unique constraint if it exists (in case of re-running)
ALTER TABLE user_google_drive_settings 
DROP CONSTRAINT IF EXISTS user_google_drive_settings_user_id_key;

-- Add a unique constraint on user_id alone
-- This ensures only one Google Drive configuration per user
ALTER TABLE user_google_drive_settings 
ADD CONSTRAINT user_google_drive_settings_user_id_key UNIQUE (user_id);

-- Create a unique index to ensure only one active configuration per user
-- This replaces the check constraint approach which doesn't support subqueries
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_google_drive_settings_active_user 
ON user_google_drive_settings(user_id) 
WHERE is_active = true;

-- Add a comment to explain the constraint
COMMENT ON INDEX idx_user_google_drive_settings_active_user IS 
'Ensures only one active Google Drive configuration per user';