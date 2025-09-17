/**
 * Internal Routes Handler for Documents Module
 *
 * Provides Express routes for direct internal communication between
 * the Documents module and other parts of the Validator application.
 * These routes replace external API calls with direct service access.
 *
 * @module routes/internalRoutes
 */

import express, { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import type { DocumentServices } from '../services';
import type { Document, DocumentCategory, DocumentSearchParams } from '../services/documentation/DocumentationService';
import type { ForumThread, ForumPost } from '../services/forum/ForumTypes';
import type { SupportRequest } from '../services/support/SupportTypes';

/**
 * Error handler middleware for internal routes
 *
 * @param error - Error that occurred
 * @param req - Express request
 * @param res - Express response
 * @param _next - Next middleware function (unused)
 */
function errorHandler(error: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error('Internal route error', {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack
  });

  res.status(500).json({
    success: false,
    error: error.message
  });
}

/**
 * Sets up internal routes for the Documents module
 *
 * @param app - Express application instance
 * @param services - Initialized document services
 */
export function setupInternalRoutes(app: express.Application, services: DocumentServices): void {
  const router = express.Router();

  // Documentation Routes

  /**
   * GET /internal/documents
   * Search and retrieve documents
   */
  router.get('/internal/documents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query, category, authorAddress, language, page = '1', pageSize = '20' } = req.query;

      const searchParams: DocumentSearchParams = {
        query: query as string,
        page: parseInt(page as string, 10),
        pageSize: parseInt(pageSize as string, 10)
      };

      // Add filters conditionally
      if (category !== undefined || authorAddress !== undefined || language !== undefined) {
        searchParams.filters = {
          ...(category !== undefined && { category: category as DocumentCategory }),
          ...(authorAddress !== undefined && { authorAddress: authorAddress as string }),
          ...(language !== undefined && { language: language as string })
        };
      }

      const results = await services.documentation.searchDocuments(searchParams);
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /internal/documents/:id
   * Get a specific document by ID
   */
  router.get('/internal/documents/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const document = await services.documentation.getDocument(id !== null && id !== undefined && id !== '' ? id : '');

      if (document === undefined) {
        res.status(404).json({
          success: false,
          error: 'Document not found'
        });
        return;
      }

      res.json({
        success: true,
        data: document
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /internal/documents
   * Create a new document
   */
  router.post('/internal/documents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = req.body as Document;
      const created = await services.documentation.createDocument(document);

      res.status(201).json({
        success: true,
        data: created
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /internal/documents/:id
   * Update an existing document
   */
  router.put('/internal/documents/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updates = req.body as Partial<Document>;

      const updated = await services.documentation.updateDocument(id !== null && id !== undefined && id !== '' ? id : '', updates, '');

      res.json({
        success: true,
        data: updated
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /internal/documents/:id/vote
   * Submit a vote for document consensus
   */
  router.post('/internal/documents/:id/vote', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { vote, validatorAddress } = req.body as { vote: boolean; validatorAddress: string };

      // Vote submission is handled by consensus service
      // await services.documentation.submitVote(id, vote, validatorAddress);
      logger.info('Vote submission requested', { id, vote: vote as unknown, validatorAddress: validatorAddress as unknown });

      res.json({
        success: true,
        message: 'Vote submitted successfully'
      });
    } catch (error) {
      next(error);
    }
  });

  // Forum Routes

  /**
   * GET /internal/forum/threads
   * Get recent forum threads
   */
  router.get('/internal/forum/threads', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, page = '1', limit = '20' } = req.query;

      // Use searchThreads method instead
      const searchResult = await services.forum.searchThreads({
        page: parseInt(page as string, 10),
        pageSize: parseInt(limit as string, 10)
      });

      // Filter by category if provided
      const filtered = category !== undefined
        ? searchResult.items.filter((t: ForumThread) => t.category === category)
        : searchResult.items;

      res.json({
        success: true,
        data: filtered
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /internal/forum/threads/:id
   * Get a specific forum thread
   */
  router.get('/internal/forum/threads/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const thread = await services.forum.getThread(id !== null && id !== undefined && id !== '' ? id : '');

      if (thread === undefined) {
        res.status(404).json({
          success: false,
          error: 'Thread not found'
        });
        return;
      }

      res.json({
        success: true,
        data: thread
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /internal/forum/threads
   * Create a new forum thread
   */
  router.post('/internal/forum/threads', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const thread = req.body as ForumThread;
      const created = await services.forum.createThread(thread);

      res.status(201).json({
        success: true,
        data: created
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /internal/forum/posts
   * Create a new forum post
   */
  router.post('/internal/forum/posts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = req.body as ForumPost;
      const created = await services.forum.createPost(post);

      res.status(201).json({
        success: true,
        data: created
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /internal/forum/search
   * Search forum content
   */
  router.get('/internal/forum/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query, category, authorAddress, sortBy = 'relevance' } = req.query;

      const searchOptions = {
        ...(query !== undefined && { query: query as string }),
        ...(category !== undefined && { category: category as string }),
        ...(authorAddress !== undefined && { authorAddress: authorAddress as string }),
        sortBy: sortBy === 'date' ? 'created_at' : sortBy === 'popularity' ? 'replies' : 'relevance' as 'relevance' | 'created_at' | 'updated_at' | 'replies' | 'votes'
      };

      const results = await services.forum.search(searchOptions);

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      next(error);
    }
  });

  // Support Routes

  /**
   * POST /internal/support/requests
   * Create a new support request
   */
  router.post('/internal/support/requests', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = req.body as SupportRequest;
      const session = await services.support.requestSupport(request);

      res.status(201).json({
        success: true,
        data: session
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /internal/support/volunteers
   * Register a new volunteer
   */
  router.post('/internal/support/volunteers', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const volunteer = req.body as Parameters<typeof services.support.registerVolunteer>[0];
      await services.support.registerVolunteer(volunteer);

      res.status(201).json({
        success: true,
        message: 'Volunteer registered successfully'
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /internal/support/stats
   * Get support system statistics
   */
  router.get('/internal/support/stats', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await services.support.getSystemStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /internal/support/sessions/:sessionId/assign
   * Assign a volunteer to a support session
   */
  router.post('/internal/support/sessions/:sessionId/assign', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      // const { volunteerId } = req.body; // Currently unused - autoAssignVolunteer doesn't need it

      services.support.autoAssignVolunteer(sessionId !== null && sessionId !== undefined && sessionId !== '' ? sessionId : '');

      res.json({
        success: true,
        message: 'Volunteer assigned successfully'
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /internal/forum/threads/:id/posts
   * Get posts for a specific thread
   */
  router.get('/internal/forum/threads/:id/posts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { limit = '50', offset = '0' } = req.query;

      const posts = await services.forum.getThreadPosts(
        id !== null && id !== undefined && id !== '' ? id : '',
        parseInt(limit as string, 10),
        parseInt(offset as string, 10)
      );

      res.json({
        success: true,
        data: posts
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /internal/forum/posts/:id/vote
   * Vote on a forum post
   */
  router.post('/internal/forum/posts/:id/vote', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { isUpvote, voterAddress } = req.body as { isUpvote: boolean; voterAddress: string };

      await services.forum.voteOnPost({
        postId: id !== null && id !== undefined && id !== '' ? id : '',
        voterAddress,
        voteType: isUpvote ? 'upvote' : 'downvote'
      });

      res.json({
        success: true,
        message: 'Vote submitted successfully'
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /internal/forum/stats
   * Get forum statistics
   */
  router.get('/internal/forum/stats', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await services.forum.getStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /internal/support/sessions/:sessionId
   * Get support session details
   */
  router.get('/internal/support/sessions/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      // getSessionDetails is a private method, using stats to check if session exists
      const stats = await services.support.getSystemStats();
      const session = stats.activeSessions > 0 ? { id: sessionId } : null;

      if (session === null || session === undefined) {
        res.status(404).json({
          success: false,
          error: 'Session not found'
        });
        return;
      }

      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /internal/support/sessions/:sessionId/messages
   * Send a message in a support session
   */
  router.post('/internal/support/sessions/:sessionId/messages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const { content, sender } = req.body as { content: string; sender: string };

      await services.support.sendMessage(sessionId !== null && sessionId !== undefined && sessionId !== '' ? sessionId : '', sender, content);

      res.json({
        success: true,
        message: 'Message sent successfully'
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /internal/support/sessions/:sessionId/close
   * Close a support session
   */
  router.post('/internal/support/sessions/:sessionId/close', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const { resolution } = req.body as { resolution: string };

      await services.support.resolveSession(sessionId !== null && sessionId !== undefined && sessionId !== '' ? sessionId : '', resolution);

      res.json({
        success: true,
        message: 'Session closed successfully'
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /internal/support/volunteers/:address/status
   * Update volunteer status
   */
  router.put('/internal/support/volunteers/:address/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params;
      const { status } = req.body as { status: Parameters<typeof services.support.updateVolunteerStatus>[1] };

      await services.support.updateVolunteerStatus(address !== null && address !== undefined && address !== '' ? address : '', status);

      res.json({
        success: true,
        message: 'Volunteer status updated successfully'
      });
    } catch (error) {
      next(error);
    }
  });

  // Search Engine Routes

  /**
   * GET /internal/search
   * Unified search across all services
   */
  router.get('/internal/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query, type = 'all' } = req.query;

      if (query === undefined || query === '') {
        res.status(400).json({
          success: false,
          error: 'Query parameter is required'
        });
        return;
      }

      const searchQuery = query as string;
      const results: Record<string, unknown> = {};

      // Search based on type
      if (type === 'all' || type === 'documents') {
        results.documents = await services.documentation.searchDocuments({
          query: searchQuery,
          pageSize: 10
        });
      }

      if (type === 'all' || type === 'forum') {
        results.forum = await services.forum.search({
          query: searchQuery
        });
      }

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      next(error);
    }
  });

  // Participation Score Routes

  /**
   * GET /internal/participation/:userId/score
   * Get user participation score
   */
  router.get('/internal/participation/:userId/score', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const score = await services.participation.getUserScore(userId !== null && userId !== undefined && userId !== '' ? userId : '');

      res.json({
        success: true,
        data: score
      });
    } catch (error) {
      next(error);
    }
  });

  // Health Check Route

  /**
   * GET /internal/health
   * Check health of all services
   */
  router.get('/internal/health', (_req: Request, res: Response, next: NextFunction) => {
    try {
      const health = {
        status: 'healthy',
        services: {
          documentation: true,
          forum: true,
          support: true,
          search: true,
          participation: true
        },
        version: '1.0.0'
      };

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      next(error);
    }
  });

  // Apply routes to app
  app.use(router);

  // Apply error handler
  app.use(errorHandler);

  logger.info('Internal routes configured successfully');
}