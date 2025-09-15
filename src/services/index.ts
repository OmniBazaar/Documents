/**
 * Documents Module Services
 *
 * Central export point for all services in the Documents module
 *
 * @module Services
 */

// Import types needed for the helper functions
import type { Database, DatabaseConfig } from './database/Database';
import type { DocumentationService } from './documentation/DocumentationService';
import type { P2PForumService } from './forum/P2PForumService';
import type { VolunteerSupportService } from './support/VolunteerSupportService';
import type { ParticipationScoreService } from './participation/ParticipationScoreService';
import type { SearchEngine } from './search/SearchEngine';
import type { ValidationService } from './validation/ValidationService';
import type { ValidatorAPIClient } from './validator/ValidatorAPIClientGraphQL';

// Re-export all services

/**
 * Database service for YugabyteDB connections (deprecated - use ValidatorAPIClient)
 * @deprecated Use {@link ValidatorAPIClient} instead
 * @see {@link Database}
 */
export { Database, type DatabaseConfig } from './database/Database';

/**
 * Validator API client for all data operations
 * @see {@link ValidatorAPIClient}
 */
export { ValidatorAPIClient } from './validator/ValidatorAPIClientGraphQL';
export type { ValidatorAPIConfig } from './validator/ValidatorAPIClientGraphQL';

/**
 * Documentation service for managing and versioning documentation
 * @see {@link DocumentationService}
 */
export { DocumentationService } from './documentation/DocumentationService';

/**
 * Documentation consensus service for distributed documentation agreement
 * @see {@link DocumentationConsensus}
 */
export { DocumentationConsensus } from './documentation/DocumentationConsensus';

/**
 * Export all documentation-related types and interfaces
 */
export * from './documentation';

/**
 * P2P forum service for decentralized discussions
 * @see {@link P2PForumService}
 */
export { P2PForumService } from './forum/P2PForumService';

/**
 * Forum consensus service for thread and post agreement
 * @see {@link ForumConsensus}
 */
export { ForumConsensus } from './forum/ForumConsensus';

/**
 * Forum incentives service for participation rewards
 * @see {@link ForumIncentives}
 */
export { ForumIncentives } from './forum/ForumIncentives';

/**
 * Forum moderation service for content management
 * @see {@link ForumModerationService}
 */
export { ForumModerationService } from './forum/ForumModerationService';

/**
 * Export all forum-related types and interfaces
 */
export * from './forum';

/**
 * Volunteer support service for community assistance
 * @see {@link VolunteerSupportService}
 */
export { VolunteerSupportService } from './support/VolunteerSupportService';

/**
 * Support routing service for efficient request distribution
 * @see {@link SupportRouter}
 */
export { SupportRouter } from './support/SupportRouter';

/**
 * Export all support-related types and interfaces
 */
export * from './support';

/**
 * Participation score service for tracking user contributions
 * @see {@link ParticipationScoreService}
 */
export { ParticipationScoreService } from './participation/ParticipationScoreService';

/**
 * Search engine service for full-text documentation search
 * @see {@link SearchEngine}
 */
export { SearchEngine } from './search/SearchEngine';

/**
 * Validation service for content and data validation
 * @see {@link ValidationService}
 */
export { ValidationService } from './validation/ValidationService';

/**
 * Legacy documents service (deprecated - use DocumentationService)
 * @deprecated Use {@link DocumentationService} instead
 * @see {@link DocumentsService}
 */
export { DocumentsService } from './DocumentsService';

/**
 * Legacy forum service (deprecated - use P2PForumService)
 * @deprecated Use {@link P2PForumService} instead
 * @see {@link ForumService}
 */
export { ForumService } from './ForumService';

/**
 * Service initialization helpers
 */

/**
 * Configuration for initializing document services
 */
export interface DocumentServicesConfig {
  /** Validator API endpoint */
  validatorEndpoint: string;
  /** Optional WebSocket endpoint for subscriptions */
  validatorWsEndpoint?: string;
  /** Optional cache configuration */
  cache?: {
    /** Cache size limit */
    size?: number;
    /** Cache time-to-live in seconds */
    ttl?: number;
  };
  /**
   * Database configuration (use validatorEndpoint instead)
   * @deprecated Use validatorEndpoint for API-based communication
   */
  database?: DatabaseConfig;
}

