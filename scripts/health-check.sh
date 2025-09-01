#!/bin/bash

# Health check script for Science Paper Manager
set -e

# Configuration
WEB_URL="http://localhost:3000"
WEBSOCKET_URL="ws://localhost:3001"
REDIS_HOST="localhost"
REDIS_PORT="6379"

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

check_service() {
    local service_name=$1
    local check_command=$2
    
    echo -n "Checking $service_name... "
    
    if eval "$check_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        return 1
    fi
}

# Main health check
echo "🏥 Science Paper Manager Health Check"
echo "======================================"

failed_checks=0

# Check web application
if ! check_service "Web Application" "curl -f $WEB_URL/api/health"; then
    failed_checks=$((failed_checks + 1))
    log_error "Web application is not responding at $WEB_URL"
fi

# Check Redis
if ! check_service "Redis" "redis-cli -h $REDIS_HOST -p $REDIS_PORT ping"; then
    failed_checks=$((failed_checks + 1))
    log_error "Redis is not responding at $REDIS_HOST:$REDIS_PORT"
fi

# Check database connection
if ! check_service "Database" "curl -f $WEB_URL/api/database/health"; then
    failed_checks=$((failed_checks + 1))
    log_error "Database connection failed"
fi

# Check background jobs
if ! check_service "Background Jobs" "curl -f $WEB_URL/api/jobs/health"; then
    failed_checks=$((failed_checks + 1))
    log_error "Background job system is not healthy"
fi

# Check WebSocket (if enabled)
if command -v wscat &> /dev/null; then
    if ! check_service "WebSocket" "timeout 5 wscat -c $WEBSOCKET_URL --close"; then
        failed_checks=$((failed_checks + 1))
        log_error "WebSocket server is not responding at $WEBSOCKET_URL"
    fi
else
    log_warn "wscat not found. Skipping WebSocket check."
fi

# Summary
echo ""
echo "======================================"
if [ $failed_checks -eq 0 ]; then
    log_info "🎉 All health checks passed!"
    exit 0
else
    log_error "❌ $failed_checks health check(s) failed!"
    
    echo ""
    log_info "Troubleshooting tips:"
    echo "- Check if all services are running: docker-compose ps"
    echo "- View logs: docker-compose logs -f"
    echo "- Restart services: docker-compose restart"
    echo "- Check environment configuration in .env files"
    
    exit 1
fi