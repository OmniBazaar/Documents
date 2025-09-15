/**
 * GraphQL Validator API Client
 *
 * Handles all communication between Documents module and Validator module using GraphQL.
 * All database operations should go through this client to the Validator API.
 *
 * @module services/validator/ValidatorAPIClientGraphQL
 */

import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { createHttpLink } from '@apollo/client/link/http';
import fetch from 'cross-fetch';
import { logger } from '../../utils/logger';
import type { Document, DocumentCategory, DocumentLanguage, DocumentAttachment } from '../documentation/DocumentationService';
import type { ForumThread, ForumPost, ForumAttachment } from '../forum/ForumTypes';

/**
 * Configuration for ValidatorAPIClient
 */
export interface ValidatorAPIConfig {
  /** GraphQL endpoint URL */
  endpoint: string;
  /** WebSocket endpoint URL for subscriptions */
  wsEndpoint?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * GraphQL response types
 */
interface GetDocumentResponse {
  getDocument: GraphQLDocument | null;
}

interface SearchDocumentsResponse {
  searchDocuments: {
    results: GraphQLDocument[];
    total: number;
    page: number;
    pageSize: number;
  };
}

interface CreateDocumentResponse {
  createDocument: GraphQLDocument;
}

interface UpdateDocumentResponse {
  updateDocument: GraphQLDocument;
}

interface GetForumThreadResponse {
  getForumThread: GraphQLForumThread | null;
}

interface SearchForumThreadsResponse {
  searchForumThreads: {
    results: GraphQLForumThread[];
    total: number;
    page: number;
    pageSize: number;
  };
}

interface CreateForumThreadResponse {
  createForumThread: GraphQLForumThread;
}

interface CreateForumPostResponse {
  createForumPost: GraphQLForumPost;
}

interface GraphQLDocument {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  language: string;
  version?: number;
  authorAddress: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  isOfficial?: boolean;
  viewCount?: number;
  rating?: number;
  ipfsHash?: string;
  attachments?: unknown[];
  status?: string;
  metadata?: Record<string, unknown>;
  publishedAt?: string;
}

interface GraphQLForumThread {
  id: string;
  title: string;
  category: string;
  authorAddress: string;
  authorUsername?: string;
  createdAt: string;
  updatedAt: string;
  viewCount?: number;
  replyCount?: number;
  lastReplyAt?: string;
  isPinned?: boolean;
  isLocked?: boolean;
  tags?: string[];
  score?: number;
  metadata?: Record<string, unknown>;
}

interface GraphQLForumPost {
  id: string;
  threadId: string;
  parentId?: string;
  authorAddress: string;
  authorUsername?: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  upvotes?: number;
  downvotes?: number;
  score?: number;
  isAcceptedAnswer?: boolean;
  isDeleted?: boolean;
  attachments?: unknown[];
  metadata?: Record<string, unknown>;
}

/**
 * GraphQL queries for document operations
 */
const QUERIES = {
  GET_DOCUMENT: gql`
    query GetDocument($id: String!) {
      getDocument(id: $id) {
        id
        title
        description
        content
        category
        language
        version
        authorAddress
        createdAt
        updatedAt
        tags
        isOfficial
        viewCount
        rating
        status
        metadata
        attachments
        ipfsHash
        publishedAt
      }
    }
  `,

  SEARCH_DOCUMENTS: gql`
    query SearchDocuments(
      $query: String
      $category: String
      $authorAddress: String
      $language: String
      $tags: [String!]
      $page: Int
      $pageSize: Int
    ) {
      searchDocuments(
        query: $query
        category: $category
        authorAddress: $authorAddress
        language: $language
        tags: $tags
        page: $page
        pageSize: $pageSize
      ) {
        items {
          id
          title
          description
          content
          category
          language
          version
          authorAddress
          createdAt
          updatedAt
          tags
          isOfficial
          viewCount
          rating
          status
        }
        total
        page
        pageSize
      }
    }
  `,

  GET_FORUM_THREAD: gql`
    query GetForumThread($id: String!) {
      getForumThread(id: $id) {
        id
        title
        category
        authorAddress
        createdAt
        updatedAt
        viewCount
        replyCount
        lastReplyAt
        isPinned
        isLocked
        tags
        metadata
      }
    }
  `,

  SEARCH_FORUM_THREADS: gql`
    query SearchForumThreads(
      $query: String
      $category: String
      $authorAddress: String
      $tags: [String!]
      $page: Int
      $pageSize: Int
    ) {
      searchForumThreads(
        query: $query
        category: $category
        authorAddress: $authorAddress
        tags: $tags
        page: $page
        pageSize: $pageSize
      ) {
        items {
          id
          title
          category
          authorAddress
          createdAt
          updatedAt
          viewCount
          replyCount
          lastReplyAt
          isPinned
          isLocked
          tags
          metadata
        }
        total
        page
        pageSize
      }
    }
  `,
};

/**
 * GraphQL mutations for document operations
 */
const MUTATIONS = {
  CREATE_DOCUMENT: gql`
    mutation CreateDocument($input: CreateDocumentInput!) {
      createDocument(input: $input) {
        id
        title
        description
        content
        category
        language
        version
        authorAddress
        createdAt
        updatedAt
        tags
        isOfficial
        viewCount
        rating
        status
      }
    }
  `,

  UPDATE_DOCUMENT: gql`
    mutation UpdateDocument($id: String!, $input: UpdateDocumentInput!) {
      updateDocument(id: $id, input: $input) {
        id
        title
        description
        content
        category
        language
        version
        authorAddress
        createdAt
        updatedAt
        tags
        isOfficial
        viewCount
        rating
        status
      }
    }
  `,

  DELETE_DOCUMENT: gql`
    mutation DeleteDocument($id: String!) {
      deleteDocument(id: $id)
    }
  `,

  CREATE_FORUM_THREAD: gql`
    mutation CreateForumThread($input: CreateForumThreadInput!) {
      createForumThread(input: $input) {
        id
        title
        category
        authorAddress
        createdAt
        updatedAt
        viewCount
        replyCount
        lastReplyAt
        isPinned
        isLocked
        tags
        metadata
      }
    }
  `,

  CREATE_FORUM_POST: gql`
    mutation CreateForumPost($input: CreateForumPostInput!) {
      createForumPost(input: $input) {
        id
        threadId
        parentId
        authorAddress
        content
        createdAt
        editedAt
        upvotes
        downvotes
        isAcceptedAnswer
        isDeleted
        attachments
        metadata
      }
    }
  `,
};

/**
 * GraphQL-based client for communicating with the Validator API
 */
export class ValidatorAPIClient {
  private apolloClient: ApolloClient;

