# Architecture Deep Dive

## How It All Fits Together

This document explains the technical architecture of pg-graph-doc and how four different query languages can work on the same PostgreSQL instance.

## The Stack

```
┌──────────────────────────────────────────────────┐
│              Client Applications                 │
│  psql | Node.js | Web Apps | Mobile | mongosh   │
└──────────────────────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
         v            v            v
    ┌────────┐  ┌─────────┐  ┌──────────┐
    │  SQL   │  │ GraphQL │  │ MongoDB  │
    │ Native │  │PostgREST│  │ FerretDB │
    │:5432   │  │  :3000  │  │  :27017  │
    └────────┘  └─────────┘  └──────────┘
         │            │            │
         └────────────┴────────────┘
                      │
              ┌───────┴────────┐
              │   PostgreSQL   │
              │   Extensions   │
              │                │
              │  pg_graphql    │
              │  documentdb    │
              │  pg_cron       │
              │  postgis       │
              └────────────────┘
                      │
              ┌───────┴────────┐
              │  Storage Layer │
              │    (pgdata)    │
              └────────────────┘
```

## Components Explained

### PostgreSQL Core (Port 5432)

The foundation. Standard PostgreSQL 17 (or 16) with extensions loaded via `shared_preload_libraries`:

```bash
shared_preload_libraries=pg_documentdb_core,pg_documentdb,pg_cron
```

Extensions are initialized via `/docker-entrypoint-initdb.d/01_extensions.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_graphql;
CREATE EXTENSION IF NOT EXISTS documentdb_core;
CREATE EXTENSION IF NOT EXISTS documentdb CASCADE;
```

### PostgREST (Port 3000)

Provides HTTP access to PostgreSQL functions. The key configuration:

```bash
PGRST_DB_URI=postgres://postgres:postgres@pg-graph-doc
PGRST_DB_ANON_ROLE=postgres
PGRST_DB_SCHEMAS=public
```

PostgREST exposes the `graphql()` function created by pg_graphql at `/rpc/graphql`. When you query:

```bash
curl -X POST http://localhost:3000/rpc/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'
```

PostgREST translates this to:

```sql
SELECT graphql('{ __typename }', '{}'::jsonb);
```

### FerretDB (Port 27017)

Translates MongoDB wire protocol to PostgreSQL. Architecture:

```
MongoDB Client
    ↓ (MongoDB Wire Protocol)
FerretDB
    ↓ (SQL + DocumentDB Extensions)
PostgreSQL
```

FerretDB stores:
- Collection metadata in `documentdb_api_catalog.collections`
- Documents in `documentdb_data.documents_N` tables
- Documents as BSON in `document` column (type: `documentdb_core.bson`)

### pg_graphql Extension

Introspects your PostgreSQL schema and generates GraphQL types. For a table:

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT,
  price DECIMAL
);
```

pg_graphql automatically creates:

- **Types**: `Product`, `ProductEdge`, `ProductConnection`
- **Queries**: `productsCollection(first: Int, after: Cursor, ...)`
- **Mutations**: `insertIntoproductsCollection`, `updateproductsCollection`, `deleteFromproductsCollection`

**Critical requirement**: PRIMARY KEY on every table. Why?
- GraphQL needs globally unique IDs for each node
- Cursor-based pagination requires stable ordering
- Mutations need to identify specific records

### DocumentDB Extensions

Provides MongoDB-compatible document operations via SQL functions:

```sql
-- Insert
SELECT documentdb_api.insert_one('dbname', 'collection', '{"name": "Alice"}', FALSE);

-- Query
SELECT documentdb_api.find('dbname', 'collection', '{}', '{}', '{}', 50);

