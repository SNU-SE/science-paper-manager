-- Create user_google_drive_settings table for individual user API configurations
CREATE TABLE IF NOT EXISTS user_google_drive_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL, -- Encrypted in production
  redirect_uri TEXT NOT NULL,
  refresh_token TEXT, -- Obtained after OAuth flow
  access_token TEXT,
  token_expiry TIMESTAMP WITH TIME ZONE,
  root_folder_id TEXT, -- Optional: specific folder for this user
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure one active configuration per user
  CONSTRAINT unique_active_user_config UNIQUE (user_id, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_user_google_drive_settings_user_id ON user_google_drive_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_google_drive_settings_active ON user_google_drive_settings(user_id, is_active) WHERE is_active = true;

-- RLS (Row Level Security) policies
ALTER TABLE user_google_drive_settings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own settings
CREATE POLICY "Users can view own Google Drive settings" ON user_google_drive_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Google Drive settings" ON user_google_drive_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Google Drive settings" ON user_google_drive_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own Google Drive settings" ON user_google_drive_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_google_drive_settings_updated_at
    BEFORE UPDATE ON user_google_drive_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();