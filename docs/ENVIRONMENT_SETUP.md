# Environment Setup Guide

This document provides comprehensive instructions for setting up environment variables for both local development and Vercel production deployment.

## 📋 Required Environment Variables

### Essential Variables (Required for basic functionality)

#### Supabase Configuration
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**How to get these:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project or create a new one
3. Go to Settings → API
4. Copy the Project URL and anon public key
5. Copy the service_role secret key (keep this secure!)

## 🔧 Local Development Setup

### 1. Clone the repository and install dependencies
```bash
git clone https://github.com/SNU-SE/science-paper-manager.git
cd science-paper-manager
npm install
```

### 2. Set up local environment variables
```bash
# Copy the example file
cp .env.example .env.local

# Edit the file with your actual values
nano .env.local  # or use your preferred editor
```

### 3. Minimum configuration for local development
For basic functionality, you only need:
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Start the development server
```bash
npm run dev
```

## 🚀 Vercel Production Deployment

### Environment Variable Configuration in Vercel

1. **Go to your Vercel project dashboard**
2. **Navigate to Settings → Environment Variables**
3. **Add the following variables:**

#### Required Variables
```bash
NEXT_PUBLIC_SUPABASE_URL=your-production-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-supabase-anon-key  
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

#### Optional Features (add as needed)

**Google Drive Integration:**
```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_DRIVE_CLIENT_ID=your-google-drive-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-google-drive-client-secret
GOOGLE_DRIVE_REDIRECT_URI=https://your-domain.vercel.app/auth/google-drive/callback
```

**AI Analysis Features:**
```bash
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_AI_API_KEY=your-google-ai-key
```

### Vercel Environment Variable Settings

- **Environment:** Select `Production`, `Preview`, and `Development` as appropriate
- **Git Branch:** Usually `main` for production
- **Sensitive Variables:** Mark as sensitive for API keys and secrets

## 🔒 Security Best Practices

### Do NOT commit sensitive data
- Never commit `.env.local` or `.env.production` files
- Keep API keys and secrets secure
- Use different keys for development and production

### Environment Variable Hierarchy
1. `.env.local` (local development only)
2. `.env.development` (development environment)
3. `.env.production` (production environment)
4. `.env` (fallback for all environments)

## 🧪 Testing Your Setup

### 1. Verify Supabase Connection
```bash
npm run dev
```
Visit `http://localhost:3000` - you should see the application load without Supabase errors.

### 2. Check Environment Variables
Create a test API route to verify your configuration:
```typescript
// pages/api/test-env.ts (for testing only)
export default function handler(req, res) {
  res.json({
    supabaseConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    googleDriveConfigured: !!process.env.GOOGLE_CLIENT_ID,
    // Don't expose actual values!
  })
}
```

## 🚨 Common Issues and Solutions

### Issue: "Supabase configuration is missing"
**Solution:** Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly.

### Issue: Google Drive features not working
**Solution:** 
1. Verify Google Cloud Console setup
2. Ensure redirect URI matches exactly
3. Check if Google Drive API is enabled in your Google Cloud project

### Issue: AI analysis not working
**Solution:** 
1. Verify API keys are correct and have sufficient credits
2. Check API key permissions and usage limits

### Issue: Environment variables not loading in Vercel
**Solution:**
1. Ensure variables are added to the correct environment (Production/Preview)
2. Redeploy after adding new environment variables
3. Check that variable names match exactly (case-sensitive)

## 📞 Support

If you encounter issues with environment setup:

1. **Check the console:** Look for specific error messages
2. **Verify configuration:** Double-check all environment variable names and values
3. **Test incrementally:** Start with minimal config and add features one by one
4. **Check service status:** Ensure Supabase and other services are operational

## 🔄 Environment Updates

When adding new environment variables:

1. **Update `.env.example`** with new variables
2. **Update this documentation** 
3. **Add to Vercel dashboard** for production
4. **Update your local `.env.local`** file
5. **Restart development server** to pick up changes

---

*This setup guide ensures your Science Paper Manager application runs smoothly in both development and production environments.*