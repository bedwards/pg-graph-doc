# Deep Dive

## What We're Actually Building Here

Let's begin with a simple observation that might seem obvious but is worth stating plainly: databases are tools for storing and retrieving data. The way you ask for that data—the interface between you and the storage—need not be singular. This is the fundamental insight behind this project.

What we have built is one PostgreSQL database that answers to four different interfaces. Not four databases. Not four copies of your data. One database, four ways to query it. You can ask for data using SQL, the language of traditional relational databases. You can request it through GraphQL, the API query language favored by modern web developers. You can interact with it using MongoDB's document-oriented syntax. And you can access it through DocumentDB, a native document storage system built directly into PostgreSQL itself.

This might sound like magic, or worse, like a complicated abstraction that will surely break. It is neither. It is simply PostgreSQL doing what PostgreSQL does well—storing data reliably with ACID guarantees—while presenting different query interfaces on top of that same storage layer.

```
Your Data (PostgreSQL)
    ↓
    ├─→ SQL: Direct relational access (psql, pg drivers)
    ├─→ GraphQL: Auto-generated API from schema (PostgREST/pg_graphql)
    ├─→ DocumentDB: Native document store (PostgreSQL extension)
    └─→ MongoDB: Wire protocol compatible (FerretDB)
```

The key insight here, the thing that makes this work, is understanding that GraphQL and MongoDB are not separate databases sitting alongside PostgreSQL. They are query interfaces. Ways of speaking to PostgreSQL. Different languages for expressing the same fundamental need: give me this data, arranged this way.

## Understanding the Interfaces: A Comparison

Before we dive into how each interface works, let's establish what distinguishes them. This is not merely an academic exercise. Understanding these differences will help you choose the right tool for each job.

| Feature | SQL | GraphQL | DocumentDB | MongoDB |
|---------|-----|---------|------------|---------|
| **Query Language** | SQL | GraphQL | MongoDB syntax | MongoDB syntax |
| **Client** | psql, pg driver | HTTP/PostgREST | pg driver | mongosh, mongo driver |
| **Schema** | Fixed (DDL) | Auto-generated | Flexible | Flexible |
| **Relationships** | JOINs | Automatic navigation | Manual | Manual ($lookup) |
| **ACID** | ✅ Full | ✅ Full | ✅ Full | ✅ Full (via PG) |
| **Best For** | Complex queries | API building | Nested documents | MongoDB migration |

SQL expects you to define your schema upfront. You create tables with specific columns of specific types. This rigidity is a feature, not a bug. It enforces data integrity and enables powerful query optimization. GraphQL, by contrast, generates its schema automatically from your SQL tables. It reads your existing structure and creates an API on top of it. This is the best of both worlds: you get SQL's rigid schema guarantees with GraphQL's flexible querying.

DocumentDB and MongoDB both offer flexible schemas. You can insert a document with any shape you want. This freedom comes with tradeoffs—less strict validation, potentially slower queries on deeply nested data—but when you need it, you really need it. The difference between DocumentDB and MongoDB in this context is simple: DocumentDB is a native PostgreSQL extension that stores documents directly in PostgreSQL tables. MongoDB, or rather FerretDB's MongoDB-compatible interface, translates MongoDB wire protocol commands into DocumentDB operations. Same storage, different front door.

All four interfaces provide full ACID transactions. This bears repeating because it's the magic that makes this setup practical. Whether you query with SQL or insert documents through MongoDB's interface, you're getting PostgreSQL's battle-tested transaction guarantees. No eventual consistency. No distributed transaction complexity. Just reliable, immediate consistency.

## How Each Interface Actually Works

### SQL: The Foundation

SQL is the bedrock. This is PostgreSQL in its native form, accessed directly through the standard PostgreSQL protocol. When you write SQL queries, you're speaking directly to the database in its native tongue.

```bash
npm run sql "CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT, price DECIMAL)"
npm run sql "INSERT INTO products (name, price) VALUES ('Widget', 19.99)"
npm run sql "SELECT * FROM products WHERE price > 10"
```

These tables live in PostgreSQL's `public` schema. They're just tables. Normal PostgreSQL tables with all the features you'd expect: indexes, constraints, triggers, foreign keys. Nothing fancy. This is important because it means everything else we build on top has this solid foundation underneath.

### GraphQL: Auto-Generation from Structure

GraphQL is fundamentally different from SQL in what it optimizes for. SQL was designed for database administrators writing queries on a server. GraphQL was designed for client applications requesting exactly the data they need over a network. The two have different goals and therefore different designs.

