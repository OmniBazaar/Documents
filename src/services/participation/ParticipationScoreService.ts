/**
 * Participation Score Service Interface
 *
 * Interface for interacting with the Validator module's ParticipationScoreService.
 * This service tracks user contributions to documentation, forums, and support.
 *
 * @module ParticipationScoreService
 */

import { logger } from '../../utils/logger';

/**
 * User score breakdown interface
 */
export interface UserScoreBreakdown {
  /** Total participation score */
  total: number;
  /** Documentation contribution score */
  documentation: number;
  /** Forum activity score */
  forum: number;
  /** Support volunteer score */
  support: number;
}

/**
 * User participation data interface
 */
export interface UserParticipationData {
  /** User's Ethereum wallet address */
  userId: string;
  /** Total participation score */
  totalScore: number;
  /** Score breakdown by category */
  breakdown?: UserScoreBreakdown;
}

/**
 * Service for managing user participation scores
 *
 * Tracks and updates user contributions across different activities:
 * - Documentation contributions
 * - Forum participation
 * - Support volunteer work
 */
export class ParticipationScoreService {
  /** Validator API endpoint */
  private readonly validatorEndpoint: string;

  /**
   * Creates a new ParticipationScoreService instance
   * @param validatorEndpoint - Validator API endpoint URL
   */
  constructor(validatorEndpoint: string) {
    this.validatorEndpoint = validatorEndpoint;
  }

  /**
   * Updates a user's documentation activity score
   *
   * Awards points for contributions to documentation such as:
   * - Creating or updating documentation
   * - Fixing documentation errors
   * - Translating documentation
   *
   * @param userAddress - User's Ethereum wallet address
   * @param points - Number of points to award (must be positive)
   * @returns Promise that resolves when the update is complete
   * @throws Error if points is negative or if the API call fails
   */
  updateDocumentationActivity(userAddress: string, points: number): Promise<void> {
    return this.updateActivity('documentation', userAddress, points);
  }

  /**
   * Updates a user's forum activity score
   *
   * Awards points for forum participation such as:
   * - Creating helpful posts
   * - Answering questions
   * - Moderating content
   *
   * @param userAddress - User's Ethereum wallet address
   * @param points - Number of points to award (must be positive)
   * @returns Promise that resolves when the update is complete
   * @throws Error if points is negative or if the API call fails
   */
  updateForumActivity(userAddress: string, points: number): Promise<void> {
    return this.updateActivity('forum', userAddress, points);
  }

  /**
   * Updates a user's support volunteer score
   *
   * Awards points for support activities such as:
   * - Helping users with issues
   * - Providing technical support
   * - Community assistance
   *
   * @param userAddress - User's Ethereum wallet address
   * @param points - Number of points to award (must be positive)
   * @returns Promise that resolves when the update is complete
   * @throws Error if points is negative or if the API call fails
   */
  updateSupportActivity(userAddress: string, points: number): Promise<void> {
    return this.updateActivity('support', userAddress, points);
  }

  /**
   * Alias for updateSupportActivity for backward compatibility
   *
   * @deprecated Use updateSupportActivity instead
   * @param userAddress - User's Ethereum wallet address
   * @param points - Number of points to award (must be positive)
   * @returns Promise that resolves when the update is complete
   * @throws Error if points is negative or if the API call fails
   */
  updateSupportScore(userAddress: string, points: number): Promise<void> {
    return this.updateSupportActivity(userAddress, points);
  }

  /**
   * Gets user data including participation scores
   *
   * @param userAddress - User's Ethereum wallet address
   * @returns Promise resolving to user data with totalScore
   */
  async getUserData(userAddress: string): Promise<{ userId: string; totalScore: number }> {
    const scores = await this.getUserScore(userAddress);
    return {
      userId: userAddress,
      totalScore: scores.total,
    };
  }

  /**
   * Gets user participation data for forum moderation
   *
   * @param userAddress - User's Ethereum wallet address
   * @returns Promise resolving to user participation data or null if not found
   */
  async getScore(userAddress: string): Promise<UserParticipationData | null> {
    try {
      const scores = await this.getUserScore(userAddress);
      return {
        userId: userAddress,
        totalScore: scores.total,
        breakdown: scores,
      };
    } catch (error) {
      logger.error('Failed to get participation data', {
        userAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Gets a user's total participation score and breakdown
   *
   * Retrieves the user's participation scores across all categories:
   * - Documentation contributions
   * - Forum participation
   * - Support volunteer work
   *
   * @param userAddress - User's Ethereum wallet address
   * @returns Promise resolving to user's score breakdown
   * @throws Error if the API call fails
   */
  async getUserScore(userAddress: string): Promise<UserScoreBreakdown> {
    try {
      this.validateAddress(userAddress);

      // In production, this would fetch from the validator API
      // For now, log and return default data
      logger.info('Getting user participation score', { userAddress });

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 0));

      return {
        total: 0,
        documentation: 0,
        forum: 0,
        support: 0,
      };
    } catch (error) {
      logger.error('Failed to get user score', {
        userAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        total: 0,
        documentation: 0,
        forum: 0,
        support: 0,
      };
    }
  }

  /**
   * Updates activity score for a specific category
   *
   * @private
   * @param category - Activity category (documentation, forum, support)
   * @param userAddress - User's Ethereum wallet address
   * @param points - Number of points to award
   * @returns Promise that resolves when update is complete
   * @throws Error if validation fails or API call fails
   */
  private async updateActivity(
    category: 'documentation' | 'forum' | 'support',
    userAddress: string,
    points: number,
  ): Promise<void> {
    try {
      this.validateAddress(userAddress);
      this.validatePoints(points);

      // In production, this would make an API call to the validator
      // For now, log the activity
      logger.info(`${category} activity points awarded`, {
        category,
        userAddress,
        points,
      });

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 0));
    } catch (error) {
      logger.error(`Failed to update ${category} activity`, {
        category,
        userAddress,
        points,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Validates Ethereum address format
   *
   * @private
   * @param address - Address to validate
   * @throws Error if address is invalid
   */
  private validateAddress(address: string): void {
    if (address === '' || address === null || address === undefined) {
      throw new Error('Address is required');
    }

    // Basic Ethereum address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new Error('Invalid Ethereum address format');
    }
  }

  /**
   * Validates points value
   *
   * @private
   * @param points - Points to validate
   * @throws Error if points value is invalid
   */
  private validatePoints(points: number): void {
    if (typeof points !== 'number' || isNaN(points)) {
      throw new Error('Points must be a valid number');
    }

    if (points < 0) {
      throw new Error('Points cannot be negative');
    }

    if (!Number.isFinite(points)) {
      throw new Error('Points must be a finite number');
    }
  }
}
