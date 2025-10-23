# GraphQL and MongoDB in the Context of PostgreSQL

## The Big Picture

You have **one PostgreSQL database** that you can talk to in three ways:

```
Your Data (PostgreSQL tables)
    ↓
    ├─→ SQL: Direct table access (postgres database)
    ├─→ GraphQL: Auto-generated API from tables (postgres database, via PostgREST)
    └─→ MongoDB: Document store (app database, stored as JSONB in PostgreSQL)
```

**Key insight**: GraphQL and MongoDB aren't databases—they're **query languages** sitting on top of PostgreSQL.

**Important architectural note**: This setup uses PostgREST to expose the pg_graphql extension's `graphql()` function via HTTP at `/rpc/graphql`. The GraphQL endpoint is at `http://localhost:3000/rpc/graphql`.

## GraphQL: Structured, Type-Safe, Relationship-Focused

### What It Is (First Principles)

SQL says: "Give me all columns from this table"
```sql
SELECT * FROM users;
```

GraphQL says: "Give me exactly these fields, and related data from other tables"
```graphql
{
  users {
    name
    email
    posts {
      title
    }
  }
}
```

**Core difference**: GraphQL lets clients ask for precisely what they need, including relationships, in one request.

### How pg_graphql Works (via PostgREST)

1. You create normal SQL tables **with PRIMARY KEYs** (critical!)
2. pg_graphql reads your schema and generates GraphQL types
3. PostgREST exposes the `graphql()` function as an HTTP endpoint
4. You query it via `http://localhost:3000/rpc/graphql`

**Example**:

```bash
# Create a relational schema - PRIMARY KEYS are REQUIRED
npm run sql "CREATE TABLE authors (id SERIAL PRIMARY KEY, name TEXT, bio TEXT)"
npm run sql "CREATE TABLE books (id SERIAL PRIMARY KEY, author_id INT REFERENCES authors(id), title TEXT, pages INT)"
npm run sql "INSERT INTO authors (name, bio) VALUES ('Ursula K. Le Guin', 'American author')"
npm run sql "INSERT INTO books (author_id, title, pages) VALUES (1, 'The Left Hand of Darkness', 304)"
```

Now GraphQL automatically exposes this:

```bash
# Get author with all their books in one query
npm run gql "{ authorsCollection { edges { node { name booksCollection { edges { node { title pages } } } } } } }"
```

**What just happened**: GraphQL saw the foreign key relationship (`author_id`) and automatically created a way to traverse it. You didn't write any API code.

### ⚠️ Critical Requirement: Primary Keys

**Tables MUST have a PRIMARY KEY for pg_graphql to work!**

```bash
# ✅ This works
npm run sql "CREATE TABLE foo (bar INT PRIMARY KEY);"
npm run sql "INSERT INTO foo (bar) VALUES (1)"
npm run gql 'query { fooCollection { edges { node { bar } } } }'
# Output: {"data":{"fooCollection":{"edges":[{"node":{"bar":1}}]}}}

# ❌ This won't work - no PRIMARY KEY
npm run sql "CREATE TABLE broken (bar INT);"
# GraphQL queries will fail or not expose this table
```

**Why?** pg_graphql needs primary keys to:
- Generate unique node IDs for GraphQL's global object identification
- Enable proper pagination with cursors
- Support mutations (updates/deletes need to identify records)

**Fix for existing tables:**
```bash
npm run sql "ALTER TABLE your_table ADD PRIMARY KEY (id)"
```

### When GraphQL Shines

**Use GraphQL when**:
- Building a frontend that needs different views of the same data (mobile needs less than desktop)
- You have lots of relationships between entities
- Multiple clients need different subsets of data
- You want to avoid N+1 queries (GraphQL batches efficiently)

**Example scenario**: A blog platform
```bash
# Frontend needs: posts + author names + comment counts
# With REST: 3 endpoints (/posts, /users, /comments/count)
# With GraphQL: 1 query

npm run gql "{ postsCollection { edges { node { title authorsCollection { edges { node { name } } } commentsCollection { totalCount } } } } }"
```

### GraphQL Database Design

**Design principle**: Use normal relational tables with PRIMARY KEYS. GraphQL works best with:

1. **PRIMARY KEYS** - Absolutely required for every table
2. **Clear foreign keys** - GraphQL follows these automatically
3. **Normalized data** - Separate tables for separate concepts
4. **Simple types** - TEXT, INT, BOOLEAN (GraphQL types map cleanly)

