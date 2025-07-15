module.exports = {
  // Basic formatting options
  semi: true,
  trailingComma: 'all',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  
  // JSX specific options
  jsxSingleQuote: true,
  jsxBracketSameLine: false,
  
  // Other formatting options
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  endOfLine: 'lf',
  quoteProps: 'as-needed',
  
  // File-specific overrides
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 80,
        tabWidth: 2,
      },
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always',
        tabWidth: 2,
      },
    },
    {
      files: '*.yml',
      options: {
        tabWidth: 2,
        singleQuote: false,
      },
    },
    {
      files: '*.yaml',
      options: {
        tabWidth: 2,
        singleQuote: false,
      },
    },
    {
      files: 'src/ai/**/*.{ts,tsx}',
      options: {
        // AI/ML code might need longer lines for formulas
        printWidth: 120,
      },
    },
    {
      files: 'docs/**/*.md',
      options: {
        // Documentation formatting
        printWidth: 80,
        proseWrap: 'always',
        tabWidth: 2,
      },
    },
  ],
};