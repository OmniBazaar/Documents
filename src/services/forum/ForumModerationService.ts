/**
 * Forum Moderation Service
 * 
 * Handles community-driven moderation with validator consensus,
 * inspired by decentralized moderation models from Retroshare and IPFS-Boards.
 * 
 * @module ForumModerationService
 */

import { Database } from '../../../../Validator/src/database/Database';
import { ParticipationScoreService } from '../../../../Validator/src/services/ParticipationScoreService';
import { ForumConsensus } from './ForumConsensus';
import { ForumIncentives } from './ForumIncentives';
import { logger } from '../../utils/logger';
import type { UserParticipationData } from '../../../../Validator/src/services/ParticipationScoreService';
import {
  ModerationRequest,
  ForumReputation,
  ForumPost,
  ForumAttachment
} from './ForumTypes';

/**
 * Moderation configuration
 */
export interface ModerationConfig {
  /** Minimum reputation to become a moderator */
  minReputationForModerator: number;
  /** Minimum reputation to flag content */
  minReputationToFlag: number;
  /** Number of flags before auto-review */
  flagsForAutoReview: number;
  /** Cooldown between flags from same user (ms) */
  flagCooldownMs: number;
  /** Maximum flags per day per user */
  maxFlagsPerDay: number;
  /** Consensus threshold for moderation actions */
  consensusThreshold: number;
}

/**
 * Flag report from a user
 */
interface FlagReport {
  /** Report ID */
  id: string;
  /** Content being flagged */
  contentId: string;
  /** Type of content */
  contentType: 'thread' | 'post';
  /** Reporter's address */
  reporterAddress: string;
  /** Reason for flag */
  reason: 'spam' | 'offensive' | 'misinformation' | 'off_topic' | 'other';
  /** Additional details */
  details: string;
  /** Timestamp */
  timestamp: number;
  /** Status of the report */
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
}

/**
 * Moderator action log
 */
interface ModeratorAction {
  /** Action ID */
  id: string;
  /** Moderator address */
  moderatorAddress: string;
  /** Action taken */
  action: string;
  /** Target content */
  targetId: string;
  /** Reason */
  reason: string;
  /** Timestamp */
  timestamp: number;
  /** Was the action reversed */
  reversed: boolean;
}

/**
 * Default moderation configuration
 */
const DEFAULT_CONFIG: ModerationConfig = {
  minReputationForModerator: 75,
  minReputationToFlag: 10,
  flagsForAutoReview: 3,
  flagCooldownMs: 300000, // 5 minutes
  maxFlagsPerDay: 10,
  consensusThreshold: 0.66 // 2/3 majority
};

/**
 * Forum Moderation Service
 * 
 * @example
 * ```typescript
 * const moderation = new ForumModerationService(db, consensus, incentives);
 * await moderation.initialize();
 * 
 * // Flag inappropriate content
 * await moderation.flagContent({
 *   contentId: postId,
 *   contentType: 'post',
 *   reporterAddress: userAddress,
 *   reason: 'spam',
 *   details: 'Promotional content'
 * });
 * ```
 */
export class ForumModerationService {
  /**
   * Creates a new moderation service instance
   * 
   * @param db - Database instance
   * @param consensus - Forum consensus service
   * @param incentives - Forum incentives service
   * @param participationService - Participation score service
   * @param config - Moderation configuration
   */
  constructor(
    private db: Database,
    private consensus: ForumConsensus,
    private incentives: ForumIncentives,
    private participationService: ParticipationScoreService,
    private config: ModerationConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Initializes the moderation service
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    await this.createModerationTables();
    logger.info('Forum Moderation Service initialized');
  }

