/**
 * P2P Forum Service for OmniBazaar
 *
 * Implements a decentralized forum system inspired by Retroshare's offline-first
 * design and IPFS-Boards' decentralized moderation. All data is stored in
 * YugabyteDB for automatic replication across validators.
 *
 * @module P2PForumService
 */

import { Database } from '../database/Database';
import { ParticipationScoreService } from '../participation/ParticipationScoreService';
import { ForumConsensus } from './ForumConsensus';
import { ForumIncentives } from './ForumIncentives';
import {
  ForumThread,
  ForumPost,
  ForumCategory,
  ForumVote,
  ForumStats,
  ForumAttachment,
  CreateThreadRequest,
  CreatePostRequest,
  VoteRequest,
  ForumSearchOptions,
  ForumSearchResult,
} from './ForumTypes';

/**
 * Database query result row type
 */
interface QueryResult {
  id: string;
  title?: string;
  thread_id?: string;
  thread_title?: string;
  parent_id?: string | null;
  category?: string;
  author_address: string;
  content?: string;
  created_at: string | Date;
  updated_at?: string | Date;
  edited_at?: string | Date | null;
  view_count?: string | number;
  reply_count?: string | number;
  last_reply_at?: string | Date;
  is_pinned?: boolean;
  is_locked?: boolean;
  is_accepted_answer?: boolean;
  is_deleted?: boolean;
  upvotes?: string | number;
  downvotes?: string | number;
  tags?: string[] | string;
  attachments?: unknown[] | string;
  metadata?: Record<string, unknown> | string;
}

/**
 * Configuration options for the P2P Forum Service
 */
export interface P2PForumConfig {
  /** Maximum title length for threads */
  maxTitleLength: number;
  /** Maximum content length for posts */
  maxContentLength: number;
  /** Minimum reputation required to create threads */
  minReputationToPost: number;
  /** Minimum reputation required to moderate */
  minReputationToModerate: number;
  /** Time window for editing posts (milliseconds) */
  editWindowMs: number;
  /** Maximum attachments per post */
  maxAttachments: number;
  /** Maximum attachment size in bytes */
  maxAttachmentSize: number;
  /** Categories available in the forum */
  categories: ForumCategory[];
}

/**
 * Default configuration for the forum service
 */
const DEFAULT_CONFIG: P2PForumConfig = {
  maxTitleLength: 200,
  maxContentLength: 10000,
  minReputationToPost: 0,
  minReputationToModerate: 50,
  editWindowMs: 3600000, // 1 hour
  maxAttachments: 5,
  maxAttachmentSize: 10 * 1024 * 1024, // 10MB
  categories: [
    { id: 'wallet', name: 'OmniWallet Support', description: 'Help with wallet features' },
    { id: 'marketplace', name: 'Marketplace Help', description: 'Buying and selling assistance' },
    { id: 'dex', name: 'DEX Trading', description: 'Decentralized exchange support' },
    { id: 'technical', name: 'Technical Support', description: 'Technical issues and bugs' },
    { id: 'feature', name: 'Feature Requests', description: 'Suggest new features' },
    { id: 'governance', name: 'Community Governance', description: 'Proposals and voting' },
  ],
};

/**
 * P2P Forum Service implementation
 *
 * @example
 * ```typescript
 * const forumService = new P2PForumService(db, participationService);
 * await forumService.initialize();
 *
 * // Create a new thread
 * const thread = await forumService.createThread({
 *   title: "How to stake XOM?",
 *   content: "I'm new to staking...",
 *   category: "technical",
 *   authorAddress: "0x123..."
 * });
 * ```
 */
export class P2PForumService {
  private consensus: ForumConsensus;
  private incentives: ForumIncentives;

  /**
   * Creates a new P2P Forum Service instance
   *
   * @param db - Database instance for storage
   * @param participationService - Service for managing participation scores
   * @param config - Forum configuration options
   */
  constructor(
    private db: Database,
    private participationService: ParticipationScoreService,
    private config: P2PForumConfig = DEFAULT_CONFIG,
  ) {
    this.consensus = new ForumConsensus(db);
    this.incentives = new ForumIncentives(participationService, db);
  }

