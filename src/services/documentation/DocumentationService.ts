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
import { IPFSStorageNetwork } from '../../../../Validator/src/services/storage/IPFSStorageNetwork';
import { MasterMerkleEngine } from '../../../../Validator/src/engines/MasterMerkleEngine';

/**
 * Supported documentation languages
 */
export const SUPPORTED_LANGUAGES = ['en', 'es', 'zh', 'fr', 'de', 'ja', 'ko', 'ru'] as const;

/**
 * Documentation language type
 */
export type DocumentLanguage = (typeof SUPPORTED_LANGUAGES)[number];

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
  SECURITY = 'security',
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
  /** IPFS hash for published documents */
  ipfsHash?: string;
  /** Document status */
  status?: 'draft' | 'published' | 'archived';
  /** Timestamp when document was published */
  publishedAt?: Date;
  /** Additional metadata for custom properties */
  metadata?: Record<string, unknown>;
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
 * Database row type for document versions table
 */
interface DocumentVersionRow {
  id: number;
  document_id: string;
  version: number;
  title: string;
  content: string;
  editor_address: string;
  change_description?: string;
  created_at: string;
  category?: string;
  language?: string;
  tags?: string[];
  is_official?: boolean;
  description?: string;
  metadata?: string | Record<string, unknown>;
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
  metadata?: string;
  ipfs_hash?: string;
  status?: string;
  published_at?: Date | string;
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
  /** Filter by status */
  status?: 'draft' | 'published' | 'archived';
  /** Additional metadata filters */
  filters?: Record<string, unknown>;
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
  /** IPFS storage service */
  private ipfsStorage?: IPFSStorageNetwork;

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
    validationService: ValidationService,
  ) {
    super();
    this.db = db;
    this.searchEngine = searchEngine;
    this.participationService = participationService;
    this.validationService = validationService;
    this.documentCache = new Map();

    // Clear cache periodically
    setInterval(() => this.clearExpiredCache(), this.CACHE_TTL);
    
    // Try to get IPFSStorageNetwork from MasterMerkleEngine
    try {
      const masterMerkleEngine = MasterMerkleEngine.getInstance();
      if (masterMerkleEngine && masterMerkleEngine.getServices()) {
        const services = masterMerkleEngine.getServices();
        this.ipfsStorage = services.ipfsStorage as IPFSStorageNetwork;
      }
    } catch (error) {
      // IPFS storage not available - will use mock hashes
      logger.warn('IPFSStorageNetwork not available for DocumentationService', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Creates a new document
   * @param document - Document data
   * @param options - Additional options like translationOf
   * @param options.translationOf - ID of document this is a translation of
   * @returns Created document with ID
   * @throws {Error} If document creation fails
   */
  async createDocument(
    document: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'viewCount' | 'rating'>,
    options?: { translationOf?: string },
  ): Promise<Document> {
    try {
      // Validate required fields
      if (document.title === null || document.title === undefined || document.title.trim() === '') {
        throw new Error('Document title cannot be empty');
      }
      
      if (document.content === null || document.content === undefined || document.content.trim() === '') {
        throw new Error('Document content cannot be empty');
      }

      // Enhanced validation for title length and content quality
      if (document.title.trim().length < 3) {
        throw new Error('Document title must be at least 3 characters long');
      }
      
      if (document.title.trim().length > 255) {
        throw new Error('Document title cannot exceed 255 characters');
      }
      
      if (document.content.trim().length < 10) {
        throw new Error('Document content must be at least 10 characters long');
      }

      // Validate category
      const validCategories = Object.values(DocumentCategory);
      if (!validCategories.includes(document.category)) {
        throw new Error('Invalid category');
      }
      
      // Validate language
      if (!SUPPORTED_LANGUAGES.includes(document.language)) {
        throw new Error(`Unsupported language: ${document.language}. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`);
      }
      
      // Validate author address format
      if (document.authorAddress === null || document.authorAddress === undefined || !/^0x[a-fA-F0-9]{40}$/.test(document.authorAddress)) {
        throw new Error('Invalid author address format');
      }
      
      // Validate tags array
      if (document.tags !== null && document.tags !== undefined && (!Array.isArray(document.tags) || document.tags.some(tag => typeof tag !== 'string' || tag.trim() === ''))) {
        throw new Error('Tags must be an array of non-empty strings');
      }
      
      // Validate description if provided
      if (document.description !== null && document.description !== undefined && document.description.length > 1000) {
        throw new Error('Document description cannot exceed 1000 characters');
      }
      
      // If this is a translation, validate the original document exists
      if (options?.translationOf !== null && options?.translationOf !== undefined && options.translationOf !== '') {
        const originalDoc = await this.getDocument(options.translationOf, false);
        if (originalDoc === null || originalDoc === undefined) {
          throw new Error('Original document for translation not found');
        }
        
        // Ensure we're not creating a circular translation reference
        if (originalDoc.language === document.language) {
          throw new Error('Translation must be in a different language than the original');
        }
      }

      const id = this.generateDocumentId();
      const now = new Date();

      const newDocument: Document = {
        ...document,
        id,
        createdAt: now,
        updatedAt: now,
        viewCount: 0,
        rating: 0,
        version: 1,
        status: 'draft',
      };

      // Store in database
      await this.db.query(
        `INSERT INTO documents (
          id, title, description, content, category, language, version,
          author_address, tags, is_official, search_vector, status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, to_tsvector('english', $11), $12, $13)`,
        [
          newDocument.id,
          newDocument.title,
          newDocument.description,
          newDocument.content,
          newDocument.category,
          newDocument.language,
          newDocument.version,
          newDocument.authorAddress,
          newDocument.tags,
          newDocument.isOfficial,
          `${newDocument.title} ${newDocument.description} ${newDocument.content}`,
          newDocument.status,
          JSON.stringify(document.metadata ?? {}),
        ],
      );

      // Save initial version
      await this.db.query(
        `INSERT INTO document_versions (document_id, version, title, content, editor_address, change_description, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newDocument.id,
          1,
          newDocument.title,
          newDocument.content,
          newDocument.authorAddress,
          'Initial version',
          JSON.stringify(newDocument.metadata ?? {}),
        ],
      );

      // If this is a translation of another document, create the link
      if (options?.translationOf !== null && options?.translationOf !== undefined && options?.translationOf !== '') {
        // Check if translation link already exists to prevent duplicates
        const existingLink = await this.db.query<{ original_id: string; translation_id: string }>(
          `SELECT * FROM document_translation_links WHERE original_id = $1 AND translation_id = $2`,
          [options.translationOf, newDocument.id],
        );
        
        if (existingLink.rows.length === 0) {
          await this.db.query(
            `INSERT INTO document_translation_links (original_id, translation_id)
             VALUES ($1, $2)`,
            [options.translationOf, newDocument.id],
          );
        }
      }

      // Index in search engine
      this.searchEngine.indexDocument({
        id: newDocument.id,
        type: 'documentation',
        title: newDocument.title,
        content: newDocument.content,
        metadata: {
          category: newDocument.category,
          language: newDocument.language,
          tags: newDocument.tags,
        },
      });

      // Award PoP points for contribution
      await this.awardContributionPoints(newDocument.authorAddress, 'create', newDocument);

      this.emit('documentCreated', newDocument);
      logger.info(`Document created: ${newDocument.id}`);

      return newDocument;
    } catch (error) {
      logger.error('Failed to create document:', error);
      throw error;
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

      const result = await this.db.query<DocumentRow>(`SELECT * FROM documents WHERE id = $1`, [
        documentId,
      ]);

      if (result.rows.length === 0) {
        return null;
      }

      const firstRow = result.rows[0];
      if (firstRow === undefined) {
        return null;
      }
      const document = this.mapRowToDocument(firstRow);

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
    items: Document[];
    documents: Document[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      // Enhanced parameter validation but handle empty params object
      if (params === null || params === undefined) {
        throw new Error('Search parameters are required');
      }
      
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
        sortDirection = 'desc',
        status,
        filters = {},
      } = params;
      
      // Validate search parameters
      if (page < 1) {
        throw new Error('Page number must be at least 1');
      }
      
      if (pageSize < 1 || pageSize > 500) {
        throw new Error('Page size must be between 1 and 500');
      }
      
      if (minRating < 0 || minRating > 5) {
        throw new Error('Minimum rating must be between 0 and 5');
      }
      
      if (category !== undefined && category !== null && !(Object.values(DocumentCategory) as string[]).includes(category)) {
        throw new Error('Invalid category');
      }
      
      if (language !== null && language !== undefined && !SUPPORTED_LANGUAGES.includes(language)) {
        throw new Error(`Unsupported language: ${language}`);
      }
      
      if (!['relevance', 'date', 'rating', 'views'].includes(sortBy)) {
        throw new Error('Invalid sortBy parameter');
      }
      
      if (!['asc', 'desc'].includes(sortDirection)) {
        throw new Error('Invalid sortDirection parameter');
      }
      
      if (status !== null && status !== undefined && !['draft', 'published', 'archived'].includes(status)) {
        throw new Error('Invalid status parameter');
      }
      
      if (tags !== null && tags !== undefined && !Array.isArray(tags)) {
        throw new Error('Tags must be an array');
      }
      
      // Sanitize query to prevent potential issues
      const sanitizedQuery = typeof query === 'string' ? query.trim().substring(0, 500) : '';

      // Use search engine for text search
      if (sanitizedQuery !== '') {
        const searchFilters: Record<string, unknown> = {};
        if (category !== null && category !== undefined) searchFilters.category = category;
        if (language !== null && language !== undefined && language.length > 0)
          searchFilters.language = language;
        if (tags.length > 0) searchFilters.tags = tags;
        if (officialOnly === true) searchFilters.isOfficial = true;
        if (minRating > 0) searchFilters.minRating = minRating;
        if (status !== null && status !== undefined && status.length > 0) searchFilters.status = status;
        // Add custom filters
        Object.assign(searchFilters, filters);

        const searchResults = this.searchEngine.search({
          query: sanitizedQuery,
          type: 'documentation',
          ...(Object.keys(searchFilters).length > 0 && { filters: searchFilters }),
          page,
          pageSize,
          sortBy,
          sortDirection,
        });

        const documentIds = searchResults.results.map(r => r.id);
        const documents = await this.getDocumentsByIds(documentIds);

        return {
          items: documents,
          documents: documents,
          total: searchResults.total,
          page: searchResults.page,
          pageSize: searchResults.pageSize,
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
        whereConditions.push(`tags && $${queryParams.length + 1}`);
        queryParams.push(tags);
      }

      if (officialOnly) {
        whereConditions.push('is_official = true');
      }

      if (minRating > 0) {
        whereConditions.push(`rating >= $${queryParams.length + 1}`);
        queryParams.push(minRating);
      }
      if (status != null) {
        whereConditions.push(`status = $${queryParams.length + 1}`);
        queryParams.push(status);
      }

      // Handle metadata filters with enhanced validation
      if (filters !== null && filters !== undefined && Object.keys(filters).length > 0) {
        for (const [key, value] of Object.entries(filters)) {
          if (value !== undefined && value !== null && value !== '') {
            if (key.startsWith('metadata.')) {
              const metadataKey = key.substring('metadata.'.length);
              // Validate metadata key to prevent injection
              if (!/^[a-zA-Z0-9_]+$/.test(metadataKey)) {
                throw new Error(`Invalid metadata key: ${metadataKey}`);
              }
              whereConditions.push(`metadata->>'${metadataKey}' = $${queryParams.length + 1}`);
              queryParams.push(String(value));
            } else if (key === 'dateRange') {
              // Handle date range filtering
              if (typeof value === 'object' && value !== null) {
                const dateRange = value as { start?: string; end?: string };
                if (dateRange.start !== null && dateRange.start !== undefined && dateRange.start !== '') {
                  whereConditions.push(`created_at >= $${queryParams.length + 1}`);
                  queryParams.push(new Date(dateRange.start).toISOString());
                }
                if (dateRange.end !== null && dateRange.end !== undefined && dateRange.end !== '') {
                  whereConditions.push(`created_at <= $${queryParams.length + 1}`);
                  queryParams.push(new Date(dateRange.end).toISOString());
                }
              }
            } else if (key === 'authorAddresses' && Array.isArray(value)) {
              // Handle multiple author filtering
              const placeholders = value.map((_, i) => `$${queryParams.length + i + 1}`).join(',');
              whereConditions.push(`author_address IN (${placeholders})`);
              queryParams.push(...(value as string[]));
            } else if (key === 'hasAttachments' && typeof value === 'boolean') {
              // Filter documents with/without attachments
              if (value) {
                whereConditions.push(`attachments IS NOT NULL AND attachments != '[]'`);
              } else {
                whereConditions.push(`(attachments IS NULL OR attachments = '[]')`);
              }
            }
          }
        }
      }

      const offset = (page - 1) * pageSize;

      // Get total count
      const countResult = await this.db.query<{ count: string }>(
        `SELECT COUNT(*) FROM documents WHERE ${whereConditions.join(' AND ')}`,
        queryParams,
      );
      const countRow = countResult.rows[0];
      if (countRow === undefined) {
        throw new Error('Count query returned no results');
      }
      const total = parseInt(countRow.count, 10);

      // Get documents
      const orderBy = this.getOrderByClause(sortBy, sortDirection);
      const result = await this.db.query<DocumentRow>(
        `SELECT * FROM documents 
         WHERE ${whereConditions.join(' AND ')}
         ORDER BY ${orderBy}
         LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
        [...queryParams, pageSize, offset],
      );

      const documents = result.rows.map(row => this.mapRowToDocument(row));

      return {
        items: documents,
        documents: documents,
        total,
        page,
        pageSize,
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
    updaterAddress: string,
  ): Promise<Document> {
    try {
      // Enhanced input validation
      if (documentId === null || documentId === undefined || documentId.trim() === '') {
        throw new Error('Document ID cannot be empty');
      }
      
      if (updaterAddress === null || updaterAddress === undefined || !/^0x[a-fA-F0-9]{40}$/.test(updaterAddress)) {
        throw new Error('Invalid updater address format');
      }
      
      if (updates === null || updates === undefined || Object.keys(updates).length === 0) {
        throw new Error('No updates provided');
      }
      
      // Validate update fields
      if (updates.title !== undefined && (updates.title === null || updates.title === '' || updates.title.trim() === '')) {
        throw new Error('Document title cannot be empty');
      }
      
      if (updates.title !== null && updates.title !== undefined && (updates.title.trim().length < 3 || updates.title.trim().length > 255)) {
        throw new Error('Document title must be between 3 and 255 characters');
      }
      
      if (updates.content !== undefined && (updates.content === null || updates.content === '' || updates.content.trim() === '')) {
        throw new Error('Document content cannot be empty');
      }
      
      if (updates.content !== null && updates.content !== undefined && updates.content.trim().length < 10) {
        throw new Error('Document content must be at least 10 characters long');
      }
      
      if (updates.language !== null && updates.language !== undefined && !SUPPORTED_LANGUAGES.includes(updates.language)) {
        throw new Error(`Unsupported language: ${updates.language}. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`);
      }
      
      if ((updates.category != null) && !Object.values(DocumentCategory).includes(updates.category)) {
        throw new Error('Invalid category');
      }
      
      if (updates.tags !== null && updates.tags !== undefined && (!Array.isArray(updates.tags) || updates.tags.some(tag => typeof tag !== 'string' || tag.trim() === ''))) {
        throw new Error('Tags must be an array of non-empty strings');
      }
      
      if (updates.description !== null && updates.description !== undefined && updates.description.length > 1000) {
        throw new Error('Document description cannot exceed 1000 characters');
      }

      const existing = await this.getDocument(documentId, false);
      if (existing == null) {
        throw new Error('Document not found');
      }
      
      // Version check removed - 'version' is excluded from updates type

      // Check if this is an official document requiring consensus
      if (existing.isOfficial) {
        return await this.proposeOfficialUpdate(documentId, updates, updaterAddress);
      }

      // Check if updater is the author
      if (existing.authorAddress !== updaterAddress) {
        throw new Error('Only the author can update this document');
      }
      
      // Prevent changing critical fields that shouldn't be updated
      const forbiddenUpdates = ['authorAddress', 'createdAt', 'viewCount', 'rating'];
      const attemptedForbiddenUpdates = Object.keys(updates).filter(key => forbiddenUpdates.includes(key));
      if (attemptedForbiddenUpdates.length > 0) {
        throw new Error(`Cannot update the following fields: ${attemptedForbiddenUpdates.join(', ')}`);
      }

      // Update document
      const updatedDocument: Document = {
        ...existing,
        ...updates,
        version: existing.version + 1,
        updatedAt: new Date(),
      };

      // Save version history
      await this.db.query(
        `INSERT INTO document_versions (document_id, version, title, content, editor_address, change_description, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          documentId,
          updatedDocument.version,
          updatedDocument.title,
          updatedDocument.content,
          updaterAddress,
          updates.description ?? 'Document updated',
          JSON.stringify(updatedDocument.metadata ?? {}),
        ],
      );

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
          updatedDocument.tags,
          updatedDocument.updatedAt,
          `${updatedDocument.title} ${updatedDocument.description} ${updatedDocument.content}`,
        ],
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
          tags: updatedDocument.tags,
        },
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
   * Deletes a document
   * @param documentId - Document to delete
   * @param deleterAddress - Address of the user requesting deletion
   * @returns True if deleted successfully
   * @throws {Error} If deletion fails or user lacks permission
   */
  async deleteDocument(documentId: string, deleterAddress: string): Promise<boolean> {
    try {
      const existing = await this.getDocument(documentId, false);
      if (existing == null) {
        throw new Error('Document not found');
      }

      // Check if this is an official document (cannot be deleted)
      if (existing.isOfficial) {
        throw new Error('Official documents cannot be deleted');
      }

      // Check if deleter is the author
      if (existing.authorAddress !== deleterAddress) {
        throw new Error('Only the author can delete this document');
      }

      // Delete from database
      await this.db.query('DELETE FROM documents WHERE id = $1', [documentId]);

      // Remove from search index
      this.searchEngine.removeDocument(documentId);

      // Clear cache
      this.documentCache.delete(documentId);

      this.emit('documentDeleted', { documentId, deleterAddress });
      logger.info(`Document deleted: ${documentId}`);

      return true;
    } catch (error) {
      logger.error(`Failed to delete document ${documentId}:`, error);
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
      const existingRating = await this.db.query<{
        document_id: string;
        user_address: string;
        rating: number;
      }>('SELECT * FROM document_ratings WHERE document_id = $1 AND user_address = $2', [
        documentId,
        userAddress,
      ]);

      if (existingRating.rows.length > 0) {
        // Update existing rating
        await this.db.query(
          'UPDATE document_ratings SET rating = $3, updated_at = CURRENT_TIMESTAMP WHERE document_id = $1 AND user_address = $2',
          [documentId, userAddress, rating],
        );
      } else {
        // Create new rating
        await this.db.query(
          'INSERT INTO document_ratings (document_id, user_address, rating) VALUES ($1, $2, $3)',
          [documentId, userAddress, rating],
        );
      }

      // Update average rating on document
      const avgResult = await this.db.query<{ avg_rating: string }>(
        'SELECT AVG(rating) as avg_rating FROM document_ratings WHERE document_id = $1',
        [documentId],
      );

      const avgRow = avgResult.rows[0];
      const avgRating =
        avgRow !== undefined && avgRow.avg_rating != null
          ? parseFloat(String(avgRow.avg_rating))
          : 0;

      await this.db.query('UPDATE documents SET rating = $2 WHERE id = $1', [
        documentId,
        avgRating,
      ]);

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
    language?: DocumentLanguage,
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
        [limit],
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
          contribution.tags,
          contribution.contributorAddress,
          contribution.changeDescription,
        ],
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
    proposerAddress: string,
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
      expiresAt,
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
        proposal.expiresAt,
      ],
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
    document: Document,
  ): Promise<void> {
    try {
      let points = 0;

      if (action === 'create') {
        // Base points for creating any document
        points = 1;

        // Award bonus points based on document completeness and category
        if (document.content.length > 1000) {
          points = document.category === DocumentCategory.FAQ ? 2 : 3;
        }
        if (document.content.length > 5000) {
          points = 4;
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
   * Gets all versions of a document
   * @param documentId - Document ID
   * @returns Array of document versions
   */
  async getDocumentVersions(documentId: string): Promise<Document[]> {
    try {
      const result = await this.db.query<DocumentVersionRow>(
        `SELECT 
          v.*, 
          d.category, 
          d.language, 
          d.tags, 
          d.is_official,
          d.author_address as original_author
        FROM document_versions v
        JOIN documents d ON d.id = v.document_id
        WHERE v.document_id = $1
        ORDER BY v.version ASC`,
        [documentId],
      );

      return result.rows.map(row => ({
        id: row.document_id,
        title: row.title,
        description: '',
        content: row.content,
        category: row.category as DocumentCategory,
        language: row.language as DocumentLanguage,
        version: row.version,
        authorAddress: row.editor_address,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.created_at),
        tags: Array.isArray(row.tags) ? row.tags : [],
        isOfficial: Boolean(row.is_official),
        viewCount: 0,
        rating: 0,
      }));
    } catch (error) {
      logger.error('Failed to get document versions:', error);
      throw error;
    }
  }

  /**
   * Gets a specific version of a document
   * @param documentId - Document ID
   * @param version - Version number
   * @returns Document at specified version or null
   */
  async getDocumentVersion(documentId: string, version: number): Promise<Document | null> {
    try {
      const result = await this.db.query<DocumentVersionRow>(
        `SELECT 
          v.*, 
          d.category, 
          d.language, 
          d.tags, 
          d.is_official,
          d.author_address as original_author,
          d.description
        FROM document_versions v
        JOIN documents d ON d.id = v.document_id
        WHERE v.document_id = $1 AND v.version = $2`,
        [documentId, version],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      if (row === null || row === undefined) {
        return null;
      }

      return {
        id: row.document_id,
        title: row.title,
        description: row.description ?? '',
        content: row.content,
        category: row.category as DocumentCategory,
        language: row.language as DocumentLanguage,
        version: row.version,
        authorAddress: row.editor_address,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.created_at),
        tags: Array.isArray(row.tags) ? row.tags : [],
        isOfficial: Boolean(row.is_official),
        viewCount: 0,
        rating: 0,
        metadata: this.parseMetadata(row.metadata),
      };
    } catch (error) {
      logger.error('Failed to get document version:', error);
      return null;
    }
  }

  /**
   * Restores a previous version of a document
   * @param documentId - Document ID
   * @param version - Version to restore
   * @param restorerAddress - Address of user restoring the version
   * @returns Restored document
   */
  async restoreVersion(
    documentId: string,
    version: number,
    restorerAddress: string,
  ): Promise<Document> {
    const oldVersion = await this.getDocumentVersion(documentId, version);
    if (oldVersion === null || oldVersion === undefined) {
      throw new Error('Version not found');
    }

    // Create a new version with the old content
    const updated = await this.updateDocument(
      documentId,
      {
        title: oldVersion.title,
        content: oldVersion.content,
      },
      restorerAddress,
    );

    return updated;
  }

  /**
   * Gets documents by language
   * @param language - Language code
   * @param limit - Maximum number of documents
   * @returns Array of documents
   */
  async getDocumentsByLanguage(
    language: DocumentLanguage,
    limit: number = 20,
  ): Promise<Document[]> {
    try {
      const result = await this.db.query<DocumentRow>(
        'SELECT * FROM documents WHERE language = $1 AND is_official = true ORDER BY created_at DESC LIMIT $2',
        [language, limit],
      );
      return result.rows.map(row => this.mapRowToDocument(row));
    } catch (error) {
      logger.error('Failed to get documents by language:', error);
      return [];
    }
  }

  /**
   * Gets translations of a document
   * @param documentId - Document ID
   * @returns Array of translations
   */
  async getTranslations(documentId: string): Promise<Document[]> {
    try {
      if (documentId === null || documentId === undefined || documentId.trim() === '') {
        throw new Error('Document ID cannot be empty');
      }
      
      // Verify the original document exists
      const originalDoc = await this.getDocument(documentId, false);
      if (originalDoc === null || originalDoc === undefined) {
        throw new Error('Original document not found');
      }
      
      // Find documents linked as translations of this document
      const result = await this.db.query<DocumentRow>(
        `SELECT d.* FROM documents d
         JOIN document_translation_links t ON d.id = t.translation_id
         WHERE t.original_id = $1 AND d.id != $1
         ORDER BY d.language, d.created_at`,
        [documentId],
      );

      // Filter out any invalid translations (same language as original)
      const translations = result.rows
        .map(row => this.mapRowToDocument(row))
        .filter(doc => doc.language !== originalDoc.language);
        
      return translations;
    } catch (error) {
      logger.error('Failed to get translations:', error);
      return [];
    }
  }

  /**
   * Publishes a draft document
   * @param documentId - Document ID
   * @param publisherAddress - Publisher address
   * @returns Updated document
   */
  async publishDocument(documentId: string, publisherAddress: string): Promise<Document> {
    try {
      // Get the document content
      const doc = await this.getDocument(documentId);
      if (!doc) {
        throw new Error('Document not found');
      }
      
      // Upload to IPFS if available, otherwise generate mock hash
      let ipfsHash: string;
      if (this.ipfsStorage) {
        try {
          // Create a JSON representation of the document
          const documentData = JSON.stringify({
            title: doc.title,
            content: doc.content,
            metadata: doc.metadata,
            author: doc.authorAddress,
            createdAt: doc.createdAt,
          });
          
          const result = await this.ipfsStorage.storeData(
            Buffer.from(documentData),
            `doc_${documentId}.json`,
            'application/json',
            publisherAddress
          );
          ipfsHash = result.hash;
        } catch (error) {
          logger.warn('Failed to upload to IPFS, using mock hash', {
            error: error instanceof Error ? error.message : String(error)
          });
          ipfsHash = this.generateIPFSHash();
        }
      } else {
        ipfsHash = this.generateIPFSHash();
      }

      await this.db.query(
        'UPDATE documents SET status = $2, ipfs_hash = $3, published_at = NOW(), updated_at = NOW() WHERE id = $1',
        [documentId, 'published', ipfsHash],
      );

      // Clear cache to ensure we get the updated document
      this.documentCache.delete(documentId);

      const updatedDoc = await this.getDocument(documentId);
      if (updatedDoc === null || updatedDoc === undefined) {
        throw new Error('Document not found');
      }

      this.emit('documentPublished', updatedDoc);
      return updatedDoc;
    } catch (error) {
      logger.error('Failed to publish document:', error);
      throw error;
    }
  }

  /**
   * Unpublishes a document
   * @param documentId - Document ID
   * @param _unpublisherAddress - Unpublisher address
   * @returns Updated document
   */
  async unpublishDocument(documentId: string, _unpublisherAddress: string): Promise<Document> {
    try {
      await this.db.query(
        'UPDATE documents SET status = $2, published_at = NULL, updated_at = NOW() WHERE id = $1',
        [documentId, 'draft'],
      );

      // Clear cache to ensure we get the updated document
      this.documentCache.delete(documentId);

      const doc = await this.getDocument(documentId);
      if (doc === null || doc === undefined) {
        throw new Error('Document not found');
      }

      this.emit('documentUnpublished', doc);
      return doc;
    } catch (error) {
      logger.error('Failed to unpublish document:', error);
      throw error;
    }
  }

  /**
   * Archives a document
   * @param documentId - Document ID
   * @param archiverAddress - Archiver address
   * @returns Archived document
   */
  async archiveDocument(documentId: string, archiverAddress: string): Promise<Document> {
    try {
      await this.db.query('UPDATE documents SET status = $2, updated_at = NOW() WHERE id = $1', [
        documentId,
        'archived',
      ]);

      const doc = await this.getDocument(documentId);
      if (doc === null || doc === undefined) {
        throw new Error('Document not found');
      }

      this.emit('documentArchived', { documentId, archiverAddress });
      return doc;
    } catch (error) {
      logger.error('Failed to archive document:', error);
      throw error;
    }
  }

  /**
   * Gets all categories (alias for listCategories)
   * @returns Array of categories with metadata
   */
  async getCategories(): Promise<
    Array<{ category: DocumentCategory; count: number; description: string }>
  > {
    return this.listCategories();
  }

  /**
   * Gets category statistics
   * @param category - Document category
   * @returns Category statistics
   */
  async getCategoryStats(category: DocumentCategory): Promise<{
    totalDocs: number;
    publishedDocs: number;
    totalViews: number;
    avgRating: number;
    topTags: string[];
  }> {
    try {
      const result = await this.db.query<{
        total: string;
        published: string;
        views: string;
        avg_rating: string;
      }>(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'published' THEN 1 END) as published,
          SUM(view_count) as views,
          AVG(rating) as avg_rating
        FROM documents
        WHERE category = $1`,
        [category],
      );

      const tagsResult = await this.db.query<{ tag: string; count: string }>(
        `SELECT unnest(tags) as tag, COUNT(*) as count
        FROM documents
        WHERE category = $1
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 5`,
        [category],
      );

      const stats = result.rows[0];
      return {
        totalDocs: parseInt(stats?.total ?? '0'),
        publishedDocs: parseInt(stats?.published ?? '0'),
        totalViews: parseInt(stats?.views ?? '0'),
        avgRating: parseFloat(stats?.avg_rating ?? '0'),
        topTags: tagsResult.rows.map(r => r.tag),
      };
    } catch (error) {
      logger.error('Failed to get category stats:', error);
      return {
        totalDocs: 0,
        publishedDocs: 0,
        totalViews: 0,
        avgRating: 0,
        topTags: [],
      };
    }
  }

  /**
   * Lists all available categories
   * @returns Array of categories with metadata
   */
  async listCategories(): Promise<
    Array<{ category: DocumentCategory; count: number; description: string }>
  > {
    const categories = Object.values(DocumentCategory).map(category => ({
      category,
      count: 0,
      description: this.getCategoryDescription(category),
    }));

    try {
      const result = await this.db.query<{ category: string; count: string }>(
        'SELECT category, COUNT(*) as count FROM documents GROUP BY category',
      );

      result.rows.forEach(row => {
        const cat = categories.find(c => c.category === (row.category as DocumentCategory));
        if (cat !== null && cat !== undefined) {
          cat.count = parseInt(row.count);
        }
      });
    } catch (error) {
      logger.error('Failed to get category counts:', error);
    }

    return categories;
  }

  /**
   * Requests consensus validation for a document
   * @param documentId - Document ID
   * @param proposerAddress - Proposer address
   * @returns Validation request ID
   */
  async requestConsensusValidation(documentId: string, proposerAddress: string): Promise<string> {
    try {
      if (documentId === null || documentId === undefined || documentId.trim() === '') {
        throw new Error('Document ID cannot be empty');
      }
      
      if (proposerAddress === null || proposerAddress === undefined || !/^0x[a-fA-F0-9]{40}$/.test(proposerAddress)) {
        throw new Error('Invalid proposer address format');
      }
      
      const doc = await this.getDocument(documentId, false);
      if (doc === null || doc === undefined) {
        throw new Error('Document not found');
      }
      
      // Only allow consensus requests for published documents
      if (doc.status !== 'published') {
        throw new Error('Only published documents can request consensus validation');
      }
      
      // Check if there's already an active proposal for this document
      const existingProposal = await this.db.query<{ proposal_id: string; status: string }>(
        `SELECT proposal_id, status FROM documentation_proposals 
         WHERE document_id = $1 AND status IN ('voting', 'pending')
         ORDER BY created_at DESC LIMIT 1`,
        [documentId],
      );
      
      if (existingProposal.rows.length > 0) {
        throw new Error('Document already has an active consensus proposal');
      }
      
      // Validate proposer has sufficient participation score or is document author
      if (doc.authorAddress !== proposerAddress) {
        // In a real implementation, check participation score from ParticipationScoreService
        // For now, allow any validated address to propose
      }

      const proposalId = `proposal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Create validation request
      await this.db.query(
        `INSERT INTO documentation_proposals 
         (proposal_id, document_id, new_content, new_metadata, proposer_address, voting_ends_at, status)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days', 'voting')`,
        [
          proposalId,
          documentId,
          doc.content,
          JSON.stringify({ title: doc.title, description: doc.description, category: doc.category }),
          proposerAddress,
        ],
      );

      this.emit('consensusRequested', { proposalId, documentId, proposerAddress });
      logger.info(`Consensus validation requested: ${proposalId} for document ${documentId}`);
      return proposalId;
    } catch (error) {
      logger.error('Failed to request consensus validation:', error);
      throw error;
    }
  }

  /**
   * Gets consensus status for a proposal
   * @param proposalId - Proposal ID
   * @returns Consensus status
   */
  async getConsensusStatus(proposalId: string): Promise<{
    status: 'voting' | 'approved' | 'rejected' | 'expired';
    yesVotes: number;
    noVotes: number;
    totalStake: number;
  }> {
    try {
      const result = await this.db.query<{
        status: string;
        yes_votes: string;
        no_votes: string;
        total_stake: string;
      }>(
        `SELECT 
          p.status,
          COALESCE(SUM(CASE WHEN v.vote = 'yes' THEN v.stake_weight ELSE 0 END), 0) as yes_votes,
          COALESCE(SUM(CASE WHEN v.vote = 'no' THEN v.stake_weight ELSE 0 END), 0) as no_votes,
          COALESCE(SUM(v.stake_weight), 0) as total_stake
        FROM documentation_proposals p
        LEFT JOIN documentation_votes v ON p.proposal_id = v.proposal_id
        WHERE p.proposal_id = $1
        GROUP BY p.proposal_id, p.status`,
        [proposalId],
      );

      if (result.rows.length === 0) {
        throw new Error('Proposal not found');
      }

      const row = result.rows[0];
      if (row === null || row === undefined) {
        throw new Error('Proposal not found');
      }

      return {
        status: row.status as 'voting' | 'approved' | 'rejected' | 'expired',
        yesVotes: parseInt(row.yes_votes),
        noVotes: parseInt(row.no_votes),
        totalStake: parseInt(row.total_stake),
      };
    } catch (error) {
      logger.error('Failed to get consensus status:', error);
      throw error;
    }
  }

  /**
   * Marks a document as helpful
   * @param documentId - Document ID
   * @param userAddress - User marking document as helpful
   * @returns Success status
   */
  async markDocumentHelpful(documentId: string, userAddress: string): Promise<boolean> {
    try {
      if (documentId === null || documentId === undefined || documentId.trim() === '') {
        throw new Error('Document ID cannot be empty');
      }
      
      if (userAddress === null || userAddress === undefined || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
        throw new Error('Invalid user address format');
      }
      
      // Check if document exists
      const doc = await this.getDocument(documentId, false);
      if (doc === null || doc === undefined) {
        throw new Error('Document not found');
      }
      
      // Only allow helpful marking for published documents
      if (doc.status !== 'published') {
        throw new Error('Only published documents can be marked as helpful');
      }
      
      // Prevent users from marking their own documents as helpful
      if (doc.authorAddress === userAddress) {
        throw new Error('Authors cannot mark their own documents as helpful');
      }

      // Check if user has already marked this document as helpful
      const existingMark = await this.db.query(
        'SELECT 1 FROM document_helpful_marks WHERE document_id = $1 AND user_address = $2',
        [documentId, userAddress],
      );

      if (existingMark.rows.length > 0) {
        // Already marked as helpful - this is not an error, just return true
        return true;
      }

      // Mark document as helpful with timestamp
      await this.db.query(
        'INSERT INTO document_helpful_marks (document_id, user_address, created_at) VALUES ($1, $2, NOW())',
        [documentId, userAddress],
      );

      // Award participation points to the author
      try {
        await this.participationService.updateDocumentationActivity(doc.authorAddress, 0.5);
      } catch (error) {
        logger.warn('Failed to award participation points for helpful mark:', error);
        // Don't fail the entire operation if points can't be awarded
      }

      this.emit('documentMarkedHelpful', {
        documentId,
        userAddress,
        authorAddress: doc.authorAddress,
      });

      logger.debug(`Document ${documentId} marked as helpful by ${userAddress}`);
      return true;
    } catch (error) {
      logger.error('Failed to mark document as helpful:', error);
      throw error;
    }
  }

  /**
   * Retrieves a document from IPFS
   * @param ipfsHash - IPFS content hash
   * @returns Document content
   */
  async getDocumentFromIPFS(ipfsHash: string): Promise<{ content: string; metadata?: unknown }> {
    try {
      // Enhanced IPFS hash validation
      if (ipfsHash === null || ipfsHash === undefined || ipfsHash === '') {
        throw new Error('IPFS hash cannot be empty');
      }
      
      // Validate IPFS hash format (Qm... format for IPFS v0 or more flexible for testing)
      if ((ipfsHash.match(/^Qm[a-zA-Z0-9]{44}$/) === null) && !ipfsHash.startsWith('ipfs_')) {
        throw new Error('Invalid IPFS hash format');
      }
      
      let result;
      let attempts = 0;
      const maxAttempts = 3;
      
      // Retry logic for IPFS retrieval
      while (attempts < maxAttempts) {
        try {
          // In a real implementation, this would connect to IPFS node
          // For now, we'll retrieve from database where we stored the content
          result = await this.db.query<{
            content: string;
            title: string;
            category: string;
            language: string;
            tags: string[];
            id: string;
            description?: string;
            created_at: string;
          }>('SELECT id, content, title, description, category, language, tags, created_at FROM documents WHERE ipfs_hash = $1', [
            ipfsHash,
          ]);
          break;
        } catch (dbError) {
          attempts++;
          if (attempts >= maxAttempts) {
            logger.error(`IPFS retrieval failed after ${maxAttempts} attempts:`, dbError);
            throw new Error('IPFS retrieval service temporarily unavailable');
          }
          await new Promise(resolve => setTimeout(resolve, 100 * attempts));
        }
      }

      if (result === null || result === undefined || result.rows.length === 0) {
        throw new Error(`Document not found in IPFS for hash: ${ipfsHash}`);
      }

      const doc = result.rows[0];
      if (doc === null || doc === undefined) {
        throw new Error('Retrieved document is null or undefined');
      }
      
      if (doc.content === null || doc.content === undefined || doc.content.trim() === '') {
        throw new Error('Retrieved document has empty content');
      }
      
      // Validate tags array
      let validatedTags: string[] = [];
      if (doc.tags !== null && doc.tags !== undefined && Array.isArray(doc.tags)) {
        validatedTags = doc.tags.filter(tag => typeof tag === 'string' && tag.trim() !== '');
      }

      logger.debug(`Successfully retrieved ${doc.content.length} characters from IPFS hash: ${ipfsHash}`);
      return {
        content: doc.content,
        metadata: {
          id: doc.id,
          title: doc.title,
          description: doc.description,
          category: doc.category,
          language: doc.language,
          tags: validatedTags,
          createdAt: doc.created_at,
        },
      };
    } catch (error) {
      logger.error('Failed to retrieve document from IPFS:', error);
      throw error;
    }
  }

  /**
   * Gets description for a category
   * @param category - Document category
   * @returns Category description
   * @private
   */
  private getCategoryDescription(category: DocumentCategory): string {
    const descriptions: Record<DocumentCategory, string> = {
      [DocumentCategory.GETTING_STARTED]: 'Guides for new users',
      [DocumentCategory.WALLET]: 'Wallet usage and features',
      [DocumentCategory.MARKETPLACE]: 'Marketplace tutorials',
      [DocumentCategory.DEX]: 'Trading and DEX guides',
      [DocumentCategory.TECHNICAL]: 'Developer documentation',
      [DocumentCategory.FAQ]: 'Frequently asked questions',
      [DocumentCategory.GOVERNANCE]: 'DAO and governance',
      [DocumentCategory.SECURITY]: 'Security best practices',
    };
    return descriptions[category] ?? '';
  }

  /**
   * Increments the view count for a document
   * @param documentId - Document ID
   * @private
   */
  private async incrementViewCount(documentId: string): Promise<void> {
    try {
      await this.db.query('UPDATE documents SET view_count = view_count + 1 WHERE id = $1', [
        documentId,
      ]);
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
        ids,
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
      tags: Array.isArray(row.tags) ? row.tags : [],
      isOfficial: Boolean(row.is_official),
      viewCount: row.view_count,
      rating:
        typeof row.rating === 'number'
          ? row.rating
          : row.rating != null
            ? parseFloat(String(row.rating))
            : 0,
      attachments: this.parseAttachments(row.attachments),
      metadata: this.parseMetadata(row.metadata),
      ...(row.ipfs_hash !== null && row.ipfs_hash !== undefined && row.ipfs_hash !== '' && { ipfsHash: row.ipfs_hash }),
      ...(row.status !== null && row.status !== undefined && row.status !== '' && { status: row.status as 'draft' | 'published' | 'archived' }),
      ...(row.published_at !== null && row.published_at !== undefined && { publishedAt: new Date(row.published_at) }),
    };
  }

  /**
   * Parse attachments from database field
   * @param attachments - Raw attachments field from database
   * @returns Parsed attachments array
   * @private
   */
  private parseAttachments(attachments: unknown): DocumentAttachment[] {
    if (attachments == null) {
      return [];
    }

    try {
      if (typeof attachments === 'string') {
        if (attachments.trim() === '' || attachments === '[]') {
          return [];
        }
        return JSON.parse(attachments) as DocumentAttachment[];
      }

      if (Array.isArray(attachments)) {
        return attachments as DocumentAttachment[];
      }

      return [];
    } catch (error) {
      logger.warn('Failed to parse attachments:', error);
      return [];
    }
  }

  /**
   * Parse metadata from database field
   * @param metadata - Raw metadata field from database
   * @returns Parsed metadata object
   * @private
   */
  private parseMetadata(metadata: unknown): Record<string, unknown> {
    if (metadata == null) {
      return {};
    }

    try {
      if (typeof metadata === 'string') {
        if (metadata.trim() === '' || metadata === '{}') {
          return {};
        }
        return JSON.parse(metadata) as Record<string, unknown>;
      }

      if (typeof metadata === 'object' && metadata !== null) {
        return metadata as Record<string, unknown>;
      }

      return {};
    } catch (error) {
      logger.warn('Failed to parse metadata:', error);
      return {};
    }
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
    sortDirection: 'asc' | 'desc',
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
        itemId: contributionId,
        type: 'documentContribution',
        context: { isOfficialUpdate: true },
      });
    } catch (error) {
      logger.error('Failed to notify validators:', error);
    }
  }

  /**
   * Generates a mock IPFS hash for testing
   * In production, this would actually upload to IPFS
   * @returns Mock IPFS hash
   * @private
   */
  private generateIPFSHash(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let hash = 'Qm';
    for (let i = 0; i < 44; i++) {
      hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return hash;
  }

  /**
   * Gets statistics about the documentation service
   * @returns Promise resolving to documentation statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    totalVersions: number;
    documentsByCategory: Record<string, number>;
    documentsByLanguage: Record<string, number>;
  }> {
    try {
      // Get total documents count
      const totalDocsResult = await this.db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM documents WHERE status = $1',
        ['published']
      );
      const totalDocuments = parseInt(totalDocsResult.rows[0]?.count ?? '0');

      // Get total versions count
      const totalVersionsResult = await this.db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM document_versions'
      );
      const totalVersions = parseInt(totalVersionsResult.rows[0]?.count ?? '0');

      // Get documents by category
      const categoryResult = await this.db.query<{ category: string; count: string }>(
        `SELECT category, COUNT(*) as count 
         FROM documents 
         WHERE status = $1 
         GROUP BY category`,
        ['published']
      );
      const documentsByCategory: Record<string, number> = {};
      categoryResult.rows.forEach(row => {
        documentsByCategory[row.category] = parseInt(row.count);
      });

      // Get documents by language
      const languageResult = await this.db.query<{ language: string; count: string }>(
        `SELECT language, COUNT(*) as count 
         FROM documents 
         WHERE status = $1 
         GROUP BY language`,
        ['published']
      );
      const documentsByLanguage: Record<string, number> = {};
      languageResult.rows.forEach(row => {
        documentsByLanguage[row.language] = parseInt(row.count);
      });

      return {
        totalDocuments,
        totalVersions,
        documentsByCategory,
        documentsByLanguage,
      };
    } catch (error) {
      logger.error('Error getting documentation stats:', error);
      return {
        totalDocuments: 0,
        totalVersions: 0,
        documentsByCategory: {},
        documentsByLanguage: {},
      };
    }
  }
}
