# Routing

Verb provides a fast, flexible routing system.

## Basic Routes

```typescript
import { server } from "verb"

const app = server.http()

app.get("/", handler)
app.post("/users", handler)
app.put("/users/:id", handler)
app.delete("/users/:id", handler)
```

## Route Parameters

```typescript
// Named parameters
app.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id })
})

// Multiple parameters
app.get("/users/:userId/posts/:postId", (req, res) => {
  const { userId, postId } = req.params
  res.json({ userId, postId })
})
```

## Wildcards

```typescript
// Match anything after /files/
app.get("/files/*", (req, res) => {
  const path = req.params["*"]
  res.send(`Path: ${path}`)
})

// /files/images/photo.jpg → path = "images/photo.jpg"
```

## Query Strings

```typescript
// GET /search?q=hello&page=2
app.get("/search", (req, res) => {
  const { q, page } = req.query
  res.json({ query: q, page })
})
```

## Route Groups

Organize routes with common prefixes:

```typescript
// API routes
app.group("/api", (api) => {
  api.get("/users", listUsers)
  api.post("/users", createUser)
  api.get("/users/:id", getUser)
})

// Admin routes with middleware
app.group("/admin", [authMiddleware, adminMiddleware], (admin) => {
  admin.get("/dashboard", dashboard)
  admin.get("/users", manageUsers)
})
```

## Router

Create modular routers:

```typescript
import { createRouter } from "verb"

// users.ts
export const usersRouter = createRouter()
  .get("/", listUsers)
  .post("/", createUser)
  .get("/:id", getUser)
  .put("/:id", updateUser)
  .delete("/:id", deleteUser)

// app.ts
import { usersRouter } from "./users"

app.use("/api/users", usersRouter)
```

## Method Chaining

```typescript
app
  .get("/", home)
  .get("/about", about)
  .post("/contact", contact)
  .listen(3000)
```

## 404 Handling

```typescript
// Catch-all for unmatched routes (must be last)
app.use((req, res) => {
  res.status(404).json({ error: "Not found" })
})
```

## Route Matching Order

Routes are matched in definition order:

```typescript
// More specific routes first
app.get("/users/me", getCurrentUser)    // Matches /users/me
app.get("/users/:id", getUserById)      // Matches /users/123

// Wildcards last
app.get("/files/*", serveFile)          // Matches /files/anything
```
