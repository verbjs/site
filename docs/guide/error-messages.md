# Error Messages Reference

Comprehensive guide to understanding and resolving Verb framework error messages.

## Common Error Categories

### Server Creation Errors

#### `Error: Unsupported protocol: INVALID_PROTOCOL`
**Cause:** Attempting to create a server with an invalid protocol enum value.

```typescript
// ❌ Incorrect
const server = createServer("HTTP" as any); // Invalid type

// ✅ Correct
import { createServer, ServerProtocol } from "verb";
const server = createServer(ServerProtocol.HTTP);
```

**Solution:** Use the `ServerProtocol` enum for type safety.

#### `Error: Port already in use: 3000`
**Cause:** Another process is using the specified port.

```typescript
// Check for port conflicts
const server = createServer();
try {
  await server.listen(3000);
} catch (error) {
  if (error.code === "EADDRINUSE") {
    console.log("Port 3000 is busy, trying 3001...");
    await server.listen(3001);
  }
}
```

**Solutions:**
- Use a different port
- Kill the process using the port: `lsof -ti:3000 | xargs kill`
- Use dynamic port allocation: `server.listen(0)`

### Protocol Gateway Errors

#### `Error: Cannot switch to protocol before initializing gateway`
**Cause:** Attempting to switch protocols without proper gateway setup.

```typescript
// ❌ Incorrect
const gateway = createProtocolGateway();
gateway.switchProtocol(ServerProtocol.WEBSOCKET); // Not initialized

// ✅ Correct
const gateway = createProtocolGateway();
await gateway.listen(3000); // Initialize first
gateway.switchProtocol(ServerProtocol.WEBSOCKET);
```

#### `Error: Protocol switch failed: Active connections prevent migration`
**Cause:** Trying to switch protocols while connections are active.

```typescript
// ✅ Graceful protocol switching
const gateway = createProtocolGateway();

const switchProtocolSafely = async (newProtocol: ServerProtocol) => {
  try {
    // Drain existing connections
    await gateway.gracefulShutdown(5000); // 5 second timeout
    await gateway.switchProtocol(newProtocol);
    await gateway.listen();
  } catch (error) {
    console.error("Protocol switch failed:", error.message);
  }
};
```

### Routing Errors

#### `Error: Route already exists: GET /api/users`
**Cause:** Duplicate route registration.

```typescript
// ❌ Incorrect - Duplicate routes
app.get("/api/users", handler1);
app.get("/api/users", handler2); // Error!

// ✅ Correct - Use route arrays or middleware
app.get("/api/users", [middleware1, middleware2, finalHandler]);
```

#### `Error: Invalid route pattern: /users/[id*`
**Cause:** Malformed route pattern syntax.

```typescript
// ❌ Incorrect syntax
app.get("/users/[id*", handler); // Missing closing bracket

// ✅ Correct patterns
app.get("/users/:id", handler);           // Parameter
app.get("/files/*", handler);             // Wildcard
app.get("/users/:id/posts/:postId", handler); // Multiple params
```

### WebSocket Errors

#### `Error: WebSocket upgrade failed: Invalid headers`
**Cause:** Client WebSocket upgrade request is malformed.

```typescript
// Server-side debugging
const wsServer = createServer(ServerProtocol.WEBSOCKET);

wsServer.on("upgrade", (request, socket, head) => {
  console.log("Upgrade headers:", request.headers);
  
  // Validate required headers
  if (!request.headers.upgrade?.includes("websocket")) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    return;
  }
});
```

**Client-side fix:**
```typescript
// ✅ Correct WebSocket connection
const ws = new WebSocket("ws://localhost:3000", {
  headers: {
    "Sec-WebSocket-Protocol": "echo-protocol"
  }
});
```

#### `Error: WebSocket message exceeds maximum size: 1048576 bytes`
**Cause:** WebSocket message is larger than the configured limit.

```typescript
// ✅ Configure message size limits
const wsServer = createServer(ServerProtocol.WEBSOCKET);
wsServer.configure({
  maxPayload: 16 * 1024 * 1024, // 16MB
  compression: true // Enable compression for large messages
});
```

### HTTP/2 Errors

#### `Error: HTTP/2 GOAWAY: PROTOCOL_ERROR`
**Cause:** HTTP/2 protocol violation or incompatible client.

```typescript
// ✅ HTTP/2 server with fallback
const createHttp2WithFallback = () => {
  try {
    return createServer(ServerProtocol.HTTP2);
  } catch (error) {
    console.warn("HTTP/2 not supported, falling back to HTTP/1.1");
    return createServer(ServerProtocol.HTTP);
  }
};
```

