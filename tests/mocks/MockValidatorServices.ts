/**
 * Mock Validator Services for Testing
 *
 * Provides mock implementations of Validator services for testing
 * in the new direct integration architecture.
 *
 * @module tests/mocks/MockValidatorServices
 */

import type { ValidatorServices } from '../../src/integration/DirectValidatorIntegration';
import type { Document } from '../../src/services/documentation/DocumentationService';
import type { ForumThread, ForumPost } from '../../src/services/forum/ForumTypes';
import type { SupportRequest } from '../../src/services/support/SupportTypes';

/**
 * In-memory storage for mock data
 */
class MockStorage {
  documents = new Map<string, Document>();
  forumThreads = new Map<string, ForumThread>();
  forumPosts = new Map<string, ForumPost>();
  supportRequests = new Map<string, SupportRequest>();
  participationScores = new Map<string, number>();
  private nextId = 1;

  generateId(): string {
    return `mock-${this.nextId++}`;
  }

  clear(): void {
    this.documents.clear();
    this.forumThreads.clear();
    this.forumPosts.clear();
    this.supportRequests.clear();
    this.participationScores.clear();
    this.nextId = 1;
  }
}

/**
 * Creates mock validator services for testing
 *
 * @param storage - Optional storage instance to use (for shared state)
 * @returns Mock validator services
 */
