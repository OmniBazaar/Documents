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

/**
 * Mock implementation of ParticipationScoreService
 * Used when actual service is not available
 */
export class MockParticipationScoreService implements IParticipationScoreService {
  /**
   * Get mock participation score
   * @param userAddress - User's wallet address
   * @returns Mock participation score
   */
  getScore(userAddress: string): Promise<ParticipationScore> {
    return Promise.resolve({
      userAddress,
      overallScore: 50,
      components: {
        marketplaceActivity: 10,
        validationParticipation: 5,
        documentationContribution: 5,
        forumActivity: 10,
        supportVolunteering: 5,
        networkUptime: 5,
        referrals: 5,
        governanceParticipation: 5,
      },
      lastUpdated: new Date(),
      thirtyDayChange: 0,
    });
  }

  /**
   * Update mock score component
   * @param userAddress - User's wallet address
   * @param component - Component to update
   * @param value - New component value
   * @returns Updated mock score
   */
  async updateComponent(
    userAddress: string,
    component: keyof ParticipationScoreComponents,
    value: number,
  ): Promise<ParticipationScore> {
    const score = await this.getScore(userAddress);
    score.components[component] = value;
    const componentValues = Object.values(score.components) as number[];
    score.overallScore = componentValues.reduce((a, b) => a + b, 0);
    return score;
  }

  /**
   * Record mock activity
   * @param _userAddress - User's wallet address (unused in mock)
   * @param _activityType - Type of activity (unused in mock)
   * @param _details - Activity details (unused in mock)
   * @returns Always returns true
   */
  recordActivity(
    _userAddress: string,
    _activityType: string,
    _details: Record<string, unknown>,
  ): Promise<boolean> {
    return Promise.resolve(true);
  }

  /**
   * Get mock leaderboard
   * @param limit - Number of entries to return
   * @returns Empty array
   */
  async getLeaderboard(limit: number): Promise<ParticipationScore[]> {
    const scores: ParticipationScore[] = [];
    for (let i = 0; i < limit; i++) {
      scores.push(await this.getScore(`0x${i.toString(16).padStart(40, '0')}`));
    }
    return scores;
  }
}