/**
 * Initialized document services
 */
export interface DocumentServices {
  /** Validator API client instance */
  apiClient: ValidatorAPIClient;
  /** Documentation service instance */
  documentation: DocumentationService;
  /** Forum service instance */
  forum: P2PForumService;
  /** Support service instance */
  support: VolunteerSupportService;
  /** Search engine instance */
  search: SearchEngine;
  /** Participation score service instance */
  participation: ParticipationScoreService;
  /** Validation service instance */
  validation: ValidationService;
  /**
   * Database instance (use apiClient instead)
   * @deprecated Use apiClient for API-based communication
   */
  db?: Database;
}

/**
 * Initializes all core services for the Documents module
 *
 * @param config - Configuration object
 * @param config.database - Database configuration
 * @param config.cache - Cache configuration
 * @param config.cache.size - Cache size limit
 * @param config.cache.ttl - Cache time-to-live in seconds
 * @returns Initialized services
 *
 * @example
 * ```typescript
 * const services = await initializeDocumentServices({
 *   database: {
 *     host: 'localhost',
 *     port: 5432,
 *     database: 'documents',
 *     user: 'user',
 *     password: 'password'
 *   },
 *   cache: { size: 1000, ttl: 3600 }
 * });
 * ```
 */
export async function initializeDocumentServices(
  config: DocumentServicesConfig,
): Promise<DocumentServices> {
  // Dynamically import constructors to avoid circular dependencies
  const { ValidatorAPIClient } = await import('./validator/ValidatorAPIClientGraphQL');
  const { Database } = await import('./database/Database');
  const { DocumentationService } = await import('./documentation/DocumentationService');
  const { P2PForumService } = await import('./forum/P2PForumService');
  const { VolunteerSupportService } = await import('./support/VolunteerSupportService');
  const { ParticipationScoreService } = await import('./participation/ParticipationScoreService');
  const { SearchEngine } = await import('./search/SearchEngine');
  const { ValidationService } = await import('./validation/ValidationService');

  // Initialize API client
  const validatorEndpoint = config.validatorEndpoint !== undefined && config.validatorEndpoint !== '' ? config.validatorEndpoint : 'http://localhost:4000';
  const apiClient = new ValidatorAPIClient({
    endpoint: validatorEndpoint,
    wsEndpoint: config.validatorWsEndpoint !== undefined && config.validatorWsEndpoint !== ''
      ? config.validatorWsEndpoint
      : (config.validatorEndpoint !== undefined && config.validatorEndpoint !== '' ? config.validatorEndpoint.replace('http', 'ws') : 'ws://localhost:4000')
  });

  // Initialize database (create a dummy instance if not provided for backward compatibility)
  const db = config.database !== undefined && config.database !== null
    ? new Database(config.database)
    : new Database({
        host: 'localhost',
        port: 5432,
        database: 'documents_dummy',
        user: 'dummy',
        password: 'dummy'
      });

  // Initialize core services
  const validatorApiEndpoint: string = process.env.VALIDATOR_API_ENDPOINT ?? 'http://localhost:8080';
  const participation: ParticipationScoreService = new ParticipationScoreService(validatorApiEndpoint);
  const search: SearchEngine = new SearchEngine('documents');
  const validation: ValidationService = new ValidationService(validatorApiEndpoint);

  // Initialize documentation service
  const documentation: DocumentationService = new DocumentationService(
    db,
    search,
    participation,
    validation,
  );

  // Initialize forum service
  const forum: P2PForumService = new P2PForumService(db, participation);
  await forum.initialize();

  // Initialize support service
  const support: VolunteerSupportService = new VolunteerSupportService(db, participation);
  await support.initialize();

  return {
    apiClient,
    db,
    documentation,
    forum,
    support,
    search,
    participation,
    validation,
  };
}

/**
 * Health check status for a service
 */
export interface ServiceHealthStatus {
  /** Whether the service is healthy */
  healthy: boolean;
  /** Optional message about the service status */
  message?: string;
}

/**
 * Health check result for all services
 */
export interface ServicesHealthResult {
  /** Overall health status */
  healthy: boolean;
  /** Individual service health statuses */
  services: Record<string, ServiceHealthStatus>;
}

/**
 * Services to check for health status
 */
