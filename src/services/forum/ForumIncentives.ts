/**
 * Forum Incentives Service
 *
 * Manages Proof of Participation (PoP) point distribution for forum activities,
 * quality answer rewards, and moderator incentives. Integrates with the main
 * ParticipationScoreService to award points for valuable contributions.
 *
 * @module ForumIncentives
 */

import { Database } from '../../services/database/Database';
import { logger } from '../../utils/logger';
import { ParticipationScoreService } from '../participation/ParticipationScoreService';

/**
 * Point allocation configuration for forum activities
 */
export interface ForumPointAllocation {
  /** Points for creating a thread */
  threadCreation: {
    base: number;
    categoryMultipliers: Record<string, number>;
  };
  /** Points for posting */
  posting: {
    base: number;
    acceptedAnswer: number;
    helpfulPost: number;
  };
  /** Points for voting */
  voting: {
    receivedUpvote: number;
    maxUpvotePoints: number;
    receivedDownvote: number;
  };
  /** Points for moderation */
  moderation: {
    flagSpam: number;
    correctFlag: number;
    reviewPost: number;
  };
  /** Bonus multipliers */
  bonuses: {
    newUserHelp: number;
    multilingualSupport: number;
    streakMultiplier: number;
    highQualityMultiplier: number;
  };
}

/**
 * User contribution statistics
 */
interface UserContributionStats {
  /** Total threads created */
  threadsCreated: number;
  /** Total posts made */
  postsMade: number;
  /** Total upvotes received */
  upvotesReceived: number;
  /** Total downvotes received */
  downvotesReceived: number;
  /** Accepted answers */
  acceptedAnswers: number;
  /** Current streak days */
  streakDays: number;
  /** Quality score average */
  avgQualityScore: number;
  /** Languages supported */
  languagesSupported: string[];
}

/**
 * Default point allocations based on the plan
 */
const DEFAULT_POINT_ALLOCATION: ForumPointAllocation = {
  threadCreation: {
    base: 0.5,
    categoryMultipliers: {
      technical: 1.5,
      feature: 1.2,
      governance: 2.0,
      wallet: 1.0,
      marketplace: 1.0,
      dex: 1.0,
    },
  },
  posting: {
    base: 0.1,
    acceptedAnswer: 1.0,
    helpfulPost: 0.2,
  },
  voting: {
    receivedUpvote: 0.2,
    maxUpvotePoints: 2.0,
    receivedDownvote: -0.1,
  },
  moderation: {
    flagSpam: 0.1,
    correctFlag: 0.5,
    reviewPost: 0.3,
  },
  bonuses: {
    newUserHelp: 1.5,
    multilingualSupport: 1.3,
    streakMultiplier: 1.1,
    highQualityMultiplier: 1.5,
  },
};

/**
 * Forum Incentives Service
 *
 * @example
 * ```typescript
 * const incentives = new ForumIncentives(participationService);
 * await incentives.initialize();
 *
 * // Reward thread creation
 * await incentives.rewardThreadCreation(userAddress, 'technical');
 *
 * // Process upvote rewards
 * await incentives.processVoteRewards(postId, 'upvote');
 * ```
 */
export class ForumIncentives {
  private db: Database;

  /**
   * Creates a new Forum Incentives instance
   *
   * @param participationService - Service for managing participation scores
   * @param db - Database instance
   * @param pointAllocation - Optional custom point allocation
   */
  constructor(
    private participationService: ParticipationScoreService,
    db: Database,
    private pointAllocation: ForumPointAllocation = DEFAULT_POINT_ALLOCATION,
  ) {
    this.db = db;
  }

  /**
   * Initializes the incentives service
   */
  async initialize(): Promise<void> {
    await this.createIncentiveTables();
    logger.info('Forum Incentives Service initialized');
  }

