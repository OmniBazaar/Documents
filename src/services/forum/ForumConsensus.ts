/**
 * Forum Consensus Service
 *
 * Manages vote aggregation, spam detection, and content moderation consensus
 * using a decentralized approach inspired by Retroshare and IPFS-Boards.
 *
 * @module ForumConsensus
 */

import { Database } from '../database/Database';
import { ForumVote, ForumPost, ModerationRequest, ForumAttachment } from './ForumTypes';
import { logger } from '../../utils/logger';

/**
 * Spam detection thresholds
 */
interface SpamThresholds {
  /** Maximum posts per hour from single user */
  maxPostsPerHour: number;
  /** Minimum time between posts (seconds) */
  minPostInterval: number;
  /** Maximum duplicate content ratio */
  maxDuplicateRatio: number;
  /** Minimum account age (days) */
  minAccountAge: number;
  /** Downvote ratio threshold for auto-hiding */
  downvoteRatioThreshold: number;
  /** Minimum votes before ratio is considered */
  minVotesForRatio: number;
}

/**
 * Content quality metrics
 */
interface ContentQualityMetrics {
  /** Post ID */
  postId: string;
  /** Quality score (0-100) */
  qualityScore: number;
  /** Spam probability (0-1) */
  spamProbability: number;
  /** Relevance score */
  relevanceScore: number;
  /** Engagement metrics */
  engagement: {
    /** View to vote ratio */
    viewToVoteRatio: number;
    /** Reply rate */
    replyRate: number;
    /** Average time spent reading */
    avgReadTime: number;
  };
}

/**
 * Consensus result for moderation actions
 */
interface ConsensusResult {
  /** Whether consensus was reached */
  consensusReached: boolean;
  /** Percentage of validators in agreement */
  agreementPercentage: number;
  /** Final decision */
  decision: 'approve' | 'reject' | 'pending';
  /** Participating validators */
  validators: string[];
  /** Individual votes */
  votes: Record<string, boolean>;
  /** Timestamp of decision */
  timestamp: number;
}

/**
 * Default spam detection thresholds
 */
const DEFAULT_SPAM_THRESHOLDS: SpamThresholds = {
  maxPostsPerHour: 10,
  minPostInterval: 30,
  maxDuplicateRatio: 0.8,
  minAccountAge: 1,
  downvoteRatioThreshold: 0.7,
  minVotesForRatio: 5,
};

/**
 * Forum Consensus Service
 *
 * @example
 * ```typescript
 * const consensus = new ForumConsensus(db);
 * await consensus.initialize();
 *
 * // Process a vote
 * await consensus.processVote(vote);
 *
 * // Check for spam
 * const isSpam = await consensus.detectSpam(post);
 * ```
 */
export class ForumConsensus {
  private spamThresholds: SpamThresholds;

  /**
   * Creates a new Forum Consensus instance
   *
   * @param db - Database instance
   * @param thresholds - Optional spam detection thresholds
   */
  constructor(
    private db: Database,
    thresholds: Partial<SpamThresholds> = {},
  ) {
    this.spamThresholds = { ...DEFAULT_SPAM_THRESHOLDS, ...thresholds };
  }

  /**
   * Initializes the consensus service
   */
  async initialize(): Promise<void> {
    // Create necessary tables for consensus tracking
    await this.createConsensusTables();
    // Forum Consensus Service initialized successfully
  }

