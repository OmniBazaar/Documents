/**
 * Forum Module Exports
 *
 * Central export file for all forum-related services and types
 *
 * @module Forum
 */

// Export main services
export { P2PForumService } from './P2PForumService';
export { ForumConsensus } from './ForumConsensus';
export { ForumIncentives } from './ForumIncentives';

// Export configuration interfaces
export type { P2PForumConfig } from './P2PForumService';
export type { ForumPointAllocation } from './ForumIncentives';

// Export all types
export {
  // Core types
  type ForumCategory,
  type ForumThread,
  type ForumPost,
  type ForumAttachment,
  type ForumVote,
  type ForumModeration,
  type ForumStats,
  type ForumReputation,
  type ForumBadge,

  // Request types
  type CreateThreadRequest,
  type CreatePostRequest,
  type VoteRequest,
  type ModerationRequest,

  // Search types
  type ForumSearchOptions,
  type ForumSearchResult,

  // Notification types
  type ForumNotificationPreferences,
  type ForumActivityEvent,
} from './ForumTypes';

/**
 * Create a fully configured forum service instance
 *
 * This function creates a forum service that integrates with the Validator module's
 * participation scoring system. Forum activity (posts, replies, moderation) feeds
 * directly into the user's overall participation score in the Validator module.
 *
 * @param db - YugabyteDB database instance from Validator module
 * @param participationService - ParticipationScoreService instance from Validator module for reputation tracking
 * @param config - Optional partial configuration to override defaults
 * @returns Promise resolving to initialized P2PForumService instance
 *
 * @example
 * ```typescript
 * import { createForumService } from '@omnibazaar/documents';
 * import { Database } from '@omnibazaar/validator';
 * import { ParticipationScoreService } from '@omnibazaar/validator';
 *
 * const db = new Database(dbConfig);
 * const participationService = new ParticipationScoreService(db);
 *
 * const forum = await createForumService(db, participationService, {
 *   maxTitleLength: 200,
 *   minReputationToPost: 10
 * });
 * ```
 */
export async function createForumService(
  db: import('../../../../Validator/src/database/Database').Database,
  participationService: import('../../../../Validator/src/services/ParticipationScoreService').ParticipationScoreService,
  config?: Partial<import('./P2PForumService').P2PForumConfig>,
): Promise<import('./P2PForumService').P2PForumService> {
  const { P2PForumService } = await import('./P2PForumService');
  const { Database } = await import('../database/Database');
  const { ParticipationScoreService: LocalParticipationService } = await import(
    '../participation/ParticipationScoreService'
  );

  // Create database adapter with default config
  // In production, this would use the same connection pool as the Validator
  const dbAdapter = new Database({
    host: 'localhost',
    port: 5433,
    database: 'omnibazaar',
    user: 'yugabyte',
    password: 'yugabyte',
  });

  // Create participation service adapter that feeds into Validator's participation service
  const participationAdapter = new LocalParticipationService('http://localhost:3000');

  // Override methods to use the real validator service
  participationAdapter.updateForumActivity = async (
    userAddress: string,
    points: number,
  ): Promise<void> => {
    // Feed forum activity into the Validator's participation score
    // The Validator expects metrics, so we create a simple metrics object
    await participationService.updateForumActivity(userAddress, {
      posts: points, // Use points as a proxy for posts
      acceptedAnswers: 0,
      lastActivity: Date.now(),
    });
  };

  participationAdapter.getUserScore = async (
    userAddress: string,
  ): Promise<import('../participation/ParticipationScoreService').UserScoreBreakdown> => {
    const data = await participationService.getUserData(userAddress);
    const score = data?.totalScore ?? 0;
    // Access components from the Validator's data structure
    const components = (
      data as {
        totalScore: number;
        components?: {
          documentationActivity?: number;
          forumActivity?: number;
          supportParticipation?: number;
        };
      }
    )?.components;
    return {
      total: score,
      documentation: components?.documentationActivity ?? 0,
      forum: components?.forumActivity ?? 0,
      support: components?.supportParticipation ?? 0,
    };
  };

  participationAdapter.getUserData = async (
    userAddress: string,
  ): Promise<{ userId: string; totalScore: number }> => {
    const data = await participationService.getUserData(userAddress);
    return {
      userId: userAddress,
      totalScore: data?.totalScore ?? 0,
    };
  };

  participationAdapter.getScore = async (
    userAddress: string,
  ): Promise<import('../participation/ParticipationScoreService').UserParticipationData | null> => {
    const data = await participationService.getUserData(userAddress);
    if (data === null || data === undefined) return null;

    const components = (
      data as {
        totalScore: number;
        components?: {
          documentationActivity?: number;
          forumActivity?: number;
          supportParticipation?: number;
        };
      }
    )?.components;

    return {
      userId: userAddress,
      totalScore: data.totalScore,
      breakdown: {
        total: data.totalScore,
        documentation: components?.documentationActivity ?? 0,
        forum: components?.forumActivity ?? 0,
        support: components?.supportParticipation ?? 0,
      },
    };
  };

  // Default configuration for P2PForumService
  const DEFAULT_CONFIG: import('./P2PForumService').P2PForumConfig = {
    maxTitleLength: 200,
    maxContentLength: 50000,
    minReputationToPost: 0,
    minReputationToModerate: 50,
    editWindowMs: 15 * 60 * 1000, // 15 minutes
    maxAttachments: 5,
    maxAttachmentSize: 10 * 1024 * 1024, // 10MB
    categories: DEFAULT_FORUM_CATEGORIES,
  };

  // Merge config with defaults
  const finalConfig: import('./P2PForumService').P2PForumConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const forumService = new P2PForumService(dbAdapter, participationAdapter, finalConfig);
  await forumService.initialize();
  return forumService;
}

/**
 * Forum module version
 */
export const FORUM_VERSION = '1.0.0';

/**
 * Default forum categories
 */
export const DEFAULT_FORUM_CATEGORIES: ForumCategory[] = [
  { id: 'wallet', name: 'OmniWallet Support', description: 'Help with wallet features' },
  { id: 'marketplace', name: 'Marketplace Help', description: 'Buying and selling assistance' },
  { id: 'dex', name: 'DEX Trading', description: 'Decentralized exchange support' },
  { id: 'technical', name: 'Technical Support', description: 'Technical issues and bugs' },
  { id: 'feature', name: 'Feature Requests', description: 'Suggest new features' },
  { id: 'governance', name: 'Community Governance', description: 'Proposals and voting' },
];

// Re-export for convenience
import type { ForumCategory } from './ForumTypes';
