/**
 * GraphQL Validator API Client
 *
 * Handles all communication between Documents module and Validator module using GraphQL.
 * All database operations should go through this client to the Validator API.
 *
 * @module services/validator/ValidatorAPIClientGraphQL
 */

import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import type { NormalizedCacheObject } from '@apollo/client';
import { createHttpLink } from '@apollo/client/link/http';
import fetch from 'cross-fetch';
import { logger } from '../../utils/logger';
import type { Document, DocumentCategory } from '../documentation/DocumentationService';
import type { ForumThread, ForumPost } from '../forum/ForumTypes';
import type { SupportRequest, SupportVolunteer } from '../support/SupportTypes';

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
  private apolloClient: ApolloClient<NormalizedCacheObject>;

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
      const result = await this.apolloClient.query({
        query: QUERIES.GET_DOCUMENT,
        variables: { id },
      });

      if (result.data?.getDocument) {
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
   * @returns Search results
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
      const result = await this.apolloClient.query({
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

      if (result.data?.searchDocuments) {
        return {
          items: result.data.searchDocuments.items.map((doc: any) => this.transformDocument(doc)),
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
      const result = await this.apolloClient.mutate({
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

      if (result.data?.createDocument) {
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
      const result = await this.apolloClient.mutate({
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

      if (result.data?.updateDocument) {
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
      await this.apolloClient.mutate({
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
      const result = await this.apolloClient.query({
        query: QUERIES.GET_FORUM_THREAD,
        variables: { id },
      });

      if (result.data?.getForumThread) {
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
      const result = await this.apolloClient.query({
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

      if (result.data?.searchForumThreads) {
        return {
          items: result.data.searchForumThreads.items.map((thread: any) => this.transformForumThread(thread)),
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
      const result = await this.apolloClient.mutate({
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

      if (result.data?.createForumThread) {
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
      const result = await this.apolloClient.mutate({
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

      if (result.data?.createForumPost) {
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
   */
  private transformDocument(data: any): Document {
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      content: data.content,
      category: data.category,
      language: data.language,
      version: data.version ?? 1,
      authorAddress: data.authorAddress,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      tags: data.tags ?? [],
      isOfficial: data.isOfficial ?? false,
      viewCount: data.viewCount ?? 0,
      rating: data.rating ?? 0,
      status: data.status ?? 'draft',
      metadata: data.metadata ?? {},
      attachments: data.attachments ?? [],
      ipfsHash: data.ipfsHash,
      ...(data.publishedAt && { publishedAt: new Date(data.publishedAt) }),
    };
  }

  /**
   * Transform GraphQL forum thread response to ForumThread type
   */
  private transformForumThread(data: any): ForumThread {
    return {
      id: data.id,
      title: data.title,
      category: data.category,
      authorAddress: data.authorAddress,
      authorUsername: data.authorUsername,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      viewCount: data.viewCount ?? 0,
      replyCount: data.replyCount ?? 0,
      lastReplyAt: data.lastReplyAt,
      isPinned: data.isPinned ?? false,
      isLocked: data.isLocked ?? false,
      tags: data.tags ?? [],
      score: data.score,
      metadata: data.metadata ?? {},
    };
  }

  /**
   * Transform GraphQL forum post response to ForumPost type
   */
  private transformForumPost(data: any): ForumPost {
    return {
      id: data.id,
      threadId: data.threadId,
      parentId: data.parentId,
      authorAddress: data.authorAddress,
      authorUsername: data.authorUsername,
      content: data.content,
      createdAt: data.createdAt,
      editedAt: data.editedAt,
      upvotes: data.upvotes ?? 0,
      downvotes: data.downvotes ?? 0,
      score: data.score,
      isAcceptedAnswer: data.isAcceptedAnswer ?? false,
      isDeleted: data.isDeleted ?? false,
      attachments: data.attachments ?? [],
      metadata: data.metadata ?? {},
    };
  }
}