```bash
# Good for GraphQL - note the PRIMARY KEYs
npm run sql "CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)"
npm run sql "CREATE TABLE posts (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), title TEXT)"

# Now both directions work:
# User → their posts
# Post → its author
```

**Contrast with SQL**: In SQL, you'd JOIN manually. In GraphQL, relationships are first-class—you navigate them like object properties.

## MongoDB/FerretDB: Document-Oriented, Flexible Schema

### What It Is (First Principles)

SQL says: "Every row must have the same columns"
```sql
users: id | name | email
```

MongoDB says: "Store flexible JSON documents that can differ"
```javascript
{ name: "Alice", email: "alice@example.com" }
{ name: "Bob", age: 30, tags: ["admin", "user"] }  // different fields!
```

**Core difference**: MongoDB stores **documents** (JSON), not rows. Each document can have different fields.

### How FerretDB Works

FerretDB translates MongoDB commands into PostgreSQL:

```
Your MongoDB query → FerretDB → PostgreSQL JSONB operations
```

MongoDB stores each collection as a PostgreSQL table with a JSONB column holding the document.

**Important**: FerretDB uses the `app` database, while SQL/GraphQL use the `postgres` database. They share the same PostgreSQL instance but are logically separated.

### Example: Flexible Product Catalog

```bash
# Products with different attributes
npm run mongo products '{"name": "Laptop", "specs": {"ram": "16GB", "cpu": "M2"}, "price": 1299}'
npm run mongo products '{"name": "Book", "author": "Someone", "pages": 400, "price": 15}'
```

**What just happened**: Two completely different product types in one "collection" (table). Try doing that with strict SQL columns!

### When MongoDB Shines

**Use MongoDB when**:
- Schema changes frequently (startup iterating fast)
- Data is naturally nested/hierarchical
- Different items need different fields
- You're prototyping and don't know the final structure

**Example scenario**: Activity logging
```bash
# Different event types with different data
npm run mongo events '{"type": "login", "userId": 123, "ip": "1.2.3.4"}'
npm run mongo events '{"type": "purchase", "userId": 123, "items": [{"id": 1, "qty": 2}], "total": 50}'
npm run mongo events '{"type": "pageview", "url": "/products", "referrer": "google"}'
```

All in one collection, queryable:
```bash
npm run mongo events '{"type": "purchase"}' '{"total": 1, "userId": 1}'
```

### MongoDB Database Design

**Design principle**: Embed related data together. Opposite of SQL normalization.

```bash
# MongoDB style: Nest related data
npm run mongo users '{
  "name": "Alice",
  "profile": {
    "bio": "Developer",
    "avatar": "url"
  },
  "preferences": {
    "theme": "dark",
    "notifications": true
  }
}'

# vs SQL style: Separate tables (with PRIMARY KEYs)
npm run sql "CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)"
npm run sql "CREATE TABLE profiles (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), bio TEXT, avatar TEXT)"
npm run sql "CREATE TABLE preferences (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), theme TEXT, notifications BOOL)"
```

**MongoDB wins when**: You always fetch this data together.
**SQL wins when**: You need to query `preferences.theme` across all users efficiently.

## When to Use Each: Decision Tree

### Use SQL when:
- Complex queries across multiple tables
- Aggregations, reports, analytics
- Strong consistency requirements
- You know the exact schema upfront

```bash
# Complex analytics query
npm run sql "
  SELECT u.name, COUNT(p.id) as post_count, AVG(c.upvotes) as avg_upvotes
  FROM users u
  LEFT JOIN posts p ON p.user_id = u.id
  LEFT JOIN comments c ON c.post_id = p.id
  GROUP BY u.id, u.name
  HAVING COUNT(p.id) > 5
"
```

### Use GraphQL when:
- Building a frontend (web/mobile app)
- Need to fetch related data efficiently
- Different clients need different data shapes
- Want automatic API from your database

```bash
# Frontend dashboard: user + their stats + recent activity
npm run gql "{
  usersCollection(first: 10) {
    edges {
      node {
        name
        postsCollection { totalCount }
        commentsCollection(orderBy: {createdAt: DescNullsLast}, first: 5) {
          edges { node { text createdAt } }
        }
      }
    }
  }
}"
```

**Remember**: All tables queried via GraphQL must have PRIMARY KEYs!

### Use MongoDB when:
- Rapid prototyping (schema unknown)
- Heterogeneous data (products, events, logs)
- Deeply nested structures
- Schema varies by item

