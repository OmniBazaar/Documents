/**
 * Mock Validator API for testing
 *
 * Simulates the Validator API for integration tests using in-memory storage
 * instead of requiring a real Validator instance.
 *
 * @module tests/mocks/MockValidatorAPI
 */

import { ValidatorAPIClient, ValidatorAPIConfig } from '../../src/services/validator/ValidatorAPIClient';
import type { Document, DocumentCategory } from '../../src/services/documentation/DocumentationService';
import type { ForumThread, ForumPost } from '../../src/services/forum/ForumTypes';
import type { SupportRequest, SupportSession, SupportVolunteer } from '../../src/services/support/SupportTypes';

/**
 * In-memory storage for mock data
 */
class MockStorage {
  documents = new Map<string, Document>();
  forumThreads = new Map<string, ForumThread>();
  forumPosts = new Map<string, ForumPost>();
  supportRequests = new Map<string, SupportRequest>();
  supportSessions = new Map<string, SupportSession>();
  supportVolunteers = new Map<string, SupportVolunteer>();
  participationScores = new Map<string, { total: number; components: Record<string, number> }>();

  clear() {
    this.documents.clear();
    this.forumThreads.clear();
    this.forumPosts.clear();
    this.supportRequests.clear();
    this.supportSessions.clear();
    this.supportVolunteers.clear();
    this.participationScores.clear();
  }
}

/**
 * Mock implementation of the Validator API client
 */
export class MockValidatorAPIClient extends ValidatorAPIClient {
  private storage = new MockStorage();
  private nextId = 1;

  constructor(config: ValidatorAPIConfig) {
    super(config);
  }

  /**
   * Generates a unique ID
   */
  private generateId(): string {
    return `mock-${this.nextId++}`;
  }

  /**
   * Clears all mock data
   */
  clearMockData(): void {
    this.storage.clear();
    this.nextId = 1;
  }

  // Override document operations

  async createDocument(document: Omit<Document, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Document> {
    // Use provided ID or generate a new one
    const id = document.id || this.generateId();
    const now = new Date();
    const fullDocument: Document = {
      ...document,
      id,
      createdAt: now,
      updatedAt: now,
      viewCount: 0,
      rating: 0,
      version: document.version ?? 1,
      status: document.status ?? 'draft',
    } as Document;

    this.storage.documents.set(id, fullDocument);
    return fullDocument;
  }

  async getDocument(id: string): Promise<Document | null> {
    const doc = this.storage.documents.get(id);
    if (doc) {
      // Increment view count
      doc.viewCount = (doc.viewCount ?? 0) + 1;
      // Ensure all required fields are present
      return {
        ...doc,
        description: doc.description ?? '',
        tags: doc.tags ?? [],
        isOfficial: doc.isOfficial ?? false,
        status: doc.status ?? 'draft',
        metadata: doc.metadata ?? {},
        attachments: doc.attachments ?? [],
      };
    }
    return null;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
    const existing = this.storage.documents.get(id);
    if (!existing) {
      throw new Error('Document not found');
    }

    const updated: Document = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
      version: (existing.version || 1) + 1,
    };

    this.storage.documents.set(id, updated);
    return updated;
  }

  async deleteDocument(id: string): Promise<void> {
    if (!this.storage.documents.has(id)) {
      throw new Error('Document not found');
    }
    this.storage.documents.delete(id);
  }

  async searchDocuments(params: {
    query?: string;
    category?: DocumentCategory;
    tags?: string[];
    authorAddress?: string;
    language?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Document[]; total: number; page: number; pageSize: number }> {
    let results = Array.from(this.storage.documents.values());

    // Simple text search in title, description, and content
    if (params.query) {
      const lowerQuery = params.query.toLowerCase();
      results = results.filter(doc =>
        doc.title.toLowerCase().includes(lowerQuery) ||
        doc.description?.toLowerCase().includes(lowerQuery) ||
        doc.content.toLowerCase().includes(lowerQuery)
      );
    }

    // Apply filters
    if (params.category) {
      results = results.filter(doc => doc.category === params.category);
    }

    if (params.tags && params.tags.length > 0) {
      results = results.filter(doc =>
        params.tags!.some(tag => doc.tags.includes(tag))
      );
    }

    if (params.authorAddress) {
      results = results.filter(doc => doc.authorAddress === params.authorAddress);
    }

    if (params.language) {
      results = results.filter(doc => doc.language === params.language);
    }

    // Apply pagination
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + pageSize);

    return {
      items: paginatedResults,
      total: results.length,
      page,
      pageSize,
    };
  }

  // Override forum operations