Here's what makes GraphQL interesting in this context: it reads your PostgreSQL schema and automatically creates a GraphQL API. You don't write resolvers. You don't generate code. You create a SQL table with a primary key, and GraphQL sees it.

```bash
# Tables with PRIMARY KEYs become GraphQL types
npm run sql "CREATE TABLE items (id SERIAL PRIMARY KEY, name TEXT)"

# Query via GraphQL
npm run gql "{ itemsCollection { edges { node { name } } } }"

# Foreign keys become relationships automatically
npm run sql "CREATE TABLE comments (id SERIAL PRIMARY KEY, item_id INT REFERENCES items(id), text TEXT)"
npm run gql "{ itemsCollection { edges { node { name commentsCollection { edges { node { text } } } } } } }"
```

Notice what happened there. We created a foreign key relationship in SQL—a standard database constraint. GraphQL detected this relationship and automatically made it navigable in the GraphQL schema. When you query items, you can now traverse to their comments without writing a JOIN yourself. GraphQL does the joining for you based on the foreign key.

The storage here is identical to SQL. Same tables in the same `public` schema. GraphQL simply maintains its own metadata in a separate `graphql` schema that describes how to translate GraphQL queries into SQL queries.

There's one critical requirement: every table must have a primary key. Without it, GraphQL cannot expose the table. This isn't arbitrary. GraphQL's design requires globally unique identifiers for each object, and it uses your primary key for that purpose. It also needs stable ordering for cursor-based pagination. Primary keys provide both.

### DocumentDB: Native Document Storage

DocumentDB is a PostgreSQL extension that provides document storage capabilities directly within PostgreSQL. Unlike GraphQL, which is a different way to query existing relational tables, DocumentDB actually stores documents as documents. They're stored as BSON—Binary JSON—in special PostgreSQL tables.

```bash
npm run docdb inventory -i '{"sku":"WIDGET-001","stock":50,"specs":{"color":"blue"}}'
npm run docdb inventory -q '{"stock":{"$gt":10}}'
npm run docdb inventory -q '{}' -p '{"sku":1,"stock":1}'
```

The storage architecture here is different from both SQL and GraphQL. DocumentDB maintains a catalog of collections in `documentdb_api_catalog.collections`. Each collection gets its own table in the `documentdb_data` schema, named something like `documents_1`, `documents_2`, and so on. The actual documents are stored as BSON in a column of type `documentdb_core.bson`.

This means you can query these documents using SQL if you want:

```sql
SELECT documentdb_core.bson_to_json_string(document) 
FROM documentdb_data.documents_N
```

This is powerful. Your documents live as PostgreSQL rows. You can join them with your relational tables. You can index fields within the BSON documents. You get PostgreSQL's transaction guarantees and query planner working on your document data.

### MongoDB: Protocol Translation

FerretDB provides MongoDB wire protocol compatibility. This needs a bit of unpacking because it's easy to misunderstand what's happening here.

When you connect with `mongosh` or any MongoDB driver, you're speaking the MongoDB wire protocol—the binary protocol that MongoDB clients and servers use to communicate. FerretDB receives these MongoDB protocol messages, translates them into DocumentDB API calls, which then interact with PostgreSQL.

```bash
# Use mongosh
mongosh "$MONGODB_URL" --eval 'db.products.find()'

# Or npm script
npm run mongo -- products -i '{"name":"Laptop","price":999}'
npm run mongo -- products -q '{"price":{"$gt":500}}'

# Create indexes
npm run mongo -- users -c '{"email":1}' -o '{"unique":true}'
```

The storage is identical to DocumentDB because FerretDB uses DocumentDB under the hood. Same BSON columns, same catalog tables, same PostgreSQL storage. FerretDB is purely a translation layer. It speaks MongoDB on one side and DocumentDB on the other.

This has profound implications. It means you can use existing MongoDB tools, libraries, and knowledge while getting PostgreSQL's reliability. It also means you inherit FerretDB's limitations—not all MongoDB features are supported, particularly some advanced aggregation pipeline operations and features like GridFS or change streams.

## Data Flow: From Query to Storage

Understanding how data flows through these systems helps demystify what's happening. Let's trace a query through each interface.

When you write SQL, the path is direct. Your SQL query goes straight to PostgreSQL's query parser and planner. PostgreSQL executes it against tables in the `public` schema and returns rows. This is the baseline, the most direct path from query to data.

