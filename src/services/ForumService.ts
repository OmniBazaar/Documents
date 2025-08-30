/**
 * Forum Service
 * 
 * Manages forum functionality including posts, replies, and discussions
 * through the validator network's distributed storage.
 * 
 * @module ForumService
 */

import { logger } from '../utils/logger';
import { Database } from './database/Database';
import { ParticipationScoreService } from './participation/ParticipationScoreService';

/**
 * Forum post data structure
 */
export interface ForumPost {
  /** Unique post identifier */
  postId: string;
  /** Author's wallet address */
  authorAddress: string;
  /** Post title */
  title: string;
  /** Post content in Markdown format */
  content: string;
  /** Post category */
  category: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Number of replies */
  replyCount: number;
  /** Number of likes */
  likeCount: number;
  /** View count */
  viewCount: number;
  /** Whether post is pinned */
  isPinned: boolean;
  /** Whether post is locked */
  isLocked: boolean;
  /** Post tags */
  tags: string[];
  /** IPFS hash for content */
  ipfsHash?: string;
}

/**
 * Forum reply data structure
 */
export interface ForumReply {
  /** Unique reply identifier */
  replyId: string;
  /** Parent post ID */
  postId: string;
  /** Author's wallet address */
  authorAddress: string;
  /** Reply content */
  content: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Number of likes */
  likeCount: number;
  /** ID of reply being responded to */
  replyTo?: string;
  /** Whether reply has been edited */
  isEdited: boolean;
  /** IPFS hash for content */
  ipfsHash?: string;
}

/**
 * Forum categories
 */
export enum ForumCategory {
  /** General discussion */
  GENERAL = 'general',
  /** Marketplace discussions */
  MARKETPLACE = 'marketplace',
  /** Technical support */
  TECHNICAL = 'technical',
  /** Trading discussions */
  TRADING = 'trading',
  /** User support */
  SUPPORT = 'support',
  /** Official announcements */
  ANNOUNCEMENTS = 'announcements'
}

/**
 * Forum post creation parameters
 */
export interface CreatePostParams {
  /** Post title */
  title: string;
  /** Post content */
  content: string;
  /** Post category */
  category: ForumCategory;
  /** Post tags */
  tags?: string[];
  /** Author's wallet address */
  authorAddress: string;
}

/**
 * Forum reply creation parameters
 */
export interface CreateReplyParams {
  /** Parent post ID */
  postId: string;
  /** Reply content */
  content: string;
  /** Author's wallet address */
  authorAddress: string;
  /** ID of reply being responded to */
  replyTo?: string;
}

/**
 * Forum search parameters
 */
export interface ForumSearchParams {
  /** Search query */
  query?: string;
  /** Filter by category */
  category?: ForumCategory;
  /** Filter by author */
  authorAddress?: string;
  /** Filter by tags */
  tags?: string[];
  /** Sort field */
  sortBy?: 'recent' | 'popular' | 'active';
  /** Page number */
  page?: number;
  /** Results per page */
  pageSize?: number;
}

/**
 * Service for managing forum functionality
 */
export class ForumService {
  /** Database instance */
  private db: Database;
  /** Participation scoring service */
  private participationService: ParticipationScoreService;

  /**
   * Creates a new ForumService instance
   * @param db - Database connection
   * @param participationService - Participation scoring service
   */
  constructor(
    db: Database,
    participationService: ParticipationScoreService
  ) {
    this.db = db;
    this.participationService = participationService;
  }

  /**
   * Creates a new forum post
   * @param params - Post creation parameters
   * @returns Created forum post
   * @throws {Error} If creation fails
   */
  async createPost(params: CreatePostParams): Promise<ForumPost> {
    try {
      this.validatePost(params.title, params.content);
      
      const postId = this.generatePostId();
      const now = new Date();
      
      const post: ForumPost = {
        postId,
        authorAddress: params.authorAddress,
        title: params.title,
        content: params.content,
        category: params.category,
        createdAt: now,
        updatedAt: now,
        replyCount: 0,
        likeCount: 0,
        viewCount: 0,
        isPinned: false,
        isLocked: false,
        tags: params.tags ?? []
      };

      await this.db.query(
        `INSERT INTO forum_posts (
          post_id, author_address, title, content, category,
          created_at, updated_at, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          post.postId,
          post.authorAddress,
          post.title,
          post.content,
          post.category,
          post.createdAt,
          post.updatedAt,
          JSON.stringify(post.tags)
        ]
      );

      // Award participation points
      await this.participationService.updateForumActivity(params.authorAddress, 'post_created');

      logger.info(`Forum post created: ${postId}`);
      return post;
    } catch (error) {
      logger.error('Failed to create forum post:', error);
      throw error;
    }
  }

  /**
   * Creates a reply to a forum post
   * @param params - Reply creation parameters
   * @returns Created forum reply
   * @throws {Error} If creation fails
   */
  async createReply(params: CreateReplyParams): Promise<ForumReply> {
    try {
      this.validateReply(params.content);
      
      // Check if post exists and is not locked
      const post = await this.getPost(params.postId);
      if (post === null) {
        throw new Error('Post not found');
      }
      if (post.isLocked) {
        throw new Error('Post is locked');
      }

      const replyId = this.generateReplyId();
      const now = new Date();
      
      const reply: ForumReply = {
        replyId,
        postId: params.postId,
        authorAddress: params.authorAddress,
        content: params.content,
        createdAt: now,
        updatedAt: now,
        likeCount: 0,
        replyTo: params.replyTo,
        isEdited: false
      };

      await this.db.transaction(async (client) => {
        // Insert reply
        await client.query(
          `INSERT INTO forum_replies (
            reply_id, post_id, author_address, content,
            created_at, updated_at, reply_to
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            reply.replyId,
            reply.postId,
            reply.authorAddress,
            reply.content,
            reply.createdAt,
            reply.updatedAt,
            reply.replyTo
          ]
        );

        // Update post reply count and last activity
        await client.query(
          `UPDATE forum_posts 
           SET reply_count = reply_count + 1,
               updated_at = $2
           WHERE post_id = $1`,
          [params.postId, now]
        );
      });

