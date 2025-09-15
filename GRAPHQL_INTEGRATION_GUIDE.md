# GraphQL Integration Guide for OmniBazaar Modules

This guide documents the proven pattern for integrating OmniBazaar modules with the centralized GraphQL API managed by the Validator module.

## Overview

The GraphQL integration replaces direct database access with API calls, enabling:
- Centralized data management in YugabyteDB
- Consistent API across all modules
- Server-side ID generation and validation
- Cross-module data access

## Key Components

### 1. GraphQL Schema Extension (Validator Module)

Each module extends the base GraphQL schema in the Validator:

```typescript
// Validator/src/api/graphql/[module]Schema.ts
export const moduleTypeDefs = gql`
  # Define types
  type Document {
    id: String!
    title: String!
    # ... other fields
  }

  # Extend Query type
  extend type Query {
    getDocument(id: String!): Document
    searchDocuments(
      query: String
      category: DocumentCategory
      # ... other parameters
    ): DocumentSearchResult!
  }

  # Extend Mutation type
  extend type Mutation {
    createDocument(input: CreateDocumentInput!): Document!
    updateDocument(id: String!, input: UpdateDocumentInput!): Document!
  }
`;
```

### 2. GraphQL Client (Module Side)

```typescript
// [Module]/src/api/graphqlClient.ts
export class ModuleGraphQLClient {
  private endpoint: string;

  constructor(endpoint = 'http://localhost:4000/graphql') {
    this.endpoint = endpoint;
  }

  async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }
    return result.data;
  }

  // Module-specific methods
  async createDocument(input: Record<string, unknown>): Promise<Document> {
    const data = await this.query<{ createDocument: Document }>(
      mutations.createDocument,
      { input }
    );
    return data.createDocument;
  }
}
```

### 3. Database Adapter Pattern

For modules that need to maintain compatibility with existing database interfaces:

```typescript
// [Module]/src/services/database/GraphQLDatabase.ts
export class GraphQLDatabase implements Database {
  private client: ModuleGraphQLClient;

  async query<T>(text: string, values?: unknown[]): Promise<QueryResult<T>> {
    const normalizedQuery = text.toLowerCase();

    // Handle different query types
    if (normalizedQuery.includes('insert into')) {
      return this.handleInsert(text, values);
    } else if (normalizedQuery.includes('select')) {
      return this.handleSelect(text, values);
    } else if (normalizedQuery.includes('update')) {
      return this.handleUpdate(text, values);
    }
    // ... handle other query types
  }

  private async handleInsert<T>(text: string, values?: unknown[]): Promise<QueryResult<T>> {
    // Parse INSERT query and convert to GraphQL mutation
    const tableName = this.extractTableName(text);
    const data = this.extractInsertData(text, values);

    // Call appropriate GraphQL mutation based on table
    if (tableName === 'documents') {
      const created = await this.client.createDocument(data);
      return {
        rows: [created as T],
        rowCount: 1,
        command: 'INSERT',
      };
    }
    // ... handle other tables
  }
}
```

## Implementation Steps

### 1. Define GraphQL Schema (Validator)

- Create schema file: `Validator/src/api/graphql/[module]Schema.ts`
- Define types, queries, mutations, and subscriptions
- Use proper GraphQL types (enums, scalars, etc.)

### 2. Implement Resolvers (Validator)

```typescript
// Validator/src/api/graphql/[module]Resolvers.ts
export const moduleResolvers = {
  Query: {
    async getDocument(_: unknown, args: { id: string }, context: Context) {
      const result = await context.database.query(
        'SELECT * FROM documents WHERE id = $1',
        [args.id]
      );
      return transformDocument(result.rows[0]);
    },
  },
  Mutation: {
    async createDocument(_: unknown, args: { input: any }, context: Context) {
      const id = uuidv4(); // Server-side ID generation
      const result = await context.database.query(
        'INSERT INTO documents (...) VALUES (...) RETURNING *',
        [id, ...values]
      );
      return transformDocument(result.rows[0]);
    },
  },
};
```

### 3. Create GraphQL Client (Module)

- Implement client with typed methods
- Handle errors appropriately
- Support all required operations

### 4. Adapt Existing Code

For modules with existing database-dependent code:

```typescript
// Before (direct database)
const db = new YugabyteDatabase(config);
const result = await db.query('SELECT * FROM documents WHERE id = $1', [id]);

// After (GraphQL)
const db = new GraphQLDatabase(config);
const result = await db.query('SELECT * FROM documents WHERE id = $1', [id]);
// GraphQLDatabase internally converts to: await client.getDocument(id)
```

## Best Practices

### 1. Server-Side ID Generation

**Never generate IDs client-side**. Always let the GraphQL server assign IDs:

```typescript
// ❌ Wrong
const document = {
  id: uuidv4(), // Don't do this
  title: 'Example',
};

// ✅ Correct
const document = {
  title: 'Example',
  // id will be assigned by server
};
```

### 2. Field Name Mapping

Handle database column names vs GraphQL field names:

```typescript
// Database uses snake_case
ipfs_hash, created_at, is_official

// GraphQL uses camelCase
ipfsHash, createdAt, isOfficial

// Map in resolver/adapter
const graphqlField = databaseColumn.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
```

### 3. Query Parameter Handling

GraphQL doesn't support SQL wildcards. Handle text search properly:

```typescript
// SQL query with wildcards
WHERE title ILIKE $1  // value: '%search term%'

// Convert to GraphQL
searchDocuments(query: "search term")  // No wildcards needed
```

### 4. Error Handling

Provide clear error messages:

```typescript
try {
  const result = await client.query(operation, variables);
  return result;
} catch (error) {
  logger.error('GraphQL operation failed', {
    operation,
    variables,
    error: error.message,
  });
  throw new Error(`Failed to ${operation}: ${error.message}`);
}
```

## Testing

### 1. Start GraphQL Server

```bash
cd Validator
YUGABYTE_HOST=127.0.1.1 node scripts/start-graphql-test.js
```

### 2. Run Module Tests

```bash
cd [Module]
npm test tests/integration/
```

### 3. Verify Database State

```bash
PGPASSWORD=yugabyte psql -h 127.0.1.1 -p 5433 -U yugabyte -d omnibazaar \
  -c "SELECT id, title FROM documents;"
```

## Migration Checklist

When migrating a module to GraphQL:

- [ ] Define GraphQL schema in Validator
- [ ] Implement resolvers with proper data transformation
- [ ] Create typed GraphQL client in module
- [ ] Implement database adapter if needed
- [ ] Update service layer to use GraphQL client
- [ ] Remove direct database dependencies
- [ ] Update tests to use GraphQL
- [ ] Document API changes

## Common Issues and Solutions

### Issue: "Unknown type" GraphQL errors
**Solution**: Ensure the schema is properly loaded in the Validator and types match exactly.

### Issue: ID mismatch between client and server
**Solution**: Remove all client-side ID generation. Use server-returned IDs.

### Issue: Field name mismatches (snake_case vs camelCase)
**Solution**: Map field names in resolvers or adapters.

### Issue: SQL wildcards in GraphQL queries
**Solution**: Use the `query` parameter for text search, not wildcards in enum fields.

## Benefits

1. **Centralized Data Management**: All data operations go through one API
2. **Type Safety**: GraphQL provides strong typing
3. **Cross-Module Access**: Modules can easily query each other's data
4. **Consistent API**: Same patterns across all modules
5. **Server Authority**: Server controls ID generation and validation

This pattern has been successfully implemented and tested in the Documents module and provides a solid foundation for all OmniBazaar modules.