```bash
# Storing configuration that varies by user type
npm run mongo configs '{
  "userId": "admin-001",
  "type": "admin",
  "permissions": ["read", "write", "delete"],
  "dashboard": {
    "widgets": ["users", "stats", "logs"],
    "theme": "dark"
  }
}'

npm run mongo configs '{
  "userId": "user-042",
  "type": "basic",
  "preferences": {
    "newsletter": true
  }
}'
```

## Designing a Hybrid Database

### Strategy 1: Domain Separation (Recommended)

**Use SQL/GraphQL for**: Core business entities with relationships (with PRIMARY KEYs!)
**Use MongoDB for**: Flexible/unstructured data

```bash
# Relational core (users, orders, inventory) - note PRIMARY KEYs
npm run sql "CREATE TABLE customers (id SERIAL PRIMARY KEY, name TEXT, email TEXT)"
npm run sql "CREATE TABLE orders (id SERIAL PRIMARY KEY, customer_id INT REFERENCES customers(id), total DECIMAL)"

# Flexible metadata (in FerretDB's 'app' database)
npm run mongo customer_metadata '{"customerId": 1, "preferences": {...}, "tags": [...], "notes": "..."}'
npm run mongo order_events '{"orderId": 1, "type": "shipped", "carrier": "USPS", "tracking": "..."}'
```

**Pattern**: Use SQL for relationships and queries, MongoDB for flexible attributes that change often.

**Note**: Since FerretDB uses a different database (`app`), you'll reference records by ID rather than using foreign keys across the boundary.

### Strategy 2: Read/Write Separation

**SQL for writes**: Strict validation, consistency
**GraphQL for reads**: Efficient data fetching

```bash
# Write with SQL (validation) - PRIMARY KEY required
npm run sql "CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT, price DECIMAL, category_id INT)"
npm run sql "INSERT INTO products (name, price, category_id) VALUES ('Widget', 29.99, 5)"

# Read with GraphQL (relationships)
npm run gql "{ productsCollection { edges { node { name price } } } }"
```

### Strategy 3: Shared Data with JSONB

**PostgreSQL JSONB bridges both worlds**: Queryable JSON in relational tables.

```bash
# SQL table with JSONB column - still needs PRIMARY KEY for GraphQL
npm run sql "CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT, price DECIMAL, metadata JSONB)"
npm run sql "INSERT INTO products (name, price, metadata) VALUES ('Laptop', 999, '{\"ram\": \"16GB\", \"ports\": [\"USB-C\", \"HDMI\"]}')"

# Query JSONB with SQL
npm run sql "SELECT name, metadata->>'ram' as ram FROM products WHERE metadata @> '{\"ram\": \"16GB\"}'"

# Access via GraphQL (JSONB becomes JSON field)
npm run gql "{ productsCollection { edges { node { name metadata } } } }"
```

**This is the sweet spot**: Relational structure + document flexibility, no duplication, all in the `postgres` database accessible via all three interfaces.

## Practical Patterns for Shared Data

### Pattern: Reference by ID

**Don't duplicate, reference across database boundaries**:

```bash
# SQL: Core entity (postgres database)
npm run sql "CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)"
npm run sql "INSERT INTO users (id, name) VALUES (1, 'Alice')"

# MongoDB: Reference the SQL entity (app database)
npm run mongo activity_logs '{"userId": 1, "action": "login", "timestamp": "2024-01-15T10:30:00Z"}'

# Query together when needed
npm run sql "SELECT u.name FROM users u WHERE id = 1"
npm run mongo activity_logs '{"userId": 1}'
```

### Pattern: GraphQL with JSONB

**For complex queries that need both structure and flexibility**:

```bash
# Create table with PRIMARY KEY and JSONB
npm run sql "CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  event_type TEXT,
  user_id INT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
)"

npm run sql "INSERT INTO events (event_type, user_id, metadata) VALUES 
  ('login', 1, '{\"ip\": \"1.2.3.4\"}'),
  ('purchase', 1, '{\"items\": [1, 2], \"total\": 99.99}')"

# Query via GraphQL - gets both structured and flexible data
npm run gql "{ eventsCollection { edges { node { eventType userId metadata } } } }"
```

### Pattern: Event Sourcing

**SQL for current state, MongoDB for event history**:

```bash
# Current state in SQL (postgres database, needs PRIMARY KEY)
npm run sql "CREATE TABLE orders (id SERIAL PRIMARY KEY, status TEXT, total DECIMAL)"
npm run sql "UPDATE orders SET status = 'shipped' WHERE id = 1"

# Event log in MongoDB (app database)
npm run mongo order_events '{"orderId": 1, "event": "shipped", "timestamp": "2024-01-15T14:00:00Z", "details": {...}}'
```

