#!/usr/bin/env node

/**
 * Documentation Extraction Tool
 * 
 * Automatically extracts documentation from code comments, JSDoc,
 * and TypeScript interfaces to generate structured documentation.
 * 
 * Usage:
 *   node tools/extractors/extract-docs.js [options]
 * 
 * Options:
 *   --source <path>     Source directory to scan (default: src/)
 *   --output <path>     Output directory for docs (default: docs/api-reference/)
 *   --format <format>   Output format: json|markdown|html (default: markdown)
 *   --watch            Watch for changes and auto-regenerate
 *   --verbose          Enable verbose logging
 */

const fs = require('fs-extra');
const path = require('path');
const glob = require('fast-glob');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const chalk = require('chalk');
const chokidar = require('chokidar');
const yargs = require('yargs');

// Configuration
const DEFAULT_CONFIG = {
  source: 'src/',
  output: 'docs/api-reference/generated/',
  format: 'markdown',
  filePatterns: [
    '**/*.ts',
    '**/*.tsx',
    '**/*.js',
    '**/*.jsx'
  ],
  excludePatterns: [
    '**/*.test.*',
    '**/*.spec.*',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**'
  ],
  extractors: {
    functions: true,
    classes: true,
    interfaces: true,
    types: true,
    constants: true,
    enums: true,
    comments: true
  }
};

