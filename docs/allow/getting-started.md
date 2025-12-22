# Getting Started with Allow

## Installation

```bash
bun add allow
```

## Basic Setup

```typescript
import { createAllow } from "allow"

const allow = createAllow({
  secret: process.env.AUTH_SECRET,
  database: {
    type: "postgres",
    connection: process.env.DATABASE_URL,
    migrate: true  // Auto-create tables
  },
  strategies: [
    {
      name: "local",
      type: "local",
      config: {}
    }
  ]
})
```

## Configuration Options

```typescript
type AuthConfig = {
  secret: string              // Required: JWT/session signing secret
  sessionDuration?: number    // Session TTL in ms (default: 86400000)
  database?: {
    type: "sqlite" | "postgres"
    connection: string        // Database URL
    migrate?: boolean         // Auto-run migrations
  }
  strategies: StrategyConfig[]
}
```

## Database Tables

When `migrate: true`, Allow creates these tables:

- `allow_users` - User accounts
- `allow_strategies` - Linked auth strategies per user
- `allow_sessions` - Active sessions

## Environment Variables

```bash
# .env
AUTH_SECRET=your-secret-key-min-32-chars
DATABASE_URL=postgres://user:pass@localhost:5432/mydb
```

## Authenticate a Request

```typescript
import { authenticate } from "allow"

const result = await authenticate(allow, "local", req)

if (result.success) {
  console.log("User:", result.user)
  console.log("Token:", result.tokens?.access_token)
} else {
  console.log("Error:", result.error)
}
```

## Session Management

```typescript
import { createSession, getSession, destroySession } from "allow"

// Create session after login
const session = await createSession(allow, user)

// Get existing session
const session = await getSession(allow, sessionId)

// Logout
await destroySession(allow, sessionId)
```

## Next Steps

- [Password Auth](/allow/passwords) - Local username/password
- [JWT Tokens](/allow/jwt) - Stateless authentication
- [Middleware](/allow/middleware) - Protecting routes
