# Express to Verb Migration Guide

This guide provides step-by-step migration from Express.js to Verb with side-by-side code comparisons.

## Basic Server Setup

### Express
```javascript
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Verb
```typescript
import { server } from 'verb';

const app = server.http();

app.listen(3000);
console.log('Server running on port 3000');
```

## Basic Routes

### Express
```javascript
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

app.post('/users', (req, res) => {
  const user = req.body;
  res.status(201).json(user);
});

app.get('/users/:id', (req, res) => {
  const id = req.params.id;
  res.json({ id, name: 'User' });
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

## Middleware

### Express
```javascript
// Global middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Route-specific middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.get('/protected', authMiddleware, (req, res) => {
  res.json({ message: 'Protected data' });
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

### Express
```javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.get('/error', (req, res, next) => {
  try {
    throw new Error('Something went wrong');
  } catch (error) {
    next(error);
  }
});
```

### Verb
```typescript
app.use((error, req, res, next) => {
  console.error(error.stack);
  return res.status(500).json({ error: 'Internal Server Error' });
});

app.get('/error', (req, res) => {
  throw new Error('Something went wrong'); // Auto-caught
});
```

## Static Files

### Express
```javascript
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
```

### Verb
```typescript
app.static('/public', './public');
app.static('/uploads', './uploads');
```

## File Uploads

### Express (with multer)
```javascript
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ file: req.file });
});
```

### Verb
```typescript
app.post('/upload', async (req, res) => {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  
  await Bun.write(`uploads/${file.name}`, file);
  return res.json({ file: { name: file.name, size: file.size } });
});
```

## Database Integration

### Express (with connection pooling)
```javascript
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Verb
```typescript
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get('/users', async (req, res) => {
  const result = await pool.query('SELECT * FROM users');
  return res.json(result.rows);
});
```

## Environment Configuration

### Express
```javascript
require('dotenv').config();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
  console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
});
```

### Verb
```typescript
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
  console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
});
```

## WebSocket Support

### Express (with socket.io)
```javascript
const { Server } = require('socket.io');
const http = require('http');

const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
  socket.on('message', (data) => {
    io.emit('message', data);
  });
});

server.listen(3000);
```

### Verb (built-in WebSocket)
```typescript
app.websocket('/chat', {
  message: (ws, data) => {
    ws.publish('chat', data);
  },
  open: (ws) => {
    ws.subscribe('chat');
  }
});
```

## Migration Strategy

### 1. Gradual Migration
```typescript
// Start with a single route
app.get('/api/new-endpoint', verbHandler);

// Gradually migrate existing routes
app.get('/api/users', migratedUserHandler);
```

### 2. Middleware Compatibility
```typescript
// Wrap Express middleware for Verb
function wrapExpressMiddleware(expressMiddleware) {
  return (req, res, next) => {
    const expressReq = { ...req, body: undefined };
    const expressRes = {
      json: (data) => res.json(data),
      status: (code) => ({ json: (data) => res.status(code).json(data) })
    };
    return expressMiddleware(expressReq, expressRes, next);
  };
}
```

### 3. Testing Migration
```typescript
// Test both Express and Verb endpoints
describe('Migration', () => {
  test('Express endpoint', async () => {
    const response = await request(expressApp).get('/users');
    expect(response.status).toBe(200);
  });

  test('Verb endpoint', async () => {
    const response = await fetch('http://localhost:3000/users');
    expect(response.status).toBe(200);
  });
});
```

## Performance Benefits

- **21-24% faster** than Express in benchmarks
- **Built-in async/await** support without callback hell
- **Multi-protocol support** (HTTP, WebSocket, UDP, TCP)
- **Zero dependencies** for core functionality
- **Bun runtime optimizations**

## Common Pitfalls

1. **Remember to return** from route handlers
2. **Use await** for async operations like `req.json()`
3. **Headers are Map objects**, use `.get()` and `.set()`
4. **FormData handling** is built-in, no need for multer
5. **Error handling** is automatic, no need for try/catch in routes