  /**
   * Initializes the forum service and creates necessary database tables
   *
   * @throws {Error} If database initialization fails
   */
  async initialize(): Promise<void> {
    try {
      await this.consensus.initialize();
      await this.incentives.initialize();
      // Forum service initialized successfully
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Forum initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Creates a new forum thread
   *
   * @param request - Thread creation request
   * @returns The created thread with generated ID
   * @throws {Error} If validation fails or user lacks permissions
   *
   * @example
   * ```typescript
   * const thread = await forumService.createThread({
   *   title: "Best practices for secure trading",
   *   content: "What are the recommended security practices?",
   *   category: "dex",
   *   authorAddress: "0x456..."
   * });
   * ```
   */
  async createThread(request: CreateThreadRequest): Promise<ForumThread> {
    // Validate request
    this.validateThreadRequest(request);

    // Check user reputation
    const userData = await this.participationService.getUserData(request.authorAddress);
    if (userData.totalScore < this.config.minReputationToPost) {
      throw new Error(
        `Insufficient reputation to create threads. Required: ${this.config.minReputationToPost}, Current: ${userData.totalScore}`,
      );
    }

    // Create thread in database
    const threadId = this.generateThreadId();
    const timestamp = Date.now();

    const thread: ForumThread = {
      id: threadId,
      title: request.title,
      category: request.category,
      authorAddress: request.authorAddress,
      createdAt: timestamp,
      updatedAt: timestamp,
      viewCount: 0,
      replyCount: 0,
      lastReplyAt: timestamp,
      isPinned: false,
      isLocked: false,
      tags: request.tags ?? [],
      metadata: request.metadata ?? {},
    };

    // Store thread
    await this.db.query(
      `INSERT INTO forum_threads (
        id, title, category, author_address, created_at, updated_at,
        view_count, reply_count, last_reply_at, is_pinned, is_locked,
        tags, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        thread.id,
        thread.title,
        thread.category,
        thread.authorAddress,
        new Date(thread.createdAt),
        new Date(thread.updatedAt),
        thread.viewCount,
        thread.replyCount,
        new Date(thread.lastReplyAt),
        thread.isPinned,
        thread.isLocked,
        JSON.stringify(thread.tags),
        JSON.stringify(thread.metadata),
      ],
    );

    // Create initial post
    if (request.content !== undefined && request.content !== null && request.content !== '') {
      const postRequest: CreatePostRequest = {
        threadId: thread.id,
        content: request.content,
        authorAddress: request.authorAddress,
      };
      if (request.attachments !== undefined) {
        postRequest.attachments = request.attachments;
      }
      await this.createPost(postRequest);
    }

    // Award PoP points for thread creation
    await this.incentives.rewardThreadCreation(request.authorAddress, thread.category);

    return thread;
  }

  /**
   * Creates a new post in a thread
   *
   * @param request - Post creation request
   * @returns The created post
   * @throws {Error} If thread is locked or user lacks permissions
   */
  async createPost(request: CreatePostRequest): Promise<ForumPost> {
    // Validate request
    this.validatePostRequest(request);

    // Check if thread exists and is not locked
    const thread = await this.getThread(request.threadId);
    if (thread === null) {
      throw new Error('Thread not found');
    }
    if (thread.isLocked) {
      throw new Error('Cannot post to locked thread');
    }

    // Check user reputation
    const userData = await this.participationService.getUserData(request.authorAddress);
    if (userData.totalScore < this.config.minReputationToPost) {
      throw new Error(
        `Insufficient reputation to post. Required: ${this.config.minReputationToPost}`,
      );
    }

    // Create post
    const postId = this.generatePostId();
    const timestamp = Date.now();

    const post: ForumPost = {
      id: postId,
      threadId: request.threadId,
      authorAddress: request.authorAddress,
      content: request.content,
      createdAt: timestamp,
      editedAt: null,
      upvotes: 0,
      downvotes: 0,
      isAcceptedAnswer: false,
      isDeleted: false,
      attachments: request.attachments ?? [],
      metadata: request.metadata ?? {},
    };

    if (request.parentId !== undefined) {
      post.parentId = request.parentId;
    }

    // Store post
    await this.db.query(
      `INSERT INTO forum_posts (
        id, thread_id, parent_id, author_address, content,
        created_at, edited_at, upvotes, downvotes,
        is_accepted_answer, is_deleted, attachments, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        post.id,
        post.threadId,
        post.parentId,
        post.authorAddress,
        post.content,
        new Date(post.createdAt),
        post.editedAt,
        post.upvotes,
        post.downvotes,
        post.isAcceptedAnswer,
        post.isDeleted,
        JSON.stringify(post.attachments),
        JSON.stringify(post.metadata),
      ],
    );

    // Update thread stats
    await this.updateThreadStats(request.threadId);

    // Award PoP points for quality posts (will be evaluated later based on votes)
    await this.incentives.trackPostCreation(request.authorAddress, post.id);

    return post;
  }

  /**
   * Votes on a post
   *
   * @param request - Vote request
   * @throws {Error} If vote is invalid or user already voted
   */
  async voteOnPost(request: VoteRequest): Promise<void> {
    // Check if user already voted
    const existingVote = await this.db.query(
      'SELECT * FROM forum_votes WHERE post_id = $1 AND voter_address = $2',
      [request.postId, request.voterAddress],
    );

    if (existingVote.rows.length > 0) {
      throw new Error('User has already voted on this post');
    }

    // Record vote
    const vote: ForumVote = {
      id: this.generateVoteId(),
      postId: request.postId,
      voterAddress: request.voterAddress,
      voteType: request.voteType,
      timestamp: Date.now(),
    };

    await this.db.query(
      'INSERT INTO forum_votes (id, post_id, voter_address, vote_type, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [vote.id, vote.postId, vote.voterAddress, vote.voteType, new Date(vote.timestamp)],
    );

    // Update post vote counts
    const updateColumn = request.voteType === 'upvote' ? 'upvotes' : 'downvotes';
    await this.db.query(
      `UPDATE forum_posts SET ${updateColumn} = ${updateColumn} + 1 WHERE id = $1`,
      [request.postId],
    );

    // Process vote through consensus for quality evaluation
    await this.consensus.processVote(vote);

    // Award PoP points based on vote impact
    await this.incentives.processVoteRewards(request.postId, request.voteType);
  }

  /**
   * Searches forum content
   *
   * @param options - Search options
   * @returns Search results with threads and posts
   */
  async search(options: ForumSearchOptions): Promise<ForumSearchResult> {
    const results: ForumSearchResult = {
      threads: [],
      posts: [],
      totalCount: 0,
      hasMore: false,
    };

    // Build search query
    const limit = options.limit ?? 20;
    // offset is not used directly in this implementation

    // Search threads
    if (options.postsOnly !== true) {
      const threadQuery = this.buildThreadSearchQuery(options);
      const threadResults = await this.db.query(threadQuery.sql, threadQuery.params);
      results.threads = threadResults.rows.map(row => this.mapThreadRow(row as QueryResult));
    }

    // Search posts
    if (options.threadsOnly !== true) {
      const postQuery = this.buildPostSearchQuery(options);
      const postResults = await this.db.query(postQuery.sql, postQuery.params);
      results.posts = postResults.rows.map(row => this.mapPostRow(row as QueryResult));
    }

    // Calculate total count
    results.totalCount = results.threads.length + results.posts.length;
    results.hasMore = results.totalCount >= limit;

    return results;
  }

  /**
   * Gets a thread by ID
   *
   * @param threadId - Thread ID
   * @returns Thread if found, null otherwise
   */
  async getThread(threadId: string): Promise<ForumThread | null> {
    const result = await this.db.query('SELECT * FROM forum_threads WHERE id = $1', [threadId]);

    if (result.rows.length === 0) {
      return null;
    }

    // Increment view count
    await this.db.query('UPDATE forum_threads SET view_count = view_count + 1 WHERE id = $1', [
      threadId,
    ]);

    return this.mapThreadRow(result.rows[0] as QueryResult);
  }

  /**
   * Gets posts for a thread
   *
   * @param threadId - Thread ID
   * @param limit - Maximum posts to return
   * @param offset - Pagination offset
   * @returns Array of posts
   */
  async getThreadPosts(
    threadId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<ForumPost[]> {
    const result = await this.db.query(
      `SELECT * FROM forum_posts 
       WHERE thread_id = $1 AND is_deleted = false 
       ORDER BY created_at ASC 
       LIMIT $2 OFFSET $3`,
      [threadId, limit, offset],
    );

    return result.rows.map(row => this.mapPostRow(row as QueryResult));
  }

  /**
   * Gets forum statistics
   *
   * @returns Overall forum statistics
   */
  async getStats(): Promise<ForumStats> {
    const stats = await this.db.query(`
      SELECT 
        (SELECT COUNT(*) FROM forum_threads) as total_threads,
        (SELECT COUNT(*) FROM forum_posts) as total_posts,
        (SELECT COUNT(DISTINCT author_address) FROM forum_posts) as active_users,
        (SELECT COUNT(*) FROM forum_threads WHERE created_at > NOW() - INTERVAL '24 hours') as threads_today,
        (SELECT COUNT(*) FROM forum_posts WHERE created_at > NOW() - INTERVAL '24 hours') as posts_today
    `);

    const categoryStats = await this.db.query(`
      SELECT category, COUNT(*) as count 
      FROM forum_threads 
      GROUP BY category
    `);

    interface StatsRow {
      total_threads: string | number;
      total_posts: string | number;
      active_users: string | number;
      threads_today: string | number;
      posts_today: string | number;
    }

    interface CategoryStatsRow {
      category: string;
      count: string | number;
    }

    const statsRow = stats.rows[0] as StatsRow;

    return {
      totalThreads: parseInt(String(statsRow.total_threads), 10),
      totalPosts: parseInt(String(statsRow.total_posts), 10),
      activeUsers: parseInt(String(statsRow.active_users), 10),
      threadsToday: parseInt(String(statsRow.threads_today), 10),
      postsToday: parseInt(String(statsRow.posts_today), 10),
      categoryBreakdown: categoryStats.rows.reduce<Record<string, number>>((acc, row) => {
        const catRow = row as CategoryStatsRow;
        const category = String(catRow.category);
        acc[category] = parseInt(String(catRow.count), 10);
        return acc;
      }, {}),
    };
  }

  /**
   * Validates a thread creation request
   * @param request - Thread creation request to validate
   * @private
   */
  private validateThreadRequest(request: CreateThreadRequest): void {
    if (
      request.title === undefined ||
      request.title === null ||
      request.title === '' ||
      request.title.length > this.config.maxTitleLength
    ) {
      throw new Error(`Title must be between 1 and ${this.config.maxTitleLength} characters`);
    }

    if (this.config.categories.find(c => c.id === request.category) === undefined) {
      throw new Error('Invalid category');
    }

    if (
      request.authorAddress === undefined ||
      request.authorAddress === null ||
      request.authorAddress.match(/^0x[a-fA-F0-9]{40}$/) === null
    ) {
      throw new Error('Invalid author address');
    }
  }

  /**
   * Validates a post creation request
   * @param request - Post creation request to validate
   * @private
   */
  private validatePostRequest(request: CreatePostRequest): void {
    if (
      request.content === undefined ||
      request.content === null ||
      request.content === '' ||
      request.content.length > this.config.maxContentLength
    ) {
      throw new Error(`Content must be between 1 and ${this.config.maxContentLength} characters`);
    }

    if (
      request.authorAddress === undefined ||
      request.authorAddress === null ||
      request.authorAddress.match(/^0x[a-fA-F0-9]{40}$/) === null
    ) {
      throw new Error('Invalid author address');
    }

    if (
      request.attachments !== undefined &&
      request.attachments.length > this.config.maxAttachments
    ) {
      throw new Error(`Maximum ${this.config.maxAttachments} attachments allowed`);
    }
  }

  /**
   * Updates thread statistics after a new post
   * @param threadId - ID of the thread to update
   * @private
   */
  private async updateThreadStats(threadId: string): Promise<void> {
    await this.db.query(
      `
      UPDATE forum_threads 
      SET 
        reply_count = (SELECT COUNT(*) FROM forum_posts WHERE thread_id = $1),
        last_reply_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `,
      [threadId],
    );
  }

  /**
   * Builds search query for threads
   * @param options - Search options
   * @returns SQL query and parameters
   * @private
   */
  private buildThreadSearchQuery(options: ForumSearchOptions): { sql: string; params: unknown[] } {
    let sql = 'SELECT * FROM forum_threads WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.query !== undefined && options.query !== null && options.query !== '') {
      sql += ` AND (title ILIKE $${paramIndex} OR EXISTS (
        SELECT 1 FROM forum_posts WHERE thread_id = forum_threads.id 
        AND content ILIKE $${paramIndex}
      ))`;
      params.push(`%${options.query}%`);
      paramIndex++;
    }

    if (options.category !== undefined && options.category !== null && options.category !== '') {
      sql += ` AND category = $${paramIndex}`;
      params.push(options.category);
      paramIndex++;
    }

    if (options.author !== undefined && options.author !== null && options.author !== '') {
      sql += ` AND author_address = $${paramIndex}`;
      params.push(options.author);
      paramIndex++;
    }

    if (options.tags !== undefined && options.tags.length > 0) {
      sql += ` AND tags ?| $${paramIndex}`;
      params.push(options.tags);
      paramIndex++;
    }

    sql += ` ORDER BY ${options.sortBy ?? 'updated_at'} ${options.sortOrder ?? 'DESC'}`;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(options.limit ?? 20, options.offset ?? 0);

    return { sql, params };
  }

  /**
   * Builds search query for posts
   * @param options - Search options
   * @returns SQL query and parameters
   * @private
   */
  private buildPostSearchQuery(options: ForumSearchOptions): { sql: string; params: unknown[] } {
    let sql =
      'SELECT p.*, t.title as thread_title FROM forum_posts p JOIN forum_threads t ON p.thread_id = t.id WHERE p.is_deleted = false';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.query !== undefined && options.query !== null && options.query !== '') {
      sql += ` AND p.content ILIKE $${paramIndex}`;
      params.push(`%${options.query}%`);
      paramIndex++;
    }

    if (options.author !== undefined && options.author !== null && options.author !== '') {
      sql += ` AND p.author_address = $${paramIndex}`;
      params.push(options.author);
      paramIndex++;
    }

    sql += ` ORDER BY p.created_at DESC`;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(options.limit ?? 20, options.offset ?? 0);

    return { sql, params };
  }

  /**
   * Maps database row to ForumThread
   * @private
   */
  /**
   * Maps database row to ForumThread
   * @param row - Database row
   * @returns ForumThread object
   * @private
   */
  private mapThreadRow(row: QueryResult): ForumThread {
    // Parse JSON fields safely
    let tags: string[] = [];
    if (typeof row.tags === 'string') {
      try {
        tags = JSON.parse(row.tags) as string[];
      } catch {
        tags = [];
      }
    } else if (Array.isArray(row.tags)) {
      tags = row.tags;
    }

    let metadata: Record<string, unknown> = {};
    if (typeof row.metadata === 'string') {
      try {
        metadata = JSON.parse(row.metadata) as Record<string, unknown>;
      } catch {
        metadata = {};
      }
    } else if (
      row.metadata !== null &&
      row.metadata !== undefined &&
      typeof row.metadata === 'object'
    ) {
      metadata = row.metadata;
    }

    return {
      id: row.id,
      title: row.title ?? '',
      category: row.category ?? '',
      authorAddress: row.author_address,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at ?? row.created_at).getTime(),
      viewCount:
        typeof row.view_count === 'string' ? parseInt(row.view_count, 10) : (row.view_count ?? 0),
      replyCount:
        typeof row.reply_count === 'string'
          ? parseInt(row.reply_count, 10)
          : (row.reply_count ?? 0),
      lastReplyAt: new Date(row.last_reply_at ?? row.created_at).getTime(),
      isPinned: row.is_pinned ?? false,
      isLocked: row.is_locked ?? false,
      tags,
      metadata,
    };
  }

