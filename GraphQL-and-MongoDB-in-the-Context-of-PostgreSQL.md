# GraphQL and MongoDB in the Context of PostgreSQL

## The Big Picture

One PostgreSQL database. Four ways to query it:

```
Your Data (PostgreSQL)
    ↓
    ├─→ SQL: Direct relational access (psql, pg drivers)
    ├─→ GraphQL: Auto-generated API from schema (PostgREST/pg_graphql)
    ├─→ DocumentDB: Native document store (PostgreSQL extension)
    └─→ MongoDB: Wire protocol compatible (FerretDB)
```

**Key insight:** GraphQL and MongoDB aren't separate databases - they're **query interfaces** on the same PostgreSQL storage.

## Quick Comparison

| Feature | SQL | GraphQL | DocumentDB | MongoDB |
|---------|-----|---------|------------|---------|
| **Query Language** | SQL | GraphQL | MongoDB syntax | MongoDB syntax |
| **Client** | psql, pg driver | HTTP/PostgREST | pg driver | mongosh, mongo driver |
| **Schema** | Fixed (DDL) | Auto-generated | Flexible | Flexible |
| **Relationships** | JOINs | Automatic navigation | Manual | Manual ($lookup) |
| **ACID** | ✅ Full | ✅ Full | ✅ Full | ✅ Full (via PG) |
| **Best For** | Complex queries | API building | Nested documents | MongoDB migration |

## How Each Interface Works

### SQL (PostgreSQL Native)

Direct access to relational tables:

```bash
npm run sql "CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT, price DECIMAL)"
npm run sql "INSERT INTO products (name, price) VALUES ('Widget', 19.99)"
npm run sql "SELECT * FROM products WHERE price > 10"
```

**Storage:** Tables in `public` schema

### GraphQL (pg_graphql via PostgREST)

Auto-generated from your SQL schema. **Requires PRIMARY KEYs!**

```bash
# Tables with PRIMARY KEYs become GraphQL types
npm run sql "CREATE TABLE items (id SERIAL PRIMARY KEY, name TEXT)"

# Query via GraphQL
npm run gql "{ itemsCollection { edges { node { name } } } }"

# Foreign keys become relationships automatically
npm run sql "CREATE TABLE comments (id SERIAL PRIMARY KEY, item_id INT REFERENCES items(id), text TEXT)"
npm run gql "{ itemsCollection { edges { node { name commentsCollection { edges { node { text } } } } } } }"
```

**Storage:** Same tables as SQL, metadata in `graphql` schema

**Critical:** Every table needs `PRIMARY KEY` or GraphQL won't expose it.

### DocumentDB (PostgreSQL Extension)

Native document operations via SQL functions:

```bash
npm run docdb inventory -i '{"sku":"WIDGET-001","stock":50,"specs":{"color":"blue"}}'
npm run docdb inventory -q '{"stock":{"$gt":10}}'
npm run docdb inventory -q '{}' -p '{"sku":1,"stock":1}'
```

**Storage:** 
- Collections tracked in `documentdb_api_catalog.collections`
- Documents stored in `documentdb_data.documents_N` as BSON
- Queryable with SQL: `SELECT documentdb_core.bson_to_json_string(document) FROM documentdb_data.documents_N`

### MongoDB (FerretDB Wire Protocol)

Full MongoDB compatibility via protocol translation:

```bash
# Use mongosh
mongosh "$MONGODB_URL" --eval 'db.products.find()'

# Or npm script
npm run mongo -- products -i '{"name":"Laptop","price":999}'
npm run mongo -- products -q '{"price":{"$gt":500}}'

# Create indexes
npm run mongo -- users -c '{"email":1}' -o '{"unique":true}'
```

**Storage:** Uses DocumentDB extensions under the hood (same as above)

## Data Flow Diagram

