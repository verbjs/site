# Migrations

Hull provides schema synchronization for development and migration support for production.

## Schema Sync (Development)

For rapid development, Hull can automatically sync your schemas to the database:

```typescript
import { connect, sync } from "hull"
import { User, Post, Comment } from "./schemas"

const repo = connect({ url: process.env.DATABASE_URL })

const result = await sync(repo, [User, Post, Comment])

console.log("Created:", result.created)   // ["users", "posts"]
console.log("Altered:", result.altered)   // [{ table: "comments", added: ["edited_at"] }]
```

This will:
- Create missing tables
- Add missing columns to existing tables
- **Never** drop columns or tables (safe by default)

## Production Migrations

For production, use explicit migrations with a tool like [Rove](https://github.com/wess/rove):

```typescript
// migrations/001_create_users.ts
import { createTable, addIndex } from "hull/migration"

export const up = async (repo) => {
  await createTable(repo, "users", {
    id: { type: "string", length: 21, primaryKey: true },
    email: { type: "string", length: 255, unique: true },
    password_hash: { type: "string", length: 255 },
    created_at: { type: "datetime", default: "now()" }
  })

  await addIndex(repo, "users", ["email"])
}

export const down = async (repo) => {
  await dropTable(repo, "users")
}
```

## Migration Operations

```typescript
// Tables
await createTable(repo, "posts", { ... })
await dropTable(repo, "posts")
await renameTable(repo, "posts", "articles")

// Columns
await addColumn(repo, "users", "bio", { type: "text", nullable: true })
await dropColumn(repo, "users", "bio")
await renameColumn(repo, "users", "name", "full_name")

// Indexes
await addIndex(repo, "users", ["email"])
await addIndex(repo, "users", ["first_name", "last_name"])
await dropIndex(repo, "users_email_idx")
```

## Transactions

Wrap migrations in transactions for safety:

```typescript
import { transaction } from "hull"

export const up = async (repo) => {
  await transaction(repo, async (tx) => {
    await createTable(tx, "posts", { ... })
    await addIndex(tx, "posts", ["user_id"])
  })
}
```

## Dialect Differences

Hull handles SQL dialect differences automatically:

| Feature | PostgreSQL | SQLite |
|---------|-----------|--------|
| UUID generation | `gen_random_uuid()` | App-side UUID |
| Placeholders | `$1, $2, $3` | `?, ?, ?` |
| RETURNING | Supported | Fetch after insert |
| JSON type | `JSONB` | `TEXT` |
