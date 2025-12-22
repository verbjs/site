# HTTP Server

The HTTP server provides a familiar Express-like API optimized for Bun.

## Create Server

```typescript
import { server } from "verb"

const app = server.http()
```

## Routes

```typescript
app.get("/", handler)
app.post("/", handler)
app.put("/", handler)
app.patch("/", handler)
app.delete("/", handler)
app.options("/", handler)
app.head("/", handler)
```

## Route Parameters

```typescript
// Single param
app.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id })
})

// Multiple params
app.get("/users/:userId/posts/:postId", (req, res) => {
  const { userId, postId } = req.params
  res.json({ userId, postId })
})

// Wildcard
app.get("/files/*", (req, res) => {
  const path = req.params["*"]
  res.send(`File: ${path}`)
})
```

## Request Object

```typescript
app.post("/api/data", (req, res) => {
  req.method      // "POST"
  req.url         // "/api/data?page=1"
  req.path        // "/api/data"
  req.params      // Route parameters
  req.query       // { page: "1" }
  req.headers     // Request headers
  req.body        // Parsed body (JSON, form, etc.)
  req.cookies     // Parsed cookies
  req.ip          // Client IP
  req.secure      // true if HTTPS
})
```

## Response Object

```typescript
app.get("/", (req, res) => {
  // Send text
  res.send("Hello")

  // Send JSON
  res.json({ data: "value" })

  // Set status
  res.status(201).json({ created: true })

  // Set headers
  res.header("X-Custom", "value")
  res.type("application/xml")

  // Redirect
  res.redirect("/other")
  res.redirect(301, "/permanent")

  // Cookies
  res.cookie("token", "abc", { httpOnly: true })
  res.clearCookie("token")
})
```

## JSON Body Parsing

JSON parsing is optimized and enabled by default:

```typescript
app.post("/api/users", (req, res) => {
  const { name, email } = req.body
  res.json({ name, email })
})
```

## Error Handling

```typescript
import { errorHandler } from "verb"

app.get("/error", (req, res) => {
  throw new Error("Something went wrong")
})

// Global error handler
app.use(errorHandler())
```

## Listen

```typescript
// Default options
app.listen(3000)

// With callback
app.listen(3000, () => {
  console.log("Server started")
})

// With hostname
app.listen(3000, "0.0.0.0")
```
