/**
 * UUID utility functions
 *
 * Provides consistent UUID generation for database compatibility
 *
 * @module utils/uuid
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a UUID v4
 * @returns A valid UUID v4 string
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Validates if a string is a valid UUID
 * @param id - The string to validate
 * @returns True if the string is a valid UUID
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}