  /**
   * Rewards a user for creating a thread
   *
   * @param authorAddress - Thread author's address
   * @param category - Thread category
   * @returns Points awarded
   */
  async rewardThreadCreation(authorAddress: string, category: string): Promise<number> {
    try {
      // Calculate base points
      let points = this.pointAllocation.threadCreation.base;

      // Apply category multiplier
      const multiplier = this.pointAllocation.threadCreation.categoryMultipliers[category] ?? 1.0;
      points *= multiplier;

      // Check for streak bonus
      const streak = await this.getUserStreak(authorAddress);
      if (streak > 7) {
        points *= this.pointAllocation.bonuses.streakMultiplier;
      }

      // Award points
      await this.awardPoints(authorAddress, points, 'thread_creation', {
        category,
        streakDays: streak,
      });

      // Update user stats
      await this.updateUserStats(authorAddress, 'thread_created');

      return points;
    } catch (error) {
      logger.error('Error rewarding thread creation', {
        error: error instanceof Error ? error.message : String(error),
        authorAddress,
        category,
      });
      return 0;
    }
  }

  /**
   * Tracks post creation for later reward calculation
   *
   * @param authorAddress - Post author's address
   * @param postId - Created post ID
   */
  async trackPostCreation(authorAddress: string, postId: string): Promise<void> {
    try {
      // Record post creation
      await this.db.query(
        `INSERT INTO forum_post_tracking (post_id, author_address, created_at)
         VALUES ($1, $2, NOW())`,
        [postId, authorAddress],
      );

      // Award base posting points
      await this.awardPoints(authorAddress, this.pointAllocation.posting.base, 'post_creation', {
        postId,
      });

      // Update streak
      await this.updateUserStreak(authorAddress);
    } catch (error) {
      logger.error('Error tracking post creation', {
        error: error instanceof Error ? error.message : String(error),
        authorAddress,
        postId,
      });
    }
  }

  /**
   * Processes vote rewards for post authors
   *
   * @param postId - Post that received the vote
   * @param voteType - Type of vote (upvote/downvote)
   */
  async processVoteRewards(postId: string, voteType: 'upvote' | 'downvote'): Promise<void> {
    try {
      // Get post author
      const postResult = await this.db.query(
        'SELECT author_address, upvotes FROM forum_posts WHERE id = $1',
        [postId],
      );

      if (postResult.rows.length === 0) return;

      const postData = postResult.rows[0] as { author_address: string; upvotes: number };
      const { author_address: authorAddress, upvotes } = postData;

      if (voteType === 'upvote') {
        // Calculate points (capped at max)
        const currentPoints = upvotes * this.pointAllocation.voting.receivedUpvote;
        if (currentPoints <= this.pointAllocation.voting.maxUpvotePoints) {
          await this.awardPoints(
            authorAddress,
            this.pointAllocation.voting.receivedUpvote,
            'received_upvote',
            { postId, totalUpvotes: upvotes },
          );
        }
      } else {
        // Apply small penalty for downvotes (to discourage low quality)
        await this.awardPoints(
          authorAddress,
          this.pointAllocation.voting.receivedDownvote,
          'received_downvote',
          { postId },
        );
      }

      // Check for quality threshold bonuses
      await this.checkQualityBonuses(postId, authorAddress);
    } catch (error) {
      logger.error('Error processing vote rewards', {
        error: error instanceof Error ? error.message : String(error),
        postId,
        voteType,
      });
    }
  }

  /**
   * Rewards accepted answer
   *
   * @param postId - Post marked as accepted answer
   * @param authorAddress - Post author's address
   */
  async rewardAcceptedAnswer(postId: string, authorAddress: string): Promise<void> {
    try {
      await this.awardPoints(
        authorAddress,
        this.pointAllocation.posting.acceptedAnswer,
        'accepted_answer',
        { postId },
      );

      // Update user stats
      await this.db.query(
        `UPDATE forum_user_stats 
         SET accepted_answers = accepted_answers + 1
         WHERE address = $1`,
        [authorAddress],
      );
    } catch (error) {
      logger.error('Error rewarding accepted answer', {
        error: error instanceof Error ? error.message : String(error),
        postId,
        authorAddress,
      });
    }
  }

