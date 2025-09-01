#!/bin/bash

# Development environment setup script
set -e

echo "🛠️  Setting up Science Paper Manager development environment..."

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

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install Node.js 18 or later."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    log_error "Node.js version 18 or later is required. Current version: $(node -v)"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    log_error "npm is not installed. Please install npm."
    exit 1
fi

# Install dependencies
log_info "Installing dependencies..."
npm ci

# Create environment file if it doesn't exist
if [ ! -f ".env.local" ]; then
    log_info "Creating .env.local from .env.example..."
    cp .env.example .env.local
    log_warn "Please configure .env.local with your actual values before running the application."
fi

# Check if Docker is available for development services
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    log_info "Docker detected. Setting up development services..."
    
    # Start Redis for development
    log_info "Starting Redis for development..."
    docker-compose -f docker-compose.dev.yml up -d redis
    
    # Wait for Redis to be ready
    log_info "Waiting for Redis to be ready..."
    timeout=30
    counter=0
    
    while [ $counter -lt $timeout ]; do
        if docker-compose -f docker-compose.dev.yml exec redis redis-cli ping > /dev/null 2>&1; then
            log_info "Redis is ready!"
            break
        fi
        
        if [ $counter -eq $timeout ]; then
            log_error "Redis failed to start within $timeout seconds"
            exit 1
        fi
        
        sleep 1
        counter=$((counter + 1))
        echo -n "."
    done
    
else
    log_warn "Docker not found. You'll need to set up Redis manually."
    log_info "Install Redis locally or use a cloud Redis service."
fi

# Run database setup
log_info "Setting up database..."
if npm run setup-db:optimized; then
    log_info "✅ Database setup completed"
else
    log_warn "⚠️  Database setup failed. Please check your DATABASE_URL in .env.local"
fi

# Run tests to verify setup
log_info "Running tests to verify setup..."
if npm test -- --passWithNoTests; then
    log_info "✅ Tests passed"
else
    log_warn "⚠️  Some tests failed. Check the output above."
fi

# Create necessary directories
log_info "Creating development directories..."
mkdir -p logs backups temp

log_info "🎉 Development environment setup completed!"
echo ""
log_info "Next steps:"
echo "1. Configure .env.local with your actual values"
echo "2. Start the development server: npm run dev"
echo "3. Start the worker process: npm run worker:dev"
echo "4. Open http://localhost:3000 in your browser"
echo ""
log_info "Available commands:"
echo "- npm run dev          # Start development server"
echo "- npm run worker:dev   # Start worker process with hot reload"
echo "- npm test            # Run tests"
echo "- npm run test:watch  # Run tests in watch mode"
echo "- npm run test:e2e    # Run end-to-end tests"
echo ""
log_info "Docker commands (if using Docker):"
echo "- docker-compose -f docker-compose.dev.yml up -d redis    # Start Redis"
echo "- docker-compose -f docker-compose.dev.yml down           # Stop all services"
echo "- docker-compose -f docker-compose.dev.yml logs -f        # View logs"