export interface ServicesToCheck {
  /** Optional database service instance */
  db?: Database;
  /** Optional documentation service instance */
  documentation?: DocumentationService;
  /** Optional forum service instance */
  forum?: P2PForumService;
  /** Optional support service instance */
  support?: VolunteerSupportService;
}

/**
 * Service health check
 *
 * @param services - Services to check
 * @param services.db - Database service instance
 * @param services.documentation - Documentation service instance
 * @param services.forum - Forum service instance
 * @param services.support - Support service instance
 * @returns Health status for all services
 *
 * @example
 * ```typescript
 * const health = await checkServicesHealth({
 *   db: services.db,
 *   forum: services.forum
 * });
 * console.log('Services healthy:', health.healthy);
 * ```
 */
export async function checkServicesHealth(
  services: ServicesToCheck,
): Promise<ServicesHealthResult> {
  const healthChecks: Record<string, ServiceHealthStatus> = {};

  // Check database
  if (services.db !== undefined) {
    try {
      await services.db.query<{ result: number }>('SELECT 1');
      healthChecks.database = { healthy: true };
    } catch (error) {
      healthChecks.database = {
        healthy: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Check documentation service
  if (services.documentation !== undefined) {
    try {
      // Documentation service doesn't have getStats, so we'll use search to check health
      await services.documentation.searchDocuments({
        query: '',
        pageSize: 1,
      });
      healthChecks.documentation = {
        healthy: true,
        message: 'Service operational',
      };
    } catch (error) {
      healthChecks.documentation = {
        healthy: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Check forum service
  if (services.forum !== undefined) {
    try {
      const stats = await services.forum.getStats();
      healthChecks.forum = {
        healthy: true,
        message: `${stats.totalThreads} threads, ${stats.totalPosts} posts`,
      };
    } catch (error) {
      healthChecks.forum = {
        healthy: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Check support service
  if (services.support !== undefined) {
    try {
      const stats = await services.support.getSystemStats();
      healthChecks.support = {
        healthy: true,
        message: `${stats.activeVolunteers} volunteers, ${stats.activeSessions} active sessions`,
      };
    } catch (error) {
      healthChecks.support = {
        healthy: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const allHealthy = Object.values(healthChecks).every(check => check.healthy);

  return {
    healthy: allHealthy,
    services: healthChecks,
  };
}

/**
 * Documents module version
 * Current semantic version of the Documents module
 */
export const DOCUMENTS_MODULE_VERSION = '1.0.0';

/**
 * Module capabilities interface
 */
export interface ModuleCapabilities {
  /** Documentation module capabilities */
  documentation: {
    /** Supports multiple languages */
    multilingual: boolean;
    /** Supports document versioning */
    versioning: boolean;
    /** Supports consensus validation */
    consensus: boolean;
    /** Supports full-text search */
    search: boolean;
    /** Supports IPFS integration */
    ipfsIntegration: boolean;
  };
  /** Forum module capabilities */
  forum: {
    /** Supports threaded discussions */
    threading: boolean;
    /** Supports voting on posts */
    voting: boolean;
    /** Supports content moderation */
    moderation: boolean;
    /** Supports spam detection */
    spam_detection: boolean;
    /** Supports proof-of-participation integration */
    pop_integration: boolean;
  };
  /** Support module capabilities */
  support: {
    /** Supports volunteer chat system */
    volunteer_chat: boolean;
    /** Supports intelligent routing */
    routing: boolean;
    /** Supports quality metrics tracking */
    quality_metrics: boolean;
    /** Supports proof-of-participation rewards */
    pop_rewards: boolean;
    /** Supports AI assistance (future feature) */
    ai_assistance: boolean;
  };
}

/**
 * Module capabilities
 * Defines the current capabilities of the Documents module
 */
export const MODULE_CAPABILITIES: ModuleCapabilities = {
  documentation: {
    multilingual: true,
    versioning: true,
    consensus: true,
    search: true,
    ipfsIntegration: true,
  },
  forum: {
    threading: true,
    voting: true,
    moderation: true,
    spam_detection: true,
    pop_integration: true,
  },
  support: {
    volunteer_chat: true, // Now implemented!
    routing: true,
    quality_metrics: true,
    pop_rewards: true,
    ai_assistance: false, // Future feature
  },
};