  /**
   * Rewards moderation activities
   *
   * @param moderatorAddress - Moderator's address
   * @param action - Type of moderation action
   * @param wasCorrect - Whether the action was validated as correct
   */
  async rewardModeration(
    moderatorAddress: string,
    action: 'flag_spam' | 'review_post',
    wasCorrect = true,
  ): Promise<void> {
    try {
      let points = 0;

      switch (action) {
        case 'flag_spam':
          points = this.pointAllocation.moderation.flagSpam;
          if (wasCorrect) {
            points += this.pointAllocation.moderation.correctFlag;
          }
          break;
        case 'review_post':
          points = this.pointAllocation.moderation.reviewPost;
          break;
      }

      if (points > 0) {
        await this.awardPoints(moderatorAddress, points, `moderation_${action}`, { wasCorrect });
      }
    } catch (error) {
      logger.error('Error rewarding moderation', {
        error: error instanceof Error ? error.message : String(error),
        moderatorAddress,
        action,
        wasCorrect,
      });
    }
  }

  /**
   * Gets user contribution statistics
   *
   * @param address - User's address
   * @returns User contribution stats
   */
  async getUserContributionStats(address: string): Promise<UserContributionStats> {
    try {
      const stats = await this.db.query(`SELECT * FROM forum_user_stats WHERE address = $1`, [
        address,
      ]);

      if (stats.rows.length === 0) {
        // Return default stats for new user
        return {
          threadsCreated: 0,
          postsMade: 0,
          upvotesReceived: 0,
          downvotesReceived: 0,
          acceptedAnswers: 0,
          streakDays: 0,
          avgQualityScore: 0,
          languagesSupported: [],
        };
      }

      return this.mapUserStats(stats.rows[0] as Record<string, unknown>);
    } catch (error) {
      logger.error('Error getting user contribution stats', {
        error: error instanceof Error ? error.message : String(error),
        address,
      });
      throw error;
    }
  }

  /**
   * Calculates and awards daily participation bonus
   *
   * @param address - User's address
   */
  async calculateDailyBonus(address: string): Promise<void> {
    try {
      // Check if user has already received today's bonus
      const existing = await this.db.query(
        `SELECT * FROM forum_daily_bonuses 
         WHERE address = $1 AND date = CURRENT_DATE`,
        [address],
      );

      if (existing.rows.length > 0) return;

      // Calculate activity score for the day
      const activityScore = await this.calculateDailyActivityScore(address);

      if (activityScore > 0) {
        // Award bonus based on activity
        const bonus = Math.min(activityScore * 0.1, 1.0); // Cap at 1 point

        await this.awardPoints(address, bonus, 'daily_participation', { activityScore });

        // Record daily bonus
        await this.db.query(
          `INSERT INTO forum_daily_bonuses (address, date, bonus_points)
           VALUES ($1, CURRENT_DATE, $2)`,
          [address, bonus],
        );
      }
    } catch (error) {
      logger.error('Error calculating daily bonus', {
        error: error instanceof Error ? error.message : String(error),
        address,
      });
    }
  }

