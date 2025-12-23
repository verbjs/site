# API Tokens

> API tokens provide long-lived authentication for programmatic access.

## Creating Tokens

```typescript
import { createAllow, linkStrategy } from "allow"

// Generate a secure random token
const token = crypto.randomUUID()
const tokenHash = await Bun.password.hash(token)

// Link to user
await linkStrategy(allow, userId, "api-token", tokenHash, {
  name: "My API Token",
  permissions: ["read", "write"]
})

// Return plain token to user (only time it's visible)
return { token }
```

## Authenticating with API Tokens

```typescript
// Client sends token in header
fetch("/api/data", {
  headers: {
    Authorization: `Bearer ${apiToken}`
  }
})
```

## Token Format

For API tokens, use the format `{accessKey}:{secretKey}`:

```typescript
// Generate key pair
const accessKey = crypto.randomUUID().replace(/-/g, "").slice(0, 20)
const secretKey = crypto.randomUUID().replace(/-/g, "")
const secretHash = await Bun.password.hash(secretKey)

// Store accessKey and secretHash in database
// Return accessKey:secretKey to user once

// Auth header format
Authorization: Bearer ak_abc123:sk_xyz789
```

## Revoking Tokens

```typescript
import { unlinkStrategy } from "allow"

await unlinkStrategy(allow, userId, "api-token")
```

## Best Practices

1. **Hash tokens** - Never store plain tokens in database
2. **Show once** - Only display token at creation time
3. **Scope permissions** - Limit what each token can do
4. **Set expiration** - Tokens should expire
5. **Allow revocation** - Users should be able to delete tokens
