/**
 * GraphQL Client for Documents API
 *
 * Provides a lightweight GraphQL client for the Documents module to
 * interact with the Validator's GraphQL API. Follows the same pattern
 * as the Bazaar module for consistency.
 *
 * @module api/graphqlClient
 */

import { logger } from '../utils/logger';

const GRAPHQL_URL = process.env['REACT_APP_GRAPHQL_URL'] ?? 'http://localhost:4000/graphql';

/**
 * Document type from GraphQL schema
 */
export interface Document {
  /** Unique document ID */
  id: string;
  /** Document title */
  title: string;
  /** Document description */
  description: string;
  /** Document content */
  content: string;
  /** Document category */
  category: string;
  /** Author wallet address */
  authorAddress: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Document tags */
  tags: string[];
  /** Whether document is official */
  isOfficial: boolean;
  /** View count */
  viewCount: number;
  /** Average rating */
  rating: number | null;
  /** IPFS hash */
  ipfsHash: string | null;
  /** Document status */
  status: string;
  /** Document language */
  language: string;
  /** Document version */
  version: number;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Publication timestamp */
  publishedAt: number | null;
}

/**
 * Forum thread type
 */
export interface ForumThread {
  /** Thread ID */
  id: string;
  /** Thread title */
  title: string;
  /** Thread category */
  category: string;
  /** Author address */
  authorAddress: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** View count */
  viewCount: number;
  /** Reply count */
  replyCount: number;
  /** Last reply timestamp */
  lastReplyAt: number;
  /** Whether thread is pinned */
  isPinned: boolean;
  /** Whether thread is locked */
  isLocked: boolean;
  /** Thread tags */
  tags: string[];
  /** Thread metadata */
  metadata: Record<string, unknown>;
}

/**
 * Forum post type
 */
export interface ForumPost {
  /** Post ID */
  id: string;
  /** Thread ID */
  threadId: string;
  /** Author address */
  authorAddress: string;
  /** Post content */
  content: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Parent post ID */
  parentId?: string;
  /** Edit timestamp */
  editedAt: number | null;
  /** Upvote count */
  upvotes: number;
  /** Downvote count */
  downvotes: number;
  /** Whether post is accepted answer */
  isAcceptedAnswer: boolean;
  /** Whether post is deleted */
  isDeleted: boolean;
  /** Post attachments */
  attachments: string[];
  /** Post metadata */
  metadata: Record<string, unknown>;
}

/**
 * Support request type
 */
export interface SupportRequest {
  /** Request ID */
  id: string;
  /** User address */
  userAddress: string;
  /** Request category */
  category: string;
  /** Request priority */
  priority: string;
  /** Request status */
  status: string;
  /** Initial message */
  initialMessage: string;
  /** Request language */
  language: string;
  /** User score */
  userScore: number;
  /** Assigned volunteer */
  assignedVolunteer: string | null;
  /** Creation timestamp */
  createdAt: number;
  /** Resolution timestamp */
  resolvedAt: number | null;
  /** Resolution rating */
  resolutionRating: number | null;
  /** Request metadata */
  metadata: Record<string, unknown>;
}

/**
 * GraphQL queries
 */
