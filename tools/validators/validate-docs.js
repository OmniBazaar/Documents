#!/usr/bin/env node

/**
 * Documentation Validation Tool
 * 
 * Validates documentation files for quality, consistency, and completeness.
 * Checks for broken links, outdated content, missing sections, and style compliance.
 * 
 * Usage:
 *   node tools/validators/validate-docs.js [options]
 * 
 * Options:
 *   --docs <path>       Documentation directory (default: docs/)
 *   --config <path>     Validation config file (default: docs/validation.json)
 *   --fix               Auto-fix issues where possible
 *   --verbose           Enable verbose logging
 *   --format <format>   Output format: console|json|html (default: console)
 */

const fs = require('fs-extra');
const path = require('path');
const glob = require('fast-glob');
const chalk = require('chalk');
const axios = require('axios');
const markdownLint = require('markdownlint');
const yargs = require('yargs');

// Default validation configuration
const DEFAULT_CONFIG = {
  rules: {
    markdownLint: true,
    brokenLinks: true,
    missingMetadata: true,
    outdatedContent: true,
    consistencyChecks: true,
    accessibilityChecks: true,
    spellCheck: false,
    grammarCheck: false
  },
  thresholds: {
    maxLineLength: 100,
    maxFileSize: 50000, // 50KB
    minWordCount: 50,
    maxLinkCheckTime: 5000,
    contentFreshnessMonths: 6
  },
  patterns: {
    documentFiles: ['**/*.md', '**/*.mdx'],
    excludePatterns: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**'
    ],
    imageFiles: ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.svg'],
    linkPatterns: {
      internal: /\[([^\]]+)\]\(([^)]+)\)/g,
      external: /https?:\/\/[^\s)]+/g,
      images: /!\[([^\]]*)\]\(([^)]+)\)/g
    }
  },
  metadata: {
    required: ['title', 'description', 'lastUpdated'],
    optional: ['author', 'tags', 'category', 'difficulty']
  },
  style: {
    headingLevels: [1, 2, 3, 4, 5, 6],
    codeBlockLanguages: ['typescript', 'javascript', 'bash', 'json', 'yaml'],
    allowedFileExtensions: ['.md', '.mdx']
  }
};

