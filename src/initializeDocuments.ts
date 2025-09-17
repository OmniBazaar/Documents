/**
 * Documents Module Initialization
 *
 * Provides initialization functions for the Documents module in both
 * legacy API mode and new direct integration mode.
 *
 * @module initializeDocuments
 */

import express from 'express';
import { logger } from './utils/logger';
import { LazyServiceLoader } from './services/LazyServiceLoader';
import { DirectServiceCaller } from './services/DirectServiceCaller';
import { DirectServiceToDatabase } from './adapters/DirectServiceToDatabase';
import { setupInternalRoutes } from './routes/internalRoutes';
import type { ValidatorServices } from './integration/DirectValidatorIntegration';
import type { DocumentServices } from './services';
import type { Database } from './services/database/Database';

// Import service constructors
import { DocumentationService } from './services/documentation/DocumentationService';
import { P2PForumService } from './services/forum/P2PForumService';
import { VolunteerSupportService } from './services/support/VolunteerSupportService';
import { SearchEngine } from './services/search/SearchEngine';
import { ParticipationScoreService } from './services/participation/ParticipationScoreService';
import { ValidationService } from './services/validation/ValidationService';

/**
 * Direct initialization configuration
 */
export interface DirectInitConfig {
  /** Validator services for direct integration */
  validatorServices: ValidatorServices;
  /** Whether to enable lazy loading */
  lazyLoading?: boolean;
  /** Express app instance for routes */
  app?: express.Application;
}

/**
 * Initializes the Documents module for direct integration
 *
 * @param config - Initialization configuration
 * @returns Lazy service loader with registered services
 *
 * @example
 * ```typescript
 * const loader = await initializeDocumentsModule({
 *   validatorServices: {
 *     database: dbService,
 *     participationScore: scoreService
 *   },
 *   lazyLoading: true,
 *   app: expressApp
 * });
 *
 * // Services are loaded on demand
 * const docService = await loader.get<DocumentationService>('documentation');
 * ```
 */
export async function initializeDocumentsModule(config: DirectInitConfig): Promise<LazyServiceLoader> {
  logger.info('Initializing Documents module with direct integration');

  const loader = new LazyServiceLoader();
  const { validatorServices } = config;

  // Create direct service caller
  const serviceCaller = new DirectServiceCaller(validatorServices);

  // Create database adapter for services that need Database interface
  const dbAdapter = new DirectServiceToDatabase(serviceCaller);

  // Register search engine (no dependencies)
  loader.register('search', {
    initializer: () => {
      logger.debug('Initializing SearchEngine');
      return new SearchEngine('documents');
    },
    cache: true
  });

  // Register validation service (no dependencies)
  loader.register('validation', {
    initializer: () => {
      logger.debug('Initializing ValidationService');
      // ValidationService needs endpoint, using dummy endpoint for direct mode
      return new ValidationService('http://direct-mode');
    },
    cache: true
  });

  // Register participation service (uses validator's service)
  loader.register('participation', {
    initializer: () => {
      logger.debug('Using Validator ParticipationScoreService');
      // Return the validator's participation service directly
      return validatorServices.participationScore as unknown as ParticipationScoreService;
    },
    cache: true
  });

  // Register documentation service
  loader.register('documentation', {
    initializer: async () => {
      logger.debug('Initializing DocumentationService');
      const search = await loader.get<SearchEngine>('search');
      const participation = await loader.get<ParticipationScoreService>('participation');
      const validation = await loader.get<ValidationService>('validation');

      return new DocumentationService(
        dbAdapter as unknown as Database, // DirectServiceToDatabase provides Database-compatible interface
        search,
        participation,
        validation
      );
    },
    cache: true,
    dependencies: ['search', 'participation', 'validation']
  });

  // Register forum service
  loader.register('forum', {
    initializer: async () => {
      logger.debug('Initializing P2PForumService');
      const participation = await loader.get<ParticipationScoreService>('participation');

      const forum = new P2PForumService(
        dbAdapter as unknown as Database, // DirectServiceToDatabase provides Database-compatible interface
        participation
      );

      await forum.initialize();
      return forum;
    },
    cache: true,
    dependencies: ['participation'],
    hooks: {
      onDispose: () => {
        // Clean up forum resources if needed
        logger.debug('Disposing P2PForumService');
      }
    }
  });

  // Register support service
  loader.register('support', {
    initializer: async () => {
      logger.debug('Initializing VolunteerSupportService');
      const participation = await loader.get<ParticipationScoreService>('participation');

      const support = new VolunteerSupportService(
        dbAdapter as unknown as Database, // DirectServiceToDatabase provides Database-compatible interface
        participation
      );

      await support.initialize();
      return support;
    },
    cache: true,
    dependencies: ['participation'],
    hooks: {
      onDispose: () => {
        // Clean up support resources if needed
        logger.debug('Disposing VolunteerSupportService');
      }
    }
  });

  // Set up Express routes if app provided
  if (config.app !== undefined && config.app !== null) {
    logger.info('Setting up internal Express routes');

    // Create a wrapper to provide DocumentServices interface
    const servicesWrapper: DocumentServices = {
      documentation: await loader.get<DocumentationService>('documentation'),
      forum: await loader.get<P2PForumService>('forum'),
      support: await loader.get<VolunteerSupportService>('support'),
      search: await loader.get<SearchEngine>('search'),
      participation: await loader.get<ParticipationScoreService>('participation'),
      validation: await loader.get<ValidationService>('validation'),
      // Add other required services with lazy proxies
      serviceCaller, // Direct service caller for API operations
      // db is optional, and we're using DirectServiceToDatabase as a Database-compatible adapter
    };

    setupInternalRoutes(config.app, servicesWrapper);
  }

  logger.info('Documents module initialized successfully');
  return loader;
}

/**
 * Sets up static asset serving for the Documents UI
 *
 * @param app - Express application
 * @param staticPath - Path to static assets
 */
export function setupStaticServing(app: express.Application, staticPath: string = 'dist/webapp'): void {
  logger.info(`Setting up static serving from ${staticPath}`);

  // Serve Documents UI
  app.use('/docs', express.static(staticPath));

  // Serve UI mockups if available
  app.use('/docs/mockups', express.static('../UI Mockup'));

  // Fallback to index.html for SPA routing
  app.get('/docs/*', (_req, res) => {
    res.sendFile('index.html', { root: staticPath });
  });

  logger.info('Static serving configured');
}

/**
 * Creates a minimal service facade for testing
 *
 * @param validatorServices - Validator services
 * @returns Minimal document services for testing
 */
export async function createTestServices(validatorServices: ValidatorServices): Promise<DocumentServices> {
  const loader = await initializeDocumentsModule({
    validatorServices,
    lazyLoading: false
  });

  // Pre-load all services for testing
  await loader.preload([
    'documentation',
    'forum',
    'support',
    'search',
    'participation',
    'validation'
  ]);

  return {
    documentation: await loader.get<DocumentationService>('documentation'),
    forum: await loader.get<P2PForumService>('forum'),
    support: await loader.get<VolunteerSupportService>('support'),
    search: await loader.get<SearchEngine>('search'),
    participation: await loader.get<ParticipationScoreService>('participation'),
    validation: await loader.get<ValidationService>('validation')
  };
}