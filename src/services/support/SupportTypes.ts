/**
 * Support Chat Type Definitions
 * 
 * Comprehensive type definitions for the volunteer support chat system.
 * Defines all interfaces and types for support sessions, routing, and quality metrics.
 * 
 * @module SupportTypes
 */

/**
 * Support session status
 */
export type SupportSessionStatus = 'waiting' | 'assigned' | 'active' | 'resolved' | 'abandoned';

/**
 * Support request priority levels
 */
export type SupportPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Support topic categories
 */
export type SupportCategory = 
  | 'wallet_setup'
  | 'marketplace_listing'
  | 'marketplace_buying'
  | 'dex_trading'
  | 'technical_issue'
  | 'account_recovery'
  | 'security'
  | 'general';

/**
 * Volunteer status
 */
export type VolunteerStatus = 'offline' | 'available' | 'busy' | 'away';

/**
 * Support request from user
 */
export interface SupportRequest {
  /** Unique request identifier */
  requestId: string;
  /** User's address */
  userAddress: string;
  /** Request category */
  category: SupportCategory;
  /** Priority level */
  priority: SupportPriority;
  /** Initial message */
  initialMessage: string;
  /** User's language preference */
  language: string;
  /** User's participation score */
  userScore: number;
  /** Timestamp of request */
  timestamp: Date;
  /** Additional metadata */
  metadata?: {
    /** Operating system */
    os?: string;
    /** Browser/app version */
    appVersion?: string;
    /** Error logs if technical issue */
    errorLogs?: string;
    /** Previous support history */
    previousSessions?: number;
  };
}

/**
 * Support volunteer profile
 */
export interface SupportVolunteer {
  /** Volunteer's address */
  address: string;
  /** Display name */
  displayName: string;
  /** Current status */
  status: VolunteerStatus;
  /** Supported languages */
  languages: string[];
  /** Expertise categories */
  expertiseCategories: SupportCategory[];
  /** Quality rating (1-5) */
  rating: number;
  /** Total sessions handled */
  totalSessions: number;
  /** Average response time in seconds */
  avgResponseTime: number;
  /** Average resolution time in minutes */
  avgResolutionTime: number;
  /** Participation score */
  participationScore: number;
  /** Last active timestamp */
  lastActive: Date;
  /** Current active sessions */
  activeSessions: string[];
  /** Maximum concurrent sessions */
  maxConcurrentSessions: number;
}

/**
 * Support session
 */
export interface SupportSession {
  /** Unique session identifier */
  sessionId: string;
  /** Support request */
  request: SupportRequest;
  /** Assigned volunteer */
  volunteer?: SupportVolunteer;
  /** Session status */
  status: SupportSessionStatus;
  /** Session start time */
  startTime: Date;
  /** Assignment time */
  assignmentTime?: Date;
  /** Resolution time */
  resolutionTime?: Date;
  /** Chat messages */
  messages: ChatMessage[];
  /** Quality rating from user */
  userRating?: number;
  /** Feedback from user */
  userFeedback?: string;
  /** PoP points awarded */
  popPointsAwarded: number;
  /** Session metadata */
  metadata?: {
    /** Number of messages exchanged */
    messageCount?: number;
    /** Issues resolved */
    issuesResolved?: string[];
    /** Knowledge base articles shared */
    articlesShared?: string[];
  };
}

/**
 * Chat message in support session
 */
export interface ChatMessage {
  /** Message ID */
  messageId: string;
  /** Sender address */
  senderAddress: string;
  /** Message content */
  content: string;
  /** Timestamp */
  timestamp: Date;
  /** Message type */
  type: 'text' | 'image' | 'file' | 'article_link';
  /** Attachment if any */
  attachment?: {
    /** File name */
    filename: string;
    /** File size in bytes */
    size: number;
    /** IPFS hash */
    ipfsHash?: string;
    /** MIME type */
    mimeType: string;
  };
  /** Read receipt */
  readAt?: Date;
}

/**
 * Volunteer performance metrics
 */
