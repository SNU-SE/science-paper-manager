# Integration and Performance Testing Guide

This document provides comprehensive information about the integration and performance testing suite for the Science Paper Manager system enhancement features.

## Overview

The testing suite includes three main categories of tests:

1. **System Integration Tests** - Test complete workflows across multiple services
2. **Performance Tests** - Verify system performance under various load conditions  
3. **End-to-End Tests** - Test complete user workflows through the UI

## Test Structure

```
src/services/__tests__/
├── system-integration.test.ts    # Complete system workflow tests
├── performance.test.ts           # Performance and load tests
└── ...

e2e/
├── system-enhancement.spec.ts    # E2E tests for all enhancement features
└── ...

scripts/
├── run-integration-tests.ts      # Comprehensive test runner
└── ...

Configuration:
├── jest.integration.config.js    # Integration test configuration
├── jest.integration.setup.js     # Global test setup
├── jest.integration.teardown.js  # Global test cleanup
└── jest.integration.env.js       # Test environment setup
```

## Running Tests

### Quick Start

```bash
# Run all integration tests
npm run test:integration

# Run performance tests only
npm run test:performance

# Run complete system test suite
npm run test:system

# Run E2E tests for system enhancements
npm run test:e2e:system

# Run everything
npm run test:all:system
```

### Advanced Options

```bash
# Run tests in parallel (faster)
npm run test:system:parallel

# Run with verbose output (debugging)
npm run test:system:verbose

# Run with coverage reporting
npm run test:integration:coverage

# Watch mode for development
npm run test:integration:watch
```

## Test Categories

### 1. System Integration Tests

**File**: `src/services/__tests__/system-integration.test.ts`

Tests complete workflows across multiple services:

- **AI Analysis Workflow**: Paper upload → AI analysis → background processing → notifications
- **Performance Monitoring**: API tracking → metrics aggregation → alerting
- **Security System**: API key encryption → session management → threat detection
- **Notification System**: Real-time notifications → WebSocket communication → settings management
- **Backup System**: Automated backups → validation → scheduling
- **Health Monitoring**: Service status → auto-recovery → resource monitoring
- **Cache System**: Multi-layer caching → invalidation → performance optimization
- **API Usage Tracking**: Usage monitoring → limit enforcement → anomaly detection

**Key Features Tested**:
- Cross-service communication
- Data consistency across services
- Error handling and recovery
- Real-time updates and notifications
- Background job processing
- Security and encryption

### 2. Performance Tests

**File**: `src/services/__tests__/performance.test.ts`

Verifies system performance under various conditions:

- **Database Query Performance**: Complex queries, concurrent access, indexing effectiveness
- **Cache Performance**: Read/write speeds, hit rates, invalidation efficiency
- **Search Performance**: Text search, filtered search, large datasets
- **Background Job Performance**: Job queuing, processing times, concurrent jobs
- **Memory Usage**: Memory leaks, resource cleanup, garbage collection
- **Load Testing**: Simulated user load, concurrent operations, system limits

**Performance Thresholds**:
- API Response Time: < 1000ms
- Database Query Time: < 500ms
- Cache Response Time: < 50ms
- Search Response Time: < 2000ms
- Job Processing Time: < 5000ms

### 3. End-to-End Tests

**File**: `e2e/system-enhancement.spec.ts`

Tests complete user workflows through the browser:

- **Background AI Analysis**: Upload → analysis request → real-time progress → results display
- **Advanced Search**: Filter application → sorting → pagination → suggestions
- **Performance Dashboard**: Metrics display → real-time updates → alerts
- **Security Management**: API key management → activity monitoring → threat alerts
- **Notification System**: Real-time notifications → settings management → history
- **Backup Management**: Backup creation → validation → scheduling
- **Health Monitoring**: Status display → incident tracking → resource monitoring
- **Usage Tracking**: Statistics display → limit enforcement → anomaly detection

## Test Environment Setup

### Prerequisites

1. **Test Database**: Supabase instance with test schema
2. **Redis Instance**: For caching and job queues
3. **Environment Variables**: Test-specific configuration

### Environment Variables

```bash
# Test Database
TEST_SUPABASE_URL=http://localhost:54321
TEST_SUPABASE_ANON_KEY=your-test-anon-key

# Test Redis
TEST_REDIS_URL=redis://localhost:6379/1

# Test Configuration
NODE_ENV=test
PARALLEL_TESTS=false
COVERAGE=true
VERBOSE=false

# E2E Tests
TEST_BASE_URL=http://localhost:3000
RUN_E2E_TESTS=true
```

### Docker Setup

For consistent testing environment:

```bash
# Start test services
docker-compose -f docker-compose.test.yml up -d

# Run tests
npm run test:system

# Cleanup
docker-compose -f docker-compose.test.yml down
```

## Test Data Management

### Automatic Test Data Creation

The test suite automatically creates:
- Test users with various roles
- Sample papers with different characteristics
- AI analysis results
- Performance metrics
- Notification history
- Backup records

### Data Cleanup

