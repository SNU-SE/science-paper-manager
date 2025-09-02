-- Fix Google Drive settings unique constraint issue
-- The ON CONFLICT clause requires a unique constraint on user_id alone

-- Drop the existing composite unique constraint
ALTER TABLE user_google_drive_settings 
DROP CONSTRAINT IF EXISTS unique_active_user_config;

-- Add a unique constraint on user_id alone
-- This ensures only one Google Drive configuration per user
ALTER TABLE user_google_drive_settings 
ADD CONSTRAINT user_google_drive_settings_user_id_key UNIQUE (user_id);

-- Optionally, if you want to keep track of multiple configurations but only one active
-- You can add this check constraint instead
ALTER TABLE user_google_drive_settings 
ADD CONSTRAINT check_single_active_config CHECK (
  NOT EXISTS (
    SELECT 1 FROM user_google_drive_settings ugs2 
    WHERE ugs2.user_id = user_google_drive_settings.user_id 
    AND ugs2.id != user_google_drive_settings.id 
    AND ugs2.is_active = true
    AND user_google_drive_settings.is_active = true
  )
) NOT VALID;

-- Validate the constraint after creation to avoid locking the table
ALTER TABLE user_google_drive_settings 
VALIDATE CONSTRAINT check_single_active_config;