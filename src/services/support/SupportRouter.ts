/**
 * Support Router Service
 * 
 * Intelligently routes support requests to the most suitable volunteer
 * based on language, expertise, availability, and performance metrics.
 * 
 * @module SupportRouter
 */

import { Database } from '../database/Database';
import { logger } from '../../utils/logger';
import {
  SupportRequest,
  SupportVolunteer,
  SupportSession,
  RoutingConfig,
  SupportCategory,
  VolunteerStatus
} from './SupportTypes';

/**
 * Database row result for volunteer query
 */
interface VolunteerRow {
  address: string;
  display_name: string;
  status: string;
  languages: string[];
  expertise_categories: string[];
  rating: string;
  total_sessions: string;
  avg_response_time: string;
  avg_resolution_time: string;
  participation_score: number;
  last_active: Date;
  active_sessions: (string | null)[];
  max_concurrent_sessions: number;
}

/**
 * Database row result for session query
 */
interface SessionRow {
  session_id: string;
  request_id: string;
  user_address: string;
  volunteer_address: string | null;
  category: string;
  priority: string;
  status: string;
  start_time: Date;
  assignment_time: Date | null;
  initial_message: string;
  language: string;
  user_score: number;
}

/**
 * Database row result for queue stats
 */
interface QueueStatsRow {
  count: string;
}

/**
 * Database row result for wait time stats
 */
interface WaitTimeRow {
  avg_wait: string | null;
}

/**
 * Database row result for efficiency stats
 */
interface EfficiencyRow {
  efficiency: string | null;
}

/**
 * Default routing configuration
 */
const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  maxWaitTime: 5 * 60 * 1000, // 5 minutes
  languageWeight: 0.3,
  expertiseWeight: 0.25,
  ratingWeight: 0.2,
  responseTimeWeight: 0.15,
  loadWeight: 0.1,
  userScoreBoost: true
};

/**
 * Support Router Service
 * 
 * @example
 * ```typescript
 * const router = new SupportRouter(db);
 * await router.initialize();
 * 
 * // Find best volunteer for request
 * const volunteer = await router.findBestVolunteer(request);
 * 
 * // Route request to volunteer
 * const session = await router.routeRequest(request, volunteer);
 * ```
 */
export class SupportRouter {
  private volunteerCache: Map<string, SupportVolunteer> = new Map();
  private lastCacheUpdate: Date = new Date();
  private readonly CACHE_TTL = 60 * 1000; // 1 minute

  /**
   * Creates a new Support Router instance
   * 
   * @param db - Database instance
   * @param config - Routing configuration
   */
  constructor(
    private db: Database,
    private config: RoutingConfig = DEFAULT_ROUTING_CONFIG
  ) {}

  /**
   * Initializes the router service
   */
  async initialize(): Promise<void> {
    await this.refreshVolunteerCache();
    logger.info('Support Router initialized');
  }

  /**
   * Routes a support request to the best available volunteer
   * 
   * @param request - Support request to route
   * @returns Created support session
   * @throws {Error} If no volunteers available
   */
  async routeRequest(request: SupportRequest): Promise<SupportSession> {
    try {
      // Find best volunteer
      const volunteer = await this.findBestVolunteer(request);
      
      if (volunteer === null) {
        // No volunteer available, put in queue
        return await this.queueRequest(request);
      }

      // Create session with assigned volunteer
      const session = await this.createSession(request, volunteer);

      // Update volunteer status
      await this.updateVolunteerLoad(volunteer.address, 1);

      // Notify volunteer
      this.notifyVolunteer(volunteer, session);

      logger.info(`Routed request ${request.requestId} to volunteer ${volunteer.address}`);
      return session;

    } catch (error) {
      logger.error('Failed to route request:', error);
      throw error;
    }
  }

