# Security Best Practices

Comprehensive security guidelines for Verb framework applications across all protocols.

## HTTP Security

### Authentication and Authorization

```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// JWT Authentication middleware
const jwtAuthMiddleware = async (req, res, next) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Role-based authorization
const requireRole = (roles: string[]) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  return next();
};

// Usage
app.get('/admin/*', jwtAuthMiddleware, requireRole(['admin']), adminHandler);
app.get('/user/*', jwtAuthMiddleware, userHandler);

// Login endpoint with secure password handling
app.post('/auth/login', async (req, res) => {
  const { email, password } = await req.json();
  
  // Input validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  const user = await getUserByEmail(email);
  if (!user) {
    // Constant-time response to prevent email enumeration
    await bcrypt.compare(password, '$2b$10$dummy.hash.to.prevent.timing.attacks');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});
```

### Input Validation and Sanitization

```typescript
import { z } from 'zod';
import DOMPurify from 'dompurify';

// Schema validation
const userSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-zA-Z\s]+$/),
  email: z.string().email().max(100),
  age: z.number().int().min(18).max(120),
  bio: z.string().max(500).optional()
});

const validateInput = (schema: z.ZodSchema) => async (req, res, next) => {
  try {
    const body = await req.json();
    const validated = schema.parse(body);
    req.validatedBody = validated;
    return next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues
      });
    }
    throw error;
  }
};

// XSS Prevention
const sanitizeMiddleware = (req, res, next) => {
  if (req.validatedBody) {
    req.validatedBody = sanitizeObject(req.validatedBody);
  }
  return next();
};

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return DOMPurify.sanitize(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
    return sanitized;
  }
  return obj;
}

// Usage
app.post('/users', validateInput(userSchema), sanitizeMiddleware, createUserHandler);
```

### CORS Security

```typescript
// Secure CORS configuration
const corsMiddleware = (req, res, next) => {
  const origin = req.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  
  // Check origin against whitelist
  if (allowedOrigins.includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
  }
  
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  
  return next();
};

app.use(corsMiddleware);
```

### Rate Limiting

```typescript
// Advanced rate limiting with multiple strategies
class RateLimiter {
  private requests = new Map<string, number[]>();
  private blacklist = new Set<string>();
  
  check(clientId: string, maxRequests: number, windowMs: number): boolean {
    // Check blacklist
    if (this.blacklist.has(clientId)) {
      return false;
    }
    
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!this.requests.has(clientId)) {
      this.requests.set(clientId, []);
    }
    
    const clientRequests = this.requests.get(clientId)!;
    
    // Remove old requests
    const validRequests = clientRequests.filter(time => time > windowStart);
    this.requests.set(clientId, validRequests);
    
    if (validRequests.length >= maxRequests) {
      // Progressive penalties
      if (validRequests.length > maxRequests * 2) {
        this.blacklist.add(clientId);
        setTimeout(() => this.blacklist.delete(clientId), windowMs * 10);
      }
      return false;
    }
    
    validRequests.push(now);
    return true;
  }
  
  reset(clientId: string) {
    this.requests.delete(clientId);
  }
}

const rateLimiter = new RateLimiter();

const rateLimitMiddleware = (maxRequests: number, windowMs: number) => (req, res, next) => {
  const clientId = req.headers.get('x-forwarded-for') || 
                  req.headers.get('x-real-ip') || 
                  'unknown';
  
  if (!rateLimiter.check(clientId, maxRequests, windowMs)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(windowMs / 1000)
    });
  }
  
  return next();
};

// Different limits for different endpoints
app.use('/api/auth', rateLimitMiddleware(5, 60000));     // 5 per minute for auth
app.use('/api/public', rateLimitMiddleware(100, 60000)); // 100 per minute for public API
app.use('/api/*', rateLimitMiddleware(1000, 60000));     // 1000 per minute for authenticated API
```

### Security Headers

```typescript
const securityHeadersMiddleware = (req, res, next) => {
  // Prevent XSS attacks
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.headers.set('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' wss: https:; " +
    "font-src 'self'; " +
    "object-src 'none'; " +
    "media-src 'self'; " +
    "frame-src 'none';"
  );
  
  // HSTS (HTTPS only)
  if (req.protocol === 'https') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Referrer Policy
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Feature Policy / Permissions Policy
  res.headers.set('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  
  return next();
};

app.use(securityHeadersMiddleware);
```

### File Upload Security

