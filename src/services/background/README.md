# Background Job Queue System

A robust background job processing system built with Bull/BullMQ and Redis for handling AI analysis tasks and other long-running operations.

## Features

- **Redis-based Job Queue**: Uses Bull/BullMQ for reliable job queuing and processing
- **Progress Tracking**: Real-time progress updates for running jobs
- **Exponential Backoff Retry**: Intelligent retry logic with exponential backoff and jitter
- **Error Classification**: Distinguishes between retryable and permanent errors
- **Health Monitoring**: Built-in health checks for queue and worker processes
- **Graceful Shutdown**: Proper cleanup and job completion on shutdown
- **Comprehensive Testing**: Full test coverage for all components

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   API Routes    │    │  Job Queue      │
│                 │───▶│                 │───▶│  (Bull/BullMQ)  │
│ - Create Jobs   │    │ - Job CRUD      │    │                 │
│ - Track Status  │    │ - Status Check  │    │ - Redis Store   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Notifications  │    │  Error Handler  │    │  Worker Process │
│                 │◀───│                 │◀───│                 │
│ - User Alerts   │    │ - Retry Logic   │    │ - Job Processing│
│ - Admin Alerts  │    │ - Classification│    │ - AI Analysis   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Components

### JobQueueManager
Main interface for job queue operations:
- Add new jobs to the queue
- Query job status and progress
- Cancel running jobs
- Retry failed jobs
- Get queue statistics

### AIAnalysisWorker
Worker process that handles AI analysis jobs:
- Processes jobs from the queue
- Updates job progress in real-time
- Handles multiple AI providers
- Saves results to database
- Sends completion notifications

### JobErrorHandler
Handles job failures with intelligent retry logic:
- Classifies errors as retryable or permanent
- Implements exponential backoff with jitter
- Records failure analytics
- Notifies users and administrators

## Usage

### Starting the System

1. **Start Redis** (required):
```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Or using local Redis installation
redis-server
```

2. **Start the Worker Process**:
```bash
# Development mode with auto-restart
npm run worker:dev

# Production mode
npm run worker
```

3. **Start the Web Application**:
```bash
npm run dev
```

### Creating Jobs

```typescript
import { getJobQueueManager } from '@/services/background'

const jobQueueManager = getJobQueueManager()

// Create an AI analysis job
const jobId = await jobQueueManager.addAnalysisJob(
  'paper-123',
  ['openai', 'anthropic']
)

console.log(`Job created with ID: ${jobId}`)
```

### Tracking Job Progress

```typescript
import { useJobProgress } from '@/hooks/useBackgroundJobs'

function JobTracker({ jobId }: { jobId: string }) {
  const { jobStatus, isLoading, error } = useJobProgress(jobId)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!jobStatus) return <div>Job not found</div>

  return (
    <div>
      <h3>Job Status: {jobStatus.status}</h3>
      <div>Progress: {jobStatus.progress}%</div>
      {jobStatus.error && <div>Error: {jobStatus.error}</div>}
    </div>
  )
}
```

### Using the React Hook

```typescript
import { useBackgroundJobs } from '@/hooks/useBackgroundJobs'

function AIAnalysisComponent() {
  const { 
    createAnalysisJob, 
    queueStatus, 
    isHealthy, 
    isLoading, 
    error 
  } = useBackgroundJobs()

  const handleAnalyze = async () => {
    try {
      const jobId = await createAnalysisJob('paper-123', ['openai'])
      console.log('Analysis started:', jobId)
    } catch (error) {
      console.error('Failed to start analysis:', error)
    }
  }

  return (
    <div>
      <button onClick={handleAnalyze} disabled={isLoading}>
        Start AI Analysis
      </button>
      
      {queueStatus && (
        <div>
          Queue Status: {queueStatus.active} active, {queueStatus.waiting} waiting
        </div>
      )}
      
      <div>System Health: {isHealthy ? '✅' : '❌'}</div>
    </div>
  )
}
```