  /**
   * Finds the best available volunteer for a request
   * 
   * @param request - Support request
   * @returns Best matched volunteer or null if none available
   */
  async findBestVolunteer(request: SupportRequest): Promise<SupportVolunteer | null> {
    try {
      // Refresh cache if needed
      await this.refreshVolunteerCache();

      // Get available volunteers
      const availableVolunteers = this.getAvailableVolunteers();

      if (availableVolunteers.length === 0) {
        return null;
      }

      // Score each volunteer
      const scores = availableVolunteers.map(volunteer => ({
        volunteer,
        score: this.calculateVolunteerScore(volunteer, request)
      }));

      // Sort by score (highest first)
      scores.sort((a, b) => b.score - a.score);

      // Return best match if score is above threshold
      const bestMatch = scores[0];
      if (bestMatch.score >= 0.3) { // Minimum acceptable score
        return bestMatch.volunteer;
      }

      return null;
    } catch (error) {
      logger.error('Failed to find best volunteer:', error);
      return null;
    }
  }

  /**
   * Calculates matching score for a volunteer
   * @private
   * @param volunteer - The volunteer to score
   * @param request - The support request to match against
   * @returns Matching score between 0 and 1
   */
  private calculateVolunteerScore(
    volunteer: SupportVolunteer, 
    request: SupportRequest
  ): number {
    let score = 0;

    // Language match (0-1)
    const languageMatch = volunteer.languages.includes(request.language) ? 1 : 0;
    score += languageMatch * this.config.languageWeight;

    // Category expertise (0-1)
    const expertiseMatch = volunteer.expertiseCategories.includes(request.category) ? 1 : 0;
    score += expertiseMatch * this.config.expertiseWeight;

    // Rating score (0-1)
    const ratingScore = volunteer.rating / 5;
    score += ratingScore * this.config.ratingWeight;

    // Response time score (0-1, inverse)
    const maxResponseTime = 300; // 5 minutes
    const responseScore = Math.max(0, 1 - (volunteer.avgResponseTime / maxResponseTime));
    score += responseScore * this.config.responseTimeWeight;

    // Load score (0-1, inverse)
    const loadScore = Math.max(0, 1 - (volunteer.activeSessions.length / volunteer.maxConcurrentSessions));
    score += loadScore * this.config.loadWeight;

    // Boost for high-value users
    if (this.config.userScoreBoost && request.userScore >= 80) {
      score *= 1.2;
    }

    // Priority boost
    if (request.priority === 'urgent') {
      score *= 1.5;
    } else if (request.priority === 'high') {
      score *= 1.2;
    }

    return Math.min(1, score);
  }

  /**
   * Gets all available volunteers
   * @private
   * @returns Array of available volunteers
   */
  private getAvailableVolunteers(): SupportVolunteer[] {
    const volunteers: SupportVolunteer[] = [];

    for (const volunteer of Array.from(this.volunteerCache.values())) {
      if (volunteer.status === 'available' && 
          volunteer.activeSessions.length < volunteer.maxConcurrentSessions) {
        volunteers.push(volunteer);
      }
    }

    return volunteers;
  }

  /**
   * Refreshes volunteer cache from database
   * @private
   */
  private async refreshVolunteerCache(): Promise<void> {
    const now = new Date();
    
    // Check if cache is still valid
    if (now.getTime() - this.lastCacheUpdate.getTime() < this.CACHE_TTL) {
      return;
    }

    try {
      const result = await this.db.query<VolunteerRow>(`
        SELECT 
          v.*,
          COALESCE(AVG(s.user_rating), 5) as rating,
          COUNT(DISTINCT s.session_id) as total_sessions,
          COALESCE(AVG(EXTRACT(EPOCH FROM (s.assignment_time - s.start_time))), 0) as avg_response_time,
          COALESCE(AVG(EXTRACT(EPOCH FROM (s.resolution_time - s.assignment_time)) / 60), 30) as avg_resolution_time,
          COALESCE(array_agg(DISTINCT as.session_id), '{}') as active_sessions
        FROM support_volunteers v
        LEFT JOIN support_sessions s ON v.address = s.volunteer_address
          AND s.resolution_time > NOW() - INTERVAL '30 days'
        LEFT JOIN support_sessions as ON v.address = as.volunteer_address  
          AND as.status IN ('assigned', 'active')
        WHERE v.is_active = true
        GROUP BY v.address
      `);

      // Clear and rebuild cache
      this.volunteerCache.clear();

      for (const row of result.rows) {
        const volunteer: SupportVolunteer = {
          address: row.address,
          displayName: row.display_name,
          status: row.status as VolunteerStatus,
          languages: row.languages,
          expertiseCategories: row.expertise_categories as SupportCategory[],
          rating: parseFloat(row.rating),
          totalSessions: parseInt(row.total_sessions, 10),
          avgResponseTime: parseFloat(row.avg_response_time),
          avgResolutionTime: parseFloat(row.avg_resolution_time),
          participationScore: row.participation_score,
          lastActive: row.last_active,
          activeSessions: row.active_sessions.filter((id): id is string => id !== null),
          maxConcurrentSessions: row.max_concurrent_sessions
        };

        this.volunteerCache.set(volunteer.address, volunteer);
      }

      this.lastCacheUpdate = now;
      logger.debug(`Refreshed volunteer cache with ${this.volunteerCache.size} volunteers`);

    } catch (error) {
      logger.error('Failed to refresh volunteer cache:', error);
    }
  }

