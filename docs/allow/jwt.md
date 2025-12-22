# JWT Tokens

JWT (JSON Web Tokens) provide stateless authentication for APIs.

## Configuration

```typescript
import { createAllow } from "allow"

const allow = createAllow({
  secret: process.env.AUTH_SECRET,
  strategies: [
    {
      name: "jwt",
      type: "jwt",
      config: {
        secret: process.env.JWT_SECRET,  // Signing secret
        algorithm: "HS256",               // Algorithm (default: HS256)
        expiresIn: "7d"                   // Token expiration
      }
    }
  ]
})
```

## Generate Tokens

After authentication, tokens are included in the result:

```typescript
import { authenticate } from "allow"

const result = await authenticate(allow, "local", req)

if (result.success) {
  const { access_token, refresh_token, expires_at } = result.tokens
}
```

## API Authentication

Use the `Authorization` header:

```typescript
// Client
fetch("/api/profile", {
  headers: {
    Authorization: `Bearer ${access_token}`
  }
})
```

```typescript
// Server
import { getMiddleware } from "allow"

const middleware = getMiddleware(allow)

app.get("/api/profile", middleware.requireAuth, (req, res) => {
  res.json(req.user)
})
```

## Token Expiration

| Type | Default | Recommended |
|------|---------|-------------|
| Access Token | 15m | 15m - 1h |
| Refresh Token | 7d | 7d - 30d |

Short access tokens with refresh tokens provide security with good UX.

## Logout / Revoke

For stateless JWT, logout is handled client-side by discarding the token. The middleware will reject expired tokens automatically.
