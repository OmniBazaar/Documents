/**
 * Real Validator Services for Testing
 *
 * Uses actual Validator module implementations instead of mocks
 * for true integration testing.
 *
 * @module tests/setup/realValidatorServices
 */

import { Database } from '../../../Validator/src/database/Database';
import { ParticipationScoreService } from '../../../Validator/src/services/ParticipationScoreService';
import type { ValidatorServices } from '../../src/integration/DirectValidatorIntegration';
import { logger } from '../../src/utils/logger';

/**
 * Test database configuration for YugabyteDB
 * Using configuration from Validator's test-db-setup.ts
 */
const TEST_DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.1.1',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'yugabyte', // Use YugabyteDB default database
  user: process.env.DB_USER || 'yugabyte',
  password: process.env.DB_PASSWORD || 'yugabyte',
  ssl: false,
  maxConnections: 5, // Smaller pool for tests
  idleTimeout: 10000,
  connectionTimeout: 5000
};

/**
 * Creates real validator services for testing
 *
 * @returns Real validator services using YugabyteDB
 */
export async function createRealValidatorServices(): Promise<ValidatorServices> {
  logger.info('Creating real validator services for testing');

  // Create real database instance
  const database = new Database(TEST_DB_CONFIG);

  try {
    // The Database constructor initializes the pool, so we can use it directly
    // Test the connection with a simple query
    await database.query('SELECT NOW()');

    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error('Failed to connect to test database:', error);
    logger.info('Ensure YugabyteDB is running at 127.0.1.1:5433');
    logger.info('You can start it with: cd ~/OmniBazaar/Validator && npm run yugabyte:start');
    throw error;
  }

  // Create real participation score service
  // The ParticipationScoreService requires additional services, so we'll create a minimal version
  const participationScore = {
    getUserScore: async (userId: string): Promise<number> => {
      try {
        const result = await database.query<{ total_score: number }>(
          'SELECT total_score FROM participation_scores WHERE user_address = $1',
          [userId]
        );
        return result.rows[0]?.total_score ?? 50; // Default score
      } catch (error) {
        logger.warn('Error getting participation score, using default', { error });
        return 50;
      }
    },

    updateScore: async (userId: string, delta: number): Promise<void> => {
      // Ensure we have a valid user ID
      if (!userId) {
        logger.warn('updateScore called with null/undefined userId');
        return;
      }

      // Round delta to integer as the database expects integer values
      const intDelta = Math.round(delta);

      try {
        await database.query(
          `INSERT INTO participation_scores (user_address, total_score)
           VALUES ($1, $2)
           ON CONFLICT (user_address)
           DO UPDATE SET total_score = participation_scores.total_score + $3`,
          [userId, 50 + intDelta, intDelta]
        );
      } catch (error) {
        logger.error('Error updating participation score', { error });
      }
    },

    // Additional methods needed by services
    getUserData: async (userId: string): Promise<{ totalScore: number }> => {
      const score = await participationScore.getUserScore(userId);
      return { totalScore: score };
    },

    updateDocumentationActivity: async (userId: string, points: number): Promise<void> => {
      // Ensure we have a valid user ID
      if (!userId) {
        logger.warn('updateDocumentationActivity called with null/undefined userId');
        return;
      }
      await participationScore.updateScore(userId, Math.round(points));
    },

    updateForumActivity: async (userId: string, points: number): Promise<void> => {
      // Ensure we have a valid user ID
      if (!userId) {
        logger.warn('updateForumActivity called with null/undefined userId');
        return;
      }
      await participationScore.updateScore(userId, Math.round(points));
    },

    updateSupportActivity: async (userId: string, points: number): Promise<void> => {
      // Ensure we have a valid user ID
      if (!userId) {
        logger.warn('updateSupportActivity called with null/undefined userId');
        return;
      }
      await participationScore.updateScore(userId, Math.round(points));
    }
  };

  return {
    database,
    participationScore
  };
}

