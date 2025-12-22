# Hull

Hull is an Ecto-inspired database toolkit for Bun. It provides a functional, composable API for building queries, validating data, and managing schemas.

## Features

- **Functional API** - Pure functions, no classes, fully composable
- **Type-Safe** - Full TypeScript inference from schema definitions
- **Multi-Dialect** - PostgreSQL and SQLite support via Bun.sql
- **Changesets** - Validate and cast data before database operations
- **Schema Sync** - Automatically sync schemas to database
- **High Performance** - Sub-microsecond query building overhead

## Quick Example

```typescript
import { schema, connect, from, whereEq, one, insert, changeset, cast } from "hull"

// Define schema
const User = schema("users")
  .string("id", 21, { primaryKey: true })
  .string("email", 255, { unique: true })
  .string("name", 100)
  .datetime("created_at", { default: "now()" })

// Connect to database
const repo = connect({ url: process.env.DATABASE_URL })

// Query
const user = await one(repo, whereEq(from(User), "email", "alice@example.com"))

// Insert with validation
const cs = cast(changeset(User, {}), {
  id: "abc123",
  email: "bob@example.com",
  name: "Bob"
}, ["id", "email", "name"])

const newUser = await insert(repo, cs)
```

## Installation

```bash
bun add hull
```

## Why Hull?

Hull takes inspiration from Elixir's Ecto library, bringing its functional patterns to TypeScript:

| Ecto | Hull |
|------|------|
| `Repo.all(query)` | `all(repo, query)` |
| `Repo.one(query)` | `one(repo, query)` |
| `Repo.insert(changeset)` | `insert(repo, changeset)` |
| `from(u in User)` | `from(User)` |
| `where(email: email)` | `whereEq(query, "email", email)` |

The result is code that's easy to read, test, and compose.
