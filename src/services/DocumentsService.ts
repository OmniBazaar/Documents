/**
 * Documents Service - Document and Forum Hosting
 *
 * Manages distributed document storage and forum functionality
 * through the Avalanche validator's GraphQL API and IPFS.
 *
 * Migrated from KYC/src/services/ValidatorDocuments.ts
 */

import {
  OmniValidatorClient,
  createOmniValidatorClient,
  type OmniValidatorClientConfig,
} from '../types/ValidatorTypes';
import { logger } from '../utils/logger';

/**
 * Configuration for the Documents Service
 * @interface DocumentsServiceConfig
 */
export interface DocumentsServiceConfig extends OmniValidatorClientConfig {
  /** Network identifier */
  networkId: string;
  /** Maximum document size in bytes */
  maxDocumentSize: number;
  /** Allowed MIME types for document uploads */
  allowedFileTypes: string[];
  /** Available forum categories */
  forumCategories: string[];
  /** Whether content moderation is enabled */
  moderationEnabled: boolean;
}

/**
 * Document stored in the system
 * @interface Document
 */
export interface Document {
  /** Unique document identifier */
  documentId: string;
  /** Document title */
  title: string;
  /** Document content */
  content: string;
  /** Author's address */
  author: string;
  /** Document category */
  category: string;
  /** Document type */
  type: 'document' | 'guide' | 'announcement' | 'policy';
  /** Version number */
  version: number;
  /** IPFS hash of the content */
  ipfsHash: string;
  /** Creation timestamp */
  timestamp: number;
  /** Last modification timestamp */
  lastModified: number;
  /** Document tags for categorization */
  tags: string[];
  /** Document metadata */
  metadata: {
    /** File size in bytes */
    fileSize?: number;
    /** MIME type */
    mimeType?: string;
    /** Document language */
    language?: string;
    /** Estimated read time in minutes */
    readTime?: number;
  };
  /** Access permissions */
  permissions: {
    /** Whether the document is publicly accessible */
    public: boolean;
    /** List of addresses that can edit */
    editors: string[];
    /** List of addresses that can view (if not public) */
    viewers: string[];
  };
}

/**
 * Forum post in the system
 * @interface ForumPost
 */
export interface ForumPost {
  /** Unique post identifier */
  postId: string;
  /** Author's address */
  author: string;
  /** Author's username if available */
  authorUsername?: string;
  /** Post title */
  title: string;
  /** Post content */
  content: string;
  /** Post category */
  category: string;
  /** Creation timestamp */
  timestamp: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Number of replies */
  replies: number;
  /** Number of likes */
  likes: number;
  /** Number of views */
  views: number;
  /** Whether the post is pinned */
  isPinned: boolean;
  /** Whether the post is locked */
  isLocked: boolean;
  /** Post tags */
  tags: string[];
  /** IPFS hash of the content */
  ipfsHash: string;
}

/**
 * Reply to a forum post
 * @interface ForumReply
 */
export interface ForumReply {
  /** Unique reply identifier */
  replyId: string;
  /** Parent post identifier */
  postId: string;
  /** Author's address */
  author: string;
  /** Author's username if available */
  authorUsername?: string;
  /** Reply content */
  content: string;
  /** Creation timestamp */
  timestamp: number;
  /** Number of likes */
  likes: number;
  /** ID of the reply this is responding to */
  replyTo?: string;
  /** Whether the reply has been edited */
  isEdited: boolean;
  /** Edit timestamp */
  editedAt?: number;
  /** IPFS hash of the content */
  ipfsHash: string;
}

/**
 * Search result item
 * @interface SearchResult
 */
export interface SearchResult {
  /** Type of result */
  type: 'document' | 'post' | 'reply';
  /** Result item ID */
  id: string;
  /** Result title */
  title: string;
  /** Content excerpt */
  excerpt: string;
  /** Author address */
  author: string;
  /** Item category */
  category: string;
  /** Creation timestamp */
  timestamp: number;
  /** Relevance score */
  relevance: number;
}

/**
 * Service for managing documents and forum posts
 * @class DocumentsService
 */
export class DocumentsService {
  private client: OmniValidatorClient;
  private config: DocumentsServiceConfig;
  private isInitialized = false;
  private documentCache: Map<string, Document> = new Map();
  private postCache: Map<string, ForumPost> = new Map();

