# Frequently Asked Questions

Common questions and answers about the Verb framework.

## General Questions

### What is Verb?

Verb is a fast, modern server framework for Bun that enables you to build servers using multiple protocols (HTTP, HTTP/2, WebSocket, gRPC, UDP, TCP) with the same intuitive API. It provides a unified interface that makes protocol switching seamless and development faster.

### Why choose Verb over Express or Fastify?

**Performance**: Verb is 3-6% faster than Fastify and 21-24% faster than Express in benchmarks, with sub-millisecond response times.

**Multi-Protocol**: Unlike Express/Fastify which focus on HTTP, Verb natively supports WebSocket, gRPC, UDP, TCP, and HTTP/2 with the same API.

**Built for Bun**: Leverages Bun's native APIs for maximum performance and modern JavaScript features.

**Type Safety**: Full TypeScript support out of the box with zero `any` types.

### Is Verb production-ready?

Yes! Verb is used in production by several companies. It includes:
- Comprehensive error handling
- Performance monitoring
- Security best practices
- Extensive testing suite
- Production deployment guides

## Installation & Setup

### Why do I need Bun? Can I use Node.js?

Verb is specifically built for Bun runtime and leverages Bun's native APIs for optimal performance. It cannot run on Node.js. However, Bun is:
- **Faster** than Node.js for most workloads
- **Compatible** with most npm packages
- **Easy to install**: `curl -fsSL https://bun.sh/install | bash`
- **Drop-in replacement** for many Node.js use cases

### How do I get started quickly?

```bash
# Create a new Verb project
bunx create-verb my-app

# Start developing
cd my-app
bun run dev
```

This creates a full-stack application with React frontend and Verb backend in 30 seconds.

### Can I use Verb with existing codebases?

Yes! Verb is designed for incremental adoption:

1. **Start with one endpoint**: Replace a single Express route
2. **Add protocols gradually**: Begin with HTTP, add WebSocket when needed
3. **Migrate progressively**: Move routes over time

See our [migration guides](/migration/) for detailed instructions.

## Development

### How do I handle errors in Verb?

Verb uses standard Express-style error handling:

```typescript
// Global error handler
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

// Async error handling
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get("/api/data", asyncHandler(async (req, res) => {
  const data = await fetchData(); // May throw
  res.json(data);
}));
```

### How do I use middleware?

Verb supports Express-compatible middleware:

```typescript
import { createServer } from "verb";
import { cors, json, rateLimit } from "verb/middleware";

const app = createServer();

// Built-in middleware
app.use(json());
app.use(cors());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Custom middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
```

### How do I handle file uploads?

```typescript
import { multipart } from "verb/middleware";

app.use(multipart({
  uploadDir: "./uploads",
  maxFileSize: 10 * 1024 * 1024 // 10MB
}));

app.post("/upload", (req, res) => {
  const files = req.files;
  res.json({ uploaded: files.length });
});
```

### How do I connect to databases?

Verb works with all popular databases. Use Bun's native drivers when available:

```typescript
// SQLite with Bun's native driver
import { Database } from "bun:sqlite";
const db = new Database("app.db");

// PostgreSQL
import postgres from "postgres";
const sql = postgres("postgresql://localhost/mydb");

// MongoDB
import { MongoClient } from "mongodb";
const client = new MongoClient("mongodb://localhost:27017");
```

## Multi-Protocol Features

### When should I use protocol switching?

Use protocol switching when you have:
- **Different performance requirements** (WebSocket for real-time, HTTP for REST)
- **Varying client capabilities** (mobile vs desktop)
- **Network condition changes** (slow networks need different protocols)
- **Mixed workloads** (file uploads, real-time chat, API calls)

### How do I switch between protocols?

```typescript
import { createProtocolGateway, ServerProtocol } from "verb";

const gateway = createProtocolGateway();

// Define routes that work across protocols
gateway.defineRoutes((app) => {
  app.get("/api/data", (req, res) => {
    res.json({ message: "Works on any protocol" });
  });
});

// Switch protocols dynamically
const switchToWebSocket = () => {
  gateway.switchProtocol(ServerProtocol.WEBSOCKET);
};

await gateway.listen(3000);
```

### Can I run multiple protocols simultaneously?

Yes! You can run different protocols on different ports:

```typescript
// HTTP API on port 3000
const httpServer = createServer(ServerProtocol.HTTP);
httpServer.get("/api/*", apiRoutes);
await httpServer.listen(3000);

// WebSocket on port 3001
const wsServer = createServer(ServerProtocol.WEBSOCKET);
wsServer.on("connection", handleWebSocket);
await wsServer.listen(3001);
```

### How do I handle WebSocket connections?

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.WEBSOCKET);

