# Error Handling Best Practices

Comprehensive guide to robust error handling patterns in Verb applications across all protocols.

## HTTP Error Handling

### Automatic Error Catching
Verb automatically catches errors in route handlers, eliminating the need for try/catch blocks:

```typescript
// ❌ Don't do this (unnecessary)
app.get('/users/:id', async (req, res) => {
  try {
    const user = await userService.getById(req.params.id);
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ✅ Do this (Verb handles errors automatically)
app.get('/users/:id', async (req, res) => {
  const user = await userService.getById(req.params.id);
  return res.json(user);
});
```

### Global Error Handler
Implement a global error handler for consistent error responses:

```typescript
app.use((error, req, res, next) => {
  // Log error details
  console.error('Error caught:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle different error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: error.details
    });
  }

  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication'
    });
  }

  if (error.code === 'ENOTFOUND' || error.name === 'NotFoundError') {
    return res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found'
    });
  }

  // Default server error
  return res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});
```

### Custom Error Classes
Create specific error types for better error handling:

```typescript
class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class ValidationError extends AppError {
  constructor(message: string, public details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

// Usage in services
const userService = {
  async getById(id: string) {
    if (!id) {
      throw new ValidationError('User ID is required');
    }

    const user = await db.users.findById(id);
    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }
};
```

### Request Validation
Implement robust request validation:

```typescript
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  age: z.number().min(18, 'Must be 18 or older').optional()
});

app.post('/users', async (req, res) => {
  // Validate request body
  const validationResult = createUserSchema.safeParse(await req.json());
  
  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation Error',
      details: validationResult.error.issues
    });
  }

  const user = await userService.create(validationResult.data);
  return res.status(201).json(user);
});

// Or create reusable validation middleware
const validate = (schema: z.ZodSchema) => async (req, res, next) => {
  try {
    const body = await req.json();
    const validated = schema.parse(body);
    req.validatedBody = validated;
    return next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.issues
      });
    }
    throw error;
  }
};

app.post('/users', validate(createUserSchema), async (req, res) => {
  const user = await userService.create(req.validatedBody);
  return res.status(201).json(user);
});
```

### Rate Limiting Errors
Handle rate limiting gracefully:

```typescript
const rateLimitMiddleware = (maxRequests: number, windowMs: number) => {
  const requests = new Map();

  return (req, res, next) => {
    const clientId = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    if (requests.has(clientId)) {
      const clientRequests = requests.get(clientId).filter(time => time > windowStart);
      requests.set(clientId, clientRequests);
    } else {
      requests.set(clientId, []);
    }

    const clientRequests = requests.get(clientId);

    if (clientRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: `Too many requests. Limit: ${maxRequests} per ${windowMs}ms`,
        retryAfter: Math.ceil((clientRequests[0] + windowMs - now) / 1000)
      });
    }

    clientRequests.push(now);
    requests.set(clientId, clientRequests);

    // Add rate limit headers
    res.headers.set('X-RateLimit-Limit', maxRequests.toString());
    res.headers.set('X-RateLimit-Remaining', (maxRequests - clientRequests.length).toString());
    res.headers.set('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

    return next();
  };
};

app.use('/api/', rateLimitMiddleware(100, 60000)); // 100 requests per minute
```

## WebSocket Error Handling

