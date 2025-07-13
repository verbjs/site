# Troubleshooting Guide

Common issues and solutions when working with Verb framework applications.

## Installation Issues

### Bun Not Found
**Problem:** `bun: command not found`

**Solution:**
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Add to PATH (if not automatically added)
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verify installation
bun --version
```

### Permission Denied
**Problem:** `EACCES: permission denied`

**Solution:**
```bash
# Fix npm permissions (if mixing with npm)
npm config set prefix '~/.npm-global'
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc

# Or use sudo (not recommended)
sudo bun install --global verb
```

### Module Not Found
**Problem:** `Cannot find module 'verb'`

**Solution:**
```bash
# Ensure proper installation
bun add verb

# Check package.json
cat package.json | grep verb

# Clear cache and reinstall
rm -rf node_modules bun.lockb
bun install
```

## Server Startup Issues

### Port Already in Use
**Problem:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find process using port
lsof -i :3000
# or
netstat -tulpn | grep :3000

# Kill process
kill -9 <PID>

# Or use different port
app.listen(3001, () => {
  console.log('Server running on port 3001');
});
```

### Memory Allocation Error
**Problem:** `JavaScript heap out of memory`

**Solution:**
```bash
# Increase memory limit
bun --max-old-space-size=4096 src/index.ts

# Or set environment variable
export NODE_OPTIONS="--max-old-space-size=4096"
bun run start
```

### File Permission Issues
**Problem:** `EACCES: permission denied, open '/path/to/file'`

**Solution:**
```bash
# Fix file permissions
chmod 644 src/index.ts
chmod 755 uploads/

# Fix directory permissions
chmod -R 755 src/
```

## HTTP Request Issues

### Request Body Empty
**Problem:** `req.json()` returns empty object

**Diagnosis:**
```typescript
app.post('/debug', async (req, res) => {
  console.log('Content-Type:', req.headers.get('content-type'));
  console.log('Content-Length:', req.headers.get('content-length'));
  
  try {
    const text = await req.text();
    console.log('Raw body:', text);
    
    if (text) {
      const json = JSON.parse(text);
      console.log('Parsed JSON:', json);
      return res.json({ received: json });
    }
    
    return res.json({ error: 'Empty body' });
  } catch (error) {
    console.error('Body parsing error:', error);
    return res.status(400).json({ error: error.message });
  }
});
```

**Solutions:**
```typescript
// Ensure proper Content-Type header
fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ data: 'value' })
});

// Handle different content types
app.post('/flexible', async (req, res) => {
  const contentType = req.headers.get('content-type') || '';
  
  let data;
  if (contentType.includes('application/json')) {
    data = await req.json();
  } else if (contentType.includes('text/')) {
    data = await req.text();
  } else if (contentType.includes('multipart/form-data')) {
    data = await req.formData();
  } else {
    data = await req.arrayBuffer();
  }
  
  return res.json({ received: data });
});
```

### CORS Issues
**Problem:** Browser blocks requests with CORS error

**Solution:**
```typescript
// Basic CORS middleware
app.use((req, res, next) => {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  
  return next();
});

// Specific origin CORS
app.use((req, res, next) => {
  const origin = req.headers.get('origin');
  const allowedOrigins = ['http://localhost:3000', 'https://myapp.com'];
  
  if (allowedOrigins.includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
  }
  
  return next();
});
```

### Route Not Found
**Problem:** 404 errors for valid routes

**Diagnosis:**
```typescript
// Route debugging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  return next();
});

// Catch-all route to see what's being requested
app.get('*', (req, res) => {
  console.log('Unmatched route:', req.method, req.url);
  return res.status(404).json({ 
    error: 'Route not found',
    requested: req.url,
    method: req.method
  });
});
```

