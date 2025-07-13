# Comprehensive API Reference

Complete reference for all Verb framework APIs with real-world usage examples.

## Core Application

### `new Verb(options?)`

Creates a new Verb application instance.

```typescript
import { Verb } from 'verb';

// Basic app
const app = new Verb();

// With options
const app = new Verb({
  maxConnections: 1000,
  timeout: 30000,
  enableCompression: true
});
```

**Options:**
- `maxConnections?: number` - Maximum concurrent connections (default: unlimited)
- `timeout?: number` - Request timeout in milliseconds (default: 30000)
- `enableCompression?: boolean` - Enable gzip compression (default: true)

### `app.listen(port, callback?)`

Starts the server on specified port.

```typescript
// Basic listen
app.listen(3000);

// With callback
app.listen(3000, () => {
  console.log('Server running on port 3000');
});

// Environment-based port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Multiple servers
const httpServer = app.listen(3000);
const httpsServer = app.listen(443, { https: true });
```

## HTTP Routes

### `app.get(path, ...handlers)`

Registers GET route handler.

```typescript
// Simple route
app.get('/', (req, res) => {
  return res.json({ message: 'Hello World' });
});

// Route with parameters
app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  return res.json({ userId: id });
});

// Multiple parameters
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params;
  return res.json({ userId, postId });
});

// Query parameters
app.get('/search', (req, res) => {
  const { q, limit = 10, offset = 0 } = req.query;
  return res.json({ query: q, limit, offset });
});

// With middleware
app.get('/protected', authMiddleware, (req, res) => {
  return res.json({ user: req.user });
});

// Async handler
app.get('/users', async (req, res) => {
  const users = await userService.getAll();
  return res.json(users);
});

// Pattern matching
app.get('/files/*', (req, res) => {
  const filePath = req.params['*'];
  return res.json({ path: filePath });
});

// Optional parameters
app.get('/posts/:id?', (req, res) => {
  const { id } = req.params;
  if (id) {
    return res.json({ post: id });
  }
  return res.json({ posts: 'all' });
});
```

### `app.post(path, ...handlers)`

Registers POST route handler.

```typescript
// JSON body
app.post('/users', async (req, res) => {
  const userData = await req.json();
  const user = await userService.create(userData);
  return res.status(201).json(user);
});

// Form data
app.post('/contact', async (req, res) => {
  const formData = await req.formData();
  const name = formData.get('name');
  const email = formData.get('email');
  
  await emailService.send({ name, email });
  return res.json({ success: true });
});

// Text body
app.post('/webhook', async (req, res) => {
  const payload = await req.text();
  console.log('Webhook payload:', payload);
  return res.status(200).send('OK');
});

// Buffer/Binary data
app.post('/upload-binary', async (req, res) => {
  const buffer = await req.arrayBuffer();
  await fs.writeFile('upload.bin', Buffer.from(buffer));
  return res.json({ size: buffer.byteLength });
});

// Content-Type handling
app.post('/flexible', async (req, res) => {
  const contentType = req.headers.get('content-type') || '';
  
  let data;
  if (contentType.includes('application/json')) {
    data = await req.json();
  } else if (contentType.includes('multipart/form-data')) {
    data = await req.formData();
  } else if (contentType.includes('text/')) {
    data = await req.text();
  } else {
    data = await req.arrayBuffer();
  }
  
  return res.json({ received: data, type: contentType });
});
```

### `app.put(path, ...handlers)`, `app.delete(path, ...handlers)`, `app.patch(path, ...handlers)`

Similar to POST with different HTTP methods.

```typescript
// PUT - Update resource
app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const updates = await req.json();
  const user = await userService.update(id, updates);
  return res.json(user);
});

// DELETE - Remove resource
app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  await userService.delete(id);
  return res.status(204).send();
});

// PATCH - Partial update
app.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const patches = await req.json();
  const user = await userService.patch(id, patches);
  return res.json(user);
});
```

## Request Object

### Properties

```typescript
app.get('/debug', (req, res) => {
  return res.json({
    method: req.method,        // HTTP method
    url: req.url,             // Full URL
    path: req.path,           // Path only
    query: req.query,         // Query parameters object
    params: req.params,       // Route parameters object
    headers: req.headers,     // Headers Map object
    ip: req.ip,              // Client IP address
    protocol: req.protocol,   // http or https
    host: req.host           // Host header
  });
});
```

