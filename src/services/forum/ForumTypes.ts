/**
 * Type definitions for the P2P Forum Service
 * 
 * @module ForumTypes
 */

/**
 * Forum category definition
 */
export interface ForumCategory {
  /** Unique identifier for the category */
  id: string;
  /** Display name of the category */
  name: string;
  /** Description of the category */
  description: string;
  /** Optional icon or emoji for the category */
  icon?: string;
  /** Order for display purposes */
  order?: number;
}

/**
 * Represents a forum thread
 */
export interface ForumThread {
  /** Unique thread identifier */
  id: string;
  /** Thread title */
  title: string;
  /** Category ID this thread belongs to */
  category: string;
  /** Ethereum address of the thread author */
  authorAddress: string;
  /** Username of the author (optional, from registry) */
  authorUsername?: string;
  /** Timestamp when thread was created */
  createdAt: number;
  /** Timestamp of last update */
  updatedAt: number;
  /** Number of views */
  viewCount: number;
  /** Number of replies */
  replyCount: number;
  /** Timestamp of last reply */
  lastReplyAt: number;
  /** Whether thread is pinned to top */
  isPinned: boolean;
  /** Whether thread is locked from new replies */
  isLocked: boolean;
  /** Tags associated with the thread */
  tags: string[];
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Represents a forum post (reply)
 */
export interface ForumPost {
  /** Unique post identifier */
  id: string;
  /** Thread this post belongs to */
  threadId: string;
  /** Parent post ID if this is a reply to another post */
  parentId?: string;
  /** Ethereum address of the post author */
  authorAddress: string;
  /** Username of the author (optional) */
  authorUsername?: string;
  /** Post content in markdown format */
  content: string;
  /** Timestamp when post was created */
  createdAt: number;
  /** Timestamp when post was last edited */
  editedAt: number | null;
  /** Number of upvotes */
  upvotes: number;
  /** Number of downvotes */
  downvotes: number;
  /** Whether this is the accepted answer (for Q&A threads) */
  isAcceptedAnswer: boolean;
  /** Whether post has been soft deleted */
  isDeleted: boolean;
  /** File attachments */
  attachments: ForumAttachment[];
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * File attachment for a post
 */
export interface ForumAttachment {
  /** Unique attachment ID */
  id: string;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** IPFS hash for large files */
  ipfsHash?: string;
  /** Direct URL for small files */
  url?: string;
  /** Thumbnail URL for images */
  thumbnailUrl?: string;
}

/**
 * Represents a vote on a post
 */
export interface ForumVote {
  /** Unique vote ID */
  id: string;
  /** Post being voted on */
  postId: string;
  /** Address of the voter */
  voterAddress: string;
  /** Type of vote */
  voteType: 'upvote' | 'downvote';
  /** Timestamp of the vote */
  timestamp: number;
}

/**
 * Moderation action on a thread or post
 */
export interface ForumModeration {
  /** Unique moderation action ID */
  id: string;
  /** Type of moderation action */
  action: 'lock' | 'unlock' | 'pin' | 'unpin' | 'delete' | 'restore' | 'move' | 'merge';
  /** Target thread or post ID */
  targetId: string;
  /** Type of target */
  targetType: 'thread' | 'post';
  /** Moderator address */
  moderatorAddress: string;
  /** Reason for moderation */
  reason: string;
  /** Additional details */
  details?: Record<string, unknown>;
  /** Timestamp of action */
  timestamp: number;
  /** Whether this action was reversed */
  isReversed: boolean;
}

/**
 * Forum statistics
 */
export interface ForumStats {
  /** Total number of threads */
  totalThreads: number;
  /** Total number of posts */
  totalPosts: number;
  /** Number of active users */
  activeUsers: number;
  /** Threads created today */
  threadsToday: number;
  /** Posts created today */
  postsToday: number;
  /** Breakdown by category */
  categoryBreakdown: Record<string, number>;
}

/**
 * User's forum reputation
 */
export interface ForumReputation {
  /** User's Ethereum address */
  address: string;
  /** Total posts created */
  totalPosts: number;
  /** Total threads created */
  totalThreads: number;
  /** Total upvotes received */
  totalUpvotesReceived: number;
  /** Total downvotes received */
  totalDownvotesReceived: number;
  /** Number of accepted answers */
  acceptedAnswers: number;
  /** Reputation score (calculated) */
  reputationScore: number;
  /** Whether user is a moderator */
  isModerator: boolean;
  /** Special badges earned */
  badges: ForumBadge[];
}

/**
 * Forum achievement badge
 */
export interface ForumBadge {
  /** Badge identifier */
  id: string;
  /** Badge name */
  name: string;
  /** Badge description */
  description: string;
  /** Badge icon */
  icon: string;
  /** When the badge was earned */
  earnedAt: number;
  /** Badge rarity */
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

/**
 * Request to create a new thread
 */
export interface CreateThreadRequest {
  /** Thread title */
  title: string;
  /** Initial post content */
  content?: string;
  /** Category ID */
  category: string;
  /** Author's Ethereum address */
  authorAddress: string;
  /** Optional tags */
  tags?: string[];
  /** Optional attachments for initial post */
  attachments?: ForumAttachment[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request to create a new post
 */
export interface CreatePostRequest {
  /** Thread to post in */
  threadId: string;
  /** Post content */
  content: string;
  /** Parent post ID if replying */
  parentId?: string;
  /** Author's Ethereum address */
  authorAddress: string;
  /** Optional attachments */
  attachments?: ForumAttachment[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request to vote on a post
 */
export interface VoteRequest {
  /** Post to vote on */
  postId: string;
  /** Voter's address */
  voterAddress: string;
  /** Vote type */
  voteType: 'upvote' | 'downvote';
}

/**
 * Request for moderation action
 */
export interface ModerationRequest {
  /** Type of moderation action */
  action: ForumModeration['action'];
  /** Target ID */
  targetId: string;
  /** Target type */
  targetType: 'thread' | 'post';
  /** Moderator address */
  moderatorAddress: string;
  /** Reason for action */
  reason: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Forum search options
 */
export interface ForumSearchOptions {
  /** Search query text */
  query?: string;
  /** Filter by category */
  category?: string;
  /** Filter by author */
  author?: string;
  /** Filter by tags */
  tags?: string[];
  /** Date range start */
  startDate?: number;
  /** Date range end */
  endDate?: number;
  /** Sort field */
  sortBy?: 'relevance' | 'created_at' | 'updated_at' | 'replies' | 'votes';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Results limit */
  limit?: number;
  /** Results offset */
  offset?: number;
  /** Search only in thread titles */
  titleOnly?: boolean;
  /** Search only posts, not threads */
  postsOnly?: boolean;
  /** Search only threads, not posts */
  threadsOnly?: boolean;
}

/**
 * Forum search results
 */
export interface ForumSearchResult {
  /** Matching threads */
  threads: ForumThread[];
  /** Matching posts */
  posts: ForumPost[];
  /** Total count of results */
  totalCount: number;
  /** Whether there are more results */
  hasMore: boolean;
  /** Search metadata */
  metadata?: {
    /** Search execution time in ms */
    searchTime?: number;
    /** Relevance scores */
    relevanceScores?: Record<string, number>;
  };
}

/**
 * Notification preferences for forum activity
 */
export interface ForumNotificationPreferences {
  /** User address */
  address: string;
  /** Notify on replies to threads */
  notifyOnThreadReply: boolean;
  /** Notify on replies to posts */
  notifyOnPostReply: boolean;
  /** Notify when mentioned */
  notifyOnMention: boolean;
  /** Notify on upvotes */
  notifyOnUpvote: boolean;
  /** Notify on accepted answer */
  notifyOnAcceptedAnswer: boolean;
  /** Notification channels */
  channels: {
    /** In-app notifications */
    inApp: boolean;
    /** Email notifications */
    email: boolean;
    /** Push notifications */
    push: boolean;
  };
}

/**
 * Forum activity event for real-time updates
 */
export interface ForumActivityEvent {
  /** Event type */
  type: 'thread_created' | 'post_created' | 'post_voted' | 'post_edited' | 
        'thread_locked' | 'thread_pinned' | 'answer_accepted';
  /** Related entity ID */
  entityId: string;
  /** Actor address */
  actorAddress: string;
  /** Event timestamp */
  timestamp: number;
  /** Additional event data */
  data?: Record<string, unknown>;
}