  /**
   * Awards points to a user
   * @private
   * @param address - User's wallet address
   * @param points - Points to award
   * @param reason - Reason for awarding points
   * @param metadata - Optional metadata for the award
   */
  private async awardPoints(
    address: string,
    points: number,
    reason: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    // Update participation score
    await this.participationService.updateForumActivity(address, points);

    // Log the award
    await this.db.query(
      `INSERT INTO forum_point_awards (
        address, points, reason, metadata, awarded_at
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [address, points, reason, JSON.stringify(metadata ?? {})],
    );
  }

  /**
   * Gets user's current streak
   * @private
   * @param address - User's wallet address
   * @returns Number of streak days
   */
  private async getUserStreak(address: string): Promise<number> {
    const result = await this.db.query(
      `SELECT streak_days FROM forum_user_stats WHERE address = $1`,
      [address],
    );

    const streakData = result.rows[0] as { streak_days: number } | undefined;
    return streakData?.streak_days ?? 0;
  }

  /**
   * Updates user's activity streak
   * @private
   * @param address - User's wallet address
   */
  private async updateUserStreak(address: string): Promise<void> {
    // Check last activity
    const lastActivity = await this.db.query(
      `SELECT MAX(created_at) as last_activity 
       FROM forum_posts 
       WHERE author_address = $1`,
      [address],
    );

    const activityData = lastActivity.rows[0] as { last_activity: Date | null } | undefined;
    if (activityData === undefined || activityData.last_activity === null) return;

    const lastActivityDate = new Date(activityData.last_activity);
    const today = new Date();
    const daysSinceLastActivity = Math.floor(
      (today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceLastActivity === 1) {
      // Continue streak
      await this.db.query(
        `UPDATE forum_user_stats 
         SET streak_days = streak_days + 1, last_activity_date = CURRENT_DATE
         WHERE address = $1`,
        [address],
      );
    } else if (daysSinceLastActivity > 1) {
      // Reset streak
      await this.db.query(
        `UPDATE forum_user_stats 
         SET streak_days = 1, last_activity_date = CURRENT_DATE
         WHERE address = $1`,
        [address],
      );
    }
  }

  /**
   * Updates user statistics
   * @private
   * @param address - User's wallet address
   * @param action - Action to update stats for
   */
  private async updateUserStats(address: string, action: string): Promise<void> {
    // Ensure user stats record exists
    await this.db.query(
      `INSERT INTO forum_user_stats (address, created_at)
       VALUES ($1, NOW())
       ON CONFLICT (address) DO NOTHING`,
      [address],
    );

    // Update specific stat based on action
    switch (action) {
      case 'thread_created':
        await this.db.query(
          `UPDATE forum_user_stats 
           SET threads_created = threads_created + 1
           WHERE address = $1`,
          [address],
        );
        break;
      case 'post_created':
        await this.db.query(
          `UPDATE forum_user_stats 
           SET posts_made = posts_made + 1
           WHERE address = $1`,
          [address],
        );
        break;
    }
  }

  /**
   * Checks for quality-based bonuses
   * @private
   * @param postId - Post ID to check
   * @param authorAddress - Post author's address
   */
  private async checkQualityBonuses(postId: string, authorAddress: string): Promise<void> {
    // Get post quality metrics
    const metrics = await this.db.query(
      `SELECT quality_score, upvotes, downvotes
       FROM forum_posts p
       JOIN forum_content_stats s ON p.id = s.post_id
       WHERE p.id = $1`,
      [postId],
    );

    if (metrics.rows.length === 0) return;

    const metricsData = metrics.rows[0] as {
      quality_score: number;
      upvotes: number;
      downvotes: number;
    };
    const { quality_score, upvotes, downvotes } = metricsData;

    // High quality bonus (score > 80, ratio > 0.9)
    if (quality_score > 80 && upvotes > 10) {
      const ratio = upvotes / (upvotes + downvotes);
      if (ratio > 0.9) {
        await this.awardPoints(
          authorAddress,
          this.pointAllocation.posting.helpfulPost *
            this.pointAllocation.bonuses.highQualityMultiplier,
          'high_quality_post',
          { postId, qualityScore: quality_score, ratio },
        );
      }
    }

    // Check if helping new users
    await this.checkNewUserHelpBonus(postId, authorAddress);
  }

  /**
   * Checks if post helps new users for bonus
   * @private
   * @param postId - Post ID to check
   * @param helperAddress - Helper's address
   */
  private async checkNewUserHelpBonus(postId: string, helperAddress: string): Promise<void> {
    // Check if the thread was created by a new user
    const threadInfo = await this.db.query(
      `SELECT t.author_address, 
        (SELECT COUNT(*) FROM forum_posts WHERE author_address = t.author_address) as user_post_count
       FROM forum_posts p
       JOIN forum_threads t ON p.thread_id = t.id
       WHERE p.id = $1`,
      [postId],
    );

    if (threadInfo.rows.length > 0) {
      const threadData = threadInfo.rows[0] as { author_address: string; user_post_count: number };
      const { author_address: threadAuthor, user_post_count } = threadData;

      // If thread author is new (less than 5 posts) and different from helper
      if (user_post_count < 5 && threadAuthor !== helperAddress) {
        await this.awardPoints(
          helperAddress,
          this.pointAllocation.posting.helpfulPost * this.pointAllocation.bonuses.newUserHelp,
          'new_user_help',
          { postId, helpedUser: threadAuthor },
        );
      }
    }
  }

  /**
   * Calculates daily activity score
   * @private
   * @param address - User's wallet address
   * @returns Daily activity score
   */
  private async calculateDailyActivityScore(address: string): Promise<number> {
    const activity = await this.db.query(
      `SELECT 
        COUNT(DISTINCT thread_id) as threads_participated,
        COUNT(*) as posts_made,
        SUM(CASE WHEN upvotes > downvotes THEN 1 ELSE 0 END) as quality_posts
       FROM forum_posts
       WHERE author_address = $1
       AND created_at >= CURRENT_DATE`,
      [address],
    );

    if (activity.rows.length === 0) return 0;

    const activityData = activity.rows[0] as {
      threads_participated: number;
      posts_made: number;
      quality_posts: number;
    };
    const { threads_participated, posts_made, quality_posts } = activityData;

    // Simple scoring: 1 point per thread, 0.5 per post, 1 per quality post
    return threads_participated * 1 + posts_made * 0.5 + quality_posts * 1;
  }

  /**
   * Maps database row to UserContributionStats
   * @private
   * @param row - Database row
   * @returns User contribution statistics
   */
  private mapUserStats(row: Record<string, unknown>): UserContributionStats {
    return {
      threadsCreated: (row.threads_created as number) ?? 0,
      postsMade: (row.posts_made as number) ?? 0,
      upvotesReceived: (row.upvotes_received as number) ?? 0,
      downvotesReceived: (row.downvotes_received as number) ?? 0,
      acceptedAnswers: (row.accepted_answers as number) ?? 0,
      streakDays: (row.streak_days as number) ?? 0,
      avgQualityScore: (row.avg_quality_score as number) ?? 0,
      languagesSupported: (row.languages_supported as string[]) ?? [],
    };
  }

  /**
   * Creates necessary database tables for incentives
   * @private
   */
  private async createIncentiveTables(): Promise<void> {
    // User statistics table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS forum_user_stats (
        address VARCHAR(42) PRIMARY KEY,
        threads_created INTEGER DEFAULT 0,
        posts_made INTEGER DEFAULT 0,
        upvotes_received INTEGER DEFAULT 0,
        downvotes_received INTEGER DEFAULT 0,
        accepted_answers INTEGER DEFAULT 0,
        streak_days INTEGER DEFAULT 0,
        last_activity_date DATE,
        avg_quality_score DECIMAL(5,2) DEFAULT 0,
        languages_supported TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Point awards log
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS forum_point_awards (
        id SERIAL PRIMARY KEY,
        address VARCHAR(42) NOT NULL,
        points DECIMAL(10,2) NOT NULL,
        reason VARCHAR(50) NOT NULL,
        metadata JSONB,
        awarded_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes separately (PostgreSQL syntax)
    await this.db.query(
      'CREATE INDEX IF NOT EXISTS idx_awards_address ON forum_point_awards(address)',
    );
    await this.db.query(
      'CREATE INDEX IF NOT EXISTS idx_awards_reason ON forum_point_awards(reason)',
    );
    await this.db.query(
      'CREATE INDEX IF NOT EXISTS idx_awards_time ON forum_point_awards(awarded_at)',
    );

    // Post tracking for quality evaluation
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS forum_post_tracking (
        post_id VARCHAR(100) PRIMARY KEY,
        author_address VARCHAR(42) NOT NULL,
        quality_evaluated BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Daily bonuses table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS forum_daily_bonuses (
        address VARCHAR(42),
        date DATE,
        bonus_points DECIMAL(10,2),
        PRIMARY KEY (address, date)
      )
    `);
  }

  /**
   * Recalculates participation scores for a user
   *
   * @param address - User's address
   * @returns Updated participation score
   */
  async recalculateUserScore(address: string): Promise<number> {
    try {
      // Get all point awards for the user
      const awards = await this.db.query(
        `SELECT SUM(points) as total_points
         FROM forum_point_awards
         WHERE address = $1`,
        [address],
      );

      const awardData = awards.rows[0] as { total_points: number } | undefined;
      const totalPoints = awardData?.total_points ?? 0;

      // Update participation score
      await this.participationService.updateForumActivity(address, totalPoints);

      return totalPoints;
    } catch (error) {
      logger.error('Error recalculating user score', {
        error: error instanceof Error ? error.message : String(error),
        address,
      });
      return 0;
    }
  }
}
