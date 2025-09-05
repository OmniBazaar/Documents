# Documents Module Test Suite

Comprehensive test suite for the OmniBazaar Documents module covering unit, integration, and end-to-end testing.

## Test Structure

```
tests/
├── setup/                    # Test setup and utilities
│   ├── testSetup.ts         # Main test configuration and helpers
│   └── jest.setup.ts        # Jest global setup
├── unit/                    # Unit tests for individual services
│   └── services/
│       ├── documentation/   # DocumentationService tests
│       ├── forum/          # P2PForumService tests
│       ├── support/        # VolunteerSupportService tests
│       └── SearchEngine.test.ts
├── integration/            # Integration tests
│   ├── ValidatorIntegration.test.ts  # Validator module integration
│   ├── BazaarIntegration.test.ts     # Bazaar marketplace integration
│   └── DatabaseIntegration.test.ts   # Database operations
└── deprecated/             # Old test files (reference only)
```

## Running Tests

### Prerequisites

1. **YugabyteDB** must be running:
   ```bash
   # Start YugabyteDB (if using Docker)
   docker run -d --name yugabyte \
     -p 5433:5433 \
     -p 9000:9000 \
     yugabytedb/yugabyte:latest
   ```

2. **Environment Variables**:
   ```bash
   export TEST_DB_HOST=localhost
   export TEST_DB_PORT=5433
   export TEST_DB_NAME=omnibazaar_docs_test
   export TEST_DB_USER=yugabyte
   export TEST_DB_PASSWORD=yugabyte
   export TEST_VALIDATOR_ENDPOINT=http://localhost:8080
   export TEST_BAZAAR_ENDPOINT=http://localhost:3000
   export TEST_IPFS_ENDPOINT=http://localhost:5001
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

### Running All Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Running Specific Test Suites

```bash
# Unit tests only
npm test -- unit/

# Integration tests only
npm test -- integration/

# Specific service tests
npm test -- DocumentationService.test.ts
npm test -- P2PForumService.test.ts
npm test -- VolunteerSupportService.test.ts

# Database tests
npm test -- DatabaseIntegration.test.ts

# External integration tests
npm test -- ValidatorIntegration.test.ts
npm test -- BazaarIntegration.test.ts
```

### Test Categories

#### Unit Tests
- **DocumentationService**: CRUD, versioning, multilingual, search, consensus, IPFS
- **P2PForumService**: Threads, posts, voting, moderation, spam detection
- **VolunteerSupportService**: Requests, volunteers, sessions, routing, ratings
- **SearchEngine**: Full-text search, filtering, faceting, ranking, suggestions

#### Integration Tests
- **ValidatorIntegration**: Cross-module messaging, participation scores, consensus
- **BazaarIntegration**: Marketplace documentation, seller support, forums
- **DatabaseIntegration**: Transactions, concurrency, integrity, performance

## Test Coverage Goals

- **Unit Tests**: 90%+ coverage for all services
- **Integration Tests**: Critical paths and cross-module interactions
- **Performance Tests**: Sub-second response for common operations

## Writing New Tests

### Test Helpers

Use the provided test helpers in `testSetup.ts`:

```typescript
import { 
  setupTestServices,
  generateTestDocument,
  generateTestThread,
  generateTestSupportRequest,
  TEST_USERS,
  testHelpers
} from '@tests/setup/testSetup';

describe('MyNewService', () => {
  let services: DocumentServices;
  
  beforeAll(async () => {
    services = await setupTestServices();
  });
  
  afterAll(async () => {
    await teardownTestServices();
  });
  
  test('should do something', async () => {
    const doc = await services.documentation.createDocument(
      generateTestDocument({ title: 'Test' })
    );
    
    testHelpers.assertDocument(doc);
  });
});
```

### Best Practices

1. **Use Real Services**: Avoid mocks when possible, test with real integrations
2. **Clean Up**: Always clean test data after tests
3. **Isolation**: Each test should be independent
4. **Descriptive Names**: Use clear test descriptions
5. **Performance**: Keep tests fast (< 30s timeout)

## Continuous Integration

Tests are automatically run on:
- Pull requests
- Commits to main branch
- Nightly builds

### CI Environment Variables

The CI environment should set:
```yaml
TEST_DB_HOST: test-yugabyte
TEST_DB_PORT: 5433
TEST_DB_NAME: omnibazaar_docs_test
TEST_DB_USER: yugabyte
TEST_DB_PASSWORD: secure-password
TEST_VALIDATOR_ENDPOINT: http://test-validator:8080
TEST_BAZAAR_ENDPOINT: http://test-bazaar:3000
```

## Debugging Tests

### Verbose Output

```bash
# Run with verbose output
npm test -- --verbose

# Debug specific test
node --inspect-brk node_modules/.bin/jest DocumentationService.test.ts
```

### Common Issues

1. **Database Connection Failed**
   - Ensure YugabyteDB is running
   - Check connection parameters
   - Verify network connectivity

2. **Validator Service Unavailable**
   - Tests gracefully skip if validator is down
   - Set TEST_VALIDATOR_ENDPOINT correctly

3. **Timeout Errors**
   - Increase jest timeout in jest.config.js
   - Check for slow database queries
   - Verify external service availability

## Test Data Management

Test data is automatically:
- Created in `beforeEach/beforeAll` hooks
- Cleaned in `afterEach/afterAll` hooks
- Isolated using unique identifiers (timestamps)

## Performance Benchmarks

Expected performance targets:
- Document creation: < 100ms
- Search queries: < 500ms
- Forum operations: < 50ms
- Support routing: < 200ms
- Database transactions: < 1s

## Maintenance

- Review and update tests when adding new features
- Keep test data generators in sync with schemas
- Monitor test execution times
- Update deprecated tests as needed