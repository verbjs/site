# Getting Started with Hull

## Installation

```bash
bun add hull
```

## Database Connection

Hull uses Bun's built-in SQL driver. Connect by providing a database URL:

```typescript
import { connect, disconnect } from "hull"

// PostgreSQL
const repo = connect({ url: "postgres://user:pass@localhost:5432/mydb" })

// SQLite
const repo = connect({ url: "sqlite://./data.db" })

// From environment
const repo = connect({ url: process.env.DATABASE_URL })

// Cleanup
await disconnect(repo)
```

## Define a Schema

Schemas define your table structure with a fluent builder:

```typescript
import { schema } from "hull"

const User = schema("users")
  .string("id", 21, { primaryKey: true })
  .string("email", 255, { unique: true })
  .string("password_hash", 255)
  .string("name", 100, { nullable: true })
  .datetime("created_at", { default: "now()" })
```

## Sync Schema to Database

Hull can automatically create tables and add missing columns:

```typescript
import { sync } from "hull"

const result = await sync(repo, [User, Post, Comment])

console.log("Created tables:", result.created)
console.log("Altered tables:", result.altered)
```

## Basic Queries

```typescript
import { from, whereEq, orderBy, limit, all, one } from "hull"

// Get all users
const users = await all(repo, from(User))

// Find by email
const user = await one(repo, whereEq(from(User), "email", "alice@example.com"))

// Complex query
const recentUsers = await all(repo,
  limit(
    orderBy(from(User), "created_at", "desc"),
    10
  )
)
```

## Insert Data

Use changesets for validated inserts:

```typescript
import { changeset, cast, insert } from "hull"

const cs = cast(
  changeset(User, {}),
  { id: "abc123", email: "bob@example.com", name: "Bob" },
  ["id", "email", "name"]
)

if (cs.valid) {
  const user = await insert(repo, cs)
}
```

## Next Steps

- [Schema Definition](/hull/schema) - Field types and options
- [Queries](/hull/queries) - Query building in depth
- [Changesets](/hull/changesets) - Validation and casting