```
┌─────────────────────┐
│   CREATE TABLE      │
│   users (...)       │
└──────────┬──────────┘
           │
           v
    ┌──────────────┐
    │  PostgreSQL  │
    │   Storage    │
    └──┬────────┬──┘
       │        │
       │        └─────────────────┐
       v                          v
┌─────────────┐          ┌──────────────┐
│ pg_graphql  │          │  DocumentDB  │
│ (reads DDL) │          │ (BSON store) │
└─────┬───────┘          └──────┬───────┘
      │                         │
      v                         v
┌─────────────┐          ┌──────────────┐
│  PostgREST  │          │  FerretDB    │
│ /rpc/graphql│          │  :27017      │
└─────────────┘          └──────────────┘
      │                         │
      v                         v
┌─────────────┐          ┌──────────────┐
│  GraphQL    │          │   MongoDB    │
│  Queries    │          │   Queries    │
└─────────────┘          └──────────────┘
```

## When to Use Each

### Use SQL when:
- Complex queries with JOINs
- Analytics and aggregations
- You know the schema upfront
- Maximum performance needed

```bash
npm run sql "
  SELECT u.name, COUNT(o.id), SUM(o.total)
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
  GROUP BY u.id, u.name
"
```

### Use GraphQL when:
- Building frontend APIs
- Different clients need different data shapes
- Fetching related data efficiently
- Want automatic API from schema

```bash
npm run gql "{
  usersCollection {
    edges {
      node {
        name
        ordersCollection {
          totalCount
          edges { node { total } }
        }
      }
    }
  }
}"
```

### Use DocumentDB when:
- Need document store in same database as relational data
- Want to query documents with SQL
- Flexible schemas for rapid prototyping
- Don't need MongoDB wire protocol

```bash
npm run docdb events -i '{"type":"login","userId":123,"metadata":{"ip":"1.2.3.4"}}'
npm run docdb events -i '{"type":"purchase","userId":123,"items":[1,2],"total":99.99}'
```

### Use MongoDB interface when:
- Migrating from MongoDB
- Team knows MongoDB query syntax
- Using existing MongoDB tools
- Need `mongosh` or MongoDB drivers

```bash
npm run mongo -- orders -q '{"status":"shipped","total":{"$gt":100}}'
```

## Practical Examples

### E-commerce Schema

```bash
# Core entities (SQL/GraphQL) - needs PRIMARY KEYs!
npm run sql "
  CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT
  );
  
  CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    status TEXT,
    total DECIMAL
  );
  
  CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    product_id INT,
    quantity INT
  );
"

# Flexible data (DocumentDB/MongoDB)
npm run docdb product_metadata -i '{"productId":1,"reviews":[{"rating":5,"text":"Great!"}],"tags":["electronics","sale"]}'
npm run mongo -- customer_activity -i '{"customerId":1,"event":"page_view","url":"/products/123"}'
```

### Querying Across Interfaces

```bash
# SQL: Complex analytics
npm run sql "
  SELECT c.name, COUNT(o.id) as order_count
  FROM customers c
  LEFT JOIN orders o ON o.customer_id = c.id
  GROUP BY c.id, c.name
  HAVING COUNT(o.id) > 5
"

# GraphQL: API for frontend
npm run gql "{
  customersCollection(filter: {email: {eq: \"alice@example.com\"}}) {
    edges {
      node {
        name
        ordersCollection(orderBy: {createdAt: DescNullsLast}, first: 10) {
          edges {
            node {
              total
              status
            }
          }
        }
      }
    }
  }
}"

# MongoDB: Flexible event logging
npm run mongo -- customer_activity -q '{"customerId":1,"event":"purchase"}' -s '{"timestamp":-1}' -l 20
```

### Examining Storage with psql