#### `Error: Cannot create HTTP/2 server: Missing TLS certificates`
**Cause:** HTTP/2 requires HTTPS in most browsers.

```typescript
// ✅ HTTP/2 with TLS
const server = createServer(ServerProtocol.HTTP2S, {
  tls: {
    cert: await Bun.file("cert.pem").text(),
    key: await Bun.file("key.pem").text()
  }
});
```

### Middleware Errors

#### `Error: Middleware must be a function, received object`
**Cause:** Incorrect middleware registration.

```typescript
// ❌ Incorrect
app.use({ cors: true }); // Object instead of function

// ✅ Correct
import { cors } from "verb/middleware";
app.use(cors({ origin: "*" }));

// Or custom middleware
app.use((req, res, next) => {
  // Middleware logic
  next();
});
```

#### `Error: Cannot call next() after response sent`
**Cause:** Calling `next()` after `res.json()` or similar response methods.

```typescript
// ❌ Incorrect
app.use((req, res, next) => {
  res.json({ status: "ok" });
  next(); // Error! Response already sent
});

// ✅ Correct
app.use((req, res, next) => {
  if (shouldRespond) {
    res.json({ status: "ok" });
    return; // Don't call next()
  }
  next(); // Only call if not responding
});
```

### Type Errors

#### `Property 'customMethod' does not exist on type 'VerbRequest'`
**Cause:** Accessing custom properties without proper typing.

```typescript
// ❌ TypeScript error
app.use((req, res, next) => {
  req.customData = "value"; // TS Error
  next();
});

// ✅ Extend the type
declare module "verb" {
  interface VerbRequest {
    customData?: string;
  }
}

app.use((req, res, next) => {
  req.customData = "value"; // ✅ Now valid
  next();
});
```

### Database Connection Errors

#### `Error: Database connection failed: Connection timeout`
**Cause:** Database server is unreachable or overloaded.

```typescript
// ✅ Robust database connection
const connectWithRetry = async (maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const db = new Database("app.db");
      await db.exec("SELECT 1"); // Test connection
      return db;
    } catch (error) {
      console.log(`Connection attempt ${i + 1} failed:`, error.message);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

## Error Handling Best Practices

### Global Error Handler

```typescript
import { createServer } from "verb";

const app = createServer();

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error("Global error:", error);
  
  // Don't send error details in production
  const isDevelopment = process.env.NODE_ENV === "development";
  
  res.status(error.status || 500).json({
    error: {
      message: error.message,
      ...(isDevelopment && { stack: error.stack }),
      timestamp: new Date().toISOString(),
      requestId: req.id
    }
  });
});
```

### Async Error Handling

```typescript
// ✅ Proper async error handling
const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

app.get("/api/users", asyncHandler(async (req, res) => {
  const users = await getUsersFromDatabase(); // May throw
  res.json(users);
}));
```

### Validation Errors

```typescript
import { z } from "zod";

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).max(120)
});

app.post("/api/users", async (req, res) => {
  try {
    const userData = userSchema.parse(req.body);
    const user = await createUser(userData);
    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors.map(err => ({
          field: err.path.join("."),
          message: err.message
        }))
      });
    }
    throw error; // Re-throw non-validation errors
  }
});
```

## Debugging Tips

### Enable Debug Logging

```bash
# Enable Verb debug logging
DEBUG=verb:* bun run dev

# Enable specific modules
DEBUG=verb:router,verb:middleware bun run dev
```

### Request Tracing

```typescript
// Add request ID for tracing
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  console.log(`[${req.id}] ${req.method} ${req.url}`);
  next();
});
```

### Performance Monitoring

```typescript
// Monitor response times
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[${req.id}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});
```

## Getting Help

If you encounter an error not covered here:

1. **Check the Console**: Error stack traces often contain helpful line numbers
2. **Enable Debug Mode**: Use `DEBUG=verb:*` for detailed logging
3. **Check Network Tab**: For client-side issues, inspect browser network requests
4. **Search Issues**: Look for similar issues on [GitHub](https://github.com/verbjs/verb/issues)
5. **Create an Issue**: Include error message, code snippet, and environment details

## Common Environment Issues

### Bun Version Conflicts

```bash
# Check Bun version
bun --version

# Update to latest
curl -fsSL https://bun.sh/install | bash

# Verify Verb compatibility
bun install verb@latest
```

### Module Resolution Errors

```typescript
// If imports fail, check your package.json
{
  "type": "module",  // Required for ES modules
  "dependencies": {
    "verb": "latest"
  }
}
```

This reference should help you quickly identify and resolve common Verb framework errors.