# Middleware

Middleware functions process requests before they reach route handlers.

## Basic Middleware

```typescript
import { server } from "verb"

const app = server.http()

// Middleware function
const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
}

// Apply globally
app.use(logger)
```

## Middleware Order

Middleware runs in the order it's defined:

```typescript
app.use((req, res, next) => {
  console.log("First")
  next()
})

app.use((req, res, next) => {
  console.log("Second")
  next()
})

app.get("/", (req, res) => {
  res.send("Handler")
})

// Output: First, Second, Handler
```

## Route-Specific Middleware

Apply middleware to specific routes:

```typescript
const auth = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  next()
}

app.get("/public", (req, res) => {
  res.send("Public")
})

app.get("/private", auth, (req, res) => {
  res.send("Private")
})
```

## Multiple Middleware

Chain multiple middleware on a route:

```typescript
app.get("/admin",
  authenticate,
  requireRole("admin"),
  logAccess,
  (req, res) => {
    res.send("Admin area")
  }
)
```

## Async Middleware

```typescript
const loadUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]
  if (token) {
    req.user = await getUserFromToken(token)
  }
  next()
}

app.use(loadUser)
```

## Built-in Middleware

```typescript
import { middleware } from "verb"

// CORS
app.use(middleware.cors({
  origin: "https://example.com",
  methods: ["GET", "POST"]
}))

// Request logging
app.use(middleware.logger())

// Rate limiting
app.use(middleware.rateLimit({
  windowMs: 60000,
  max: 100
}))
```

## Error Handling Middleware

Error middleware has 4 parameters:

```typescript
const errorHandler = (err, req, res, next) => {
  console.error(err)
  res.status(500).json({
    error: err.message
  })
}

// Must be last
app.use(errorHandler)
```

## Modifying Request/Response

```typescript
// Add data to request
app.use((req, res, next) => {
  req.startTime = Date.now()
  next()
})

// Modify response
app.use((req, res, next) => {
  const originalJson = res.json.bind(res)
  res.json = (data) => {
    data.timestamp = new Date().toISOString()
    return originalJson(data)
  }
  next()
})
```
