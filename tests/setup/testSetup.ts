/**
 * Test Setup and Configuration
 * 
 * Provides test environment configuration and utilities for the Documents module tests.
 * Uses real services instead of mocks whenever possible for true integration testing.
 * 
 * @module tests/setup/testSetup
 */

import { Database, DatabaseConfig } from '../../src/services/database/Database';
import { DocumentServices, initializeDocumentServices } from '../../src/services';
import { logger } from '../../src/utils/logger';

/**
 * Test database configuration
 * Uses environment variables or defaults for local testing
 */
export const TEST_DB_CONFIG: DatabaseConfig = {
  host: process.env.TEST_DB_HOST || '127.0.1.1', // WSL YugabyteDB binding
  port: parseInt(process.env.TEST_DB_PORT || '5433'),
  database: process.env.TEST_DB_NAME || 'omnibazaar_docs_test',
  user: process.env.TEST_DB_USER || 'yugabyte',
  password: process.env.TEST_DB_PASSWORD || 'yugabyte',
  max: 10, // Smaller pool for tests
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
};

/**
 * Test validator endpoint
 * Points to local validator instance or test environment
 */
export const TEST_VALIDATOR_ENDPOINT = process.env.TEST_VALIDATOR_ENDPOINT || 'http://localhost:8080';

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
 */
export const TEST_USERS = {
  alice: 'test-user-alice-' + Date.now(),
  bob: 'test-user-bob-' + Date.now(),
  charlie: 'test-user-charlie-' + Date.now(),
  volunteer: 'test-volunteer-' + Date.now(),
  moderator: 'test-moderator-' + Date.now(),
  admin: 'test-admin-' + Date.now(),
};

/**
 * Global test services instance
 */
let testServices: DocumentServices | null = null;

/**
 * Initialize test services
 * Creates a fresh instance of all services with test configuration
 */