  /**
   * Flags content for review
   * 
   * @param report - Flag report details
   * @throws {Error} If user cannot flag or cooldown active
   */
  async flagContent(report: Omit<FlagReport, 'id' | 'timestamp' | 'status'>): Promise<void> {
    // Validate reporter can flag
    await this.validateReporter(report.reporterAddress);

    // Check cooldown
    await this.checkFlagCooldown(report.reporterAddress);

    // Create flag report
    const flagId = this.generateFlagId();
    const flagReport: FlagReport = {
      ...report,
      id: flagId,
      timestamp: Date.now(),
      status: 'pending'
    };

    // Store flag
    await this.db.query(
      `INSERT INTO forum_flag_reports (
        id, content_id, content_type, reporter_address, reason,
        details, timestamp, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        flagReport.id, flagReport.contentId, flagReport.contentType,
        flagReport.reporterAddress, flagReport.reason, flagReport.details,
        new Date(flagReport.timestamp), flagReport.status
      ]
    );

    // Check if content needs auto-review
    await this.checkAutoReview(report.contentId);

    // Award small PoP for flagging (will be increased if flag is valid)
    await this.incentives.rewardModeration(report.reporterAddress, 'flag_spam', false);
  }

  /**
   * Reviews flagged content
   * 
   * @param contentId - Content to review
   * @param reviewerAddress - Reviewer's address
   * @returns Review decision
   */
  async reviewFlaggedContent(
    contentId: string,
    reviewerAddress: string
  ): Promise<{
    shouldRemove: boolean;
    shouldWarn: boolean;
    consensusReached: boolean;
  }> {
    // Validate reviewer is a moderator
    const isModerator = await this.isModerator(reviewerAddress);
    if (!isModerator) {
      throw new Error('Only moderators can review flagged content');
    }

    // Get all flags for this content
    const flags = await this.getContentFlags(contentId);
    
    // Analyze content with consensus
    const spamAnalysis = await this.analyzeContent(contentId);
    
    // Get moderator votes
    const votes = await this.getModerationVotes(contentId);
    
    // Calculate decision
    const decision = this.calculateModerationDecision(flags, spamAnalysis, votes);

    // If consensus reached, execute action
    if (decision.consensusReached) {
      await this.executeModerationDecision(contentId, decision, reviewerAddress);
    }

    // Award moderation points
    await this.incentives.rewardModeration(reviewerAddress, 'review_post', true);

    return decision;
  }

  /**
   * Promotes user to moderator
   * 
   * @param address - User address to promote
   * @param promoterAddress - Address of user doing the promotion
   * @throws {Error} If promotion requirements not met
   */
  async promoteToModerator(
    address: string,
    promoterAddress: string
  ): Promise<void> {
    // Check if promoter is admin or existing moderator with enough reputation
    const canPromote = await this.canPromoteModerators(promoterAddress);
    if (!canPromote) {
      throw new Error('Insufficient permissions to promote moderators');
    }

    // Check if user meets requirements
    const userRep = await this.getUserReputation(address);
    if (userRep.reputationScore < this.config.minReputationForModerator) {
      throw new Error(`User needs ${this.config.minReputationForModerator} reputation to become a moderator`);
    }

    // Promote to moderator
    await this.db.query(
      `UPDATE forum_user_stats 
       SET is_moderator = true, moderator_since = NOW()
       WHERE address = $1`,
      [address]
    );

    // Log promotion
    await this.logModeratorAction({
      moderatorAddress: promoterAddress,
      action: 'promote_moderator',
      targetId: address,
      reason: 'Met reputation requirements'
    });
  }

  /**
   * Gets moderation statistics
   * 
   * @returns Moderation statistics
   */
  async getModerationStats(): Promise<{
    totalFlags: number;
    pendingReviews: number;
    resolvedToday: number;
    activeModerators: number;
    falsePositiveRate: number;
  }> {
    const stats = await this.db.query(`
      SELECT 
        (SELECT COUNT(*) FROM forum_flag_reports) as total_flags,
        (SELECT COUNT(*) FROM forum_flag_reports WHERE status = 'pending') as pending_reviews,
        (SELECT COUNT(*) FROM forum_flag_reports WHERE status = 'resolved' AND timestamp > NOW() - INTERVAL '24 hours') as resolved_today,
        (SELECT COUNT(*) FROM forum_user_stats WHERE is_moderator = true) as active_moderators,
        (SELECT 
          COUNT(*) FILTER (WHERE status = 'dismissed') * 100.0 / 
          NULLIF(COUNT(*) FILTER (WHERE status IN ('resolved', 'dismissed')), 0)
         FROM forum_flag_reports) as false_positive_rate
    `);

    const row = stats.rows[0];
    return {
      totalFlags: parseInt(String(row?.total_flags ?? 0)),
      pendingReviews: parseInt(String(row?.pending_reviews ?? 0)),
      resolvedToday: parseInt(String(row?.resolved_today ?? 0)),
      activeModerators: parseInt(String(row?.active_moderators ?? 0)),
      falsePositiveRate: row?.false_positive_rate !== null && row?.false_positive_rate !== undefined 
        ? parseFloat(String(row.false_positive_rate)) 
        : 0
    };
  }

  /**
   * Gets pending moderation queue
   * 
   * @param moderatorAddress - Moderator requesting the queue
   * @param limit - Maximum items to return
   * @returns Pending moderation items
   */
  async getModerationQueue(
    moderatorAddress: string,
    limit: number = 20
  ): Promise<Array<{
    contentId: string;
    contentType: string;
    flagCount: number;
    firstFlaggedAt: number;
    reasons: string[];
    priority: 'low' | 'medium' | 'high';
  }>> {
    // Validate moderator
    const isMod = await this.isModerator(moderatorAddress);
    if (!isMod) {
      throw new Error('Only moderators can access the moderation queue');
    }

    const queue = await this.db.query(`
      SELECT 
        content_id,
        content_type,
        COUNT(*) as flag_count,
        MIN(timestamp) as first_flagged_at,
        array_agg(DISTINCT reason) as reasons,
        CASE 
          WHEN COUNT(*) >= 5 THEN 'high'
          WHEN COUNT(*) >= 3 THEN 'medium'
          ELSE 'low'
        END as priority
      FROM forum_flag_reports
      WHERE status = 'pending'
      GROUP BY content_id, content_type
      ORDER BY priority DESC, flag_count DESC, first_flagged_at ASC
      LIMIT $1
    `, [limit]);

    return queue.rows.map(row => ({
      contentId: String(row.content_id),
      contentType: String(row.content_type),
      flagCount: parseInt(String(row.flag_count)),
      firstFlaggedAt: new Date(String(row.first_flagged_at)).getTime(),
      reasons: Array.isArray(row.reasons) ? row.reasons.map(String) : [],
      priority: row.priority as 'low' | 'medium' | 'high'
    }));
  }

  /**
   * Validates reporter can flag content
   * @param reporterAddress - Address of the user reporting content
   * @private
   */
  private async validateReporter(reporterAddress: string): Promise<void> {
    // Type assertion for ParticipationScoreService method
    const getScore = (address: string): Promise<UserParticipationData | null> => {
      return (this.participationService.getScore as (addr: string) => Promise<UserParticipationData | null>)(address);
    };
    const userScore = await getScore(reporterAddress);
    
    if (userScore === null || userScore.totalScore < this.config.minReputationToFlag) {
      throw new Error(`Minimum ${this.config.minReputationToFlag} reputation required to flag content`);
    }

    // Check daily flag limit
    const flagsToday = await this.db.query(
      `SELECT COUNT(*) as count 
       FROM forum_flag_reports 
       WHERE reporter_address = $1 
       AND timestamp > NOW() - INTERVAL '24 hours'`,
      [reporterAddress]
    );

    const flagCount = flagsToday.rows[0]?.count as string | number | undefined;
    if (flagCount !== undefined && parseInt(String(flagCount)) >= this.config.maxFlagsPerDay) {
      throw new Error('Daily flag limit exceeded');
    }
  }

  /**
   * Checks flag cooldown
   * @param reporterAddress - Address of the user reporting content
   * @private
   */
  private async checkFlagCooldown(reporterAddress: string): Promise<void> {
    const lastFlag = await this.db.query(
      `SELECT MAX(timestamp) as last_flag 
       FROM forum_flag_reports 
       WHERE reporter_address = $1`,
      [reporterAddress]
    );

    const lastFlagTime = lastFlag.rows[0]?.last_flag as string | Date | undefined;
    if (lastFlagTime !== undefined) {
      const timeSinceLastFlag = Date.now() - new Date(String(lastFlagTime)).getTime();
      if (timeSinceLastFlag < this.config.flagCooldownMs) {
        const remainingTime = Math.ceil((this.config.flagCooldownMs - timeSinceLastFlag) / 1000);
        throw new Error(`Please wait ${remainingTime} seconds before flagging again`);
      }
    }
  }

  /**
   * Checks if content needs auto-review
   * @param contentId - ID of the content to check
   * @private
   */
  private async checkAutoReview(contentId: string): Promise<void> {
    const flagCount = await this.db.query(
      `SELECT COUNT(*) as count 
       FROM forum_flag_reports 
       WHERE content_id = $1 AND status = 'pending'`,
      [contentId]
    );

    const count = flagCount.rows[0]?.count as string | number | undefined;
    if (count !== undefined && parseInt(String(count)) >= this.config.flagsForAutoReview) {
      // Trigger auto-review through consensus
      const request: ModerationRequest = {
        action: 'delete',
        targetId: contentId,
        targetType: 'post', // Would need to determine actual type
        moderatorAddress: 'system',
        reason: 'Multiple flags received - pending review'
      };

      await this.consensus.processModerationRequest(request);
    }
  }

  /**
   * Checks if user is a moderator
   * @param address - User address to check
   * @private
   * @returns True if user is a moderator
   */
  private async isModerator(address: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT is_moderator FROM forum_user_stats WHERE address = $1',
      [address]
    );

    return result.rows.length > 0 && result.rows[0]?.is_moderator === true;
  }

  /**
   * Gets all flags for content
   * @param contentId - ID of the content to get flags for
   * @private
   * @returns Array of flag reports
   */
  private async getContentFlags(contentId: string): Promise<FlagReport[]> {
    const flags = await this.db.query(
      `SELECT * FROM forum_flag_reports 
       WHERE content_id = $1 AND status = 'pending'
       ORDER BY timestamp ASC`,
      [contentId]
    );

    return flags.rows.map(row => ({
      id: String(row.id),
      contentId: String(row.content_id),
      contentType: row.content_type as 'thread' | 'post',
      reporterAddress: String(row.reporter_address),
      reason: row.reason as 'spam' | 'offensive' | 'misinformation' | 'off_topic' | 'other',
      details: String(row.details ?? ''),
      timestamp: new Date(String(row.timestamp)).getTime(),
      status: row.status as 'pending' | 'reviewing' | 'resolved' | 'dismissed'
    }));
  }

  /**
   * Analyzes content for spam/violations
   * @param contentId - ID of the content to analyze
   * @private
   * @returns Analysis result with spam detection and violations
   */
  private async analyzeContent(contentId: string): Promise<{
    isSpam: boolean;
    confidence: number;
    violations: string[];
  }> {
    // Get the actual content
    const content = await this.db.query(
      'SELECT * FROM forum_posts WHERE id = $1',
      [contentId]
    );

    if (content.rows.length === 0) {
      return { isSpam: false, confidence: 0, violations: [] };
    }

    // Convert database row to ForumPost type
    const row = content.rows[0];
    const forumPost: ForumPost = {
      id: String(row.id),
      threadId: String(row.thread_id),
      authorAddress: String(row.author_address),
      content: String(row.content),
      createdAt: new Date(String(row.created_at)).getTime(),
      editedAt: row.edited_at !== null && row.edited_at !== undefined ? new Date(String(row.edited_at)).getTime() : undefined,
      upvotes: parseInt(String(row.upvotes ?? 0)),
      downvotes: parseInt(String(row.downvotes ?? 0)),
      isAcceptedAnswer: Boolean(row.is_accepted_answer),
      isDeleted: Boolean(row.is_deleted),
      attachments: Array.isArray(row.attachments) ? (row.attachments as ForumAttachment[]) : []
    };
    
    // Use consensus service for spam detection
    const spamResult = await this.consensus.detectSpam(forumPost);
    
    // Check for other violations
    const violations: string[] = [];
    if (spamResult.isSpam) violations.push('spam');
    
    // Add more violation checks here (offensive content, etc.)
    
    return {
      isSpam: spamResult.isSpam,
      confidence: spamResult.confidence,
      violations
    };
  }

  /**
   * Gets moderation votes for content
   * @param contentId - ID of the content to get votes for
   * @private
   * @returns Map of moderator addresses to their votes
   */
  private async getModerationVotes(contentId: string): Promise<Record<string, boolean>> {
    const votes = await this.db.query(
      `SELECT moderator_address, vote 
       FROM forum_moderation_votes 
       WHERE content_id = $1`,
      [contentId]
    );

    const voteMap: Record<string, boolean> = {};
    votes.rows.forEach(row => {
      const address = String(row.moderator_address);
      voteMap[address] = Boolean(row.vote);
    });

    return voteMap;
  }

  /**
   * Calculates moderation decision based on inputs
   * @param flags - Array of flag reports
   * @param spamAnalysis - Spam analysis result
   * @param spamAnalysis.isSpam - Whether content is detected as spam
   * @param spamAnalysis.confidence - Confidence score for spam detection
   * @param spamAnalysis.violations - Array of detected violations
   * @param votes - Moderator votes
   * @private
   * @returns Decision on whether to remove or warn
   */
  private calculateModerationDecision(
    flags: FlagReport[],
    spamAnalysis: { isSpam: boolean; confidence: number; violations: string[] },
    votes: Record<string, boolean>
  ): {
    shouldRemove: boolean;
    shouldWarn: boolean;
    consensusReached: boolean;
  } {
    // High confidence spam = auto remove
    if (spamAnalysis.confidence > 0.9) {
      return {
        shouldRemove: true,
        shouldWarn: false,
        consensusReached: true
      };
    }

    // Calculate moderator consensus
    const totalVotes = Object.keys(votes).length;
    const removeVotes = Object.values(votes).filter(v => v).length;
    const consensusRatio = totalVotes > 0 ? removeVotes / totalVotes : 0;

    // Multiple serious flags + moderator agreement
    const seriousFlags = flags.filter(f => 
      ['spam', 'offensive', 'misinformation'].includes(f.reason)
    ).length;

    if (totalVotes >= 3 && consensusRatio >= this.config.consensusThreshold) {
      return {
        shouldRemove: true,
        shouldWarn: false,
        consensusReached: true
      };
    }

    // Warning conditions
    if (seriousFlags >= 2 || spamAnalysis.confidence > 0.5) {
      return {
        shouldRemove: false,
        shouldWarn: true,
        consensusReached: totalVotes >= 3
      };
    }

    return {
      shouldRemove: false,
      shouldWarn: false,
      consensusReached: false
    };
  }

  /**
   * Executes moderation decision
   * @param contentId - ID of the content being moderated
   * @param decision - Moderation decision
   * @param decision.shouldRemove - Whether to remove the content
   * @param decision.shouldWarn - Whether to add a warning to the content
   * @param decision.consensusReached - Whether consensus was reached
   * @param moderatorAddress - Address of the moderator executing the decision
   * @private
   */
  private async executeModerationDecision(
    contentId: string,
    decision: { shouldRemove: boolean; shouldWarn: boolean; consensusReached: boolean },
    moderatorAddress: string
  ): Promise<void> {
    if (decision.shouldRemove) {
      // Soft delete the content
      await this.db.query(
        'UPDATE forum_posts SET is_deleted = true, deleted_by = $1, deleted_at = NOW() WHERE id = $2',
        [moderatorAddress, contentId]
      );

      // Update flag reports
      await this.db.query(
        `UPDATE forum_flag_reports 
         SET status = 'resolved', resolved_at = NOW(), resolved_by = $1
         WHERE content_id = $2 AND status = 'pending'`,
        [moderatorAddress, contentId]
      );

      // Reward correct flaggers
      const flags = await this.getContentFlags(contentId);
      for (const flag of flags) {
        await this.incentives.rewardModeration(flag.reporterAddress, 'flag_spam', true);
      }

    } else if (decision.shouldWarn) {
      // Add warning to content
      await this.db.query(
        `UPDATE forum_posts 
         SET has_warning = true, warning_reason = 'Community flagged content'
         WHERE id = $1`,
        [contentId]
      );
    }

    // Log the action
    await this.logModeratorAction({
      moderatorAddress,
      action: decision.shouldRemove ? 'remove_content' : 'warn_content',
      targetId: contentId,
      reason: 'Community consensus'
    });
  }

  /**
   * Gets user reputation for moderation
   * @param address - User address
   * @private
   * @returns User's forum reputation
   */
  private async getUserReputation(address: string): Promise<ForumReputation> {
    const stats = await this.incentives.getUserContributionStats(address);
    
    return {
      address,
      totalPosts: stats.postsMade,
      totalThreads: stats.threadsCreated,
      totalUpvotesReceived: stats.upvotesReceived,
      totalDownvotesReceived: stats.downvotesReceived,
      acceptedAnswers: stats.acceptedAnswers,
      reputationScore: this.calculateReputationScore(stats),
      isModerator: false, // Will be set from DB
      badges: []
    };
  }

  /**
   * Calculates reputation score
   * @param stats - User contribution statistics
   * @param stats.threadsCreated - Number of threads created
   * @param stats.postsMade - Number of posts made
   * @param stats.upvotesReceived - Number of upvotes received
   * @param stats.acceptedAnswers - Number of accepted answers
   * @param stats.downvotesReceived - Number of downvotes received
   * @param stats.streakDays - Number of consecutive days active
   * @private
   * @returns Calculated reputation score
   */
  private calculateReputationScore(stats: {
    threadsCreated: number;
    postsMade: number;
    upvotesReceived: number;
    acceptedAnswers: number;
    downvotesReceived: number;
    streakDays: number;
  }): number {
    return (
      stats.threadsCreated * 0.5 +
      stats.postsMade * 0.1 +
      stats.upvotesReceived * 0.2 +
      stats.acceptedAnswers * 2 -
      stats.downvotesReceived * 0.1 +
      stats.streakDays * 0.1
    );
  }

  /**
   * Checks if user can promote moderators
   * @param address - User address to check
   * @private
   * @returns True if user can promote moderators
   */
  private async canPromoteModerators(address: string): Promise<boolean> {
    // Check if user is a senior moderator or admin
    const result = await this.db.query(
      `SELECT is_moderator, moderator_level 
       FROM forum_user_stats 
       WHERE address = $1`,
      [address]
    );

    if (result.rows.length === 0) return false;

    const row = result.rows[0];
    return Boolean(row?.is_moderator) && 
           (row?.moderator_level === 'senior' || 
            row?.moderator_level === 'admin');
  }

  /**
   * Logs moderator action
   * @param action - Action details to log
   * @private
   */
  private async logModeratorAction(action: Omit<ModeratorAction, 'id' | 'timestamp' | 'reversed'>): Promise<void> {
    await this.db.query(
      `INSERT INTO forum_moderator_actions (
        id, moderator_address, action, target_id, reason, timestamp
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        this.generateActionId(),
        action.moderatorAddress,
        action.action,
        action.targetId,
        action.reason
      ]
    );
  }