app.on("connection", (ws, req) => {
  console.log("Client connected");
  
  ws.on("message", (data) => {
    // Echo message back
    ws.send(`Echo: ${data}`);
  });
  
  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

await app.listen(3000);
```

## Performance

### How fast is Verb compared to other frameworks?

Based on comprehensive benchmarks:
- **3-6% faster** than Fastify on Bun
- **21-24% faster** than Express on Node.js
- **Sub-millisecond latency** (0.48ms average)
- **Zero errors** under load testing

### How do I optimize Verb performance?

1. **Use appropriate protocols**: WebSocket for real-time, HTTP/2 for multiplexing
2. **Enable compression**: `app.use(compression())`
3. **Implement caching**: Use Redis or in-memory caching
4. **Optimize database queries**: Use connection pooling and indexing
5. **Profile your code**: Use Bun's built-in profiler

### Can Verb handle high traffic?

Yes! Verb includes:
- **Horizontal scaling** patterns
- **Load balancing** support
- **Rate limiting** middleware
- **Connection pooling** for databases
- **Clustering** support with Bun

## Deployment

### How do I deploy Verb applications?

Verb supports all major deployment platforms:

**Docker**:
```dockerfile
FROM oven/bun:latest
COPY . .
RUN bun install
EXPOSE 3000
CMD ["bun", "start"]
```

**Railway**: `railway deploy`
**Fly.io**: `fly deploy`
**Vercel**: Works with Edge Functions

See our [deployment guide](/deployment/) for detailed instructions.

### How do I handle environment variables?

Bun automatically loads `.env` files:

```bash
# .env
DATABASE_URL=postgresql://localhost/mydb
JWT_SECRET=your-secret-key
NODE_ENV=production
```

```typescript
// Use in your app
const dbUrl = process.env.DATABASE_URL;
const secret = process.env.JWT_SECRET;
```

### How do I handle graceful shutdowns?

```typescript
const app = createServer();

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}, shutting down gracefully`);
  
  await app.close(); // Stop accepting new connections
  await database.close(); // Close database connections
  
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
```

## TypeScript

### Do I need to configure TypeScript?

No! Bun includes TypeScript support out of the box. Just use `.ts` files:

```typescript
// server.ts - works immediately
import { createServer } from "verb";

const app = createServer();
app.listen(3000);
```

### How do I add custom types?

```typescript
// types.ts
declare module "verb" {
  interface VerbRequest {
    user?: User;
    sessionId?: string;
  }
}

// Now available in middleware
app.use((req, res, next) => {
  req.user = getCurrentUser(); // ✅ Type-safe
  next();
});
```

### How do I handle request/response types?

```typescript
interface CreateUserRequest {
  name: string;
  email: string;
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

app.post("/users", (req, res) => {
  const userData: CreateUserRequest = req.body;
  const user: UserResponse = createUser(userData);
  res.json(user);
});
```

## Troubleshooting

### My imports are failing. What's wrong?

Check your `package.json`:

```json
{
  "type": "module",
  "dependencies": {
    "verb": "latest"
  }
}
```

### WebSocket connections aren't working

1. **Check the protocol**: Use `ws://` or `wss://`
2. **Verify the port**: Ensure the WebSocket server is running
3. **Check headers**: Some clients require specific headers
4. **Firewall issues**: Ensure ports are open

### Performance is slower than expected

1. **Update Bun**: `bun upgrade`
2. **Check middleware**: Remove unnecessary middleware
3. **Profile your code**: Use `bun --hot` for development
4. **Database optimization**: Add indexes and connection pooling

### TypeScript errors in development

1. **Restart TypeScript**: VS Code Command Palette → "TypeScript: Restart TS Server"
2. **Check imports**: Ensure you're importing from "verb"
3. **Update types**: `bun install @types/bun@latest`

## Migration

### How do I migrate from Express?

1. **Install Verb**: `bun add verb`
2. **Replace imports**: `import { createServer } from "verb"`
3. **Update server creation**: `const app = createServer()`
4. **Test routes**: Most Express middleware works as-is
5. **Optimize gradually**: Add multi-protocol features over time

See our [Express migration guide](/migration/express-to-verb) for step-by-step instructions.

### Can I use Express middleware?

Most Express middleware works with Verb:

```typescript
import express from "express";
import { createServer } from "verb";

const app = createServer();

// Express middleware usually works
app.use(express.json());
app.use(express.static("public"));
```

However, use Verb's native middleware when available for better performance.

## Community & Support

### Where can I get help?

- **Documentation**: [verbs.code/docs](https://verbs.code/docs)
- **GitHub Issues**: [github.com/verbjs/verb](https://github.com/verbjs/verb)
- **Discord**: Join our community server
- **Stack Overflow**: Tag questions with `verb-framework`

### How can I contribute?

1. **Report bugs**: Create GitHub issues with reproduction steps
2. **Suggest features**: Open feature requests with use cases
3. **Submit PRs**: Follow our contribution guidelines
4. **Write examples**: Share your Verb applications
5. **Improve docs**: Fix typos or add examples

### Is there a roadmap?

Yes! Check our [GitHub Projects](https://github.com/verbjs/verb/projects) for:
- Upcoming features
- Performance improvements
- Protocol additions
- Community requests

## Still Have Questions?

If your question isn't answered here:

1. **Search the docs**: Use the search function above
2. **Check GitHub issues**: Someone might have asked already
3. **Ask the community**: Join our Discord for real-time help
4. **Create an issue**: We'll add popular questions to this FAQ

---

**Can't find what you're looking for?** [Suggest an FAQ addition](https://github.com/verbjs/verb/issues/new?template=faq.md)