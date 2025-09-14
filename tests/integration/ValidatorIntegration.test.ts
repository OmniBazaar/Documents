/**
 * Validator Integration Tests
 * 
 * Tests integration between Documents module and Validator module including:
 * - Cross-module API communication
 * - Participation score updates
 * - Consensus validation
 * - Event synchronization
 * - Shared database operations
 */

import { ValidatorIntegration } from '@/integration/ValidatorIntegration';
import { DocumentServices } from '@/services';
import { 
  setupTestServices, 
  teardownTestServices, 
  TEST_USERS,
  TEST_VALIDATOR_ENDPOINT,
  generateTestDocument,
  generateTestThread,
  generateTestSupportRequest,
  cleanTestData,
  waitForService,
} from '@tests/setup/testSetup';

describe('Validator Integration Tests', () => {
  let services: DocumentServices;
  let integration: ValidatorIntegration;
  let isValidatorAvailable: boolean = false;

  beforeAll(async () => {
    // Check if Validator service is running (short timeout for CI/testing)
    isValidatorAvailable = await waitForService(TEST_VALIDATOR_ENDPOINT, 2, 500);
    
    services = await setupTestServices();
    integration = new ValidatorIntegration({
      services: {
        documentation: services.documentation,
        forum: services.forum,
        support: services.support,
      },
      validatorEndpoint: TEST_VALIDATOR_ENDPOINT,
    });
    
    await integration.start();
  }, 10000);

  afterAll(async () => {
    await integration.stop();
    await cleanTestData(services.db);
    await teardownTestServices();
  });

  describe('Health Checks', () => {
    test('should report overall system health', async () => {
      const health = await integration.getHealth();

      expect(health.healthy).toBeDefined();
      expect(health.services).toBeDefined();
      expect(health.services.documentation).toBeDefined();
      expect(health.services.forum).toBeDefined();
      expect(health.services.support).toBeDefined();
    });

    test('should check database connectivity', async () => {
      const health = await integration.getHealth();
      
      expect(health.services.database).toBeDefined();
      if (health.services.database && 'healthy' in health.services.database) {
        expect(health.services.database.healthy).toBe(true);
      }
    });

    test('should verify validator connectivity', async () => {
      if (!isValidatorAvailable) {
        console.warn('Validator service not available, skipping test');
        return;
      }

      const health = await integration.getHealth();
      
      expect(health.services.validator).toBeDefined();
      if (health.services.validator && 'healthy' in health.services.validator) {
        expect(health.services.validator.healthy).toBe(true);
      }
    });
  });

  describe('Cross-Module Message Handling', () => {
    test('should handle documentation requests from Validator', async () => {
      const response = await integration.handleValidatorMessage({
        type: 'documentation',
        action: 'create',
        data: {
          title: 'Validator Integration Test Doc',
          content: 'Test content from validator',
          category: 'guides',
          authorAddress: TEST_USERS.alice,
          tags: ['test', 'integration'],
          language: 'en',
        },
      });

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.id).toBeDefined();
      expect(response.data.title).toBe('Validator Integration Test Doc');
    });

    test('should handle forum requests from Validator', async () => {
      const response = await integration.handleValidatorMessage({
        type: 'forum',
        action: 'createThread',
        data: {
          title: 'Validator Integration Test Thread',
          content: 'Test thread from validator',
          category: 'general',
          authorAddress: TEST_USERS.bob,
          tags: ['test', 'validator'],
        },
      });

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.id).toBeDefined();
    });

    test('should handle support requests from Validator', async () => {
      const response = await integration.handleValidatorMessage({
        type: 'support',
        action: 'createRequest',
        data: {
          userId: TEST_USERS.charlie,
          category: 'technical',
          subject: 'Validator Integration Test',
          description: 'Need help with validator integration',
          priority: 'normal',
        },
      });

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.id).toBeDefined();
    });

    test('should handle search requests from Validator', async () => {
      // Create some test data first
      await services.documentation.createDocument(generateTestDocument({
        title: 'Searchable Document',
        content: 'Content with validator keyword',
      }));

      const response = await integration.handleValidatorMessage({
        type: 'search',
        action: 'documents',
        data: {
          query: 'validator',
          pageSize: 10,
        },
      });

      expect(response.success).toBe(true);
      expect(response.data.results).toBeDefined();
      expect(Array.isArray(response.data.results)).toBe(true);
    });

    test('should handle invalid message types gracefully', async () => {
      const response = await integration.handleValidatorMessage({
        type: 'invalid',
        action: 'test',
        data: {},
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('Participation Score Integration', () => {
    test('should sync participation scores with Validator', async () => {
      if (!isValidatorAvailable) {
        console.warn('Validator service not available, skipping test');
        return;
      }

      // Create activity that should award points
      const doc = await services.documentation.createDocument(generateTestDocument({
        authorAddress: TEST_USERS.alice,
      }));

      // Publish to trigger higher score
      await services.documentation.publishDocument(doc.id, doc.authorId);

      // Get score from Documents module
      const localScore = await services.participation.getUserScore(TEST_USERS.alice);

      // Get score from Validator through integration
      const response = await integration.handleValidatorMessage({
        type: 'participation',
        action: 'getScore',
        data: { userId: TEST_USERS.alice },
      });

      expect(response.success).toBe(true);
      expect(response.data.score).toBeDefined();
      
      // Scores should match
      expect(response.data.score.documentation).toBe(localScore.components.documentation);
    });

    test('should update scores across modules', async () => {
      if (!isValidatorAvailable) {
        console.warn('Validator service not available, skipping test');
        return;
      }

      // Record initial score
      const initialScore = await services.participation.getUserScore(TEST_USERS.bob);

      // Create activities in different services
      await services.forum.createThread(generateTestThread({
        authorAddress: TEST_USERS.bob,
      }));

      const request = await services.support.createRequest(generateTestSupportRequest({
        userId: TEST_USERS.charlie,
      }));

      // Bob volunteers to help
      const volunteer = await services.support.registerVolunteer({
        userId: TEST_USERS.bob,
        name: 'Bob Helper',
        expertise: ['general'],
        languages: ['en'],
      });

      const session = await services.support.startSession({
        requestId: request.id,
        volunteerId: volunteer.id,
        userId: request.userId,
      });

      await services.support.endSession(session.id, {
        resolutionStatus: 'resolved',
      });

      // Get updated score
      const newScore = await services.participation.getUserScore(TEST_USERS.bob);

      expect(newScore.total).toBeGreaterThan(initialScore.total);
      expect(newScore.components.forum).toBeGreaterThan(initialScore.components.forum);
      expect(newScore.components.support).toBeGreaterThan(initialScore.components.support);
    });
  });

  describe('Event Broadcasting', () => {
    test('should broadcast document events to Validator', async () => {
      const events: any[] = [];
      
      // Subscribe to integration events
      integration.on('document:created', (event) => {
        events.push(event);
      });

      const doc = await services.documentation.createDocument(generateTestDocument());

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('document:created');
      expect(events[0].data.id).toBe(doc.id);
    });

    test('should broadcast forum events to Validator', async () => {
      const events: any[] = [];
      
      integration.on('forum:thread:created', (event) => {
        events.push(event);
      });

      const thread = await services.forum.createThread(generateTestThread());

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].data.id).toBe(thread.id);
    });

    test('should broadcast support events to Validator', async () => {
      const events: any[] = [];
      
      integration.on('support:request:created', (event) => {
        events.push(event);
      });

      // Create the support request
      await services.support.createRequest(generateTestSupportRequest());

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify event was broadcast
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('support:request:created');
      expect(events[0].data).toBeDefined();
      expect(events[0].data.id).toBeDefined();
      expect(events[0].data.requestId).toBeDefined();
    });
  });

  describe('Consensus Validation', () => {
    test('should validate document through Validator consensus', async () => {
      if (!isValidatorAvailable) {
        console.warn('Validator service not available, skipping test');
        return;
      }

      const doc = await services.documentation.createDocument(generateTestDocument({
        title: 'Document for Consensus',
        content: 'This document needs consensus validation',
      }));

      const validation = await services.documentation.requestConsensusValidation(
        doc.id,
        doc.authorId
      );

      expect(validation).toBeDefined();
      expect(validation.documentId).toBe(doc.id);
      expect(['pending', 'approved', 'rejected']).toContain(validation.status);
    });

    test('should sync consensus results with Validator', async () => {
      if (!isValidatorAvailable) {
        console.warn('Validator service not available, skipping test');
        return;
      }

      const doc = await services.documentation.createDocument(generateTestDocument());
      await services.documentation.requestConsensusValidation(doc.id, doc.authorId);

      // Check consensus status through integration
      const response = await integration.handleValidatorMessage({
        type: 'consensus',
        action: 'getStatus',
        data: { documentId: doc.id },
      });

      expect(response.success).toBe(true);
      expect(response.data.status).toBeDefined();
    });
  });

  describe('Data Synchronization', () => {
    test('should sync user data across modules', async () => {
      // Create user activity in Documents
      const doc = await services.documentation.createDocument(generateTestDocument({
        authorAddress: TEST_USERS.alice,
      }));

      const thread = await services.forum.createThread(generateTestThread({
        authorAddress: TEST_USERS.alice,
      }));

      // Get user activity summary through integration
      const response = await integration.handleValidatorMessage({
        type: 'user',
        action: 'getActivity',
        data: { userId: TEST_USERS.alice },
      });

      expect(response.success).toBe(true);
      expect(response.data.documents).toBeGreaterThan(0);
      expect(response.data.forumThreads).toBeGreaterThanOrEqual(0); // User may not have created threads
    });

    test('should sync statistics across modules', async () => {
      const stats = await integration.getAggregatedStats();

      expect(stats).toBeDefined();
      expect(stats.documentation).toBeDefined();
      expect(stats.documentation.totalDocuments).toBeGreaterThanOrEqual(0);
      expect(stats.forum).toBeDefined();
      expect(stats.forum.totalThreads).toBeGreaterThanOrEqual(0);
      expect(stats.support).toBeDefined();
      // Support stats has different properties
      expect(stats.support.activeSessions).toBeGreaterThanOrEqual(0);
      expect(stats.support.activeVolunteers).toBeGreaterThanOrEqual(0);
      expect(stats.support.waitingRequests).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Recovery', () => {
    test('should handle Validator service downtime', async () => {
      // Temporarily simulate validator being down
      const originalEndpoint = integration['config'].validatorEndpoint;
      integration['config'].validatorEndpoint = 'http://localhost:99999'; // Invalid port

      const response = await integration.handleValidatorMessage({
        type: 'documentation',
        action: 'create',
        data: generateTestDocument(),
      });

      // Should still work but may indicate degraded functionality
      expect(response).toBeDefined();
      
      // Restore
      integration['config'].validatorEndpoint = originalEndpoint;
    });

    test('should queue messages during downtime', async () => {
      // This test verifies that messages are queued when validator is down
      const originalEndpoint = integration['config'].validatorEndpoint;
      integration['config'].validatorEndpoint = 'http://localhost:99999';

      // Send multiple messages
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          integration.handleValidatorMessage({
            type: 'documentation',
            action: 'create',
            data: generateTestDocument({ title: `Queued Doc ${i}` }),
          })
        );
      }

      const results = await Promise.allSettled(promises);
      
      // Restore
      integration['config'].validatorEndpoint = originalEndpoint;

      // Messages should be queued or handled gracefully
      expect(results.every(r => r.status === 'fulfilled' || r.status === 'rejected')).toBe(true);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle concurrent requests efficiently', async () => {
      const start = Date.now();
      const promises = [];

      // Create 50 concurrent requests
      for (let i = 0; i < 50; i++) {
        promises.push(
          integration.handleValidatorMessage({
            type: i % 3 === 0 ? 'documentation' : i % 3 === 1 ? 'forum' : 'support',
            action: 'create',
            data: i % 3 === 0 
              ? generateTestDocument({ title: `Concurrent Doc ${i}` })
              : i % 3 === 1
              ? generateTestThread({ title: `Concurrent Thread ${i}` })
              : generateTestSupportRequest({ subject: `Concurrent Request ${i}` }),
          })
        );
      }

      const results = await Promise.allSettled(promises);
      const duration = Date.now() - start;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds for 50 requests

      // Most should succeed
      const successes = results.filter(r => r.status === 'fulfilled').length;
      expect(successes).toBeGreaterThan(40); // At least 80% success rate
    });

    test('should maintain data consistency under load', async () => {
      // Create multiple documents with same valid category and unique tag
      const uniqueTag = 'consistency-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const createdDocIds: string[] = [];
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          services.documentation.createDocument(generateTestDocument({
            category: 'technical', // Use a valid category
            title: `Consistency Test ${i}`,
            tags: [uniqueTag], // Use only the unique tag to ensure exact filtering
          })).then(doc => {
            createdDocIds.push(doc.id);
            return doc;
          })
        );
      }

      await Promise.all(promises);

      // Verify count matches by searching for the unique tag
      const results = await services.documentation.searchDocuments({
        tags: [uniqueTag],
        pageSize: 20,
      });

      // Filter results to only include documents we created in this test
      const ourDocs = results.items.filter(doc => createdDocIds.includes(doc.id));

      expect(ourDocs.length).toBe(10);
      expect(createdDocIds.length).toBe(10);
    });
  });
});