# TODO

## Current State

### ✅ Working
- PostgreSQL 17 & 16 Docker images
- SQL queries via `run-sql.js`
- GraphQL queries via `run-gql.js` (PostgREST + pg_graphql)
- DocumentDB queries via `run-docdb.js` (native extension)
- MongoDB queries via `run-mongo.js` (FerretDB)
- Docker Compose setup with all services
- Documentation suite (README, Architecture, Performance, Migration guides)
- Unique index creation in MongoDB interface
- Foreign key relationships auto-detected by GraphQL

### ⚠️ Known Issues
- FerretDB compatibility warnings with PostgreSQL 17 (recommend :16 tag)
- No GraphiQL interface for interactive GraphQL exploration
- MongoDB aggregation pipeline limited (FerretDB constraints)
- No update/delete operations in run-mongo.js script
- No batch operations in any scripts
- Connection string in scripts doesn't use connection pooling
- No transaction examples

### 📝 Documentation Gaps
- No quickstart video or GIF
- No architecture diagrams beyond ASCII art
- Missing troubleshooting for common errors
- No performance benchmarks with real data
- No migration guide from real MongoDB

## Vision

**Core Goal:** Make PostgreSQL approachable for developers who want relational reliability with NoSQL flexibility.

**Target Users:**
1. **SQL people** curious about GraphQL/MongoDB
2. **MongoDB people** wanting ACID without complexity
3. **Startups** needing schema flexibility that grows into relations
4. **API builders** wanting GraphQL without code generation

**Success Metrics:**
- Docker pulls > 10k
- GitHub stars > 500
- "I replaced X with this" comments in issues
- Production usage examples

## Milestones

### M1: Polish Core Experience (1-2 weeks)
- [ ] Add GraphiQL web interface at `/graphiql`
- [ ] Improve error messages in all scripts (catch common mistakes)
- [ ] Add `--help` flag to all scripts
- [ ] Fix run-mongo.js to handle update/delete operations
- [ ] Add transaction examples to docs
- [ ] Create animated GIF showing SQL → GraphQL → MongoDB query flow
- [ ] Test on fresh macOS, Linux, Windows (WSL2)

### M2: Performance & Reliability (2-3 weeks)
- [ ] Run real benchmarks (10k, 100k, 1M rows)
- [ ] Document query performance vs native MongoDB
- [ ] Add connection pooling to scripts
- [ ] Profile slow queries and document optimizations
- [ ] Add health check endpoints for all services
- [ ] Document backup/restore procedures
- [ ] Test data migration from real MongoDB instance

### M3: Developer Experience (3-4 weeks)
- [ ] Add `pg-graph-doc` CLI tool (replaces npm run scripts)
- [ ] Interactive setup wizard for first-time users
- [ ] VSCode extension for GraphQL schema exploration
- [ ] Add query explain/analyze mode to scripts
- [ ] Generate sample data with `--seed` flag
- [ ] Auto-reload on schema changes
- [ ] Better logging (structured JSON, severity levels)

### M4: Production Readiness (1-2 months)
- [ ] Kubernetes deployment example
- [ ] SSL/TLS configuration
- [ ] Authentication (JWT for GraphQL, SCRAM for MongoDB)
- [ ] Read-only mode for queries
- [ ] Rate limiting
- [ ] Query complexity limits
- [ ] Monitoring and metrics (Prometheus exporter)
- [ ] Automated backups

### M5: Advanced Features (2-3 months)
- [ ] Real-time subscriptions (GraphQL + PostgreSQL LISTEN/NOTIFY)
- [ ] Full-text search examples (PostgreSQL + MongoDB text index)
- [ ] PostGIS geospatial queries via all interfaces
- [ ] Time-series data examples
- [ ] Multi-tenant setup guide
- [ ] Read replicas configuration
- [ ] Comparison with Hasura, PostGraphile, Prisma

