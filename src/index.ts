/**
 * OmniBazaar Documents Module
 *
 * Main entry point for the Documents module, providing documentation,
 * forum, and support services for the OmniBazaar ecosystem.
 *
 * @module DocumentsModule
 */

/**
 * Re-export specific services to avoid duplicate exports
 * @see {@link module:services}
 */
export {
  Database,
  type DatabaseConfig,
  DirectServiceCaller,
  DocumentationService,
  DocumentationConsensus,
  P2PForumService,
  VolunteerSupportService,
  ParticipationScoreService,
  SearchEngine,
  ValidationService,
  type DocumentServicesConfig,
  type DocumentServices,
  initializeDocumentServices
} from './services';

/**
 * Re-export all integration utilities
 * @see {@link module:integration}
 */
export * from './integration';

/**
 * Re-export documentation types
 */
export type {
  DocumentMetadata,
  Document,
  DocumentCategory,
  DocumentLanguage,
  DocumentSearchParams,
  DocumentAttachment,
} from './services/documentation/DocumentationService';

/**
 * Re-export forum types
 */
export type {
  ForumCategory,
  ForumThread,
  ForumPost,
  CreateThreadRequest,
  CreatePostRequest,
  ForumSearchOptions,
  ForumSearchResult,
  ForumStats,
  ForumVote,
  ForumModeration,
  ForumReputation,
  ForumBadge,
} from './services/forum/ForumTypes';

/**
 * Re-export support types
 */
export type {
  SupportCategory,
  SupportPriority,
  SupportRequest,
  SupportSession,
  SupportVolunteer,
  ChatMessage,
  SupportSessionStatus,
  SupportSystemStats,
} from './services/support/SupportTypes';

/**
 * Logger utility for consistent logging across the module
 * @see {@link logger}
 */
export { logger } from './utils/logger';

/**
 * Module metadata information
 * @constant
 */
export const MODULE_INFO = {
  name: '@omnibazaar/documents',
  version: '1.0.0',
  description: 'Documentation, Forum, and Support services for OmniBazaar',
  capabilities: {
    documentation: true,
    forum: true,
    support: true,
    consensus: true,
    search: true,
  },
};

/**
 * Export new direct integration components
 */
export { LazyServiceLoader } from './services/LazyServiceLoader';
export type { ServiceInitializer, ServiceRegistration } from './services/LazyServiceLoader';

// DirectServiceCaller is already exported from ./services
export type { QueryResult, ServiceResponse } from './services/DirectServiceCaller';

export { setupInternalRoutes } from './routes/internalRoutes';

export {
  initializeDocumentsModule,
  setupStaticServing,
  createTestServices
} from './initializeDocuments';
export type { DirectInitConfig } from './initializeDocuments';

/**
 * Export frontend API client
 * @see {@link module:frontend}
 */
export { DocumentsAPIClient } from './frontend/DocumentsAPIClient';
export * as frontend from './frontend';

/**
 * Quick start function for Validator integration
 *
 * @param config - Integration configuration
 * @param config.database - Database connection settings
 * @param config.database.host - Database host address
 * @param config.database.port - Database port number
 * @param config.database.database - Database name
 * @param config.database.user - Database username
 * @param config.database.password - Database password
 * @param config.validatorEndpoint - Optional validator endpoint URL
 * @param config.ports - Optional port configuration
 * @param config.ports.http - Optional HTTP server port
 * @param config.ports.websocket - Optional WebSocket server port
 * @returns Promise resolving to initialized ValidatorIntegration instance
 *
 * @example
 * ```typescript
 * import { startDocumentsModule } from '@omnibazaar/documents';
 *
 * const integration = await startDocumentsModule({
 *   database: {
 *     host: 'localhost',
 *     port: 5433,
 *     database: 'omnibazaar',
 *     user: 'omnibazaar',
 *     password: 'password'
 *   },
 *   validatorEndpoint: 'http://localhost:8080'
 * });
 *
 * // Use services
 * const services = integration.getServices();
 * ```
 */
export async function startDocumentsModule(config: {
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  validatorEndpoint?: string;
  ports?: {
    http?: number;
    websocket?: number;
  };
}): Promise<import('./integration').ValidatorIntegration> {
  const { ValidatorIntegration } = await import('./integration');

  const integration = new ValidatorIntegration(config);
  await integration.start();

  return integration;
}