export const queries = {
  getDocument: `
    query GetDocument($id: String!) {
      getDocument(id: $id) {
        id
        title
        description
        content
        category
        authorAddress
        createdAt
        updatedAt
        tags
        isOfficial
        viewCount
        rating
        ipfsHash
        status
        language
        version
        metadata
        publishedAt
      }
    }
  `,

  searchDocuments: `
    query SearchDocuments(
      $query: String
      $category: DocumentCategory
      $authorAddress: String
      $language: DocumentLanguage
      $tags: [String!]
      $officialOnly: Boolean
      $minRating: Float
      $page: Int
      $pageSize: Int
      $sortBy: String
      $sortDirection: String
      $status: DocumentStatus
    ) {
      searchDocuments(
        query: $query
        category: $category
        authorAddress: $authorAddress
        language: $language
        tags: $tags
        officialOnly: $officialOnly
        minRating: $minRating
        page: $page
        pageSize: $pageSize
        sortBy: $sortBy
        sortDirection: $sortDirection
        status: $status
      ) {
        items {
          id
          title
          description
          category
          authorAddress
          createdAt
          updatedAt
          tags
          isOfficial
          viewCount
          rating
        }
        total
        page
        pageSize
      }
    }
  `,

  getForumThread: `
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

  searchForumThreads: `
    query SearchForumThreads($filters: ForumSearchInput!) {
      searchForumThreads(filters: $filters) {
        items {
          id
          title
          category
          authorAddress
          createdAt
          replyCount
          lastReplyAt
          isPinned
        }
        total
        page
        pageSize
      }
    }
  `,

  getThreadPosts: `
    query GetThreadPosts($threadId: String!, $page: Int, $pageSize: Int) {
      threadPosts(threadId: $threadId, page: $page, pageSize: $pageSize) {
        id
        threadId
        authorAddress
        content
        createdAt
        updatedAt
        parentId
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

  getSupportRequest: `
    query GetSupportRequest($id: String!) {
      getSupportRequest(id: $id) {
        id
        userAddress
        category
        priority
        status
        initialMessage
        language
        userScore
        assignedVolunteer
        createdAt
        resolvedAt
        resolutionRating
        metadata
      }
    }
  `,
};

/**
 * GraphQL mutations
 */
export const mutations = {
  createDocument: `
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
        metadata
        attachments {
          filename
          mimeType
          size
          url
          ipfsHash
        }
        ipfsHash
        publishedAt
      }
    }
  `,

  updateDocument: `
    mutation UpdateDocument($id: String!, $input: UpdateDocumentInput!) {
      updateDocument(id: $id, input: $input) {
        id
        title
        updatedAt
      }
    }
  `,

  createForumThread: `
    mutation CreateForumThread($input: CreateForumThreadInput!) {
      createForumThread(input: $input) {
        id
        title
      }
    }
  `,

  createForumPost: `
    mutation CreateForumPost($input: CreateForumPostInput!) {
      createForumPost(input: $input) {
        id
        threadId
      }
    }
  `,

  updateForumThread: `
    mutation UpdateForumThread($id: String!, $input: UpdateForumThreadInput!) {
      updateForumThread(id: $id, input: $input) {
        id
        title
        updatedAt
      }
    }
  `,

  createSupportRequest: `
    mutation CreateSupportRequest($input: CreateSupportRequestInput!) {
      createSupportRequest(input: $input) {
        id
        status
      }
    }
  `,
};

/**
 * GraphQL response structure
 */
interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: Record<string, unknown>;
  }>;
}

/**
 * GraphQL client for Documents module
 */
export class DocumentsGraphQLClient {
  private url: string;

  /**
   * Creates a new GraphQL client instance
   * @param url - GraphQL endpoint URL
   */
  constructor(url: string = GRAPHQL_URL) {
    this.url = url;
  }

  /**
   * Execute GraphQL query
   * @param query - GraphQL query string
   * @param variables - Query variables
   * @returns Promise resolving to query result
   */
  async query<T = Record<string, unknown>>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    const result = (await response.json()) as GraphQLResponse<T>;

    if (result.errors !== undefined && result.errors.length > 0) {
      const firstError = result.errors[0];
      if (firstError !== undefined) {
        throw new Error(firstError.message);
      }
      throw new Error('Unknown error occurred in GraphQL query');
    }

    if (result.data === undefined) {
      throw new Error('No data received from GraphQL query');
    }

    // Debug logging for getDocument queries
    if (query.includes('getDocument') && variables !== undefined && variables !== null && variables.id !== undefined) {
      logger.debug('GraphQL raw response for getDocument', {
        id: variables.id,
        hasData: result.data !== undefined,
        dataKeys: result.data !== null && result.data !== undefined ? Object.keys(result.data) : [],
        rawData: JSON.stringify(result.data).substring(0, 200)
      });
    }