```typescript
import path from 'path';
import { createHash } from 'crypto';

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOAD_DIR = './uploads';

// Secure file upload handler
app.post('/upload', async (req, res) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return res.status(400).json({ 
        error: 'Invalid file type',
        allowed: ALLOWED_TYPES
      });
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ 
        error: 'File too large',
        maxSize: MAX_FILE_SIZE
      });
    }
    
    // Validate file extension
    const ext = path.extname(file.name).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt'];
    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ error: 'Invalid file extension' });
    }
    
    // Generate secure filename
    const hash = createHash('sha256').update(file.name + Date.now()).digest('hex');
    const secureFilename = `${hash}${ext}`;
    const uploadPath = path.join(UPLOAD_DIR, secureFilename);
    
    // Ensure upload directory exists and is secure
    await ensureSecureUploadDir(UPLOAD_DIR);
    
    // Save file outside web root
    await Bun.write(uploadPath, file);
    
    // Virus scan (if available)
    const scanResult = await virusScan(uploadPath);
    if (!scanResult.clean) {
      await fs.unlink(uploadPath);
      return res.status(400).json({ error: 'File failed security scan' });
    }
    
    return res.json({
      id: hash,
      filename: secureFilename,
      originalName: file.name,
      size: file.size,
      type: file.type
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

async function ensureSecureUploadDir(dir: string) {
  await fs.mkdir(dir, { recursive: true, mode: 0o750 });
  
  // Create .htaccess to prevent direct access
  const htaccess = 'Order Deny,Allow\nDeny from all';
  await fs.writeFile(path.join(dir, '.htaccess'), htaccess);
}
```

## WebSocket Security

### Connection Authentication

```typescript
// WebSocket authentication
app.websocket('/ws/secure', {
  open: async (ws) => {
    try {
      // Extract token from query params or headers
      const url = new URL(ws.request.url, `http://${ws.request.headers.host}`);
      const token = url.searchParams.get('token') || 
                   ws.request.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        ws.close(1008, 'Authentication required');
        return;
      }
      
      // Verify token
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      ws.userId = payload.userId;
      ws.role = payload.role;
      
      // Rate limiting
      if (!await wsRateLimit.check(ws.userId)) {
        ws.close(1008, 'Rate limit exceeded');
        return;
      }
      
      // Origin validation
      const origin = ws.request.headers.origin;
      if (!isAllowedOrigin(origin)) {
        ws.close(1008, 'Invalid origin');
        return;
      }
      
      console.log(`WebSocket authenticated: ${ws.userId}`);
      
    } catch (error) {
      console.error('WebSocket auth error:', error);
      ws.close(1008, 'Authentication failed');
    }
  },
  
  message: (ws, message) => {
    // Message size limiting
    if (message.length > 1024) {
      ws.close(1009, 'Message too large');
      return;
    }
    
    try {
      const data = JSON.parse(message);
      
      // Input validation
      if (!validateWebSocketMessage(data)) {
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
        return;
      }
      
      // Authorization check
      if (data.action === 'admin' && ws.role !== 'admin') {
        ws.send(JSON.stringify({ error: 'Insufficient permissions' }));
        return;
      }
      
      handleWebSocketMessage(ws, data);
      
    } catch (error) {
      ws.close(1003, 'Invalid JSON');
    }
  },
  
  close: (ws, code, reason) => {
    console.log(`WebSocket closed: ${ws.userId} (${code}: ${reason})`);
  },
  
  error: (ws, error) => {
    console.error('WebSocket error:', error);
    ws.close(1011, 'Server error');
  }
});

function validateWebSocketMessage(data: any): boolean {
  return data && 
         typeof data.action === 'string' && 
         data.action.length <= 50 &&
         (!data.payload || typeof data.payload === 'object');
}
```

### Message Validation and Sanitization

```typescript
// WebSocket message schemas
const wsMessageSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('chat'),
    payload: z.object({
      message: z.string().max(500),
      channel: z.string().regex(/^[a-zA-Z0-9_-]+$/)
    })
  }),
  z.object({
    action: z.literal('subscribe'),
    payload: z.object({
      channels: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).max(10)
    })
  }),
  z.object({
    action: z.literal('ping'),
    payload: z.object({}).optional()
  })
]);

function handleWebSocketMessage(ws: WebSocket, rawData: any) {
  try {
    const validatedData = wsMessageSchema.parse(rawData);
    
    switch (validatedData.action) {
      case 'chat':
        handleChatMessage(ws, validatedData.payload);
        break;
      case 'subscribe':
        handleSubscription(ws, validatedData.payload);
        break;
      case 'ping':
        ws.send(JSON.stringify({ action: 'pong', timestamp: Date.now() }));
        break;
    }
  } catch (error) {
    ws.send(JSON.stringify({ error: 'Invalid message format' }));
  }
}
```

## UDP Security

### Source Validation

```typescript
// UDP security with source validation
const trustedSources = new Set(process.env.TRUSTED_UDP_SOURCES?.split(',') || []);
const udpRateLimit = new Map<string, number[]>();

