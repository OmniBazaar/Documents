/**
 * Validator Integration Example
 *
 * Demonstrates how the Validator module integrates with the Documents
 * module using the new direct service approach.
 *
 * @module examples/validator-integration
 */

import express from 'express';
import { initializeDocumentsModule, setupStaticServing } from '../src/initializeDocuments';
import { DirectValidatorIntegration } from '../src/integration/DirectValidatorIntegration';
import type { ValidatorServices, DocumentServices } from '../src/integration/DirectValidatorIntegration';

/**
 * Example Validator services (would come from actual Validator module)
 */
const mockValidatorServices: ValidatorServices = {
  database: {
    query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T> => {
      console.log('Database query:', sql, params);
      // Mock implementation
      return { rows: [], rowCount: 0 } as unknown as T;
    }
  },
  participationScore: {
    getUserScore: async (userId: string): Promise<number> => {
      console.log('Getting score for user:', userId);
      return 75; // Mock score
    },
    updateScore: async (userId: string, delta: number): Promise<void> => {
      console.log('Updating score for user:', userId, 'delta:', delta);
    }
  },
  blockchain: {
    getBlockHeight: async (): Promise<number> => {
      return 12345;
    },
    submitTransaction: async (tx: unknown): Promise<string> => {
      return '0x' + Math.random().toString(16).substr(2, 64);
    }
  },
  ipfs: {
    add: async (content: string | Buffer): Promise<string> => {
      return 'Qm' + Math.random().toString(36).substr(2, 46);
    },
    get: async (hash: string): Promise<Buffer> => {
      return Buffer.from('Mock IPFS content');
    }
  }
};

/**
 * Example of how the Validator would initialize the Documents module
 */
export async function initializeValidatorWithDocuments(): Promise<{
  app: express.Application;
  documentsLoader: import('../src/services/LazyServiceLoader').LazyServiceLoader;
  integration: DirectValidatorIntegration;
}> {
  console.log('Initializing Validator with Documents module...');

  // Create Express app
  const app = express();
  app.use(express.json());

  // Initialize Documents module with lazy loading
  const documentsLoader = await initializeDocumentsModule({
    validatorServices: mockValidatorServices,
    lazyLoading: true,
    app // This will set up internal routes
  });

  // Create direct integration wrapper
  const documentServices: DocumentServices = {
    documentation: await documentsLoader.get('documentation'),
    forum: await documentsLoader.get('forum'),
    support: await documentsLoader.get('support'),
    search: await documentsLoader.get('search'),
    participation: await documentsLoader.get('participation'),
    validation: await documentsLoader.get('validation')
  };

  const integration = new DirectValidatorIntegration(documentServices, {
    enableEventBridge: true,
    enableLazyLoading: true
  });

  // Inject validator services
  integration.setValidatorServices(mockValidatorServices);

  // Set up static asset serving
  setupStaticServing(app, 'dist/documents-webapp');

  // Set up event listeners
  integration.on('document:created', (doc) => {
    console.log('Document created:', doc.id, doc.title);
  });

  integration.on('forum:thread:created', (thread) => {
    console.log('Forum thread created:', thread.id, thread.title);
  });

  integration.on('support:request:created', (request) => {
    console.log('Support request created:', request.id);
  });

  integration.on('health:status', (status) => {
    console.log('Health status update:', status.healthy ? 'Healthy' : 'Unhealthy');
  });

  // Add validator-specific routes that use Documents services
  app.get('/validator/unified-search', async (req, res) => {
    try {
      const { query } = req.query;
      if (typeof query !== 'string') {
        res.status(400).json({ error: 'Query parameter required' });
        return;
      }

      const results = await integration.unifiedSearch(query);
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Search failed' });
    }
  });

  app.post('/validator/document-with-scoring', async (req, res) => {
    try {
      const { document, authorAddress } = req.body;
      const created = await integration.createDocumentWithScoring(document, authorAddress);
      res.json({ success: true, data: created });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Creation failed' });
    }
  });

  app.get('/validator/health', async (req, res) => {
    try {
      const healthy = await integration.performHealthCheck();
      const status = integration.getHealthStatus();
      res.json({ healthy, services: status });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Health check failed' });
    }
  });

  console.log('Validator initialized with Documents module');

  return { app, documentsLoader, integration };
}

/**
 * Example usage
 */
if (require.main === module) {
  initializeValidatorWithDocuments()
    .then(({ app }) => {
      const port = process.env.PORT || 3000;
      app.listen(port, () => {
        console.log(`Validator with Documents running on port ${port}`);
        console.log(`Documents UI: http://localhost:${port}/docs`);
        console.log(`Internal API: http://localhost:${port}/internal/*`);
        console.log(`Health check: http://localhost:${port}/validator/health`);
      });
    })
    .catch((error) => {
      console.error('Failed to initialize:', error);
      process.exit(1);
    });
}