  async createForumThread(thread: Omit<ForumThread, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ForumThread> {
    // Use provided ID or generate a new one
    const id = thread.id || this.generateId();
    const now = new Date();
    const fullThread: ForumThread = {
      ...thread,
      id,
      createdAt: now,
      updatedAt: now,
      replyCount: 0,
      viewCount: 0,
      lastReplyAt: now,
      isPinned: false,
      isLocked: false,
    } as ForumThread;

    this.storage.forumThreads.set(id, fullThread);
    return fullThread;
  }

  async getForumThread(id: string): Promise<ForumThread | null> {
    const thread = this.storage.forumThreads.get(id);
    if (thread) {
      thread.viewCount++;
    }
    return thread ?? null;
  }

  async createForumPost(post: Omit<ForumPost, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ForumPost> {
    // Use provided ID or generate a new one
    const id = post.id || this.generateId();
    const now = new Date();
    const fullPost: ForumPost = {
      ...post,
      id,
      createdAt: now,
      updatedAt: now,
      upvotes: 0,
      downvotes: 0,
      isEdited: false,
    } as ForumPost;

    this.storage.forumPosts.set(id, fullPost);

    // Update thread reply count
    const thread = this.storage.forumThreads.get(post.threadId);
    if (thread) {
      thread.replyCount++;
      thread.lastReplyAt = now;
    }

    return fullPost;
  }

  async searchForumThreads(params: {
    query?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  }): Promise<{ items: ForumThread[]; total: number; page: number; pageSize: number }> {
    let results = Array.from(this.storage.forumThreads.values());

    // Simple text search in title and content
    if (params.query) {
      const lowerQuery = params.query.toLowerCase();
      results = results.filter(thread =>
        thread.title.toLowerCase().includes(lowerQuery) ||
        thread.content?.toLowerCase().includes(lowerQuery)
      );
    }

    // Filter by tags
    if (params.tags && params.tags.length > 0) {
      results = results.filter(thread =>
        params.tags!.some(tag => thread.tags?.includes(tag))
      );
    }

    // Apply pagination
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + pageSize);

    return {
      items: paginatedResults,
      total: results.length,
      page,
      pageSize,
    };
  }

  // Override support operations

  async createSupportRequest(request: Omit<SupportRequest, 'id' | 'createdAt'>): Promise<SupportRequest> {
    const id = this.generateId();
    const requestId = `REQ-${id}`;
    const fullRequest: SupportRequest = {
      ...request,
      id,
      requestId,
      createdAt: new Date(),
      status: 'open',
    } as SupportRequest;

    this.storage.supportRequests.set(id, fullRequest);
    return fullRequest;
  }

  async getSupportRequest(id: string): Promise<SupportRequest | null> {
    return this.storage.supportRequests.get(id) ?? null;
  }

  async createSupportSession(session: Omit<SupportSession, 'id' | 'createdAt'>): Promise<SupportSession> {
    const id = this.generateId();
    const sessionId = `SESSION-${id}`;
    const fullSession: SupportSession = {
      ...session,
      id,
      sessionId,
      createdAt: new Date(),
      status: 'waiting',
    } as SupportSession;

    this.storage.supportSessions.set(id, fullSession);
    return fullSession;
  }

  async registerSupportVolunteer(volunteer: Omit<SupportVolunteer, 'id' | 'createdAt'>): Promise<SupportVolunteer> {
    const id = volunteer.userId ?? this.generateId();
    const fullVolunteer: SupportVolunteer = {
      ...volunteer,
      id,
      userId: id,
      createdAt: new Date(),
      status: 'available',
      sessionsCompleted: 0,
      averageRating: 0,
    } as SupportVolunteer;

    this.storage.supportVolunteers.set(id, fullVolunteer);
    return fullVolunteer;
  }

  // Override participation score operations

  async getUserScore(userAddress: string): Promise<{
    total: number;
    components: Record<string, number>;
  }> {
    const existing = this.storage.participationScores.get(userAddress);
    if (existing) {
      return existing;
    }

    // Create default score
    const defaultScore = {
      total: 0,
      components: {
        documentation: 0,
        forum: 0,
        support: 0,
        marketplace: 0,
        governance: 0,
        staking: 0,
        trading: 0,
        community: 0,
      },
    };

    this.storage.participationScores.set(userAddress, defaultScore);
    return defaultScore;
  }

  async awardPoints(
    userAddress: string,
    points: number,
    category: string,
    reason: string
  ): Promise<void> {
    const score = await this.getUserScore(userAddress);

    // Update component score
    if (category in score.components) {
      score.components[category] += points;
    } else {
      score.components[category] = points;
    }

    // Recalculate total
    score.total = Object.values(score.components).reduce((sum, val) => sum + val, 0);

    this.storage.participationScores.set(userAddress, score);
  }

  // Override health check

  async checkHealth(): Promise<{
    healthy: boolean;
    services: Record<string, { healthy: boolean; error?: string }>;
  }> {
    return {
      healthy: true,
      services: {
        database: { healthy: true },
        validator: { healthy: true },
        documentation: { healthy: true },
        forum: { healthy: true },
        support: { healthy: true },
      },
    };
  }
}