# Production Configuration

Configure your Verb applications for production environments with security, performance, and reliability best practices.

## Environment Variables

### Core Configuration

```bash
# Environment
NODE_ENV=production

# Server
PORT=3000
HOST=0.0.0.0

# Security
JWT_SECRET=your-long-random-jwt-secret-key
SESSION_SECRET=your-session-secret-key
BCRYPT_ROUNDS=12

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://user:pass@host:6379

# External Services
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
LOG_LEVEL=info

# Feature Flags
ENABLE_RATE_LIMITING=true
ENABLE_CORS=true
MAX_REQUEST_SIZE=10mb
```

### Environment File Structure

```bash
# .env.example (committed to repo)
NODE_ENV=development
PORT=3000
DATABASE_URL=sqlite://./dev.db
JWT_SECRET=dev-secret-change-in-production

# .env.production (not committed)
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
JWT_SECRET=actual-production-secret
```

## Configuration Management

### Centralized Config

```typescript
// src/config/index.ts
interface Config {
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
  database: {
    url: string;
    ssl: boolean;
    poolSize: number;
  };
  auth: {
    jwtSecret: string;
    jwtExpiry: string;
    bcryptRounds: number;
  };
  security: {
    corsOrigins: string[];
    rateLimitWindowMs: number;
    rateLimitMax: number;
  };
  monitoring: {
    sentryDsn?: string;
    logLevel: string;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: (process.env.NODE_ENV as Config['nodeEnv']) || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'sqlite://./dev.db',
    ssl: process.env.DATABASE_SSL === 'true',
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10'),
  },
  
  auth: {
    jwtSecret: process.env.JWT_SECRET || throwIfProduction('JWT_SECRET is required'),
    jwtExpiry: process.env.JWT_EXPIRY || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10'),
  },
  
  security: {
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  },
  
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
    logLevel: process.env.LOG_LEVEL || 'info',
  },
};

function throwIfProduction(message: string): never {
  if (config.nodeEnv === 'production') {
    throw new Error(message);
  }
  return '' as never;
}

// Validate required production config
if (config.nodeEnv === 'production') {
  const required = [
    'JWT_SECRET',
    'DATABASE_URL',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default config;
```

### Environment-specific Configs

```typescript
// src/config/environments/production.ts
export const productionConfig = {
  database: {
    ssl: true,
    poolSize: 20,
    connectionTimeout: 30000,
  },
  security: {
    bcryptRounds: 12,
    rateLimitStrict: true,
  },
  logging: {
    level: 'warn',
    format: 'json',
  },
  cache: {
    ttl: 3600, // 1 hour
    maxSize: 1000,
  },
};

// src/config/environments/development.ts
export const developmentConfig = {
  database: {
    ssl: false,
    poolSize: 5,
    logging: true,
  },
  security: {
    bcryptRounds: 4, // Faster for development
    rateLimitStrict: false,
  },
  logging: {
    level: 'debug',
    format: 'pretty',
  },
};
```

## Security Configuration

### HTTPS and TLS

```typescript
// src/server.ts
import config from './config';

const app = server.https();

app.withOptions({
  port: config.port,
  hostname: config.host,
  tls: {
    cert: Bun.file(process.env.TLS_CERT_PATH || '/etc/ssl/certs/server.crt'),
    key: Bun.file(process.env.TLS_KEY_PATH || '/etc/ssl/private/server.key'),
  },
});
```

### CORS Configuration

```typescript
// src/middleware/cors.ts
import type { VerbRequest, VerbResponse } from 'verb';
import config from '../config';

export const corsMiddleware = async (req: VerbRequest, res: VerbResponse, next: () => void) => {
  const origin = req.headers.get('origin');
  
  if (config.security.corsOrigins.includes('*') || 
      (origin && config.security.corsOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
};
```

### Rate Limiting

```typescript
// src/middleware/rateLimiting.ts
import config from '../config';

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const store: RateLimitStore = {};

export const rateLimitMiddleware = async (req: VerbRequest, res: VerbResponse, next: () => void) => {
  if (!config.security.rateLimitStrict && config.nodeEnv !== 'production') {
    return next();
  }
  
  const clientId = req.headers.get('x-forwarded-for') || 
                   req.headers.get('x-real-ip') || 
                   'unknown';
  
  const now = Date.now();
  const windowStart = now - config.security.rateLimitWindowMs;
  
  // Clean old entries
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < windowStart) {
      delete store[key];
    }
  });
  
  if (!store[clientId]) {
    store[clientId] = { count: 0, resetTime: now + config.security.rateLimitWindowMs };
  }
  
  store[clientId].count++;
  
  if (store[clientId].count > config.security.rateLimitMax) {
    res.setHeader('X-RateLimit-Limit', config.security.rateLimitMax.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', store[clientId].resetTime.toString());
    
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      retryAfter: Math.ceil((store[clientId].resetTime - now) / 1000),
    });
  }
  
  res.setHeader('X-RateLimit-Limit', config.security.rateLimitMax.toString());
  res.setHeader('X-RateLimit-Remaining', (config.security.rateLimitMax - store[clientId].count).toString());
  res.setHeader('X-RateLimit-Reset', store[clientId].resetTime.toString());
  
  next();
};
```