```bash
# View SQL tables
psql "$POSTGRES_URL" -c "\dt"

# View GraphQL metadata
psql "$POSTGRES_URL" -c "SELECT * FROM graphql.type WHERE name LIKE 'Customer%'"

# View DocumentDB collections
psql "$POSTGRES_URL" -c "SELECT collection_name, collection_id FROM documentdb_api_catalog.collections"

# View MongoDB documents as JSON
psql "$POSTGRES_URL" -c "
  SELECT documentdb_core.bson_to_json_string(document) 
  FROM documentdb_data.documents_3 
  LIMIT 5
"
```

## Key Constraints

### GraphQL
- **PRIMARY KEY required** on every table
- Tables without PRIMARY KEYs won't appear in schema
- Foreign keys automatically create relationships

```bash
# ✅ Works
npm run sql "CREATE TABLE items (id SERIAL PRIMARY KEY, name TEXT);"
npm run gql "{ itemsCollection { edges { node { name } } } }"

# ❌ Doesn't work
npm run sql "CREATE TABLE broken (name TEXT);"
# GraphQL won't see this table
```

### DocumentDB/MongoDB
- Documents stored as BSON
- Queries use MongoDB syntax
- Full ACID transactions (better than real MongoDB!)
- Some MongoDB features not yet supported (GridFS, change streams)

## Performance Notes

**SQL Queries:** Fastest for complex operations
**GraphQL:** Small overhead from schema introspection
**DocumentDB:** JSONB operations are fast but not as fast as indexed columns
**MongoDB via FerretDB:** Adds network translation overhead

**Rule of thumb:**
- Simple queries: All similar performance
- Complex joins: SQL fastest
- Flexible schemas: DocumentDB/MongoDB win
- API serving: GraphQL easiest

## Migration Patterns

### From MongoDB to SQL

```bash
# 1. Start with MongoDB
npm run mongo -- users -i '{"email":"alice@example.com","name":"Alice"}'

# 2. When schema stabilizes, migrate to SQL
npm run sql "
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT
  )
"

# 3. Copy data
psql "$POSTGRES_URL" -c "
  INSERT INTO users (email, name)
  SELECT 
    document->>'email',
    document->>'name'
  FROM documentdb_data.documents_N
  WHERE collection_id = X
"

# 4. Now query with SQL or GraphQL
npm run gql "{ usersCollection { edges { node { email name } } } }"
```

### Hybrid Approach

```bash
# Stable entities: SQL
npm run sql "CREATE TABLE products (id SERIAL PRIMARY KEY, sku TEXT, price DECIMAL)"

# Flexible metadata: MongoDB/DocumentDB
npm run mongo -- product_attributes -i '{"productId":1,"color":"blue","size":"M"}'
npm run mongo -- product_attributes -i '{"productId":2,"color":"red","dimensions":{"w":10,"h":20}}'

# Query together with SQL
psql "$POSTGRES_URL" -c "
  SELECT 
    p.sku,
    p.price,
    documentdb_core.bson_to_json_string(d.document) as attributes
  FROM products p
  JOIN documentdb_data.documents_N d 
    ON (d.document->>'productId')::int = p.id
"
```

## Troubleshooting

### GraphQL returns empty
**Cause:** Missing PRIMARY KEY
**Fix:** `npm run sql "ALTER TABLE your_table ADD PRIMARY KEY (id);"`

### Can't find MongoDB collection
**Cause:** Wrong database name
**Fix:** FerretDB uses `postgres` database (configurable in `.env.example`)

### DocumentDB function not found
**Cause:** Extensions not loaded
**Fix:** Restart PostgreSQL or check logs: `docker-compose logs pg-graph-doc`

## The Bottom Line

This setup gives you:
- ✅ One database to back up and manage
- ✅ ACID transactions across all interfaces
- ✅ Query flexibility without data duplication
- ✅ Gradual schema evolution (documents → relations)
- ✅ Best tool for each job (SQL for analytics, GraphQL for APIs, MongoDB for flexibility)

The magic is that it's all just PostgreSQL underneath. No synchronization, no eventual consistency, no distributed transactions - just one reliable database with multiple query languages.