-- Create index
SELECT documentdb_api.create_indexes('dbname', 'collection', '[{"key": {"email": 1}, "unique": true}]');
```

Storage architecture:
- **Schemas**: `documentdb_api`, `documentdb_api_catalog`, `documentdb_data`, `documentdb_core`
- **Collections**: Tracked in `documentdb_api_catalog.collections`
- **Documents**: Stored in `documentdb_data.documents_N` tables as BSON
- **Indexes**: Stored as PostgreSQL indexes on document columns

## Data Flow Examples

### SQL Query

```bash
npm run sql "SELECT * FROM users WHERE email = 'alice@example.com'"
```

1. Node.js opens native PostgreSQL connection
2. Query executes directly against `public.users` table
3. PostgreSQL returns rows
4. Results printed as table

### GraphQL Query

```bash
npm run gql "{ usersCollection { edges { node { email } } } }"
```

1. Node.js POSTs to `http://localhost:3000/rpc/graphql`
2. PostgREST receives HTTP request
3. PostgREST calls PostgreSQL function: `SELECT graphql(...)`
4. pg_graphql extension:
   - Parses GraphQL query
   - Generates SQL: `SELECT id, email FROM users`
   - Executes and formats as GraphQL response
5. Returns JSON through PostgREST to client

### DocumentDB Query

```bash
npm run docdb users -q '{"email": "alice@example.com"}'
```

1. Node.js opens native PostgreSQL connection
2. Calls DocumentDB function: `SELECT documentdb_api.find('postgres', 'users', '{"email":"alice@example.com"}', ...)`
3. DocumentDB extension:
   - Looks up collection_id in `documentdb_api_catalog.collections`
   - Queries `documentdb_data.documents_N` table
   - Filters BSON documents matching query
   - Converts BSON to JSON
4. Returns JSON array

### MongoDB Query (via FerretDB)

```bash
npm run mongo -- users -q '{"email": "alice@example.com"}'
```

1. Node.js opens MongoDB connection to FerretDB (port 27017)
2. Sends MongoDB wire protocol message
3. FerretDB receives and parses message
4. FerretDB translates to DocumentDB API call (similar to above)
5. Returns results in MongoDB wire protocol format
6. Node.js MongoDB client parses and displays

## Storage Layout

### Relational Tables (SQL/GraphQL)

```sql
-- User-created tables in public schema
public.users (id, email, name, created_at)
public.products (id, name, price, category_id)
public.categories (id, name)

-- GraphQL metadata in graphql schema
graphql.type
graphql.field
graphql.relationship
```

### Document Collections (DocumentDB/MongoDB)

```sql
-- Collection registry
documentdb_api_catalog.collections (collection_id, collection_name, ...)

-- Document storage
documentdb_data.documents_1 (collection_id, document, created_at)
documentdb_data.documents_2 (collection_id, document, created_at)
documentdb_data.documents_N (collection_id, document, created_at)

-- Document structure
document COLUMN TYPE: documentdb_core.bson
document CONTENTS: BSON-encoded JSON with MongoDB types
```

Example:
```sql
SELECT documentdb_core.bson_to_json_string(document) 
FROM documentdb_data.documents_3;

-- Returns:
{ "_id" : { "$oid" : "..." }, "email" : "alice@example.com", "name" : "Alice" }
```

## Query Translation Examples

### Simple Select

**SQL:**
```sql
SELECT name, price FROM products WHERE price > 100;
```

**GraphQL:**
```graphql
{
  productsCollection(filter: {price: {gt: 100}}) {
    edges {
      node {
        name
        price
      }
    }
  }
}
```

Both execute similar PostgreSQL query internally:
```sql
SELECT name, price FROM products WHERE price > 100;
```

**MongoDB (via FerretDB):**
```javascript
db.products.find({price: {$gt: 100}}, {name: 1, price: 1})
```

Translates to:
```sql
SELECT document FROM documentdb_data.documents_N 
WHERE collection_id = X 
  AND documentdb_api.bson_match(document, '{"price": {"$gt": 100}}');
```

### Joins/Relationships

**SQL:**
```sql
SELECT u.name, COUNT(o.id) 
FROM users u 
LEFT JOIN orders o ON o.user_id = u.id 
GROUP BY u.id, u.name;
```

**GraphQL:**
```graphql
{
  usersCollection {
    edges {
      node {
        name
        ordersCollection {
          totalCount
        }
      }
    }
  }
}
```

