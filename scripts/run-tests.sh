#!/bin/bash

# Science Paper Manager - Test Runner Script
# This script runs all tests in the correct order and generates reports

set -e

echo "🧪 Running Science Paper Manager Test Suite"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_warning "Installing dependencies..."
    npm install
fi

# Run linting first
echo ""
echo "📋 Running ESLint..."
if npm run lint; then
    print_status "Linting passed"
else
    print_error "Linting failed"
    exit 1
fi

# Run unit tests with coverage
echo ""
echo "🔬 Running Unit Tests with Coverage..."
if npm run test:coverage; then
    print_status "Unit tests passed"
else
    print_error "Unit tests failed"
    exit 1
fi

# Check if we should run E2E tests
if [ "$1" = "--skip-e2e" ]; then
    print_warning "Skipping E2E tests as requested"
else
    # Install Playwright browsers if needed
    if [ ! -d "$HOME/Library/Caches/ms-playwright" ] && [ ! -d "$HOME/.cache/ms-playwright" ]; then
        print_warning "Installing Playwright browsers..."
        npx playwright install
    fi

    # Run E2E tests
    echo ""
    echo "🎭 Running End-to-End Tests..."
    if npm run test:e2e; then
        print_status "E2E tests passed"
    else
        print_error "E2E tests failed"
        exit 1
    fi
fi

# Generate test report summary
echo ""
echo "📊 Test Summary"
echo "==============="

# Count test files
UNIT_TESTS=$(find src -name "*.test.ts" -o -name "*.test.tsx" | wc -l | tr -d ' ')
E2E_TESTS=$(find e2e -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')

print_status "Unit test files: $UNIT_TESTS"
if [ "$1" != "--skip-e2e" ]; then
    print_status "E2E test files: $E2E_TESTS"
fi

# Check coverage report exists
if [ -f "coverage/lcov-report/index.html" ]; then
    print_status "Coverage report generated: coverage/lcov-report/index.html"
fi

# Check Playwright report exists
if [ -f "playwright-report/index.html" ] && [ "$1" != "--skip-e2e" ]; then
    print_status "E2E test report generated: playwright-report/index.html"
fi

echo ""
print_status "All tests completed successfully! 🎉"

# Optional: Open reports in browser
if [ "$2" = "--open-reports" ]; then
    if command -v open &> /dev/null; then
        open coverage/lcov-report/index.html
        if [ "$1" != "--skip-e2e" ] && [ -f "playwright-report/index.html" ]; then
            open playwright-report/index.html
        fi
    fi
fi