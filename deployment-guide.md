# Deployment Guide for Science Paper Manager

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Supabase Project**: Create a project at [supabase.com](https://supabase.com)
3. **AI Service API Keys**: Obtain keys from OpenAI, Anthropic, xAI, and/or Gemini
4. **Google Cloud Project**: For Google Drive integration (optional)
5. **Zotero API Key**: For Zotero sync (optional)

## Environment Variables Setup

### Required Variables

Set these in your Vercel project dashboard under Settings > Environment Variables:

```bash
# Database (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication (Required)
NEXTAUTH_SECRET=your_random_secret_string
NEXTAUTH_URL=https://your-app.vercel.app
```

### Optional Variables

```bash
# AI Services (Users can also set their own keys in the app)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
XAI_API_KEY=xai-...
GEMINI_API_KEY=AIza...

# Google Drive Integration
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/google-drive/auth

# Zotero Integration
ZOTERO_API_KEY=your_zotero_key
ZOTERO_USER_ID=your_zotero_user_id

# Analytics and Monitoring
NEXT_PUBLIC_ANALYTICS_ID=your_analytics_id
SENTRY_DSN=your_sentry_dsn
```

## Deployment Steps

### 1. Database Setup

1. Create a new Supabase project
2. Enable the pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Run the database migration:
   ```bash
   npm run db:migrate
   ```

### 2. Vercel Deployment

#### Option A: Deploy from GitHub

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically

#### Option B: Deploy with Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel --prod
   ```

### 3. Post-Deployment Configuration

1. **Domain Setup**: Configure your custom domain in Vercel
2. **SSL Certificate**: Vercel provides automatic SSL
3. **Analytics**: Enable Vercel Analytics if desired
4. **Monitoring**: Set up error tracking with Sentry

## Performance Optimizations

### Vercel Configuration

The `vercel.json` file includes:
- Function timeout configurations for AI operations
- Static asset caching headers
- API response caching
- Regional deployment settings

### Database Optimizations

1. **Indexes**: Ensure proper indexes are created:
   ```sql
   CREATE INDEX CONCURRENTLY idx_papers_reading_status ON papers(reading_status);
   CREATE INDEX CONCURRENTLY documents_embedding_idx ON documents 
   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
   ```

2. **Connection Pooling**: Supabase handles this automatically

### CDN and Caching

- Static assets are cached for 1 year
- API responses cached for 5 minutes with stale-while-revalidate
- Client-side caching with React Query

## Monitoring and Analytics

### Performance Monitoring

The app includes built-in performance monitoring:
- Core Web Vitals tracking
- API response time monitoring
- Memory usage tracking
- Bundle size analysis

### Error Tracking

Set up Sentry for error tracking:
1. Create a Sentry project
2. Add SENTRY_DSN to environment variables
3. Errors are automatically captured and reported

### Analytics

Optional analytics integration:
- Vercel Analytics (privacy-focused)
- Custom analytics with performance metrics
- User interaction tracking (privacy-compliant)

## Security Considerations

### API Keys

- Store sensitive keys in Vercel environment variables
- Never commit API keys to git
- Use different keys for development and production
- Implement rate limiting for API endpoints

### Database Security

- Use Row Level Security (RLS) in Supabase
- Limit database access with service role key
- Regular security updates

### Content Security Policy

The app includes CSP headers for security:
```javascript
// In next.config.ts
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline';"
  }
]
```

## Scaling Considerations

### Database Scaling

- Supabase automatically handles connection pooling
- Consider upgrading to Pro plan for higher limits
- Monitor database performance in Supabase dashboard

### Function Limits

- Vercel Hobby: 10s timeout, 1GB memory
- Vercel Pro: 60s timeout, 3GB memory
- AI analysis functions may need Pro plan

### Cost Management

- Monitor AI API usage and costs
- Implement usage limits per user
- Cache AI responses to reduce API calls
- Use Vercel Analytics to track usage patterns

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check environment variables are set
   - Verify all dependencies are installed
   - Check TypeScript errors

2. **Database Connection Issues**
   - Verify Supabase URL and keys
   - Check database is accessible
   - Ensure pgvector extension is enabled

3. **AI Service Errors**
   - Verify API keys are valid
   - Check rate limits and quotas
   - Monitor error logs in Vercel

### Debug Mode

Enable debug logging:
```bash
# In Vercel environment variables
DEBUG=true
NEXT_PUBLIC_DEBUG=true
```

## Maintenance

### Regular Tasks

1. **Update Dependencies**: Monthly security updates
2. **Monitor Performance**: Weekly performance reviews
3. **Database Maintenance**: Monitor query performance
4. **Cost Review**: Monthly cost analysis
5. **Security Audit**: Quarterly security reviews

### Backup Strategy

- Supabase provides automatic backups
- Export important data regularly
- Test restore procedures

## Support

For deployment issues:
1. Check Vercel deployment logs
2. Review Supabase logs
3. Monitor error tracking in Sentry
4. Check performance metrics

Remember to never commit sensitive environment variables to version control!