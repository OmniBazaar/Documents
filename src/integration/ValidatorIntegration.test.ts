/**
 * Tests for ValidatorIntegration
 * 
 * @module integration/ValidatorIntegration.test
 */

import { Database } from '../services/database/Database';
import { ParticipationScoreService } from '../../../Validator/src/services/ParticipationScoreService';
import { ValidatorIntegration } from './ValidatorIntegration';
import { DocumentationService } from '../services/documentation/DocumentationService';
import { P2PForumService } from '../services/forum/P2PForumService';
import { VolunteerSupportService } from '../services/support/VolunteerSupportService';
import { SearchEngine } from '../services/search/SearchEngine';
import { ValidationService } from '../services/validation/ValidationService';

describe('ValidatorIntegration', () => {
  let integration: ValidatorIntegration;
  let db: Database;
  let participationService: ParticipationScoreService;
  let docService: DocumentationService;
  let forumService: P2PForumService;
  let supportService: VolunteerSupportService;
  
  const testUserId = 'integration-user-123';
  const validatorEndpoint = 'http://localhost:8080';

  beforeEach(async () => {
    // Initialize all services
    db = new Database();
    participationService = new ParticipationScoreService(validatorEndpoint);
    
    // Documentation service
    const searchEngine = new SearchEngine('documents');
    const validationService = new ValidationService(validatorEndpoint);
    docService = new DocumentationService(db, searchEngine, participationService, validationService);
    
    // Forum service
    forumService = new P2PForumService(db, participationService);
    
    // Support service
    supportService = new VolunteerSupportService(db, participationService);
    
    // Create integration
    integration = new ValidatorIntegration(
      docService,
      forumService,
      supportService,
      participationService
    );
  });

  afterEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM documentation_pages WHERE author_id = $1', [testUserId]);
    await db.query('DELETE FROM forum_threads WHERE author_id = $1', [testUserId]);
    await db.query('DELETE FROM support_requests WHERE user_id = $1', [testUserId]);
  });

  describe('API Message Handling', () => {
    test('should handle documentation requests', async () => {
      // Create documentation
      const createResult = await integration.handleValidatorMessage({
        type: 'documentation',
        action: 'create',
        data: {
          title: 'Test Documentation',
          content: 'Test content',
          category: 'guides',
          tags: ['test'],
          authorId: testUserId,
          language: 'en'
        }
      });

      expect(createResult.success).toBe(true);
      expect(createResult.data.title).toBe('Test Documentation');

      // Search documentation
      const searchResult = await integration.handleValidatorMessage({
        type: 'documentation',
        action: 'search',
        data: {
          query: 'Test',
          limit: 10,
          offset: 0
        }
      });

      expect(searchResult.success).toBe(true);
      expect(searchResult.data.results).toBeDefined();
    });

    test('should handle forum requests', async () => {
      // Create thread
      const createResult = await integration.handleValidatorMessage({
        type: 'forum',
        action: 'createThread',
        data: {
          title: 'Test Thread',
          content: 'Test thread content',
          category: 'general',
          tags: ['test'],
          authorId: testUserId
        }
      });

      expect(createResult.success).toBe(true);
      expect(createResult.data.title).toBe('Test Thread');

      const threadId = createResult.data.id;

      // Create post
      const postResult = await integration.handleValidatorMessage({
        type: 'forum',
        action: 'createPost',
        data: {
          threadId,
          content: 'Test reply',
          authorId: 'user2'
        }
      });

      expect(postResult.success).toBe(true);
      expect(postResult.data.content).toBe('Test reply');
    });

    test('should handle support requests', async () => {
      // Register volunteer
      await integration.handleValidatorMessage({
        type: 'support',
        action: 'registerVolunteer',
        data: {
          userId: 'volunteer1',
          displayName: 'Test Volunteer',
          languages: ['en'],
          expertise: ['general'],
          availability: {}
        }
      });

      // Create support request
      const requestResult = await integration.handleValidatorMessage({
        type: 'support',
        action: 'createRequest',
        data: {
          userId: testUserId,
          category: 'general',
          language: 'en',
          priority: 'medium'
        }
      });

      expect(requestResult.success).toBe(true);
      expect(requestResult.data.userId).toBe(testUserId);
      expect(requestResult.data.status).toBe('pending');
    });

    test('should handle errors gracefully', async () => {
      const result = await integration.handleValidatorMessage({
        type: 'invalid',
        action: 'unknown',
        data: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown message type');
    });
  });

  describe('WebSocket Events', () => {
    test('should emit documentation events', async () => {
      const events: any[] = [];
      integration.on('documentation:created', (event) => events.push(event));

      await integration.handleValidatorMessage({
        type: 'documentation',
        action: 'create',
        data: {
          title: 'WebSocket Test',
          content: 'Testing events',
          category: 'guides',
          tags: ['websocket'],
          authorId: testUserId,
          language: 'en'
        }
      });

      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('WebSocket Test');
    });

    test('should emit forum events', async () => {
      const events: any[] = [];
      integration.on('forum:thread:created', (event) => events.push(event));

      await integration.handleValidatorMessage({
        type: 'forum',
        action: 'createThread',
        data: {
          title: 'Event Test Thread',
          content: 'Testing forum events',
          category: 'general',
          tags: ['events'],
          authorId: testUserId
        }
      });

      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Event Test Thread');
    });

    test('should emit support events', async () => {
      const events: any[] = [];
      integration.on('support:request:created', (event) => events.push(event));

      await integration.handleValidatorMessage({
        type: 'support',
        action: 'createRequest',
        data: {
          userId: testUserId,
          category: 'general',
          language: 'en',
          priority: 'high'
        }
      });

      expect(events).toHaveLength(1);
      expect(events[0].userId).toBe(testUserId);
      expect(events[0].priority).toBe('high');
    });
  });

  describe('HTTP Endpoints', () => {
    test('should provide documentation endpoints', () => {
      const endpoints = integration.getHttpEndpoints();
      
      expect(endpoints.documentation).toBeDefined();
      expect(endpoints.documentation.create).toBe('/api/documentation');
      expect(endpoints.documentation.search).toBe('/api/documentation/search');
      expect(endpoints.documentation.get).toBe('/api/documentation/:id');
      expect(endpoints.documentation.update).toBe('/api/documentation/:id');
      expect(endpoints.documentation.rate).toBe('/api/documentation/:id/rate');
    });

    test('should provide forum endpoints', () => {
      const endpoints = integration.getHttpEndpoints();
      
      expect(endpoints.forum).toBeDefined();
      expect(endpoints.forum.createThread).toBe('/api/forum/threads');
      expect(endpoints.forum.getThreads).toBe('/api/forum/threads');
      expect(endpoints.forum.createPost).toBe('/api/forum/threads/:threadId/posts');
      expect(endpoints.forum.vote).toBe('/api/forum/posts/:postId/vote');
      expect(endpoints.forum.search).toBe('/api/forum/search');
    });

    test('should provide support endpoints', () => {
      const endpoints = integration.getHttpEndpoints();
      
      expect(endpoints.support).toBeDefined();
      expect(endpoints.support.createRequest).toBe('/api/support/requests');
      expect(endpoints.support.getSession).toBe('/api/support/sessions/:id');
      expect(endpoints.support.sendMessage).toBe('/api/support/sessions/:id/messages');
      expect(endpoints.support.rateSession).toBe('/api/support/sessions/:id/rate');
      expect(endpoints.support.getVolunteers).toBe('/api/support/volunteers');
    });
  });

  describe('Cross-Service Integration', () => {
    test('should update participation scores across services', async () => {
      const initialScore = await participationService.getUserScore(testUserId);

      // Create documentation
      await integration.handleValidatorMessage({
        type: 'documentation',
        action: 'create',
        data: {
          title: 'Participation Test',
          content: 'Testing cross-service integration',
          category: 'guides',
          tags: ['test'],
          authorId: testUserId,
          language: 'en'
        }
      });

      // Create forum thread
      await integration.handleValidatorMessage({
        type: 'forum',
        action: 'createThread',
        data: {
          title: 'Forum Participation',
          content: 'Testing participation',
          category: 'general',
          tags: ['test'],
          authorId: testUserId
        }
      });

      const updatedScore = await participationService.getUserScore(testUserId);
      
      expect(updatedScore.documentation_contributions).toBeGreaterThan(
        initialScore.documentation_contributions
      );
      expect(updatedScore.forum_activity).toBeGreaterThan(
        initialScore.forum_activity
      );
      expect(updatedScore.total_score).toBeGreaterThan(
        initialScore.total_score
      );
    });

    test('should handle complex workflows', async () => {
      // User creates documentation
      const docResult = await integration.handleValidatorMessage({
        type: 'documentation',
        action: 'create',
        data: {
          title: 'How to Use Support',
          content: 'Guide for using support system',
          category: 'guides',
          tags: ['support', 'help'],
          authorId: testUserId,
          language: 'en'
        }
      });

      // User asks question in forum about the documentation
      const threadResult = await integration.handleValidatorMessage({
        type: 'forum',
        action: 'createThread',
        data: {
          title: 'Question about support guide',
          content: `I read the guide at ${docResult.data.slug} but need clarification`,
          category: 'questions',
          tags: ['support', 'documentation'],
          authorId: 'user2'
        }
      });

      // Original author responds
      await integration.handleValidatorMessage({
        type: 'forum',
        action: 'createPost',
        data: {
          threadId: threadResult.data.id,
          content: 'Let me clarify that section...',
          authorId: testUserId
        }
      });

      // Check that all activities are tracked
      const authorScore = await participationService.getUserScore(testUserId);
      const questionerScore = await participationService.getUserScore('user2');

      expect(authorScore.documentation_contributions).toBeGreaterThan(0);
      expect(authorScore.forum_activity).toBeGreaterThan(0);
      expect(questionerScore.forum_activity).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle database errors', async () => {
      // Simulate database error by closing connection
      await db.pool.end();

      const result = await integration.handleValidatorMessage({
        type: 'documentation',
        action: 'create',
        data: {
          title: 'Test',
          content: 'Test',
          category: 'guides',
          tags: [],
          authorId: testUserId,
          language: 'en'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('database');

      // Restore database for cleanup
      db.pool = db['createPool']();
    });

    test('should validate input data', async () => {
      const result = await integration.handleValidatorMessage({
        type: 'documentation',
        action: 'create',
        data: {
          // Missing required fields
          title: '',
          content: '',
          authorId: testUserId
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });

    test('should handle concurrent requests', async () => {
      const promises = [];
      
      // Create 10 concurrent documentation pages
      for (let i = 0; i < 10; i++) {
        promises.push(
          integration.handleValidatorMessage({
            type: 'documentation',
            action: 'create',
            data: {
              title: `Concurrent Doc ${i}`,
              content: `Content ${i}`,
              category: 'guides',
              tags: [`concurrent-${i}`],
              authorId: testUserId,
              language: 'en'
            }
          })
        );
      }

      const results = await Promise.all(promises);
      
      expect(results.every(r => r.success)).toBe(true);
      expect(new Set(results.map(r => r.data.slug)).size).toBe(10); // All unique slugs
    });
  });

  describe('Monitoring and Statistics', () => {
    test('should track service usage statistics', async () => {
      // Perform various operations
      await integration.handleValidatorMessage({
        type: 'documentation',
        action: 'create',
        data: {
          title: 'Stats Test',
          content: 'Testing statistics',
          category: 'guides',
          tags: ['stats'],
          authorId: testUserId,
          language: 'en'
        }
      });

      await integration.handleValidatorMessage({
        type: 'forum',
        action: 'createThread',
        data: {
          title: 'Stats Thread',
          content: 'Testing forum stats',
          category: 'general',
          tags: ['stats'],
          authorId: testUserId
        }
      });

      const stats = await integration.getServiceStatistics();
      
      expect(stats.documentation.totalPages).toBeGreaterThan(0);
      expect(stats.forum.totalThreads).toBeGreaterThan(0);
      expect(stats.support.totalRequests).toBeGreaterThanOrEqual(0);
      expect(stats.participation.activeUsers).toBeGreaterThan(0);
    });

    test('should track response times', async () => {
      const startTime = Date.now();
      
      await integration.handleValidatorMessage({
        type: 'documentation',
        action: 'search',
        data: {
          query: 'test',
          limit: 10,
          offset: 0
        }
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('should provide health check', async () => {
      const health = await integration.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.services).toBeDefined();
      expect(health.services.documentation).toBe('healthy');
      expect(health.services.forum).toBe('healthy');
      expect(health.services.support).toBe('healthy');
      expect(health.services.database).toBe('healthy');
    });
  });

  describe('Security and Authorization', () => {
    test('should validate user permissions', async () => {
      // Try to moderate without permissions
      const result = await integration.handleValidatorMessage({
        type: 'forum',
        action: 'moderatePost',
        data: {
          postId: 'some-post',
          userId: testUserId,
          action: 'hide',
          reason: 'Test moderation'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('permission');
    });

    test('should sanitize user input', async () => {
      const result = await integration.handleValidatorMessage({
        type: 'documentation',
        action: 'create',
        data: {
          title: '<script>alert("XSS")</script>Safe Title',
          content: '<img src=x onerror=alert(1)>Safe content',
          category: 'guides',
          tags: ['<script>'],
          authorId: testUserId,
          language: 'en'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.title).not.toContain('<script>');
      expect(result.data.content).not.toContain('onerror');
      expect(result.data.tags[0]).not.toContain('<script>');
    });

    test('should rate limit requests', async () => {
      // Simulate rapid requests from same user
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          integration.handleValidatorMessage({
            type: 'forum',
            action: 'createThread',
            data: {
              title: `Spam Thread ${i}`,
              content: 'Spam content',
              category: 'general',
              tags: [],
              authorId: testUserId
            }
          })
        );
      }

      const results = await Promise.all(promises);
      const failures = results.filter(r => !r.success);
      
      expect(failures.length).toBeGreaterThan(0);
      expect(failures[0].error).toContain('rate limit');
    });
  });
});