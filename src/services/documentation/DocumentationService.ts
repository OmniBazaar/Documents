/**
 * Documentation Service
 * 
 * Manages decentralized documentation storage and retrieval using YugabyteDB.
 * Provides version control, multi-language support, and search functionality.
 * Integrates with the validator consensus system for official documentation updates.
 * 
 * @module DocumentationService
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { Database } from '../database/Database';
import { ParticipationScoreService } from '../participation/ParticipationScoreService';
import { SearchEngine } from '../search/SearchEngine';
import { ValidationService } from '../validation/ValidationService';

/**
 * Supported documentation languages
 */
export const SUPPORTED_LANGUAGES = ['en', 'es', 'zh', 'fr', 'de', 'ja', 'ko', 'ru'] as const;

/**
 * Documentation language type
 */
export type DocumentLanguage = typeof SUPPORTED_LANGUAGES[number];

/**
 * Documentation categories for organization
 */
export enum DocumentCategory {
  /** Getting started guides for new users */
  GETTING_STARTED = 'getting_started',
  /** Wallet-related documentation */
  WALLET = 'wallet',
  /** Marketplace usage guides */
  MARKETPLACE = 'marketplace',
  /** DEX trading documentation */
  DEX = 'dex',
  /** Technical documentation for developers */
  TECHNICAL = 'technical',
  /** Frequently asked questions */
  FAQ = 'faq',
  /** Governance and DAO documentation */
  GOVERNANCE = 'governance',
  /** Security best practices */
  SECURITY = 'security'
}

/**
 * Document metadata structure
 */
export interface DocumentMetadata {
  /** Unique document identifier */
  id: string;
  /** Document title */
  title: string;
  /** Brief description of the document */
  description: string;
  /** Document category */
  category: DocumentCategory;
  /** Document language */
  language: DocumentLanguage;
  /** Current version number */
  version: number;
  /** Author's wallet address */
  authorAddress: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Tags for search optimization */
  tags: string[];
  /** Whether this is official documentation */
  isOfficial: boolean;
  /** Number of views */
  viewCount: number;
  /** Average rating (1-5 stars) */
  rating: number;
}

/**
 * Full document structure including content
 */
export interface Document extends DocumentMetadata {
  /** Document content in Markdown format */
  content: string;
  /** Search vector for full-text search */
  searchVector?: string;
  /** Media attachments (IPFS CIDs for files > 10MB) */
  attachments?: DocumentAttachment[];
}

/**
 * Media attachment structure
 */
export interface DocumentAttachment {
  /** Attachment filename */
  filename: string;
  /** MIME type of the attachment */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** IPFS CID for large files */
  ipfsCid?: string;
  /** Direct URL for small files */
  url?: string;
}

/**
 * Document contribution submission
 */
export interface DocumentContribution {
  /** Document ID if updating existing */
  documentId?: string;
  /** Contribution title */
  title: string;
  /** Document content */
  content: string;
  /** Target category */
  category: DocumentCategory;
  /** Document language */
  language: DocumentLanguage;
  /** Search tags */
  tags: string[];
  /** Contributor's wallet address */
  contributorAddress: string;
  /** Description of changes */
  changeDescription?: string;
}

/**
 * Database row type for documents table
 */
interface DocumentRow {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  language: string;
  version: number;
  author_address: string;
  created_at: Date | string;
  updated_at: Date | string;
  tags: string;
  is_official: boolean;
  view_count: number;
  rating: string | number;
  attachments?: string;
}

/**
 * Document search parameters
 */
