# Schema Definition

Schemas define your database tables with a fluent, type-safe API.

## Basic Schema

```typescript
import { schema } from "hull"

const User = schema("users")
  .string("id", 21, { primaryKey: true })
  .string("email", 255)
  .datetime("created_at", { default: "now()" })
```

## Field Types

### Strings

```typescript
.string("name", 100)           // VARCHAR(100)
.string("slug", 50, { unique: true })
.text("bio")                   // TEXT (unlimited)
```

### Numbers

```typescript
.integer("age")                // INTEGER
.bigint("views")               // BIGINT
.float("rating")               // FLOAT
.decimal("price", 10, 2)       // DECIMAL(10,2)
```

### Other Types

```typescript
.uuid("id")                    // UUID with auto-generation
.boolean("active")             // BOOLEAN
.date("birthday")              // DATE
.datetime("created_at")        // TIMESTAMP
.json("metadata")              // JSONB (Postgres) / TEXT (SQLite)
```

## Field Options

```typescript
.string("email", 255, {
  primaryKey: true,            // PRIMARY KEY
  unique: true,                // UNIQUE constraint
  nullable: true,              // Allow NULL (default: false)
  default: "guest",            // Default value
})
```

## References (Foreign Keys)

```typescript
const Post = schema("posts")
  .string("id", 21, { primaryKey: true })
  .references("user_id", "users")  // FK to users.id
  .string("title", 255)
```

Options for references:

```typescript
.references("user_id", "users", {
  onDelete: "cascade",         // cascade | restrict | set null | no action
})
```

## Type Inference

Hull automatically infers TypeScript types from schemas:

```typescript
import type { InferRow } from "hull"

type UserRow = InferRow<typeof User>
// { id: string, email: string, created_at: Date }
```

## Timestamps Helper

Add `created_at` and `updated_at` in one call:

```typescript
const Post = schema("posts")
  .string("id", 21, { primaryKey: true })
  .string("title", 255)
  .timestamps()  // Adds created_at and updated_at
```