app.udp(8080, {
  message: (buffer, rinfo) => {
    // Source IP validation
    if (!trustedSources.has(rinfo.address) && !isPrivateIP(rinfo.address)) {
      console.warn('Rejected UDP packet from untrusted source:', rinfo.address);
      return;
    }
    
    // Rate limiting per source
    const now = Date.now();
    const clientRequests = udpRateLimit.get(rinfo.address) || [];
    const validRequests = clientRequests.filter(time => time > now - 60000); // 1 minute window
    
    if (validRequests.length >= 100) { // 100 packets per minute
      console.warn('Rate limit exceeded for UDP source:', rinfo.address);
      return;
    }
    
    validRequests.push(now);
    udpRateLimit.set(rinfo.address, validRequests);
    
    // Message size validation
    if (buffer.length > 512) {
      console.warn('Oversized UDP packet from:', rinfo.address);
      return;
    }
    
    // Basic message validation
    if (!isValidUDPMessage(buffer)) {
      console.warn('Invalid UDP message format from:', rinfo.address);
      return;
    }
    
    processSecureUDPMessage(buffer, rinfo);
  },
  
  error: (error) => {
    console.error('UDP server error:', error);
  }
});

function isPrivateIP(ip: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.)/.test(ip);
}

function isValidUDPMessage(buffer: Buffer): boolean {
  // Implement your UDP message format validation
  if (buffer.length < 4) return false;
  
  const messageType = buffer.readUInt8(0);
  return messageType >= 1 && messageType <= 10; // Valid message types
}
```

## TCP Security

### Connection Security

```typescript
// Secure TCP server
const activeTCPConnections = new Map();
const tcpRateLimit = new Map();

app.tcp(9090, {
  connection: (socket) => {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    
    // Connection limit per IP
    const clientIP = socket.remoteAddress;
    const existingConnections = Array.from(activeTCPConnections.values())
      .filter(conn => conn.remoteAddress === clientIP).length;
    
    if (existingConnections >= 5) {
      console.warn('Too many connections from:', clientIP);
      socket.destroy();
      return;
    }
    
    activeTCPConnections.set(clientId, socket);
    
    // Set timeouts
    socket.setTimeout(30000); // 30 second timeout
    socket.setKeepAlive(true, 60000); // Keep-alive every 60 seconds
    
    // Buffer for partial messages
    let messageBuffer = Buffer.alloc(0);
    
    socket.on('data', (data) => {
      // Rate limiting
      const now = Date.now();
      const clientRequests = tcpRateLimit.get(clientIP) || [];
      const validRequests = clientRequests.filter(time => time > now - 60000);
      
      if (validRequests.length >= 1000) { // 1000 messages per minute
        console.warn('TCP rate limit exceeded for:', clientIP);
        socket.destroy();
        return;
      }
      
      validRequests.push(now);
      tcpRateLimit.set(clientIP, validRequests);
      
      // Accumulate data
      messageBuffer = Buffer.concat([messageBuffer, data]);
      
      // Process complete messages
      while (messageBuffer.length >= 4) {
        const messageLength = messageBuffer.readUInt32BE(0);
        
        if (messageLength > 1024 * 1024) { // 1MB max message size
          console.warn('Oversized TCP message from:', clientIP);
          socket.destroy();
          return;
        }
        
        if (messageBuffer.length >= messageLength + 4) {
          const message = messageBuffer.slice(4, messageLength + 4);
          messageBuffer = messageBuffer.slice(messageLength + 4);
          
          processSecureTCPMessage(socket, message);
        } else {
          break; // Wait for more data
        }
      }
    });
    
    socket.on('timeout', () => {
      console.log('TCP socket timeout:', clientId);
      socket.destroy();
    });
    
    socket.on('error', (error) => {
      console.error('TCP socket error:', clientId, error.message);
    });
    
    socket.on('close', () => {
      activeTCPConnections.delete(clientId);
    });
  },
  
  error: (error) => {
    console.error('TCP server error:', error);
  }
});

function processSecureTCPMessage(socket: any, message: Buffer) {
  try {
    // Implement your TCP protocol validation
    const messageType = message.readUInt8(0);
    
    switch (messageType) {
      case 1: // Ping
        socket.write(Buffer.from([2])); // Pong
        break;
      case 3: // Data
        handleTCPData(socket, message.slice(1));
        break;
      default:
        console.warn('Unknown TCP message type:', messageType);
    }
  } catch (error) {
    console.error('TCP message processing error:', error);
    socket.destroy();
  }
}
```

## Environment Security

### Environment Variables

```typescript
// Secure environment configuration
const requiredEnvVars = [
  'JWT_SECRET',
  'DATABASE_URL',
  'ENCRYPTION_KEY'
];