When you write a GraphQL query, it travels through more layers. First, your query hits PostgREST, an HTTP server that exposes PostgreSQL functions as REST endpoints. PostgREST receives your GraphQL query and calls the `graphql()` function in PostgreSQL. This function is created by the pg_graphql extension. The pg_graphql extension parses your GraphQL query, translates it into SQL, executes that SQL against your tables, and formats the results as GraphQL JSON. All of this happens inside PostgreSQL. PostgREST is just the HTTP wrapper that gets the query in and the results out.

DocumentDB queries follow a different path. When you use the DocumentDB API through the npm script, you're calling PostgreSQL functions from the documentdb_api schema. These functions know how to query BSON documents stored in the documentdb_data tables. They handle the translation between MongoDB query syntax and PostgreSQL's JSONB operators.

MongoDB queries via FerretDB add another translation layer. Your MongoDB driver sends a binary protocol message to FerretDB. FerretDB parses this message, figures out what MongoDB operation you're trying to perform, and translates it into DocumentDB API calls. Those API calls are just PostgreSQL function calls, which then operate on the BSON document storage.

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

## Choosing the Right Interface

The existence of multiple interfaces raises an obvious question: when should you use each one? The answer depends on what you're trying to accomplish and what constraints you're operating under.

### Use SQL When You Need Power and Precision

SQL is the right choice when you need to express complex queries involving multiple tables, aggregations, and precise filtering. It's the right choice when you know your schema upfront and that schema won't change frequently. It's the right choice when you need maximum performance from PostgreSQL's query planner.

```bash
npm run sql "
  SELECT u.name, COUNT(o.id), SUM(o.total)
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
  GROUP BY u.id, u.name
"
```

This kind of query—joining tables, aggregating data, grouping results—is what SQL was designed for. You could theoretically express this through GraphQL or MongoDB's aggregation pipeline, but SQL is more direct and will likely perform better.

### Use GraphQL When Building APIs

GraphQL shines when you're building an API that multiple clients will consume. Different clients need different data. A mobile app might need just names and thumbnails. A desktop app might need full records with all related data. Writing separate REST endpoints for each is tedious and leads to code bloat.

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

GraphQL lets each client request exactly the data it needs. The mobile app requests less, the desktop app requests more, but both hit the same endpoint. The GraphQL layer handles the translation to SQL and returns just what was requested.

The automatic relationship traversal is particularly powerful. Notice how we navigated from users to their orders without writing a JOIN. We defined the foreign key in SQL, and GraphQL made it navigable. This reduces the impedance mismatch between your database structure and your API structure.

### Use DocumentDB When You Need Schema Flexibility with SQL

DocumentDB is the right choice when you need to store data with varying structure but still want to query it with SQL. This comes up often in practice. You might have event logs where each event type has different properties. You might have user preferences where different users store different settings. You might be prototyping and your schema isn't stable yet.

```bash
npm run docdb events -i '{"type":"login","userId":123,"metadata":{"ip":"1.2.3.4"}}'
npm run docdb events -i '{"type":"purchase","userId":123,"items":[1,2],"total":99.99}'
```

Notice these documents have different shapes. The login event has metadata with an IP address. The purchase event has items and a total. Both can live in the same collection. You can insert them without declaring their structure upfront.

The advantage over MongoDB's interface here is that you can still use SQL to query these documents. You can join them with your relational tables. You can use PostgreSQL's full-text search on text fields within the documents. You get the flexibility of documents with the power of SQL.

### Use MongoDB Interface When Migrating or When Teams Prefer MongoDB

The MongoDB interface is primarily for two scenarios. First, you're migrating from MongoDB and want to keep using MongoDB tools, drivers, and query syntax during the transition. Second, your team knows MongoDB and prefers its query language, even for new projects.

```bash
npm run mongo -- orders -q '{"status":"shipped","total":{"$gt":100}}'
```

The query syntax here is MongoDB's. The dollar signs, the nested operators—this is the language MongoDB developers know. They can use `mongosh`, connect with MongoDB drivers from any language, and the code looks identical to code that would connect to real MongoDB.

The crucial difference, of course, is that underneath it's PostgreSQL. You get ACID transactions without configuring replica sets. You get strong consistency without eventual consistency complexity. You get PostgreSQL's backup tools and operational simplicity. But your application code can stay MongoDB-shaped if that's what your team prefers.

## A Practical Example: E-commerce