  /**
   * Creates a support session
   * @private
   * @param request - The support request
   * @param volunteer - Optional volunteer assignment
   * @returns Created support session
   */
  private async createSession(
    request: SupportRequest,
    volunteer?: SupportVolunteer
  ): Promise<SupportSession> {
    const sessionId = this.generateSessionId();
    const now = new Date();

    const session: SupportSession = {
      sessionId,
      request,
      volunteer,
      status: volunteer !== undefined ? 'assigned' : 'waiting',
      startTime: now,
      assignmentTime: volunteer !== undefined ? now : undefined,
      messages: [],
      popPointsAwarded: 0
    };

    // Save to database
    await this.db.query(`
      INSERT INTO support_sessions (
        session_id, request_id, user_address, volunteer_address,
        category, priority, status, start_time, assignment_time,
        initial_message, language, user_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      sessionId,
      request.requestId,
      request.userAddress,
      volunteer !== undefined ? volunteer.address : null,
      request.category,
      request.priority,
      session.status,
      now,
      volunteer !== undefined ? now : null,
      request.initialMessage,
      request.language,
      request.userScore
    ]);

    return session;
  }

  /**
   * Queues a request when no volunteers available
   * @private
   * @param request - The support request to queue
   * @returns Created support session in waiting status
   */
  private async queueRequest(request: SupportRequest): Promise<SupportSession> {
    const session = await this.createSession(request);

    // Add to waiting queue
    await this.db.query(`
      INSERT INTO support_queue (session_id, priority, created_at)
      VALUES ($1, $2, NOW())
    `, [session.sessionId, request.priority]);

    logger.info(`Request ${request.requestId} added to queue`);
    return session;
  }

  /**
   * Updates volunteer's active session count
   * @private
   * @param address - Volunteer address
   * @param delta - Change in session count (+1 or -1)
   */
  private async updateVolunteerLoad(address: string, delta: number): Promise<void> {
    const volunteer = this.volunteerCache.get(address);
    if (volunteer === undefined) return;

    // Update cache
    if (delta > 0) {
      volunteer.activeSessions.push('temp'); // Will be updated on next cache refresh
    } else if (delta < 0 && volunteer.activeSessions.length > 0) {
      volunteer.activeSessions.pop();
    }

    // Update database
    await this.db.query(
      'UPDATE support_volunteers SET last_active = NOW() WHERE address = $1',
      [address]
    );
  }

  /**
   * Notifies volunteer of new assignment
   * @private
   * @param volunteer - The volunteer to notify
   * @param session - The assigned session
   */
  private notifyVolunteer(
    volunteer: SupportVolunteer, 
    session: SupportSession
  ): void {
    // In production, this would send real-time notification
    // For now, log the notification
    logger.info(`Notifying volunteer ${volunteer.address} of session ${session.sessionId}`);
    
    // Could integrate with WebSocket, push notifications, etc.
  }

  /**
   * Reassigns abandoned or timed-out sessions
   * @returns Promise resolving when reassignment is complete
   */
  async reassignAbandonedSessions(): Promise<void> {
    try {
      // Find sessions waiting too long
      const abandonedSessions = await this.db.query<SessionRow>(`
        SELECT s.*, sr.*
        FROM support_sessions s
        JOIN support_requests sr ON s.request_id = sr.request_id
        WHERE s.status = 'waiting'
        AND s.start_time < NOW() - INTERVAL '${this.config.maxWaitTime / 1000} seconds'
      `);

      for (const session of abandonedSessions.rows) {
        // Try to find a new volunteer
        const request: SupportRequest = {
          requestId: session.request_id,
          userAddress: session.user_address,
          category: session.category as SupportCategory,
          priority: 'high', // Escalate priority
          initialMessage: session.initial_message,
          language: session.language,
          userScore: session.user_score,
          timestamp: session.start_time
        };

        const volunteer = await this.findBestVolunteer(request);
        if (volunteer !== null) {
          // Assign to new volunteer
          await this.assignVolunteer(session.session_id, volunteer);
        }
      }
    } catch (error) {
      logger.error('Failed to reassign abandoned sessions:', error);
    }
  }

  /**
   * Assigns a volunteer to an existing session
   * @private
   * @param sessionId - The session ID to assign
   * @param volunteer - The volunteer to assign
   */
  private async assignVolunteer(
    sessionId: string, 
    volunteer: SupportVolunteer
  ): Promise<void> {
    await this.db.query(`
      UPDATE support_sessions 
      SET volunteer_address = $1, 
          assignment_time = NOW(),
          status = 'assigned'
      WHERE session_id = $2
    `, [volunteer.address, sessionId]);

    await this.updateVolunteerLoad(volunteer.address, 1);
  }

  /**
   * Gets routing statistics
   * @returns Routing statistics object
   */
  async getRoutingStats(): Promise<{
    availableVolunteers: number;
    queuedRequests: number;
    averageWaitTime: number;
    routingEfficiency: number;
  }> {
    try {
      // Available volunteers
      await this.refreshVolunteerCache();
      const availableVolunteers = this.getAvailableVolunteers();

      // Queued requests
      const queuedResult = await this.db.query<QueueStatsRow>(
        'SELECT COUNT(*) as count FROM support_sessions WHERE status = $1',
        ['waiting']
      );

      // Average wait time
      const waitTimeResult = await this.db.query<WaitTimeRow>(`
        SELECT AVG(EXTRACT(EPOCH FROM (assignment_time - start_time))) as avg_wait
        FROM support_sessions
        WHERE assignment_time IS NOT NULL
        AND start_time > NOW() - INTERVAL '24 hours'
      `);

      // Routing efficiency (sessions routed vs queued)
      const efficiencyResult = await this.db.query<EfficiencyRow>(`
        SELECT 
          COUNT(CASE WHEN status != 'waiting' THEN 1 END)::float / 
          COUNT(*)::float as efficiency
        FROM support_sessions
        WHERE start_time > NOW() - INTERVAL '24 hours'
      `);

      return {
        availableVolunteers: availableVolunteers.length,
        queuedRequests: queuedResult.rows[0] !== undefined ? parseInt(queuedResult.rows[0].count, 10) : 0,
        averageWaitTime: waitTimeResult.rows[0]?.avg_wait !== null && waitTimeResult.rows[0]?.avg_wait !== undefined ? parseFloat(waitTimeResult.rows[0].avg_wait) : 0,
        routingEfficiency: efficiencyResult.rows[0]?.efficiency !== null && efficiencyResult.rows[0]?.efficiency !== undefined ? parseFloat(efficiencyResult.rows[0].efficiency) : 0
      };
    } catch (error) {
      logger.error('Failed to get routing stats:', error);
      return {
        availableVolunteers: 0,
        queuedRequests: 0,
        averageWaitTime: 0,
        routingEfficiency: 0
      };
    }
  }

  /**
   * Generates unique session ID
   * @private
   * @returns Unique session identifier
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}