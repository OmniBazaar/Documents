/**
 * Tests for VolunteerSupportService
 * 
 * @module services/support/VolunteerSupportService.test
 */

import { Database } from '../../../../Validator/src/database/Database';
import { ParticipationScoreService } from '../../../../Validator/src/services/ParticipationScoreService';
import { VolunteerSupportService } from './VolunteerSupportService';
import { SupportRequest, SupportSession, SupportVolunteer } from './SupportTypes';

describe('VolunteerSupportService', () => {
  let db: Database;
  let participationService: ParticipationScoreService;
  let supportService: VolunteerSupportService;
  
  const testUserId = 'user-test-123';
  const testVolunteerId = 'volunteer-test-456';
  const testVolunteerId2 = 'volunteer-test-789';
  const validatorEndpoint = 'http://localhost:8080';

  beforeEach(async () => {
    // Initialize services with real implementations
    db = new Database();
    participationService = new ParticipationScoreService(validatorEndpoint);
    supportService = new VolunteerSupportService(db, participationService);
    
    // Register test volunteers
    await supportService.registerVolunteer({
      userId: testVolunteerId,
      displayName: 'Test Volunteer',
      languages: ['en', 'es'],
      expertise: ['general', 'technical'],
      availability: {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' }
      }
    });

    await supportService.registerVolunteer({
      userId: testVolunteerId2,
      displayName: 'Test Volunteer 2',
      languages: ['en', 'fr', 'de'],
      expertise: ['trading', 'wallet'],
      availability: {
        monday: { start: '13:00', end: '21:00' },
        tuesday: { start: '13:00', end: '21:00' },
        wednesday: { start: '13:00', end: '21:00' },
        thursday: { start: '13:00', end: '21:00' },
        friday: { start: '13:00', end: '21:00' }
      }
    });
  });

  afterEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM support_requests WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM support_sessions WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM support_volunteers WHERE user_id IN ($1, $2)', [testVolunteerId, testVolunteerId2]);
    await db.query('DELETE FROM support_messages WHERE sender_id IN ($1, $2, $3)', [testUserId, testVolunteerId, testVolunteerId2]);
  });

  describe('Volunteer Management', () => {
    test('should register a new volunteer', async () => {
      const newVolunteerId = 'new-volunteer-123';
      const volunteer = await supportService.registerVolunteer({
        userId: newVolunteerId,
        displayName: 'New Volunteer',
        languages: ['en', 'ja'],
        expertise: ['disputes', 'account'],
        availability: {
          saturday: { start: '10:00', end: '18:00' },
          sunday: { start: '10:00', end: '18:00' }
        }
      });

      expect(volunteer).toBeDefined();
      expect(volunteer.userId).toBe(newVolunteerId);
      expect(volunteer.displayName).toBe('New Volunteer');
      expect(volunteer.languages).toEqual(['en', 'ja']);
      expect(volunteer.expertise).toEqual(['disputes', 'account']);
      expect(volunteer.rating).toBe(5.0);
      expect(volunteer.totalRatings).toBe(0);
      expect(volunteer.totalSessions).toBe(0);
      expect(volunteer.isActive).toBe(true);

      // Cleanup
      await db.query('DELETE FROM support_volunteers WHERE user_id = $1', [newVolunteerId]);
    });

    test('should update volunteer profile', async () => {
      await supportService.updateVolunteerProfile(testVolunteerId, {
        languages: ['en', 'es', 'pt'],
        expertise: ['general', 'technical', 'wallet'],
        availability: {
          monday: { start: '08:00', end: '20:00' },
          tuesday: { start: '08:00', end: '20:00' }
        }
      });

      const volunteer = await supportService.getVolunteer(testVolunteerId);
      expect(volunteer?.languages).toEqual(['en', 'es', 'pt']);
      expect(volunteer?.expertise).toEqual(['general', 'technical', 'wallet']);
    });

    test('should set volunteer online/offline status', async () => {
      await supportService.setVolunteerOnline(testVolunteerId);
      let volunteer = await supportService.getVolunteer(testVolunteerId);
      expect(volunteer?.isOnline).toBe(true);

      await supportService.setVolunteerOffline(testVolunteerId);
      volunteer = await supportService.getVolunteer(testVolunteerId);
      expect(volunteer?.isOnline).toBe(false);
    });

    test('should get available volunteers', async () => {
      await supportService.setVolunteerOnline(testVolunteerId);
      await supportService.setVolunteerOnline(testVolunteerId2);

      const availableVolunteers = await supportService.getAvailableVolunteers({
        language: 'en',
        category: 'general'
      });

      expect(availableVolunteers.length).toBeGreaterThan(0);
      expect(availableVolunteers.some(v => v.userId === testVolunteerId)).toBe(true);
    });
  });

  describe('Support Request Management', () => {
    test('should create a support request', async () => {
      const request = await supportService.createSupportRequest({
        userId: testUserId,
        category: 'technical',
        language: 'en',
        priority: 'high',
        initialMessage: 'I need help with API integration',
        metadata: {
          platform: 'web',
          browser: 'Chrome'
        }
      });

      expect(request).toBeDefined();
      expect(request.userId).toBe(testUserId);
      expect(request.category).toBe('technical');
      expect(request.language).toBe('en');
      expect(request.priority).toBe('high');
      expect(request.status).toBe('pending');
      expect(request.queuePosition).toBeGreaterThan(0);
    });

    test('should assign volunteer to request', async () => {
      await supportService.setVolunteerOnline(testVolunteerId);

      const request = await supportService.createSupportRequest({
        userId: testUserId,
        category: 'technical',
        language: 'en',
        priority: 'medium'
      });

      // Wait for assignment (simulated)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const session = await supportService.getActiveSession(testUserId);
      expect(session).toBeDefined();
      expect(session?.volunteerId).toBeDefined();
    });

    test('should route to best matching volunteer', async () => {
      await supportService.setVolunteerOnline(testVolunteerId);
      await supportService.setVolunteerOnline(testVolunteerId2);

      // Create request that better matches volunteer 2
      const request = await supportService.createSupportRequest({
        userId: testUserId,
        category: 'trading',
        language: 'fr',
        priority: 'medium'
      });

      // Wait for routing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const session = await supportService.getActiveSession(testUserId);
      expect(session?.volunteerId).toBe(testVolunteerId2);
    });

    test('should handle queue position updates', async () => {
      // Create multiple requests to build a queue
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          await supportService.createSupportRequest({
            userId: `queue-user-${i}`,
            category: 'general',
            language: 'en',
            priority: 'medium'
          })
        );
      }

      // Check queue positions
      expect(requests[0].queuePosition).toBe(1);
      expect(requests[4].queuePosition).toBe(5);

      // Cleanup
      for (let i = 0; i < 5; i++) {
        await db.query('DELETE FROM support_requests WHERE user_id = $1', [`queue-user-${i}`]);
      }
    });
  });

  describe('Support Session Management', () => {
    let sessionId: string;

    beforeEach(async () => {
      await supportService.setVolunteerOnline(testVolunteerId);
      
      const request = await supportService.createSupportRequest({
        userId: testUserId,
        category: 'general',
        language: 'en',
        priority: 'medium'
      });

      // Create session manually for testing
      const session = await supportService.startSession(request.id, testVolunteerId);
      sessionId = session.id;
    });

    test('should send and receive messages', async () => {
      // User sends message
      const userMessage = await supportService.sendMessage(
        sessionId,
        testUserId,
        'Hello, I need help',
        'text'
      );

      expect(userMessage).toBeDefined();
      expect(userMessage.content).toBe('Hello, I need help');
      expect(userMessage.senderId).toBe(testUserId);

      // Volunteer responds
      const volunteerMessage = await supportService.sendMessage(
        sessionId,
        testVolunteerId,
        'Hello! How can I help you today?',
        'text'
      );

      expect(volunteerMessage).toBeDefined();
      expect(volunteerMessage.senderId).toBe(testVolunteerId);

      // Get message history
      const history = await supportService.getSessionHistory(sessionId);
      expect(history).toHaveLength(2);
    });

    test('should handle file attachments', async () => {
      const fileMessage = await supportService.sendMessage(
        sessionId,
        testUserId,
        'screenshot.png',
        'file',
        {
          filename: 'screenshot.png',
          size: 102400,
          mimeType: 'image/png',
          url: 'https://storage.omnibazaar.com/files/screenshot.png'
        }
      );

      expect(fileMessage.type).toBe('file');
      expect(fileMessage.metadata?.filename).toBe('screenshot.png');
    });

    test('should handle voice messages', async () => {
      const voiceMessage = await supportService.sendMessage(
        sessionId,
        testUserId,
        'voice-note.mp3',
        'voice',
        {
          duration: 15,
          url: 'https://storage.omnibazaar.com/voice/note.mp3'
        }
      );

      expect(voiceMessage.type).toBe('voice');
      expect(voiceMessage.metadata?.duration).toBe(15);
    });

    test('should end session', async () => {
      await supportService.endSession(sessionId);

      const session = await db.query(
        'SELECT * FROM support_sessions WHERE id = $1',
        [sessionId]
      );

      expect(session.rows[0].status).toBe('ended');
      expect(session.rows[0].end_time).toBeDefined();
    });

    test('should handle session abandonment', async () => {
      // Simulate inactivity
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      await db.query(
        'UPDATE support_sessions SET last_activity = $1 WHERE id = $2',
        [thirtyMinutesAgo, sessionId]
      );

      await supportService['checkAbandonedSessions']();

      const session = await db.query(
        'SELECT * FROM support_sessions WHERE id = $1',
        [sessionId]
      );

      expect(session.rows[0].status).toBe('abandoned');
    });
  });

  describe('Rating System', () => {
    let sessionId: string;

    beforeEach(async () => {
      await supportService.setVolunteerOnline(testVolunteerId);
      
      const request = await supportService.createSupportRequest({
        userId: testUserId,
        category: 'general',
        language: 'en',
        priority: 'medium'
      });

      const session = await supportService.startSession(request.id, testVolunteerId);
      sessionId = session.id;
      
      // End session to allow rating
      await supportService.endSession(sessionId);
    });

    test('should rate a session', async () => {
      const rating = await supportService.rateSession(sessionId, testUserId, 5, 'Excellent support!');

      expect(rating).toBeDefined();
      expect(rating.rating).toBe(5);
      expect(rating.comment).toBe('Excellent support!');

      // Check volunteer rating updated
      const volunteer = await supportService.getVolunteer(testVolunteerId);
      expect(volunteer?.rating).toBe(5);
      expect(volunteer?.totalRatings).toBe(1);
    });

    test('should calculate average rating', async () => {
      // Rate first session
      await supportService.rateSession(sessionId, testUserId, 5);

      // Create and rate second session
      const request2 = await supportService.createSupportRequest({
        userId: 'user-2',
        category: 'general',
        language: 'en',
        priority: 'medium'
      });

      const session2 = await supportService.startSession(request2.id, testVolunteerId);
      await supportService.endSession(session2.id);
      await supportService.rateSession(session2.id, 'user-2', 4);

      // Check average rating
      const volunteer = await supportService.getVolunteer(testVolunteerId);
      expect(volunteer?.rating).toBe(4.5);
      expect(volunteer?.totalRatings).toBe(2);

      // Cleanup
      await db.query('DELETE FROM support_requests WHERE user_id = $1', ['user-2']);
      await db.query('DELETE FROM support_sessions WHERE id = $1', [session2.id]);
    });

    test('should prevent rating own session', async () => {
      await expect(
        supportService.rateSession(sessionId, testVolunteerId, 5)
      ).rejects.toThrow('Volunteers cannot rate their own sessions');
    });

    test('should prevent duplicate ratings', async () => {
      await supportService.rateSession(sessionId, testUserId, 5);

      await expect(
        supportService.rateSession(sessionId, testUserId, 4)
      ).rejects.toThrow('Session already rated');
    });
  });

  describe('Quality Monitoring', () => {
    test('should track response times', async () => {
      await supportService.setVolunteerOnline(testVolunteerId);

      const request = await supportService.createSupportRequest({
        userId: testUserId,
        category: 'general',
        language: 'en',
        priority: 'high'
      });

      const requestTime = new Date();
      
      // Simulate delay before assignment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const session = await supportService.startSession(request.id, testVolunteerId);
      const responseTime = new Date().getTime() - requestTime.getTime();

      expect(responseTime).toBeGreaterThan(2000);
      expect(responseTime).toBeLessThan(3000);

      // Check volunteer stats updated
      const stats = await supportService.getVolunteerStats(testVolunteerId);
      expect(stats.averageResponseTime).toBeGreaterThan(0);
    });

    test('should track session duration', async () => {
      await supportService.setVolunteerOnline(testVolunteerId);

      const request = await supportService.createSupportRequest({
        userId: testUserId,
        category: 'general',
        language: 'en',
        priority: 'medium'
      });

      const session = await supportService.startSession(request.id, testVolunteerId);
      
      // Simulate conversation
      await supportService.sendMessage(session.id, testUserId, 'Hello', 'text');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await supportService.sendMessage(session.id, testVolunteerId, 'Hi there!', 'text');
      
      await supportService.endSession(session.id);

      const sessionData = await db.query(
        'SELECT * FROM support_sessions WHERE id = $1',
        [session.id]
      );

      const duration = new Date(sessionData.rows[0].end_time).getTime() - 
                      new Date(sessionData.rows[0].start_time).getTime();
      
      expect(duration).toBeGreaterThan(1000);
    });

    test('should identify top performers', async () => {
      // Create multiple volunteers with different ratings
      const volunteers = [];
      for (let i = 0; i < 5; i++) {
        const volunteerId = `top-volunteer-${i}`;
        await supportService.registerVolunteer({
          userId: volunteerId,
          displayName: `Top Volunteer ${i}`,
          languages: ['en'],
          expertise: ['general'],
          availability: {}
        });

        // Simulate ratings
        await db.query(
          'UPDATE support_volunteers SET rating = $1, total_ratings = $2 WHERE user_id = $3',
          [5 - i * 0.5, 10 + i, volunteerId]
        );
        
        volunteers.push(volunteerId);
      }

      const topPerformers = await supportService.getTopVolunteers({ limit: 3 });
      
      expect(topPerformers).toHaveLength(3);
      expect(topPerformers[0].rating).toBe(5);
      expect(topPerformers[1].rating).toBe(4.5);
      expect(topPerformers[2].rating).toBe(4);

      // Cleanup
      for (const volunteerId of volunteers) {
        await db.query('DELETE FROM support_volunteers WHERE user_id = $1', [volunteerId]);
      }
    });
  });

  describe('Participation Score Integration', () => {
    test('should award points for support sessions', async () => {
      await supportService.setVolunteerOnline(testVolunteerId);

      const initialScore = await participationService.getUserScore(testVolunteerId);
      const initialSupportPoints = initialScore.support_score;

      const request = await supportService.createSupportRequest({
        userId: testUserId,
        category: 'general',
        language: 'en',
        priority: 'medium'
      });

      const session = await supportService.startSession(request.id, testVolunteerId);
      
      // Have a conversation
      await supportService.sendMessage(session.id, testUserId, 'I need help', 'text');
      await supportService.sendMessage(session.id, testVolunteerId, 'How can I assist?', 'text');
      await supportService.sendMessage(session.id, testUserId, 'How do I create a listing?', 'text');
      await supportService.sendMessage(session.id, testVolunteerId, 'Here are the steps...', 'text');
      
      await supportService.endSession(session.id);
      await supportService.rateSession(session.id, testUserId, 5);

      const updatedScore = await participationService.getUserScore(testVolunteerId);
      expect(updatedScore.support_score).toBeGreaterThan(initialSupportPoints);
    });

    test('should award bonus points for excellent ratings', async () => {
      await supportService.setVolunteerOnline(testVolunteerId);

      const request = await supportService.createSupportRequest({
        userId: testUserId,
        category: 'general',
        language: 'en',
        priority: 'medium'
      });

      const session = await supportService.startSession(request.id, testVolunteerId);
      await supportService.endSession(session.id);
      await supportService.rateSession(session.id, testUserId, 5, 'Amazing support!');

      const score = await participationService.getUserScore(testVolunteerId);
      expect(score.support_score).toBeGreaterThan(0);
      expect(score.trust_score).toBeGreaterThan(50); // Trust increases with good ratings
    });

    test('should not penalize for lower ratings if justified', async () => {
      await supportService.setVolunteerOnline(testVolunteerId);

      const initialScore = await participationService.getUserScore(testVolunteerId);

      const request = await supportService.createSupportRequest({
        userId: testUserId,
        category: 'general',
        language: 'en',
        priority: 'medium'
      });

      const session = await supportService.startSession(request.id, testVolunteerId);
      await supportService.endSession(session.id);
      await supportService.rateSession(session.id, testUserId, 3, 'Language barrier but tried their best');

      const updatedScore = await participationService.getUserScore(testVolunteerId);
      // Should still get points for helping, just not bonus points
      expect(updatedScore.support_score).toBeGreaterThan(initialScore.support_score);
    });
  });

  describe('Multi-language Support', () => {
    test('should match volunteers by language preference', async () => {
      // Create language-specific volunteers
      const spanishVolunteerId = 'spanish-volunteer';
      await supportService.registerVolunteer({
        userId: spanishVolunteerId,
        displayName: 'Spanish Volunteer',
        languages: ['es'],
        expertise: ['general'],
        availability: {}
      });

      await supportService.setVolunteerOnline(spanishVolunteerId);
      await supportService.setVolunteerOnline(testVolunteerId); // Supports en, es

      // Request in Spanish
      const request = await supportService.createSupportRequest({
        userId: testUserId,
        category: 'general',
        language: 'es',
        priority: 'medium'
      });

      const volunteers = await supportService['router'].findBestVolunteers(request);
      
      // Both should be eligible, but order matters
      expect(volunteers.some(v => v.id === spanishVolunteerId)).toBe(true);
      expect(volunteers.some(v => v.id === testVolunteerId)).toBe(true);

      // Cleanup
      await db.query('DELETE FROM support_volunteers WHERE user_id = $1', [spanishVolunteerId]);
    });

    test('should handle language detection from messages', async () => {
      await supportService.setVolunteerOnline(testVolunteerId2); // Supports en, fr, de

      const request = await supportService.createSupportRequest({
        userId: testUserId,
        category: 'general',
        language: 'en', // Initial language
        priority: 'medium'
      });

      const session = await supportService.startSession(request.id, testVolunteerId2);
      
      // User switches to French
      await supportService.sendMessage(
        session.id,
        testUserId,
        'Bonjour, j\'ai besoin d\'aide avec mon portefeuille',
        'text',
        { detectedLanguage: 'fr' }
      );

      // System should note language preference
      const sessionData = await db.query(
        'SELECT metadata FROM support_sessions WHERE id = $1',
        [session.id]
      );

      expect(sessionData.rows[0].metadata.languagesUsed).toContain('fr');
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle multiple concurrent support requests', async () => {
      // Register more volunteers
      const volunteerIds = [];
      for (let i = 0; i < 10; i++) {
        const volunteerId = `load-volunteer-${i}`;
        await supportService.registerVolunteer({
          userId: volunteerId,
          displayName: `Load Test Volunteer ${i}`,
          languages: ['en'],
          expertise: ['general'],
          availability: {}
        });
        await supportService.setVolunteerOnline(volunteerId);
        volunteerIds.push(volunteerId);
      }

      // Create concurrent requests
      const requestPromises = [];
      for (let i = 0; i < 20; i++) {
        requestPromises.push(
          supportService.createSupportRequest({
            userId: `load-user-${i}`,
            category: 'general',
            language: 'en',
            priority: 'medium'
          })
        );
      }

      const startTime = Date.now();
      const requests = await Promise.all(requestPromises);
      const endTime = Date.now();

      expect(requests).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Cleanup
      for (let i = 0; i < 20; i++) {
        await db.query('DELETE FROM support_requests WHERE user_id = $1', [`load-user-${i}`]);
      }
      for (const volunteerId of volunteerIds) {
        await db.query('DELETE FROM support_volunteers WHERE user_id = $1', [volunteerId]);
      }
    });

    test('should efficiently query message history', async () => {
      await supportService.setVolunteerOnline(testVolunteerId);

      const request = await supportService.createSupportRequest({
        userId: testUserId,
        category: 'general',
        language: 'en',
        priority: 'medium'
      });

      const session = await supportService.startSession(request.id, testVolunteerId);

      // Send many messages
      const messagePromises = [];
      for (let i = 0; i < 100; i++) {
        const senderId = i % 2 === 0 ? testUserId : testVolunteerId;
        messagePromises.push(
          supportService.sendMessage(
            session.id,
            senderId,
            `Message ${i}`,
            'text'
          )
        );
      }

      await Promise.all(messagePromises);

      // Query history should be fast
      const startTime = Date.now();
      const history = await supportService.getSessionHistory(session.id);
      const endTime = Date.now();

      expect(history).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });
  });
});