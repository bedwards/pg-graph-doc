# pg-graph-doc

A unified PostgreSQL setup that provides three query interfaces in one database: **SQL**, **GraphQL**, and **MongoDB**-compatible queries.

## Overview

This project demonstrates how to use a single PostgreSQL database with multiple query paradigms:

- **SQL** - Traditional relational queries via PostgreSQL
- **GraphQL** - Type-safe queries using [pg_graphql](https://github.com/supabase/pg_graphql)
- **MongoDB** - Document-style queries via [FerretDB](https://www.ferretdb.io/) and [DocumentDB extensions](https://github.com/pg-documentdb/pg-documentdb)

All three interfaces share the same PostgreSQL backend, allowing you to leverage PostgreSQL's reliability and performance while choosing the query style that best fits your use case.

## Components

- **PostgreSQL 17** with extensions:
  - `pg_graphql` - GraphQL API over PostgreSQL
  - `documentdb_core` & `documentdb` - MongoDB compatibility layer
  - `pg_cron` - Job scheduling
  - `postgis` - Geospatial support
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
   # first time
   docker-compose up --build -d 

   # then after
   docker-compose up -d
   ```

   This starts:
   - PostgreSQL on `localhost:5432`
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
- `PGURL` - Connection string (default: `postgres://postgres:postgres@127.0.0.1:5432/app`)
- `SEARCH_PATH` - Schema search path (default: `app, public`)

### GraphQL Queries

Use the `run-gql.js` script to execute GraphQL queries via pg_graphql:

```bash
npm run gql "{ __typename }"
```

```bash
npm run gql "{ usersCollection { edges { node { id name email } } } }"
```

```bash
npm run gql "mutation { insertIntousersCollection(objects: [{name: \"Bob\", email: \"bob@example.com\"}]) { records { id } } }"
```

**Note:** pg_graphql automatically generates a GraphQL schema from your PostgreSQL tables.

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

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Layer                        │
│  run-sql.js    run-gql.js    run-mongo.js              │
└────────────────────────────────────────────────────────┘
         │              │                  │
         │              │                  │
         v              v                  v
    PostgreSQL     pg_graphql          FerretDB
    (port 5432)    extension       (port 27017)
         │              │                  │
         └──────────────┴──────────────────┘
                        │
                        v
              ┌─────────────────────┐
              │   PostgreSQL 17     │
              │   with Extensions   │
              └─────────────────────┘
```

## Docker Services

### pg-graph-doc

The main PostgreSQL container with all extensions pre-installed. Data persists in a named volume (`pgdata`).

**Configuration:**
- Database: `app`
- User: `postgres`
- Password: `postgres`
- Port: `5432`

### ferretdb

Provides MongoDB wire protocol compatibility, translating MongoDB queries to PostgreSQL.

**Configuration:**
- Port: `27017`
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
docker exec -it pg-graph-doc psql -U postgres -d app
```

### Viewing Logs

```bash
docker-compose logs -f pg-graph-doc
docker-compose logs -f ferretdb
```

## Extensions Installed

- **pg_graphql** - Instant GraphQL API for PostgreSQL
- **documentdb_core & documentdb** - MongoDB-compatible document operations
- **pg_cron** - Background job scheduling
- **postgis** - Geographic objects and spatial queries

## Use Cases

- **Polyglot persistence** - Support multiple query paradigms without data duplication
- **Migration testing** - Evaluate moving between SQL/NoSQL/GraphQL
- **API flexibility** - Let different services query the same data their preferred way
- **Learning** - Compare how the same data model works across paradigms

## License

ISC

## Contributing

Issues and pull requests welcome at [https://github.com/bedwards/pg-graph-doc](https://github.com/bedwards/pg-graph-doc)