**Solutions:**
```typescript
// Check route order (more specific first)
app.get('/users/profile', profileHandler);  // More specific
app.get('/users/:id', userHandler);         // Less specific

// Ensure proper route parameters
app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  console.log('User ID:', id, typeof id);
  return res.json({ id });
});

// Case sensitivity
app.get('/Users', handler);  // Won't match /users
app.get('/users', handler);  // Correct
```

## WebSocket Issues

### Connection Refused
**Problem:** WebSocket connection fails with error

**Diagnosis:**
```javascript
// Client-side debugging
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('WebSocket connected');
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('WebSocket closed:', event.code, event.reason);
};
```

**Solutions:**
```typescript
// Ensure WebSocket server is running
app.websocket('/ws/test', {
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
    console.error('WebSocket server error:', error);
  }
});

// Check URL format
// ✅ Correct
const ws = new WebSocket('ws://localhost:3000/ws/test');

// ❌ Wrong
const ws = new WebSocket('http://localhost:3000/ws/test');
```

### Message Not Received
**Problem:** Messages sent but not received

**Diagnosis:**
```typescript
app.websocket('/ws/debug', {
  message: (ws, message) => {
    console.log('Server received:', message, typeof message);
    
    try {
      const parsed = JSON.parse(message);
      console.log('Parsed message:', parsed);
      ws.send(JSON.stringify({ echo: parsed }));
    } catch (error) {
      console.error('Parse error:', error);
      ws.send(JSON.stringify({ error: 'Invalid JSON' }));
    }
  }
});
```

**Solutions:**
```javascript
// Client: Ensure proper message format
ws.send(JSON.stringify({ type: 'message', data: 'hello' }));

// Client: Check connection state
if (ws.readyState === WebSocket.OPEN) {
  ws.send(message);
} else {
  console.log('WebSocket not ready, state:', ws.readyState);
}

// Client: Handle all events
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    console.log('Received:', data);
  } catch (error) {
    console.log('Non-JSON message:', event.data);
  }
};
```

## File Upload Issues

### Large File Upload Fails
**Problem:** Upload fails for large files

**Solution:**
```typescript
// Check file size before upload
app.post('/upload', async (req, res) => {
  try {
    const contentLength = req.headers.get('content-length');
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({
        error: 'File too large',
        maxSize,
        receivedSize: parseInt(contentLength)
      });
    }
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    console.log('File info:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    await Bun.write(`uploads/${file.name}`, file);
    return res.json({ success: true });
    
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }
});
```

### Upload Directory Not Found
**Problem:** `ENOENT: no such file or directory, open 'uploads/file.txt'`

**Solution:**
```typescript
import { mkdir } from 'fs/promises';

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir('uploads', { recursive: true });
  } catch (error) {
    console.error('Failed to create upload directory:', error);
  }
}

// Call on startup
ensureUploadDir();

app.post('/upload', async (req, res) => {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  
  // Ensure directory exists before writing
  await ensureUploadDir();
  await Bun.write(`uploads/${file.name}`, file);
  
  return res.json({ success: true });
});
```

## Database Issues

### Connection Failed
**Problem:** Database connection errors

**Diagnosis:**
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
});

// Test connection
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Database connected:', result.rows[0]);
    client.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    console.error('Connection string:', process.env.DATABASE_URL);
  }
}

testConnection();
```

**Solutions:**
```bash
# Check environment variables
echo $DATABASE_URL

# Test connection manually
psql $DATABASE_URL -c "SELECT NOW();"

# Common connection string formats
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
export DATABASE_URL="postgresql://localhost/dbname"  # No auth
```

### Query Timeout
**Problem:** Database queries hang or timeout

**Solution:**
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  statement_timeout: 10000,  // 10 seconds
  query_timeout: 10000,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});

// Query with timeout
async function queryWithTimeout(text: string, params: any[], timeoutMs = 5000) {
  return Promise.race([
    pool.query(text, params),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
    )
  ]);
}
```

## Memory Issues

### Memory Leaks
**Problem:** Memory usage continuously increases

