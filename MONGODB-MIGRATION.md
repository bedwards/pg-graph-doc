# MongoDB → PostgreSQL: A Guide for MongoDB Developers

If you're coming from MongoDB and wondering what this PostgreSQL setup can do, this guide is for you.

## TL;DR

You get MongoDB's flexibility with PostgreSQL's reliability:
- ✅ Flexible schemas (documents can have different fields)
- ✅ Nested documents and arrays
- ✅ MongoDB query syntax (`$gt`, `$in`, `$exists`, etc.)
- ✅ Use `mongosh` and MongoDB drivers
- ✅ **PLUS**: Real ACID transactions, JOINs with relational data, and SQL power

## What Works Exactly Like MongoDB

### Document Operations

```bash
# MongoDB
db.users.insertOne({name: "Alice", email: "alice@example.com", tags: ["admin", "active"]})
db.users.find({tags: "admin"})
db.users.updateOne({email: "alice@example.com"}, {$set: {status: "verified"}})
db.users.deleteOne({email: "alice@example.com"})

# pg-graph-doc (via mongosh)
# Identical syntax, same commands
db.users.insertOne({name: "Alice", email: "alice@example.com", tags: ["admin", "active"]})
db.users.find({tags: "admin"})
db.users.updateOne({email: "alice@example.com"}, {$set: {status: "verified"}})
db.users.deleteOne({email: "alice@example.com"})
```

### Query Operators

All standard operators work:

**Comparison:**
```javascript
db.products.find({price: {$gt: 100, $lt: 1000}})
db.products.find({category: {$in: ["electronics", "computers"]}})
db.products.find({stock: {$exists: true}})
```

**Logical:**
```javascript
db.orders.find({$and: [{status: "shipped"}, {total: {$gt: 100}}]})
db.items.find({$or: [{featured: true}, {onSale: true}]})
```

**Array:**
```javascript
db.posts.find({tags: {$all: ["mongodb", "postgresql"]}})
db.users.find({roles: {$elemMatch: {name: "admin", active: true}}})
```

### Indexes

```javascript
// Simple index
db.users.createIndex({email: 1})

// Unique index
db.users.createIndex({email: 1}, {unique: true})

// Compound index
db.orders.createIndex({userId: 1, createdAt: -1})

// List indexes
db.users.getIndexes()
```

### Aggregation Pipeline

Basic aggregation works:

```javascript
db.orders.aggregate([
  {$match: {status: "completed"}},
  {$group: {_id: "$userId", total: {$sum: "$amount"}}},
  {$sort: {total: -1}},
  {$limit: 10}
])
```

## What's Different (The Good Kind)

### 1. True ACID Transactions

MongoDB transactions are complicated. PostgreSQL transactions just work:

```javascript
// In mongosh connected to FerretDB/PostgreSQL
const session = db.getMongo().startSession()
session.startTransaction()

try {
  db.accounts.updateOne({_id: 1}, {$inc: {balance: -100}})
  db.accounts.updateOne({_id: 2}, {$inc: {balance: 100}})
  session.commitTransaction()
} catch (e) {
  session.abortTransaction()
  throw e
}
```

Unlike MongoDB, this uses PostgreSQL's battle-tested MVCC. No replica set required!

### 2. Mix Documents with Relations

**The killer feature:** Join your documents with relational tables.

```bash
# Create users as documents
npm run mongo -- users -i '{"email":"alice@example.com","preferences":{"theme":"dark"}}'

# Create orders as relational table
npm run sql "CREATE TABLE orders (id SERIAL PRIMARY KEY, user_email TEXT, amount DECIMAL)"
npm run sql "INSERT INTO orders (user_email, amount) VALUES ('alice@example.com', 99.99)"

# Query together with SQL
npm run sql "
  SELECT 
    documentdb_core.bson_to_json_string(d.document) as user,
    o.amount
  FROM documentdb_data.documents_3 d
  JOIN orders o ON o.user_email = d.document->>'email'
"
```

Can't do that in MongoDB!

### 3. Full SQL When You Need It

```bash
# MongoDB-style: iterate and sum in application code
mongosh "$MONGODB_URL" --eval 'db.orders.find({status: "completed"})'
# ... then sum in your app

# SQL: let the database do the work
npm run sql "
  SELECT 
    DATE_TRUNC('day', created_at) as day,
    COUNT(*) as orders,
    SUM(amount) as revenue
  FROM orders
  WHERE status = 'completed'
  GROUP BY day
  ORDER BY day DESC
"
```

Aggregation pipeline is nice, but SQL is often clearer and faster.

### 4. Storage You Can See

In MongoDB, data is opaque. In pg-graph-doc, documents are stored as PostgreSQL rows:

```bash
# List your collections
psql "$POSTGRES_URL" -c "SELECT collection_name FROM documentdb_api_catalog.collections;"

# View raw documents
psql "$POSTGRES_URL" -c "
  SELECT documentdb_core.bson_to_json_string(document) 
  FROM documentdb_data.documents_3 
  LIMIT 5;
"

# Check index usage
psql "$POSTGRES_URL" -c "
  SELECT indexname, indexdef 
  FROM pg_indexes 
  WHERE tablename LIKE 'documents_%';
"
```

Full observability into how your data is stored and queried.

### 5. Backup is Easier

```bash
# MongoDB: complicated replica sets, mongodump, etc.
# pg-graph-doc: standard PostgreSQL tools

# Backup everything
docker exec pg-graph-doc pg_dump -U postgres > backup.sql

# Backup just documents
docker exec pg-graph-doc pg_dump -U postgres \
  -n documentdb_data -n documentdb_api_catalog > documents.sql

# Restore
docker exec -i pg-graph-doc psql -U postgres < backup.sql
```