### Methods

```typescript
app.post('/request-methods', async (req, res) => {
  // Parse JSON body
  const jsonData = await req.json();
  
  // Get raw text
  const textData = await req.text();
  
  // Parse form data
  const formData = await req.formData();
  const file = formData.get('file') as File;
  
  // Get binary data
  const buffer = await req.arrayBuffer();
  
  // Get specific header
  const authHeader = req.headers.get('authorization');
  const userAgent = req.headers.get('user-agent');
  
  // Check if header exists
  const hasAuth = req.headers.has('authorization');
  
  return res.json({ success: true });
});
```

### Custom Properties

```typescript
// Middleware can add custom properties
const authMiddleware = async (req, res, next) => {
  const token = req.headers.get('authorization');
  if (token) {
    req.user = await authenticateToken(token);
    req.isAuthenticated = true;
  }
  return next();
};

app.get('/profile', authMiddleware, (req, res) => {
  if (req.isAuthenticated) {
    return res.json({ user: req.user });
  }
  return res.status(401).json({ error: 'Unauthorized' });
});
```

## Response Object

### Methods

```typescript
app.get('/response-methods', (req, res) => {
  // JSON response
  res.json({ data: 'value' });
  
  // Text response
  res.text('Plain text response');
  
  // HTML response
  res.html('<h1>Hello HTML</h1>');
  
  // Set status code
  res.status(201).json({ created: true });
  
  // Send file
  res.file('./public/image.jpg');
  
  // Redirect
  res.redirect('/new-location');
  res.redirect(301, '/permanent-redirect');
  
  // Set headers
  res.headers.set('X-Custom-Header', 'value');
  res.headers.set('Cache-Control', 'no-cache');
  
  // Set cookies
  res.cookie('sessionId', 'abc123', {
    httpOnly: true,
    secure: true,
    maxAge: 3600000
  });
  
  // Send empty response
  res.send();
  
  // Stream response
  res.stream(readableStream);
});
```

### Response Examples

```typescript
// API responses
app.get('/api/users', async (req, res) => {
  const users = await userService.getAll();
  return res.json({
    data: users,
    count: users.length,
    timestamp: new Date().toISOString()
  });
});

// Error responses
app.get('/api/users/:id', async (req, res) => {
  const user = await userService.getById(req.params.id);
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      code: 'USER_NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  }
  return res.json(user);
});

// File download
app.get('/download/:filename', (req, res) => {
  const { filename } = req.params;
  res.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.headers.set('Content-Type', 'application/octet-stream');
  return res.file(`./files/${filename}`);
});

// Custom headers
app.get('/api/data', (req, res) => {
  res.headers.set('X-API-Version', '1.0');
  res.headers.set('X-Rate-Limit', '1000');
  res.headers.set('Access-Control-Allow-Origin', '*');
  
  return res.json({ data: 'response' });
});
```

## Middleware

### `app.use(middleware)`

Registers global middleware.

```typescript
// Simple middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  return next();
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  return res.status(500).json({ error: 'Internal Server Error' });
});

// Async middleware
app.use(async (req, res, next) => {
  req.requestId = crypto.randomUUID();
  req.startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    console.log(`Request ${req.requestId} completed in ${duration}ms`);
  });
  
  return next();
});

// Conditional middleware
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    req.isApiRequest = true;
  }
  return next();
});
```

### Route-specific Middleware

```typescript
// Authentication middleware
const authMiddleware = async (req, res, next) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const user = await jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Rate limiting middleware
const rateLimitMiddleware = (maxRequests, windowMs) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const clientId = req.ip;
    const now = Date.now();
    
    if (!requests.has(clientId)) {
      requests.set(clientId, []);
    }
    
    const clientRequests = requests.get(clientId);
    const windowStart = now - windowMs;
    
    // Remove old requests
    const validRequests = clientRequests.filter(time => time > windowStart);
    requests.set(clientId, validRequests);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
      });
    }
    
    validRequests.push(now);
    return next();
  };
};

// Usage
app.get('/protected', authMiddleware, (req, res) => {
  return res.json({ user: req.user });
});

app.use('/api/', rateLimitMiddleware(100, 60000)); // 100 requests per minute
```

