# pg-graph-doc

**One PostgreSQL database. Four query languages. Zero data duplication.**

Query the same data with SQL, GraphQL, MongoDB, and DocumentDB APIs - all backed by a single PostgreSQL instance. Because sometimes you want ACID guarantees *and* schemaless flexibility.

- 🐳 **Docker Hub:** [bedwards/pg-graph-doc](https://hub.docker.com/r/bedwards/pg-graph-doc)
- 💻 **GitHub:** [bedwards/pg-graph-doc](https://github.com/bedwards/pg-graph-doc)

📚 **Deep dive:** [GraphQL and MongoDB in the Context of PostgreSQL](GraphQL-and-MongoDB-in-the-Context-of-PostgreSQL.md)

## 🔥 What Makes This Cool

This isn't a toy. It's a PostgreSQL 16 setup with:
- **pg_graphql** - Auto-generated GraphQL API from your schema
- **DocumentDB extensions** - Native MongoDB-compatible document store
- **FerretDB** - Full MongoDB wire protocol (use `mongosh`, drivers, etc.)
- **PostgREST** - REST/GraphQL HTTP layer

Same data, viewed through different lenses. Want to JOIN your documents with relational tables? Go ahead. Need GraphQL for your frontend but SQL for analytics? Done. Store unstructured logs in documents but enforce constraints on user data? Easy.

## 🏷️ Docker Tags

- `:17` - PostgreSQL 17 (latest, but FerretDB has compatibility warnings)
- `:16` - **PostgreSQL 16 (recommended)** - Rock solid with FerretDB

```bash
docker pull bedwards/pg-graph-doc:16
```

## 🚀 Quick Start

```bash
npm install
docker-compose up -d
```

That's it. You now have:
- PostgreSQL on `localhost:5432`
- GraphQL endpoint at `http://localhost:3000/rpc/graphql`
- MongoDB protocol on `localhost:27017`

## 💪 Examples: All Four Interfaces

Let's create and query data using all four methods. Each uses different tables so you can run them all.

### 1. psql - Raw SQL Power

```bash
# Connect
PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d postgres

# Or source env
source .env.example
psql "$POSTGRES_URL"
```

```sql
-- Create and query
CREATE TABLE employees (id SERIAL PRIMARY KEY, name TEXT, dept TEXT, salary INT);
INSERT INTO employees VALUES (1, 'Alice', 'Engineering', 120000), (2, 'Bob', 'Sales', 80000);
SELECT * FROM employees WHERE salary > 100000;
```

### 2. npm run sql - SQL via Node

```bash
npm run sql "CREATE TABLE customers (id SERIAL PRIMARY KEY, email TEXT UNIQUE, tier TEXT)"
npm run sql "INSERT INTO customers (email, tier) VALUES ('alice@example.com', 'premium')"
npm run sql "SELECT * FROM customers"
```

### 3. npm run gql - GraphQL (Auto-generated from Schema)

**Remember:** Tables need PRIMARY KEYs for GraphQL!

```bash
# GraphQL automatically sees your SQL tables
npm run gql "{ customersCollection { edges { node { id email tier } } } }"

# Mutations work too
npm run gql "mutation { insertIntocustomersCollection(objects: [{email: \"bob@example.com\", tier: \"free\"}]) { records { id } } }"

# Relationships are automatic (if you have foreign keys)
npm run gql "{ customersCollection { edges { node { email ordersCollection { totalCount } } } } }"
```

### 4. npm run sql - Inspect GraphQL-Created Metadata

```bash
# See what GraphQL generated
npm run sql "SELECT table_name FROM information_schema.tables WHERE table_schema = 'graphql'"
npm run sql "SELECT * FROM graphql.type"
```

### 5. npm run docdb - DocumentDB API (MongoDB via PostgreSQL Extension)

```bash
npm run docdb inventory -i '{"sku":"WIDGET-001","name":"Blue Widget","stock":50,"specs":{"color":"blue","weight":"1.2kg"}}'
npm run docdb inventory -q '{"stock":{"$gt":10}}'
npm run docdb inventory -q '{}' -p '{"name":1,"stock":1}'
```

### 6. psql - Peek Inside DocumentDB Storage

```bash
source .env.example
psql "$POSTGRES_URL" -c "SELECT collection_name, collection_id FROM documentdb_api_catalog.collections;"
psql "$POSTGRES_URL" -c "SELECT documentdb_core.bson_to_json_string(document) FROM documentdb_data.documents_5;" | head -20
```

### 7. mongosh - Real MongoDB Client

```bash
# Install: brew install mongosh

source .env.example
mongosh "$MONGODB_URL"
```

```javascript
// In mongosh
db.products.insertOne({name: "Laptop", price: 999, tags: ["electronics", "computers"]})
db.products.find({price: {$gt: 500}})
db.products.createIndex({name: 1}, {unique: true})
```

Or one-liners:

```bash
source .env.example
mongosh "$MONGODB_URL" --eval 'db.products.find().pretty()'
mongosh "$MONGODB_URL" --eval 'db.products.countDocuments()'
```

### 8. npm run mongo - MongoDB via FerretDB (Full Example)

```bash
# Create collection with unique index and insert
npm run mongo -- users -c '{"email":1}' -o '{"unique":true}' -i '{"email":"alice@example.com","name":"Alice"}'

# Insert more
npm run mongo -- users -i '{"email":"bob@example.com","name":"Bob","age":30}'

# Query
npm run mongo -- users -q '{}' -p '{"name":1,"email":1}'
npm run mongo -- users -q '{"age":{"$exists":true}}'

# This will fail (unique constraint)
npm run mongo -- users -i '{"email":"alice@example.com","name":"Alice2"}'
```

### 9. psql - Examine FerretDB's PostgreSQL Storage

FerretDB stores MongoDB collections as PostgreSQL tables with BSON columns. Here's how to peek inside:

```bash
# List MongoDB collections
source .env.example
psql "$POSTGRES_URL" -c "SELECT collection_name, collection_id FROM documentdb_api_catalog.collections;"

# View documents (replace documents_N with actual table from catalog)
psql "$POSTGRES_URL" -c "SELECT documentdb_core.bson_to_json_string(document) FROM documentdb_data.documents_3;" | head -30
```

Expected output:
```
                                     bson_to_json_string
----------------------------------------------------------------------------------------
 { "_id" : { "$oid" : "..." }, "email" : "alice@example.com", "name" : "Alice", ... }
 { "_id" : { "$oid" : "..." }, "email" : "bob@example.com", "name" : "Bob", ... }
```

**Hot shit, right?** MongoDB documents living as PostgreSQL rows, queryable with SQL.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Query Layer                          │
│  psql    run-sql.js    run-gql.js    run-docdb.js   mongosh│
└─────────────────────────────────────────────────────────────┘
    │          │              │              │            │
    └──────────┼──────────────┼──────────────┘            │
               │              │                           │
               v              v                           v
          PostgreSQL      PostgREST                   FerretDB
          :5432       /rpc/graphql :3000              :27017
               │              │                           │
               └──────────────┴───────────────────────────┘
                              │
                              v
                    ┌──────────────────────┐
                    │   PostgreSQL 16      │
                    │   Extensions:        │
                    │   • pg_graphql       │
                    │   • documentdb       │
                    │   • pg_cron          │
                    │   • postgis          │
                    └──────────────────────┘
```

## 📦 What's Inside

- **PostgreSQL 16** (or 17) with extensions loaded at startup
- **PostgREST** exposes `pg_graphql` functions via HTTP
- **FerretDB** translates MongoDB wire protocol to PostgreSQL
- **Node.js scripts** for command-line querying

## 🎯 Use Cases

- **Polyglot persistence without polyglot databases** - One ACID-compliant store, many access patterns
- **Gradual migrations** - Test GraphQL before committing to a full rewrite
- **Microservices with shared data** - Each service uses its preferred query language
- **Prototyping** - Use documents for rapid iteration, refactor to relations later
- **Analytics + operational workloads** - SQL for BI, GraphQL for apps, documents for logs

## 🔧 Configuration

All configuration lives in `.env.example`:

```bash
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/postgres
GRAPHQL_URL=http://localhost:3000/rpc/graphql
MONGODB_URL=mongodb://postgres:postgres@localhost:27017/postgres
```

Source it for CLI tools:
```bash
source .env.example
psql "$POSTGRES_URL"
mongosh "$MONGODB_URL"
```

## 🎓 Learning Resources

- [GraphQL and MongoDB in the Context of PostgreSQL](GraphQL-and-MongoDB-in-the-Context-of-PostgreSQL.md) - Deep dive into how these systems work together
- [pg_graphql docs](https://github.com/supabase/pg_graphql) - GraphQL extension details
- [FerretDB docs](https://docs.ferretdb.io/) - MongoDB compatibility layer
- [DocumentDB PostgreSQL Extension](https://github.com/FerretDB/documentdb) - Native document store

## ⚠️ Important Notes

### GraphQL Requires Primary Keys

Tables **MUST** have PRIMARY KEYs for pg_graphql:

```bash
# ✅ Works
npm run sql "CREATE TABLE items (id SERIAL PRIMARY KEY, name TEXT);"
npm run gql "{ itemsCollection { edges { node { name } } } }"

# ❌ Doesn't work
npm run sql "CREATE TABLE broken (name TEXT);"
# GraphQL won't expose this table
```

### Database Separation

- **SQL/GraphQL**: Use `postgres` database
- **DocumentDB**: Uses DocumentDB schemas in `postgres` database
- **MongoDB/FerretDB**: Uses `postgres` database (configurable in .env)

They share the same PostgreSQL instance and can interoperate.

## 🐛 Troubleshooting

```bash
# Check services
docker-compose ps

# View logs
docker-compose logs -f pg-graph-doc

# Connect directly
docker exec -it pg-graph-doc psql -U postgres

# Restart everything
docker-compose down
docker-compose up -d
```

### Common Issues

**GraphQL returns empty:** Missing PRIMARY KEY. Add one:
```bash
npm run sql "ALTER TABLE your_table ADD PRIMARY KEY (id);"
```

**FerretDB connection refused:** Wait 10s after startup for initialization.

**DocumentDB functions missing:** Extensions load at PostgreSQL startup. Check logs.

## 📄 License

ISC