**Diagnosis:**
```typescript
// Memory monitoring
setInterval(() => {
  const mem = process.memoryUsage();
  console.log('Memory usage:', {
    rss: `${Math.round(mem.rss / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
    external: `${Math.round(mem.external / 1024 / 1024)} MB`
  });
}, 30000); // Every 30 seconds

// Track object counts
const objectCounts = new Map();

function trackObject(name: string, obj: any) {
  objectCounts.set(name, (objectCounts.get(name) || 0) + 1);
  
  // Cleanup tracking when object is no longer referenced
  if (typeof obj === 'object') {
    const ref = new WeakRef(obj);
    setTimeout(() => {
      if (!ref.deref()) {
        objectCounts.set(name, objectCounts.get(name) - 1);
      }
    }, 1000);
  }
}
```

**Solutions:**
```typescript
// Avoid global variables
// ❌ Bad
let globalCache = new Map();

// ✅ Good
function createCache() {
  return new Map();
}

// Clear intervals and timeouts
const intervals = new Set();

function setManagedInterval(callback: Function, ms: number) {
  const id = setInterval(callback, ms);
  intervals.add(id);
  return id;
}

function clearAllIntervals() {
  for (const id of intervals) {
    clearInterval(id);
  }
  intervals.clear();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  clearAllIntervals();
  process.exit(0);
});
```

## Performance Issues

### Slow Response Times
**Problem:** API responses are slow

**Diagnosis:**
```typescript
// Performance middleware
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1000000; // ms
    
    if (duration > 1000) {
      console.warn('Slow request:', {
        method: req.method,
        url: req.url,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode
      });
    }
  });
  
  return next();
});

// Database query performance
async function logSlowQueries(query: string, params: any[]) {
  const start = performance.now();
  
  try {
    const result = await pool.query(query, params);
    const duration = performance.now() - start;
    
    if (duration > 1000) {
      console.warn('Slow query:', {
        query: query.substring(0, 100),
        duration: `${duration.toFixed(2)}ms`,
        rowCount: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    console.error('Query error:', { query, params, error });
    throw error;
  }
}
```

**Solutions:**
```typescript
// Add database indexes
// CREATE INDEX idx_users_email ON users(email);
// CREATE INDEX idx_posts_user_id ON posts(user_id);

// Use connection pooling
const pool = new Pool({
  max: 20,  // Increase pool size
  min: 5,   // Maintain minimum connections
  idleTimeoutMillis: 30000
});

// Implement caching
const cache = new Map();

app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const cacheKey = `user:${id}`;
  
  // Check cache first
  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }
  
  const user = await userService.getById(id);
  cache.set(cacheKey, user);
  
  return res.json(user);
});
```

## Common Environment Issues

### Development vs Production
**Problem:** Code works in development but fails in production

**Solution:**
```typescript
// Environment-specific configuration
const config = {
  development: {
    port: 3000,
    database: 'postgresql://localhost/myapp_dev',
    logLevel: 'debug',
    cors: { origin: '*' }
  },
  production: {
    port: process.env.PORT || 8080,
    database: process.env.DATABASE_URL,
    logLevel: 'info',
    cors: { origin: process.env.ALLOWED_ORIGINS?.split(',') }
  }
};

const env = process.env.NODE_ENV || 'development';
const appConfig = config[env];

// Use environment-specific settings
app.listen(appConfig.port, () => {
  console.log(`Server running on port ${appConfig.port} in ${env} mode`);
});
```

### Environment Variables Not Loaded
**Problem:** `process.env.VARIABLE` is undefined

**Solution:**
```typescript
// Check if variables are loaded
console.log('Environment variables:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL ? '[REDACTED]' : 'undefined'
});

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Provide defaults
const port = process.env.PORT || 3000;
const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost/myapp';
```

This troubleshooting guide covers the most common issues you'll encounter when developing with Verb framework.