/**
 * VolunteerSupportService Unit Tests
 * 
 * Tests the volunteer-based support system including:
 * - Support request management
 * - Volunteer registration and matching
 * - Chat sessions
 * - Quality metrics and ratings
 * - Intelligent routing
 * - Participation rewards
 */

import { VolunteerSupportService } from '@/services/support/VolunteerSupportService';
import { SupportRouter } from '@/services/support/SupportRouter';
import { Database } from '@/services/database/Database';
import { 
  setupTestServices, 
  teardownTestServices, 
  TEST_USERS,
  generateTestSupportRequest,
  testHelpers,
  cleanTestData,
} from '@tests/setup/testSetup';

describe('VolunteerSupportService', () => {
  let services: any;
  let supportService: VolunteerSupportService;
  let db: Database;

  beforeAll(async () => {
    services = await setupTestServices();
    supportService = services.support;
    db = services.db;
  });

  afterAll(async () => {
    await cleanTestData(db);
    await teardownTestServices();
  });

  beforeEach(async () => {
    // Clean up test requests between tests
    await db.query(`
      DELETE FROM support_requests 
      WHERE subject LIKE 'Test%' 
      OR category LIKE 'test-%'
    `);
  });

  describe('Support Request Management', () => {
    test('should create a support request', async () => {
      const requestData = generateTestSupportRequest();
      const request = await supportService.createRequest(requestData);

      testHelpers.assertSupportRequest(request);
      expect(request.userId).toBe(requestData.userId);
      expect(request.subject).toBe(requestData.subject);
      expect(request.description).toBe(requestData.description);
      expect(request.category).toBe(requestData.category);
      expect(request.status).toBe('open');
    });

    test('should retrieve request by ID', async () => {
      const created = await supportService.createRequest(generateTestSupportRequest());
      const retrieved = await supportService.getRequest(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.subject).toBe(created.subject);
    });

    test('should update request status', async () => {
      const request = await supportService.createRequest(generateTestSupportRequest());
      
      const updated = await supportService.updateRequestStatus(
        request.id,
        'in_progress',
        { assignedVolunteerId: TEST_USERS.volunteer }
      );

      expect(updated.status).toBe('in_progress');
      expect(updated.assignedVolunteerId).toBe(TEST_USERS.volunteer);
    });

    test('should list user requests', async () => {
      // Create multiple requests for user
      const userId = TEST_USERS.alice;
      for (let i = 0; i < 3; i++) {
        await supportService.createRequest(generateTestSupportRequest({
          userId,
          subject: `Request ${i}`,
        }));
      }

      const requests = await supportService.getUserRequests(userId, {
        page: 1,
        pageSize: 10,
      });

      expect(requests.items.length).toBeGreaterThanOrEqual(3);
      expect(requests.items.every(r => r.userId === userId)).toBe(true);
    });

    test('should close request with resolution', async () => {
      const request = await supportService.createRequest(generateTestSupportRequest());
      
      const closed = await supportService.closeRequest(
        request.id,
        {
          resolution: 'Issue resolved by resetting user settings',
          resolvedBy: TEST_USERS.volunteer,
        }
      );

      expect(closed.status).toBe('closed');
      expect(closed.resolution).toBe('Issue resolved by resetting user settings');
      expect(closed.resolvedAt).toBeDefined();
    });

    test('should filter requests by status', async () => {
      // Create requests with different statuses
      await supportService.createRequest(generateTestSupportRequest({
        category: 'test-filter',
      }));

      const inProgress = await supportService.createRequest(generateTestSupportRequest({
        category: 'test-filter',
      }));
      await supportService.updateRequestStatus(inProgress.id, 'in_progress');

      const openRequests = await supportService.listRequests({
        status: 'open',
        category: 'test-filter',
      });

      expect(openRequests.items.every(r => r.status === 'open')).toBe(true);
    });

    test('should set request priority', async () => {
      const request = await supportService.createRequest(generateTestSupportRequest());
      
      const updated = await supportService.setRequestPriority(
        request.id,
        'high',
        TEST_USERS.moderator
      );

      expect(updated.priority).toBe('high');
    });
  });

  describe('Volunteer Management', () => {
    test('should register a volunteer', async () => {
      const volunteer = await supportService.registerVolunteer({
        userId: TEST_USERS.alice,
        name: 'Alice Helper',
        expertise: ['technical', 'billing'],
        languages: ['en', 'fr'],
        availability: 'weekdays',
      });

      expect(volunteer.userId).toBe(TEST_USERS.alice);
      expect(volunteer.expertise).toContain('technical');
      expect(volunteer.languages).toContain('en');
      expect(volunteer.isActive).toBe(true);
    });

    test('should update volunteer profile', async () => {
      const volunteer = await supportService.registerVolunteer({
        userId: TEST_USERS.bob,
        name: 'Bob Support',
        expertise: ['general'],
        languages: ['en'],
      });

      const updated = await supportService.updateVolunteerProfile(
        volunteer.id,
        {
          expertise: ['general', 'technical'],
          languages: ['en', 'es'],
          availability: 'anytime',
        }
      );

      expect(updated.expertise).toContain('technical');
      expect(updated.languages).toContain('es');
    });

    test('should toggle volunteer availability', async () => {
      const volunteer = await supportService.registerVolunteer({
        userId: TEST_USERS.charlie,
        name: 'Charlie Helper',
        expertise: ['billing'],
        languages: ['en'],
      });

      // Set unavailable
      await supportService.setVolunteerAvailability(volunteer.id, false);
      let status = await supportService.getVolunteer(volunteer.id);
      expect(status.availability).toBe('unavailable');

      // Set available again
      await supportService.setVolunteerAvailability(volunteer.id, true);
      status = await supportService.getVolunteer(volunteer.id);
      expect(status.availability).toBe('available');
    });

    test('should list available volunteers', async () => {
      // Ensure we have some volunteers
      await supportService.registerVolunteer({
        userId: 'test-vol-1',
        name: 'Available Volunteer',
        expertise: ['technical'],
        languages: ['en'],
      });

      const available = await supportService.getAvailableVolunteers({
        expertise: 'technical',
        language: 'en',
      });

      expect(available.length).toBeGreaterThan(0);
      expect(available.every(v => v.isActive)).toBe(true);
    });

    test('should track volunteer statistics', async () => {
      const volunteer = await supportService.getVolunteerByUserId(TEST_USERS.volunteer);
      const stats = await supportService.getVolunteerStats(volunteer.id);

      expect(stats).toHaveProperty('totalSessions');
      expect(stats).toHaveProperty('successfulResolutions');
      expect(stats).toHaveProperty('averageRating');
      expect(stats).toHaveProperty('responseTime');
    });

    test('should get top volunteers', async () => {
      const topVolunteers = await supportService.getTopVolunteers({
        period: 'month',
        limit: 10,
      });

      expect(Array.isArray(topVolunteers)).toBe(true);
      if (topVolunteers.length > 0) {
        expect(topVolunteers[0]).toHaveProperty('rating');
        expect(topVolunteers[0]).toHaveProperty('totalSessions');
      }
    });
  });

  describe('Intelligent Request Routing', () => {
    beforeEach(async () => {
      // Ensure we have volunteers with different expertise
      await supportService.registerVolunteer({
        userId: 'tech-expert',
        name: 'Tech Expert',
        expertise: ['technical', 'blockchain'],
        languages: ['en'],
      });

      await supportService.registerVolunteer({
        userId: 'billing-expert',
        name: 'Billing Expert',
        expertise: ['billing', 'account'],
        languages: ['en', 'es'],
      });
    });

    test('should route request to matching volunteer', async () => {
      const request = await supportService.createRequest({
        userId: TEST_USERS.alice,
        category: 'technical',
        subject: 'Blockchain issue',
        description: 'I need help with blockchain transactions',
      });

      const assignment = await supportService.autoAssignVolunteer(request.id);

      expect(assignment.success).toBe(true);
      expect(assignment.volunteer).toBeDefined();
      
      // Should assign to volunteer with technical expertise
      const volunteer = await supportService.getVolunteer(assignment.volunteer!.id);
      expect(volunteer.expertise).toContain('technical');
    });

    test('should consider language preferences', async () => {
      const request = await supportService.createRequest({
        userId: TEST_USERS.alice,
        category: 'billing',
        subject: 'Factura problema',
        description: 'Necesito ayuda con mi factura',
        metadata: { preferredLanguage: 'es' },
      });

      const assignment = await supportService.autoAssignVolunteer(request.id);

      if (assignment.volunteer) {
        const volunteer = await supportService.getVolunteer(assignment.volunteer.id);
        expect(volunteer.languages).toContain('es');
      }
    });

    test('should balance volunteer workload', async () => {
      // Create multiple requests
      const requests = [];
      for (let i = 0; i < 5; i++) {
        const req = await supportService.createRequest(generateTestSupportRequest({
          category: 'technical',
        }));
        requests.push(req);
      }

      // Auto-assign all requests
      for (const req of requests) {
        await supportService.autoAssignVolunteer(req.id);
      }

      // Check workload distribution
      const volunteers = await supportService.getAvailableVolunteers({
        expertise: 'technical',
      });

      const workloads = await Promise.all(
        volunteers.map(v => supportService.getVolunteerWorkload(v.id))
      );

      // Workload should be somewhat balanced
      const maxWorkload = Math.max(...workloads.map(w => w.activeRequests));
      const minWorkload = Math.min(...workloads.map(w => w.activeRequests));
      
      expect(maxWorkload - minWorkload).toBeLessThanOrEqual(2);
    });

    test('should escalate unassigned requests', async () => {
      const request = await supportService.createRequest({
        userId: TEST_USERS.alice,
        category: 'specialized',
        subject: 'Complex issue',
        description: 'This requires special expertise',
        priority: 'high',
      });

      // Simulate time passing without assignment
      await new Promise(resolve => setTimeout(resolve, 100));

      const escalated = await supportService.checkEscalation(request.id);
      
      expect(escalated.shouldEscalate).toBe(true);
      expect(escalated.reason).toBeDefined();
    });
  });

  describe('Support Sessions', () => {
    let volunteer: any;
    let request: any;

    beforeEach(async () => {
      volunteer = await supportService.getVolunteerByUserId(TEST_USERS.volunteer);
      request = await supportService.createRequest(generateTestSupportRequest());
    });

    test('should start a support session', async () => {
      const session = await supportService.startSession({
        requestId: request.id,
        volunteerId: volunteer.id,
        userId: request.userId,
      });

      expect(session.requestId).toBe(request.id);
      expect(session.volunteerId).toBe(volunteer.id);
      expect(session.startedAt).toBeDefined();
      expect(session.status).toBe('active');
    });

    test('should end a support session', async () => {
      const session = await supportService.startSession({
        requestId: request.id,
        volunteerId: volunteer.id,
        userId: request.userId,
      });

      const ended = await supportService.endSession(session.id, {
        resolutionStatus: 'resolved',
        volunteerNotes: 'Issue fixed by clearing cache',
      });

      expect(ended.endedAt).toBeDefined();
      expect(ended.resolutionStatus).toBe('resolved');
      expect(ended.durationMinutes).toBeDefined();
    });

    test('should track session messages', async () => {
      const session = await supportService.startSession({
        requestId: request.id,
        volunteerId: volunteer.id,
        userId: request.userId,
      });

      // Simulate chat messages
      await supportService.incrementSessionMessages(session.id, 5);
      
      const updated = await supportService.getSession(session.id);
      expect(updated.messagesCount).toBe(5);
    });

    test('should get active sessions for volunteer', async () => {
      // Start multiple sessions
      await supportService.startSession({
        requestId: request.id,
        volunteerId: volunteer.id,
        userId: request.userId,
      });

      const activeSessions = await supportService.getVolunteerActiveSessions(
        volunteer.id
      );

      expect(activeSessions.length).toBeGreaterThan(0);
      expect(activeSessions.every(s => s.status === 'active')).toBe(true);
    });

    test('should get session history', async () => {
      const session = await supportService.startSession({
        requestId: request.id,
        volunteerId: volunteer.id,
        userId: request.userId,
      });

      await supportService.endSession(session.id, {
        resolutionStatus: 'resolved',
      });

      const history = await supportService.getUserSessionHistory(request.userId);

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].requestId).toBe(request.id);
    });
  });

  describe('Rating and Feedback', () => {
    let volunteer: any;
    let request: any;
    let session: any;

    beforeEach(async () => {
      volunteer = await supportService.getVolunteerByUserId(TEST_USERS.volunteer);
      request = await supportService.createRequest(generateTestSupportRequest());
      session = await supportService.startSession({
        requestId: request.id,
        volunteerId: volunteer.id,
        userId: request.userId,
      });
      await supportService.endSession(session.id, {
        resolutionStatus: 'resolved',
      });
    });

    test('should rate support session', async () => {
      const rating = await supportService.rateSession(session.id, {
        rating: 5,
        feedback: 'Excellent help!',
        userId: request.userId,
      });

      expect(rating.userRating).toBe(5);
      
      // Should update volunteer rating
      const updatedVolunteer = await supportService.getVolunteer(volunteer.id);
      expect(updatedVolunteer.rating).toBeGreaterThan(0);
    });

    test('should calculate volunteer rating', async () => {
      // Add multiple ratings
      for (let i = 0; i < 3; i++) {
        const req = await supportService.createRequest(generateTestSupportRequest());
        const sess = await supportService.startSession({
          requestId: req.id,
          volunteerId: volunteer.id,
          userId: req.userId,
        });
        await supportService.endSession(sess.id, {
          resolutionStatus: 'resolved',
        });
        await supportService.rateSession(sess.id, {
          rating: 4 + i % 2, // Ratings: 4, 5, 4
          userId: req.userId,
        });
      }

      const stats = await supportService.getVolunteerStats(volunteer.id);
      
      expect(stats.averageRating).toBeCloseTo(4.3, 1); // Average of all ratings
    });

    test('should get feedback for volunteer', async () => {
      await supportService.rateSession(session.id, {
        rating: 5,
        feedback: 'Very helpful and patient',
        userId: request.userId,
      });

      const feedback = await supportService.getVolunteerFeedback(
        volunteer.id,
        { page: 1, pageSize: 10 }
      );

      expect(feedback.items.length).toBeGreaterThan(0);
      expect(feedback.items[0].feedback).toBe('Very helpful and patient');
    });

    test('should flag poor performance', async () => {
      // Create multiple poor ratings
      for (let i = 0; i < 3; i++) {
        const req = await supportService.createRequest(generateTestSupportRequest());
        const sess = await supportService.startSession({
          requestId: req.id,
          volunteerId: volunteer.id,
          userId: req.userId,
        });
        await supportService.endSession(sess.id, {
          resolutionStatus: 'unresolved',
        });
        await supportService.rateSession(sess.id, {
          rating: 1,
          feedback: 'Not helpful',
          userId: req.userId,
        });
      }

      const flags = await supportService.checkVolunteerPerformance(volunteer.id);
      
      expect(flags.needsReview).toBe(true);
      expect(flags.issues).toContain('low_rating');
    });
  });

  describe('Quality Metrics', () => {
    test('should track response time', async () => {
      const request = await supportService.createRequest(generateTestSupportRequest({
        priority: 'high',
      }));

      const startTime = Date.now();
      
      // Simulate delay before assignment
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await supportService.updateRequestStatus(
        request.id,
        'in_progress',
        { assignedVolunteerId: TEST_USERS.volunteer }
      );

      const metrics = await supportService.getRequestMetrics(request.id);
      
      expect(metrics.responseTimeMs).toBeGreaterThan(90);
      expect(metrics.responseTimeMs).toBeLessThan(200);
    });

    test('should track resolution time', async () => {
      const request = await supportService.createRequest(generateTestSupportRequest());
      const volunteer = await supportService.getVolunteerByUserId(TEST_USERS.volunteer);
      
      const session = await supportService.startSession({
        requestId: request.id,
        volunteerId: volunteer.id,
        userId: request.userId,
      });

      // Simulate support duration
      await new Promise(resolve => setTimeout(resolve, 100));

      await supportService.endSession(session.id, {
        resolutionStatus: 'resolved',
      });
      await supportService.closeRequest(request.id, {
        resolution: 'Fixed',
        resolvedBy: volunteer.userId,
      });

      const metrics = await supportService.getRequestMetrics(request.id);
      
      expect(metrics.resolutionTimeMs).toBeDefined();
      expect(metrics.resolutionTimeMs).toBeGreaterThan(90);
    });

    test('should get overall support metrics', async () => {
      const metrics = await supportService.getSystemStats();

      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('openRequests');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('averageResolutionTime');
      expect(metrics).toHaveProperty('satisfactionRate');
      expect(metrics).toHaveProperty('activeVolunteers');
      expect(metrics).toHaveProperty('activeSessions');
    });

    test('should track category metrics', async () => {
      // Create requests in different categories
      await supportService.createRequest(generateTestSupportRequest({
        category: 'technical',
      }));
      await supportService.createRequest(generateTestSupportRequest({
        category: 'billing',
      }));

      const categoryMetrics = await supportService.getCategoryMetrics();

      expect(categoryMetrics).toHaveProperty('technical');
      expect(categoryMetrics).toHaveProperty('billing');
      expect(categoryMetrics.technical.count).toBeGreaterThan(0);
    });
  });

  describe('Participation Rewards', () => {
    test('should award points to volunteers', async () => {
      const volunteer = await supportService.getVolunteerByUserId(TEST_USERS.volunteer);
      const initialScore = await services.participation.getUserScore(volunteer.userId);
      
      const request = await supportService.createRequest(generateTestSupportRequest());
      const session = await supportService.startSession({
        requestId: request.id,
        volunteerId: volunteer.id,
        userId: request.userId,
      });

      await supportService.endSession(session.id, {
        resolutionStatus: 'resolved',
      });

      const newScore = await services.participation.getUserScore(volunteer.userId);
      
      expect(newScore.components.support).toBeGreaterThan(
        initialScore.components.support
      );
    });

    test('should award bonus for high ratings', async () => {
      const volunteer = await supportService.getVolunteerByUserId(TEST_USERS.volunteer);
      const request = await supportService.createRequest(generateTestSupportRequest());
      
      const session = await supportService.startSession({
        requestId: request.id,
        volunteerId: volunteer.id,
        userId: request.userId,
      });

      await supportService.endSession(session.id, {
        resolutionStatus: 'resolved',
      });

      const beforeRating = await services.participation.getUserScore(volunteer.userId);

      await supportService.rateSession(session.id, {
        rating: 5,
        userId: request.userId,
      });

      const afterRating = await services.participation.getUserScore(volunteer.userId);
      
      expect(afterRating.components.support).toBeGreaterThan(
        beforeRating.components.support
      );
    });

    test('should track volunteer leaderboard', async () => {
      const leaderboard = await supportService.getVolunteerLeaderboard({
        period: 'week',
        limit: 10,
      });

      expect(Array.isArray(leaderboard)).toBe(true);
      if (leaderboard.length > 0) {
        expect(leaderboard[0]).toHaveProperty('userId');
        expect(leaderboard[0]).toHaveProperty('points');
        expect(leaderboard[0]).toHaveProperty('sessionsCompleted');
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle request not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      await expect(
        supportService.getRequest(fakeId)
      ).rejects.toThrow('not found');
    });

    test('should prevent duplicate volunteer registration', async () => {
      await supportService.registerVolunteer({
        userId: 'duplicate-test',
        name: 'Test Volunteer',
        expertise: ['general'],
        languages: ['en'],
      });

      await expect(
        supportService.registerVolunteer({
          userId: 'duplicate-test',
          name: 'Test Volunteer 2',
          expertise: ['general'],
          languages: ['en'],
        })
      ).rejects.toThrow('already registered');
    });

    test('should handle invalid session operations', async () => {
      const fakeSessionId = '00000000-0000-0000-0000-000000000000';
      
      await expect(
        supportService.endSession(fakeSessionId, {
          resolutionStatus: 'resolved',
        })
      ).rejects.toThrow();
    });
  });
});