  /**
   * Creates a new Validator API client instance
   * @param config - Client configuration
   */
  constructor(config: ValidatorAPIConfig) {

    // Create HTTP link for GraphQL endpoint
    const httpLink = createHttpLink({
      uri: `${config.endpoint}/graphql`,
      fetch: fetch as unknown as typeof globalThis.fetch,
    });

    // Initialize Apollo Client
    this.apolloClient = new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache(),
      defaultOptions: {
        query: {
          errorPolicy: 'all',
        },
        mutate: {
          errorPolicy: 'all',
        },
      },
    });

    logger.info('GraphQL ValidatorAPIClient initialized', { endpoint: config.endpoint });
  }

  /**
   * Get a document by ID
   * @param id - Document ID
   * @returns Document or null if not found
   */
  async getDocument(id: string): Promise<Document | null> {
    try {
      const result = await this.apolloClient.query<GetDocumentResponse>({
        query: QUERIES.GET_DOCUMENT,
        variables: { id },
      });

      if (result.data?.getDocument !== null && result.data?.getDocument !== undefined) {
        return this.transformDocument(result.data.getDocument);
      }

      return null;
    } catch (error) {
      logger.error('Failed to get document', { id, error });
      return null;
    }
  }

  /**
   * Search documents
   * @param params - Search parameters
   * @param params.query - Optional search query text
   * @param params.category - Optional document category filter
   * @param params.authorAddress - Optional author address filter
   * @param params.language - Optional language filter
   * @param params.tags - Optional tags filter
   * @param params.page - Optional page number (defaults to 1)
   * @param params.pageSize - Optional page size (defaults to 20)
   * @returns Search results with items, total count, and pagination info
   */
  async searchDocuments(params: {
    query?: string;
    category?: DocumentCategory;
    authorAddress?: string;
    language?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: Document[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const result = await this.apolloClient.query<SearchDocumentsResponse>({
        query: QUERIES.SEARCH_DOCUMENTS,
        variables: {
          query: params.query,
          category: params.category,
          authorAddress: params.authorAddress,
          language: params.language,
          tags: params.tags,
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 20,
        },
      });

      if (result.data?.searchDocuments !== undefined) {
        return {
          items: result.data.searchDocuments.results.map((doc) => this.transformDocument(doc)),
          total: result.data.searchDocuments.total,
          page: result.data.searchDocuments.page,
          pageSize: result.data.searchDocuments.pageSize,
        };
      }

      return { items: [], total: 0, page: 1, pageSize: 20 };
    } catch (error) {
      logger.error('Failed to search documents', { params, error });
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  /**
   * Create a new document
   * @param document - Document data
   * @returns Created document
   */
  async createDocument(document: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
    try {
      const result = await this.apolloClient.mutate<CreateDocumentResponse>({
        mutation: MUTATIONS.CREATE_DOCUMENT,
        variables: {
          input: {
            title: document.title,
            description: document.description,
            content: document.content,
            category: document.category,
            language: document.language,
            version: document.version,
            authorAddress: document.authorAddress,
            tags: document.tags,
            isOfficial: document.isOfficial,
            status: document.status,
            metadata: document.metadata,
          },
        },
      });

      if (result.data?.createDocument !== undefined) {
        return this.transformDocument(result.data.createDocument);
      }

      throw new Error('Failed to create document');
    } catch (error) {
      logger.error('Failed to create document', { document, error });
      throw error;
    }
  }

  /**
   * Update a document
   * @param id - Document ID
   * @param updates - Fields to update
   * @returns Updated document
   */
  async updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
    try {
      const result = await this.apolloClient.mutate<UpdateDocumentResponse>({
        mutation: MUTATIONS.UPDATE_DOCUMENT,
        variables: {
          id,
          input: {
            title: updates.title,
            description: updates.description,
            content: updates.content,
            category: updates.category,
            language: updates.language,
            version: updates.version,
            tags: updates.tags,
            status: updates.status,
            metadata: updates.metadata,
          },
        },
      });

      if (result.data?.updateDocument !== undefined) {
        return this.transformDocument(result.data.updateDocument);
      }

      throw new Error('Failed to update document');
    } catch (error) {
      logger.error('Failed to update document', { id, updates, error });
      throw error;
    }
  }

  /**
   * Delete a document
   * @param id - Document ID
   */
  async deleteDocument(id: string): Promise<void> {
    try {
      await this.apolloClient.mutate<{ deleteDocument: boolean }>({
        mutation: MUTATIONS.DELETE_DOCUMENT,
        variables: { id },
      });
    } catch (error) {
      logger.error('Failed to delete document', { id, error });
      throw error;
    }
  }

  /**
   * Get a forum thread by ID
   * @param id - Thread ID
   * @returns Forum thread or null if not found
   */
  async getForumThread(id: string): Promise<ForumThread | null> {
    try {
      const result = await this.apolloClient.query<GetForumThreadResponse>({
        query: QUERIES.GET_FORUM_THREAD,
        variables: { id },
      });

      if (result.data?.getForumThread !== null && result.data?.getForumThread !== undefined) {
        return this.transformForumThread(result.data.getForumThread);
      }

      return null;
    } catch (error) {
      logger.error('Failed to get forum thread', { id, error });
      return null;
    }
  }

  /**
   * Search forum threads
   * @param params - Search parameters
   * @param params.query - Optional search query text
   * @param params.category - Optional category filter
   * @param params.authorAddress - Optional author address filter
   * @param params.tags - Optional tags filter
   * @param params.page - Optional page number (defaults to 1)
   * @param params.pageSize - Optional page size (defaults to 20)
   * @returns Search results
   */
  async searchForumThreads(params: {
    query?: string;
    category?: string;
    authorAddress?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: ForumThread[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const result = await this.apolloClient.query<SearchForumThreadsResponse>({
        query: QUERIES.SEARCH_FORUM_THREADS,
        variables: {
          query: params.query,
          category: params.category,
          authorAddress: params.authorAddress,
          tags: params.tags,
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 20,
        },
      });

      if (result.data?.searchForumThreads !== undefined) {
        return {
          items: result.data.searchForumThreads.results.map((thread) => this.transformForumThread(thread)),
          total: result.data.searchForumThreads.total,
          page: result.data.searchForumThreads.page,
          pageSize: result.data.searchForumThreads.pageSize,
        };
      }

      return { items: [], total: 0, page: 1, pageSize: 20 };
    } catch (error) {
      logger.error('Failed to search forum threads', { params, error });
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  /**
   * Create a forum thread
   * @param thread - Thread data
   * @returns Created thread
   */
  async createForumThread(thread: Omit<ForumThread, 'id' | 'createdAt' | 'updatedAt'>): Promise<ForumThread> {
    try {
      const result = await this.apolloClient.mutate<CreateForumThreadResponse>({
        mutation: MUTATIONS.CREATE_FORUM_THREAD,
        variables: {
          input: {
            title: thread.title,
            category: thread.category,
            authorAddress: thread.authorAddress,
            tags: thread.tags,
            isPinned: thread.isPinned,
            isLocked: thread.isLocked,
            metadata: thread.metadata,
          },
        },
      });

      if (result.data?.createForumThread !== undefined) {
        return this.transformForumThread(result.data.createForumThread);
      }

      throw new Error('Failed to create forum thread');
    } catch (error) {
      logger.error('Failed to create forum thread', { thread, error });
      throw error;
    }
  }

  /**
   * Create a forum post
   * @param post - Post data
   * @returns Created post
   */
  async createForumPost(post: Omit<ForumPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<ForumPost> {
    try {
      const result = await this.apolloClient.mutate<CreateForumPostResponse>({
        mutation: MUTATIONS.CREATE_FORUM_POST,
        variables: {
          input: {
            threadId: post.threadId,
            parentId: post.parentId,
            authorAddress: post.authorAddress,
            content: post.content,
            attachments: post.attachments,
            metadata: post.metadata,
          },
        },
      });

      if (result.data?.createForumPost !== undefined) {
        return this.transformForumPost(result.data.createForumPost);
      }

      throw new Error('Failed to create forum post');
    } catch (error) {
      logger.error('Failed to create forum post', { post, error });
      throw error;
    }
  }

  /**
   * Transform GraphQL document response to Document type
   * @param data - GraphQL document data
   * @returns Transformed document
   */
  private transformDocument(data: GraphQLDocument): Document {
    const doc: Document = {
      id: data.id,
      title: data.title,
      description: data.description,
      content: data.content,
      category: data.category as DocumentCategory,
      language: data.language as DocumentLanguage,
      version: data.version ?? 1,
      authorAddress: data.authorAddress,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      tags: data.tags ?? [],
      isOfficial: data.isOfficial ?? false,
      viewCount: data.viewCount ?? 0,
      rating: data.rating ?? 0,
      status: (data.status ?? 'draft') as 'draft' | 'published' | 'archived',
      metadata: data.metadata ?? {},
      attachments: (data.attachments ?? []) as DocumentAttachment[],
    };

    if (data.ipfsHash !== undefined) {
      doc.ipfsHash = data.ipfsHash;
    }

    if (data.publishedAt !== undefined) {
      doc.publishedAt = new Date(data.publishedAt);
    }

    return doc;
  }

  /**
   * Transform GraphQL forum thread response to ForumThread type
   * @param data - GraphQL forum thread data
   * @returns Transformed forum thread
   */
  private transformForumThread(data: GraphQLForumThread): ForumThread {
    const thread: ForumThread = {
      id: data.id,
      title: data.title,
      category: data.category,
      authorAddress: data.authorAddress,
      createdAt: new Date(data.createdAt).getTime(),
      updatedAt: new Date(data.updatedAt).getTime(),
      viewCount: data.viewCount ?? 0,
      replyCount: data.replyCount ?? 0,
      lastReplyAt: data.lastReplyAt !== undefined ? new Date(data.lastReplyAt).getTime() : Date.now(),
      isPinned: data.isPinned ?? false,
      isLocked: data.isLocked ?? false,
      tags: data.tags ?? [],
      metadata: data.metadata ?? {},
    };

    if (data.authorUsername !== undefined) {
      thread.authorUsername = data.authorUsername;
    }

    if (data.score !== undefined) {
      thread.score = data.score;
    }

    return thread;
  }

  /**
   * Transform GraphQL forum post response to ForumPost type
   * @param data - GraphQL forum post data
   * @returns Transformed forum post
   */
  private transformForumPost(data: GraphQLForumPost): ForumPost {
    const post: ForumPost = {
      id: data.id,
      threadId: data.threadId,
      authorAddress: data.authorAddress,
      content: data.content,
      createdAt: new Date(data.createdAt).getTime(),
      editedAt: data.editedAt !== undefined ? new Date(data.editedAt).getTime() : null,
      upvotes: data.upvotes ?? 0,
      downvotes: data.downvotes ?? 0,
      isAcceptedAnswer: data.isAcceptedAnswer ?? false,
      isDeleted: data.isDeleted ?? false,
      attachments: (data.attachments ?? []) as ForumAttachment[],
      metadata: data.metadata ?? {},
    };

    if (data.parentId !== undefined) {
      post.parentId = data.parentId;
    }

    if (data.authorUsername !== undefined) {
      post.authorUsername = data.authorUsername;
    }

    if (data.score !== undefined) {
      post.score = data.score;
    }

    return post;
  }
}