## Logging Configuration

### Structured Logging

```typescript
// src/utils/logger.ts
import config from '../config';

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  error?: any;
}

class Logger {
  private log(level: string, message: string, meta: Partial<LogEntry> = {}) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    
    if (config.nodeEnv === 'production') {
      console.log(JSON.stringify(entry));
    } else {
      console.log(`[${entry.level.toUpperCase()}] ${entry.timestamp} - ${message}`, meta);
    }
  }
  
  info(message: string, meta?: Partial<LogEntry>) {
    this.log('info', message, meta);
  }
  
  warn(message: string, meta?: Partial<LogEntry>) {
    this.log('warn', message, meta);
  }
  
  error(message: string, error?: Error, meta?: Partial<LogEntry>) {
    this.log('error', message, {
      ...meta,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }
  
  debug(message: string, meta?: Partial<LogEntry>) {
    if (config.monitoring.logLevel === 'debug') {
      this.log('debug', message, meta);
    }
  }
}

export const logger = new Logger();
```

### Request Logging Middleware

```typescript
// src/middleware/logging.ts
import { logger } from '../utils/logger';
import type { VerbRequest, VerbResponse } from 'verb';

export const loggingMiddleware = async (req: VerbRequest, res: VerbResponse, next: () => void) => {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  
  // Add request ID to request for use in other middleware
  (req as any).requestId = requestId;
  
  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  });
  
  try {
    await next();
    
    const duration = Date.now() - start;
    logger.info('Request completed', {
      requestId,
      duration,
      status: res.status || 200,
    });
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Request failed', error as Error, {
      requestId,
      duration,
    });
    throw error;
  }
};
```

## Database Configuration

### Connection Pooling

```typescript
// src/db/connection.ts
import config from '../config';

export const dbConfig = {
  connectionString: config.database.url,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  pool: {
    min: 2,
    max: config.database.poolSize,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
};
```

### Migration Configuration

```typescript
// src/db/migrations.ts
export const migrationConfig = {
  directory: './migrations',
  tableName: 'migrations',
  schemaName: 'public',
  disableTransactions: false,
  loadExtensions: ['.ts'],
};
```

## Performance Configuration

### Caching Strategy

```typescript
// src/utils/cache.ts
import config from '../config';

class MemoryCache {
  private cache = new Map<string, { data: any; expiry: number }>();
  
  set(key: string, value: any, ttlSeconds = config.cache.ttl) {
    const expiry = Date.now() + (ttlSeconds * 1000);
    
    // Prevent memory leaks
    if (this.cache.size >= config.cache.maxSize) {
      this.evictOldest();
    }
    
    this.cache.set(key, { data: value, expiry });
  }
  
  get(key: string) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  private evictOldest() {
    const oldest = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => a.expiry - b.expiry)[0];
    
    if (oldest) {
      this.cache.delete(oldest[0]);
    }
  }
}

export const cache = new MemoryCache();
```

### Compression

```typescript
// src/middleware/compression.ts
export const compressionMiddleware = async (req: VerbRequest, res: VerbResponse, next: () => void) => {
  const acceptEncoding = req.headers.get('accept-encoding') || '';
  
  if (acceptEncoding.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
  }
  
  next();
};
```

## Monitoring Configuration

### Health Checks

```typescript
// src/routes/health.ts
import { logger } from '../utils/logger';
import config from '../config';

export const healthCheck = async (req: VerbRequest, res: VerbResponse) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.nodeEnv,
    memory: process.memoryUsage(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
    },
  };
  
  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok');
  
  if (!isHealthy) {
    logger.warn('Health check failed', { health });
    return res.status(503).json(health);
  }
  
  return res.json(health);
};

async function checkDatabase() {
  try {
    // Simple database ping
    // await db.raw('SELECT 1');
    return { status: 'ok', latency: 0 };
  } catch (error) {
    return { status: 'error', message: (error as Error).message };
  }
}

async function checkRedis() {
  try {
    // Redis ping if using Redis
    return { status: 'ok', latency: 0 };
  } catch (error) {
    return { status: 'error', message: (error as Error).message };
  }
}
```

## Error Handling

### Global Error Handler

```typescript
// src/middleware/errorHandler.ts
import { logger } from '../utils/logger';
import config from '../config';

export const errorHandler = (error: Error, req: VerbRequest, res: VerbResponse) => {
  const requestId = (req as any).requestId || 'unknown';
  
  logger.error('Unhandled error', error, {
    requestId,
    url: req.url,
    method: req.method,
  });
  
  // Don't leak error details in production
  const message = config.nodeEnv === 'production' 
    ? 'Internal Server Error' 
    : error.message;
  
  const response = {
    error: {
      message,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
  
  return res.status(500).json(response);
};
```

## Next Steps

- [Health Checks](./health-checks.md)
- [Graceful Shutdown](./graceful-shutdown.md)
- [Docker Deployment](./docker.md)