## API Endpoints

### Job Management

- `POST /api/jobs` - Create a new job
- `GET /api/jobs` - Get queue status
- `GET /api/jobs/[jobId]` - Get job status
- `DELETE /api/jobs/[jobId]` - Cancel job
- `POST /api/jobs/[jobId]/retry` - Retry failed job
- `GET /api/jobs/health` - Health check

### Example API Usage

```bash
# Create an AI analysis job
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ai-analysis",
    "paperId": "paper-123",
    "providers": ["openai", "anthropic"]
  }'

# Check job status
curl http://localhost:3000/api/jobs/job-id-here

# Get queue status
curl http://localhost:3000/api/jobs

# Health check
curl http://localhost:3000/api/jobs/health
```

## Configuration

### Environment Variables

```bash
# Redis connection
REDIS_URL=redis://localhost:6379

# Worker settings
WORKER_CONCURRENCY=5
MAX_JOB_ATTEMPTS=3

# Optional: Custom retry delays
RETRY_BASE_DELAY=2000
RETRY_MAX_DELAY=30000
```

### Configuration File

```typescript
import { getBackgroundJobConfig } from '@/services/background/config'

const config = getBackgroundJobConfig()
// Automatically loads from environment variables
```

## Database Schema

The system requires these database tables (created by migration `004_background_jobs.sql`):

- `background_jobs` - Main job tracking
- `job_progress` - Real-time progress updates
- `job_failures` - Failure analytics

## Monitoring and Observability

### Health Checks

```typescript
import { checkBackgroundJobsHealth } from '@/services/background'

const health = await checkBackgroundJobsHealth()
console.log('System healthy:', health.healthy)
console.log('Queue status:', health.details.queueStatus)
```

### Worker Statistics

```typescript
const worker = getAIAnalysisWorker()
const stats = await worker.getWorkerStats()
console.log('Processed:', stats.processed)
console.log('Failed:', stats.failed)
console.log('Active:', stats.active)
```

### Error Analytics

```typescript
import { JobErrorHandler } from '@/services/background'

const stats = await JobErrorHandler.getErrorStatistics({
  start: new Date('2024-01-01'),
  end: new Date('2024-01-02')
})
```

## Testing

Run the background job tests:

```bash
# Run all background job tests
npm test -- --testPathPatterns="background"

# Run specific test file
npm test -- JobQueueManager.test.ts

# Run with coverage
npm test -- --coverage --testPathPatterns="background"
```

## Production Deployment

### Docker Setup

```dockerfile
# Worker container
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "run", "worker"]
```

### Process Management

Use a process manager like PM2 for production:

```json
{
  "apps": [
    {
      "name": "worker",
      "script": "npm",
      "args": "run worker",
      "instances": 2,
      "exec_mode": "cluster",
      "env": {
        "NODE_ENV": "production",
        "WORKER_CONCURRENCY": "10"
      }
    }
  ]
}
```

### Scaling

- **Horizontal Scaling**: Run multiple worker processes
- **Vertical Scaling**: Increase `WORKER_CONCURRENCY`
- **Redis Scaling**: Use Redis Cluster for high availability

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check Redis is running: `redis-cli ping`
   - Verify REDIS_URL environment variable
   - Check network connectivity

2. **Jobs Stuck in Processing**
   - Check worker process is running
   - Review worker logs for errors
   - Verify database connectivity

3. **High Memory Usage**
   - Reduce `WORKER_CONCURRENCY`
   - Increase job cleanup frequency
   - Monitor Redis memory usage

### Debug Mode

Enable debug logging:

```bash
DEBUG=bull* npm run worker
```

### Health Check Endpoint

Monitor system health:

```bash
curl http://localhost:3000/api/jobs/health
```

## Contributing

When adding new job types:

1. Define job data interface in `types.ts`
2. Add processing logic to worker
3. Update API routes
4. Add tests
5. Update documentation

## License

This background job system is part of the Science Paper Manager project.