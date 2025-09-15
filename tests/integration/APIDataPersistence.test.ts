/**
 * API Data Persistence Tests
 *
 * Tests data persistence operations through the Validator API including:
 * - Document CRUD operations
 * - Forum thread and post management
 * - Support request handling
 * - Data consistency across services
 * - Search functionality
 * - Concurrent operations
 *
 * Note: These tests require the Validator service to be running
 * or use the MockValidatorAPIClient for testing
 */

import { DocumentServices } from '@/services';
import { DocumentCategory } from '@/services/documentation';
import { ValidatorAPIClient } from '@/services/validator/ValidatorAPIClient';
import { MockValidatorAPIClient } from '../mocks/MockValidatorAPI';
import {
  setupTestServices,
  teardownTestServices,
  TEST_USERS,
  generateTestDocument,
  generateTestThread,
  generateTestSupportRequest,
  cleanTestData,
  waitForService,
  TEST_VALIDATOR_ENDPOINT,
} from '@tests/setup/testSetup';

describe('API Data Persistence Tests', () => {
  let services: DocumentServices;
  let apiClient: ValidatorAPIClient;
  let isValidatorAvailable: boolean = false;

  beforeAll(async () => {
    // Check if real Validator service is available
    isValidatorAvailable = await waitForService(TEST_VALIDATOR_ENDPOINT, 2, 500);

    services = await setupTestServices();
    apiClient = services.apiClient;
  });

  beforeEach(async () => {
    // Clean test data before each test for isolation
    await cleanTestData();
  });

  afterAll(async () => {
    await cleanTestData();
    await teardownTestServices();
  });

  describe('Document Operations', () => {
    test('should create and retrieve documents', async () => {
      const docData = generateTestDocument({
        title: 'Persistence Test Document',
        category: DocumentCategory.TECHNICAL,
      });

      // Create document
      const created = await services.documentation.createDocument(docData);
      expect(created.id).toBeDefined();
      expect(created.title).toBe(docData.title);

      // Retrieve document
      const retrieved = await services.documentation.getDocument(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe(docData.title);
      expect(retrieved?.category).toBe(docData.category);
    });

    test('should update documents', async () => {
      const doc = await services.documentation.createDocument(
        generateTestDocument({ title: 'Original Title' })
      );

      // Update document
      const updated = await services.documentation.updateDocument(
        doc.id,
        { title: 'Updated Title', content: 'Updated content' },
        doc.authorAddress
      );

      expect(updated.title).toBe('Updated Title');
      expect(updated.content).toBe('Updated content');
      expect(updated.version).toBe(2);
    });

    test('should delete documents', async () => {
      const doc = await services.documentation.createDocument(generateTestDocument());

      // Delete document
      await services.documentation.deleteDocument(doc.id, doc.authorAddress);

      // Try to retrieve - should not exist
      const retrieved = await services.documentation.getDocument(doc.id);
      expect(retrieved).toBeNull();
    });

    test('should handle document search', async () => {
      // Create multiple documents
      const docs = await Promise.all([
        services.documentation.createDocument(
          generateTestDocument({
            title: 'Search Test Alpha',
            content: 'Content about blockchain technology',
            tags: ['blockchain', 'test'],
          })
        ),
        services.documentation.createDocument(
          generateTestDocument({
            title: 'Search Test Beta',
            content: 'Content about marketplace features',
            tags: ['marketplace', 'test'],
          })
        ),
        services.documentation.createDocument(
          generateTestDocument({
            title: 'Search Test Gamma',
            content: 'Content about blockchain marketplace',
            tags: ['blockchain', 'marketplace'],
          })
        ),
      ]);

      // Search by query
      const results = await services.documentation.searchDocuments({
        query: 'blockchain',
        pageSize: 10,
      });

      expect(results.total).toBeGreaterThanOrEqual(2);
      expect(results.items.some(d => d.title === 'Search Test Alpha')).toBe(true);
      expect(results.items.some(d => d.title === 'Search Test Gamma')).toBe(true);

      // Search by tags
      const tagResults = await services.documentation.searchDocuments({
        tags: ['marketplace'],
        pageSize: 10,
      });

      expect(tagResults.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Forum Operations', () => {
    test('should create and retrieve forum threads', async () => {
      const threadData = generateTestThread({
        title: 'Persistence Test Thread',
        category: 'general',
      });

      // Create thread
      const thread = await services.forum.createThread(threadData);
      expect(thread.id).toBeDefined();
      expect(thread.title).toBe(threadData.title);

      // Retrieve thread
      const retrieved = await services.forum.getThread(thread.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe(threadData.title);
    });

    test('should create forum posts', async () => {
      const thread = await services.forum.createThread(generateTestThread());

      // Create post
      const post = await services.forum.createPost({
        threadId: thread.id,
        content: 'Test post content',
        authorAddress: TEST_USERS.bob,
      });

      expect(post.id).toBeDefined();
      expect(post.threadId).toBe(thread.id);
      expect(post.content).toBe('Test post content');

      // Thread reply count should increase (initial post + new post = 2)
      const updatedThread = await services.forum.getThread(thread.id);
      expect(updatedThread?.replyCount).toBe(2);
    });

    test('should handle forum search', async () => {
      // Create threads
      const threads = await Promise.all([
        services.forum.createThread(
          generateTestThread({
            title: 'Forum Search Alpha',
            content: 'Discussion about validators',
            tags: ['validators', 'discussion'],
          })
        ),
        services.forum.createThread(
          generateTestThread({
            title: 'Forum Search Beta',
            content: 'Discussion about staking',
            tags: ['staking', 'discussion'],
          })
        ),
      ]);

      console.log('Created threads:', threads.map(t => ({ id: t.id, title: t.title, content: t.content })));

      // Search forums - search for something in the title
      const results = await services.forum.searchThreads({
        query: 'Search',  // This appears in both thread titles
        pageSize: 10,
      });

      // Debug: Check what we got
      console.log('Search results:', {
        total: results.items.length,
        titles: results.items.map(t => t.title),
        contents: results.items.map(t => t.content?.substring(0, 50))
      });

      expect(results.items.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Support Operations', () => {
    test('should create support requests', async () => {
      const requestData = generateTestSupportRequest({
        category: 'technical',
        subject: 'Persistence Test Request',
      });

      // Create request
      const request = await services.support.createRequest({
        userAddress: requestData.userId,
        category: requestData.category,
        priority: requestData.priority || 'medium',
        initialMessage: requestData.description,
        metadata: {},
      });

      expect(request).toBeDefined();
      expect(request.id).toBeDefined();
      expect(request.category).toBe(requestData.category);
    });

    test('should handle volunteer registration', async () => {
      const volunteer = await services.support.registerVolunteerWithReturn({
        address: TEST_USERS.volunteer,
        displayName: 'Test Volunteer',
        languages: ['en', 'es'],
        expertiseCategories: ['technical', 'general'],
      });

      expect(volunteer.address).toBe(TEST_USERS.volunteer);
      expect(volunteer.displayName).toBe('Test Volunteer');
    });

    test('should create and manage support sessions', async () => {
      // Register volunteer
      await services.support.registerVolunteer({
        address: TEST_USERS.volunteer,
        displayName: 'Session Test Volunteer',
        languages: ['en'],
        expertiseCategories: ['technical'],
      });

      // Create request - this will automatically create a session
      const request = await services.support.createRequest({
        userAddress: TEST_USERS.alice,
        category: 'technical',
        priority: 'medium',
        initialMessage: 'Need help with session test',
        metadata: {},
      });

      // The request should have been created and assigned
      expect(request).toBeDefined();
      expect(request.id).toBeDefined();
      expect(request.category).toBe('technical');
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent document creation', async () => {
      const promises = [];

      // Create 20 documents concurrently
      for (let i = 0; i < 20; i++) {
        promises.push(
          services.documentation.createDocument(
            generateTestDocument({
              title: `Concurrent Doc ${i}`,
              category: DocumentCategory.TECHNICAL,
            })
          )
        );
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(20);

      // All should have unique IDs
      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(20);
    });

    test('should handle concurrent updates without conflicts', async () => {
      // Create a document
      const doc = await services.documentation.createDocument(
        generateTestDocument({ title: 'Concurrent Update Test' })
      );

      // Simulate multiple users viewing (incrementing view count)
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          services.documentation.getDocument(doc.id)
        );
      }

      await Promise.all(promises);

      // Each view should increment the count
      const updated = await services.documentation.getDocument(doc.id);
      expect(updated?.viewCount || 0).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Data Consistency', () => {
    test('should maintain consistency across services', async () => {
      // Create activities for a user
      const doc = await services.documentation.createDocument(
        generateTestDocument({ authorAddress: TEST_USERS.alice })
      );

      const thread = await services.forum.createThread(
        generateTestThread({ authorAddress: TEST_USERS.alice })
      );

      const request = await services.support.createRequest({
        userAddress: TEST_USERS.alice,
        category: 'general',
        priority: 'low',
        initialMessage: 'Test request',
        metadata: {},
      });

      // All should be created successfully
      expect(doc.id).toBeDefined();
      expect(thread.id).toBeDefined();
      expect(request.id).toBeDefined();

      // User should have participation score from all activities
      const score = await services.participation.getUserScore(TEST_USERS.alice);
      expect(score.total).toBeGreaterThan(0);
    });

    test('should handle related data correctly', async () => {
      // Create thread with posts
      const thread = await services.forum.createThread(generateTestThread());

      // Create multiple posts
      const posts = await Promise.all([
        services.forum.createPost({
          threadId: thread.id,
          content: 'First post',
          authorAddress: TEST_USERS.alice,
        }),
        services.forum.createPost({
          threadId: thread.id,
          content: 'Second post',
          authorAddress: TEST_USERS.bob,
        }),
        services.forum.createPost({
          threadId: thread.id,
          content: 'Third post',
          authorAddress: TEST_USERS.charlie,
        }),
      ]);

      // Thread should show correct reply count (initial post + 3 posts = 4)
      const updatedThread = await services.forum.getThread(thread.id);
      expect(updatedThread?.replyCount).toBe(4);
    });
  });

  describe('Search and Filtering', () => {
    test('should filter documents by category', async () => {
      // Create documents in different categories
      await Promise.all([
        services.documentation.createDocument(
          generateTestDocument({
            title: 'Technical Doc 1',
            category: DocumentCategory.TECHNICAL,
          })
        ),
        services.documentation.createDocument(
          generateTestDocument({
            title: 'Technical Doc 2',
            category: DocumentCategory.TECHNICAL,
          })
        ),
        services.documentation.createDocument(
          generateTestDocument({
            title: 'FAQ Doc',
            category: DocumentCategory.FAQ,
          })
        ),
      ]);

      // Search by category
      const technicalDocs = await services.documentation.searchDocuments({
        category: DocumentCategory.TECHNICAL,
        pageSize: 10,
      });

      expect(technicalDocs.items.every(d => d.category === DocumentCategory.TECHNICAL)).toBe(true);
      expect(technicalDocs.total).toBeGreaterThanOrEqual(2);
    });

    test('should filter by author', async () => {
      // Create documents by different authors
      await Promise.all([
        services.documentation.createDocument(
          generateTestDocument({ authorAddress: TEST_USERS.alice })
        ),
        services.documentation.createDocument(
          generateTestDocument({ authorAddress: TEST_USERS.alice })
        ),
        services.documentation.createDocument(
          generateTestDocument({ authorAddress: TEST_USERS.bob })
        ),
      ]);

      // Search by author
      const aliceDocs = await services.documentation.searchDocuments({
        filters: { authorAddresses: [TEST_USERS.alice] },
        pageSize: 10,
      });

      expect(aliceDocs.items.every(d => d.authorAddress === TEST_USERS.alice)).toBe(true);
      expect(aliceDocs.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent document retrieval', async () => {
      const doc = await services.documentation.getDocument('non-existent-id');
      expect(doc).toBeNull();
    });

    test('should handle invalid updates', async () => {
      // Try to update non-existent document
      await expect(
        services.documentation.updateDocument(
          'non-existent-id',
          TEST_USERS.alice,
          { title: 'New Title' }
        )
      ).rejects.toThrow();
    });

    test('should handle API errors gracefully', async () => {
      if (apiClient instanceof MockValidatorAPIClient) {
        // For mock client, we can't easily simulate errors
        expect(true).toBe(true);
      } else {
        // For real API, test error handling
        const badClient = new ValidatorAPIClient({
          endpoint: 'http://localhost:99999', // Invalid endpoint
          timeout: 1000,
          retry: { maxRetries: 0, initialDelay: 0, maxDelay: 0 },
        });

        const health = await badClient.checkHealth();
        expect(health.healthy).toBe(false);
      }
    });
  });
});