const sensitiveEnvVars = [
  'JWT_SECRET',
  'DATABASE_PASSWORD',
  'API_KEYS',
  'ENCRYPTION_KEY'
];

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Validate JWT secret strength
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}

// Mask sensitive environment variables in logs
const originalConsoleLog = console.log;
console.log = (...args) => {
  const maskedArgs = args.map(arg => {
    if (typeof arg === 'string') {
      for (const sensitiveVar of sensitiveEnvVars) {
        const value = process.env[sensitiveVar];
        if (value && arg.includes(value)) {
          return arg.replace(new RegExp(value, 'g'), '[REDACTED]');
        }
      }
    }
    return arg;
  });
  originalConsoleLog(...maskedArgs);
};
```

### Database Security

```typescript
import { Pool } from 'pg';

// Secure database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 10000, // 10 seconds
  query_timeout: 10000
});

// Parameterized queries to prevent SQL injection
async function getUserById(id: string) {
  const result = await pool.query(
    'SELECT id, email, role FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

// Input sanitization for database queries
function sanitizeForDatabase(input: string): string {
  return input.replace(/['"\\]/g, ''); // Remove quotes and backslashes
}

// Database connection monitoring
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

pool.on('connect', () => {
  console.log('Database connection established');
});
```

### Logging Security

```typescript
// Secure logging with sensitive data masking
class SecureLogger {
  private sensitivePatterns = [
    /password=\w+/gi,
    /token=[\w-]+/gi,
    /authorization: bearer [\w-]+/gi,
    /api[_-]?key=[\w-]+/gi,
    /"password"\s*:\s*"[^"]+"/gi,
    /"token"\s*:\s*"[^"]+"/gi
  ];
  
  log(level: string, message: string, meta?: any) {
    const sanitizedMessage = this.sanitize(message);
    const sanitizedMeta = meta ? this.sanitize(JSON.stringify(meta)) : undefined;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: sanitizedMessage,
      meta: sanitizedMeta ? JSON.parse(sanitizedMeta) : undefined,
      pid: process.pid
    };
    
    console.log(JSON.stringify(logEntry));
  }
  
  private sanitize(text: string): string {
    let sanitized = text;
    for (const pattern of this.sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }
  
  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }
  
  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }
  
  error(message: string, meta?: any) {
    this.log('error', message, meta);
  }
}

const logger = new SecureLogger();

// Use secure logger throughout application
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    userAgent: req.headers.get('user-agent'),
    ip: req.headers.get('x-forwarded-for') || 'unknown'
  });
  return next();
});
```

### Production Security Checklist

```typescript
// Production security validation
function validateProductionSecurity() {
  const checks = [
    {
      name: 'HTTPS enforced',
      check: () => process.env.FORCE_HTTPS === 'true',
      critical: true
    },
    {
      name: 'JWT secret is strong',
      check: () => process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32,
      critical: true
    },
    {
      name: 'Debug mode disabled',
      check: () => process.env.NODE_ENV === 'production',
      critical: true
    },
    {
      name: 'Database SSL enabled',
      check: () => process.env.DATABASE_SSL === 'true',
      critical: true
    },
    {
      name: 'Rate limiting configured',
      check: () => process.env.RATE_LIMIT_ENABLED === 'true',
      critical: false
    },
    {
      name: 'CORS properly configured',
      check: () => process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS !== '*',
      critical: false
    }
  ];
  
  let criticalIssues = 0;
  let warnings = 0;
  
  for (const check of checks) {
    if (!check.check()) {
      if (check.critical) {
        console.error(`❌ CRITICAL: ${check.name}`);
        criticalIssues++;
      } else {
        console.warn(`⚠️  WARNING: ${check.name}`);
        warnings++;
      }
    } else {
      console.log(`✅ ${check.name}`);
    }
  }
  
  if (criticalIssues > 0) {
    console.error(`${criticalIssues} critical security issues found. Exiting.`);
    process.exit(1);
  }
  
  if (warnings > 0) {
    console.warn(`${warnings} security warnings found.`);
  }
}

// Run security validation in production
if (process.env.NODE_ENV === 'production') {
  validateProductionSecurity();
}
```

This comprehensive security guide covers all major attack vectors and provides practical, production-ready security implementations for Verb applications.