  /**
   * Processes a vote and updates content quality metrics
   *
   * @param vote - The vote to process
   * @throws {Error} If vote processing fails
   */
  async processVote(vote: ForumVote): Promise<void> {
    try {
      // Update vote aggregation
      await this.updateVoteAggregation(vote);

      // Calculate new quality metrics
      const metrics = await this.calculateQualityMetrics(vote.postId);

      // Check if post should be auto-hidden
      await this.checkAutoModeration(vote.postId, metrics);

      // Update post visibility based on votes
      await this.updatePostVisibility(vote.postId, metrics);
    } catch (error) {
      // Log error for monitoring
      logger.error('Error processing vote', {
        vote,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Vote processing failed: ${String(error)}`);
    }
  }

  /**
   * Detects spam in a post
   *
   * @param post - Post to check
   * @returns Spam detection result with confidence score
   */
  async detectSpam(post: ForumPost): Promise<{
    isSpam: boolean;
    confidence: number;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let spamScore = 0;

    // Check posting frequency
    const frequency = await this.checkPostingFrequency(post.authorAddress);
    if (frequency.exceedsLimit) {
      spamScore += 0.3;
      reasons.push(`Posting too frequently: ${frequency.postsInLastHour} posts/hour`);
    }

    // Check for duplicate content
    const duplicateRatio = await this.checkDuplicateContent(post);
    if (duplicateRatio > this.spamThresholds.maxDuplicateRatio) {
      spamScore += 0.4;
      reasons.push(`High duplicate content ratio: ${(duplicateRatio * 100).toFixed(1)}%`);
    }

    // Check account age
    const accountAge = await this.getAccountAge(post.authorAddress);
    if (accountAge < this.spamThresholds.minAccountAge) {
      spamScore += 0.2;
      reasons.push(`New account: ${accountAge} days old`);
    }

    // Check content patterns
    const contentPatterns = this.analyzeContentPatterns(post.content || '');
    if (contentPatterns.suspicious === true) {
      spamScore += contentPatterns.score;
      reasons.push(...contentPatterns.reasons);
    }

    // Check external links
    const linkAnalysis = this.analyzeLinks(post.content || '');
    if (linkAnalysis.suspicious === true) {
      spamScore += 0.3;
      reasons.push(`Suspicious links detected: ${linkAnalysis.count} links`);
    }

    return {
      isSpam: spamScore >= 0.6,
      confidence: Math.min(spamScore, 1.0),
      reasons,
    };
  }

  /**
   * Processes a moderation request through consensus
   *
   * @param request - Moderation request
   * @returns Consensus result
   */
  async processModerationRequest(request: ModerationRequest): Promise<ConsensusResult> {
    // Record the moderation request
    const moderationId = await this.recordModerationRequest(request);

    // Get eligible validators for voting
    const validators = this.getEligibleValidators(request);

    // Collect votes from validators (in real implementation, this would be async)
    const votes = this.collectValidatorVotes(moderationId, validators);

    // Calculate consensus
    const result = this.calculateConsensus(votes);

    // Execute action if consensus reached
    if (result.consensusReached && result.decision === 'approve') {
      await this.executeModerationAction(request);
    }

    // Record consensus result
    await this.recordConsensusResult(moderationId, result);

    return result;
  }

  /**
   * Calculates quality metrics for a post
   *
   * @param postId - Post ID to analyze
   * @returns Quality metrics
   */
  async calculateQualityMetrics(postId: string): Promise<ContentQualityMetrics> {
    // Get post data with vote counts
    const postData = await this.db.query(
      `SELECT p.*, t.view_count,
        (SELECT COUNT(*) FROM forum_posts WHERE parent_id = p.id) as reply_count
       FROM forum_posts p
       JOIN forum_threads t ON p.thread_id = t.id
       WHERE p.id = $1`,
      [postId],
    );

    if (postData.rows.length === 0) {
      throw new Error('Post not found');
    }

    const post = postData.rows[0] as {
      id: string;
      thread_id: string;
      author_address: string;
      content: string;
      created_at: Date;
      edited_at: Date | null;
      upvotes: number;
      downvotes: number;
      is_accepted_answer: boolean;
      is_deleted: boolean;
      attachments: ForumAttachment[] | null;
      metadata: Record<string, unknown> | null;
      view_count: number;
      reply_count: number;
    };
    const totalVotes = post.upvotes + post.downvotes;

    // Calculate quality score based on multiple factors
    let qualityScore = 50; // Start at neutral

    // Vote ratio factor (weighted by total votes)
    if (totalVotes > 0) {
      const voteRatio = post.upvotes / totalVotes;
      const voteWeight = Math.min(totalVotes / 10, 1); // Cap influence at 10 votes
      qualityScore += (voteRatio - 0.5) * 40 * voteWeight;
    }

    // Engagement factor
    const viewToVoteRatio = totalVotes / Math.max(post.view_count, 1);
    const replyRate = post.reply_count / Math.max(post.view_count, 1);

    qualityScore += viewToVoteRatio * 10; // Reward high engagement
    qualityScore += replyRate * 100; // Reward discussion generation

    // Content length factor (longer, thoughtful posts score higher)
    const contentLength = post.content?.length ?? 0;
    if (contentLength > 500) qualityScore += 5;
    if (contentLength > 1000) qualityScore += 5;

    // Ensure score is between 0-100
    qualityScore = Math.max(0, Math.min(100, qualityScore));

    // Convert to ForumPost type for spam detection
    const forumPost: ForumPost = {
      id: post.id,
      threadId: post.thread_id,
      authorAddress: post.author_address,
      content: post.content,
      createdAt: new Date(post.created_at).getTime(),
      editedAt:
        post.edited_at !== null && post.edited_at !== undefined
          ? new Date(post.edited_at).getTime()
          : null,
      upvotes: post.upvotes,
      downvotes: post.downvotes,
      isAcceptedAnswer: post.is_accepted_answer,
      isDeleted: post.is_deleted,
      attachments: post.attachments !== null ? post.attachments : [],
      metadata: post.metadata !== null ? post.metadata : {},
    };

    // Calculate spam probability based on various factors
    const spamResult = await this.detectSpam(forumPost);

    return {
      postId,
      qualityScore,
      spamProbability: spamResult.confidence,
      relevanceScore: this.calculateRelevanceScore({
        created_at: post.created_at,
        reply_count: post.reply_count,
      }),
      engagement: {
        viewToVoteRatio,
        replyRate,
        avgReadTime: this.estimateReadTime(post.content),
      },
    };
  }

  /**
   * Updates vote aggregation statistics
   * @param vote - The vote to aggregate into statistics
   * @private
   */
  private async updateVoteAggregation(vote: ForumVote): Promise<void> {
    // Record individual vote
    await this.db.query(
      `INSERT INTO forum_vote_aggregation (post_id, voter_address, vote_type, timestamp)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (post_id, voter_address) 
       DO UPDATE SET vote_type = $3, timestamp = $4`,
      [vote.postId, vote.voterAddress, vote.voteType, new Date(vote.timestamp)],
    );

    // Update aggregated stats
    await this.db.query(
      `INSERT INTO forum_content_stats (post_id, total_votes, upvote_ratio, last_vote_at)
       VALUES ($1, 1, $2, $3)
       ON CONFLICT (post_id)
       DO UPDATE SET 
         total_votes = forum_content_stats.total_votes + 1,
         upvote_ratio = (
           SELECT COUNT(*) FILTER (WHERE vote_type = 'upvote') * 1.0 / COUNT(*)
           FROM forum_vote_aggregation
           WHERE post_id = $1
         ),
         last_vote_at = $3`,
      [vote.postId, vote.voteType === 'upvote' ? 1 : 0, new Date(vote.timestamp)],
    );
  }

  /**
   * Checks if post should be auto-moderated based on votes
   * @param postId - The post ID to check for auto-moderation
   * @param metrics - The quality metrics for the post
   * @private
   */
  private async checkAutoModeration(postId: string, metrics: ContentQualityMetrics): Promise<void> {
    const post = await this.db.query('SELECT * FROM forum_posts WHERE id = $1', [postId]);

    if (post.rows.length === 0) return;

    const postRecord = post.rows[0] as { upvotes: number; downvotes: number };
    const totalVotes = postRecord.upvotes + postRecord.downvotes;

    // Auto-hide if heavily downvoted
    if (totalVotes >= this.spamThresholds.minVotesForRatio) {
      const downvoteRatio = postRecord.downvotes / totalVotes;

      if (downvoteRatio > this.spamThresholds.downvoteRatioThreshold) {
        await this.db.query(
          'UPDATE forum_posts SET is_hidden = true, hide_reason = $1 WHERE id = $2',
          ['auto_hidden_low_quality', postId],
        );

        // Log moderation action
        await this.logModerationAction({
          action: 'auto_hide',
          targetId: postId,
          targetType: 'post',
          reason: `Downvote ratio ${(downvoteRatio * 100).toFixed(1)}% exceeds threshold`,
          automated: true,
        });
      }
    }

    // Auto-flag for review if spam probability is high
    if (metrics.spamProbability > 0.8) {
      await this.db.query(
        `INSERT INTO forum_review_queue (post_id, reason, priority, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT DO NOTHING`,
        [postId, 'high_spam_probability', 'high'],
      );
    }
  }

  /**
   * Updates post visibility based on quality metrics
   * @param postId - The post ID to update visibility for
   * @param metrics - The quality metrics to use for visibility calculation
   * @private
   */
  private async updatePostVisibility(
    postId: string,
    metrics: ContentQualityMetrics,
  ): Promise<void> {
    // Calculate visibility score
    let visibilityScore = metrics.qualityScore;

    // Reduce visibility for potential spam
    visibilityScore *= 1 - metrics.spamProbability;

    // Update post visibility score for ranking
    await this.db.query(
      `UPDATE forum_posts 
       SET visibility_score = $1, quality_score = $2
       WHERE id = $3`,
      [visibilityScore, metrics.qualityScore, postId],
    );
  }

  /**
   * Checks posting frequency for spam detection
   * @param authorAddress - The author's blockchain address to check
   * @private
   * @returns Posting frequency data and limit check result
   */
  private async checkPostingFrequency(authorAddress: string): Promise<{
    postsInLastHour: number;
    exceedsLimit: boolean;
  }> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count 
       FROM forum_posts 
       WHERE author_address = $1 
       AND created_at > NOW() - INTERVAL '1 hour'`,
      [authorAddress],
    );

    const row = result.rows[0] as { count: string | number } | undefined;
    const postsInLastHour = parseInt(String(row?.count ?? '0'));

    return {
      postsInLastHour,
      exceedsLimit: postsInLastHour > this.spamThresholds.maxPostsPerHour,
    };
  }

  /**
   * Checks for duplicate content
   * @param post - The forum post to check for duplicates
   * @private
   * @returns Ratio of duplicate content (0-1)
   */
  private async checkDuplicateContent(post: ForumPost): Promise<number> {
    // Simple duplicate check - in production, use more sophisticated methods
    const similar = await this.db.query(
      `SELECT content 
       FROM forum_posts 
       WHERE author_address = $1 
       AND created_at > NOW() - INTERVAL '24 hours'
       AND id != $2`,
      [post.authorAddress, post.id],
    );

    if (similar.rows.length === 0) return 0;

    // Calculate similarity ratio
    let duplicateCount = 0;
    for (const row of similar.rows) {
      const postRow = row as { content: string };
      const similarity = this.calculateStringSimilarity(post.content, String(postRow.content));
      if (similarity > 0.8) duplicateCount++;
    }

    return duplicateCount / similar.rows.length;
  }

  /**
   * Gets account age in days
   * @param address - The blockchain address to check
   * @private
   * @returns Account age in days
   */
  private async getAccountAge(address: string): Promise<number> {
    const result = await this.db.query(
      `SELECT MIN(created_at) as first_post
       FROM forum_posts
       WHERE author_address = $1`,
      [address],
    );

    const row = result.rows[0] as { first_post: string | Date | null } | undefined;
    if (row?.first_post === null || row?.first_post === undefined) return 0;

    const ageMs = Date.now() - new Date(String(row.first_post)).getTime();
    return ageMs / (1000 * 60 * 60 * 24); // Convert to days
  }

  /**
   * Analyzes content patterns for spam detection
   * @param content - The content text to analyze
   * @private
   * @returns Analysis result with spam detection metrics
   */
  private analyzeContentPatterns(content: string): {
    suspicious: boolean;
    score: number;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let score = 0;

    // Safeguard against empty or null content
    if (!content) {
      return { suspicious: false, score: 0, reasons: [] };
    }

    // Check for excessive capitalization
    const capsMatches = content.match(/[A-Z]/g);
    const capsRatio = (capsMatches?.length ?? 0) / content.length;
    if (capsRatio > 0.5) {
      score += 0.2;
      reasons.push('Excessive capitalization');
    }

    // Check for repeated characters
    if (/(.)\1{4,}/.test(content)) {
      score += 0.1;
      reasons.push('Repeated characters detected');
    }

    // Check for common spam phrases
    const spamPhrases = [
      'click here',
      'buy now',
      'limited time',
      'act now',
      'make money',
      'work from home',
      'congratulations',
    ];

    const lowerContent = content.toLowerCase();
    for (const phrase of spamPhrases) {
      if (lowerContent.includes(phrase)) {
        score += 0.1;
        reasons.push(`Spam phrase detected: "${phrase}"`);
      }
    }

    return {
      suspicious: score > 0,
      score: Math.min(score, 1.0),
      reasons,
    };
  }

  /**
   * Analyzes links in content
   * @param content - The content text to analyze for links
   * @private
   * @returns Link analysis result
   */
  private analyzeLinks(content: string): {
    suspicious: boolean;
    count: number;
  } {
    // Extract URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urlMatches = content.match(urlRegex);
    const urls = urlMatches ?? [];

    // Check against known spam domains (in production, use a proper blocklist)
    const suspiciousDomains = ['bit.ly', 'tinyurl.com', 'shorturl.at'];
    let suspicious = false;

    for (const url of urls) {
      for (const domain of suspiciousDomains) {
        if (url.includes(domain)) {
          suspicious = true;
          break;
        }
      }
    }

    // Too many links is suspicious
    if (urls.length > 3) suspicious = true;

    return {
      suspicious,
      count: urls.length,
    };
  }

  /**
   * Calculates relevance score for a post
   * @private
   * @param post - Post data with metadata
   * @param post.created_at - The creation timestamp of the post
   * @param post.reply_count - The number of replies to the post
   * @returns Relevance score (0-100)
   */
  private calculateRelevanceScore(post: { created_at: Date; reply_count: number }): number {
    // Simple relevance calculation based on thread activity
    let relevanceScore = 50;

    // Recent activity boosts relevance
    const hoursSincePost = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSincePost < 24) relevanceScore += 20;
    else if (hoursSincePost < 72) relevanceScore += 10;

    // Replies indicate relevance
    if (post.reply_count > 0) relevanceScore += Math.min(post.reply_count * 5, 20);

    // Author reputation affects relevance (would need to fetch from participation scores)
    // relevanceScore += authorReputation / 10;

    return Math.min(relevanceScore, 100);
  }

  /**
   * Estimates reading time for content
   * @param content - The content text to estimate reading time for
   * @private
   * @returns Estimated reading time in minutes
   */
  private estimateReadTime(content: string): number {
    if (!content) {
      return 0;
    }
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    return wordCount / wordsPerMinute;
  }

  /**
   * Calculates string similarity using Jaccard index
   * @param str1 - First string to compare
   * @param str2 - Second string to compare
   * @private
   * @returns Similarity score (0-1)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) {
      return 0;
    }
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));

    // Convert Sets to Arrays for ES5 compatibility
    const arr1 = Array.from(set1);
    const arr2 = Array.from(set2);

    const intersection = new Set(arr1.filter(x => set2.has(x)));
    const union = new Set(arr1.concat(arr2));

    return intersection.size / union.size;
  }

  /**
   * Records a moderation request
   * @param request - The moderation request to record
   * @private
   * @returns The generated moderation request ID
   */
  private async recordModerationRequest(request: ModerationRequest): Promise<string> {
    const moderationId = `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.query(
      `INSERT INTO forum_moderation_requests (
        id, action, target_id, target_type, moderator_address,
        reason, details, created_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'pending')`,
      [
        moderationId,
        request.action,
        request.targetId,
        request.targetType,
        request.moderatorAddress,
        request.reason,
        JSON.stringify(request.details),
      ],
    );

    return moderationId;
  }

  /**
   * Gets eligible validators for moderation voting
   * @private
   * @param _request - Moderation request (unused in mock implementation)
   * @returns Array of validator addresses
   */
  private getEligibleValidators(_request: ModerationRequest): string[] {
    // In production, this would query active validators with sufficient stake
    // For now, return mock validators
    return [
      '0x1234567890123456789012345678901234567890',
      '0x2345678901234567890123456789012345678901',
      '0x3456789012345678901234567890123456789012',
    ];
  }

  /**
   * Collects votes from validators
   * @private
   * @param _moderationId - ID of the moderation request (unused in mock implementation)
   * @param validators - List of validator addresses
   * @returns Vote results mapped by validator address
   */
  private collectValidatorVotes(
    _moderationId: string,
    validators: string[],
  ): Record<string, boolean> {
    // In production, this would be an async process with timeouts
    // For now, simulate votes
    const votes: Record<string, boolean> = {};

    for (const validator of validators) {
      // Simulate 70% approval rate
      votes[validator] = Math.random() > 0.3;
    }

    return votes;
  }

  /**
   * Calculates consensus from votes
   * @param votes - Map of validator addresses to their boolean votes
   * @private
   * @returns Consensus calculation result
   */
  private calculateConsensus(votes: Record<string, boolean>): ConsensusResult {
    const validators = Object.keys(votes);
    const approvals = Object.values(votes).filter(v => v).length;
    const agreementPercentage = approvals / validators.length;

    return {
      consensusReached: agreementPercentage >= 0.66, // 2/3 majority
      agreementPercentage,
      decision: agreementPercentage >= 0.66 ? 'approve' : 'reject',
      validators,
      votes,
      timestamp: Date.now(),
    };
  }

  /**
   * Executes approved moderation action
   * @param request - The moderation request to execute
   * @private
   */
  private async executeModerationAction(request: ModerationRequest): Promise<void> {
    switch (request.action) {
      case 'lock':
        await this.db.query('UPDATE forum_threads SET is_locked = true WHERE id = $1', [
          request.targetId,
        ]);
        break;

      case 'unlock':
        await this.db.query('UPDATE forum_threads SET is_locked = false WHERE id = $1', [
          request.targetId,
        ]);
        break;

      case 'pin':
        await this.db.query('UPDATE forum_threads SET is_pinned = true WHERE id = $1', [
          request.targetId,
        ]);
        break;

      case 'unpin':
        await this.db.query('UPDATE forum_threads SET is_pinned = false WHERE id = $1', [
          request.targetId,
        ]);
        break;

      case 'delete':
        if (request.targetType === 'post') {
          await this.db.query('UPDATE forum_posts SET is_deleted = true WHERE id = $1', [
            request.targetId,
          ]);
        } else {
          await this.db.query('UPDATE forum_threads SET is_deleted = true WHERE id = $1', [
            request.targetId,
          ]);
        }
        break;

      case 'restore':
        if (request.targetType === 'post') {
          await this.db.query('UPDATE forum_posts SET is_deleted = false WHERE id = $1', [
            request.targetId,
          ]);
        } else {
          await this.db.query('UPDATE forum_threads SET is_deleted = false WHERE id = $1', [
            request.targetId,
          ]);
        }
        break;
    }

    // Log the action
    await this.logModerationAction({
      action: request.action,
      targetId: request.targetId,
      targetType: request.targetType,
      moderatorAddress: request.moderatorAddress,
      reason: request.reason,
      automated: false,
    });
  }

  /**
   * Records consensus result
   * @param moderationId - The ID of the moderation request
   * @param result - The consensus result to record
   * @private
   */
  private async recordConsensusResult(
    moderationId: string,
    result: ConsensusResult,
  ): Promise<void> {
    await this.db.query(
      `UPDATE forum_moderation_requests
       SET status = $1, consensus_result = $2, completed_at = NOW()
       WHERE id = $3`,
      [result.decision, JSON.stringify(result), moderationId],
    );
  }

  /**
   * Logs moderation action
   * @param action - The moderation action details to log
   * @param action.action - The type of moderation action taken
   * @param action.targetId - The ID of the target (post or thread)
   * @param action.targetType - The type of target ('post' or 'thread')
   * @param action.moderatorAddress - The address of the moderator (optional)
   * @param action.reason - The reason for the moderation action
   * @param action.automated - Whether this was an automated action
   * @private
   */
  private async logModerationAction(action: {
    action: string;
    targetId: string;
    targetType: string;
    moderatorAddress?: string;
    reason: string;
    automated: boolean;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO forum_moderation_log (
        action, target_id, target_type, moderator_address,
        reason, automated, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        action.action,
        action.targetId,
        action.targetType,
        action.moderatorAddress ?? 'system',
        action.reason,
        action.automated,
      ],
    );
  }

  /**
   * Creates necessary database tables for consensus
   * @private
   */
  private async createConsensusTables(): Promise<void> {
    // Vote aggregation table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS forum_vote_aggregation (
        post_id VARCHAR(100),
        voter_address VARCHAR(42),
        vote_type VARCHAR(10),
        timestamp TIMESTAMP,
        PRIMARY KEY (post_id, voter_address)
      )
    `);

    // Content statistics table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS forum_content_stats (
        post_id VARCHAR(100) PRIMARY KEY,
        total_votes INTEGER DEFAULT 0,
        upvote_ratio DECIMAL(3,2) DEFAULT 0,
        quality_score DECIMAL(5,2) DEFAULT 50,
        spam_score DECIMAL(3,2) DEFAULT 0,
        last_vote_at TIMESTAMP,
        last_analyzed_at TIMESTAMP
      )
    `);

    // Moderation requests table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS forum_moderation_requests (
        id VARCHAR(100) PRIMARY KEY,
        action VARCHAR(20) NOT NULL,
        target_id VARCHAR(100) NOT NULL,
        target_type VARCHAR(10) NOT NULL,
        moderator_address VARCHAR(42) NOT NULL,
        reason TEXT,
        details JSONB,
        status VARCHAR(20) DEFAULT 'pending',
        consensus_result JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);

    // Moderation log table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS forum_moderation_log (
        id SERIAL PRIMARY KEY,
        action VARCHAR(20) NOT NULL,
        target_id VARCHAR(100) NOT NULL,
        target_type VARCHAR(10) NOT NULL,
        moderator_address VARCHAR(42),
        reason TEXT,
        automated BOOLEAN DEFAULT false,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    // Review queue for flagged content
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS forum_review_queue (
        post_id VARCHAR(100) PRIMARY KEY,
        reason VARCHAR(50),
        priority VARCHAR(10) DEFAULT 'medium',
        reviewer_address VARCHAR(42),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP
      )
    `);
  }
}
