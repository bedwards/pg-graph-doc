# GraphQL from PostgreSQL: A Practical Guide

If you know SQL but GraphQL seems mysterious, this guide will make it click.

## The Core Insight

**SQL says:** "Give me these columns from this table"
**GraphQL says:** "Give me exactly these fields, including related data, in one request"

GraphQL is a query language designed for APIs, not databases. But with `pg_graphql`, you get a GraphQL API **automatically generated** from your PostgreSQL schema.

## Your First GraphQL Query

Let's start with SQL you know:

```sql
CREATE TABLE authors (
  id SERIAL PRIMARY KEY,
  name TEXT,
  bio TEXT
);

CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  author_id INT REFERENCES authors(id),
  title TEXT,
  pages INT
);

INSERT INTO authors (name, bio) VALUES 
  ('Ursula K. Le Guin', 'American author'),
  ('Octavia Butler', 'Science fiction writer');

INSERT INTO books (author_id, title, pages) VALUES
  (1, 'The Left Hand of Darkness', 304),
  (1, 'The Dispossessed', 387),
  (2, 'Kindred', 287);
```

### SQL Query (Traditional)

```sql
-- Get all books with author names
SELECT b.title, b.pages, a.name as author_name
FROM books b
JOIN authors a ON a.id = b.author_id;
```

### GraphQL Query (Equivalent)

```bash
npm run gql "{
  booksCollection {
    edges {
      node {
        title
        pages
        authorsCollection {
          edges {
            node {
              name
            }
          }
        }
      }
    }
  }
}"
```

**What happened?**

1. `pg_graphql` saw your `author_id` foreign key
2. It automatically created a relationship: `books.authorsCollection`
3. You can traverse it like object properties
4. No manual JOIN needed!

## GraphQL Concepts for SQL People

### Tables → Collections

```sql
-- SQL
SELECT * FROM users;
```

```graphql
# GraphQL
{
  usersCollection {
    edges {
      node {
        id
        name
      }
    }
  }
}
```

Why the weird `edges` and `node`? That's the [Relay cursor connection](https://relay.dev/graphql/connections.htm) pattern. It enables efficient pagination.

### WHERE → filter

```sql
-- SQL
SELECT * FROM products WHERE price > 100;
```

```graphql
# GraphQL
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

Available filters:
- `eq` (equals)
- `gt`, `gte`, `lt`, `lte` (comparisons)
- `in` (array membership)
- `is` (NULL checks)
- `like`, `ilike` (pattern matching)

### ORDER BY → orderBy

```sql
-- SQL
SELECT * FROM users ORDER BY created_at DESC;
```

```graphql
# GraphQL
{
  usersCollection(orderBy: {createdAt: DescNullsLast}) {
    edges {
      node {
        name
        createdAt
      }
    }
  }
}
```

### LIMIT → first/last

```sql
-- SQL
SELECT * FROM posts ORDER BY created_at DESC LIMIT 10;
```

```graphql
# GraphQL
{
  postsCollection(
    first: 10
    orderBy: {createdAt: DescNullsLast}
  ) {
    edges {
      node {
        title
        createdAt
      }
    }
  }
}
```

### Pagination (OFFSET → cursor)

**SQL pagination** (problematic with changing data):
```sql
-- Page 1
SELECT * FROM posts ORDER BY id LIMIT 10 OFFSET 0;
-- Page 2
SELECT * FROM posts ORDER BY id LIMIT 10 OFFSET 10;
```

**GraphQL cursor pagination** (stable with changing data):
```graphql
# Page 1
{
  postsCollection(first: 10) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node { title }
    }
  }
}

