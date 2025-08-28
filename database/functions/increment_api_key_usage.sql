-- Function to safely increment API key usage count
CREATE OR REPLACE FUNCTION increment_api_key_usage(p_user_id UUID, p_provider VARCHAR)
RETURNS void AS $$
BEGIN
    UPDATE user_api_keys 
    SET usage_count = usage_count + 1,
        updated_at = now()
    WHERE user_id = p_user_id 
    AND provider = p_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;