export interface DocumentSearchParams {
  /** Search query text */
  query?: string;
  /** Filter by category */
  category?: DocumentCategory;
  /** Filter by language */
  language?: DocumentLanguage;
  /** Filter by tags */
  tags?: string[];
  /** Include only official docs */
  officialOnly?: boolean;
  /** Minimum rating filter */
  minRating?: number;
  /** Page number for pagination */
  page?: number;
  /** Results per page */
  pageSize?: number;
  /** Sort field */
  sortBy?: 'relevance' | 'date' | 'rating' | 'views';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Document update proposal for consensus
 */
export interface DocumentUpdateProposal {
  /** Unique proposal ID */
  proposalId: string;
  /** Document being updated */
  documentId: string;
  /** Proposed new content */
  newContent: string;
  /** Proposed new metadata */
  newMetadata: Partial<DocumentMetadata>;
  /** Proposer's wallet address */
  proposerAddress: string;
  /** Validator votes */
  votes: {
    /** Votes in favor */
    yes: number;
    /** Votes against */
    no: number;
    /** Abstentions */
    abstain: number;
  };
  /** Proposal status */
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  /** Creation timestamp */
  createdAt: Date;
  /** Expiration timestamp */
  expiresAt: Date;
}

/**
 * Service for managing decentralized documentation
 */
export class DocumentationService extends EventEmitter {
  /** Database connection instance */
  private db: Database;
  /** Search engine instance */
  private searchEngine: SearchEngine;
  /** Participation scoring service */
  private participationService: ParticipationScoreService;
  /** Validation service for consensus */
  private validationService: ValidationService;
  /** Cache for frequently accessed documents */
  private documentCache: Map<string, Document>;
  /** Cache TTL in milliseconds */
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Creates a new DocumentationService instance
   * @param db - Database connection
   * @param searchEngine - Search engine instance
   * @param participationService - Participation scoring service
   * @param validationService - Validation service for consensus
   */
  constructor(
    db: Database,
    searchEngine: SearchEngine,
    participationService: ParticipationScoreService,
    validationService: ValidationService
  ) {
    super();
    this.db = db;
    this.searchEngine = searchEngine;
    this.participationService = participationService;
    this.validationService = validationService;
    this.documentCache = new Map();
    
    // Clear cache periodically
    setInterval(() => this.clearExpiredCache(), this.CACHE_TTL);
  }

  /**
   * Creates a new document
   * @param document - Document data
   * @returns Created document with ID
   * @throws {Error} If document creation fails
   */
  async createDocument(document: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'viewCount' | 'rating'>): Promise<Document> {
    try {
      const id = this.generateDocumentId();
      const now = new Date();
      
      const newDocument: Document = {
        ...document,
        id,
        createdAt: now,
        updatedAt: now,
        viewCount: 0,
        rating: 0,
        version: 1
      };

      // Store in database
      await this.db.query(
        `INSERT INTO documents (
          id, title, description, content, category, language, version,
          author_address, tags, is_official, search_vector
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, to_tsvector('english', $11))`,
        [
          newDocument.id,
          newDocument.title,
          newDocument.description,
          newDocument.content,
          newDocument.category,
          newDocument.language,
          newDocument.version,
          newDocument.authorAddress,
          JSON.stringify(newDocument.tags),
          newDocument.isOfficial,
          `${newDocument.title} ${newDocument.description} ${newDocument.content}`
        ]
      );

      // Index in search engine
      this.searchEngine.indexDocument({
        id: newDocument.id,
        type: 'documentation',
        title: newDocument.title,
        content: newDocument.content,
        metadata: {
          category: newDocument.category,
          language: newDocument.language,
          tags: newDocument.tags
        }
      });

      // Award PoP points for contribution
      await this.awardContributionPoints(newDocument.authorAddress, 'create', newDocument);

      this.emit('documentCreated', newDocument);
      logger.info(`Document created: ${newDocument.id}`);
      
      return newDocument;
    } catch (error) {
      logger.error('Failed to create document:', error);
      throw new Error('Document creation failed');
    }
  }