## WebSocket API

### `app.websocket(path, handlers)`

Creates WebSocket endpoint.

```typescript
// Basic WebSocket
app.websocket('/ws', {
  open: (ws) => {
    console.log('WebSocket connection opened');
    ws.send('Welcome!');
  },
  
  message: (ws, message) => {
    console.log('Received:', message);
    ws.send(`Echo: ${message}`);
  },
  
  close: (ws, code, reason) => {
    console.log('WebSocket closed:', code, reason);
  },
  
  error: (ws, error) => {
    console.error('WebSocket error:', error);
  }
});

// Chat room example
const rooms = new Map();

app.websocket('/ws/chat/:room', {
  open: (ws) => {
    const room = ws.params.room;
    
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }
    
    rooms.get(room).add(ws);
    ws.room = room;
    
    // Notify room of new user
    const roomMembers = rooms.get(room);
    for (const member of roomMembers) {
      if (member !== ws) {
        member.send(JSON.stringify({
          type: 'user_joined',
          room,
          count: roomMembers.size
        }));
      }
    }
  },
  
  message: (ws, message) => {
    try {
      const data = JSON.parse(message);
      const room = ws.room;
      
      // Broadcast to all room members
      const roomMembers = rooms.get(room);
      if (roomMembers) {
        const broadcastData = JSON.stringify({
          type: 'message',
          room,
          data: data.message,
          timestamp: Date.now()
        });
        
        for (const member of roomMembers) {
          member.send(broadcastData);
        }
      }
    } catch (error) {
      ws.send(JSON.stringify({ error: 'Invalid message format' }));
    }
  },
  
  close: (ws) => {
    const room = ws.room;
    if (rooms.has(room)) {
      rooms.get(room).delete(ws);
      
      // Clean up empty rooms
      if (rooms.get(room).size === 0) {
        rooms.delete(room);
      } else {
        // Notify remaining members
        const roomMembers = rooms.get(room);
        for (const member of roomMembers) {
          member.send(JSON.stringify({
            type: 'user_left',
            room,
            count: roomMembers.size
          }));
        }
      }
    }
  }
});
```

### WebSocket Methods

```typescript
app.websocket('/ws/methods', {
  open: (ws) => {
    // Send message
    ws.send('Hello');
    ws.send(JSON.stringify({ type: 'welcome' }));
    
    // Subscribe to topic
    ws.subscribe('notifications');
    ws.subscribe('chat');
    
    // Set custom properties
    ws.userId = 'user123';
    ws.connectionTime = Date.now();
  },
  
  message: (ws, message) => {
    // Publish to topic
    ws.publish('chat', message);
    
    // Publish to specific subscribers
    ws.publishTo(['user1', 'user2'], message);
    
    // Unsubscribe from topic
    ws.unsubscribe('notifications');
    
    // Close connection
    if (message === 'close') {
      ws.close(1000, 'Normal closure');
    }
  }
});
```

## Static Files

### `app.static(route, directory, options?)`

Serves static files.

```typescript
// Basic static serving
app.static('/public', './public');

// Multiple static directories
app.static('/assets', './assets');
app.static('/uploads', './uploads');

// With options
app.static('/files', './files', {
  maxAge: 3600000, // 1 hour cache
  dotfiles: 'deny', // Deny access to dotfiles
  index: 'index.html' // Default file
});

// Custom static handler
app.get('/download/*', (req, res) => {
  const filePath = req.params['*'];
  const fullPath = path.join('./downloads', filePath);
  
  // Security check
  if (!fullPath.startsWith('./downloads')) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Set download headers
  res.headers.set('Content-Disposition', 'attachment');
  return res.file(fullPath);
});
```

## UDP/TCP APIs

### UDP Server

```typescript
app.udp(8080, {
  message: (buffer, rinfo) => {
    console.log('UDP message:', buffer.toString(), 'from', rinfo);
    
    // Echo back
    const response = `Echo: ${buffer.toString()}`;
    app.udpSend(Buffer.from(response), rinfo.port, rinfo.address);
  },
  
  error: (error) => {
    console.error('UDP error:', error);
  },
  
  listening: () => {
    console.log('UDP server listening on port 8080');
  }
});

// UDP client
app.udpSend(Buffer.from('Hello UDP'), 8081, 'localhost');
```

