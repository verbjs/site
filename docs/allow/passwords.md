# Password Authentication

The local strategy provides username/password authentication with secure password hashing.

## Configuration

```typescript
import { createAllow } from "allow"

const allow = createAllow({
  secret: process.env.AUTH_SECRET,
  strategies: [
    {
      name: "local",
      type: "local",
      config: {
        usernameField: "email",    // Field name for username
        passwordField: "password", // Field name for password
        hashRounds: 12             // Bcrypt cost factor
      }
    }
  ]
})
```

## Authenticate

```typescript
import { authenticate } from "allow"

const result = await authenticate(allow, "local", req)

if (result.success) {
  // User authenticated
  const user = result.user
  const token = result.tokens?.access_token
} else {
  // Authentication failed
  console.log(result.error)
}
```

## With Verb Routes

```typescript
import { server } from "verb"
import { createAllow, authenticate, createSession, getHandlers } from "allow"

const allow = createAllow({ /* config */ })
const handlers = getHandlers(allow)

const app = server.http()

// Use built-in handlers
app.post("/api/login", handlers.login("local"))
app.post("/api/logout", handlers.logout)
app.get("/api/profile", handlers.profile)

// Or build custom handlers
app.post("/api/custom-login", async (req, res) => {
  const result = await authenticate(allow, "local", req)

  if (result.success) {
    const session = await createSession(allow, result.user)
    res.cookie("allow-session", session.id, {
      httpOnly: true,
      secure: true,
      maxAge: 86400000
    })
    res.json({ user: result.user })
  } else {
    res.status(401).json({ error: result.error })
  }
})
```

## Password Requirements

Add custom validation before authentication:

```typescript
const validatePassword = (password: string): boolean => {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  )
}

app.post("/api/register", async (req, res) => {
  const { email, password } = req.body

  if (!validatePassword(password)) {
    return res.status(400).json({
      error: "Password must be 8+ chars with uppercase and number"
    })
  }

  // Continue with registration...
})
```
