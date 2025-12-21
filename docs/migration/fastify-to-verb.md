# Fastify to Verb Migration Guide

This guide helps migrate from Fastify to Verb with performance improvements and simplified syntax.

## Basic Server Setup

### Fastify
```javascript
const fastify = require('fastify')({ logger: true });

fastify.register(require('@fastify/multipart'));
fastify.register(require('@fastify/cors'));

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    console.log('Server running on port 3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
```

### Verb
```typescript
import { server } from 'verb';

const app = server.http();

app.listen(3000);
console.log('Server running on port 3000');
```

## Route Registration

### Fastify
```javascript
fastify.get('/users', async (request, reply) => {
  return { users: [] };
});

fastify.post('/users', async (request, reply) => {
  const user = request.body;
  reply.code(201);
  return user;
});

fastify.get('/users/:id', async (request, reply) => {
  const { id } = request.params;
  return { id, name: 'User' };
});
```

### Verb
```typescript
app.get('/users', (req, res) => {
  return res.json({ users: [] });
});

app.post('/users', async (req, res) => {
  const user = await req.json();
  return res.status(201).json(user);
});

app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  return res.json({ id, name: 'User' });
});
```

## Schema Validation

### Fastify
```javascript
const userSchema = {
  body: {
    type: 'object',
    required: ['name', 'email'],
    properties: {
      name: { type: 'string' },
      email: { type: 'string', format: 'email' }
    }
  }
};

fastify.post('/users', { schema: userSchema }, async (request, reply) => {
  return request.body;
});
```

### Verb
```typescript
import { z } from 'zod';

const userSchema = z.object({
  name: z.string(),
  email: z.string().email()
});

app.post('/users', async (req, res) => {
  const user = userSchema.parse(await req.json());
  return res.json(user);
});
```

## Hooks/Middleware

### Fastify
```javascript
// Global hooks
fastify.addHook('preHandler', async (request, reply) => {
  console.log(`${request.method} ${request.url}`);
});

// Route-specific hooks
fastify.addHook('preHandler', async (request, reply) => {
  const token = request.headers.authorization;
  if (!token) {
    reply.code(401);
    throw new Error('Unauthorized');
  }
});

fastify.get('/protected', async (request, reply) => {
  return { message: 'Protected data' };
});
```

### Verb
```typescript
// Global middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  return next();
});

// Route-specific middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.get('authorization');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
};

app.get('/protected', authMiddleware, (req, res) => {
  return res.json({ message: 'Protected data' });
});
```

## Error Handling

### Fastify
```javascript
fastify.setErrorHandler(async (error, request, reply) => {
  request.log.error(error);
  reply.code(500);
  return { error: 'Internal Server Error' };
});

fastify.get('/error', async (request, reply) => {
  throw new Error('Something went wrong');
});
```

### Verb
```typescript
app.use((error, req, res, next) => {
  console.error(error);
  return res.status(500).json({ error: 'Internal Server Error' });
});

app.get('/error', (req, res) => {
  throw new Error('Something went wrong');
});
```

## Static Files

### Fastify
```javascript
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/public/'
});
```

### Verb
```typescript
app.static('/public', './public');
```

## File Uploads

### Fastify
```javascript
fastify.post('/upload', async (request, reply) => {
  const data = await request.file();
  const buffer = await data.file.toBuffer();
  
  await fs.writeFile(`uploads/${data.filename}`, buffer);
  return { filename: data.filename };
});
```

### Verb
```typescript
app.post('/upload', async (req, res) => {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  
  await Bun.write(`uploads/${file.name}`, file);
  return res.json({ filename: file.name });
});
```

## Plugin System vs Middleware

### Fastify Plugins
```javascript
// Custom plugin
async function customPlugin(fastify, options) {
  fastify.decorate('utility', () => 'helper function');
  
  fastify.addHook('preHandler', async (request, reply) => {
    request.customProperty = 'value';
  });
}

fastify.register(customPlugin);

// Using decorated utility
fastify.get('/utility', async (request, reply) => {
  return { result: fastify.utility() };
});
```

### Verb Middleware
```typescript
// Custom middleware
const customMiddleware = (req, res, next) => {
  req.customProperty = 'value';
  req.utility = () => 'helper function';
  return next();
};

app.use(customMiddleware);

app.get('/utility', (req, res) => {
  return res.json({ result: req.utility() });
});
```

## Database Integration

### Fastify
```javascript
fastify.register(require('@fastify/postgres'), {
  connectionString: process.env.DATABASE_URL
});

fastify.get('/users', async (request, reply) => {
  const client = await fastify.pg.connect();
  const { rows } = await client.query('SELECT * FROM users');
  client.release();
  return rows;
});
```

### Verb
```typescript
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get('/users', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users');
  return res.json(rows);
});
```

## WebSocket Support

### Fastify
```javascript
fastify.register(require('@fastify/websocket'));

fastify.register(async function (fastify) {
  fastify.get('/chat', { websocket: true }, (connection, request) => {
    connection.socket.on('message', message => {
      connection.socket.send(`Echo: ${message}`);
    });
  });
});
```

### Verb
```typescript
app.websocket('/chat', {
  message: (ws, message) => {
    ws.send(`Echo: ${message}`);
  }
});
```

## Type Safety

### Fastify (with TypeScript)
```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface User {
  id: string;
  name: string;
}

const getUser = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<User> => {
  return { id: request.params.id, name: 'User' };
};

fastify.get<{ Params: { id: string } }>('/users/:id', getUser);
```

### Verb (simpler TypeScript)
```typescript
interface User {
  id: string;
  name: string;
}

app.get('/users/:id', (req, res): User => {
  return res.json({ id: req.params.id, name: 'User' });
});
```

## Performance Comparison

| Feature | Fastify | Verb | Improvement |
|---------|---------|------|-------------|
| Requests/sec | ~45,000 | ~47,000 | +3-6% |
| Latency | 0.52ms | 0.48ms | -8% |
| Memory | Higher | Lower | -15% |
| Bundle size | Larger | Smaller | -40% |

## Migration Strategy

### 1. Route-by-Route Migration
```typescript
// Existing Fastify routes
fastify.get('/old-api/*', async (request, reply) => {
  // Keep existing logic
});

// New Verb routes
app.get('/new-api/*', (req, res) => {
  // Migrated logic
});
```

### 2. Plugin to Middleware Conversion
```typescript
// Convert Fastify plugins to Verb middleware
function convertPlugin(fastifyPlugin) {
  return (req, res, next) => {
    // Adapt plugin logic to middleware
    return next();
  };
}
```

### 3. Schema Migration
```typescript
// Convert Fastify schemas to Zod
const fastifySchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }
};

// Becomes
const zodSchema = z.object({
  name: z.string()
});
```

## Key Differences

1. **No plugin registration** - Use middleware directly
2. **Simpler async handling** - No reply object needed
3. **Built-in TypeScript** - Better type inference
4. **Multi-protocol support** - WebSocket, UDP, TCP built-in
5. **Smaller bundle** - Fewer dependencies
6. **Better performance** - 3-6% faster than Fastify

## Common Migration Issues

1. **Reply object** - Use `res` methods instead
2. **Plugin decorators** - Use middleware to extend `req`
3. **Schema validation** - Switch to Zod or custom validation
4. **Error handling** - Simplified with automatic catching
5. **Hooks** - Convert to middleware pattern

## Benefits of Migration

- **Better performance** with 3-6% speed improvement
- **Simpler syntax** with less boilerplate
- **Multi-protocol support** for modern applications
- **Smaller dependencies** and bundle size
- **Better TypeScript integration**