### TCP Server

```typescript
app.tcp(9090, {
  connection: (socket) => {
    console.log('TCP connection from:', socket.remoteAddress);
    
    socket.write('Welcome to TCP server\n');
    
    socket.on('data', (data) => {
      console.log('TCP data:', data.toString());
      socket.write(`Echo: ${data}`);
    });
    
    socket.on('end', () => {
      console.log('TCP connection ended');
    });
    
    socket.on('error', (error) => {
      console.error('TCP socket error:', error);
    });
  },
  
  error: (error) => {
    console.error('TCP server error:', error);
  },
  
  listening: () => {
    console.log('TCP server listening on port 9090');
  }
});
```

## File Upload API

### Single File Upload

```typescript
app.post('/upload', async (req, res) => {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    return res.status(400).json({ error: 'No file provided' });
  }
  
  // Validate file
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return res.status(400).json({ error: 'File too large' });
  }
  
  // Save file
  const filename = `${Date.now()}-${file.name}`;
  await Bun.write(`uploads/${filename}`, file);
  
  return res.json({
    filename,
    originalName: file.name,
    size: file.size,
    type: file.type
  });
});
```

### Multiple File Upload

```typescript
app.post('/upload-multiple', async (req, res) => {
  const formData = await req.formData();
  const files = formData.getAll('files') as File[];
  
  if (files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }
  
  const uploadedFiles = [];
  
  for (const file of files) {
    const filename = `${Date.now()}-${file.name}`;
    await Bun.write(`uploads/${filename}`, file);
    
    uploadedFiles.push({
      filename,
      originalName: file.name,
      size: file.size,
      type: file.type
    });
  }
  
  return res.json({ files: uploadedFiles });
});
```

## Advanced Features

### Server-Sent Events (SSE)

```typescript
app.get('/events', (req, res) => {
  res.headers.set('Content-Type', 'text/event-stream');
  res.headers.set('Cache-Control', 'no-cache');
  res.headers.set('Connection', 'keep-alive');
  
  // Send initial event
  res.write('data: Connected to event stream\n\n');
  
  // Send periodic events
  const interval = setInterval(() => {
    const data = JSON.stringify({
      timestamp: Date.now(),
      message: 'Periodic update'
    });
    
    res.write(`data: ${data}\n\n`);
  }, 5000);
  
  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(interval);
  });
});
```

### Content Negotiation

```typescript
app.get('/data', (req, res) => {
  const accept = req.headers.get('accept') || '';
  
  const data = { message: 'Hello', timestamp: Date.now() };
  
  if (accept.includes('application/json')) {
    return res.json(data);
  } else if (accept.includes('application/xml')) {
    const xml = `<?xml version="1.0"?>
      <response>
        <message>${data.message}</message>
        <timestamp>${data.timestamp}</timestamp>
      </response>`;
    res.headers.set('Content-Type', 'application/xml');
    return res.text(xml);
  } else if (accept.includes('text/csv')) {
    const csv = `message,timestamp\n${data.message},${data.timestamp}`;
    res.headers.set('Content-Type', 'text/csv');
    return res.text(csv);
  }
  
  // Default to JSON
  return res.json(data);
});
```

### Custom Protocol Handler

```typescript
// Custom protocol for game server
app.protocol('game', 7777, {
  connection: (socket) => {
    socket.on('data', (buffer) => {
      // Parse game protocol
      const messageType = buffer.readUInt8(0);
      const playerId = buffer.readUInt32BE(1);
      
      switch (messageType) {
        case 1: // Player move
          const x = buffer.readFloatBE(5);
          const y = buffer.readFloatBE(9);
          handlePlayerMove(playerId, x, y);
          break;
        case 2: // Chat message
          const message = buffer.slice(5).toString('utf8');
          handleChatMessage(playerId, message);
          break;
      }
    });
  }
});
```

This comprehensive API reference covers all major Verb framework features with practical, real-world examples.