/**
 * Unit Test Setup and Configuration
 *
 * Provides test environment configuration and utilities for unit tests.
 * Uses mocks instead of real services for isolated testing.
 *
 * @module tests/setup/unitTestSetup
 */

import { MockDatabase } from '../mocks/MockDatabase';
import { DocumentServices } from '../../src/services';
import { logger } from '../../src/utils/logger';

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
 * Global test services instance for unit tests
 */
let unitTestServices: DocumentServices | null = null;

/**
 * Initialize unit test services with mocks
 * Creates mock instances of all services for isolated testing
 */
export async function setupUnitTestServices(): Promise<DocumentServices> {
  // Clean up any existing services
  await teardownUnitTestServices();

  try {
    // Set test environment variables
    process.env.NODE_ENV = 'test';

    // Initialize services with mock database
    unitTestServices = await initializeUnitTestDocumentServices();

    logger.info('Unit test services initialized successfully');
    return unitTestServices;
  } catch (error) {
    logger.error('Failed to initialize unit test services:', error);
    throw error;
  }
}

/**
 * Initialize document services with mocks for unit testing
 */
async function initializeUnitTestDocumentServices(): Promise<DocumentServices> {
  // Dynamically import constructors to avoid circular dependencies
  const { DocumentationService } = await import('../../src/services/documentation/DocumentationService');
  const { P2PForumService } = await import('../../src/services/forum/P2PForumService');
  const { VolunteerSupportService } = await import('../../src/services/support/VolunteerSupportService');
  const { ParticipationScoreService } = await import('../../src/services/participation/ParticipationScoreService');
  const { SearchEngine } = await import('../../src/services/search/SearchEngine');
  const { ValidationService } = await import('../../src/services/validation/ValidationService');

  // Initialize mock database
  const db = new MockDatabase() as any;

  // Initialize core services with mock validator endpoint
  const validatorEndpoint = 'http://mock-validator:8080';
  const participation = new ParticipationScoreService(validatorEndpoint);
  const search = new SearchEngine('test-documents');
  const validation = new ValidationService(validatorEndpoint);

  // Initialize documentation service
  const documentation = new DocumentationService(
    db,
    search,
    participation,
    validation,
  );

  // Initialize forum service without real initialization
  const forum = new P2PForumService(db, participation);
  // Don't call forum.initialize() in unit tests

  // Initialize support service without real initialization
  const support = new VolunteerSupportService(db, participation);
  // Don't call support.initialize() in unit tests

  return {
    db,
    documentation,
    forum,
    support,
    participation,
    search,
    validation,
  };
}

/**
 * Teardown unit test services
 * Cleans up all resources
 */
export async function teardownUnitTestServices(): Promise<void> {
  if (unitTestServices) {
    try {
      // MockDatabase doesn't need closing
      unitTestServices = null;
      logger.info('Unit test services torn down successfully');
    } catch (error) {
      logger.error('Error tearing down unit test services:', error);
      throw error;
    }
  }
}

/**
 * Get unit test services instance
 * Returns existing instance or creates new one
 */
export async function getUnitTestServices(): Promise<DocumentServices> {
  if (!unitTestServices) {
    unitTestServices = await setupUnitTestServices();
  }
  return unitTestServices;
}

/**
 * Generate test document data
 */
export function generateTestDocument(overrides?: Partial<any>): any {
  return {
    title: 'Test Document',
    content: 'Test content',
    category: 'getting_started', // Use valid DocumentCategory value
    authorAddress: TEST_USERS.alice, // Use correct property name
    tags: ['test', 'documentation'],
    language: 'en',
    ...overrides,
  };
}

/**
 * Generate test thread data
 */
export function generateTestThread(overrides?: Partial<any>): any {
  return {
    title: 'Test Thread',
    content: 'Test thread content',
    category: 'general',
    authorAddress: TEST_USERS.alice, // Use correct property name
    tags: ['test', 'forum'],
    ...overrides,
  };
}

/**
 * Generate test support request data
 */
export function generateTestSupportRequest(overrides?: Partial<any>): any {
  return {
    requestId: `req-${Date.now()}`,
    userAddress: TEST_USERS.alice,
    category: 'general',
    priority: 'medium',
    initialMessage: 'Test support request',
    language: 'en',
    userScore: 75,
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Test helpers for unit tests
 */
export const testHelpers = {
  /** Wait for async operations */
  async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  },

  /** Clear all mock data */
  clearMockData(db: MockDatabase): void {
    db.clearAllMockResponses();
  },

  /** Assert document structure */
  assertDocument(doc: any): void {
    expect(doc).toBeDefined();
    expect(doc.id).toBeDefined();
    expect(typeof doc.id).toBe('string');
    expect(doc.title).toBeDefined();
    expect(doc.content).toBeDefined();
    expect(doc.category).toBeDefined();
    expect(doc.authorAddress).toBeDefined();
    expect(doc.createdAt).toBeDefined();
    expect(doc.updatedAt).toBeDefined();
  },

  /** Assert thread structure */
  assertThread(thread: any): void {
    expect(thread).toBeDefined();
    expect(thread.id).toBeDefined();
    expect(typeof thread.id).toBe('string');
    expect(thread.title).toBeDefined();
    // Note: ForumThread doesn't have content field - content is stored as the first post
    expect(thread.category).toBeDefined();
    expect(thread.authorAddress).toBeDefined();
    expect(thread.createdAt).toBeDefined();
    expect(thread.updatedAt).toBeDefined();
  },
};

/**
 * Clean test data (no-op for mock database)
 */
export async function cleanTestData(_db: any): Promise<void> {
  // No-op for mock database
  return Promise.resolve();
}