  /**
   * Maps database row to ForumPost
   * @private
   */
  /**
   * Maps database row to ForumPost
   * @param row - Database row
   * @returns ForumPost object
   * @private
   */
  private mapPostRow(row: QueryResult): ForumPost {
    // Parse JSON fields safely
    let attachments: ForumAttachment[] = [];
    if (typeof row.attachments === 'string') {
      try {
        attachments = JSON.parse(row.attachments) as ForumAttachment[];
      } catch {
        attachments = [];
      }
    } else if (Array.isArray(row.attachments)) {
      attachments = row.attachments as ForumAttachment[];
    }

    let metadata: Record<string, unknown> = {};
    if (typeof row.metadata === 'string') {
      try {
        metadata = JSON.parse(row.metadata) as Record<string, unknown>;
      } catch {
        metadata = {};
      }
    } else if (
      row.metadata !== null &&
      row.metadata !== undefined &&
      typeof row.metadata === 'object'
    ) {
      metadata = row.metadata;
    }

    const mappedPost: ForumPost = {
      id: row.id,
      threadId: row.thread_id ?? '',
      authorAddress: row.author_address,
      content: row.content ?? '',
      createdAt: new Date(row.created_at).getTime(),
      editedAt:
        row.edited_at !== null && row.edited_at !== undefined
          ? new Date(row.edited_at).getTime()
          : null,
      upvotes: typeof row.upvotes === 'string' ? parseInt(row.upvotes, 10) : (row.upvotes ?? 0),
      downvotes:
        typeof row.downvotes === 'string' ? parseInt(row.downvotes, 10) : (row.downvotes ?? 0),
      isAcceptedAnswer: row.is_accepted_answer ?? false,
      isDeleted: row.is_deleted ?? false,
      attachments,
      metadata,
    };

    if (row.parent_id !== null && row.parent_id !== undefined) {
      mappedPost.parentId = row.parent_id;
    }

    return mappedPost;
  }

  /**
   * Generates unique thread ID
   * @returns Unique thread ID
   * @private
   */
  private generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generates unique post ID
   * @returns Unique post ID
   * @private
   */
  private generatePostId(): string {
    return `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generates unique vote ID
   * @returns Unique vote ID
   * @private
   */
  private generateVoteId(): string {
    return `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
