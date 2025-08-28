# Science Paper Manager - Vercel Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Science Paper Manager application to Vercel with complete database configuration and all necessary integrations.

## Prerequisites

Before starting the deployment process, ensure you have:

- [ ] **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
- [ ] **Supabase Account**: Create account at [supabase.com](https://supabase.com)
- [ ] **GitHub Repository**: Code pushed to GitHub (recommended)
- [ ] **Domain Name** (optional): For custom domain setup

## Step 1: Database Setup (Supabase)

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `science-paper-manager`
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for project initialization (2-3 minutes)

### 1.2 Enable Required Extensions

1. In your Supabase dashboard, go to **Database** → **Extensions**
2. Search for and enable:
   - `vector` (for semantic search)
   - `uuid-ossp` (for UUID generation)

### 1.3 Run Database Migrations

1. In Supabase dashboard, go to **SQL Editor**
2. Copy and paste the contents from `database/schema.sql`
3. Click "Run" to execute the migration
4. Verify tables are created in **Database** → **Tables**

### 1.4 Configure Row Level Security (RLS)

1. In **Database** → **Tables**, for each table:
2. Click on table name → **Settings** → **Row Level Security**
3. Enable RLS for all tables
4. Add policies as needed (basic read/write for authenticated users)

### 1.5 Get Database Credentials

1. Go to **Settings** → **API**
2. Copy these values (you'll need them later):
   - **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`)
   - **anon public key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **service_role secret key** (`SUPABASE_SERVICE_ROLE_KEY`)

## Step 2: Prepare Environment Variables

### 2.1 Required Environment Variables

Create a list of environment variables you'll need to set in Vercel:

```bash
# Database Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Authentication (Required)
NEXTAUTH_SECRET=your_random_32_character_secret
NEXTAUTH_URL=https://your-app-name.vercel.app

# Node Environment
NODE_ENV=production
```

### 2.2 Optional Environment Variables

```bash
# AI Service Keys (Users can also set these in-app)
OPENAI_API_KEY=sk-your_openai_key
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
XAI_API_KEY=xai-your_xai_key
GEMINI_API_KEY=AIza-your_gemini_key

# Google Drive Integration (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-app-name.vercel.app/api/google-drive/callback

# Zotero Integration (Optional)
ZOTERO_API_KEY=your_zotero_api_key
ZOTERO_USER_ID=your_zotero_user_id

# Analytics (Optional)
NEXT_PUBLIC_ANALYTICS_ID=your_analytics_id
```

### 2.3 Generate NEXTAUTH_SECRET

Generate a secure secret:
```bash
# Option 1: Using OpenSSL
openssl rand -base64 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Online generator
# Visit: https://generate-secret.vercel.app/32
```

## Step 3: Deploy to Vercel

### Option A: Deploy via GitHub (Recommended)

#### 3.1 Push Code to GitHub

1. Ensure your code is pushed to a GitHub repository
2. Make sure the repository is public or you have Vercel access

#### 3.2 Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Select the `science-paper-manager` folder as the root directory
5. Vercel will auto-detect it's a Next.js project

#### 3.3 Configure Build Settings

Vercel should auto-detect these settings, but verify:
- **Framework Preset**: Next.js
- **Root Directory**: `science-paper-manager` (if in subfolder)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm ci`

#### 3.4 Add Environment Variables

1. In the deployment configuration, click "Environment Variables"
2. Add all the required variables from Step 2.1
3. Add optional variables as needed
4. Make sure to select the correct environment (Production, Preview, Development)

#### 3.5 Deploy

1. Click "Deploy"
2. Wait for build to complete (5-10 minutes)
3. Vercel will provide a deployment URL

### Option B: Deploy via Vercel CLI

#### 3.1 Install Vercel CLI

```bash
npm install -g vercel
```

#### 3.2 Login to Vercel

```bash
vercel login
```

#### 3.3 Navigate to Project Directory

```bash
cd science-paper-manager
```

#### 3.4 Deploy

```bash
# For production deployment
vercel --prod

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No
# - What's your project's name? science-paper-manager
# - In which directory is your code located? ./
```

#### 3.5 Set Environment Variables via CLI

```bash
# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production

# Add optional variables as needed
vercel env add OPENAI_API_KEY production
```

## Step 4: Post-Deployment Configuration

### 4.1 Update NEXTAUTH_URL

1. After deployment, update the `NEXTAUTH_URL` environment variable
2. Set it to your actual Vercel deployment URL
3. Redeploy if necessary

### 4.2 Configure Custom Domain (Optional)

1. In Vercel dashboard, go to your project
2. Click **Settings** → **Domains**
3. Add your custom domain
4. Follow DNS configuration instructions
5. Update `NEXTAUTH_URL` to use custom domain

### 4.3 Test Database Connection

1. Visit your deployed app
2. Try to access the dashboard
3. Check if database operations work
4. Monitor Vercel function logs for any errors

### 4.4 Configure AI Services (Optional)

If you didn't set AI API keys as environment variables:
1. Visit your deployed app
2. Go to Settings → AI Configuration
3. Add your API keys through the UI
4. Test AI analysis functionality

## Step 5: Verification and Testing

### 5.1 Functional Testing

Test these core features:
- [ ] User authentication/login
- [ ] Paper upload and management
- [ ] Search functionality
- [ ] AI analysis (if configured)
- [ ] Database operations
- [ ] Performance monitoring

### 5.2 Performance Testing

1. Check Core Web Vitals in Vercel Analytics
2. Test page load speeds
3. Monitor API response times
4. Check memory usage in function logs

### 5.3 Error Monitoring

1. Check Vercel function logs for errors
2. Test error boundaries
3. Verify error reporting works

## Step 6: Monitoring and Maintenance

### 6.1 Enable Vercel Analytics

1. In Vercel dashboard, go to your project
2. Click **Analytics** tab
3. Enable Web Analytics
4. Monitor performance metrics

### 6.2 Set Up Alerts

1. Configure deployment notifications
2. Set up error rate alerts
3. Monitor function timeout alerts

### 6.3 Regular Maintenance

- **Weekly**: Check performance metrics
- **Monthly**: Review and update dependencies
- **Quarterly**: Security audit and updates

## Troubleshooting

### Common Issues and Solutions

#### Build Failures

**Problem**: Build fails with dependency errors
**Solution**: 
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Problem**: TypeScript errors during build
**Solution**: Check and fix TypeScript errors locally first

#### Database Connection Issues

**Problem**: Cannot connect to Supabase
**Solution**: 
1. Verify environment variables are correct
2. Check Supabase project is active
3. Ensure database URL is accessible

#### Function Timeouts

**Problem**: AI analysis functions timeout
**Solution**: 
1. Upgrade to Vercel Pro for longer timeouts
2. Optimize AI service calls
3. Implement request queuing

#### Environment Variable Issues

**Problem**: Environment variables not working
**Solution**:
1. Ensure variables are set for correct environment
2. Redeploy after adding variables
3. Check variable names match exactly

### Getting Help

1. **Vercel Support**: Check Vercel documentation and support
2. **Supabase Support**: Use Supabase community and docs
3. **Project Issues**: Check GitHub issues or create new ones

## Security Checklist

Before going live:
- [ ] All API keys are stored as environment variables
- [ ] Database has proper RLS policies
- [ ] HTTPS is enabled (automatic with Vercel)
- [ ] No sensitive data in client-side code
- [ ] Rate limiting is configured
- [ ] Error messages don't expose sensitive information

## Performance Optimization

### Recommended Settings

1. **Vercel Configuration**: The `vercel.json` is already optimized
2. **Database Indexes**: Ensure proper indexes are created
3. **Caching**: API responses are cached appropriately
4. **Bundle Size**: Monitor and optimize bundle size

### Monitoring

1. Use Vercel Analytics for performance insights
2. Monitor Core Web Vitals
3. Track API response times
4. Monitor database query performance

---

## Quick Reference

### Essential URLs
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Your App**: https://your-app-name.vercel.app

### Key Commands
```bash
# Deploy to production
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs

# Add environment variable
vercel env add VARIABLE_NAME production
```

### Support Resources
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Note**: Keep this guide updated as you make changes to the deployment process or add new features to the application.