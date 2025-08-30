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
  type ForumActivityEvent
} from './ForumTypes';

/**
 * Create a fully configured forum service instance
 * 
 * @param db - YugabyteDB database instance
 * @param participationService - ParticipationScoreService instance for reputation tracking
 * @param config - Optional partial configuration to override defaults
 * @returns Promise resolving to initialized P2PForumService instance
 * 
 * @example
 * ```typescript
 * import { createForumService } from '@omnibazaar/documents';
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
  config?: Partial<import('./P2PForumService').P2PForumConfig>
): Promise<import('./P2PForumService').P2PForumService> {
  const { P2PForumService } = await import('./P2PForumService');
  const forumService = new P2PForumService(db, participationService, config ?? {});
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
  { id: 'governance', name: 'Community Governance', description: 'Proposals and voting' }
];

// Re-export for convenience
import type { ForumCategory } from './ForumTypes';