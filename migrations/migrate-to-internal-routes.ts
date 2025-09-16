/**
 * Migration Script: Convert API Calls to Internal Routes
 *
 * This script helps migrate frontend code from external API calls
 * to internal route calls within the unified application.
 *
 * @module migrations/migrate-to-internal-routes
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../src/utils/logger';

/**
 * API endpoint mapping configuration
 */
const API_MAPPINGS = [
  // GraphQL to REST mappings
  {
    pattern: /fetch\(['"`].*\/graphql['"`],\s*{\s*method:\s*['"`]POST['"`],\s*body:\s*.*query:\s*.*getDocuments/gi,
    replacement: "fetch('/internal/documents'",
    description: 'GraphQL getDocuments query'
  },
  {
    pattern: /fetch\(['"`].*\/graphql['"`],\s*{\s*method:\s*['"`]POST['"`],\s*body:\s*.*mutation:\s*.*createDocument/gi,
    replacement: "fetch('/internal/documents', { method: 'POST'",
    description: 'GraphQL createDocument mutation'
  },

  // REST API to internal routes
  {
    pattern: /fetch\(['"`]https?:\/\/[^'"]*\/api\/documents([?/][^'"]*)?['"`]\)/gi,
    replacement: "fetch('/internal/documents$1')",
    description: 'Documents API endpoint'
  },
  {
    pattern: /fetch\(['"`]https?:\/\/[^'"]*\/api\/forum\/threads([?/][^'"]*)?['"`]\)/gi,
    replacement: "fetch('/internal/forum/threads$1')",
    description: 'Forum threads API endpoint'
  },
  {
    pattern: /fetch\(['"`]https?:\/\/[^'"]*\/api\/support\/requests([?/][^'"]*)?['"`]\)/gi,
    replacement: "fetch('/internal/support/requests$1')",
    description: 'Support requests API endpoint'
  },

  // Axios calls
  {
    pattern: /axios\.(get|post|put|delete)\(['"`]https?:\/\/[^'"]*\/api\/documents([?/][^'"]*)?['"`]/gi,
    replacement: "axios.$1('/internal/documents$2'",
    description: 'Axios documents API calls'
  },

  // API client instances
  {
    pattern: /new\s+ValidatorAPIClient\([^)]+\)/g,
    replacement: "// Direct service access - no API client needed",
    description: 'API client instantiation'
  },
  {
    pattern: /apiClient\.(getDocuments|createDocument|searchDocuments)\(/g,
    replacement: "// Use internal routes: fetch('/internal/documents') instead",
    description: 'API client method calls'
  }
];

/**
 * File patterns to process
 */
const FILE_PATTERNS = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx'
];

/**
 * Directories to exclude
 */
const EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage'
];

/**
 * Processes a single file
 *
 * @param filePath - Path to the file to process
 * @returns Number of replacements made
 */
function processFile(filePath: string): number {
  let content = fs.readFileSync(filePath, 'utf8');
  let replacements = 0;
  let modified = false;

  API_MAPPINGS.forEach(({ pattern, replacement, description }) => {
    const matches = content.match(pattern);
    if (matches !== null && matches.length > 0) {
      content = content.replace(pattern, replacement);
      replacements += matches.length;
      modified = true;
      logger.info(`Replaced ${matches.length} occurrences of ${description} in ${filePath}`);
    }
  });

  if (modified) {
    // Create backup
    const backupPath = `${filePath}.backup`;
    fs.copyFileSync(filePath, backupPath);

    // Write modified content
    fs.writeFileSync(filePath, content, 'utf8');
    logger.info(`Updated ${filePath} (backup saved as ${backupPath})`);
  }

  return replacements;
}

/**
 * Recursively finds all files matching patterns
 *
 * @param dir - Directory to search
 * @param patterns - File patterns to match
 * @returns Array of file paths
 */
function findFiles(dir: string, patterns: string[]): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir);

    entries.forEach(entry => {
      const fullPath = path.join(currentDir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!EXCLUDE_DIRS.includes(entry)) {
          walk(fullPath);
        }
      } else if (stat.isFile()) {
        // Check if file matches any pattern
        const matches = patterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
          return regex.test(entry);
        });

        if (matches) {
          files.push(fullPath);
        }
      }
    });
  }

  walk(dir);
  return files;
}

/**
 * Main migration function
 *
 * @param targetDir - Directory to process
 * @param options - Migration options
 */
export async function migrateToInternalRoutes(
  targetDir: string,
  options: {
    dryRun?: boolean;
    createBackups?: boolean;
    patterns?: string[];
  } = {}
): Promise<void> {
  const { dryRun = false, createBackups = true, patterns = FILE_PATTERNS } = options;

  logger.info(`Starting migration in ${targetDir}`);
  logger.info(`Dry run: ${dryRun}`);
  logger.info(`Create backups: ${createBackups}`);

  // Find all files
  const files = findFiles(targetDir, patterns);
  logger.info(`Found ${files.length} files to process`);

  let totalReplacements = 0;
  let filesModified = 0;

  // Process each file
  for (const file of files) {
    if (dryRun) {
      const content = fs.readFileSync(file, 'utf8');
      let wouldReplace = 0;

      API_MAPPINGS.forEach(({ pattern, description }) => {
        const matches = content.match(pattern);
        if (matches !== null && matches.length > 0) {
          logger.info(`Would replace ${matches.length} occurrences of ${description} in ${file}`);
          wouldReplace += matches.length;
        }
      });

      if (wouldReplace > 0) {
        totalReplacements += wouldReplace;
        filesModified++;
      }
    } else {
      const replacements = processFile(file);
      if (replacements > 0) {
        totalReplacements += replacements;
        filesModified++;
      }
    }
  }

  logger.info('Migration complete!');
  logger.info(`Files ${dryRun ? 'would be' : ''} modified: ${filesModified}`);
  logger.info(`Total replacements ${dryRun ? 'would be' : ''} made: ${totalReplacements}`);
}

/**
 * CLI interface
 */
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: ts-node migrate-to-internal-routes.ts <directory> [--dry-run]');
    process.exit(1);
  }

  const targetDir = args[0];
  const dryRun = args.includes('--dry-run');

  migrateToInternalRoutes(targetDir, { dryRun })
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}