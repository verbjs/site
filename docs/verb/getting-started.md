# Getting Started with Verb

## Prerequisites

- [Bun](https://bun.sh) runtime installed

## Installation

```bash
bun add @verb-js/verb
```

## Create a Server

```typescript
import { server } from "verb"

const app = server.http()

app.get("/", (req, res) => {
  res.send("Hello, World!")
})

app.listen(3000)

console.log("Server running on http://localhost:3000")
```

## Run Your App

```bash
bun run server.ts
```

## Request & Response

```typescript
app.get("/users/:id", (req, res) => {
  // URL params
  const userId = req.params.id

  // Query string
  const page = req.query.page

  // Headers
  const auth = req.headers.authorization

  // Send JSON response
  res.json({ userId, page })
})

app.post("/users", async (req, res) => {
  // Parse JSON body
  const body = req.body

  // Set status
  res.status(201).json({ created: true })
})
```

## Middleware

```typescript
// Global middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})

// Route-specific middleware
const auth = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  next()
}

app.get("/protected", auth, (req, res) => {
  res.json({ secret: "data" })
})
```

## Static Files

```typescript
app.static("/public", "./static")
```

## Next Steps

- [HTTP Server](/verb/http) - Full HTTP API
- [WebSocket](/verb/websocket) - Real-time communication
- [Middleware](/verb/middleware) - Request processing
- [Routing](/verb/routing) - URL patterns