export async function setupTestServices(): Promise<DocumentServices> {
  // Clean up any existing services
  await teardownTestServices();
  
  try {
    // Set test environment variables
    process.env.VALIDATOR_API_ENDPOINT = TEST_VALIDATOR_ENDPOINT;
    process.env.IPFS_API_ENDPOINT = TEST_IPFS_ENDPOINT;
    process.env.NODE_ENV = 'test';
    
    // Initialize services
    testServices = await initializeDocumentServices({
      database: TEST_DB_CONFIG,
      cache: {
        size: 100,
        ttl: 60,
      },
    });
    
    // Run database migrations
    await runDatabaseMigrations(testServices.db);
    
    // Seed test data if needed
    await seedTestData(testServices.db);
    
    logger.info('Test services initialized successfully');
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
      
      // Close database connection
      if (testServices.db) {
        await testServices.db.close();
      }
      
      testServices = null;
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

/**
 * Run database migrations
 * Creates necessary tables and indexes
 */
async function runDatabaseMigrations(db: Database): Promise<void> {
  // Documentation tables - matches DocumentationService schema
  await db.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR(100) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      content TEXT NOT NULL,
      category VARCHAR(50) NOT NULL,
      language VARCHAR(10) NOT NULL DEFAULT 'en',
      version INTEGER DEFAULT 1,
      author_address VARCHAR(42) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      tags TEXT[] DEFAULT '{}',
      is_official BOOLEAN DEFAULT false,
      view_count INTEGER DEFAULT 0,
      rating DECIMAL(3,2) DEFAULT 0,
      attachments JSONB DEFAULT '[]',
      search_vector tsvector
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS document_ratings (
      document_id VARCHAR(100) REFERENCES documents(id),
      user_address VARCHAR(42),
      rating INTEGER CHECK (rating >= 1 AND rating <= 5),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (document_id, user_address)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS document_contributions (
      id VARCHAR(100) PRIMARY KEY,
      document_id VARCHAR(100) REFERENCES documents(id),
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      category VARCHAR(50) NOT NULL,
      language VARCHAR(10) DEFAULT 'en',
      tags TEXT[] DEFAULT '{}',
      contributor_address VARCHAR(42) NOT NULL,
      change_description TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS document_update_proposals (
      proposal_id VARCHAR(100) PRIMARY KEY,
      document_id VARCHAR(100) REFERENCES documents(id),
      new_content TEXT NOT NULL,
      new_metadata JSONB,
      proposer_address VARCHAR(42) NOT NULL,
      votes_yes INTEGER DEFAULT 0,
      votes_no INTEGER DEFAULT 0,
      votes_abstain INTEGER DEFAULT 0,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL
    )
  `);

  // Create documentation_pages for backward compatibility with forum/support
  await db.query(`
    CREATE TABLE IF NOT EXISTS documentation_pages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      category VARCHAR(100) NOT NULL,
      tags TEXT[],
      author_id VARCHAR(255) NOT NULL,
      language VARCHAR(10) DEFAULT 'en',
      version INTEGER DEFAULT 1,
      ipfs_hash VARCHAR(255),
      consensus_hash VARCHAR(255),
      status VARCHAR(50) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      published_at TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
    CREATE INDEX IF NOT EXISTS idx_documents_author ON documents(author_address);
    CREATE INDEX IF NOT EXISTS idx_documents_language ON documents(language);
    CREATE INDEX IF NOT EXISTS idx_documents_official ON documents(is_official);
    CREATE INDEX IF NOT EXISTS idx_documents_rating ON documents(rating);
    CREATE INDEX IF NOT EXISTS idx_documents_views ON documents(view_count);
    CREATE INDEX IF NOT EXISTS idx_documents_search ON documents USING gin(search_vector);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_documentation_category ON documentation_pages(category);
    CREATE INDEX IF NOT EXISTS idx_documentation_author ON documentation_pages(author_id);
    CREATE INDEX IF NOT EXISTS idx_documentation_language ON documentation_pages(language);
    CREATE INDEX IF NOT EXISTS idx_documentation_status ON documentation_pages(status);
  `);

  // Forum tables
  await db.query(`
    CREATE TABLE IF NOT EXISTS forum_threads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      author_id VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      tags TEXT[],
      view_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      last_reply_at TIMESTAMP,
      is_pinned BOOLEAN DEFAULT FALSE,
      is_locked BOOLEAN DEFAULT FALSE,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id UUID REFERENCES forum_threads(id) ON DELETE CASCADE,
      author_id VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      parent_id UUID REFERENCES forum_posts(id),
      upvotes INTEGER DEFAULT 0,
      downvotes INTEGER DEFAULT 0,
      is_solution BOOLEAN DEFAULT FALSE,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_forum_threads_category ON forum_threads(category);
    CREATE INDEX IF NOT EXISTS idx_forum_threads_author ON forum_threads(author_id);
    CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts(thread_id);
    CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON forum_posts(author_id);
  `);

  // Support tables
  await db.query(`
    CREATE TABLE IF NOT EXISTS support_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      priority VARCHAR(50) DEFAULT 'normal',
      status VARCHAR(50) DEFAULT 'open',
      assigned_volunteer_id VARCHAR(255),
      resolution TEXT,
      rating INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS support_volunteers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      expertise TEXT[],
      languages TEXT[],
      availability VARCHAR(50) DEFAULT 'available',
      rating DECIMAL(3,2) DEFAULT 0,
      total_sessions INTEGER DEFAULT 0,
      successful_resolutions INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS support_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID REFERENCES support_requests(id),
      volunteer_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP,
      duration_minutes INTEGER,
      messages_count INTEGER DEFAULT 0,
      resolution_status VARCHAR(50),
      user_rating INTEGER,
      volunteer_notes TEXT
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_support_requests_user ON support_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_support_requests_volunteer ON support_requests(assigned_volunteer_id);
    CREATE INDEX IF NOT EXISTS idx_support_volunteers_user ON support_volunteers(user_id);
    CREATE INDEX IF NOT EXISTS idx_support_sessions_request ON support_sessions(request_id);
  `);

  logger.info('Database migrations completed');
}

/**
 * Seed test data
 * Creates initial test data for consistent testing
 */
async function seedTestData(db: Database): Promise<void> {
  // Clean existing test data
  await cleanTestData(db);
  
  // Insert test volunteers
  await db.query(`
    INSERT INTO support_volunteers (user_id, name, expertise, languages, rating, total_sessions)
    VALUES
      ($1, 'Test Volunteer', ARRAY['general', 'technical'], ARRAY['en', 'es'], 4.5, 10),
      ($2, 'Expert Volunteer', ARRAY['technical', 'blockchain'], ARRAY['en'], 4.8, 25)
  `, [TEST_USERS.volunteer, TEST_USERS.moderator]);

  logger.info('Test data seeded');
}

/**
 * Clean test data
 * Removes all test-related data from database
 */
export async function cleanTestData(db: Database): Promise<void> {
  const testUserIds = Object.values(TEST_USERS);
  const placeholders = testUserIds.map((_, i) => `$${i + 1}`).join(', ');
  
  // Delete in reverse order of foreign key dependencies
  await db.query(`DELETE FROM support_sessions WHERE user_id IN (${placeholders}) OR volunteer_id IN (${placeholders})`, testUserIds);
  await db.query(`DELETE FROM support_requests WHERE user_id IN (${placeholders}) OR assigned_volunteer_id IN (${placeholders})`, testUserIds);
  await db.query(`DELETE FROM support_volunteers WHERE user_id IN (${placeholders})`, testUserIds);
  await db.query(`DELETE FROM forum_posts WHERE author_id IN (${placeholders})`, testUserIds);
  await db.query(`DELETE FROM forum_threads WHERE author_id IN (${placeholders})`, testUserIds);
  await db.query(`DELETE FROM documentation_pages WHERE author_id IN (${placeholders})`, testUserIds);
  
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
  return {
    title: 'Test Document ' + Date.now(),
    description: 'Test document description',
    content: 'This is test content for automated testing.',
    category: 'getting_started',
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
    authorId: TEST_USERS.bob,
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
    expect(thread).toHaveProperty('content');
    expect(thread).toHaveProperty('authorId');
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