export interface VolunteerMetrics {
  /** Volunteer address */
  volunteerAddress: string;
  /** Time period for metrics */
  period: 'day' | 'week' | 'month' | 'all_time';
  /** Total sessions handled */
  sessionsHandled: number;
  /** Sessions by category */
  sessionsByCategory: Record<SupportCategory, number>;
  /** Average rating */
  averageRating: number;
  /** Total ratings received */
  totalRatings: number;
  /** Response time metrics */
  responseMetrics: {
    /** Average first response time */
    avgFirstResponse: number;
    /** Median response time */
    medianResponse: number;
    /** 90th percentile response time */
    p90Response: number;
  };
  /** Resolution metrics */
  resolutionMetrics: {
    /** Average resolution time */
    avgResolution: number;
    /** Resolution rate */
    resolutionRate: number;
    /** Abandonment rate */
    abandonmentRate: number;
  };
  /** PoP points earned */
  popPointsEarned: number;
  /** User satisfaction scores */
  satisfactionScores: {
    /** Very satisfied (5 stars) */
    verySatisfied: number;
    /** Satisfied (4 stars) */
    satisfied: number;
    /** Neutral (3 stars) */
    neutral: number;
    /** Dissatisfied (2 stars) */
    dissatisfied: number;
    /** Very dissatisfied (1 star) */
    veryDissatisfied: number;
  };
}

/**
 * Support routing configuration
 */
export interface RoutingConfig {
  /** Maximum wait time before escalation (ms) */
  maxWaitTime: number;
  /** Preferred language matching weight */
  languageWeight: number;
  /** Category expertise weight */
  expertiseWeight: number;
  /** Volunteer rating weight */
  ratingWeight: number;
  /** Response time weight */
  responseTimeWeight: number;
  /** Current load weight */
  loadWeight: number;
  /** User score consideration */
  userScoreBoost: boolean;
}

/**
 * Support session events for real-time updates
 */
export interface SupportSessionEvent {
  /** Event type */
  type: 
    | 'session_created'
    | 'volunteer_assigned'
    | 'message_sent'
    | 'session_resolved'
    | 'session_abandoned'
    | 'rating_submitted';
  /** Session ID */
  sessionId: string;
  /** Event data */
  data: unknown;
  /** Event timestamp */
  timestamp: Date;
}

/**
 * Volunteer availability schedule
 */
export interface VolunteerSchedule {
  /** Volunteer address */
  volunteerAddress: string;
  /** Weekly recurring schedule */
  weeklySchedule: {
    /** Day of week (0-6, 0 = Sunday) */
    dayOfWeek: number;
    /** Available time slots */
    slots: Array<{
      /** Start time (HH:MM) */
      startTime: string;
      /** End time (HH:MM) */
      endTime: string;
    }>;
  }[];
  /** Time zone */
  timezone: string;
  /** Override dates (holidays, etc) */
  overrides: Array<{
    /** Date */
    date: Date;
    /** Available for this date */
    available: boolean;
  }>;
}

/**
 * Quality assurance metrics
 */
export interface QualityMetrics {
  /** Session ID */
  sessionId: string;
  /** Response quality indicators */
  responseQuality: {
    /** Clear communication */
    clarity: boolean;
    /** Accurate information */
    accuracy: boolean;
    /** Professional tone */
    professionalism: boolean;
    /** Helpful attitude */
    helpfulness: boolean;
  };
  /** Issue resolution */
  resolution: {
    /** Was issue resolved */
    resolved: boolean;
    /** Resolution method */
    method?: string;
    /** Follow-up needed */
    followUpNeeded: boolean;
  };
  /** Knowledge sharing */
  knowledgeSharing: {
    /** Documentation links shared */
    docsShared: number;
    /** Custom explanations provided */
    explanationsGiven: number;
    /** Visual aids used */
    visualAidsUsed: number;
  };
}

/**
 * Support system statistics
 */
export interface SupportSystemStats {
  /** Total active volunteers */
  activeVolunteers: number;
  /** Total waiting requests */
  waitingRequests: number;
  /** Active sessions */
  activeSessions: number;
  /** Average wait time (seconds) */
  avgWaitTime: number;
  /** Sessions today */
  sessionsToday: number;
  /** Volunteer utilization rate */
  utilizationRate: number;
  /** System health indicators */
  health: {
    /** Response time within SLA */
    responseTimeSLA: number;
    /** Resolution rate */
    resolutionRate: number;
    /** User satisfaction rate */
    satisfactionRate: number;
  };
}