class DocumentationValidator {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.results = {
      files: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        errors: 0
      },
      issues: []
    };
    this.linkCache = new Map();
  }

  async validate(docsPath) {
    console.log(chalk.blue('🔍 Starting documentation validation...\\n'));

    try {
      const files = await this.findDocumentFiles(docsPath);
      console.log(chalk.gray(`Found ${files.length} documentation files\\n`));

      for (const file of files) {
        await this.validateFile(file);
      }

      this.generateSummary();
      this.printResults();

      return this.results.summary.errors === 0;

    } catch (error) {
      console.error(chalk.red('❌ Validation failed:'), error.message);
      return false;
    }
  }

  async findDocumentFiles(docsPath) {
    return glob(this.config.patterns.documentFiles, {
      cwd: docsPath,
      absolute: true,
      ignore: this.config.patterns.excludePatterns
    });
  }

  async validateFile(filePath) {
    const relativePath = path.relative(process.cwd(), filePath);
    
    if (this.config.verbose) {
      console.log(chalk.gray(`Validating: ${relativePath}`));
    }

    const fileResult = {
      path: filePath,
      relativePath,
      passed: true,
      issues: []
    };

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);

      // Run all validation checks
      await this.runFileValidation(fileResult, content, stats);

    } catch (error) {
      this.addIssue(fileResult, 'error', 'file-read', 
        `Failed to read file: ${error.message}`);
    }

    this.results.files.push(fileResult);
    this.results.summary.total++;
    
    if (fileResult.passed) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
  }

  async runFileValidation(fileResult, content, stats) {
    // Basic file checks
    await this.validateFileSize(fileResult, stats);
    await this.validateFileExtension(fileResult);
    
    // Content validation
    await this.validateMarkdownSyntax(fileResult, content);
    await this.validateMetadata(fileResult, content);
    await this.validateContent(fileResult, content);
    await this.validateLinks(fileResult, content);
    await this.validateImages(fileResult, content);
    
    // Style and consistency checks
    await this.validateStyle(fileResult, content);
    await this.validateAccessibility(fileResult, content);
    
    // Freshness check
    await this.validateContentFreshness(fileResult, content, stats);
  }

  async validateFileSize(fileResult, stats) {
    if (stats.size > this.config.thresholds.maxFileSize) {
      this.addIssue(fileResult, 'warning', 'file-size',
        `File size (${stats.size} bytes) exceeds threshold (${this.config.thresholds.maxFileSize} bytes)`);
    }
  }

  async validateFileExtension(fileResult) {
    const ext = path.extname(fileResult.path);
    if (!this.config.style.allowedFileExtensions.includes(ext)) {
      this.addIssue(fileResult, 'error', 'file-extension',
        `Invalid file extension: ${ext}`);
    }
  }

  async validateMarkdownSyntax(fileResult, content) {
    if (!this.config.rules.markdownLint) return;

    const options = {
      strings: {
        [fileResult.relativePath]: content
      },
      config: {
        'line-length': {
          line_length: this.config.thresholds.maxLineLength
        },
        'no-trailing-spaces': true,
        'no-multiple-blanks': true,
        'no-duplicate-heading': true
      }
    };

    const results = markdownLint.sync(options);
    const fileResults = results[fileResult.relativePath];

    if (fileResults && fileResults.length > 0) {
      fileResults.forEach(issue => {
        this.addIssue(fileResult, 'error', 'markdown-lint',
          `Line ${issue.lineNumber}: ${issue.ruleDescription}`, issue.lineNumber);
      });
    }
  }

  async validateMetadata(fileResult, content) {
    if (!this.config.rules.missingMetadata) return;

    const frontMatter = this.extractFrontMatter(content);
    
    // Check required metadata
    for (const field of this.config.metadata.required) {
      if (!frontMatter[field]) {
        this.addIssue(fileResult, 'error', 'missing-metadata',
          `Missing required metadata field: ${field}`);
      }
    }

    // Validate specific metadata formats
    if (frontMatter.lastUpdated) {
      const date = new Date(frontMatter.lastUpdated);
      if (isNaN(date.getTime())) {
        this.addIssue(fileResult, 'error', 'invalid-metadata',
          `Invalid date format in lastUpdated: ${frontMatter.lastUpdated}`);
      }
    }
  }

  async validateContent(fileResult, content) {
    const wordCount = this.getWordCount(content);
    
    if (wordCount < this.config.thresholds.minWordCount) {
      this.addIssue(fileResult, 'warning', 'content-length',
        `Content is too short (${wordCount} words, minimum: ${this.config.thresholds.minWordCount})`);
    }

    // Check for common content issues
    this.validateHeadingStructure(fileResult, content);
    this.validateCodeBlocks(fileResult, content);
    this.validateTables(fileResult, content);
  }

  async validateLinks(fileResult, content) {
    if (!this.config.rules.brokenLinks) return;

    const links = this.extractLinks(content);
    
    for (const link of links) {
      await this.validateLink(fileResult, link);
    }
  }

  async validateLink(fileResult, link) {
    const { text, url, line } = link;
    
    // Skip mailto and javascript links
    if (url.startsWith('mailto:') || url.startsWith('javascript:')) {
      return;
    }

    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        // External link validation
        await this.validateExternalLink(fileResult, url, text, line);
      } else {
        // Internal link validation
        await this.validateInternalLink(fileResult, url, text, line);
      }
    } catch (error) {
      this.addIssue(fileResult, 'error', 'link-validation-error',
        `Error validating link "${url}": ${error.message}`, line);
    }
  }

  async validateExternalLink(fileResult, url, text, line) {
    if (this.linkCache.has(url)) {
      const cached = this.linkCache.get(url);
      if (!cached.valid) {
        this.addIssue(fileResult, 'error', 'broken-external-link',
          `Broken external link: ${url} (${cached.reason})`, line);
      }
      return;
    }

    try {
      const response = await axios.head(url, {
        timeout: this.config.thresholds.maxLinkCheckTime,
        validateStatus: status => status < 400
      });
      
      this.linkCache.set(url, { valid: true, status: response.status });
      
    } catch (error) {
      const reason = error.response ? 
        `HTTP ${error.response.status}` : 
        error.code || error.message;
        
      this.linkCache.set(url, { valid: false, reason });
      this.addIssue(fileResult, 'error', 'broken-external-link',
        `Broken external link: ${url} (${reason})`, line);
    }
  }

  async validateInternalLink(fileResult, url, text, line) {
    const baseDir = path.dirname(fileResult.path);
    let targetPath;

    if (url.startsWith('/')) {
      // Absolute path from docs root
      targetPath = path.join(process.cwd(), 'docs', url.substring(1));
    } else {
      // Relative path
      targetPath = path.resolve(baseDir, url);
    }

    // Remove anchor links
    const cleanPath = targetPath.split('#')[0];
    
    if (!await fs.pathExists(cleanPath)) {
      this.addIssue(fileResult, 'error', 'broken-internal-link',
        `Broken internal link: ${url} (file not found: ${cleanPath})`, line);
    }
  }

  async validateImages(fileResult, content) {
    const images = this.extractImages(content);
    
    for (const image of images) {
      await this.validateImage(fileResult, image);
    }
  }

  async validateImage(fileResult, image) {
    const { alt, src, line } = image;
    
    // Check alt text
    if (!alt || alt.trim().length === 0) {
      this.addIssue(fileResult, 'warning', 'missing-alt-text',
        `Image missing alt text: ${src}`, line);
    }

    // Validate image file exists (for local images)
    if (!src.startsWith('http://') && !src.startsWith('https://')) {
      const baseDir = path.dirname(fileResult.path);
      const imagePath = path.resolve(baseDir, src);
      
      if (!await fs.pathExists(imagePath)) {
        this.addIssue(fileResult, 'error', 'missing-image',
          `Image file not found: ${src}`, line);
      }
    }
  }

  async validateStyle(fileResult, content) {
    if (!this.config.rules.consistencyChecks) return;

    // Check for consistent heading levels
    this.validateHeadingLevels(fileResult, content);
    
    // Check for consistent code block languages
    this.validateCodeBlockLanguages(fileResult, content);
    
    // Check for consistent formatting
    this.validateFormatting(fileResult, content);
  }

  async validateAccessibility(fileResult, content) {
    if (!this.config.rules.accessibilityChecks) return;

    // Check for accessible table headers
    this.validateTableHeaders(fileResult, content);
    
    // Check for descriptive link text
    this.validateLinkText(fileResult, content);
  }

  async validateContentFreshness(fileResult, content, stats) {
    if (!this.config.rules.outdatedContent) return;

    const frontMatter = this.extractFrontMatter(content);
    const lastUpdated = frontMatter.lastUpdated || stats.mtime;
    const age = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    if (age > this.config.thresholds.contentFreshnessMonths) {
      this.addIssue(fileResult, 'warning', 'outdated-content',
        `Content may be outdated (${Math.round(age)} months old)`);
    }
  }

  // Helper methods
  addIssue(fileResult, severity, type, message, line = null) {
    const issue = {
      severity,
      type,
      message,
      line,
      file: fileResult.relativePath
    };

    fileResult.issues.push(issue);
    this.results.issues.push(issue);

    if (severity === 'error') {
      fileResult.passed = false;
      this.results.summary.errors++;
    } else if (severity === 'warning') {
      this.results.summary.warnings++;
    }
  }

  extractFrontMatter(content) {
    const frontMatterMatch = content.match(/^---\\n([\\s\\S]*?)\\n---/);
    if (!frontMatterMatch) return {};

    try {
      const yaml = require('js-yaml');
      return yaml.load(frontMatterMatch[1]) || {};
    } catch (error) {
      return {};
    }
  }

  extractLinks(content) {
    const links = [];
    const lines = content.split('\\n');
    
    lines.forEach((line, lineIndex) => {
      let match;
      while ((match = this.config.patterns.linkPatterns.internal.exec(line)) !== null) {
        links.push({
          text: match[1],
          url: match[2],
          line: lineIndex + 1
        });
      }
    });

    return links;
  }

  extractImages(content) {
    const images = [];
    const lines = content.split('\\n');
    
    lines.forEach((line, lineIndex) => {
      let match;
      while ((match = this.config.patterns.linkPatterns.images.exec(line)) !== null) {
        images.push({
          alt: match[1],
          src: match[2],
          line: lineIndex + 1
        });
      }
    });

    return images;
  }

  getWordCount(content) {
    // Remove front matter, code blocks, and markdown syntax
    const cleanContent = content
      .replace(/^---[\\s\\S]*?---/, '') // Front matter
      .replace(/```[\\s\\S]*?```/g, '') // Code blocks
      .replace(/`[^`]*`/g, '') // Inline code
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // Images
      .replace(/\[[^\]]*\]\([^)]*\)/g, '') // Links
      .replace(/[#*_~`]/g, '') // Markdown syntax
      .trim();

    return cleanContent.split(/\\s+/).filter(word => word.length > 0).length;
  }

  validateHeadingStructure(fileResult, content) {
    const headings = content.match(/^#{1,6}\s+.+$/gm) || [];
    let lastLevel = 0;

    headings.forEach((heading, index) => {
      const level = heading.match(/^#+/)[0].length;
      
      if (level > lastLevel + 1) {
        this.addIssue(fileResult, 'warning', 'heading-structure',
          `Heading level skipped: h${lastLevel} to h${level}`);
      }
      
      lastLevel = level;
    });
  }

  validateCodeBlocks(fileResult, content) {
    const codeBlocks = content.match(/```(\\w+)?[\\s\\S]*?```/g) || [];
    
    codeBlocks.forEach((block, index) => {
      const languageMatch = block.match(/```(\\w+)/);
      if (languageMatch) {
        const language = languageMatch[1];
        if (!this.config.style.codeBlockLanguages.includes(language)) {
          this.addIssue(fileResult, 'warning', 'code-block-language',
            `Unsupported code block language: ${language}`);
        }
      } else {
        this.addIssue(fileResult, 'warning', 'code-block-language',
          `Code block missing language specification`);
      }
    });
  }

  validateTables(fileResult, content) {
    const tables = content.match(/^\|.*\|$/gm) || [];
    
    if (tables.length > 0) {
      // Basic table structure validation
      const tableRows = tables.filter(row => !row.match(/^\|[\s:-]+\|$/));
      
      if (tableRows.length > 1) {
        const columnCounts = tableRows.map(row => 
          (row.match(/\|/g) || []).length - 1
        );
        
        const firstRowColumns = columnCounts[0];
        if (!columnCounts.every(count => count === firstRowColumns)) {
          this.addIssue(fileResult, 'error', 'table-structure',
            'Table rows have inconsistent column counts');
        }
      }
    }
  }

  validateHeadingLevels(fileResult, content) {
    const headings = content.match(/^#{1,6}\s+.+$/gm) || [];
    
    headings.forEach(heading => {
      const level = heading.match(/^#+/)[0].length;
      if (!this.config.style.headingLevels.includes(level)) {
        this.addIssue(fileResult, 'warning', 'heading-level',
          `Invalid heading level: h${level}`);
      }
    });
  }

  validateCodeBlockLanguages(fileResult, content) {
    const codeBlocks = content.match(/```(\\w+)?/g) || [];
    
    codeBlocks.forEach(block => {
      const languageMatch = block.match(/```(\\w+)/);
      if (languageMatch) {
        const language = languageMatch[1];
        if (!this.config.style.codeBlockLanguages.includes(language)) {
          this.addIssue(fileResult, 'info', 'style-consistency',
            `Consider using standard language: ${language}`);
        }
      }
    });
  }

  validateFormatting(fileResult, content) {
    // Check for consistent list formatting
    const listItems = content.match(/^[\s]*[-*+]\s+/gm) || [];
    const bulletTypes = [...new Set(listItems.map(item => item.trim()[0]))];
    
    if (bulletTypes.length > 1) {
      this.addIssue(fileResult, 'info', 'style-consistency',
        'Inconsistent bullet point styles used');
    }
  }

  validateTableHeaders(fileResult, content) {
    const tables = content.match(/^\|.*\|$/gm) || [];
    
    if (tables.length > 0) {
      const hasHeaderSeparator = content.includes('|---') || content.includes('|:-');
      if (!hasHeaderSeparator) {
        this.addIssue(fileResult, 'warning', 'accessibility',
          'Table missing header separator for accessibility');
      }
    }
  }

  validateLinkText(fileResult, content) {
    const links = this.extractLinks(content);
    
    const genericTexts = ['click here', 'read more', 'here', 'link'];
    links.forEach(link => {
      if (genericTexts.includes(link.text.toLowerCase())) {
        this.addIssue(fileResult, 'warning', 'accessibility',
          `Generic link text not accessible: "${link.text}"`, link.line);
      }
    });
  }

  generateSummary() {
    this.results.summary.errorsByType = {};
    this.results.summary.warningsByType = {};

    this.results.issues.forEach(issue => {
      if (issue.severity === 'error') {
        this.results.summary.errorsByType[issue.type] = 
          (this.results.summary.errorsByType[issue.type] || 0) + 1;
      } else if (issue.severity === 'warning') {
        this.results.summary.warningsByType[issue.type] = 
          (this.results.summary.warningsByType[issue.type] || 0) + 1;
      }
    });
  }

  printResults() {
    console.log(chalk.white('\\n📊 Validation Results:\\n'));

    if (this.results.summary.errors === 0 && this.results.summary.warnings === 0) {
      console.log(chalk.green('✅ All documentation files passed validation!'));
      return;
    }

    // Summary statistics
    console.log(chalk.white('Summary:'));
    console.log(chalk.blue(`  Total files: ${this.results.summary.total}`));
    console.log(chalk.green(`  Passed: ${this.results.summary.passed}`));
    console.log(chalk.red(`  Failed: ${this.results.summary.failed}`));
    console.log(chalk.red(`  Errors: ${this.results.summary.errors}`));
    console.log(chalk.yellow(`  Warnings: ${this.results.summary.warnings}`));
    console.log();

    // Error breakdown
    if (this.results.summary.errors > 0) {
      console.log(chalk.red('❌ Errors by type:'));
      Object.entries(this.results.summary.errorsByType).forEach(([type, count]) => {
        console.log(chalk.red(`  ${type}: ${count}`));
      });
      console.log();
    }

    // Warning breakdown
    if (this.results.summary.warnings > 0) {
      console.log(chalk.yellow('⚠️ Warnings by type:'));
      Object.entries(this.results.summary.warningsByType).forEach(([type, count]) => {
        console.log(chalk.yellow(`  ${type}: ${count}`));
      });
      console.log();
    }

    // Detailed issues (first 20)
    const displayIssues = this.results.issues.slice(0, 20);
    if (displayIssues.length > 0) {
      console.log(chalk.white('Issues:'));
      displayIssues.forEach(issue => {
        const color = issue.severity === 'error' ? chalk.red : chalk.yellow;
        const location = issue.line ? `:${issue.line}` : '';
        console.log(color(`  ${issue.file}${location}: ${issue.message}`));
      });

      if (this.results.issues.length > 20) {
        console.log(chalk.gray(`  ... and ${this.results.issues.length - 20} more issues`));
      }
    }
  }

  async generateReport(format = 'console') {
    switch (format) {
      case 'json':
        return JSON.stringify(this.results, null, 2);
      case 'html':
        return this.generateHTMLReport();
      default:
        return this.results;
    }
  }

  generateHTMLReport() {
    // Placeholder for HTML report generation
    return '<html><body><h1>Documentation Validation Report</h1></body></html>';
  }
}

// CLI setup
const argv = yargs
  .option('docs', {
    alias: 'd',
    description: 'Documentation directory',
    type: 'string',
    default: 'docs/'
  })
  .option('config', {
    alias: 'c',
    description: 'Validation config file',
    type: 'string'
  })
  .option('fix', {
    description: 'Auto-fix issues where possible',
    type: 'boolean',
    default: false
  })
  .option('verbose', {
    alias: 'v',
    description: 'Enable verbose logging',
    type: 'boolean',
    default: false
  })
  .option('format', {
    alias: 'f',
    description: 'Output format',
    choices: ['console', 'json', 'html'],
    default: 'console'
  })
  .help()
  .argv;

// Main execution
async function main() {
  let config = DEFAULT_CONFIG;

  // Load custom config if provided
  if (argv.config && await fs.pathExists(argv.config)) {
    const customConfig = await fs.readJSON(argv.config);
    config = { ...DEFAULT_CONFIG, ...customConfig };
  }

  const validator = new DocumentationValidator({
    ...config,
    verbose: argv.verbose
  });

  const success = await validator.validate(argv.docs);

  if (argv.format !== 'console') {
    const report = await validator.generateReport(argv.format);
    console.log(report);
  }

  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = DocumentationValidator;