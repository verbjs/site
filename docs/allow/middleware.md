# Middleware

Allow provides middleware for protecting Verb routes.

## Getting Middleware

```typescript
import { createAllow, getMiddleware } from "allow"

const allow = createAllow({ /* config */ })
const middleware = getMiddleware(allow)
```

## requireAuth

Requires authentication. Returns 401 if not authenticated:

```typescript
app.get("/api/profile", middleware.requireAuth, (req, res) => {
  // req.user is guaranteed to exist
  res.json(req.user)
})
```

## optionalAuth

Loads user if authenticated, but doesn't require it:

```typescript
app.get("/api/posts", middleware.optionalAuth, (req, res) => {
  // req.user may or may not exist
  const posts = await getPosts(req.user?.id)
  res.json(posts)
})
```

## requireRole

Requires specific role:

```typescript
app.delete("/api/users/:id",
  middleware.requireAuth,
  middleware.requireRole("admin"),
  (req, res) => {
    // Only admins can reach here
  }
)
```

## Session Middleware

For session-based auth, use session middleware:

```typescript
import { getSessionMiddleware } from "allow"

const sessionMiddleware = getSessionMiddleware(allow)

app.use(sessionMiddleware)
```

This automatically:
- Reads session cookie
- Loads user from database
- Attaches `req.user` and `req.session`

## Custom Middleware

Build custom auth middleware:

```typescript
import { getUser } from "allow"

const customAuth = async (req, res, next) => {
  const user = await getUser(allow, req)

  if (!user) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  if (!user.emailVerified) {
    return res.status(403).json({ error: "Email not verified" })
  }

  req.user = user
  next()
}

app.get("/api/protected", customAuth, handler)
```

## Combining Middleware

```typescript
// Require auth + specific permission
app.post("/api/posts",
  middleware.requireAuth,
  requirePermission("posts:write"),
  createPost
)

// Custom permission check
const requirePermission = (permission: string) => {
  return (req, res, next) => {
    if (!req.user.permissions?.includes(permission)) {
      return res.status(403).json({ error: "Forbidden" })
    }
    next()
  }
}
```