# Page 2 - use endCursor from page 1
{
  postsCollection(first: 10, after: "WyJwdWJsaWMucG9zdHMiLCAiMTAiXQ==") {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node { title }
    }
  }
}
```

Cursors are stable even if data changes between requests.

## Relationships (The Power Move)

### One-to-Many

```sql
CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);
CREATE TABLE posts (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), title TEXT);
```

**SQL:** Manual JOIN
```sql
SELECT u.name, p.title
FROM users u
LEFT JOIN posts p ON p.user_id = u.id;
```

**GraphQL:** Automatic traversal
```graphql
{
  usersCollection {
    edges {
      node {
        name
        postsCollection {
          edges {
            node {
              title
            }
          }
        }
      }
    }
  }
}
```

### Many-to-One

```sql
-- Get posts with author info
SELECT p.title, u.name
FROM posts p
JOIN users u ON u.id = p.user_id;
```

```graphql
{
  postsCollection {
    edges {
      node {
        title
        usersCollection {
          edges {
            node {
              name
            }
          }
        }
      }
    }
  }
}
```

### Many-to-Many (via join table)

```sql
CREATE TABLE students (id SERIAL PRIMARY KEY, name TEXT);
CREATE TABLE courses (id SERIAL PRIMARY KEY, title TEXT);
CREATE TABLE enrollments (
  student_id INT REFERENCES students(id),
  course_id INT REFERENCES courses(id),
  PRIMARY KEY (student_id, course_id)
);
```

**SQL:** Two JOINs
```sql
SELECT s.name, c.title
FROM students s
JOIN enrollments e ON e.student_id = s.id
JOIN courses c ON c.id = e.course_id;
```

**GraphQL:** Follow the foreign keys
```graphql
{
  studentsCollection {
    edges {
      node {
        name
        enrollmentsCollection {
          edges {
            node {
              coursesCollection {
                edges {
                  node {
                    title
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
```

## Mutations (INSERT, UPDATE, DELETE)

### INSERT

```sql
-- SQL
INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');
```

```graphql
# GraphQL
mutation {
  insertIntousersCollection(
    objects: [{name: "Alice", email: "alice@example.com"}]
  ) {
    records {
      id
      name
    }
  }
}
```

### UPDATE

```sql
-- SQL
UPDATE users SET name = 'Alice Smith' WHERE id = 1;
```

```graphql
# GraphQL
mutation {
  updateusersCollection(
    set: {name: "Alice Smith"}
    filter: {id: {eq: 1}}
  ) {
    records {
      id
      name
    }
  }
}
```

### DELETE

```sql
-- SQL
DELETE FROM users WHERE id = 1;
```

```graphql
# GraphQL
mutation {
  deleteFromusersCollection(
    filter: {id: {eq: 1}}
  ) {
    records {
      id
    }
  }
}
```

## Aggregations

### COUNT

```sql
-- SQL
SELECT COUNT(*) FROM posts WHERE published = true;
```

```graphql
# GraphQL
{
  postsCollection(filter: {published: {eq: true}}) {
    totalCount
  }
}
```

### Complex Aggregations

SQL is still better here:

```sql
-- SQL: Easy
SELECT user_id, COUNT(*), AVG(score) 
FROM posts 
GROUP BY user_id;
```

```graphql
# GraphQL: Requires multiple queries or custom functions
# This is where you drop back to SQL
```

For complex analytics, use SQL. GraphQL is for data fetching, not business intelligence.

## Why Use GraphQL?

### 1. Precise Data Fetching

**Problem with REST:**
```bash
# Get user
GET /api/users/1
# Returns: {id, name, email, bio, avatar, preferences, ...} 
# Mobile app only needs name and avatar - waste of bandwidth

# Get user's posts
GET /api/users/1/posts
# Returns all posts with all fields
# Frontend only needs titles - more waste
```

**GraphQL solution:**
```graphql
{
  usersCollection(filter: {id: {eq: 1}}) {
    edges {
      node {
        name
        avatar
        postsCollection {
          edges {
            node {
              title
            }
          }
        }
      }
    }
  }
}
```

One request, exact data needed, no over-fetching.

### 2. No N+1 Queries

**SQL anti-pattern:**
```javascript
// Get users
const users = await db.query('SELECT * FROM users')

// For each user, get their posts (N queries!)
for (const user of users) {
  user.posts = await db.query('SELECT * FROM posts WHERE user_id = ?', user.id)
}
```

**GraphQL:** Automatically batches and optimizes
```graphql
{
  usersCollection {
    edges {
      node {
        name
        postsCollection { edges { node { title } } }
      }
    }
  }
}
```

Behind the scenes, `pg_graphql` generates optimized SQL - no N+1!

### 3. Strongly Typed

GraphQL is typed. Your schema is documented:

```bash
npm run gql "{ __type(name: \"User\") { fields { name type { name } } } }"
```

Returns:
```json
{
  "fields": [
    {"name": "id", "type": {"name": "Int"}},
    {"name": "name", "type": {"name": "String"}},
    {"name": "email", "type": {"name": "String"}}
  ]
}
```

Frontend developers know exactly what they can query.

## When to Use GraphQL vs SQL

### Use GraphQL for:
- Building APIs for frontends (web, mobile)
- When different clients need different data shapes
- Fetching related data (posts + comments + authors)
- Public APIs with many consumers

### Use SQL for:
- Analytics and reporting
- Complex aggregations
- Bulk operations
- When you control both sides (backend-to-backend)
- When you need every ounce of performance

## Best Practices

### 1. Always Use PRIMARY KEYS

```bash
# ❌ Won't work with GraphQL
npm run sql "CREATE TABLE items (name TEXT, price DECIMAL);"

# ✅ Works perfectly
npm run sql "CREATE TABLE items (id SERIAL PRIMARY KEY, name TEXT, price DECIMAL);"
```

`pg_graphql` requires PRIMARY KEYs for unique identification.

### 2. Use Foreign Keys for Relationships

```bash
# Foreign keys create automatic GraphQL relationships
npm run sql "
  CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    post_id INT REFERENCES posts(id),  -- This creates the relationship!
    text TEXT
  );
"
```

Now `postsCollection` automatically has `commentsCollection`.

### 3. Limit Query Depth

Prevent abuse:
```graphql
# Bad: Unlimited nesting
{
  usersCollection {
    edges {
      node {
        postsCollection {
          edges {
            node {
              commentsCollection {
                edges {
                  node {
                    userCollection {  # Back to users!
                      edges {
                        node {
                          postsCollection {  # Infinite loop
                            # ...
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
  }
}
```

Set query depth limits in production.

### 4. Use Pagination

```graphql
# Don't do this
{ usersCollection { edges { node { name } } } }  # Returns ALL users!

# Do this
{ usersCollection(first: 20) { edges { node { name } } } }
```

## Advanced: Custom Functions

You can extend GraphQL with SQL functions:

```sql
CREATE OR REPLACE FUNCTION full_name(u users) RETURNS TEXT AS $$
  SELECT u.first_name || ' ' || u.last_name;
$$ LANGUAGE SQL STABLE;
```

Now query it:
```graphql
{
  usersCollection {
    edges {
      node {
        fullName  # Calls your function!
      }
    }
  }
}
```

## Debugging

### See Generated SQL

Check PostgreSQL logs:
```bash
docker-compose logs -f pg-graph-doc | grep "SELECT"
```

You'll see the SQL `pg_graphql` generates.

### Introspect Schema

```bash
# See all types
npm run gql "{ __schema { types { name } } }"

# See specific type
npm run gql "{ __type(name: \"User\") { fields { name type { name } } } }"
```

### Test Queries

Use GraphiQL (coming soon) or curl:
```bash
curl -X POST http://localhost:3000/rpc/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'
```

## Learning More

- [Official GraphQL Tutorial](https://graphql.org/learn/)
- [pg_graphql Documentation](https://supabase.github.io/pg_graphql/)
- [Relay Connection Spec](https://relay.dev/graphql/connections.htm)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)

## The Bottom Line

**GraphQL is SQL for APIs.** It solves the problem of "how do I give different clients exactly the data they need without writing dozens of REST endpoints?"

With `pg_graphql`, you get a production-ready GraphQL API from your PostgreSQL schema - no code generation, no ORM, just pure SQL with a GraphQL query interface.

And when you need raw SQL power? It's right there:
```bash
npm run sql "SELECT * FROM users JOIN posts USING (user_id)"
```

Best of both worlds.