  /**
   * Creates an instance of DocumentsService
   * @param {DocumentsServiceConfig} config - Service configuration
   */
  constructor(config: DocumentsServiceConfig) {
    this.config = config;
    this.client = createOmniValidatorClient({
      validatorEndpoint: config.validatorEndpoint,
      ...(config.wsEndpoint !== undefined && { wsEndpoint: config.wsEndpoint }),
      ...(config.apiKey !== undefined && { apiKey: config.apiKey }),
      ...(config.timeout !== undefined && { timeout: config.timeout }),
      ...(config.retryAttempts !== undefined && { retryAttempts: config.retryAttempts }),
    });
  }

  /**
   * Initialize documents service
   */
  async initialize(): Promise<void> {
    try {
      // Check validator health
      const health = await this.client.getHealth();
      if (health.services.storage !== true) {
        throw new Error('Validator storage service is not available');
      }

      // Load document index
      await this.loadDocumentIndex();

      // Load forum categories
      await this.loadForumCategories();

      this.isInitialized = true;
      logger.info('Documents Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Documents Service:', error);
      throw error;
    }
  }

  /**
   * Create a new document
   * @param title - Document title
   * @param content - Document content
   * @param author - Author's address
   * @param category - Document category
   * @param type - Document type
   * @param tags - Document tags
   * @param permissions - Access permissions
   * @returns Promise resolving to the created document
   */
  async createDocument(
    title: string,
    content: string,
    author: string,
    category: string,
    type: Document['type'],
    tags: string[] = [],
    permissions?: Document['permissions'],
  ): Promise<Document> {
    this.ensureInitialized();

    try {
      // Validate document
      this.validateDocument(title, content, category);

      // Generate document ID
      const documentId = this.generateDocumentId();

      // Store document content
      const ipfsHash = await this.client.storeData(content, {
        type: 'document_content',
        documentId,
        title,
        author,
      });

      // Create document object
      const document: Document = {
        documentId,
        title,
        content,
        author,
        category,
        type,
        version: 1,
        ipfsHash,
        timestamp: Date.now(),
        lastModified: Date.now(),
        tags,
        metadata: {
          fileSize: Buffer.byteLength(content, 'utf8'),
          mimeType: 'text/plain',
          language: 'en',
          readTime: Math.ceil(content.split(' ').length / 200), // Assuming 200 words per minute
        },
        permissions: permissions ?? {
          public: true,
          editors: [author],
          viewers: [],
        },
      };

      // Store document metadata
      await this.client.storeDocument(JSON.stringify(document), {
        type: 'document_metadata',
        documentId,
        category,
        author,
      });

      // Update cache
      this.documentCache.set(documentId, document);

      // Index document for search
      this.indexDocument(document);

      logger.info(`Document created: ${documentId}`);
      return document;
    } catch (error) {
      logger.error('Error creating document:', error);
      throw error;
    }
  }

  /**
   * Retrieve a document
   * @param documentId - Document ID to retrieve
   * @returns Promise resolving to the document or null if not found
   */
  async getDocument(documentId: string): Promise<Document | null> {
    this.ensureInitialized();

    try {
      // Check cache first
      if (this.documentCache.has(documentId)) {
        // Safe because we checked has() above
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.documentCache.get(documentId)!;
      }

      // Load from validator
      const doc = await this.client.retrieveDocument(documentId);
      if (doc === null || doc === undefined || doc.content === undefined || doc.content === '') {
        return null;
      }

      const document = JSON.parse(doc.content) as Document;

      // Load content from IPFS if not included
      if (
        (document.content === undefined || document.content === '') &&
        document.ipfsHash !== undefined &&
        document.ipfsHash !== ''
      ) {
        const content = await this.client.retrieveData(document.ipfsHash);
        if (content !== null && content !== undefined) {
          document.content = content;
        }
      }

      // Update cache
      this.documentCache.set(documentId, document);

      return document;
    } catch (error) {
      logger.error('Error retrieving document:', error);
      return null;
    }
  }