- **Automatic**: Tests clean up their own data
- **Global**: Global teardown removes all test data
- **Manual**: `npm run test:cleanup` for manual cleanup

## Mocking Strategy

### External Services

- **AI Providers**: OpenAI, Anthropic APIs mocked with realistic responses
- **File System**: File operations mocked for consistent testing
- **Crypto**: Deterministic crypto operations for reproducible tests
- **WebSockets**: Mock WebSocket implementation for notification tests

### Internal Services

- **Selective Mocking**: Only mock external dependencies
- **Real Integration**: Use real database and Redis for integration tests
- **Service Isolation**: Each test suite can run independently

## Performance Monitoring

### Test Performance Tracking

```typescript
// Example performance assertion
test('should complete search within threshold', async () => {
  const startTime = performance.now()
  
  const results = await searchService.searchPapers(complexQuery)
  
  const duration = performance.now() - startTime
  expect(duration).toBeLessThan(2000) // 2 second threshold
})
```

### Memory Leak Detection

```typescript
test('should not have memory leaks', async () => {
  const initialMemory = process.memoryUsage()
  
  // Perform intensive operations
  await performIntensiveOperations()
  
  const finalMemory = process.memoryUsage()
  const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
  
  expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // 100MB limit
})
```

## Continuous Integration

### GitHub Actions Integration

```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:6
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm run test:system
        env:
          TEST_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          TEST_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
          TEST_REDIS_URL: redis://localhost:6379/1
      
      - name: Upload test reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-reports
          path: test-reports/
```

## Debugging Tests

### Verbose Mode

```bash
# Enable detailed logging
VERBOSE=true npm run test:system

# Debug specific test
DEBUG=true npm run test:integration -- --testNamePattern="AI Analysis"
```

### Test Isolation

```bash
# Run single test file
npm run test:integration -- src/services/__tests__/system-integration.test.ts

# Run specific test case
npm run test:integration -- --testNamePattern="should complete AI analysis workflow"
```

### Common Issues

1. **Database Connection**: Ensure test database is running and accessible
2. **Redis Connection**: Verify Redis instance is available
3. **Port Conflicts**: Use different ports for test services
4. **Memory Issues**: Increase Node.js memory limit for large test suites
5. **Timeout Issues**: Adjust test timeouts for slower environments

## Test Reports

### Generated Reports

- **JSON Report**: `test-reports/integration-test-results.json`
- **HTML Report**: `test-reports/integration-test-report.html`
- **Coverage Report**: `coverage/integration/index.html`
- **JUnit XML**: `test-reports/integration-test-results.xml`

### Report Contents

- Test execution summary
- Performance metrics
- Coverage statistics
- Failed test details
- Performance benchmarks
- Memory usage analysis

## Best Practices

### Writing Integration Tests

1. **Test Real Workflows**: Focus on complete user scenarios
2. **Use Real Services**: Minimize mocking for integration tests
3. **Clean Up**: Always clean up test data
4. **Parallel Safe**: Ensure tests can run in parallel
5. **Deterministic**: Tests should produce consistent results

### Performance Testing

1. **Set Realistic Thresholds**: Based on production requirements
2. **Test Under Load**: Simulate realistic user loads
3. **Monitor Resources**: Track memory, CPU, and I/O usage
4. **Baseline Comparisons**: Compare against previous performance
5. **Environment Consistency**: Use consistent test environments

### Maintenance

1. **Regular Updates**: Keep tests updated with feature changes
2. **Performance Baselines**: Update thresholds as system evolves
3. **Test Data**: Refresh test data periodically
4. **Dependencies**: Keep testing dependencies updated
5. **Documentation**: Update this guide with changes

## Troubleshooting

### Common Test Failures

1. **Timeout Errors**: Increase test timeouts or optimize test performance
2. **Database Errors**: Check database schema and permissions
3. **Redis Errors**: Verify Redis configuration and connectivity
4. **Memory Errors**: Increase Node.js memory limit
5. **Port Conflicts**: Use unique ports for test services

### Performance Issues

1. **Slow Tests**: Profile and optimize test setup/teardown
2. **Memory Leaks**: Use heap profiling tools
3. **Database Locks**: Ensure proper transaction handling
4. **Resource Cleanup**: Verify all resources are properly closed

### Getting Help

1. Check test logs for detailed error information
2. Run tests in verbose mode for debugging
3. Use test isolation to identify problematic tests
4. Review test environment setup
5. Consult team documentation and runbooks

## Future Enhancements

### Planned Improvements

1. **Visual Regression Testing**: Screenshot comparison for UI tests
2. **API Contract Testing**: Schema validation for API responses
3. **Chaos Engineering**: Fault injection testing
4. **Performance Regression**: Automated performance regression detection
5. **Test Analytics**: Advanced test metrics and insights

### Monitoring Integration

1. **Test Metrics**: Integration with monitoring systems
2. **Alert Integration**: Notifications for test failures
3. **Performance Tracking**: Long-term performance trend analysis
4. **Quality Gates**: Automated quality checks in CI/CD pipeline