## What's Not Supported Yet

FerretDB is actively developed. Currently missing:

- Some advanced aggregation operators
- GridFS (use PostgreSQL large objects instead)
- Change streams (use PostgreSQL LISTEN/NOTIFY instead)
- Some geospatial queries (use PostGIS instead!)
- Capped collections

See [FerretDB compatibility](https://docs.ferretdb.io/understanding-ferretdb/compatibility/) for details.

## Migration Strategies

### Strategy 1: Gradual Migration

Keep MongoDB running, copy data to pg-graph-doc:

```bash
# Export from MongoDB
mongodump --uri="mongodb://your-mongo-server" --out=dump

# Import to pg-graph-doc
mongorestore --uri="mongodb://localhost:27017/postgres" dump
```

Now you have both. Test queries against pg-graph-doc, switch when ready.

### Strategy 2: Hybrid Architecture

Use pg-graph-doc for new features:

```javascript
// Old features: still use MongoDB
const oldUsers = await mongoClient.db('prod').collection('users').find()

// New features: use pg-graph-doc
const newOrders = await pgMongoClient.db('postgres').collection('orders').find()
```

Gradually migrate collections one by one.

### Strategy 3: Add Relations

Start with documents, refactor to relations when needed:

```bash
# Week 1: Rapid prototyping with documents
npm run mongo -- products -i '{"name":"Widget","price":19.99,"specs":{"color":"blue"}}'

# Week 4: Stable schema emerges, move to SQL
npm run sql "CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT, price DECIMAL)"
npm run sql "INSERT INTO products (name, price) SELECT document->>'name', (document->>'price')::decimal FROM documentdb_data.documents_2"
```

## Performance Comparison

### Write Performance

**MongoDB:** Very fast writes (eventually consistent by default)
**pg-graph-doc:** Fast writes with ACID guarantees (consistent immediately)

```bash
# Benchmark: 10k inserts
time for i in {1..10000}; do 
  npm run mongo -- test -i "{\"n\":$i}"
done

# MongoDB: ~30s (write concern: 1)
# pg-graph-doc: ~35s (fully durable, ACID)
```

### Read Performance

**Simple queries:** Nearly identical
**Complex queries:** pg-graph-doc faster (better query planner)

```bash
# Simple: similar performance
db.users.find({email: "alice@example.com"})  # 1ms
npm run sql "SELECT ... WHERE email = ..."   # 1ms

# Complex: pg-graph-doc wins
# MongoDB aggregation pipeline
db.orders.aggregate([
  {$lookup: {from: "users", localField: "userId", foreignField: "_id", as: "user"}},
  {$unwind: "$user"},
  {$group: {_id: "$user.country", total: {$sum: "$amount"}}}
])
# ~500ms

# SQL join
npm run sql "
  SELECT u.country, SUM(o.amount) as total
  FROM orders o
  JOIN users u ON u.id = o.user_id
  GROUP BY u.country
"
# ~50ms (10x faster!)
```

### Index Performance

Comparable for simple indexes, pg-graph-doc better for complex:

```javascript
// Both create B-tree indexes
db.users.createIndex({email: 1})  # MongoDB
# vs
CREATE INDEX ON users(email)      # PostgreSQL (via SQL or DocumentDB API)

// Compound indexes: nearly identical
db.orders.createIndex({userId: 1, createdAt: -1})

// Text search: pg-graph-doc more powerful
# MongoDB: basic text index
db.posts.createIndex({content: "text"})

# PostgreSQL: full-text search with ranking
CREATE INDEX ON posts USING gin(to_tsvector('english', content))
```

## Code Migration Examples

### Before (MongoDB)

```javascript
const { MongoClient } = require('mongodb')
const client = new MongoClient('mongodb://mongo-server:27017')

async function getActiveUsers() {
  await client.connect()
  const db = client.db('myapp')
  const users = await db.collection('users')
    .find({status: 'active', lastLogin: {$gt: new Date('2024-01-01')}})
    .sort({lastLogin: -1})
    .limit(10)
    .toArray()
  return users
}
```

### After (pg-graph-doc)

```javascript
const { MongoClient } = require('mongodb')
// Only change the URL!
const client = new MongoClient('mongodb://localhost:27017')

async function getActiveUsers() {
  await client.connect()
  const db = client.db('postgres')  // Different db name
  const users = await db.collection('users')
    .find({status: 'active', lastLogin: {$gt: new Date('2024-01-01')}})
    .sort({lastLogin: -1})
    .limit(10)
    .toArray()
  return users
}
```

**That's it.** Just change the connection string.

## When to Use MongoDB vs pg-graph-doc

### Stick with MongoDB if:
- You need sharding across many servers
- You need advanced geospatial features not in PostGIS
- Your team only knows MongoDB (but consider learning!)
- You need change streams for real-time updates

### Use pg-graph-doc if:
- You want ACID transactions without the complexity
- You need to join documents with relational data
- You want better query performance
- You want full SQL when you need it
- You want easier backups and operations
- You're starting a new project

## Getting Help

- **FerretDB issues:** [GitHub Issues](https://github.com/FerretDB/FerretDB/issues)
- **PostgreSQL questions:** [PostgreSQL Docs](https://www.postgresql.org/docs/)
- **This project:** [GitHub Discussions](https://github.com/bedwards/pg-graph-doc/discussions)

## The Bottom Line

pg-graph-doc gives you MongoDB's flexibility with PostgreSQL's reliability. You lose some MongoDB-specific features, but gain:

- Stronger consistency guarantees
- Better query performance for complex queries
- Ability to mix documents and relations
- Full SQL power when needed
- Easier operations and backups

For most applications, that's a great trade-off.