/**
 * Initializes test database schema
 *
 * Creates necessary tables for testing if they don't exist
 */
export async function initializeTestDatabase(db: Database): Promise<void> {
  logger.info('Initializing test database schema');

  // Create participation scores table
  await db.query(`
    CREATE TABLE IF NOT EXISTS participation_scores (
      user_address VARCHAR(42) PRIMARY KEY,
      total_score INTEGER DEFAULT 50,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create documents table
  await db.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      content TEXT NOT NULL,
      category VARCHAR(50) NOT NULL,
      language VARCHAR(10) DEFAULT 'en',
      version INTEGER DEFAULT 1,
      author_address VARCHAR(42) NOT NULL,
      tags TEXT[],
      is_official BOOLEAN DEFAULT false,
      status VARCHAR(20) DEFAULT 'draft',
      metadata JSONB DEFAULT '{}',
      search_vector tsvector,
      view_count INTEGER DEFAULT 0,
      rating DECIMAL(3,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create forum threads table
  await db.query(`
    CREATE TABLE IF NOT EXISTS forum_threads (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      category VARCHAR(50) DEFAULT 'general',
      author_address VARCHAR(42) NOT NULL,
      tags TEXT[],
      status VARCHAR(20) DEFAULT 'active',
      reply_count INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      upvotes INTEGER DEFAULT 0,
      downvotes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create forum posts table
  await db.query(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id VARCHAR(36) PRIMARY KEY,
      thread_id VARCHAR(36) NOT NULL REFERENCES forum_threads(id),
      content TEXT NOT NULL,
      author_address VARCHAR(42) NOT NULL,
      reply_to_id VARCHAR(36),
      upvotes INTEGER DEFAULT 0,
      downvotes INTEGER DEFAULT 0,
      is_answer BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create support tables
  await db.query(`
    CREATE TABLE IF NOT EXISTS support_requests (
      id VARCHAR(36) PRIMARY KEY,
      user_address VARCHAR(42) NOT NULL,
      category VARCHAR(50) NOT NULL,
      priority VARCHAR(20) DEFAULT 'normal',
      status VARCHAR(20) DEFAULT 'waiting',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS support_sessions (
      id VARCHAR(36) PRIMARY KEY,
      session_id VARCHAR(50) UNIQUE NOT NULL,
      user_address VARCHAR(42) NOT NULL,
      volunteer_address VARCHAR(42),
      status VARCHAR(20) DEFAULT 'waiting',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS volunteers (
      volunteer_address VARCHAR(42) PRIMARY KEY,
      expertise TEXT[],
      languages TEXT[],
      hours_per_week INTEGER DEFAULT 0,
      experience_level VARCHAR(20),
      status VARCHAR(20) DEFAULT 'active',
      total_sessions INTEGER DEFAULT 0,
      total_minutes INTEGER DEFAULT 0,
      average_rating DECIMAL(3,2) DEFAULT 5.0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create document versions table
  await db.query(`
    CREATE TABLE IF NOT EXISTS document_versions (
      id SERIAL PRIMARY KEY,
      document_id VARCHAR(36) NOT NULL,
      version INTEGER NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      editor_address VARCHAR(42) NOT NULL,
      change_description TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  logger.info('Test database schema initialized');
}

/**
 * Cleans test data from all tables
 */
export async function cleanTestDatabase(db: Database): Promise<void> {
  logger.info('Cleaning test database');

  await db.query('DELETE FROM forum_posts');
  await db.query('DELETE FROM forum_threads');
  await db.query('DELETE FROM document_versions');
  await db.query('DELETE FROM documents');
  await db.query('DELETE FROM support_sessions');
  await db.query('DELETE FROM support_requests');
  await db.query('DELETE FROM volunteers');
  await db.query('DELETE FROM participation_scores');

  logger.info('Test database cleaned');
}

/**
 * Closes database connection
 */
export async function closeTestDatabase(db: Database): Promise<void> {
  await db.disconnect();
  logger.info('Test database connection closed');
}