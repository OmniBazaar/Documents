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
// TODO: Access BlockProductionService via Validator API
// TODO: Access these via Validator API
// import { BlockProductionService } from '../../../../Validator/src/services/BlockProductionService';
// import { MasterMerkleEngine } from '../../../../Validator/src/engines/MasterMerkleEngine';
// import { P2PNetwork, MessageType } from '../../../../Validator/src/p2p/P2PNetwork';
import { EventEmitter } from 'events';

// Temporary MessageType enum until we access via API
enum MessageType {
  MODERATION_REQUEST = 'moderation_request',
  MODERATION_VOTE = 'moderation_vote',
}

// Temporary interfaces until we can import from Validator
interface BlockProductionService {
  getActiveValidators(): Promise<Array<{
    address: string;
    isActive: boolean;
    participationScore: number;
  }>>;
}

interface P2PNetwork {
  on(event: string, handler: (data: unknown) => void): void;
  broadcast(type: MessageType, data: unknown): void;
  getNodeId(): string;
}

interface MasterMerkleEngineInterface {
  getNodeId(): string;
}

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
 * Moderation vote data structure for P2P messaging
 */
interface ModerationVote {
  moderationId: string;
  validatorAddress: string;
  vote: boolean;
  signature: string;
  timestamp: number;
}

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
export class ForumConsensus extends EventEmitter {
  private spamThresholds: SpamThresholds;
  private blockProductionService?: BlockProductionService; // Will be accessed via API
  private masterMerkleEngine?: MasterMerkleEngineInterface; // MasterMerkleEngine - will be accessed via API
  private p2pNetwork?: P2PNetwork; // Will be accessed via API
  private pendingVotes: Map<string, Map<string, ModerationVote>> = new Map();
  private voteTimeouts: Map<string, NodeJS.Timeout> = new Map();

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
    super();
    this.spamThresholds = { ...DEFAULT_SPAM_THRESHOLDS, ...thresholds };
  }

  /**
   * Initializes the consensus service
   */
  async initialize(): Promise<void> {
    // Create necessary tables for consensus tracking
    await this.createConsensusTables();
    
    // Initialize validator services if available
    try {
      // Try to get MasterMerkleEngine instance
      // TODO: Access MasterMerkleEngine via API
      // this.masterMerkleEngine = MasterMerkleEngine.getInstance();
      if (this.masterMerkleEngine !== undefined && 'getServices' in this.masterMerkleEngine && typeof (this.masterMerkleEngine as Record<string, unknown>).getServices === 'function') {
        const services = ((this.masterMerkleEngine as unknown as { getServices: () => { blockProduction: BlockProductionService } }).getServices());
        this.blockProductionService = services.blockProduction;
        
        // Try to get P2P network instance for voting
        try {
          // TODO: Access P2PNetwork via API
          // this.p2pNetwork = P2PNetwork.getInstance();
          if (this.p2pNetwork !== undefined) {
            this.setupP2PVoting();
          }
        } catch (error) {
          logger.warn('P2P network not available for voting', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } catch (error) {
      // Validator services not available - will fall back to default validators
      logger.warn('Validator services not available for ForumConsensus', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
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
    const contentPatterns = this.analyzeContentPatterns(post.content ?? '');
    if (contentPatterns.suspicious === true) {
      spamScore += contentPatterns.score;
      reasons.push(...contentPatterns.reasons);
    }

    // Check external links
    const linkAnalysis = this.analyzeLinks(post.content ?? '');
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
    const validators = await this.getEligibleValidators(request);
    
    // Broadcast the moderation request to validators
    await this.broadcastModerationRequest(moderationId, request, validators);

    // Collect votes from validators
    const votes = await this.collectValidatorVotes(moderationId, validators);

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
    if (content === null || content === undefined || content === '') {
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
    if (content === null || content === undefined || content === '') {
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
    if (str1 === null || str1 === undefined || str1 === '' || str2 === null || str2 === undefined || str2 === '') {
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
   * @param _request - Moderation request
   * @returns Array of validator addresses
   */
  private async getEligibleValidators(_request: ModerationRequest): Promise<string[]> {
    // Try to get real validators from BlockProductionService
    if (this.blockProductionService !== undefined) {
      try {
        const activeValidators = await this.blockProductionService.getActiveValidators();
        
        // Filter validators with high participation scores (> 70)
        const eligibleValidators = activeValidators
          .filter(v => v.isActive && v.participationScore > 70)
          .map(v => v.address);
        
        if (eligibleValidators.length >= 3) {
          return eligibleValidators;
        }
      } catch (error) {
        logger.warn('Failed to get validators from BlockProductionService', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Fallback to default validators if service not available or insufficient validators
    return [
      '0x1234567890123456789012345678901234567890',
      '0x2345678901234567890123456789012345678901',
      '0x3456789012345678901234567890123456789012',
    ];
  }

  /**
   * Sets up P2P voting listeners
   * @private
   */
  private setupP2PVoting(): void {
    if (this.p2pNetwork === undefined) return;
    
    // Listen for moderation votes from other validators
    this.p2pNetwork.on('moderation-vote', (data: unknown) => {
      try {
        const vote = data as ModerationVote;
        this.handleIncomingVote(vote);
      } catch (error) {
        logger.error('Error handling moderation vote', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    
    // Listen for moderation requests (if we're a validator)
    this.p2pNetwork.on('moderation-request', (data: unknown) => { void (async () => {
      try {
        const request = data as {
          moderationId: string;
          request: ModerationRequest;
          requestedValidators: string[];
          timestamp: number;
        };
        
        // Check if we're one of the requested validators
        const myAddress = await this.getMyValidatorAddress();
        if (myAddress !== null && myAddress !== undefined && myAddress !== '' && request.requestedValidators.includes(myAddress)) {
          // Process the request and vote
          await this.processAndVote(request.moderationId, request.request);
        }
      } catch (error) {
        logger.error('Error handling moderation request', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })(); });
  }
  
  /**
   * Handles incoming moderation vote from P2P network
   * @private
   * @param vote - The moderation vote
   */
  private handleIncomingVote(vote: ModerationVote): void {
    const { moderationId, validatorAddress } = vote;
    
    // Get or create vote collection for this moderation request
    if (!this.pendingVotes.has(moderationId)) {
      this.pendingVotes.set(moderationId, new Map());
    }
    
    const votes = this.pendingVotes.get(moderationId);
    if (votes !== undefined) {
      votes.set(validatorAddress, vote);
    }
    
    // Emit event for vote received
    this.emit('voteReceived', moderationId, validatorAddress, vote.vote);
  }
  
  /**
   * Broadcasts a moderation request to validators
   * @private
   * @param moderationId - ID of the moderation request
   * @param request - The moderation request details
   * @param validators - List of validator addresses to request votes from
   * @returns Promise that resolves when broadcast is complete
   */
  private broadcastModerationRequest(
    moderationId: string,
    request: ModerationRequest,
    validators: string[],
  ): Promise<void> {
    if (this.p2pNetwork === undefined) {
      logger.warn('P2P network not available for broadcasting');
      return Promise.resolve();
    }
    
    const requestData = {
      moderationId,
      request,
      requestedValidators: validators,
      timestamp: Date.now(),
    };
    
    // Broadcast to all peers
    this.p2pNetwork.broadcast(MessageType.MODERATION_REQUEST, {
      payload: requestData,
      from: this.masterMerkleEngine?.getNodeId() ?? 'forum-consensus',
      timestamp: Date.now(),
      id: `mod-req-${moderationId}`
    });

    return Promise.resolve();
  }
  
  /**
   * Collects votes from validators
   * @private
   * @param moderationId - ID of the moderation request
   * @param validators - List of validator addresses
   * @returns Vote results mapped by validator address
   */
  private async collectValidatorVotes(
    moderationId: string,
    validators: string[],
  ): Promise<Record<string, boolean>> {
    // If P2P network is available, wait for real votes
    if (this.p2pNetwork !== undefined) {
      // Initialize vote collection
      this.pendingVotes.set(moderationId, new Map());
      
      // Wait for votes with timeout (30 seconds)
      const VOTE_TIMEOUT = 30000;
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          // Collect whatever votes we have
          const collectedVotes = this.pendingVotes.get(moderationId) ?? new Map();
          const result: Record<string, boolean> = {};
          
          // Add collected votes
          for (const [address, vote] of collectedVotes) {
            if (validators.includes(address as string)) {
              result[address as string] = (vote as ModerationVote).vote;
            }
          }
          
          // For validators that didn't respond, add abstentions
          for (const validator of validators) {
            if (!(validator in result)) {
              // Abstention - neither approve nor reject
              result[validator] = Math.random() > 0.5; // Temporary until we handle abstentions properly
            }
          }
          
          // Cleanup
          this.pendingVotes.delete(moderationId);
          this.voteTimeouts.delete(moderationId);
          
          resolve(result);
        }, VOTE_TIMEOUT);
        
        this.voteTimeouts.set(moderationId, timeout);
        
        // Check if we already have all votes
        const checkComplete = (): void => {
          const votes = this.pendingVotes.get(moderationId);
          if (votes !== undefined && votes.size >= validators.length) {
            clearTimeout(timeout);
            this.voteTimeouts.delete(moderationId);
            
            const result: Record<string, boolean> = {};
            for (const [address, vote] of votes) {
              if (validators.includes(address)) {
                result[address] = vote.vote;
              }
            }
            
            this.pendingVotes.delete(moderationId);
            resolve(result);
          }
        };
        
        // Listen for vote completion
        this.on('voteReceived', (voteModId: string) => {
          if (voteModId === moderationId) {
            checkComplete();
          }
        });
        
        // Initial check in case votes already arrived
        checkComplete();
      });
    }
    
    // Fallback to simulation if P2P not available
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
  
  /**
   * Gets the current validator's address
   * @private
   * @returns The validator address or null if not a validator
   */
  private async getMyValidatorAddress(): Promise<string | null> {
    // Try to get from BlockProductionService
    if (this.blockProductionService !== undefined) {
      try {
        const validators = await this.blockProductionService.getActiveValidators();
        const nodeId = this.masterMerkleEngine?.getNodeId();
        if (nodeId !== null && nodeId !== undefined && nodeId !== '') {
          const myValidator = validators.find(v => 'nodeId' in v && (v as Record<string, unknown>).nodeId === nodeId);
          if (myValidator !== undefined) {
            return myValidator.address;
          }
        }
      } catch (error) {
        logger.warn('Failed to get validator address', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return null;
  }
  
  /**
   * Processes a moderation request and votes
   * @private
   * @param moderationId - ID of the moderation request
   * @param request - The moderation request
   */
  private async processAndVote(moderationId: string, request: ModerationRequest): Promise<void> {
    try {
      // Evaluate the request based on our criteria
      const shouldApprove = this.evaluateModerationRequest(request);
      
      // Get our address
      const myAddress = await this.getMyValidatorAddress();
      if (myAddress === null || myAddress === undefined || myAddress === '') {
        logger.warn('Cannot vote - not a validator');
        return;
      }
      
      // Create and sign the vote
      const vote: ModerationVote = {
        moderationId,
        validatorAddress: myAddress,
        vote: shouldApprove,
        signature: this.signVote(moderationId, shouldApprove), // Would need proper signing
        timestamp: Date.now()
      };
      
      // Broadcast our vote
      if (this.p2pNetwork !== undefined) {
        this.p2pNetwork.broadcast(MessageType.MODERATION_VOTE, {
          payload: vote,
          from: this.masterMerkleEngine?.getNodeId() ?? myAddress,
          timestamp: Date.now(),
          id: `vote-${moderationId}-${myAddress}`
        });
      }
    } catch (error) {
      logger.error('Failed to process and vote on moderation request', {
        moderationId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Evaluates whether to approve a moderation request
   * @private
   * @param request - The moderation request
   * @returns Whether to approve the request
   */
  private evaluateModerationRequest(request: ModerationRequest): boolean {
    // Simple evaluation logic - in production this would be more sophisticated
    switch (request.action) {
      case 'delete':
        // Approve deletion if reason is valid
        return ['spam', 'offensive', 'illegal'].includes(request.reason);
      
      case 'lock':
      case 'unlock':
        // Approve lock/unlock for valid reasons
        return ['resolved', 'off_topic', 'heated'].includes(request.reason);
      
      case 'pin':
      case 'unpin':
        // Approve pin/unpin for important content
        return ['important', 'announcement'].includes(request.reason);
      
      default:
        return false;
    }
  }
  
  /**
   * Signs a vote (placeholder - needs proper crypto implementation)
   * @private
   * @param moderationId - ID of the moderation request
   * @param vote - The vote (true/false)
   * @returns Signature string
   */
  private signVote(moderationId: string, vote: boolean): string {
    // TODO: Implement proper cryptographic signing
    // This would use the validator's private key to sign the vote
    return `sig-${moderationId}-${vote}`;
  }
}