    return result.data;
  }

  /**
   * Execute GraphQL mutation
   * @param mutation - GraphQL mutation string
   * @param variables - Mutation variables
   * @returns Promise resolving to mutation result
   */
  async mutate<T = Record<string, unknown>>(
    mutation: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    return this.query(mutation, variables);
  }

  /**
   * Get document by ID
   * @param id - Document ID
   * @returns Promise resolving to document
   */
  async getDocument(id: string): Promise<Document | null> {
    logger.debug('GraphQL Client: Getting document', { id });
    try {
      const data = await this.query<{ getDocument: Document | null }>(
        queries.getDocument,
        { id }
      );
      logger.debug('GraphQL Client: Document response', {
        hasData: data !== null && data !== undefined,
        hasDocument: data?.getDocument !== null && data?.getDocument !== undefined,
        dataKeys: data !== null && data !== undefined ? Object.keys(data) : [],
        id
      });
      return data.getDocument;
    } catch (error) {
      logger.error('GraphQL Client: Error getting document', { id, error });
      throw error;
    }
  }

  /**
   * Search documents
   * @param filters - Search filters
   * @returns Promise resolving to search results
   */
  async searchDocuments(filters: Record<string, unknown>): Promise<{
    items: Document[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const data = await this.query<{ searchDocuments: {
      items: Document[];
      total: number;
      page: number;
      pageSize: number;
    }}>(queries.searchDocuments, filters);
    return data.searchDocuments;
  }

  /**
   * Create document
   * @param input - Document input data
   * @returns Promise resolving to created document
   */
  async createDocument(input: Record<string, unknown>): Promise<Document> {
    const data = await this.mutate<{ createDocument: Document }>(
      mutations.createDocument,
      { input }
    );
    return data.createDocument;
  }

  /**
   * Update document
   * @param id - Document ID
   * @param input - Update input data
   * @returns Promise resolving to updated document
   */
  async updateDocument(id: string, input: Record<string, unknown>): Promise<Document> {
    const data = await this.mutate<{ updateDocument: Document }>(
      mutations.updateDocument,
      { id, input }
    );
    return data.updateDocument;
  }

  /**
   * Get forum thread
   * @param id - Thread ID
   * @returns Promise resolving to forum thread
   */
  async getForumThread(id: string): Promise<ForumThread | null> {
    const data = await this.query<{ getForumThread: ForumThread | null }>(
      queries.getForumThread,
      { id }
    );
    return data.getForumThread;
  }

  /**
   * Search forum threads
   * @param filters - Search filters
   * @returns Promise resolving to search results
   */
  async searchForumThreads(filters: Record<string, unknown>): Promise<{
    items: ForumThread[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const data = await this.query<{ searchForumThreads: {
      items: ForumThread[];
      total: number;
      page: number;
      pageSize: number;
    }}>(queries.searchForumThreads, { filters });
    return data.searchForumThreads;
  }

  /**
   * Get thread posts
   * @param threadId - Thread ID
   * @param page - Page number
   * @param pageSize - Page size
   * @returns Promise resolving to array of posts
   */
  async getThreadPosts(
    threadId: string,
    page?: number,
    pageSize?: number
  ): Promise<ForumPost[]> {
    const data = await this.query<{ threadPosts: ForumPost[] }>(
      queries.getThreadPosts,
      { threadId, page, pageSize }
    );
    return data.threadPosts;
  }

  /**
   * Create forum thread
   * @param input - Thread input data
   * @returns Promise resolving to created thread
   */
  async createForumThread(input: Record<string, unknown>): Promise<ForumThread> {
    const data = await this.mutate<{ createForumThread: ForumThread }>(
      mutations.createForumThread,
      { input }
    );
    return data.createForumThread;
  }

  /**
   * Create forum post
   * @param input - Post input data
   * @returns Promise resolving to created post
   */
  async createForumPost(input: Record<string, unknown>): Promise<ForumPost> {
    const data = await this.mutate<{ createForumPost: ForumPost }>(
      mutations.createForumPost,
      { input }
    );
    return data.createForumPost;
  }

  /**
   * Get support request
   * @param id - Request ID
   * @returns Promise resolving to support request
   */
  async getSupportRequest(id: string): Promise<SupportRequest | null> {
    const data = await this.query<{ getSupportRequest: SupportRequest | null }>(
      queries.getSupportRequest,
      { id }
    );
    return data.getSupportRequest;
  }

  /**
   * Create support request
   * @param input - Request input data
   * @returns Promise resolving to created request
   */
  async createSupportRequest(input: Record<string, unknown>): Promise<SupportRequest> {
    const data = await this.mutate<{ createSupportRequest: SupportRequest }>(
      mutations.createSupportRequest,
      { input }
    );
    return data.createSupportRequest;
  }
}

/**
 * Singleton instance of the GraphQL client
 */
export const documentsGraphQLClient = new DocumentsGraphQLClient();