### Connection Error Handling
```typescript
app.websocket('/ws/chat', {
  open: (ws) => {
    try {
      ws.subscribe('chat');
      console.log('WebSocket connection established');
    } catch (error) {
      console.error('WebSocket open error:', error);
      ws.close(1011, 'Server error during connection setup');
    }
  },

  message: (ws, message) => {
    try {
      const data = JSON.parse(message);
      
      // Validate message structure
      if (!data.type || !data.payload) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format. Expected: { type, payload }'
        }));
        return;
      }

      // Handle different message types
      switch (data.type) {
        case 'chat':
          ws.publish('chat', message);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${data.type}`
          }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message',
        code: 'MESSAGE_PROCESSING_ERROR'
      }));
    }
  },

  close: (ws, code, reason) => {
    console.log(`WebSocket closed: ${code} ${reason}`);
    // Cleanup any resources associated with this connection
  },

  error: (ws, error) => {
    console.error('WebSocket error:', error);
    // Log error and optionally close connection
    ws.close(1011, 'Server error');
  }
});
```

### WebSocket Client Error Simulation
```typescript
// Client-side error handling example
app.get('/ws-test', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><title>WebSocket Error Handling Test</title></head>
    <body>
      <script>
        const ws = new WebSocket('ws://localhost:3000/ws/chat');
        
        ws.onopen = () => {
          console.log('Connected');
          
          // Test various error scenarios
          setTimeout(() => {
            // Invalid JSON
            ws.send('invalid json');
          }, 1000);
          
          setTimeout(() => {
            // Missing required fields
            ws.send(JSON.stringify({ type: 'incomplete' }));
          }, 2000);
          
          setTimeout(() => {
            // Unknown message type
            ws.send(JSON.stringify({ type: 'unknown', payload: {} }));
          }, 3000);
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'error') {
            console.error('Server error:', data.message);
          } else {
            console.log('Received:', data);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
        
        ws.onclose = (event) => {
          console.log('Connection closed:', event.code, event.reason);
        };
      </script>
    </body>
    </html>
  `;
  
  res.headers.set('Content-Type', 'text/html');
  return res.text(html);
});
```

## UDP Error Handling

### UDP Server Error Handling
```typescript
app.udp(8080, {
  message: (buffer, rinfo) => {
    try {
      // Validate buffer size
      if (buffer.length > 1024) {
        console.warn('UDP message too large:', buffer.length);
        return;
      }

      // Validate source
      if (!rinfo.address || !rinfo.port) {
        console.error('Invalid UDP source info:', rinfo);
        return;
      }

      const message = buffer.toString();
      console.log(`UDP message from ${rinfo.address}:${rinfo.port}: ${message}`);

      // Process message
      let response;
      try {
        const data = JSON.parse(message);
        response = JSON.stringify({ 
          status: 'received', 
          echo: data,
          timestamp: Date.now()
        });
      } catch (parseError) {
        response = JSON.stringify({
          status: 'error',
          message: 'Invalid JSON format',
          received: message
        });
      }

      // Send response
      app.udpSend(Buffer.from(response), rinfo.port, rinfo.address);

    } catch (error) {
      console.error('UDP message handling error:', error);
    }
  },

  error: (error) => {
    console.error('UDP server error:', error);
    
    // Handle specific UDP errors
    if (error.code === 'EADDRINUSE') {
      console.error('UDP port already in use');
      process.exit(1);
    }
    
    if (error.code === 'EACCES') {
      console.error('Permission denied for UDP port');
      process.exit(1);
    }
  },

  listening: () => {
    console.log('UDP server listening on port 8080');
  }
});
```

## TCP Error Handling

### TCP Server Error Handling
```typescript
app.tcp(9090, {
  connection: (socket) => {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log('TCP connection from:', clientId);

    // Set socket timeout
    socket.setTimeout(30000); // 30 seconds

    socket.on('data', (data) => {
      try {
        const message = data.toString().trim();
        
        // Validate message length
        if (message.length > 1024) {
          socket.write('ERROR: Message too long\n');
          return;
        }

        // Process command
        if (message.startsWith('PING')) {
          socket.write('PONG\n');
        } else if (message.startsWith('ECHO ')) {
          socket.write(`ECHO: ${message.substring(5)}\n`);
        } else {
          socket.write('ERROR: Unknown command\n');
        }

      } catch (error) {
        console.error('TCP data processing error:', error);
        socket.write('ERROR: Processing failed\n');
      }
    });

    socket.on('timeout', () => {
      console.log('TCP socket timeout:', clientId);
      socket.write('ERROR: Connection timeout\n');
      socket.destroy();
    });

    socket.on('error', (error) => {
      console.error('TCP socket error:', clientId, error);
      
      // Handle specific TCP errors
      if (error.code === 'ECONNRESET') {
        console.log('TCP connection reset by client:', clientId);
      } else if (error.code === 'EPIPE') {
        console.log('TCP broken pipe:', clientId);
      }
    });

    socket.on('end', () => {
      console.log('TCP connection ended:', clientId);
    });

    socket.on('close', (hadError) => {
      console.log('TCP connection closed:', clientId, hadError ? 'with error' : 'cleanly');
    });
  },

  error: (error) => {
    console.error('TCP server error:', error);
    
    if (error.code === 'EADDRINUSE') {
      console.error('TCP port already in use');
      process.exit(1);
    }
  },

  listening: () => {
    console.log('TCP server listening on port 9090');
  }
});
```

## Database Error Handling

### Connection Error Handling
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

// Database service with error handling
const dbService = {
  async query(text: string, params?: any[]) {
    const client = await pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } catch (error) {
      console.error('Database query error:', { text, params, error });
      
      // Handle specific database errors
      if (error.code === '23505') { // Unique violation
        throw new AppError('Resource already exists', 409, 'DUPLICATE_ENTRY');
      }
      
      if (error.code === '23503') { // Foreign key violation
        throw new AppError('Referenced resource not found', 400, 'INVALID_REFERENCE');
      }
      
      if (error.code === '42P01') { // Table doesn't exist
        throw new AppError('Database schema error', 500, 'SCHEMA_ERROR');
      }
      
      throw new AppError('Database operation failed', 500, 'DATABASE_ERROR');
    } finally {
      client.release();
    }
  }
};
```

## File Upload Error Handling

### Secure File Upload with Validation
```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

app.post('/upload', async (req, res) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return res.status(400).json({
        error: 'No file uploaded',
        code: 'MISSING_FILE'
      });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return res.status(400).json({
        error: 'Invalid file type',
        code: 'INVALID_TYPE',
        allowed: ALLOWED_TYPES
      });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        maxSize: MAX_FILE_SIZE,
        receivedSize: file.size
      });
    }

    // Validate filename
    const filename = file.name;
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return res.status(400).json({
        error: 'Invalid filename',
        code: 'INVALID_FILENAME'
      });
    }

    // Save file
    const safeName = `${Date.now()}-${filename}`;
    const filePath = `uploads/${safeName}`;
    
    await Bun.write(filePath, file);

    return res.json({
      message: 'File uploaded successfully',
      filename: safeName,
      size: file.size,
      type: file.type
    });

  } catch (error) {
    console.error('File upload error:', error);
    
    if (error.code === 'ENOSPC') {
      return res.status(507).json({
        error: 'Insufficient storage space',
        code: 'STORAGE_FULL'
      });
    }
    
    return res.status(500).json({
      error: 'Upload failed',
      code: 'UPLOAD_ERROR'
    });
  }
});
```

## Graceful Shutdown

### Process Signal Handling
```typescript
const app = server.http();

// Track active connections for graceful shutdown
const activeConnections = new Set();

app.use((req, res, next) => {
  activeConnections.add(req);
  res.on('finish', () => activeConnections.delete(req));
  return next();
});

const server = app.listen(3000, () => {
  console.log('Server running on port 3000');
});

// Graceful shutdown handler
const gracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP server closed');
    
    // Wait for active connections to finish
    const checkConnections = () => {
      if (activeConnections.size === 0) {
        console.log('All connections closed. Exiting...');
        process.exit(0);
      } else {
        console.log(`Waiting for ${activeConnections.size} connections to close...`);
        setTimeout(checkConnections, 1000);
      }
    };
    
    checkConnections();
    
    // Force exit after timeout
    setTimeout(() => {
      console.log('Force closing remaining connections');
      process.exit(1);
    }, 10000);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});
```

This comprehensive error handling guide ensures robust and reliable Verb applications across all protocols and scenarios.