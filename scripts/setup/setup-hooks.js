#!/usr/bin/env node

/**
 * Documentation Reminder System Setup
 * 
 * Sets up git hooks and notification systems to remind developers
 * to update documentation when making code changes.
 * 
 * Features:
 * - Pre-commit hooks for documentation validation
 * - Post-commit hooks for documentation update reminders
 * - Pre-push hooks for comprehensive documentation checks
 * - Automated documentation gap detection
 * - Developer notification preferences
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');

class DocumentationReminderSystem {
  constructor() {
    this.hooksDir = path.join(process.cwd(), '.git', 'hooks');
    this.configFile = path.join(process.cwd(), '.docreminder.json');
    this.defaultConfig = {
      enabled: true,
      notifications: {
        console: true,
        email: false,
        slack: false,
        dashboard: true
      },
      thresholds: {
        filesChangedWithoutDocs: 3,
        daysWithoutDocUpdate: 7,
        linesOfCodePerDocLine: 10
      },
      rules: {
        requireDocsForNewFeatures: true,
        requireDocsForPublicAPI: true,
        requireDocsForBreakingChanges: true,
        skipForTests: true,
        skipForMinorChanges: false
      },
      patterns: {
        codeFiles: ['.ts', '.tsx', '.js', '.jsx'],
        documentFiles: ['.md', '.mdx'],
        excludePaths: ['node_modules/', 'dist/', 'build/', '.git/']
      }
    };
  }

  async setup() {
    console.log(chalk.blue('🔧 Setting up documentation reminder system...\\n'));

    try {
      await this.checkGitRepository();
      await this.createConfig();
      await this.setupGitHooks();
      await this.createNotificationSystem();
      await this.createDashboard();
      
      console.log(chalk.green('✅ Documentation reminder system setup complete!\\n'));
      this.printInstructions();

    } catch (error) {
      console.error(chalk.red('❌ Setup failed:'), error.message);
      process.exit(1);
    }
  }

  async checkGitRepository() {
    if (!await fs.pathExists('.git')) {
      throw new Error('Not a git repository. Please run this from the root of a git repository.');
    }

    if (!await fs.pathExists(this.hooksDir)) {
      await fs.ensureDir(this.hooksDir);
    }
  }

  async createConfig() {
    if (await fs.pathExists(this.configFile)) {
      console.log(chalk.yellow('⚠️ Configuration file already exists. Updating...'));
      const existingConfig = await fs.readJSON(this.configFile);
      const mergedConfig = { ...this.defaultConfig, ...existingConfig };
      await fs.writeJSON(this.configFile, mergedConfig, { spaces: 2 });
    } else {
      await fs.writeJSON(this.configFile, this.defaultConfig, { spaces: 2 });
      console.log(chalk.green('✅ Created configuration file: .docreminder.json'));
    }
  }

  async setupGitHooks() {
    const hooks = [
      { name: 'pre-commit', script: this.generatePreCommitHook() },
      { name: 'post-commit', script: this.generatePostCommitHook() },
      { name: 'pre-push', script: this.generatePrePushHook() }
    ];

    for (const hook of hooks) {
      await this.installHook(hook.name, hook.script);
    }
  }

  async installHook(hookName, script) {
    const hookPath = path.join(this.hooksDir, hookName);
    
    if (await fs.pathExists(hookPath)) {
      const backup = `${hookPath}.backup.${Date.now()}`;
      await fs.move(hookPath, backup);
      console.log(chalk.yellow(`⚠️ Backed up existing ${hookName} hook to: ${path.basename(backup)}`));
    }

    await fs.writeFile(hookPath, script);
    await fs.chmod(hookPath, '755'); // Make executable
    
    console.log(chalk.green(`✅ Installed ${hookName} hook`));
  }

  generatePreCommitHook() {
    return `#!/bin/bash
# Documentation Reminder Pre-Commit Hook
# Validates documentation and reminds developers to update docs

echo "🔍 Checking documentation requirements..."

# Get the directory of this script
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Run documentation validation
node "$REPO_ROOT/scripts/setup/check-docs-pre-commit.js"
DOCS_CHECK_EXIT=$?

if [ $DOCS_CHECK_EXIT -ne 0 ]; then
    echo "❌ Documentation check failed!"
    echo "💡 Please update documentation for your changes before committing."
    echo "📖 Run 'npm run docs:validate' for more details."
    exit 1
fi

echo "✅ Documentation check passed!"
exit 0
`;
  }

  generatePostCommitHook() {
    return `#!/bin/bash
# Documentation Reminder Post-Commit Hook
# Reminds developers about documentation after successful commits

echo "📝 Checking if documentation needs updates..."

# Get the directory of this script
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Run post-commit documentation check
node "$REPO_ROOT/scripts/setup/check-docs-post-commit.js"

# This hook always succeeds (doesn't block commits)
exit 0
`;
  }

  generatePrePushHook() {
    return `#!/bin/bash
# Documentation Reminder Pre-Push Hook
# Comprehensive documentation check before pushing

echo "🚀 Running comprehensive documentation check before push..."

# Get the directory of this script
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Run comprehensive documentation validation
node "$REPO_ROOT/tools/validators/validate-docs.js" --docs docs/
VALIDATION_EXIT=$?

if [ $VALIDATION_EXIT -ne 0 ]; then
    echo "❌ Documentation validation failed!"
    echo "💡 Please fix documentation issues before pushing."
    echo "🔧 Run 'npm run docs:validate' to see specific issues."
    echo "🆘 Use 'git push --no-verify' to skip this check (not recommended)."
    exit 1
fi

echo "✅ Documentation validation passed!"
exit 0
`;
  }

  async createNotificationSystem() {
    // Create pre-commit check script
    await this.createPreCommitCheck();
    
    // Create post-commit check script
    await this.createPostCommitCheck();
    
    // Create dashboard generator
    await this.createDashboardGenerator();
  }

  async createPreCommitCheck() {
    const script = `#!/usr/bin/env node

/**
 * Pre-Commit Documentation Check
 * 
 * Validates that code changes include appropriate documentation updates
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

class PreCommitDocCheck {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    const configPath = path.join(process.cwd(), '.docreminder.json');
    if (fs.existsSync(configPath)) {
      return fs.readJSONSync(configPath);
    }
    return {};
  }

  async check() {
    if (!this.config.enabled) {
      console.log('📝 Documentation reminders disabled');
      return true;
    }

    try {
      const stagedFiles = this.getStagedFiles();
      const analysis = await this.analyzeChanges(stagedFiles);
      
      return this.evaluateDocumentationNeed(analysis);

    } catch (error) {
      console.error(chalk.red('Error in documentation check:'), error.message);
      return true; // Don't block commits on error
    }
  }

  getStagedFiles() {
    try {
      const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
      return output.trim().split('\\n').filter(file => file.length > 0);
    } catch (error) {
      return [];
    }
  }

  async analyzeChanges(files) {
    const analysis = {
      codeFiles: [],
      docFiles: [],
      newFeatures: false,
      publicAPIChanges: false,
      breakingChanges: false,
      linesChanged: 0
    };

    for (const file of files) {
      const ext = path.extname(file);
      
      if (this.config.patterns?.codeFiles?.includes(ext)) {
        analysis.codeFiles.push(file);
        analysis.linesChanged += this.getChangedLines(file);
        
        // Check for new features, API changes, etc.
        const diff = this.getFileDiff(file);
        if (this.detectNewFeature(diff)) analysis.newFeatures = true;
        if (this.detectAPIChange(diff)) analysis.publicAPIChanges = true;
        if (this.detectBreakingChange(diff)) analysis.breakingChanges = true;
      }
      
      if (this.config.patterns?.documentFiles?.includes(ext)) {
        analysis.docFiles.push(file);
      }
    }

    return analysis;
  }

  getChangedLines(file) {
    try {
      const output = execSync(\`git diff --cached --numstat "\${file}"\`, { encoding: 'utf8' });
      const [added, removed] = output.trim().split('\\t');
      return parseInt(added || 0) + parseInt(removed || 0);
    } catch (error) {
      return 0;
    }
  }

  getFileDiff(file) {
    try {
      return execSync(\`git diff --cached "\${file}"\`, { encoding: 'utf8' });
    } catch (error) {
      return '';
    }
  }

  detectNewFeature(diff) {
    const patterns = [
      /\\+.*export.*function/,
      /\\+.*export.*class/,
      /\\+.*export.*interface/,
      /\\+.*@api/i,
      /\\+.*TODO.*feature/i
    ];
    return patterns.some(pattern => pattern.test(diff));
  }

  detectAPIChange(diff) {
    const patterns = [
      /\\+.*export/,
      /\\-.*export/,
      /\\+.*public/,
      /\\-.*public/,
      /\\+.*@param/,
      /\\-.*@param/
    ];
    return patterns.some(pattern => pattern.test(diff));
  }

  detectBreakingChange(diff) {
    const patterns = [
      /\\-.*export/,
      /BREAKING/i,
      /\\+.*@deprecated/i,
      /\\-.*function.*\\(/,
      /\\+.*function.*\\(/
    ];
    return patterns.some(pattern => pattern.test(diff));
  }

  evaluateDocumentationNeed(analysis) {
    const issues = [];

    // Check rules
    if (this.config.rules?.requireDocsForNewFeatures && analysis.newFeatures && analysis.docFiles.length === 0) {
      issues.push('New features detected but no documentation files updated');
    }

    if (this.config.rules?.requireDocsForPublicAPI && analysis.publicAPIChanges && analysis.docFiles.length === 0) {
      issues.push('Public API changes detected but no documentation updated');
    }

    if (this.config.rules?.requireDocsForBreakingChanges && analysis.breakingChanges && analysis.docFiles.length === 0) {
      issues.push('Breaking changes detected but no documentation updated');
    }

    // Check thresholds
    const threshold = this.config.thresholds?.linesOfCodePerDocLine || 10;
    if (analysis.codeFiles.length >= (this.config.thresholds?.filesChangedWithoutDocs || 3) && 
        analysis.docFiles.length === 0) {
      issues.push(\`\${analysis.codeFiles.length} code files changed without documentation updates\`);
    }

    if (issues.length > 0) {
      console.log(chalk.yellow('⚠️ Documentation reminders:'));
      issues.forEach(issue => {
        console.log(chalk.yellow(\`  • \${issue}\`));
      });
      console.log(chalk.blue('\\n💡 Consider updating documentation in:'));
      console.log(chalk.blue('  • README.md files'));
      console.log(chalk.blue('  • API documentation'));
      console.log(chalk.blue('  • User guides'));
      console.log(chalk.blue('  • CHANGELOG.md\\n'));
      
      return false; // Block commit
    }

    return true; // Allow commit
  }
}

// Run the check
const checker = new PreCommitDocCheck();
checker.check().then(success => {
  process.exit(success ? 0 : 1);
});
`;

    await fs.writeFile(
      path.join(process.cwd(), 'scripts/setup/check-docs-pre-commit.js'),
      script
    );
    await fs.chmod(
      path.join(process.cwd(), 'scripts/setup/check-docs-pre-commit.js'),
      '755'
    );
  }

  async createPostCommitCheck() {
    const script = `#!/usr/bin/env node

/**
 * Post-Commit Documentation Check
 * 
 * Provides helpful reminders and statistics after commits
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

class PostCommitDocCheck {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    const configPath = path.join(process.cwd(), '.docreminder.json');
    if (fs.existsSync(configPath)) {
      return fs.readJSONSync(configPath);
    }
    return {};
  }

  async check() {
    if (!this.config.enabled) {
      return;
    }

    try {
      const stats = await this.gatherStatistics();
      this.displayReminders(stats);
      await this.updateDashboard(stats);

    } catch (error) {
      console.error(chalk.red('Error in post-commit check:'), error.message);
    }
  }

  async gatherStatistics() {
    const lastCommit = this.getLastCommitFiles();
    const docAge = this.getDocumentationAge();
    const coverage = await this.calculateDocCoverage();

    return {
      lastCommit,
      docAge,
      coverage,
      timestamp: new Date().toISOString()
    };
  }

  getLastCommitFiles() {
    try {
      const output = execSync('git diff-tree --no-commit-id --name-only -r HEAD', { encoding: 'utf8' });
      const files = output.trim().split('\\n').filter(file => file.length > 0);
      
      return {
        total: files.length,
        code: files.filter(f => this.config.patterns?.codeFiles?.includes(path.extname(f))).length,
        docs: files.filter(f => this.config.patterns?.documentFiles?.includes(path.extname(f))).length
      };
    } catch (error) {
      return { total: 0, code: 0, docs: 0 };
    }
  }

  getDocumentationAge() {
    try {
      const output = execSync('git log -1 --format="%ct" -- docs/', { encoding: 'utf8' });
      const lastDocUpdate = parseInt(output.trim()) * 1000;
      const daysSince = Math.floor((Date.now() - lastDocUpdate) / (1000 * 60 * 60 * 24));
      return daysSince;
    } catch (error) {
      return null;
    }
  }

  async calculateDocCoverage() {
    try {
      // Simple coverage calculation based on exported functions with JSDoc
      const codeFiles = await this.findCodeFiles();
      let totalExports = 0;
      let documentedExports = 0;

      for (const file of codeFiles) {
        const content = await fs.readFile(file, 'utf8');
        const exports = (content.match(/export\\s+(function|class|interface|type)/g) || []).length;
        const documented = (content.match(/\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export/g) || []).length;
        
        totalExports += exports;
        documentedExports += documented;
      }

      return totalExports > 0 ? Math.round((documentedExports / totalExports) * 100) : 0;
    } catch (error) {
      return 0;
    }
  }

  async findCodeFiles() {
    const patterns = this.config.patterns?.codeFiles || ['.ts', '.tsx', '.js', '.jsx'];
    const files = [];
    
    const findFiles = async (dir) => {
      const items = await fs.readdir(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory() && !this.isExcluded(fullPath)) {
          await findFiles(fullPath);
        } else if (stat.isFile() && patterns.includes(path.extname(item))) {
          files.push(fullPath);
        }
      }
    };

    await findFiles('src');
    return files;
  }

  isExcluded(filePath) {
    const excludes = this.config.patterns?.excludePaths || [];
    return excludes.some(exclude => filePath.includes(exclude));
  }

  displayReminders(stats) {
    console.log(chalk.blue('\\n📊 Documentation Statistics:'));
    
    if (stats.lastCommit.code > 0 && stats.lastCommit.docs === 0) {
      console.log(chalk.yellow(\`⚠️ Last commit changed \${stats.lastCommit.code} code files but no documentation\`));
    }

    if (stats.docAge !== null && stats.docAge > (this.config.thresholds?.daysWithoutDocUpdate || 7)) {
      console.log(chalk.yellow(\`⚠️ Documentation last updated \${stats.docAge} days ago\`));
    }

    if (stats.coverage < 70) {
      console.log(chalk.yellow(\`⚠️ Documentation coverage: \${stats.coverage}% (consider improving)\`));
    } else {
      console.log(chalk.green(\`✅ Documentation coverage: \${stats.coverage}%\`));
    }

    console.log(chalk.blue('\\n💡 Quick documentation commands:'));
    console.log(chalk.gray('  npm run docs:generate  - Generate API docs'));
    console.log(chalk.gray('  npm run docs:validate  - Validate documentation'));
    console.log(chalk.gray('  npm run docs:extract   - Extract docs from code'));
    console.log('');
  }

  async updateDashboard(stats) {
    const dashboardPath = path.join(process.cwd(), 'docs/.dashboard.json');
    
    let dashboard = [];
    if (await fs.pathExists(dashboardPath)) {
      dashboard = await fs.readJSON(dashboardPath);
    }

    dashboard.push(stats);
    
    // Keep only last 30 entries
    if (dashboard.length > 30) {
      dashboard = dashboard.slice(-30);
    }

    await fs.writeJSON(dashboardPath, dashboard, { spaces: 2 });
  }
}

// Run the check
const checker = new PostCommitDocCheck();
checker.check();
`;

    await fs.writeFile(
      path.join(process.cwd(), 'scripts/setup/check-docs-post-commit.js'),
      script
    );
    await fs.chmod(
      path.join(process.cwd(), 'scripts/setup/check-docs-post-commit.js'),
      '755'
    );
  }

  async createDashboard() {
    const dashboardDir = path.join(process.cwd(), 'docs');
    await fs.ensureDir(dashboardDir);

    const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentation Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            border-bottom: 2px solid #e1e4e8;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .metric {
            display: inline-block;
            background: #f6f8fa;
            padding: 15px 20px;
            margin: 10px;
            border-radius: 6px;
            border-left: 4px solid #0366d6;
        }
        .metric.warning {
            border-left-color: #f66a0a;
        }
        .metric.error {
            border-left-color: #d73a49;
        }
        .metric.success {
            border-left-color: #28a745;
        }
        .chart {
            margin: 20px 0;
            height: 200px;
            background: #f6f8fa;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #586069;
        }
        .actions {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e1e4e8;
        }
        .btn {
            display: inline-block;
            padding: 8px 16px;
            margin: 5px;
            background: #0366d6;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            border: none;
            cursor: pointer;
        }
        .btn:hover {
            background: #0256cc;
        }
        .btn.secondary {
            background: #6f42c1;
        }
        .recent-activity {
            margin-top: 30px;
        }
        .activity-item {
            padding: 10px;
            border-left: 3px solid #e1e4e8;
            margin: 10px 0;
            background: #f6f8fa;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 Documentation Dashboard</h1>
            <p>Real-time documentation health and statistics</p>
            <small>Last updated: <span id="lastUpdated">Loading...</span></small>
        </div>

        <div class="metrics">
            <div class="metric success">
                <h3>Coverage</h3>
                <div id="coverage">Loading...</div>
            </div>
            <div class="metric">
                <h3>Last Update</h3>
                <div id="lastDocUpdate">Loading...</div>
            </div>
            <div class="metric">
                <h3>Total Files</h3>
                <div id="totalFiles">Loading...</div>
            </div>
            <div class="metric">
                <h3>Issues</h3>
                <div id="issues">Loading...</div>
            </div>
        </div>

        <div class="chart">
            <div>📈 Documentation coverage trends (Chart coming soon)</div>
        </div>

        <div class="actions">
            <h3>Quick Actions</h3>
            <button class="btn" onclick="generateDocs()">🔄 Generate Docs</button>
            <button class="btn" onclick="validateDocs()">✅ Validate Docs</button>
            <button class="btn secondary" onclick="extractDocs()">📤 Extract from Code</button>
            <a href="./api-reference/" class="btn">📖 View API Docs</a>
        </div>

        <div class="recent-activity">
            <h3>Recent Activity</h3>
            <div id="recentActivity">Loading...</div>
        </div>
    </div>

    <script>
        async function loadDashboard() {
            try {
                const response = await fetch('./.dashboard.json');
                const data = await response.json();
                
                if (data.length > 0) {
                    const latest = data[data.length - 1];
                    
                    document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
                    document.getElementById('coverage').textContent = latest.coverage + '%';
                    document.getElementById('lastDocUpdate').textContent = 
                        latest.docAge !== null ? \`\${latest.docAge} days ago\` : 'Unknown';
                    document.getElementById('totalFiles').textContent = latest.lastCommit.total;
                    document.getElementById('issues').textContent = '0'; // Placeholder
                    
                    // Show recent activity
                    const recentDiv = document.getElementById('recentActivity');
                    recentDiv.innerHTML = data.slice(-5).reverse().map(item => 
                        \`<div class="activity-item">
                            <strong>\${new Date(item.timestamp).toLocaleDateString()}</strong>: 
                            \${item.lastCommit.code} code files, \${item.lastCommit.docs} doc files changed
                         </div>\`
                    ).join('');
                }
            } catch (error) {
                console.error('Failed to load dashboard data:', error);
                document.getElementById('coverage').textContent = 'Error loading data';
            }
        }

        function generateDocs() {
            alert('Running: npm run docs:generate\\nCheck your terminal for progress.');
        }

        function validateDocs() {
            alert('Running: npm run docs:validate\\nCheck your terminal for results.');
        }

        function extractDocs() {
            alert('Running: npm run docs:extract\\nCheck your terminal for progress.');
        }

        // Load dashboard on page load
        loadDashboard();
        
        // Refresh every 30 seconds
        setInterval(loadDashboard, 30000);
    </script>
</body>
</html>`;

    await fs.writeFile(
      path.join(dashboardDir, 'dashboard.html'),
      dashboardHTML
    );

    console.log(chalk.green('✅ Created documentation dashboard'));
  }

  async createDashboardGenerator() {
    // This would create a script to generate dashboard data
    // For now, we'll just ensure the dashboard HTML exists
  }

  printInstructions() {
    console.log(chalk.white('📋 Setup Complete! Here\'s what was installed:\\n'));
    
    console.log(chalk.blue('🎣 Git Hooks:'));
    console.log('  • pre-commit: Validates documentation requirements');
    console.log('  • post-commit: Shows documentation statistics and reminders');
    console.log('  • pre-push: Comprehensive documentation validation\\n');
    
    console.log(chalk.blue('⚙️ Configuration:'));
    console.log('  • .docreminder.json: Customize reminder settings');
    console.log('  • Edit thresholds, rules, and notification preferences\\n');
    
    console.log(chalk.blue('📊 Dashboard:'));
    console.log('  • docs/dashboard.html: View documentation health');
    console.log('  • Automatically updated after each commit\\n');
    
    console.log(chalk.blue('🚀 Usage:'));
    console.log('  • npm run setup:hooks: Re-run this setup');
    console.log('  • npm run docs:validate: Manual validation');
    console.log('  • npm run docs:generate: Generate API docs');
    console.log('  • npm run docs:extract: Extract docs from code\\n');
    
    console.log(chalk.green('✨ Documentation reminders are now active!'));
    console.log(chalk.gray('   The system will remind you to update docs when making code changes.\\n'));
  }
}

// CLI execution
async function main() {
  const system = new DocumentationReminderSystem();
  await system.setup();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = DocumentationReminderSystem;
`;

    await fs.writeFile(
      path.join(process.cwd(), 'Documents/scripts/setup/setup-hooks.js'),
      script
    );
    await fs.chmod(
      path.join(process.cwd(), 'Documents/scripts/setup/setup-hooks.js'),
      '755'
    );

    console.log(chalk.green('✅ Created documentation reminder system setup script'));
  }

  async createNotificationConfig() {
    const configScript = `#!/usr/bin/env node

/**
 * Configure Documentation Notification Preferences
 * 
 * Allows developers to customize how they receive documentation reminders
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');

class NotificationConfigurator {
  constructor() {
    this.configFile = path.join(process.cwd(), '.docreminder.json');
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async configure() {
    console.log(chalk.blue('🔔 Configure Documentation Notifications\\n'));

    try {
      const config = await this.loadConfig();
      const newConfig = await this.promptForSettings(config);
      await this.saveConfig(newConfig);
      
      console.log(chalk.green('\\n✅ Notification preferences saved!'));
      
    } catch (error) {
      console.error(chalk.red('❌ Configuration failed:'), error.message);
    } finally {
      this.rl.close();
    }
  }

  async loadConfig() {
    if (await fs.pathExists(this.configFile)) {
      return await fs.readJSON(this.configFile);
    }
    return {};
  }

  async promptForSettings(config) {
    const newConfig = { ...config };

    // Enable/disable system
    const enabled = await this.prompt(
      'Enable documentation reminders? (y/n)',
      config.enabled !== false ? 'y' : 'n'
    );
    newConfig.enabled = enabled.toLowerCase() === 'y';

    if (!newConfig.enabled) {
      return newConfig;
    }

    // Notification preferences
    if (!newConfig.notifications) newConfig.notifications = {};

    const console = await this.prompt(
      'Show console notifications? (y/n)',
      config.notifications?.console !== false ? 'y' : 'n'
    );
    newConfig.notifications.console = console.toLowerCase() === 'y';

    const email = await this.prompt(
      'Enable email notifications? (y/n)',
      config.notifications?.email === true ? 'y' : 'n'
    );
    newConfig.notifications.email = email.toLowerCase() === 'y';

    if (newConfig.notifications.email) {
      newConfig.notifications.emailAddress = await this.prompt(
        'Email address:',
        config.notifications?.emailAddress || ''
      );
    }

    // Thresholds
    if (!newConfig.thresholds) newConfig.thresholds = {};

    const filesThreshold = await this.prompt(
      'Files changed without docs threshold:',
      config.thresholds?.filesChangedWithoutDocs || '3'
    );
    newConfig.thresholds.filesChangedWithoutDocs = parseInt(filesThreshold);

    const daysThreshold = await this.prompt(
      'Days without doc update threshold:',
      config.thresholds?.daysWithoutDocUpdate || '7'
    );
    newConfig.thresholds.daysWithoutDocUpdate = parseInt(daysThreshold);

    return newConfig;
  }

  async prompt(question, defaultValue = '') {
    return new Promise((resolve) => {
      const promptText = defaultValue ? 
        \`\${question} [\${defaultValue}]: \` : 
        \`\${question}: \`;
        
      this.rl.question(promptText, (answer) => {
        resolve(answer.trim() || defaultValue);
      });
    });
  }

  async saveConfig(config) {
    await fs.writeJSON(this.configFile, config, { spaces: 2 });
  }
}

// CLI execution
async function main() {
  const configurator = new NotificationConfigurator();
  await configurator.configure();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = NotificationConfigurator;
`;

    await fs.writeFile(
      path.join(process.cwd(), 'Documents/scripts/setup/config-notifications.js'),
      configScript
    );
    await fs.chmod(
      path.join(process.cwd(), 'Documents/scripts/setup/config-notifications.js'),
      '755'
    );

    console.log(chalk.green('✅ Created notification configuration script'));
  }
}

// CLI execution
async function main() {
  const system = new DocumentationReminderSystem();
  await system.setup();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = DocumentationReminderSystem;