### M6: Ecosystem (3-6 months)
- [ ] Client libraries (Python, Go, Rust)
- [ ] Terraform module
- [ ] Helm chart
- [ ] Integration tests for CI/CD
- [ ] Performance regression testing
- [ ] Community examples (real-world apps)
- [ ] Video tutorials
- [ ] Conference talk submissions

## Immediate Next Steps

**This Week:**
1. Test on clean machine (macOS)
2. Add GraphiQL at http://localhost:3000/graphiql
3. Improve error messages (especially PRIMARY KEY requirement)
4. Create animated demo GIF

**Next Week:**
1. Run benchmarks (document results)
2. Add update/delete to run-mongo.js
3. Add `--help` to all scripts
4. Write migration guide from real MongoDB

**Next Month:**
1. Build CLI tool to replace npm scripts
2. Add authentication examples
3. Create Kubernetes deployment guide
4. Benchmark vs native MongoDB

## Non-Goals

**Won't Do:**
- Replace MongoDB for existing large deployments
- Match MongoDB sharding (PostgreSQL Citus if needed)
- Support every MongoDB feature (GridFS, change streams)
- Become a database itself (always PostgreSQL underneath)
- Support databases other than PostgreSQL

## Help Wanted

**Good First Issues:**
- Improve error messages
- Add more examples to docs
- Test on different platforms
- Create sample applications
- Write blog posts about use cases

**Advanced Issues:**
- Performance optimization
- Security hardening
- Kubernetes setup
- Monitoring and observability
- Client library development

## Success Stories (Collect These)

**Looking for examples of:**
- Replaced MongoDB with pg-graph-doc in production
- Used for rapid prototyping, then migrated to SQL
- Built GraphQL API without writing resolvers
- Mixed document and relational data effectively
- Simplified ops (one database instead of many)

## Release Strategy

**Versioning:** Follow Docker image tags
- `:16` - Stable (PostgreSQL 16 + FerretDB 2.5.0)
- `:17` - Latest (PostgreSQL 17 + FerretDB latest)
- `:16-YYYYMMDD` - Dated releases for reproducibility

**Breaking Changes:**
- Always announce in README
- Provide migration path
- Keep old tags available

**Release Checklist:**
- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md entry
- [ ] Docker image built and pushed
- [ ] GitHub release with notes
- [ ] Docker Hub description updated
- [ ] Announce in relevant communities

## Community

**Where to promote:**
- Hacker News (Show HN)
- r/PostgreSQL, r/graphql, r/mongodb
- PostgreSQL Weekly newsletter
- GraphQL Weekly newsletter
- Dev.to, Medium posts
- Twitter/X with #PostgreSQL #GraphQL #MongoDB tags
- PostgreSQL conference (PGConf)

**Engagement:**
- Respond to issues within 24 hours
- Welcome first-time contributors
- Document decisions in issues
- Be helpful, not defensive
- Celebrate usage examples

## Metrics to Track

**Technical:**
- Docker pulls per month
- GitHub stars/forks/issues
- Query performance vs native solutions
- Database size on disk

**Community:**
- Blog posts mentioning project
- Questions on Stack Overflow
- Production deployments
- Contributions (PRs, issues, docs)

## Long-term Vision (6-12 months)

**Become the go-to solution for:**
1. Developers wanting PostgreSQL reliability with NoSQL flexibility
2. Prototypes that grow into production systems
3. Teams migrating from MongoDB but keeping ACID
4. APIs that need GraphQL without boilerplate

**Success = When someone says:**
"I need a database that supports SQL, GraphQL, and MongoDB queries" → "Use pg-graph-doc"

## Notes

- Stay focused on PostgreSQL strengths (reliability, performance, ACID)
- Don't try to be MongoDB (be better where it matters)
- Emphasize "one database, many interfaces" story
- Keep documentation practical and example-heavy
- Prioritize developer experience over feature count
