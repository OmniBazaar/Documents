/**
 * Support Chat Module Exports
 * 
 * Central export point for all volunteer support chat system components.
 * 
 * @module Support
 */

// Core Services
export { VolunteerSupportService } from './VolunteerSupportService';
export { SupportRouter } from './SupportRouter';

// Types
export * from './SupportTypes';

// Re-export commonly used types for convenience
export type {
  SupportRequest,
  SupportSession,
  SupportVolunteer,
  ChatMessage,
  VolunteerMetrics,
  SupportSystemStats,
  SupportServiceConfig,
  RoutingConfig
} from './SupportTypes';

/**
 * Helper function to format support category for display
 * 
 * @param category - Support category ID
 * @returns Formatted category name
 * 
 * @example
 * ```typescript
 * formatCategory('wallet_setup') // "Wallet Setup"
 * ```
 */
export function formatCategory(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Helper function to get category icon
 * 
 * @param category - Support category ID
 * @returns Category icon
 */
export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    wallet_setup: '💰',
    marketplace_listing: '📝',
    marketplace_buying: '🛒',
    dex_trading: '📈',
    technical_issue: '🔧',
    account_recovery: '🔑',
    security: '🔒',
    general: '❓'
  };
  return icons[category] ?? '❓';
}

/**
 * Helper function to format volunteer status
 * 
 * @param status - Volunteer status
 * @returns Status with icon
 */
export function formatVolunteerStatus(status: string): string {
  const statusMap: Record<string, string> = {
    offline: '⚫ Offline',
    available: '🟢 Available',
    busy: '🔴 Busy',
    away: '🟡 Away'
  };
  return statusMap[status] ?? status;
}

/**
 * Helper function to calculate estimated wait time
 * 
 * @param queuePosition - Position in queue
 * @param avgResolutionTime - Average resolution time in minutes
 * @returns Estimated wait time in minutes
 */
export function estimateWaitTime(queuePosition: number, avgResolutionTime: number = 15): number {
  // Simple estimation: position * average time * 0.7 (some overlap assumed)
  return Math.ceil(queuePosition * avgResolutionTime * 0.7);
}

/**
 * Helper function to format wait time for display
 * 
 * @param minutes - Wait time in minutes
 * @returns Formatted wait time
 */
export function formatWaitTime(minutes: number): string {
  if (minutes < 1) {
    return 'Less than a minute';
  } else if (minutes === 1) {
    return '1 minute';
  } else if (minutes < 60) {
    return `${minutes} minutes`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return hours === 1 ? '1 hour' : `${hours} hours`;
    }
    return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minute${mins > 1 ? 's' : ''}`;
  }
}

/**
 * Helper function to get priority color
 * 
 * @param priority - Support priority
 * @returns CSS color class
 */
export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'text-gray-500',
    medium: 'text-blue-500',
    high: 'text-orange-500',
    urgent: 'text-red-500'
  };
  return colors[priority] ?? 'text-gray-500';
}

/**
 * Helper function to validate message content
 * 
 * @param content - Message content
 * @param maxLength - Maximum allowed length
 * @returns Validation result
 */
export function validateMessage(content: string, maxLength: number = 2000): {
  valid: boolean;
  error?: string;
} {
  if (content === undefined || content === '' || content.trim().length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  if (content.length > maxLength) {
    return { valid: false, error: `Message exceeds maximum length of ${maxLength} characters` };
  }
  
  // Check for spam patterns
  const spamPatterns = [
    /(.)\1{10,}/g, // Repeated characters
    /\b(BUY|SELL|CLICK)\b.*\b(NOW|HERE|FAST)\b/gi, // Spam phrases
    /(https?:\/\/[^\s]+){5,}/g // Too many links
  ];
  
  for (const pattern of spamPatterns) {
    if (pattern.test(content)) {
      return { valid: false, error: 'Message appears to contain spam' };
    }
  }
  
  return { valid: true };
}

/**
 * Helper function to sanitize user input for display
 * 
 * @param input - User input
 * @returns Sanitized input
 */
export function sanitizeInput(input: string): string {
  // Basic XSS prevention - in production use a proper library
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/&/g, '&amp;');
}