class DocumentationExtractor {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.docs = {
      functions: [],
      classes: [],
      interfaces: [],
      types: [],
      constants: [],
      enums: [],
      modules: []
    };
    this.stats = {
      filesProcessed: 0,
      docsExtracted: 0,
      errors: 0
    };
  }

  async extract() {
    console.log(chalk.blue('🔍 Starting documentation extraction...\\n'));
    
    try {
      const files = await this.findSourceFiles();
      console.log(chalk.gray(`Found ${files.length} files to process\\n`));

      for (const file of files) {
        await this.processFile(file);
      }

      await this.generateOutput();
      this.printSummary();

    } catch (error) {
      console.error(chalk.red('❌ Extraction failed:'), error.message);
      process.exit(1);
    }
  }

  async findSourceFiles() {
    const patterns = this.config.filePatterns.map(pattern => 
      path.join(this.config.source, pattern)
    );

    return glob(patterns, {
      ignore: this.config.excludePatterns,
      absolute: true
    });
  }

  async processFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const relativePath = path.relative(process.cwd(), filePath);
      
      if (this.config.verbose) {
        console.log(chalk.gray(`Processing: ${relativePath}`));
      }

      const ast = this.parseFile(content, filePath);
      this.extractFromAST(ast, filePath);
      
      this.stats.filesProcessed++;

    } catch (error) {
      console.error(chalk.red(`Error processing ${filePath}:`), error.message);
      this.stats.errors++;
    }
  }

  parseFile(content, filePath) {
    const isTypeScript = path.extname(filePath).includes('ts');
    const isJSX = path.extname(filePath).includes('x');

    return parse(content, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: [
        'asyncGenerators',
        'bigInt',
        'classProperties',
        'decorators-legacy',
        'doExpressions',
        'dynamicImport',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'functionBind',
        'functionSent',
        'importMeta',
        'nullishCoalescingOperator',
        'numericSeparator',
        'objectRestSpread',
        'optionalCatchBinding',
        'optionalChaining',
        'throwExpressions',
        'topLevelAwait',
        'trailingFunctionCommas',
        ...(isTypeScript ? ['typescript'] : []),
        ...(isJSX ? ['jsx'] : [])
      ]
    });
  }

  extractFromAST(ast, filePath) {
    const moduleInfo = {
      path: filePath,
      name: path.basename(filePath, path.extname(filePath)),
      functions: [],
      classes: [],
      interfaces: [],
      types: [],
      constants: [],
      enums: []
    };

    traverse(ast, {
      // Extract function declarations
      FunctionDeclaration: (path) => {
        if (this.config.extractors.functions) {
          const func = this.extractFunction(path);
          if (func) {
            moduleInfo.functions.push(func);
            this.docs.functions.push({ ...func, module: filePath });
          }
        }
      },

      // Extract arrow functions and function expressions
      VariableDeclarator: (path) => {
        if (this.config.extractors.functions && this.isFunction(path.node.init)) {
          const func = this.extractFunctionFromVariable(path);
          if (func) {
            moduleInfo.functions.push(func);
            this.docs.functions.push({ ...func, module: filePath });
          }
        }

        if (this.config.extractors.constants && this.isConstant(path)) {
          const constant = this.extractConstant(path);
          if (constant) {
            moduleInfo.constants.push(constant);
            this.docs.constants.push({ ...constant, module: filePath });
          }
        }
      },

      // Extract class declarations
      ClassDeclaration: (path) => {
        if (this.config.extractors.classes) {
          const cls = this.extractClass(path);
          if (cls) {
            moduleInfo.classes.push(cls);
            this.docs.classes.push({ ...cls, module: filePath });
          }
        }
      },

      // Extract TypeScript interfaces
      TSInterfaceDeclaration: (path) => {
        if (this.config.extractors.interfaces) {
          const iface = this.extractInterface(path);
          if (iface) {
            moduleInfo.interfaces.push(iface);
            this.docs.interfaces.push({ ...iface, module: filePath });
          }
        }
      },

      // Extract TypeScript type aliases
      TSTypeAliasDeclaration: (path) => {
        if (this.config.extractors.types) {
          const type = this.extractTypeAlias(path);
          if (type) {
            moduleInfo.types.push(type);
            this.docs.types.push({ ...type, module: filePath });
          }
        }
      },

      // Extract enums
      TSEnumDeclaration: (path) => {
        if (this.config.extractors.enums) {
          const enumObj = this.extractEnum(path);
          if (enumObj) {
            moduleInfo.enums.push(enumObj);
            this.docs.enums.push({ ...enumObj, module: filePath });
          }
        }
      }
    });

    this.docs.modules.push(moduleInfo);
    this.stats.docsExtracted += Object.values(moduleInfo).reduce((sum, arr) => 
      Array.isArray(arr) ? sum + arr.length : sum, 0
    );
  }

  extractFunction(path) {
    const node = path.node;
    const leadingComments = this.extractComments(node.leadingComments);
    
    return {
      type: 'function',
      name: node.id?.name || 'anonymous',
      params: this.extractParameters(node.params),
      returnType: this.extractReturnType(node),
      async: node.async,
      generator: node.generator,
      comments: leadingComments,
      line: node.loc?.start.line,
      exported: this.isExported(path)
    };
  }

  extractFunctionFromVariable(path) {
    const node = path.node;
    const init = node.init;
    
    if (!this.isFunction(init)) return null;

    const leadingComments = this.extractComments(node.leadingComments);
    
    return {
      type: 'function',
      name: node.id.name,
      params: this.extractParameters(init.params),
      returnType: this.extractReturnType(init),
      async: init.async,
      generator: init.generator,
      comments: leadingComments,
      line: node.loc?.start.line,
      exported: this.isExported(path.parentPath)
    };
  }

  extractClass(path) {
    const node = path.node;
    const leadingComments = this.extractComments(node.leadingComments);
    
    return {
      type: 'class',
      name: node.id?.name || 'Anonymous',
      superClass: node.superClass?.name,
      methods: this.extractClassMethods(node),
      properties: this.extractClassProperties(node),
      comments: leadingComments,
      line: node.loc?.start.line,
      exported: this.isExported(path)
    };
  }

  extractInterface(path) {
    const node = path.node;
    const leadingComments = this.extractComments(node.leadingComments);
    
    return {
      type: 'interface',
      name: node.id.name,
      extends: node.extends?.map(ext => ext.expression?.name || ext.id?.name),
      properties: this.extractInterfaceProperties(node),
      comments: leadingComments,
      line: node.loc?.start.line,
      exported: this.isExported(path)
    };
  }

  extractTypeAlias(path) {
    const node = path.node;
    const leadingComments = this.extractComments(node.leadingComments);
    
    return {
      type: 'type',
      name: node.id.name,
      definition: this.extractTypeDefinition(node.typeAnnotation),
      comments: leadingComments,
      line: node.loc?.start.line,
      exported: this.isExported(path)
    };
  }

  extractEnum(path) {
    const node = path.node;
    const leadingComments = this.extractComments(node.leadingComments);
    
    return {
      type: 'enum',
      name: node.id.name,
      members: node.members.map(member => ({
        name: member.id.name,
        value: member.initializer?.value || member.initializer?.raw,
        comments: this.extractComments(member.leadingComments)
      })),
      comments: leadingComments,
      line: node.loc?.start.line,
      exported: this.isExported(path)
    };
  }

  extractConstant(path) {
    const node = path.node;
    const leadingComments = this.extractComments(node.leadingComments);
    
    return {
      type: 'constant',
      name: node.id.name,
      value: this.extractValue(node.init),
      valueType: this.extractValueType(node.init),
      comments: leadingComments,
      line: node.loc?.start.line,
      exported: this.isExported(path.parentPath)
    };
  }

  // Helper methods
  isFunction(node) {
    return node && (
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression'
    );
  }

  isConstant(path) {
    return path.parentPath.node.kind === 'const' && 
           !this.isFunction(path.node.init);
  }

  isExported(path) {
    let current = path;
    while (current) {
      if (current.node.type === 'ExportNamedDeclaration' ||
          current.node.type === 'ExportDefaultDeclaration') {
        return true;
      }
      current = current.parentPath;
    }
    return false;
  }

  extractComments(comments) {
    if (!comments) return null;
    
    return comments.map(comment => ({
      type: comment.type,
      value: comment.value.trim(),
      raw: comment.value
    }));
  }

  extractParameters(params) {
    return params.map(param => ({
      name: this.getParameterName(param),
      type: this.getParameterType(param),
      optional: param.optional,
      default: param.default ? this.extractValue(param.default) : undefined
    }));
  }

  getParameterName(param) {
    if (param.type === 'Identifier') return param.name;
    if (param.type === 'RestElement') return `...${param.argument.name}`;
    if (param.type === 'ObjectPattern') return '{...}';
    if (param.type === 'ArrayPattern') return '[...]';
    return 'unknown';
  }

  getParameterType(param) {
    if (param.typeAnnotation) {
      return this.extractTypeDefinition(param.typeAnnotation.typeAnnotation);
    }
    return 'any';
  }

  extractReturnType(node) {
    if (node.returnType) {
      return this.extractTypeDefinition(node.returnType.typeAnnotation);
    }
    return 'any';
  }

  extractTypeDefinition(typeNode) {
    if (!typeNode) return 'any';
    
    switch (typeNode.type) {
      case 'TSStringKeyword': return 'string';
      case 'TSNumberKeyword': return 'number';
      case 'TSBooleanKeyword': return 'boolean';
      case 'TSVoidKeyword': return 'void';
      case 'TSAnyKeyword': return 'any';
      case 'TSUnknownKeyword': return 'unknown';
      case 'TSTypeReference':
        return typeNode.typeName.name;
      case 'TSUnionType':
        return typeNode.types.map(t => this.extractTypeDefinition(t)).join(' | ');
      case 'TSArrayType':
        return `${this.extractTypeDefinition(typeNode.elementType)}[]`;
      default:
        return 'unknown';
    }
  }

  extractValue(node) {
    if (!node) return undefined;
    
    switch (node.type) {
      case 'StringLiteral':
      case 'NumericLiteral':
      case 'BooleanLiteral':
        return node.value;
      case 'NullLiteral':
        return null;
      case 'ObjectExpression':
        return '{...}';
      case 'ArrayExpression':
        return '[...]';
      default:
        return node.raw || 'unknown';
    }
  }

  extractValueType(node) {
    if (!node) return 'undefined';
    
    switch (node.type) {
      case 'StringLiteral': return 'string';
      case 'NumericLiteral': return 'number';
      case 'BooleanLiteral': return 'boolean';
      case 'NullLiteral': return 'null';
      case 'ObjectExpression': return 'object';
      case 'ArrayExpression': return 'array';
      default: return 'unknown';
    }
  }

  extractClassMethods(classNode) {
    return classNode.body.body
      .filter(node => node.type === 'MethodDefinition')
      .map(method => ({
        name: method.key.name,
        kind: method.kind, // 'constructor', 'method', 'get', 'set'
        static: method.static,
        params: this.extractParameters(method.value.params),
        returnType: this.extractReturnType(method.value),
        comments: this.extractComments(method.leadingComments),
        line: method.loc?.start.line
      }));
  }

  extractClassProperties(classNode) {
    return classNode.body.body
      .filter(node => node.type === 'PropertyDefinition' || node.type === 'ClassProperty')
      .map(prop => ({
        name: prop.key.name,
        type: prop.typeAnnotation ? 
          this.extractTypeDefinition(prop.typeAnnotation.typeAnnotation) : 'any',
        static: prop.static,
        value: this.extractValue(prop.value),
        comments: this.extractComments(prop.leadingComments),
        line: prop.loc?.start.line
      }));
  }

  extractInterfaceProperties(interfaceNode) {
    return interfaceNode.body.body.map(prop => ({
      name: prop.key.name,
      type: this.extractTypeDefinition(prop.typeAnnotation.typeAnnotation),
      optional: prop.optional,
      readonly: prop.readonly,
      comments: this.extractComments(prop.leadingComments),
      line: prop.loc?.start.line
    }));
  }

  async generateOutput() {
    await fs.ensureDir(this.config.output);
    
    switch (this.config.format) {
      case 'json':
        await this.generateJSONOutput();
        break;
      case 'markdown':
        await this.generateMarkdownOutput();
        break;
      case 'html':
        await this.generateHTMLOutput();
        break;
      default:
        throw new Error(`Unsupported output format: ${this.config.format}`);
    }
  }

  async generateJSONOutput() {
    const outputPath = path.join(this.config.output, 'api-docs.json');
    await fs.writeJSON(outputPath, this.docs, { spaces: 2 });
    console.log(chalk.green(`✅ Generated JSON documentation: ${outputPath}`));
  }

  async generateMarkdownOutput() {
    // Generate index file
    const indexContent = this.generateMarkdownIndex();
    await fs.writeFile(
      path.join(this.config.output, 'README.md'),
      indexContent
    );

    // Generate individual module files
    for (const module of this.docs.modules) {
      const moduleContent = this.generateMarkdownModule(module);
      const filename = `${module.name}.md`;
      await fs.writeFile(
        path.join(this.config.output, filename),
        moduleContent
      );
    }

    console.log(chalk.green(`✅ Generated Markdown documentation in: ${this.config.output}`));
  }

  generateMarkdownIndex() {
    return `# API Documentation

*Generated automatically from source code*

## Modules

${this.docs.modules.map(module => 
  `- [${module.name}](./${module.name}.md)`
).join('\\n')}

## Statistics

- **Files Processed**: ${this.stats.filesProcessed}
- **Functions**: ${this.docs.functions.length}
- **Classes**: ${this.docs.classes.length}
- **Interfaces**: ${this.docs.interfaces.length}
- **Types**: ${this.docs.types.length}
- **Constants**: ${this.docs.constants.length}
- **Enums**: ${this.docs.enums.length}

---

*Last updated: ${new Date().toISOString()}*
`;
  }

  generateMarkdownModule(module) {
    let content = `# ${module.name}

*Module: \`${path.relative(process.cwd(), module.path)}\`*

`;

    if (module.functions.length > 0) {
      content += `## Functions

${module.functions.map(func => this.formatMarkdownFunction(func)).join('\\n\\n')}

`;
    }

    if (module.classes.length > 0) {
      content += `## Classes

${module.classes.map(cls => this.formatMarkdownClass(cls)).join('\\n\\n')}

`;
    }

    if (module.interfaces.length > 0) {
      content += `## Interfaces

${module.interfaces.map(iface => this.formatMarkdownInterface(iface)).join('\\n\\n')}

`;
    }

    if (module.types.length > 0) {
      content += `## Types

${module.types.map(type => this.formatMarkdownType(type)).join('\\n\\n')}

`;
    }

    if (module.constants.length > 0) {
      content += `## Constants

${module.constants.map(constant => this.formatMarkdownConstant(constant)).join('\\n\\n')}

`;
    }

    if (module.enums.length > 0) {
      content += `## Enums

${module.enums.map(enumObj => this.formatMarkdownEnum(enumObj)).join('\\n\\n')}

`;
    }

    return content;
  }

  formatMarkdownFunction(func) {
    const params = func.params.map(p => 
      `${p.name}${p.optional ? '?' : ''}: ${p.type}`
    ).join(', ');
    
    let content = `### ${func.name}

\`\`\`typescript
${func.async ? 'async ' : ''}function ${func.name}(${params}): ${func.returnType}
\`\`\`

`;

    if (func.comments) {
      content += `${this.formatComments(func.comments)}\\n\\n`;
    }

    if (func.params.length > 0) {
      content += `**Parameters:**

${func.params.map(p => 
  `- \`${p.name}\` (${p.type}${p.optional ? ', optional' : ''})${p.default ? ` - Default: \`${p.default}\`` : ''}`
).join('\\n')}

`;
    }

    content += `**Returns:** \`${func.returnType}\`\\n`;
    
    return content;
  }

  formatMarkdownClass(cls) {
    let content = `### ${cls.name}

\`\`\`typescript
class ${cls.name}${cls.superClass ? ` extends ${cls.superClass}` : ''}
\`\`\`

`;

    if (cls.comments) {
      content += `${this.formatComments(cls.comments)}\\n\\n`;
    }

    if (cls.properties.length > 0) {
      content += `**Properties:**

${cls.properties.map(prop => 
  `- \`${prop.static ? 'static ' : ''}${prop.name}: ${prop.type}\``
).join('\\n')}