export function createMockValidatorServices(storage?: MockStorage): ValidatorServices {
  const dataStore = storage ?? new MockStorage();

  return {
    database: {
      query: jest.fn(async <T = unknown>(sql: string, params?: unknown[]): Promise<T> => {
        const normalizedSql = sql.toLowerCase().trim();

        // Handle SELECT queries
        if (normalizedSql.startsWith('select')) {
          // Documents queries
          if (normalizedSql.includes('from documents')) {
            if (normalizedSql.includes('where id =')) {
              const id = String(params?.[0] ?? '');
              const doc = dataStore.documents.get(id);
              return {
                rows: doc ? [doc] : [],
                rowCount: doc ? 1 : 0,
                command: 'SELECT'
              } as unknown as T;
            }

            // Handle search queries
            if (normalizedSql.includes('where')) {
              // Simple search implementation
              const docs = Array.from(dataStore.documents.values());

              // If search query includes 'searchable', filter for that
              if (normalizedSql.includes('searchable') || (params && params.length > 0)) {
                const searchTerm = String(params?.[0] ?? '').toLowerCase().replace(/%/g, '');
                const filtered = docs.filter(doc => {
                  const titleMatch = doc.title?.toLowerCase().includes(searchTerm);
                  const contentMatch = doc.content?.toLowerCase().includes(searchTerm);
                  const tagsMatch = doc.tags?.some(tag => tag.toLowerCase().includes(searchTerm));

                  // For the test, we're looking for 'searchable'
                  if (searchTerm === 'searchable') {
                    return doc.content?.includes('searchable') ||
                           doc.tags?.includes('searchable');
                  }

                  return titleMatch || contentMatch || tagsMatch;
                });
                return {
                  rows: filtered,
                  rowCount: filtered.length,
                  command: 'SELECT'
                } as unknown as T;
              }
            }

            // Return all documents for general queries
            const docs = Array.from(dataStore.documents.values());
            return {
              rows: docs,
              rowCount: docs.length,
              command: 'SELECT'
            } as unknown as T;
          }

          // Forum threads queries
          if (normalizedSql.includes('from forum_threads')) {
            if (normalizedSql.includes('where id =')) {
              const id = String(params?.[0] ?? '');
              const thread = dataStore.forumThreads.get(id);
              return {
                rows: thread ? [thread] : [],
                rowCount: thread ? 1 : 0,
                command: 'SELECT'
              } as unknown as T;
            }

            const threads = Array.from(dataStore.forumThreads.values());
            return {
              rows: threads,
              rowCount: threads.length,
              command: 'SELECT'
            } as unknown as T;
          }

          // Forum posts queries
          if (normalizedSql.includes('from forum_posts')) {
            const posts = Array.from(dataStore.forumPosts.values());
            const threadId = params?.[0];
            const filtered = threadId
              ? posts.filter(p => p.threadId === threadId)
              : posts;
            return {
              rows: filtered,
              rowCount: filtered.length,
              command: 'SELECT'
            } as unknown as T;
          }

          // Support requests queries
          if (normalizedSql.includes('from support_requests')) {
            const requests = Array.from(dataStore.supportRequests.values());
            return {
              rows: requests,
              rowCount: requests.length,
              command: 'SELECT'
            } as unknown as T;
          }

          // Support sessions queries
          if (normalizedSql.includes('from support_sessions')) {
            const sessionId = params?.[0];
            if (sessionId) {
              return {
                rows: [{
                  session_id: sessionId,
                  user_address: TEST_USERS.alice,
                  volunteer_address: params?.[1],
                  status: 'active'
                }],
                rowCount: 1,
                command: 'SELECT'
              } as unknown as T;
            }
            return {
              rows: [],
              rowCount: 0,
              command: 'SELECT'
            } as unknown as T;
          }

          // Volunteer queries
          if (normalizedSql.includes('from volunteers')) {
            const volunteerAddress = params?.[0];
            if (volunteerAddress) {
              return {
                rows: [{
                  volunteer_address: volunteerAddress,
                  total_sessions: '0',
                  total_minutes: '0',
                  average_rating: '5.0',
                  status: 'active'
                }],
                rowCount: 1,
                command: 'SELECT'
              } as unknown as T;
            }
            return {
              rows: [],
              rowCount: 0,
              command: 'SELECT'
            } as unknown as T;
          }

          // System stats query
          if (normalizedSql.includes('total_volunteers')) {
            return {
              rows: [{
                total_volunteers: '1',
                active_volunteers: '1',
                total_sessions: '0',
                active_sessions: '0'
              }],
              rowCount: 1,
              command: 'SELECT'
            } as unknown as T;
          }

          // Count queries
          if (normalizedSql.includes('count(*)')) {
            let count = 0;
            if (normalizedSql.includes('documents')) {
              count = dataStore.documents.size;
            } else if (normalizedSql.includes('forum_threads')) {
              count = dataStore.forumThreads.size;
            } else if (normalizedSql.includes('forum_posts')) {
              count = dataStore.forumPosts.size;
            } else if (normalizedSql.includes('support_requests')) {
              count = dataStore.supportRequests.size;
            }
            return {
              rows: [{ count: count.toString() }],
              rowCount: 1,
              command: 'SELECT'
            } as unknown as T;
          }
        }

        // Handle INSERT queries
        if (normalizedSql.startsWith('insert')) {
          if (normalizedSql.includes('into documents')) {
            // Parameters order based on DocumentationService.createDocument:
            // $1: id (null), $2: title, $3: description, $4: content, $5: category,
            // $6: language, $7: version, $8: authorAddress, $9: tags, $10: isOfficial,
            // $11: search text, $12: status, $13: metadata
            const doc: Document = {
              id: dataStore.generateId(),
              title: String(params?.[1] ?? ''),
              description: String(params?.[2] ?? ''),
              content: String(params?.[3] ?? ''),
              category: String(params?.[4] ?? 'getting_started') as any,
              language: String(params?.[5] ?? 'en'),
              version: Number(params?.[6] ?? 1),
              authorAddress: String(params?.[7] ?? ''),
              tags: params?.[8] as string[] ?? [],
              isOfficial: params?.[9] as boolean ?? false,
              status: String(params?.[11] ?? 'draft') as any,
              metadata: params?.[12] ? JSON.parse(String(params[12])) : {},
              createdAt: new Date(),
              updatedAt: new Date(),
              viewCount: 0,
              rating: 0
            };
            dataStore.documents.set(doc.id, doc);
            return {
              rows: [doc],
              rowCount: 1,
              command: 'INSERT'
            } as unknown as T;
          }

          if (normalizedSql.includes('into forum_threads')) {
            // Fixed parameter order based on P2PForumService
            const id = dataStore.generateId();
            const thread: ForumThread = {
              id: id,
              title: String(params?.[1] ?? ''),
              content: String(params?.[2] ?? ''),
              category: String(params?.[3] ?? 'general'),
              authorAddress: String(params?.[4] ?? ''),
              tags: params?.[5] as string[] ?? [],
              status: 'active' as any,
              createdAt: new Date(),
              updatedAt: new Date(),
              replyCount: 0,
              viewCount: 0,
              lastActivity: new Date(),
              upvotes: 0,
              downvotes: 0
            };
            dataStore.forumThreads.set(thread.id, thread);
            return {
              rows: [thread],
              rowCount: 1,
              command: 'INSERT'
            } as unknown as T;
          }

          if (normalizedSql.includes('into forum_posts')) {
            const id = dataStore.generateId();
            const post: ForumPost = {
              id: id,
              threadId: String(params?.[1] ?? ''),
              content: String(params?.[2] ?? ''),
              authorAddress: String(params?.[3] ?? ''),
              replyToId: params?.[4] as string || undefined,
              createdAt: new Date(),
              updatedAt: new Date(),
              upvotes: 0,
              downvotes: 0,
              isAnswer: false
            };
            dataStore.forumPosts.set(post.id, post);
            return {
              rows: [post],
              rowCount: 1,
              command: 'INSERT'
            } as unknown as T;
          }

          if (normalizedSql.includes('into support_requests')) {
            const request: SupportRequest = {
              id: String(params?.[0] ?? dataStore.generateId()),
              userAddress: String(params?.[1] ?? ''),
              category: String(params?.[2] ?? 'general'),
              priority: String(params?.[3] ?? 'normal') as any,
              status: String(params?.[4] ?? 'waiting') as any,
              createdAt: params?.[5] as Date ?? new Date(),
              updatedAt: params?.[6] as Date ?? new Date()
            };
            dataStore.supportRequests.set(request.id, request);
            return {
              rows: [request],
              rowCount: 1,
              command: 'INSERT'
            } as unknown as T;
          }

          // Handle document_versions insert
          if (normalizedSql.includes('into document_versions')) {
            // Just return success for version tracking
            return {
              rows: [],
              rowCount: 1,
              command: 'INSERT'
            } as unknown as T;
          }

          // Handle support_sessions insert
          if (normalizedSql.includes('into support_sessions')) {
            const sessionId = String(params?.[0] ?? dataStore.generateId());
            const userAddress = String(params?.[1] ?? '');
            return {
              rows: [{
                id: sessionId,
                session_id: sessionId,
                sessionId: sessionId,
                user_address: userAddress,
                userAddress: userAddress,
                status: 'waiting'
              }],
              rowCount: 1,
              command: 'INSERT'
            } as unknown as T;
          }

          // Handle volunteers insert
          if (normalizedSql.includes('into volunteers')) {
            return {
              rows: [],
              rowCount: 1,
              command: 'INSERT'
            } as unknown as T;
          }
        }

        // Handle UPDATE queries
        if (normalizedSql.startsWith('update')) {
          if (normalizedSql.includes('documents')) {
            // Find and update the document
            const docId = params?.[params.length - 1]; // ID is usually last param
            const doc = dataStore.documents.get(String(docId));
            if (doc) {
              // Update fields based on SET clause
              if (normalizedSql.includes('title =')) {
                doc.title = String(params?.[0] ?? doc.title);
              }
              if (normalizedSql.includes('content =')) {
                const contentIndex = normalizedSql.includes('title =') ? 1 : 0;
                doc.content = String(params?.[contentIndex] ?? doc.content);
              }
              if (normalizedSql.includes('version =')) {
                doc.version = (doc.version ?? 1) + 1;
              }
              doc.updatedAt = new Date();

              return {
                rows: [doc],
                rowCount: 1,
                command: 'UPDATE'
              } as unknown as T;
            }
          }

          return {
            rows: [],
            rowCount: 0,
            command: 'UPDATE'
          } as unknown as T;
        }

        // Handle DELETE queries
        if (normalizedSql.startsWith('delete')) {
          return {
            rows: [],
            rowCount: 0,
            command: 'DELETE'
          } as unknown as T;
        }

        // Default response
        return {
          rows: [],
          rowCount: 0,
          command: sql.split(' ')[0].toUpperCase()
        } as unknown as T;
      })
    },

    participationScore: {
      getUserScore: jest.fn(async (userId: string): Promise<number> => {
        return dataStore.participationScores.get(userId) ?? 50;
      }),

      updateScore: jest.fn(async (userId: string, delta: number): Promise<void> => {
        const current = dataStore.participationScores.get(userId) ?? 50;
        dataStore.participationScores.set(userId, current + delta);
      }),

      // Additional methods that services might expect
      getUserData: jest.fn(async (userId: string): Promise<{ totalScore: number }> => {
        return { totalScore: dataStore.participationScores.get(userId) ?? 50 };
      }),

      updateDocumentationActivity: jest.fn(async (userId: string, points: number): Promise<void> => {
        const current = dataStore.participationScores.get(userId) ?? 50;
        dataStore.participationScores.set(userId, current + points);
      }),

      updateForumActivity: jest.fn(async (userId: string, points: number): Promise<void> => {
        const current = dataStore.participationScores.get(userId) ?? 50;
        dataStore.participationScores.set(userId, current + points);
      }),

      updateSupportActivity: jest.fn(async (userId: string, points: number): Promise<void> => {
        const current = dataStore.participationScores.get(userId) ?? 50;
        dataStore.participationScores.set(userId, current + points);
      })
    }
  };
}

/**
 * Shared mock storage instance for tests
 */
export const sharedMockStorage = new MockStorage();

/**
 * Creates mock validator services with shared storage
 *
 * @returns Mock validator services using shared storage
 */
export function createSharedMockValidatorServices(): ValidatorServices {
  return createMockValidatorServices(sharedMockStorage);
}

/**
 * Clears all mock data
 */
export function clearMockData(): void {
  sharedMockStorage.clear();
}