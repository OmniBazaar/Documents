/**
 * Test Setup and Configuration
 * 
 * Provides test environment configuration and utilities for the Documents module tests.
 * Uses real services instead of mocks whenever possible for true integration testing.
 * 
 * @module tests/setup/testSetup
 */

import { DocumentServices } from '../../src/services';
import { logger } from '../../src/utils/logger';
import { createTestServices } from '../../src/initializeDocuments';
import type { ValidatorServices } from '../../src/integration/DirectValidatorIntegration';
import {
  createRealValidatorServices,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase
} from './realValidatorServices';

/**
 * Test Validator API configuration
 * Uses mock API for unit tests, real API for integration tests
 */
export const TEST_VALIDATOR_CONFIG = {
  endpoint: process.env.TEST_VALIDATOR_ENDPOINT || 'http://localhost:4000',
  timeout: 30000,
  retry: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
  },
};

/**
 * Test validator endpoint (for backward compatibility)
 * Points to local validator instance or test environment
 */
export const TEST_VALIDATOR_ENDPOINT = TEST_VALIDATOR_CONFIG.endpoint;

/**
 * Test Bazaar API endpoint
 */
export const TEST_BAZAAR_ENDPOINT = process.env.TEST_BAZAAR_ENDPOINT || 'http://localhost:3000';

/**
 * Test IPFS endpoint
 */
export const TEST_IPFS_ENDPOINT = process.env.TEST_IPFS_ENDPOINT || 'http://localhost:5001';

/**
 * Test timeout for async operations
 */
export const TEST_TIMEOUT = 30000; // 30 seconds

/**
 * Test user IDs for different scenarios
 * Using valid Ethereum address format
 */
export const TEST_USERS = {
  alice: '0x1234567890123456789012345678901234567890',
  bob: '0x2345678901234567890123456789012345678901',
  charlie: '0x3456789012345678901234567890123456789012',
  volunteer: '0x4567890123456789012345678901234567890123',
  moderator: '0x5678901234567890123456789012345678901234',
  admin: '0x6789012345678901234567890123456789012345',
};

/**
 * Global test services instance
 */
let testServices: DocumentServices | null = null;

/**
 * Global validator services instance for cleanup
 */
let validatorServices: ValidatorServices | null = null;

/**
 * Initialize test services
 * Creates a fresh instance of all services with test configuration
 */
export async function setupTestServices(): Promise<DocumentServices> {
  // Clean up any existing services
  await teardownTestServices();

  try {
    // Set test environment variables
    process.env.NODE_ENV = 'test';

    // Create real validator services for testing
    validatorServices = await createRealValidatorServices();

    // Initialize test database schema
    await initializeTestDatabase(validatorServices.database);

    // Initialize services using new direct integration approach
    testServices = await createTestServices(validatorServices);

    logger.info('Test services initialized successfully with real Validator services');
    return testServices;
  } catch (error) {
    logger.error('Failed to initialize test services:', error);
    throw error;
  }
}


/**
 * Teardown test services
 * Cleans up all resources and connections
 */
export async function teardownTestServices(): Promise<void> {
  if (testServices) {
    try {
      // Stop forum service (check if stop method exists)
      if (testServices.forum && typeof testServices.forum.stop === 'function') {
        await testServices.forum.stop();
      }

      // Stop support service (check if stop method exists)
      if (testServices.support && typeof testServices.support.stop === 'function') {
        await testServices.support.stop();
      }

      // Services cleanup handled by disposal
      testServices = null;

      // Close database connection if exists
      if (validatorServices?.database) {
        await closeTestDatabase(validatorServices.database);
        validatorServices = null;
      }

      logger.info('Test services torn down successfully');
    } catch (error) {
      logger.error('Error tearing down test services:', error);
      throw error;
    }
  }
}

/**
 * Get test services instance
 * Returns existing instance or creates new one
 */
export async function getTestServices(): Promise<DocumentServices> {
  if (!testServices) {
    testServices = await setupTestServices();
  }
  return testServices;
}

// Database migrations removed - all data operations go through Validator API

// Basic migrations removed - all data operations go through Validator API

/**
 * Clean test data
 * Clears all test-related data
 */
export async function cleanTestData(): Promise<void> {
  // Clean test data from real database
  if (validatorServices?.database) {
    await cleanTestDatabase(validatorServices.database);
  }
  logger.info('Test data cleaned');
}

/**
 * Wait for service to be ready
 * Polls service health endpoint until ready or timeout
 */
export async function waitForService(
  endpoint: string,
  maxRetries: number = 30,
  delayMs: number = 1000
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${endpoint}/health`);
      if (response.ok) {
        logger.info(`Service at ${endpoint} is ready`);
        return true;
      }
    } catch (error) {
      // Service not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  logger.warn(`Service at ${endpoint} did not become ready after ${maxRetries} retries`);
  return false;
}

/**
 * Generate test document data
 */
export function generateTestDocument(overrides: Partial<any> = {}) {
  const DocumentCategory = {
    GETTING_STARTED: 'getting_started',
    TECHNICAL: 'technical',
    FAQ: 'faq',
    BEST_PRACTICES: 'best_practices',
    TROUBLESHOOTING: 'troubleshooting',
  };
  
  return {
    title: 'Test Document ' + Date.now(),
    description: 'Test document description',
    content: 'This is test content for automated testing.',
    category: DocumentCategory.GETTING_STARTED,
    tags: ['test', 'automated'],
    authorAddress: TEST_USERS.alice,
    language: 'en',
    isOfficial: false,
    ...overrides,
  };
}

/**
 * Generate test forum thread data
 */
export function generateTestThread(overrides: Partial<any> = {}) {
  return {
    title: 'Test Thread ' + Date.now(),
    content: 'This is a test forum thread.',
    category: 'general',
    tags: ['test', 'discussion'],
    authorAddress: TEST_USERS.bob,
    ...overrides,
  };
}

/**
 * Generate test support request data
 */
export function generateTestSupportRequest(overrides: Partial<any> = {}) {
  return {
    userId: TEST_USERS.charlie,
    category: 'technical',
    subject: 'Test Support Request',
    description: 'I need help with testing.',
    priority: 'normal',
    ...overrides,
  };
}

/**
 * Test assertion helpers
 */
export const testHelpers = {
  /**
   * Assert document structure
   */
  assertDocument(doc: any) {
    expect(doc).toHaveProperty('id');
    expect(doc).toHaveProperty('title');
    expect(doc).toHaveProperty('description');
    expect(doc).toHaveProperty('content');
    expect(doc).toHaveProperty('category');
    expect(doc).toHaveProperty('authorAddress');
    expect(doc).toHaveProperty('createdAt');
    expect(doc).toHaveProperty('updatedAt');
    expect(doc).toHaveProperty('tags');
    expect(doc).toHaveProperty('isOfficial');
    expect(doc).toHaveProperty('viewCount');
    expect(doc).toHaveProperty('rating');
  },

  /**
   * Assert forum thread structure
   */
  assertThread(thread: any) {
    expect(thread).toHaveProperty('id');
    expect(thread).toHaveProperty('title');
    expect(thread).toHaveProperty('authorAddress');
    expect(thread).toHaveProperty('replyCount');
  },

  /**
   * Assert support request structure
   */
  assertSupportRequest(request: any) {
    expect(request).toHaveProperty('id');
    expect(request).toHaveProperty('userId');
    expect(request).toHaveProperty('subject');
    expect(request).toHaveProperty('status');
  },
};