`;
    }

    if (cls.methods.length > 0) {
      content += `**Methods:**

${cls.methods.map(method => {
        const params = method.params.map(p => 
          `${p.name}: ${p.type}`
        ).join(', ');
        return `- \`${method.static ? 'static ' : ''}${method.name}(${params}): ${method.returnType}\``;
      }).join('\\n')}

`;
    }

    return content;
  }

  formatMarkdownInterface(iface) {
    let content = `### ${iface.name}

\`\`\`typescript
interface ${iface.name}${iface.extends?.length ? ` extends ${iface.extends.join(', ')}` : ''}
\`\`\`

`;

    if (iface.comments) {
      content += `${this.formatComments(iface.comments)}\\n\\n`;
    }

    if (iface.properties.length > 0) {
      content += `**Properties:**

${iface.properties.map(prop => 
  `- \`${prop.readonly ? 'readonly ' : ''}${prop.name}${prop.optional ? '?' : ''}: ${prop.type}\``
).join('\\n')}

`;
    }

    return content;
  }

  formatMarkdownType(type) {
    let content = `### ${type.name}

\`\`\`typescript
type ${type.name} = ${type.definition}
\`\`\`

`;

    if (type.comments) {
      content += `${this.formatComments(type.comments)}\\n\\n`;
    }

    return content;
  }

  formatMarkdownConstant(constant) {
    let content = `### ${constant.name}

\`\`\`typescript
const ${constant.name}: ${constant.valueType} = ${JSON.stringify(constant.value)}
\`\`\`

`;

    if (constant.comments) {
      content += `${this.formatComments(constant.comments)}\\n\\n`;
    }

    return content;
  }

  formatMarkdownEnum(enumObj) {
    let content = `### ${enumObj.name}

\`\`\`typescript
enum ${enumObj.name} {
${enumObj.members.map(member => 
  `  ${member.name}${member.value !== undefined ? ` = ${JSON.stringify(member.value)}` : ''}`
).join(',\\n')}
}
\`\`\`

`;

    if (enumObj.comments) {
      content += `${this.formatComments(enumObj.comments)}\\n\\n`;
    }

    if (enumObj.members.some(m => m.comments)) {
      content += `**Members:**

${enumObj.members.map(member => 
  `- \`${member.name}\`${member.comments ? ': ' + this.formatComments(member.comments, false) : ''}`
).join('\\n')}