pg_graphql detects foreign key `orders.user_id → users.id` and generates:
```sql
SELECT u.id, u.name, 
       (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as orders_count
FROM users u;
```

**MongoDB:** No native joins. Requires `$lookup` aggregation or multiple queries.

### Indexes

**SQL:**
```sql
CREATE INDEX idx_users_email ON users(email);
```

**GraphQL:** Inherits SQL indexes automatically.

**MongoDB:**
```javascript
db.users.createIndex({email: 1}, {unique: true})
```

Translates to:
```sql
CREATE UNIQUE INDEX ON documentdb_data.documents_N 
  ((document->>'email')) 
WHERE collection_id = X;
```

## Performance Characteristics

### SQL/GraphQL
- **Best for**: Complex queries, joins, aggregations
- **Indexes**: Standard PostgreSQL B-tree, GiST, GIN
- **Query planner**: Full PostgreSQL optimizer
- **ACID**: Native PostgreSQL transactions

### DocumentDB/MongoDB
- **Best for**: Flexible schema, nested documents, rapid prototyping
- **Indexes**: On JSONB/BSON fields using PostgreSQL GIN indexes
- **Query planner**: PostgreSQL optimizer with JSONB operations
- **ACID**: Native PostgreSQL transactions (better than MongoDB!)

### Caveats
- DocumentDB queries on nested fields are slower than indexed relational columns
- GraphQL auto-generation has overhead vs hand-written SQL
- FerretDB adds network hop vs native DocumentDB API

## Extension Loading

Extensions load at PostgreSQL startup via `docker-entrypoint-pg-graph-doc.sh`:

```bash
export POSTGRES_INITDB_ARGS="-c shared_preload_libraries=pg_documentdb_core,pg_documentdb,pg_cron ..."
```

Initialization SQL runs once:
```sql
-- /docker-entrypoint-initdb.d/01_extensions.sql
CREATE EXTENSION IF NOT EXISTS pg_graphql;
CREATE EXTENSION IF NOT EXISTS documentdb_core;
CREATE EXTENSION IF NOT EXISTS documentdb CASCADE;

-- Create wrapper function for PostgREST
CREATE OR REPLACE FUNCTION graphql(query text, variables jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE AS $$
  SELECT graphql.resolve(query, variables);
$$;
```

## Networking

All services in Docker Compose network:

```yaml
pg-graph-doc:5432
  ↓ (postgres://postgres:postgres@pg-graph-doc)
pg-rpc:3000
ferretdb:27017
```

External access:
- SQL: `localhost:5432`
- GraphQL: `http://localhost:3000/rpc/graphql`
- MongoDB: `mongodb://localhost:27017`

## Data Persistence

Single Docker volume:
```yaml
volumes:
  pgdata:/var/lib/postgresql/data
```

Contains:
- All PostgreSQL tables (public schema)
- GraphQL metadata (graphql schema)
- DocumentDB collections (documentdb_* schemas)
- FerretDB collections (via DocumentDB)

## Security Notes

**This is a development setup.** For production:

1. Change passwords (currently `postgres:postgres`)
2. Enable SSL/TLS
3. Restrict network access
4. Enable PostgREST JWT authentication
5. Enable FerretDB authentication
6. Use read-only roles for queries
7. Regular backups of `pgdata` volume

## Debugging

### View all schemas:
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d postgres -c "\dn+"
```

### View DocumentDB collections:
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d postgres \
  -c "SELECT * FROM documentdb_api_catalog.collections;"
```

### View GraphQL types:
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d postgres \
  -c "SELECT * FROM graphql.type;"
```

### Check PostgREST health:
```bash
curl http://localhost:3000/
```

### Check FerretDB status:
```bash
mongosh mongodb://postgres:postgres@localhost:27017/postgres --eval 'db.adminCommand({ping: 1})'
```

## Further Reading

- [PostgREST Documentation](https://postgrest.org/)
- [pg_graphql GitHub](https://github.com/supabase/pg_graphql)
- [FerretDB Documentation](https://docs.ferretdb.io/)
- [PostgreSQL Extensions Guide](https://www.postgresql.org/docs/current/extend.html)