## Practical Example: E-commerce App

Here's how you'd design a real app:

```bash
# Core relational data (SQL + GraphQL) - in postgres database
# CRITICAL: All tables need PRIMARY KEYs for GraphQL!
npm run sql "CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT, price DECIMAL, stock INT)"
npm run sql "CREATE TABLE customers (id SERIAL PRIMARY KEY, email TEXT UNIQUE, name TEXT)"
npm run sql "CREATE TABLE orders (id SERIAL PRIMARY KEY, customer_id INT REFERENCES customers(id), status TEXT, total DECIMAL)"
npm run sql "CREATE TABLE order_items (id SERIAL PRIMARY KEY, order_id INT REFERENCES orders(id), product_id INT REFERENCES products(id), quantity INT)"

# Flexible data (MongoDB) - in app database
# - Product reviews (variable fields)
npm run mongo reviews '{"productId": 1, "rating": 5, "text": "Great!", "images": ["url1", "url2"], "verified": true}'

# - Customer activity (different event types)
npm run mongo customer_events '{"customerId": 1, "type": "viewed_product", "productId": 5, "timestamp": "..."}'
npm run mongo customer_events '{"customerId": 1, "type": "added_to_cart", "productId": 5, "quantity": 2}'

# - Search history
npm run mongo searches '{"customerId": 1, "query": "blue widgets", "results": [1, 3, 7], "timestamp": "..."}'

# Frontend queries (GraphQL) - queries postgres database
npm run gql "{
  customersCollection(filter: {email: {eq: \"alice@example.com\"}}) {
    edges {
      node {
        name
        ordersCollection {
          edges {
            node {
              total
              status
              orderItemsCollection {
                edges {
                  node {
                    quantity
                    productsCollection {
                      edges {
                        node {
                          name
                          price
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}"

# Analytics (SQL) - queries postgres database
npm run sql "
  SELECT p.name, COUNT(oi.product_id) as times_ordered, SUM(oi.quantity) as total_quantity
  FROM products p
  LEFT JOIN order_items oi ON oi.product_id = p.id
  GROUP BY p.id, p.name
  ORDER BY times_ordered DESC
  LIMIT 10
"

# Customer insights (MongoDB aggregation) - queries app database
npm run mongo customer_events '[{"$match": {"type": "viewed_product"}}, {"$group": {"_id": "$productId", "views": {"$sum": 1}}}, {"$sort": {"views": -1}}, {"$limit": 10}]'
```

## Key Takeaways

1. **SQL**: Strong structure, complex queries, relationships
2. **GraphQL**: Efficient data fetching for clients, automatic from SQL tables **that have PRIMARY KEYs**
3. **MongoDB**: Flexible schema, nested data, rapid iteration

4. **PRIMARY KEYS are mandatory** for GraphQL to work with your tables
5. **Share data by**: Foreign keys (SQL/GraphQL in `postgres` db) or IDs (MongoDB in `app` db references SQL)
6. **Avoid duplication by**: Using JSONB in PostgreSQL when you need both worlds in `postgres` db
7. **Pragmatic rule**: Use SQL as foundation, GraphQL for API (don't forget PRIMARY KEYs!), MongoDB for truly flexible data

**The beauty of this setup**: You're not locked in. Start with SQL (add PRIMARY KEYs!), add GraphQL when you build a frontend (via PostgREST), use MongoDB for the messy parts that don't fit tables. All in one PostgreSQL instance, minimal synchronization needed.

## Troubleshooting

### "Table not appearing in GraphQL schema"

**Most common cause**: Missing PRIMARY KEY. Check:
```bash
npm run sql "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
npm run sql "SELECT constraint_name, table_name FROM information_schema.table_constraints WHERE constraint_type = 'PRIMARY KEY' AND table_schema = 'public'"
```

Add PRIMARY KEY if missing:
```bash
npm run sql "ALTER TABLE your_table ADD PRIMARY KEY (id)"
```

### "GraphQL returns empty data"

Verify the table structure and restart PostgREST if needed:
```bash
docker-compose restart pg-rpc
```

### Database confusion

Remember:
- **postgres** database: Used by SQL and GraphQL
- **app** database: Used by MongoDB/FerretDB
- Both are in the same PostgreSQL instance but logically separate