  /**
   * Retrieves a document by ID
   * @param documentId - Document identifier
   * @param incrementViews - Whether to increment view count
   * @returns Document if found, null otherwise
   */
  async getDocument(documentId: string, incrementViews: boolean = true): Promise<Document | null> {
    try {
      // Check cache first
      const cached = this.documentCache.get(documentId);
      if (cached != null) {
        if (incrementViews) {
          void this.incrementViewCount(documentId); // Async, no await
        }
        return cached;
      }

      const result = await this.db.query<DocumentRow>(
        `SELECT * FROM documents WHERE id = $1`,
        [documentId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const document = this.mapRowToDocument(result.rows[0]);
      
      // Cache the document
      this.documentCache.set(documentId, document);

      if (incrementViews) {
        void this.incrementViewCount(documentId); // Async, no await
      }

      return document;
    } catch (error) {
      logger.error(`Failed to get document ${documentId}:`, error);
      return null;
    }
  }

  /**
   * Searches for documents based on parameters
   * @param params - Search parameters
   * @returns Array of matching documents
   */
  async searchDocuments(params: DocumentSearchParams): Promise<{
    documents: Document[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const {
        query = '',
        category,
        language,
        tags = [],
        officialOnly = false,
        minRating = 0,
        page = 1,
        pageSize = 20,
        sortBy = 'relevance',
        sortDirection = 'desc'
      } = params;

      // Use search engine for text search
      if (query != null && query !== '') {
        const searchResults = this.searchEngine.search({
          query,
          type: 'documentation',
          filters: {
            category,
            language,
            tags: tags.length > 0 ? tags : undefined,
            isOfficial: officialOnly || undefined,
            minRating
          },
          page,
          pageSize,
          sortBy,
          sortDirection
        });

        const documentIds = searchResults.results.map(r => r.id);
        const documents = await this.getDocumentsByIds(documentIds);

        return {
          documents,
          total: searchResults.total,
          page: searchResults.page,
          pageSize: searchResults.pageSize
        };
      }

      // Direct database query for non-text searches
      const whereConditions: string[] = ['1=1'];
      const queryParams: (string | number | boolean | string[])[] = [];

      if (category != null) {
        whereConditions.push(`category = $${queryParams.length + 1}`);
        queryParams.push(category);
      }

      if (language != null) {
        whereConditions.push(`language = $${queryParams.length + 1}`);
        queryParams.push(language);
      }

      if (tags.length > 0) {
        whereConditions.push(`tags @> $${queryParams.length + 1}`);
        queryParams.push(JSON.stringify(tags));
      }

      if (officialOnly) {
        whereConditions.push('is_official = true');
      }

      if (minRating > 0) {
        whereConditions.push(`rating >= $${queryParams.length + 1}`);
        queryParams.push(minRating);
      }

      const offset = (page - 1) * pageSize;
      
      // Get total count
      const countResult = await this.db.query<{ count: string }>(
        `SELECT COUNT(*) FROM documents WHERE ${whereConditions.join(' AND ')}`,
        queryParams
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get documents
      const orderBy = this.getOrderByClause(sortBy, sortDirection);
      const result = await this.db.query<DocumentRow>(
        `SELECT * FROM documents 
         WHERE ${whereConditions.join(' AND ')}
         ORDER BY ${orderBy}
         LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
        [...queryParams, pageSize, offset]
      );

      const documents = result.rows.map(row => this.mapRowToDocument(row));

      return {
        documents,
        total,
        page,
        pageSize
      };
    } catch (error) {
      logger.error('Failed to search documents:', error);
      throw new Error('Document search failed');
    }
  }

  /**
   * Updates an existing document
   * @param documentId - Document to update
   * @param updates - Fields to update
   * @param updaterAddress - Address of the user updating
   * @returns Updated document
   * @throws {Error} If update fails or user lacks permission
   */
  async updateDocument(
    documentId: string,
    updates: Partial<Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'version'>>,
    updaterAddress: string
  ): Promise<Document> {
    try {
      const existing = await this.getDocument(documentId, false);
      if (existing == null) {
        throw new Error('Document not found');
      }

      // Check if this is an official document requiring consensus
      if (existing.isOfficial) {
        return await this.proposeOfficialUpdate(documentId, updates, updaterAddress);
      }

      // Check if updater is the author
      if (existing.authorAddress !== updaterAddress) {
        throw new Error('Only the author can update this document');
      }

      // Update document
      const updatedDocument: Document = {
        ...existing,
        ...updates,
        version: existing.version + 1,
        updatedAt: new Date()
      };

      // Update in database
      await this.db.query(
        `UPDATE documents SET
          title = $2,
          description = $3,
          content = $4,
          category = $5,
          language = $6,
          version = $7,
          tags = $8,
          updated_at = $9,
          search_vector = to_tsvector('english', $10)
         WHERE id = $1`,
        [
          documentId,
          updatedDocument.title,
          updatedDocument.description,
          updatedDocument.content,
          updatedDocument.category,
          updatedDocument.language,
          updatedDocument.version,
          JSON.stringify(updatedDocument.tags),
          updatedDocument.updatedAt,
          `${updatedDocument.title} ${updatedDocument.description} ${updatedDocument.content}`
        ]
      );

      // Update search index
      this.searchEngine.updateDocument({
        id: updatedDocument.id,
        type: 'documentation',
        title: updatedDocument.title,
        content: updatedDocument.content,
        metadata: {
          category: updatedDocument.category,
          language: updatedDocument.language,
          tags: updatedDocument.tags
        }
      });

      // Clear cache
      this.documentCache.delete(documentId);

      // Award PoP points for contribution
      await this.awardContributionPoints(updaterAddress, 'update', updatedDocument);

      this.emit('documentUpdated', updatedDocument);
      logger.info(`Document updated: ${documentId}`);

      return updatedDocument;
    } catch (error) {
      logger.error(`Failed to update document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Rates a document
   * @param documentId - Document to rate
   * @param rating - Rating (1-5 stars)
   * @param userAddress - User providing the rating
   */
  async rateDocument(documentId: string, rating: number, userAddress: string): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    try {
      // Check if user has already rated
      const existingRating = await this.db.query<{ document_id: string; user_address: string; rating: number }>(
        'SELECT * FROM document_ratings WHERE document_id = $1 AND user_address = $2',
        [documentId, userAddress]
      );

      if (existingRating.rows.length > 0) {
        // Update existing rating
        await this.db.query(
          'UPDATE document_ratings SET rating = $3, updated_at = CURRENT_TIMESTAMP WHERE document_id = $1 AND user_address = $2',
          [documentId, userAddress, rating]
        );
      } else {
        // Create new rating
        await this.db.query(
          'INSERT INTO document_ratings (document_id, user_address, rating) VALUES ($1, $2, $3)',
          [documentId, userAddress, rating]
        );
      }

      // Update average rating on document
      const avgResult = await this.db.query<{ avg_rating: string }>(
        'SELECT AVG(rating) as avg_rating FROM document_ratings WHERE document_id = $1',
        [documentId]
      );

      const avgRating = avgResult.rows[0].avg_rating != null ? parseFloat(avgResult.rows[0].avg_rating) : 0;

      await this.db.query(
        'UPDATE documents SET rating = $2 WHERE id = $1',
        [documentId, avgRating]
      );

      // Clear cache
      this.documentCache.delete(documentId);

      this.emit('documentRated', { documentId, rating, userAddress });
    } catch (error) {
      logger.error(`Failed to rate document ${documentId}:`, error);
      throw new Error('Failed to rate document');
    }
  }

  /**
   * Gets documents by category
   * @param category - Document category
   * @param language - Optional language filter
   * @returns Array of documents in the category
   */
  async getDocumentsByCategory(
    category: DocumentCategory,
    language?: DocumentLanguage
  ): Promise<Document[]> {
    try {
      let query = 'SELECT * FROM documents WHERE category = $1';
      const params: string[] = [category];

      if (language != null) {
        query += ' AND language = $2';
        params.push(language);
      }

      query += ' ORDER BY is_official DESC, rating DESC, view_count DESC';

      const result = await this.db.query<DocumentRow>(query, params);
      return result.rows.map(row => this.mapRowToDocument(row));
    } catch (error) {
      logger.error(`Failed to get documents by category ${category}:`, error);
      return [];
    }
  }

  /**
   * Gets popular documents
   * @param limit - Maximum number of documents to return
   * @param timeframe - Timeframe in days (e.g., 7 for last week)
   * @returns Array of popular documents
   */
  async getPopularDocuments(limit: number = 10, timeframe: number = 7): Promise<Document[]> {
    try {
      const result = await this.db.query<DocumentRow>(
        `SELECT * FROM documents 
         WHERE updated_at > CURRENT_TIMESTAMP - INTERVAL '${timeframe} days'
         ORDER BY view_count DESC, rating DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows.map(row => this.mapRowToDocument(row));
    } catch (error) {
      logger.error('Failed to get popular documents:', error);
      return [];
    }
  }

  /**
   * Submits a document contribution for review
   * @param contribution - Contribution data
   * @returns Contribution ID for tracking
   */
  async submitContribution(contribution: DocumentContribution): Promise<string> {
    try {
      const contributionId = this.generateContributionId();

      await this.db.query(
        `INSERT INTO document_contributions (
          id, document_id, title, content, category, language, tags,
          contributor_address, change_description, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
        [
          contributionId,
          contribution.documentId ?? null,
          contribution.title,
          contribution.content,
          contribution.category,
          contribution.language,
          JSON.stringify(contribution.tags),
          contribution.contributorAddress,
          contribution.changeDescription
        ]
      );

      this.emit('contributionSubmitted', { contributionId, contribution });
      logger.info(`Contribution submitted: ${contributionId}`);

      // Notify validators for review if it's for official docs
      if (contribution.documentId != null) {
        const doc = await this.getDocument(contribution.documentId, false);
        if (doc?.isOfficial === true) {
          this.notifyValidatorsForReview(contributionId);
        }
      }

      return contributionId;
    } catch (error) {
      logger.error('Failed to submit contribution:', error);
      throw new Error('Failed to submit contribution');
    }
  }

  /**
   * Proposes an update to official documentation (requires consensus)
   * @param documentId - Document to update
   * @param updates - Proposed updates
   * @param proposerAddress - Address of the proposer
   * @returns Update proposal
   * @private
   */
  private async proposeOfficialUpdate(
    documentId: string,
    updates: Partial<Document>,
    proposerAddress: string
  ): Promise<Document> {
    const proposalId = this.generateProposalId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const proposal: DocumentUpdateProposal = {
      proposalId,
      documentId,
      newContent: updates.content ?? '',
      newMetadata: updates,
      proposerAddress,
      votes: { yes: 0, no: 0, abstain: 0 },
      status: 'pending',
      createdAt: new Date(),
      expiresAt
    };

    await this.db.query(
      `INSERT INTO document_update_proposals (
        proposal_id, document_id, new_content, new_metadata,
        proposer_address, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        proposal.proposalId,
        proposal.documentId,
        proposal.newContent,
        JSON.stringify(proposal.newMetadata),
        proposal.proposerAddress,
        proposal.expiresAt
      ]
    );

    // Request validator consensus
    this.validationService.requestConsensus('documentUpdate', proposal);

    this.emit('updateProposed', proposal);
    logger.info(`Official document update proposed: ${proposalId}`);

    throw new Error('Update proposal submitted for validator consensus');
  }

  /**
   * Awards PoP points for documentation contributions
   * @param userAddress - User to award points to
   * @param action - Type of contribution
   * @param document - Document involved
   * @private
   */
  private async awardContributionPoints(
    userAddress: string,
    action: 'create' | 'update',
    document: Document
  ): Promise<void> {
    try {
      let points = 0;

      if (action === 'create') {
        // Award based on document completeness and category
        if (document.content.length > 1000) {
          points = document.category === DocumentCategory.FAQ ? 1 : 2;
        }
        if (document.content.length > 5000) {
          points = 3;
        }
        if (document.category === DocumentCategory.TECHNICAL && document.content.length > 3000) {
          points = 5;
        }
      } else if (action === 'update') {
        // Award points for significant updates
        points = 0.5;
      }

      if (points > 0) {
        await this.participationService.updateDocumentationActivity(userAddress, points);
      }
    } catch (error) {
      logger.error('Failed to award contribution points:', error);
    }
  }

  /**
   * Increments the view count for a document
   * @param documentId - Document ID
   * @private
   */
  private async incrementViewCount(documentId: string): Promise<void> {
    try {
      await this.db.query(
        'UPDATE documents SET view_count = view_count + 1 WHERE id = $1',
        [documentId]
      );
    } catch (error) {
      logger.error(`Failed to increment view count for ${documentId}:`, error);
    }
  }

  /**
   * Gets documents by their IDs
   * @param ids - Array of document IDs
   * @returns Array of documents
   * @private
   */
  private async getDocumentsByIds(ids: string[]): Promise<Document[]> {
    if (ids.length === 0) {
      return [];
    }

    try {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const result = await this.db.query<DocumentRow>(
        `SELECT * FROM documents WHERE id IN (${placeholders})`,
        ids
      );

      return result.rows.map(row => this.mapRowToDocument(row));
    } catch (error) {
      logger.error('Failed to get documents by IDs:', error);
      return [];
    }
  }

  /**
   * Maps a database row to a Document object
   * @param row - Database row
   * @returns Document object
   * @private
   */
  private mapRowToDocument(row: DocumentRow): Document {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      content: row.content,
      category: row.category as DocumentCategory,
      language: row.language as DocumentLanguage,
      version: row.version,
      authorAddress: row.author_address,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      tags: JSON.parse(row.tags ?? '[]') as string[],
      isOfficial: row.is_official,
      viewCount: row.view_count,
      rating: typeof row.rating === 'number' ? row.rating : (row.rating != null ? parseFloat(String(row.rating)) : 0),
      attachments: row.attachments != null ? JSON.parse(row.attachments) as DocumentAttachment[] : []
    };
  }

  /**
   * Gets the ORDER BY clause for queries
   * @param sortBy - Sort field
   * @param sortDirection - Sort direction
   * @returns SQL ORDER BY clause
   * @private
   */
  private getOrderByClause(
    sortBy: 'relevance' | 'date' | 'rating' | 'views',
    sortDirection: 'asc' | 'desc'
  ): string {
    const direction = sortDirection.toUpperCase();
    
    switch (sortBy) {
      case 'date':
        return `updated_at ${direction}`;
      case 'rating':
        return `rating ${direction}, view_count ${direction}`;
      case 'views':
        return `view_count ${direction}`;
      case 'relevance':
      default:
        return `is_official DESC, rating ${direction}, view_count ${direction}`;
    }
  }

  /**
   * Clears expired entries from the document cache
   * @private
   */
  private clearExpiredCache(): void {
    // For simplicity, clear entire cache
    // In production, track timestamps per entry
    this.documentCache.clear();
  }

  /**
   * Generates a unique document ID
   * @returns Unique document ID
   * @private
   */
  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generates a unique contribution ID
   * @returns Unique contribution ID
   * @private
   */
  private generateContributionId(): string {
    return `contrib_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generates a unique proposal ID
   * @returns Unique proposal ID
   * @private
   */
  private generateProposalId(): string {
    return `proposal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Notifies validators to review a contribution
   * @param contributionId - Contribution to review
   * @private
   */
  private notifyValidatorsForReview(contributionId: string): void {
    try {
      this.validationService.requestReview('documentContribution', {
        contributionId,
        type: 'official_doc_update'
      });
    } catch (error) {
      logger.error('Failed to notify validators:', error);
    }
  }
}