# pg-graph-doc

A unified PostgreSQL setup that provides three query interfaces in one database: **SQL**, **GraphQL**, and **MongoDB**-compatible queries.

[Docker Hub: bedwards/pg-graph-doc](https://hub.docker.com/repository/docker/bedwards/pg-graph-doc)

Also see [GraphQL and MongoDB in the Context of PostgreSQL](GraphQL-and-MongoDB-in-the-Context-of-PostgreSQL.md)

## Overview

This project demonstrates how to use a single PostgreSQL database with multiple query paradigms:

- **SQL** - Traditional relational queries via PostgreSQL
- **GraphQL** - Type-safe queries using [pg_graphql](https://github.com/supabase/pg_graphql) via [PostgREST](https://postgrest.org/)
- **MongoDB** - Document-style queries via [FerretDB](https://www.ferretdb.io/)

All three interfaces share the same PostgreSQL backend, allowing you to leverage PostgreSQL's reliability and performance while choosing the query style that best fits your use case.

## Components

- **PostgreSQL 17** with extensions:
  - `pg_graphql` - GraphQL API over PostgreSQL
  - `documentdb_core` & `documentdb` - MongoDB compatibility layer (via DocumentDB extensions)
  - `pg_cron` - Job scheduling
  - `postgis` - Geospatial support
- **PostgREST** - Provides the GraphQL endpoint at `/rpc/graphql`
- **FerretDB** - MongoDB wire protocol compatibility
- **Node.js scripts** - Command-line tools for each interface

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for the query scripts)

## Quick Start

1. **Clone and install dependencies:**

   ```bash
   npm install
   ```

2. **Start the services:**

   ```bash
   # First time
   docker-compose up --build -d 

   # Subsequent runs
   docker-compose up -d
   ```

   This starts:
   - PostgreSQL on `localhost:5432`
   - PostgREST (GraphQL endpoint) on `localhost:3000`
   - FerretDB (MongoDB-compatible) on `localhost:27017`

3. **Verify everything is running:**

   ```bash
   docker-compose ps
   ```

## Usage

### SQL Queries

Use the `run-sql.js` script to execute SQL directly:

```bash
npm run sql "SELECT version()"
```

```bash
npm run sql "CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT, email TEXT)"
```

```bash
npm run sql "INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')"
```

```bash
npm run sql "SELECT * FROM users"
```

**Environment variables:**
- `POSTGRES_URL` - Connection string (default: `postgres://postgres:postgres@localhost:5432/postgres`)

### GraphQL Queries

Use the `run-gql.js` script to execute GraphQL queries via pg_graphql (exposed through PostgREST):

```bash
npm run gql "{ __typename }"
```

```bash
npm run gql "{ usersCollection { edges { node { id name email } } } }"
```

```bash
npm run gql "mutation { insertIntousersCollection(objects: [{name: \"Bob\", email: \"bob@example.com\"}]) { records { id } } }"
```

**Environment variables:**
- `GRAPHQL_URL` - GraphQL endpoint (default: `http://localhost:3000/rpc/graphql`)

**⚠️ Important:** Tables MUST have a PRIMARY KEY for GraphQL to work. pg_graphql requires primary keys to generate the GraphQL schema properly.

**Example:**
```bash
# This works - table has a PRIMARY KEY
npm run sql "CREATE TABLE foo (bar INT PRIMARY KEY);"
npm run sql "INSERT INTO foo (bar) VALUES (1)"
npm run gql 'query { fooCollection { edges { node { bar } } } }'
# Output: {"data":{"fooCollection":{"edges":[{"node":{"bar":1}}]}}}

# This won't work - no PRIMARY KEY
npm run sql "CREATE TABLE broken (bar INT);"
# GraphQL queries will fail or not expose this table
```

### MongoDB Queries

Use the `run-mongo.js` script to execute MongoDB-style queries via FerretDB:

```bash
npm run mongo products '{}' '{"_id":1,"name":1}'
```

```bash
npm run mongo products '{"price": {"$gt": 100}}'
```

The script accepts three arguments:
1. Collection name (required)
2. Query JSON (default: `{}`)
3. Projection JSON (default: `{}`)

**Environment variable:**
- `MONGODB_URL` - MongoDB connection string (default: `mongodb://127.0.0.1:27017/app`)

**Note:** The MongoDB database name in FerretDB is `app`, while the PostgreSQL database used by SQL and GraphQL is `postgres`.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Layer                        │
│  run-sql.js    run-gql.js    run-mongo.js              │
└────────────────────────────────────────────────────────┘
         │              │                  │
         │              │                  │
         v              v                  v
    PostgreSQL      PostgREST          FerretDB
    (port 5432)  (/rpc/graphql)    (port 27017)
                   port 3000             │
         │              │                 │
         └──────────────┴─────────────────┘
                        │
                        v
              ┌─────────────────────┐
              │   PostgreSQL 17     │
              │   with Extensions   │
              │   (pg_graphql,      │
              │    documentdb)      │
              └─────────────────────┘
```

## Docker Services

### pg-graph-doc

The main PostgreSQL container with all extensions pre-installed. Data persists in a named volume (`pgdata`).

**Configuration:**
- Database: `postgres`
- User: `postgres`
- Password: `postgres`
- Port: `5432`

### pg-rpc (PostgREST)

Provides the GraphQL endpoint via PostgREST, which exposes the `graphql()` function created by pg_graphql.

**Configuration:**
- Port: `3000`
- GraphQL endpoint: `http://localhost:3000/rpc/graphql`
- Backend: PostgreSQL (via `pg-graph-doc`)

### ferretdb

Provides MongoDB wire protocol compatibility, translating MongoDB queries to PostgreSQL.

**Configuration:**
- Port: `27017`
- Database: `app`
- Backend: PostgreSQL (via `pg-graph-doc`)
- Authentication: Disabled (for development)

## Development

### Rebuilding the PostgreSQL Image

If you modify the Dockerfile or extensions:

```bash
docker-compose build pg-graph-doc
docker-compose up -d
```

### Accessing PostgreSQL Directly

```bash
docker exec -it pg-graph-doc psql -U postgres -d postgres
```

### Viewing Logs

```bash
docker-compose logs -f pg-graph-doc
docker-compose logs -f pg-rpc
docker-compose logs -f ferretdb
```

## Extensions Installed

- **pg_graphql** - Instant GraphQL API for PostgreSQL
- **documentdb_core & documentdb** - MongoDB-compatible document operations
- **pg_cron** - Background job scheduling
- **postgis** - Geographic objects and spatial queries

## Database Design Best Practices

### For GraphQL

**Always include a PRIMARY KEY** - This is mandatory for pg_graphql to expose tables:

```bash
# ✅ Good - will work with GraphQL
npm run sql "CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT,
  price DECIMAL
)"

# ❌ Bad - won't work with GraphQL
npm run sql "CREATE TABLE broken_table (
  name TEXT,
  price DECIMAL
)"
```

### For Relational Data (SQL/GraphQL)

- Use normalized tables with clear foreign keys
- Define primary keys on all tables
- Use appropriate data types (TEXT, INT, DECIMAL, BOOLEAN)

### For Document Data (MongoDB)

- Store flexible/nested JSON structures
- Use when schema varies by document
- Good for rapid prototyping and heterogeneous data

### Hybrid Approach

You can use PostgreSQL JSONB columns to get the best of both worlds:

```bash
npm run sql "CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT,
  price DECIMAL,
  metadata JSONB
)"
```

## Use Cases

- **Polyglot persistence** - Support multiple query paradigms without data duplication
- **Migration testing** - Evaluate moving between SQL/NoSQL/GraphQL
- **API flexibility** - Let different services query the same data their preferred way
- **Learning** - Compare how the same data model works across paradigms

## Troubleshooting

### GraphQL queries return empty or fail

**Most common issue:** Table is missing a PRIMARY KEY. Add one:

```bash
npm run sql "ALTER TABLE your_table ADD PRIMARY KEY (id)"
```

### Connection issues

Verify services are running:
```bash
docker-compose ps
```

Check logs:
```bash
docker-compose logs pg-graph-doc
docker-compose logs pg-rpc
docker-compose logs ferretdb
```

### FerretDB database vs PostgreSQL database

Note that FerretDB uses the `app` database while SQL/GraphQL use the `postgres` database. They're isolated by default but share the same PostgreSQL instance.

## License

ISC

## Contributing

Issues and pull requests welcome at [https://github.com/bedwards/pg-graph-doc](https://github.com/bedwards/pg-graph-doc)
