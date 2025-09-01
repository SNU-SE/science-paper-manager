# Science Paper Manager - Deployment Guide

This guide covers the deployment of Science Paper Manager in various environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Development Setup](#development-setup)
4. [Production Deployment](#production-deployment)
5. [Docker Deployment](#docker-deployment)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: Version 18 or later
- **npm**: Version 8 or later
- **Docker**: Version 20.10 or later (for containerized deployment)
- **Docker Compose**: Version 2.0 or later
- **Redis**: Version 6 or later
- **PostgreSQL**: Version 13 or later (via Supabase)

### External Services

- **Supabase**: Database and authentication
- **Redis**: Caching and job queue
- **AI Services** (optional):
  - OpenAI API
  - Anthropic Claude API
  - Google Gemini API
- **Google Drive API** (optional): For file uploads
- **SMTP Server** (optional): For email notifications

## Environment Configuration

### 1. Copy Environment Template

```bash
# For development
cp .env.example .env.local

# For production
cp .env.production .env.production.local
```

### 2. Configure Required Variables

#### Core Configuration

```bash
# Application
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_URL=postgresql://your-db-connection-string

# Redis
REDIS_URL=redis://your-redis-host:6379
REDIS_PASSWORD=your-secure-password

# Security
NEXTAUTH_SECRET=your-32-character-secret
ENCRYPTION_KEY=your-32-character-encryption-key
```

#### Optional Services

```bash
# AI Services
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_AI_API_KEY=your-google-ai-key

# Google Drive
GOOGLE_DRIVE_CLIENT_ID=your-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret
```

### 3. Validate Configuration

```bash
npm run validate-env
```

## Development Setup

### Quick Start

```bash
# Run the setup script
npm run setup:dev

# Start development server
npm run dev

# Start worker process (in another terminal)
npm run worker:dev
```

### Manual Setup

```bash
# Install dependencies
npm ci

# Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# Start Redis (using Docker)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Set up database
npm run setup-db:optimized

# Start development server
npm run dev
```

### Development with Docker

```bash
# Start all development services
npm run docker:dev

# View logs
npm run docker:logs

# Stop services
npm run docker:dev:down
```

## Production Deployment

### Option 1: Docker Deployment (Recommended)

#### 1. Prepare Environment

```bash
# Create production environment file
cp .env.production .env.production.local
# Edit with your production values

# Create necessary directories
sudo mkdir -p /opt/science-paper-manager/{logs,backups,redis-data}
sudo chown -R $USER:$USER /opt/science-paper-manager
```

#### 2. Deploy

```bash
# Run deployment script
npm run deploy:prod

# Or manually
docker-compose -f docker-compose.prod.yml up -d
```

#### 3. Verify Deployment

```bash
# Check service health
npm run health:check

# Monitor system
npm run monitor
```

### Option 2: Manual Deployment

#### 1. Build Application

```bash
# Install production dependencies
npm ci --only=production

# Build application
npm run build
```

#### 2. Set up Services

```bash
# Start Redis
redis-server /path/to/redis.conf

# Set up database
npm run setup-db:optimized

# Start application
npm start

# Start worker processes (in separate terminals)
npm run worker
```

### Option 3: Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
npm run deploy:preview

# Deploy to production
npm run deploy:vercel
```

**Note**: For Vercel deployment, you'll need to set up Redis and background workers separately.

## Docker Deployment

### Production Configuration

The production setup includes:

- **Web Application**: Main Next.js application
- **Worker Processes**: Background job processing (3 replicas)
- **Redis**: Caching and job queue with persistence
- **WebSocket Server**: Real-time notifications
- **Nginx**: Reverse proxy with SSL termination (optional)

### Services Overview

```yaml
services:
  web:        # Main application (port 3000)
  worker:     # Background workers (3 replicas)
  websocket:  # WebSocket server (port 3001)
  redis:      # Redis server (port 6379)
  nginx:      # Reverse proxy (ports 80, 443)
```

### Scaling Workers

```bash
# Scale worker processes
docker-compose -f docker-compose.prod.yml up -d --scale worker=5
```

### SSL Configuration

1. Place SSL certificates in `config/ssl/`:
   - `cert.pem`: SSL certificate
   - `key.pem`: Private key

2. Update `config/nginx.conf` with your domain name

3. Enable nginx profile:
   ```bash
   docker-compose -f docker-compose.prod.yml --profile nginx up -d
   ```

## Monitoring and Maintenance

### Health Checks

```bash
# Check system health
npm run health:check

# Monitor resources
npm run monitor

# View application logs
docker-compose logs -f web

# View worker logs
docker-compose logs -f worker
```

### Backup Management

```bash
# Manual backup
curl -X POST http://localhost:3000/api/backup

# View backup status
curl http://localhost:3000/api/backup

# Restore from backup
curl -X POST http://localhost:3000/api/backup/{backup-id}/restore
```

### Performance Monitoring

Access the admin dashboard at:
- Performance: `http://localhost:3000/admin/performance`
- Health: `http://localhost:3000/admin/health`
- Security: `http://localhost:3000/admin/security`
- Cache: `http://localhost:3000/admin/cache`
- Backup: `http://localhost:3000/admin/backup`

### Log Management

Logs are stored in:
- Development: `./logs/`
- Production: `/opt/science-paper-manager/logs/`

Log rotation is handled automatically by Docker.

## Troubleshooting

### Common Issues

#### 1. Redis Connection Failed

```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# View Redis logs
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

#### 2. Database Connection Issues

```bash
# Test database connection
npm run validate-db

# Check environment variables
echo $DATABASE_URL

# View application logs
docker-compose logs web
```

#### 3. Worker Processes Not Starting

```bash
# Check worker logs
docker-compose logs worker

# Restart workers
docker-compose restart worker

# Scale workers
docker-compose up -d --scale worker=3
```

#### 4. High Memory Usage

```bash
# Check container stats
docker stats

# Restart services
docker-compose restart

# Scale down if needed
docker-compose up -d --scale worker=1
```

### Performance Optimization

#### 1. Database Optimization

```bash
# Run database optimization
npm run setup-db:optimized

# Check slow queries
curl http://localhost:3000/api/monitoring/dashboard
```

#### 2. Cache Optimization

```bash
# Clear cache
curl -X DELETE http://localhost:3000/api/cache

# Check cache stats
curl http://localhost:3000/api/cache
```

#### 3. Worker Optimization

```bash
# Adjust worker concurrency
export WORKER_CONCURRENCY=10
docker-compose restart worker
```

### Security Checklist

- [ ] Strong passwords for all services
- [ ] SSL certificates properly configured
- [ ] Environment variables secured
- [ ] Regular security updates
- [ ] Backup encryption enabled
- [ ] Rate limiting configured
- [ ] CSRF protection enabled
- [ ] Security monitoring active

### Maintenance Tasks

#### Daily
- Check system health
- Monitor error logs
- Verify backup completion

#### Weekly
- Review performance metrics
- Check disk space usage
- Update dependencies (if needed)

#### Monthly
- Rotate encryption keys
- Clean up old backups
- Security audit
- Performance optimization review

## Support

For issues and questions:

1. Check the logs first
2. Run health checks
3. Review this deployment guide
4. Check the troubleshooting section
5. Create an issue in the repository

## Environment Variables Reference

See `.env.example` and `.env.production` for complete lists of available environment variables and their descriptions.