Let's see how these interfaces work together in a realistic scenario. Imagine you're building an e-commerce platform. You have some data that's highly structured—customers, orders, order items. This data has clear relationships and a stable schema. You also have some data that's loosely structured—product metadata, customer activity logs, product reviews.

Start with the structured data in SQL:

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
```

These tables have foreign keys defining clear relationships. A customer has many orders. An order has many order items. This structure is well-understood and unlikely to change. SQL and GraphQL both work excellently here.

Now add the flexible data as documents:

```bash
# Flexible data (DocumentDB/MongoDB)
npm run docdb product_metadata -i '{"productId":1,"reviews":[{"rating":5,"text":"Great!"}],"tags":["electronics","sale"]}'
npm run mongo -- customer_activity -i '{"customerId":1,"event":"page_view","url":"/products/123"}'
```

Product metadata varies by product type. Electronics have different attributes than clothing. Customer activity events have different structures depending on the event type. Storing these as documents lets you adapt the schema as needed without migrations.

Now query across both worlds. Use SQL for analytical queries:

```bash
# SQL: Complex analytics
npm run sql "
  SELECT c.name, COUNT(o.id) as order_count
  FROM customers c
  LEFT JOIN orders o ON o.customer_id = c.id
  GROUP BY c.id, c.name
  HAVING COUNT(o.id) > 5
"
```

Use GraphQL for your API:

```bash
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
```

Use MongoDB queries for event data:

```bash
# MongoDB: Flexible event logging
npm run mongo -- customer_activity -q '{"customerId":1,"event":"purchase"}' -s '{"timestamp":-1}' -l 20
```

Each interface serves its purpose. SQL for analytics that need joins and aggregations. GraphQL for the frontend API. MongoDB for flexible event logging. All hitting the same PostgreSQL database. All getting the same ACID guarantees.

## Looking Under the Hood with SQL

One of the beautiful things about this setup is that you can always drop down to SQL to see what's actually happening. The abstractions don't hide the storage; they just provide convenient interfaces to it.

Want to see what GraphQL created?

```bash
# View SQL tables
psql "$POSTGRES_URL" -c "\dt"

# View GraphQL metadata
psql "$POSTGRES_URL" -c "SELECT * FROM graphql.type WHERE name LIKE 'Customer%'"
```

Want to see how DocumentDB stores collections?

```bash
# View DocumentDB collections
psql "$POSTGRES_URL" -c "SELECT collection_name, collection_id FROM documentdb_api_catalog.collections"

# View MongoDB documents as JSON
psql "$POSTGRES_URL" -c "
  SELECT documentdb_core.bson_to_json_string(document) 
  FROM documentdb_data.documents_3 
  LIMIT 5
"
```

This transparency is crucial. You're not locked into any particular interface. You can always inspect the underlying PostgreSQL storage, run queries directly, add indexes, analyze query plans. The interfaces are conveniences, not black boxes.

## Key Constraints You Need to Understand

Every tool has constraints. Understanding them prevents frustration.

### GraphQL's Primary Key Requirement

GraphQL absolutely requires primary keys on every table. This is not negotiable. Without a primary key, pg_graphql cannot generate a GraphQL type for your table. It will simply ignore it.

```bash
# ✅ Works
npm run sql "CREATE TABLE items (id SERIAL PRIMARY KEY, name TEXT);"
npm run gql "{ itemsCollection { edges { node { name } } } }"

