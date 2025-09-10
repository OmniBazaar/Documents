/**
 * ParticipationScoreService interface for Documents module
 * Provides a local interface to avoid importing from Validator module
 */

/**
 * Participation score components
 * Each component contributes to the overall participation score
 */
export interface ParticipationScoreComponents {
  /**
   * Score for marketplace activity (buying/selling)
   */
  marketplaceActivity: number;
  /**
   * Score for validation participation
   */
  validationParticipation: number;
  /**
   * Score for documentation contributions
   */
  documentationContribution: number;
  /**
   * Score for forum activity
   */
  forumActivity: number;
  /**
   * Score for support volunteering
   */
  supportVolunteering: number;
  /**
   * Score for network uptime
   */
  networkUptime: number;
  /**
   * Score for referrals
   */
  referrals: number;
  /**
   * Score for governance participation
   */
  governanceParticipation: number;
}

/**
 * Participation score result
 * Contains the overall score and breakdown by component
 */
export interface ParticipationScore {
  /**
   * User's wallet address
   */
  userAddress: string;
  /**
   * Overall participation score (0-100)
   */
  overallScore: number;
  /**
   * Individual component scores
   */
  components: ParticipationScoreComponents;
  /**
   * Last update timestamp
   */
  lastUpdated: Date;
  /**
   * 30-day change in score
   */
  thirtyDayChange: number;
}

/**
 * Participation Score Service interface
 * Manages user participation scores across the platform
 */
export interface IParticipationScoreService {
  /**
   * Get participation score for a user
   * @param userAddress - User's wallet address
   * @returns Participation score details
   */
  getScore(userAddress: string): Promise<ParticipationScore>;

  /**
   * Update a specific score component
   * @param userAddress - User's wallet address
   * @param component - Component to update
   * @param value - New component value
   * @returns Updated participation score
   */
  updateComponent(
    userAddress: string,
    component: keyof ParticipationScoreComponents,
    value: number,
  ): Promise<ParticipationScore>;

  /**
   * Record user activity
   * @param userAddress - User's wallet address
   * @param activityType - Type of activity
   * @param details - Activity details
   * @returns Success status
   */
  recordActivity(
    userAddress: string,
    activityType: string,
    details: Record<string, unknown>,
  ): Promise<boolean>;

  /**
   * Get leaderboard
   * @param limit - Number of entries to return
   * @returns Top users by participation score
   */
  getLeaderboard(limit: number): Promise<ParticipationScore[]>;
}

