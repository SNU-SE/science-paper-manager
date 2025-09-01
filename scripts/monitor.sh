#!/bin/bash

# System monitoring script for Science Paper Manager
set -e

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
LOG_DIR="/opt/science-paper-manager/logs"
ALERT_EMAIL="admin@your-domain.com"

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

send_alert() {
    local subject=$1
    local message=$2
    
    # Send email alert (requires mail command)
    if command -v mail &> /dev/null; then
        echo "$message" | mail -s "$subject" "$ALERT_EMAIL"
    fi
    
    # Log alert
    echo "$(date): ALERT - $subject: $message" >> "$LOG_DIR/alerts.log"
}

check_container_health() {
    local container_name=$1
    local status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "not_found")
    
    case $status in
        "healthy")
            echo -e "${GREEN}✅ $container_name: Healthy${NC}"
            return 0
            ;;
        "unhealthy")
            echo -e "${RED}❌ $container_name: Unhealthy${NC}"
            send_alert "Container Unhealthy" "Container $container_name is unhealthy"
            return 1
            ;;
        "starting")
            echo -e "${YELLOW}⏳ $container_name: Starting${NC}"
            return 0
            ;;
        "not_found")
            echo -e "${RED}❌ $container_name: Not found${NC}"
            send_alert "Container Missing" "Container $container_name is not running"
            return 1
            ;;
        *)
            echo -e "${YELLOW}⚠️  $container_name: $status${NC}"
            return 0
            ;;
    esac
}

check_resource_usage() {
    local container_name=$1
    local cpu_limit=80
    local memory_limit=80
    
    # Get container stats
    local stats=$(docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemPerc}}" "$container_name" 2>/dev/null | tail -n 1)
    
    if [ -n "$stats" ]; then
        local cpu_usage=$(echo "$stats" | awk '{print $1}' | sed 's/%//')
        local memory_usage=$(echo "$stats" | awk '{print $2}' | sed 's/%//')
        
        # Check CPU usage
        if (( $(echo "$cpu_usage > $cpu_limit" | bc -l) )); then
            log_warn "$container_name: High CPU usage: ${cpu_usage}%"
            send_alert "High CPU Usage" "$container_name CPU usage is ${cpu_usage}%"
        fi
        
        # Check memory usage
        if (( $(echo "$memory_usage > $memory_limit" | bc -l) )); then
            log_warn "$container_name: High memory usage: ${memory_usage}%"
            send_alert "High Memory Usage" "$container_name memory usage is ${memory_usage}%"
        fi
        
        echo "$container_name: CPU ${cpu_usage}%, Memory ${memory_usage}%"
    fi
}

check_disk_space() {
    local path=$1
    local threshold=85
    
    local usage=$(df "$path" | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$usage" -gt "$threshold" ]; then
        log_warn "High disk usage on $path: ${usage}%"
        send_alert "High Disk Usage" "Disk usage on $path is ${usage}%"
    else
        log_info "Disk usage on $path: ${usage}%"
    fi
}

check_log_errors() {
    local log_file=$1
    local error_count
    
    if [ -f "$log_file" ]; then
        # Count errors in the last hour
        error_count=$(grep -c "ERROR\|FATAL" "$log_file" | tail -100 | wc -l)
        
        if [ "$error_count" -gt 10 ]; then
            log_warn "High error count in $log_file: $error_count errors"
            send_alert "High Error Rate" "Found $error_count errors in $log_file"
        fi
    fi
}

# Main monitoring
echo "📊 Science Paper Manager System Monitor"
echo "======================================="
echo "$(date)"
echo ""

# Check container health
log_info "Checking container health..."
containers=("science-paper-web-prod" "science-paper-worker" "science-paper-redis-prod" "science-paper-websocket-prod")

failed_containers=0
for container in "${containers[@]}"; do
    if ! check_container_health "$container"; then
        failed_containers=$((failed_containers + 1))
    fi
done

echo ""

# Check resource usage
log_info "Checking resource usage..."
for container in "${containers[@]}"; do
    check_resource_usage "$container"
done

echo ""

# Check disk space
log_info "Checking disk space..."
check_disk_space "/"
check_disk_space "/opt/science-paper-manager"

echo ""

# Check log files for errors
log_info "Checking log files..."
if [ -d "$LOG_DIR" ]; then
    for log_file in "$LOG_DIR"/*.log; do
        if [ -f "$log_file" ]; then
            check_log_errors "$log_file"
        fi
    done
fi

# Check application-specific metrics
log_info "Checking application metrics..."
if curl -f http://localhost:3000/api/health/detailed > /dev/null 2>&1; then
    log_info "✅ Application health endpoint responding"
else
    log_error "❌ Application health endpoint not responding"
    send_alert "Application Health Check Failed" "Health endpoint is not responding"
fi

# Summary
echo ""
echo "======================================="
if [ $failed_containers -eq 0 ]; then
    log_info "🎉 All systems operational"
else
    log_error "⚠️  $failed_containers container(s) have issues"
fi

echo "Monitor completed at $(date)"