  /**
   * Creates necessary database tables
   * @private
   */
  private async createModerationTables(): Promise<void> {
    // Flag reports table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS forum_flag_reports (
        id VARCHAR(100) PRIMARY KEY,
        content_id VARCHAR(100) NOT NULL,
        content_type VARCHAR(10) NOT NULL,
        reporter_address VARCHAR(42) NOT NULL,
        reason VARCHAR(20) NOT NULL,
        details TEXT,
        timestamp TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'pending',
        resolved_at TIMESTAMP,
        resolved_by VARCHAR(42),
        INDEX idx_flags_content (content_id),
        INDEX idx_flags_reporter (reporter_address),
        INDEX idx_flags_status (status)
      )
    `);

    // Moderation votes table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS forum_moderation_votes (
        content_id VARCHAR(100),
        moderator_address VARCHAR(42),
        vote BOOLEAN NOT NULL,
        reason TEXT,
        timestamp TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (content_id, moderator_address)
      )
    `);

    // Moderator actions log
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS forum_moderator_actions (
        id VARCHAR(100) PRIMARY KEY,
        moderator_address VARCHAR(42) NOT NULL,
        action VARCHAR(50) NOT NULL,
        target_id VARCHAR(100) NOT NULL,
        reason TEXT,
        timestamp TIMESTAMP DEFAULT NOW(),
        reversed BOOLEAN DEFAULT false,
        reversed_at TIMESTAMP,
        reversed_by VARCHAR(42)
      )
    `);

    // Add moderation fields to posts table
    await this.db.query(`
      ALTER TABLE forum_posts 
      ADD COLUMN IF NOT EXISTS has_warning BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS warning_reason TEXT,
      ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(42),
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
    `);

    // Add moderator fields to user stats
    await this.db.query(`
      ALTER TABLE forum_user_stats
      ADD COLUMN IF NOT EXISTS moderator_since TIMESTAMP,
      ADD COLUMN IF NOT EXISTS moderator_level VARCHAR(20) DEFAULT 'standard',
      ADD COLUMN IF NOT EXISTS moderation_actions INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS correct_flags INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS false_flags INTEGER DEFAULT 0
    `);
  }

  /**
   * Generates unique flag ID
   * @private
   * @returns Generated flag ID
   */
  private generateFlagId(): string {
    return `flag_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generates unique action ID
   * @private
   * @returns Generated action ID
   */
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}