# Queries

Hull provides a functional, composable query API inspired by Ecto.

## Building Queries

Queries are built by composing functions:

```typescript
import { from, whereEq, orderBy, limit } from "hull"

const query = limit(
  orderBy(
    whereEq(from(User), "active", true),
    "created_at", "desc"
  ),
  10
)
```

## Query Functions

### from

Start a query from a schema:

```typescript
const query = from(User)
```

### where / whereEq

Filter results:

```typescript
whereEq(query, "email", "alice@example.com")  // email = ?
where(query, "age", ">", 18)                   // age > ?
where(query, "status", "!=", "deleted")        // status != ?
```

### whereIn / whereNull

```typescript
whereIn(query, "status", ["active", "pending"])
whereNull(query, "deleted_at")
whereNotNull(query, "verified_at")
```

### orderBy

```typescript
orderBy(query, "created_at", "desc")
orderBy(query, "name", "asc")  // asc is default
```

### limit / offset

```typescript
limit(query, 10)
offset(query, 20)
```

### select

Select specific fields:

```typescript
select(query, ["id", "email", "name"])
```

### distinct

```typescript
distinct(query)
```

### join / leftJoin

```typescript
join(query, "posts", ["users.id", "posts.user_id"])
leftJoin(query, "profiles", ["users.id", "profiles.user_id"])
```

## Executing Queries

### all

Get all matching rows:

```typescript
const users = await all(repo, query)
```

### one

Get first matching row or null:

```typescript
const user = await one(repo, whereEq(from(User), "id", userId))
```

### count

Count matching rows:

```typescript
const total = await count(repo, whereEq(from(User), "active", true))
```

### exists

Check if any rows match:

```typescript
const hasUsers = await exists(repo, from(User))
```

## Raw Queries

For complex queries, use raw SQL:

```typescript
import { raw } from "hull"

const results = await raw(repo, `
  SELECT u.*, COUNT(p.id) as post_count
  FROM users u
  LEFT JOIN posts p ON p.user_id = u.id
  GROUP BY u.id
`)
```

With parameters:

```typescript
const results = await raw<UserRow>(repo,
  `SELECT * FROM users WHERE email = $1`,
  [email]
)
```