  /**
   * Update a document
   * @param documentId - Document ID to update
   * @param updates - Updates to apply
   * @param updates.title - New title
   * @param updates.content - New content
   * @param updates.category - New category
   * @param updates.tags - New tags
   * @param editor - Editor's address
   * @returns Promise resolving to the updated document
   */
  async updateDocument(
    documentId: string,
    updates: {
      title?: string;
      content?: string;
      category?: string;
      tags?: string[];
    },
    editor: string,
  ): Promise<Document> {
    this.ensureInitialized();

    try {
      const document = await this.getDocument(documentId);
      if (document === null || document === undefined) {
        throw new Error('Document not found');
      }

      // Check permissions
      if (!this.canEdit(document, editor)) {
        throw new Error('Unauthorized: cannot edit this document');
      }

      // Update content if changed
      let newIpfsHash = document.ipfsHash;
      if (
        updates.content !== undefined &&
        updates.content !== '' &&
        updates.content !== document.content
      ) {
        newIpfsHash = await this.client.storeData(updates.content, {
          type: 'document_content',
          documentId,
          version: document.version + 1,
        });
      }

      // Create updated document
      const updatedDocument: Document = {
        ...document,
        ...updates,
        version: document.version + 1,
        ipfsHash: newIpfsHash,
        lastModified: Date.now(),
        metadata: {
          ...document.metadata,
          ...(updates.content !== undefined &&
            updates.content !== '' && {
              fileSize: Buffer.byteLength(updates.content, 'utf8'),
              readTime: Math.ceil(updates.content.split(' ').length / 200),
            }),
        },
      };

      // Store updated metadata
      await this.client.storeDocument(JSON.stringify(updatedDocument), {
        type: 'document_metadata',
        documentId,
        category: updatedDocument.category,
        version: updatedDocument.version,
      });

      // Update cache
      this.documentCache.set(documentId, updatedDocument);

      // Re-index for search
      this.indexDocument(updatedDocument);

      logger.info(`Document updated: ${documentId} (v${updatedDocument.version}`);
      return updatedDocument;
    } catch (error) {
      logger.error('Error updating document:', error);
      throw error;
    }
  }

