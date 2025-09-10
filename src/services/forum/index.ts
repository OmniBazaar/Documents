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
 * This function creates a forum service that integrates with the participation
 * scoring system. Forum activity (posts, replies, moderation) feeds directly
 * into the user's overall participation score.
 *
 * @param db - Database instance
 * @param participationService - ParticipationScoreService instance for reputation tracking
 * @param config - Optional partial configuration to override defaults
 * @returns Promise resolving to initialized P2PForumService instance
 *
 * @example
 * ```typescript
 * import { createForumService } from '@omnibazaar/documents';
 * import { Database } from '@omnibazaar/documents/database';
 * import { ParticipationScoreService } from '@omnibazaar/documents/participation';
 *
 * const db = new Database(dbConfig);
 * const participationService = new ParticipationScoreService();
 *
 * const forum = await createForumService(db, participationService, {
 *   maxTitleLength: 200,
 *   minReputationToPost: 10
 * });
 * ```
 */
export async function createForumService(
  db: import('../database/Database').Database,
  participationService: import('../../interfaces/ParticipationScoreService').IParticipationScoreService,
  config?: Partial<import('./P2PForumService').P2PForumConfig>,
): Promise<import('./P2PForumService').P2PForumService> {
  const { P2PForumService } = await import('./P2PForumService');
  const { ParticipationScoreService: LocalParticipationService } = await import(
    '../participation/ParticipationScoreService'
  );

  // Create local participation service that wraps the provided service
  const participationAdapter = new LocalParticipationService('http://localhost:3000');

  // Override methods to use the provided participation service
  participationAdapter.updateForumActivity = async (
    userAddress: string,
    points: number,
  ): Promise<void> => {
    // Record forum activity using the standard interface
    await participationService.recordActivity(userAddress, 'forum_activity', {
      points,
      timestamp: Date.now(),
    });
  };

  participationAdapter.getUserScore = async (
    userAddress: string,
  ): Promise<import('../participation/ParticipationScoreService').UserScoreBreakdown> => {
    const score = await participationService.getScore(userAddress);
    return {
      total: score.overallScore,
      documentation: score.components.documentationContribution,
      forum: score.components.forumActivity,
      support: score.components.supportVolunteering,
    };
  };

  participationAdapter.getUserData = async (
    userAddress: string,
  ): Promise<{ userId: string; totalScore: number }> => {
    const score = await participationService.getScore(userAddress);
    return {
      userId: userAddress,
      totalScore: score.overallScore,
    };
  };

  participationAdapter.getScore = async (
    userAddress: string,
  ): Promise<import('../participation/ParticipationScoreService').UserParticipationData | null> => {
    const score = await participationService.getScore(userAddress);
    return {
      userId: userAddress,
      totalScore: score.overallScore,
      breakdown: {
        total: score.overallScore,
        documentation: score.components.documentationContribution,
        forum: score.components.forumActivity,
        support: score.components.supportVolunteering,
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

  const forumService = new P2PForumService(db, participationAdapter, finalConfig);
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