      // Award participation points
      await this.participationService.updateForumActivity(params.authorAddress, 'reply_created');

      logger.info(`Forum reply created: ${replyId}`);
      return reply;
    } catch (error) {
      logger.error('Failed to create forum reply:', error);
      throw error;
    }
  }

  /**
   * Gets a forum post by ID
   * @param postId - Post identifier
   * @param incrementViews - Whether to increment view count
   * @returns Forum post or null if not found
   */
  async getPost(postId: string, incrementViews = false): Promise<ForumPost | null> {
    try {
      const result = await this.db.query<{
        post_id: string;
        author_address: string;
        title: string;
        content: string;
        category: string;
        created_at: Date;
        updated_at: Date;
        reply_count: number;
        like_count: number;
        view_count: number;
        is_pinned: boolean;
        is_locked: boolean;
        tags: string;
        ipfs_hash?: string;
      }>(
        'SELECT * FROM forum_posts WHERE post_id = $1',
        [postId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      
      if (incrementViews) {
        void this.incrementViewCount(postId);
      }

      return {
        postId: row.post_id,
        authorAddress: row.author_address,
        title: row.title,
        content: row.content,
        category: row.category as ForumCategory,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        replyCount: row.reply_count,
        likeCount: row.like_count,
        viewCount: row.view_count,
        isPinned: row.is_pinned,
        isLocked: row.is_locked,
        tags: JSON.parse(row.tags) as string[],
        ipfsHash: row.ipfs_hash
      };
    } catch (error) {
      logger.error(`Failed to get forum post ${postId}:`, error);
      return null;
    }
  }

  /**
   * Gets replies for a forum post
   * @param postId - Post identifier
   * @param page - Page number
   * @param pageSize - Results per page
   * @returns Array of forum replies
   */
  async getReplies(
    postId: string,
    page = 1,
    pageSize = 20
  ): Promise<ForumReply[]> {
    try {
      const offset = (page - 1) * pageSize;
      
      const result = await this.db.query<{
        reply_id: string;
        post_id: string;
        author_address: string;
        content: string;
        created_at: Date;
        updated_at: Date;
        like_count: number;
        reply_to?: string;
        is_edited: boolean;
        ipfs_hash?: string;
      }>(
        `SELECT * FROM forum_replies
         WHERE post_id = $1
         ORDER BY created_at ASC
         LIMIT $2 OFFSET $3`,
        [postId, pageSize, offset]
      );

      return result.rows.map(row => ({
        replyId: row.reply_id,
        postId: row.post_id,
        authorAddress: row.author_address,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        likeCount: row.like_count,
        replyTo: row.reply_to,
        isEdited: row.is_edited,
        ipfsHash: row.ipfs_hash
      }));
    } catch (error) {
      logger.error(`Failed to get replies for post ${postId}:`, error);
      return [];
    }
  }

  /**
   * Searches forum posts
   * @param params - Search parameters
   * @returns Search results
   */
  async searchPosts(params: ForumSearchParams): Promise<{
    posts: ForumPost[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const {
        query = '',
        category,
        authorAddress,
        tags = [],
        sortBy = 'recent',
        page = 1,
        pageSize = 20
      } = params;

      const whereConditions: string[] = ['1=1'];
      const queryParams: (string | number | string[])[] = [];

      if (query !== '') {
        whereConditions.push(`
          (to_tsvector('english', title) || to_tsvector('english', content))
          @@ plainto_tsquery('english', $${queryParams.length + 1})
        `);
        queryParams.push(query);
      }

      if (category !== undefined) {
        whereConditions.push(`category = $${queryParams.length + 1}`);
        queryParams.push(category);
      }

      if (authorAddress !== undefined) {
        whereConditions.push(`author_address = $${queryParams.length + 1}`);
        queryParams.push(authorAddress);
      }

      if (tags.length > 0) {
        whereConditions.push(`tags @> $${queryParams.length + 1}`);
        queryParams.push(JSON.stringify(tags));
      }

      // Get total count
      const countResult = await this.db.query<{ count: string }>(
        `SELECT COUNT(*) FROM forum_posts WHERE ${whereConditions.join(' AND ')}`,
        queryParams
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get posts with sorting
      const orderBy = this.getOrderByClause(sortBy);
      const offset = (page - 1) * pageSize;
      
      const result = await this.db.query<{
        post_id: string;
        author_address: string;
        title: string;
        content: string;
        category: string;
        created_at: Date;
        updated_at: Date;
        reply_count: number;
        like_count: number;
        view_count: number;
        is_pinned: boolean;
        is_locked: boolean;
        tags: string;
        ipfs_hash?: string;
      }>(
        `SELECT * FROM forum_posts 
         WHERE ${whereConditions.join(' AND ')}
         ORDER BY is_pinned DESC, ${orderBy}
         LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
        [...queryParams, pageSize, offset]
      );

      const posts = result.rows.map(row => ({
        postId: row.post_id,
        authorAddress: row.author_address,
        title: row.title,
        content: row.content,
        category: row.category as ForumCategory,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        replyCount: row.reply_count,
        likeCount: row.like_count,
        viewCount: row.view_count,
        isPinned: row.is_pinned,
        isLocked: row.is_locked,
        tags: JSON.parse(row.tags) as string[],
        ipfsHash: row.ipfs_hash
      }));

      return {
        posts,
        total,
        page,
        pageSize
      };
    } catch (error) {
      logger.error('Failed to search forum posts:', error);
      throw error;
    }
  }

  /**
   * Likes or unlikes a post
   * @param postId - Post identifier
   * @param userAddress - User's wallet address
   * @returns Updated like count
   */
  async togglePostLike(postId: string, userAddress: string): Promise<number> {
    try {
      return await this.db.transaction(async (client) => {
        // Check if already liked
        const existing = await client.query(
          'SELECT * FROM forum_likes WHERE post_id = $1 AND user_address = $2',
          [postId, userAddress]
        );

        if (existing.rows.length > 0) {
          // Unlike
          await client.query(
            'DELETE FROM forum_likes WHERE post_id = $1 AND user_address = $2',
            [postId, userAddress]
          );
          
          await client.query(
            'UPDATE forum_posts SET like_count = like_count - 1 WHERE post_id = $1',
            [postId]
          );
        } else {
          // Like
          await client.query(
            'INSERT INTO forum_likes (post_id, user_address) VALUES ($1, $2)',
            [postId, userAddress]
          );
          
          await client.query(
            'UPDATE forum_posts SET like_count = like_count + 1 WHERE post_id = $1',
            [postId]
          );
        }

        // Get updated count
        const result = await client.query<{ like_count: number }>(
          'SELECT like_count FROM forum_posts WHERE post_id = $1',
          [postId]
        );

        return result.rows[0].like_count;
      });
    } catch (error) {
      logger.error(`Failed to toggle like for post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Validates post data
   * @param title - Post title
   * @param content - Post content
   * @throws {Error} If validation fails
   * @private
   */
  private validatePost(title: string, content: string): void {
    if (title.length < 5) {
      throw new Error('Title must be at least 5 characters');
    }
    if (title.length > 200) {
      throw new Error('Title must not exceed 200 characters');
    }
    if (content.length < 20) {
      throw new Error('Content must be at least 20 characters');
    }
    if (content.length > 50000) {
      throw new Error('Content must not exceed 50000 characters');
    }
  }

  /**
   * Validates reply data
   * @param content - Reply content
   * @throws {Error} If validation fails
   * @private
   */
  private validateReply(content: string): void {
    if (content.length < 10) {
      throw new Error('Reply must be at least 10 characters');
    }
    if (content.length > 10000) {
      throw new Error('Reply must not exceed 10000 characters');
    }
  }

  /**
   * Increments view count for a post
   * @param postId - Post identifier
   * @private
   */
  private async incrementViewCount(postId: string): Promise<void> {
    try {
      await this.db.query(
        'UPDATE forum_posts SET view_count = view_count + 1 WHERE post_id = $1',
        [postId]
      );
    } catch (error) {
      logger.error(`Failed to increment view count for ${postId}:`, error);
    }
  }

  /**
   * Gets ORDER BY clause for queries
   * @param sortBy - Sort field
   * @returns SQL ORDER BY clause
   * @private
   */
  private getOrderByClause(sortBy: 'recent' | 'popular' | 'active'): string {
    switch (sortBy) {
      case 'popular':
        return 'like_count DESC, reply_count DESC';
      case 'active':
        return 'updated_at DESC';
      case 'recent':
      default:
        return 'created_at DESC';
    }
  }

  /**
   * Generates unique post ID
   * @returns Generated post ID
   * @private
   */
  private generatePostId(): string {
    return `post_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generates unique reply ID
   * @returns Generated reply ID
   * @private
   */
  private generateReplyId(): string {
    return `reply_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}