  /**
   * Delete a document
   * @param documentId - Document ID to delete
   * @param author - Author's address
   * @returns Promise resolving to true if deleted successfully
   */
  async deleteDocument(documentId: string, author: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const document = await this.getDocument(documentId);
      if (document === null || document === undefined) {
        throw new Error('Document not found');
      }

      // Check permissions
      if (document.author !== author) {
        throw new Error('Unauthorized: only the author can delete this document');
      }

      // Mark as deleted (soft delete)
      const deletedDocument = {
        ...document,
        metadata: {
          ...document.metadata,
          deleted: true,
          deletedAt: Date.now(),
          deletedBy: author,
        },
      };

      await this.client.storeDocument(JSON.stringify(deletedDocument), {
        type: 'document_metadata',
        documentId,
        deleted: true,
      });

      // Remove from cache
      this.documentCache.delete(documentId);

      logger.info(`Document deleted: ${documentId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Create a forum post
   * @param author - Author's address
   * @param title - Post title
   * @param content - Post content
   * @param category - Post category
   * @param tags - Post tags
   * @returns Promise resolving to the created forum post
   */
  async createForumPost(
    author: string,
    title: string,
    content: string,
    category: string,
    tags: string[] = [],
  ): Promise<ForumPost> {
    this.ensureInitialized();

    try {
      // Validate forum post
      this.validateForumPost(title, content, category);

      // Get author username
      const authorUsername = await this.getUsername(author);

      // Create post via validator
      const postId = await this.client.createForumPost(author, title, content, category);

      // Create post object
      const post: ForumPost = {
        postId,
        author,
        ...(authorUsername !== undefined && { authorUsername }),
        title,
        content,
        category,
        timestamp: Date.now(),
        lastActivity: Date.now(),
        replies: 0,
        likes: 0,
        views: 0,
        isPinned: false,
        isLocked: false,
        tags,
        ipfsHash: '', // Will be set by validator
      };

      // Update cache
      this.postCache.set(postId, post);

      logger.info(`Forum post created: ${postId}`);
      return post;
    } catch (error) {
      logger.error('Error creating forum post:', error);
      throw error;
    }
  }

  /**
   * Search documents and forum posts
   * @param query - Search query
   * @param options - Search options
   * @param options.type - Type of content to search
   * @param options.category - Category to filter by
   * @param options.author - Author to filter by
   * @param options.limit - Maximum results to return
   * @param options.offset - Offset for pagination
   * @returns Array of search results
   */
  search(
    query: string,
    options: {
      type?: 'all' | 'documents' | 'posts';
      category?: string;
      author?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<SearchResult[]> {
    this.ensureInitialized();

    try {
      const { type = 'all', category, author, limit = 20, offset = 0 } = options;

      const results: SearchResult[] = [];
      const normalizedQuery = query.toLowerCase();

      // Search documents
      if (type === 'all' || type === 'documents') {
        const documents = Array.from(this.documentCache.values());
        for (const doc of documents) {
          if (this.matchesSearch(doc, normalizedQuery, category, author)) {
            results.push({
              type: 'document',
              id: doc.documentId,
              title: doc.title,
              excerpt: this.getExcerpt(doc.content, normalizedQuery),
              author: doc.author,
              category: doc.category,
              timestamp: doc.timestamp,
              relevance: this.calculateRelevance(doc, normalizedQuery),
            });
          }
        }
      }

      // Search forum posts
      if (type === 'all' || type === 'posts') {
        const posts = Array.from(this.postCache.values());
        for (const post of posts) {
          if (this.matchesSearch(post, normalizedQuery, category, author)) {
            results.push({
              type: 'post',
              id: post.postId,
              title: post.title,
              excerpt: this.getExcerpt(post.content, normalizedQuery),
              author: post.author,
              category: post.category,
              timestamp: post.timestamp,
              relevance: this.calculateRelevance(post, normalizedQuery),
            });
          }
        }
      }

      // Sort by relevance and apply pagination
      return Promise.resolve(
        results.sort((a, b) => b.relevance - a.relevance).slice(offset, offset + limit),
      );
    } catch (error) {
      logger.error('Error searching:', error);
      return Promise.resolve([]);
    }
  }

  /**
   * Get document categories
   * @returns Array of document category names
   */
  getDocumentCategories(): string[] {
    return ['guides', 'policies', 'announcements', 'technical', 'legal', 'support'];
  }

  /**
   * Get forum categories
   * @returns Array of forum category names
   */
  getForumCategories(): string[] {
    return this.config.forumCategories;
  }

  /**
   * Disconnect service
   * @returns Promise resolving when disconnected
   */
  async disconnect(): Promise<void> {
    try {
      // Save indexes
      await this.saveDocumentIndex();

      // Close client
      // Client close method doesn't return a promise
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this.client as any).close?.();

      this.isInitialized = false;
      logger.info('Documents Service disconnected');
    } catch (error) {
      logger.error('Error disconnecting documents service:', error);
    }
  }

  // Private helper methods
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Documents service not initialized. Call initialize() first.');
    }
  }

  private validateDocument(title: string, content: string, category: string): void {
    if (title === undefined || title === '' || title.length < 3) {
      throw new Error('Title must be at least 3 characters');
    }

    if (content === undefined || content === '' || content.length < 10) {
      throw new Error('Content must be at least 10 characters');
    }

    if (!this.getDocumentCategories().includes(category)) {
      throw new Error('Invalid document category');
    }

    const size = Buffer.byteLength(content, 'utf8');
    if (size > this.config.maxDocumentSize) {
      throw new Error(`Document size exceeds limit of ${this.config.maxDocumentSize} bytes`);
    }
  }

  private validateForumPost(title: string, content: string, category: string): void {
    if (title === undefined || title === '' || title.length < 5) {
      throw new Error('Title must be at least 5 characters');
    }

    if (content === undefined || content === '' || content.length < 20) {
      throw new Error('Content must be at least 20 characters');
    }

    if (!this.config.forumCategories.includes(category)) {
      throw new Error('Invalid forum category');
    }
  }

  private canEdit(document: Document, editor: string): boolean {
    return document.author === editor || document.permissions.editors.includes(editor);
  }

  private async getUsername(address: string): Promise<string | undefined> {
    try {
      const username = await this.client.lookupAddress(address);
      return username !== null && username !== undefined && username !== '' ? username : undefined;
    } catch (error) {
      return undefined;
    }
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private indexDocument(document: Document): void {
    // In a real implementation, this would update a search index
    logger.info(`Document indexed: ${document.documentId}`);
  }

  private matchesSearch(
    item: Document | ForumPost,
    query: string,
    category?: string,
    author?: string,
  ): boolean {
    // Category filter
    if (category !== undefined && category !== '' && item.category !== category) {
      return false;
    }

    // Author filter
    if (author !== undefined && author !== '' && item.author !== author) {
      return false;
    }

    // Text search
    const searchableText = `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase();
    return searchableText.includes(query);
  }

  private calculateRelevance(item: Document | ForumPost, query: string): number {
    let relevance = 0;
    const lowerTitle = item.title.toLowerCase();
    const lowerContent = item.content.toLowerCase();

    // Title matches are more relevant
    if (lowerTitle.includes(query)) {
      relevance += 10;
      if (lowerTitle === query) {
        relevance += 20;
      }
    }

    // Content matches
    const contentMatches = (lowerContent.match(new RegExp(query, 'g')) ?? []).length;
    relevance += Math.min(contentMatches * 2, 20);

    // Tag matches
    if (item.tags.some(tag => tag.toLowerCase().includes(query))) {
      relevance += 5;
    }

    // Recency bonus
    const daysSinceCreated = (Date.now() - item.timestamp) / (24 * 60 * 60 * 1000);
    if (daysSinceCreated < 7) {
      relevance += 5;
    } else if (daysSinceCreated < 30) {
      relevance += 2;
    }

    return relevance;
  }

  private getExcerpt(content: string, query: string, maxLength: number = 200): string {
    const lowerContent = content.toLowerCase();
    const queryIndex = lowerContent.indexOf(query);

    if (queryIndex === -1) {
      return content.substring(0, maxLength) + '...';
    }

    // Try to show the query in context
    const start = Math.max(0, queryIndex - 50);
    const end = Math.min(content.length, queryIndex + query.length + 150);
    let excerpt = content.substring(start, end);

    if (start > 0) excerpt = '...' + excerpt;
    if (end < content.length) excerpt = excerpt + '...';

    return excerpt;
  }

  private async loadDocumentIndex(): Promise<void> {
    try {
      const doc = await this.client.retrieveDocument('document_index');
      if (doc !== null && doc !== undefined && doc.content !== undefined && doc.content !== '') {
        const documentIds = JSON.parse(doc.content) as string[];

        // Load documents in parallel
        const loadPromises = documentIds.map(id => this.getDocument(id));
        await Promise.all(loadPromises);

        logger.info(`Loaded ${this.documentCache.size} documents from index`);
      }
    } catch (error) {
      logger.error('Error loading document index:', error);
    }
  }

  private async saveDocumentIndex(): Promise<void> {
    try {
      const documentIds = Array.from(this.documentCache.keys());
      await this.client.storeDocument(JSON.stringify(documentIds), {
        type: 'document_index',
        count: documentIds.length,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('Error saving document index:', error);
    }
  }

  private async loadForumCategories(): Promise<void> {
    try {
      const doc = await this.client.retrieveDocument('forum_categories');
      if (doc !== null && doc !== undefined && doc.content !== undefined && doc.content !== '') {
        const categories = JSON.parse(doc.content) as string[];
        this.config.forumCategories.push(...categories);
      }
    } catch (error) {
      logger.error('Error loading forum categories:', error);
    }
  }
}

// Export configured instance
export const documentsService = new DocumentsService({
  validatorEndpoint: process.env.VALIDATOR_ENDPOINT ?? 'http://localhost:4000',
  wsEndpoint: process.env.VALIDATOR_WS_ENDPOINT ?? 'ws://localhost:4000/graphql',
  ...(process.env.VALIDATOR_API_KEY !== undefined && { apiKey: process.env.VALIDATOR_API_KEY }),
  networkId: process.env.NETWORK_ID ?? 'omnibazaar-mainnet',
  maxDocumentSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['text/plain', 'text/markdown', 'text/html', 'application/pdf'],
  forumCategories: ['general', 'marketplace', 'technical', 'trading', 'support', 'announcements'],
  moderationEnabled: true,
  timeout: 30000,
  retryAttempts: 3,
});

export default DocumentsService;
