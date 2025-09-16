/**
 * Integration Module Exports
 *
 * Provides integration services for connecting the Documents module
 * with the Validator backend and other OmniBazaar modules.
 *
 * @module Integration
 */

// Legacy API-based integration (to be deprecated)
export { ValidatorIntegration } from './ValidatorIntegration';
export type { IntegrationConfig, IntegrationEvents } from './ValidatorIntegration';

// New direct integration approach
export { DirectValidatorIntegration } from './DirectValidatorIntegration';
export type {
  DirectIntegrationConfig,
  ValidatorServices,
  DocumentServices,
  ServiceHealth
} from './DirectValidatorIntegration';