`;
    }

    return content;
  }

  formatComments(comments, multiline = true) {
    if (!comments || comments.length === 0) return '';
    
    const formatted = comments.map(comment => {
      if (comment.type === 'CommentBlock') {
        // Parse JSDoc-style comments
        const lines = comment.value.split('\\n').map(line => line.trim().replace(/^\*\s?/, ''));
        return lines.join(multiline ? '\\n' : ' ').trim();
      }
      return comment.value;
    }).join(multiline ? '\\n\\n' : ' ');

    return multiline ? formatted : formatted.replace(/\\n/g, ' ');
  }

  async generateHTMLOutput() {
    // Placeholder for HTML generation
    console.log(chalk.yellow('⚠️ HTML output not yet implemented'));
  }

  printSummary() {
    console.log(chalk.white('\\n📊 Extraction Summary:\\n'));
    console.log(chalk.green(`✅ Files processed: ${this.stats.filesProcessed}`));
    console.log(chalk.green(`✅ Documentation entries: ${this.stats.docsExtracted}`));
    
    if (this.stats.errors > 0) {
      console.log(chalk.red(`❌ Errors: ${this.stats.errors}`));
    }

    console.log(chalk.white('\\n📋 Extracted:'));
    console.log(chalk.blue(`  Functions: ${this.docs.functions.length}`));
    console.log(chalk.blue(`  Classes: ${this.docs.classes.length}`));
    console.log(chalk.blue(`  Interfaces: ${this.docs.interfaces.length}`));
    console.log(chalk.blue(`  Types: ${this.docs.types.length}`));
    console.log(chalk.blue(`  Constants: ${this.docs.constants.length}`));
    console.log(chalk.blue(`  Enums: ${this.docs.enums.length}`));
  }

  watch() {
    const patterns = this.config.filePatterns.map(pattern => 
      path.join(this.config.source, pattern)
    );

    console.log(chalk.blue('👀 Watching for changes...\\n'));

    const watcher = chokidar.watch(patterns, {
      ignored: this.config.excludePatterns,
      persistent: true
    });

    watcher.on('change', async (filePath) => {
      console.log(chalk.yellow(`📝 File changed: ${path.relative(process.cwd(), filePath)}`));
      
      // Reset docs and reprocess
      this.docs = {
        functions: [],
        classes: [],
        interfaces: [],
        types: [],
        constants: [],
        enums: [],
        modules: []
      };
      this.stats = { filesProcessed: 0, docsExtracted: 0, errors: 0 };

      await this.extract();
    });

    watcher.on('add', async (filePath) => {
      console.log(chalk.green(`➕ File added: ${path.relative(process.cwd(), filePath)}`));
      await this.extract();
    });

    watcher.on('unlink', async (filePath) => {
      console.log(chalk.red(`➖ File removed: ${path.relative(process.cwd(), filePath)}`));
      await this.extract();
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\\n👋 Stopping watcher...'));
      watcher.close();
      process.exit(0);
    });
  }
}

// CLI setup
const argv = yargs
  .option('source', {
    alias: 's',
    description: 'Source directory to scan',
    type: 'string',
    default: 'src/'
  })
  .option('output', {
    alias: 'o',
    description: 'Output directory for docs',
    type: 'string',
    default: 'docs/api-reference/generated/'
  })
  .option('format', {
    alias: 'f',
    description: 'Output format',
    choices: ['json', 'markdown', 'html'],
    default: 'markdown'
  })
  .option('watch', {
    alias: 'w',
    description: 'Watch for changes',
    type: 'boolean',
    default: false
  })
  .option('verbose', {
    alias: 'v',
    description: 'Enable verbose logging',
    type: 'boolean',
    default: false
  })
  .help()
  .argv;

// Main execution
async function main() {
  const extractor = new DocumentationExtractor({
    source: argv.source,
    output: argv.output,
    format: argv.format,
    verbose: argv.verbose
  });

  if (argv.watch) {
    await extractor.extract();
    extractor.watch();
  } else {
    await extractor.extract();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = DocumentationExtractor;