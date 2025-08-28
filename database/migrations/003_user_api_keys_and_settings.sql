-- Create user_api_keys table for storing encrypted API keys
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'xai', 'gemini'
  api_key_encrypted TEXT NOT NULL, -- Encrypted API key
  api_key_hash TEXT NOT NULL, -- Hash for verification without decryption
  is_valid BOOLEAN DEFAULT false, -- Validated status
  last_validated_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure one key per provider per user
  CONSTRAINT unique_user_provider_key UNIQUE (user_id, provider)
);

-- Create user_ai_model_preferences table for AI model settings
CREATE TABLE IF NOT EXISTS user_ai_model_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'xai', 'gemini'
  model_name VARCHAR(100) NOT NULL, -- e.g., 'gpt-4', 'claude-3-sonnet'
  is_default BOOLEAN DEFAULT false, -- Default model for this provider
  parameters JSONB DEFAULT '{}', -- Model parameters (temperature, max_tokens, etc.)
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure unique combination of user, provider, and model
  CONSTRAINT unique_user_provider_model UNIQUE (user_id, provider, model_name)
);

-- Create user_zotero_settings table for Zotero API configuration
CREATE TABLE IF NOT EXISTS user_zotero_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_encrypted TEXT NOT NULL, -- Encrypted Zotero API key
  user_id_zotero VARCHAR(50) NOT NULL, -- Zotero user ID
  library_type VARCHAR(20) DEFAULT 'user', -- 'user' or 'group'
  library_id VARCHAR(50), -- Group library ID if applicable
  auto_sync BOOLEAN DEFAULT false,
  sync_interval INTEGER DEFAULT 3600, -- Sync interval in seconds
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(20) DEFAULT 'inactive', -- 'inactive', 'syncing', 'completed', 'failed'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Only one active Zotero config per user (handled in application logic)
  CONSTRAINT unique_user_zotero UNIQUE (user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider ON user_api_keys(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_valid ON user_api_keys(user_id, provider, is_valid) WHERE is_valid = true;

CREATE INDEX IF NOT EXISTS idx_user_ai_model_prefs_user_id ON user_ai_model_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_model_prefs_provider ON user_ai_model_preferences(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_user_ai_model_prefs_default ON user_ai_model_preferences(user_id, provider, is_default) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_user_zotero_settings_user_id ON user_zotero_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_zotero_settings_active ON user_zotero_settings(user_id, is_active) WHERE is_active = true;

-- Enable RLS (Row Level Security) for all tables
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ai_model_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_zotero_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_api_keys
CREATE POLICY "Users can view own API keys" ON user_api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys" ON user_api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys" ON user_api_keys
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys" ON user_api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for user_ai_model_preferences
CREATE POLICY "Users can view own AI model preferences" ON user_ai_model_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI model preferences" ON user_ai_model_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI model preferences" ON user_ai_model_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own AI model preferences" ON user_ai_model_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for user_zotero_settings
CREATE POLICY "Users can view own Zotero settings" ON user_zotero_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Zotero settings" ON user_zotero_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Zotero settings" ON user_zotero_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own Zotero settings" ON user_zotero_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Triggers to automatically update updated_at timestamps
CREATE TRIGGER update_user_api_keys_updated_at
    BEFORE UPDATE ON user_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_ai_model_preferences_updated_at
    BEFORE UPDATE ON user_ai_model_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_zotero_settings_updated_at
    BEFORE UPDATE ON user_zotero_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one default model per provider per user
CREATE OR REPLACE FUNCTION ensure_single_default_model() 
RETURNS TRIGGER AS $$
BEGIN
  -- If the new/updated record is set as default
  IF NEW.is_default = true THEN
    -- Unset other defaults for the same user and provider
    UPDATE user_ai_model_preferences 
    SET is_default = false, updated_at = now()
    WHERE user_id = NEW.user_id 
      AND provider = NEW.provider 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain single default model per provider per user
CREATE TRIGGER trigger_ensure_single_default_model
  BEFORE INSERT OR UPDATE ON user_ai_model_preferences
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_model();

-- Note: Default model preferences will be created through the application
-- when users first configure their API keys