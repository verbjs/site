# Allow

Allow is a functional authentication library for Verb. It supports multiple authentication strategies including local passwords, JWT tokens, OAuth, and API tokens.

## Features

- **Functional API** - No classes, just functions
- **Multiple Strategies** - Local, JWT, OAuth, SAML support
- **Database Agnostic** - Works with PostgreSQL and SQLite
- **Verb Integration** - Built-in middleware for Verb
- **Session Management** - Secure session handling
- **Multi-Strategy Users** - Link multiple auth methods to one account

## Quick Example

```typescript
import { server } from "verb"
import { createAllow, authenticate, getMiddleware, getHandlers } from "allow"

const allow = createAllow({
  secret: process.env.AUTH_SECRET,
  database: {
    type: "postgres",
    connection: process.env.DATABASE_URL,
    migrate: true
  },
  strategies: [
    {
      name: "local",
      type: "local",
      config: { hashRounds: 12 }
    },
    {
      name: "jwt",
      type: "jwt",
      config: { expiresIn: "7d" }
    }
  ]
})

const app = server.http()
const middleware = getMiddleware(allow)
const handlers = getHandlers(allow)

// Protect routes
app.get("/api/profile", middleware.requireAuth, async (req, res) => {
  res.json(req.user)
})

// Auth endpoints
app.post("/api/login", handlers.login("local"))
app.post("/api/logout", handlers.logout)

app.listen(3000)
```

## Installation

```bash
bun add @verb-js/allow
```

## Core Functions

| Function | Purpose |
|----------|---------|
| `createAllow(config)` | Create an allow instance |
| `authenticate(allow, strategy, req)` | Authenticate a request |
| `createSession(allow, user)` | Create a session |
| `getSession(allow, sessionId)` | Get session by ID |
| `destroySession(allow, sessionId)` | End a session |
| `getMiddleware(allow)` | Get Verb middleware |
| `getHandlers(allow)` | Get route handlers |

## Strategies

| Strategy | Use Case |
|----------|----------|
| `local` | Username/password authentication |
| `jwt` | Stateless API authentication |
| `oauth` | Social login (Google, GitHub, etc.) |
| `saml` | Enterprise SSO |
