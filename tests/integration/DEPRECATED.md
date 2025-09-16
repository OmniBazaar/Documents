# Deprecated Integration Tests

The following test files are deprecated and should not be used with the new direct integration architecture:

## Deprecated Files

1. **APIDataPersistence.test.ts**
   - Used the old ValidatorAPIClient pattern
   - Replaced by: DirectIntegrationDataPersistence.test.ts

2. **ValidatorIntegration.test.ts**
   - Used the old ValidatorIntegration class
   - Replaced by: DirectIntegrationDataPersistence.test.ts and direct-integration.test.ts

## Migration Guide

When updating tests for the new architecture:

1. Replace `ValidatorAPIClient` with `DirectServiceCaller`
2. Replace `MockValidatorAPIClient` with `MockValidatorServices`
3. Use `createTestServices` instead of `setupTestServices` with API client
4. Pass ValidatorServices directly instead of API endpoints

## New Test Pattern

See `DirectIntegrationDataPersistence.test.ts` for the correct pattern for writing integration tests with the new direct service architecture.