#!/bin/bash

# Production deployment script for Science Paper Manager
set -e

echo "🚀 Starting Science Paper Manager deployment..."

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production.local"
BACKUP_DIR="/opt/science-paper-manager/backups"
LOG_DIR="/opt/science-paper-manager/logs"
REDIS_DATA_DIR="/opt/science-paper-manager/redis-data"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   log_error "This script should not be run as root for security reasons"
   exit 1
fi

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file $ENV_FILE not found!"
    log_info "Please copy .env.production to $ENV_FILE and configure it."
    exit 1
fi

# Create necessary directories
log_info "Creating necessary directories..."
sudo mkdir -p "$BACKUP_DIR" "$LOG_DIR" "$REDIS_DATA_DIR"
sudo chown -R $USER:$USER "$BACKUP_DIR" "$LOG_DIR" "$REDIS_DATA_DIR"

# Validate environment variables
log_info "Validating environment configuration..."
source "$ENV_FILE"

required_vars=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "DATABASE_URL"
    "REDIS_URL"
    "REDIS_PASSWORD"
    "NEXTAUTH_SECRET"
    "ENCRYPTION_KEY"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        log_error "Required environment variable $var is not set!"
        exit 1
    fi
done

# Validate encryption key length
if [ ${#ENCRYPTION_KEY} -ne 32 ]; then
    log_error "ENCRYPTION_KEY must be exactly 32 characters long!"
    exit 1
fi

# Build and deploy
log_info "Building Docker images..."
docker-compose -f "$COMPOSE_FILE" build --no-cache

log_info "Starting services..."
docker-compose -f "$COMPOSE_FILE" up -d

# Wait for services to be healthy
log_info "Waiting for services to be healthy..."
timeout=300
counter=0

while [ $counter -lt $timeout ]; do
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "healthy"; then
        log_info "Services are healthy!"
        break
    fi
    
    if [ $counter -eq $timeout ]; then
        log_error "Services failed to become healthy within $timeout seconds"
        docker-compose -f "$COMPOSE_FILE" logs
        exit 1
    fi
    
    sleep 5
    counter=$((counter + 5))
    echo -n "."
done

# Run database migrations if needed
log_info "Running database setup..."
docker-compose -f "$COMPOSE_FILE" exec web npm run setup-db:optimized

# Verify deployment
log_info "Verifying deployment..."
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    log_info "✅ Web service is responding"
else
    log_error "❌ Web service is not responding"
    exit 1
fi

# Show service status
log_info "Service status:"
docker-compose -f "$COMPOSE_FILE" ps

# Show logs
log_info "Recent logs:"
docker-compose -f "$COMPOSE_FILE" logs --tail=20

log_info "🎉 Deployment completed successfully!"
log_info "Application is available at: http://localhost:3000"
log_info "WebSocket server is available at: ws://localhost:3001"

# Cleanup old images
log_info "Cleaning up old Docker images..."
docker image prune -f

echo ""
log_info "Deployment Summary:"
echo "- Web application: http://localhost:3000"
echo "- WebSocket server: ws://localhost:3001"
echo "- Redis: localhost:6379"
echo "- Logs directory: $LOG_DIR"
echo "- Backup directory: $BACKUP_DIR"
echo ""
log_info "To view logs: docker-compose -f $COMPOSE_FILE logs -f"
log_info "To stop services: docker-compose -f $COMPOSE_FILE down"