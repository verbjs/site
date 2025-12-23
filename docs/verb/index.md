# Verb

Verb is a fast, modern server framework built specifically for Bun runtime with multi-protocol support.

## Features

- **Bun-First** - Built exclusively for Bun runtime
- **Multi-Protocol** - HTTP, WebSocket, gRPC, TCP, UDP
- **High Performance** - Optimized for speed
- **Functional API** - Clean, composable functions
- **Type-Safe** - Full TypeScript support
- **Minimal** - No unnecessary dependencies

## Quick Example

```typescript
import { server } from "verb"

const app = server.http()

app.get("/", (req, res) => {
  res.json({ message: "Hello, World!" })
})

app.get("/users/:id", (req, res) => {
  res.json({ userId: req.params.id })
})

app.listen(3000)
```

## Installation

```bash
bun add @verb-js/verb
```

## Protocols

Verb supports multiple protocols from a unified API:

```typescript
import { server } from "verb"

// HTTP
const http = server.http()

// WebSocket
const ws = server.ws()

// gRPC
const grpc = server.grpc()

// TCP
const tcp = server.tcp()

// UDP
const udp = server.udp()
```

## Why Verb?

| Feature | Verb | Express | Fastify |
|---------|------|---------|---------|
| Runtime | Bun only | Node.js | Node.js |
| Protocols | HTTP, WS, gRPC, TCP, UDP | HTTP | HTTP |
| Style | Functional | OOP | Mixed |
| Bundle Size | Tiny | Large | Medium |

Verb is designed for developers who want maximum performance with minimal complexity.