# ❌ Doesn't work
npm run sql "CREATE TABLE broken (name TEXT);"
# GraphQL won't see this table
```

Why this requirement? GraphQL's design assumes globally unique identifiers for every object. It uses these IDs for caching, for cursor-based pagination, and for mutations. Your primary key provides that unique identifier. Tables without primary keys violate GraphQL's assumptions.

The foreign key requirement for relationships is softer but equally important. If you want automatic relationship traversal in GraphQL, you need to define foreign keys in SQL. GraphQL can't detect relationships without them. It reads the foreign key constraints from PostgreSQL's metadata and generates the relationship fields in the schema.

### DocumentDB and MongoDB Storage Characteristics

Documents are stored as BSON in PostgreSQL tables. This has implications. Querying fields within documents is slower than querying indexed columns in relational tables. Not dramatically slower for small datasets, but the difference grows with scale.

Documents get full ACID transaction support. This is better than actual MongoDB's default write concern. When you insert a document, it's immediately visible to all other transactions, with no eventual consistency delay. This is a feature, not a bug.

Some MongoDB features are not supported by FerretDB. GridFS, the system for storing large files, is not implemented. Change streams, MongoDB's real-time update system, are not available. Some advanced aggregation pipeline operators don't work. Check FerretDB's compatibility documentation for the current status.

## Performance Characteristics

Let's be direct about performance. SQL is fastest for complex operations. This should not surprise anyone. GraphQL adds overhead—parsing the GraphQL query, translating to SQL, formatting JSON responses. This overhead is small, typically a few milliseconds, but it's there.

DocumentDB queries are fast but not as fast as indexed relational columns. Querying within JSONB or BSON documents requires PostgreSQL to parse the document structure. With proper indexes—GIN indexes on JSONB paths—performance is quite good. Without indexes, querying large document collections is slow.

MongoDB via FerretDB adds network translation overhead on top of DocumentDB's document query overhead. The MongoDB protocol needs to be parsed, translated to DocumentDB API calls, and results translated back to MongoDB protocol responses. This adds roughly five to ten milliseconds to each operation.

The rule of thumb is simple: for simple queries, all interfaces perform similarly. For complex joins and aggregations, SQL is significantly faster. For flexible schema situations where you can't define indexes upfront, documents are worth the performance tradeoff. For API serving where the query flexibility is valuable, GraphQL's overhead is acceptable.

## Migration Patterns That Actually Work

The real test of this setup is whether you can migrate between paradigms as your needs evolve. You can. Let's look at how.

### From Documents to Relations

Start with MongoDB-style documents when you're prototyping and the schema isn't stable:

```bash
# 1. Start with MongoDB
npm run mongo -- users -i '{"email":"alice@example.com","name":"Alice"}'
```

As your application matures and the schema stabilizes, migrate to relational tables:

```bash
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

This progression—documents to relations—matches how products actually evolve. Start flexible, solidify as you learn what your data really looks like.

### Hybrid Approach: Both at Once

You don't have to choose. Store structured data as relations and unstructured data as documents, in the same database:

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

This is the power of having everything in one database. You can join relational tables with document collections. You can enforce referential integrity between them. You can query both with a single SQL statement.

## Common Issues and Their Solutions

Some problems come up repeatedly. Let's address them directly.

### GraphQL Returns Empty Results

Almost always, this means you forgot the primary key. GraphQL requires it. Add one:

```bash
npm run sql "ALTER TABLE your_table ADD PRIMARY KEY (id);"
```

If that still doesn't work, check that the column you're using as a primary key doesn't have NULL values. Primary keys must be NOT NULL.

### Can't Find MongoDB Collection

Check which database you're using. FerretDB defaults to using the `postgres` database, which is configurable in `.env.example`. If you're connecting to a different database, your collections won't be there.

### DocumentDB Functions Not Found

The DocumentDB extensions need to be loaded at PostgreSQL startup. If you're getting function not found errors, the extensions probably didn't load. Check the PostgreSQL logs:

```bash
docker-compose logs pg-graph-doc
```

Look for errors during startup. The extensions should load via `shared_preload_libraries` in the PostgreSQL configuration.

## What This Setup Gives You

Let's return to the core value proposition. Why would you use this instead of separate databases for each paradigm?

First, you have one database to back up and manage. One backup schedule. One restore procedure. One set of credentials to manage. One connection pool to monitor. This operational simplicity matters more than most technical decisions.

Second, you get ACID transactions across all interfaces. When you insert a document via MongoDB and update a relational table via SQL in the same transaction, either both succeed or both fail. No distributed transaction protocols. No coordination. Just PostgreSQL's native transaction support.

Third, you get query flexibility without data duplication. The same data can be queried through whichever interface makes sense for the task at hand. Analytics? Use SQL. API? Use GraphQL. Flexible exploration? Use MongoDB syntax. Same data, different lenses.

Fourth, you can evolve your schema gradually. Start with documents, migrate to relations. Start with relations, add documents for new features. Mix both approaches in the same application. The database doesn't force you into one paradigm or the other.

Finally, you get the best tool for each job. SQL for complex analytics. GraphQL for frontend APIs. MongoDB syntax for flexible schemas. Not because you're locked into those choices, but because each interface excels at different tasks.

The magic, as stated at the beginning, is that it's all just PostgreSQL underneath. No synchronization between databases. No eventual consistency. No distributed transaction complexity. Just one reliable database with multiple query languages. That's the whole idea. That's what makes this work.
