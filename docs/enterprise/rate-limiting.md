# Rate Limiting Patterns and Examples

Comprehensive rate limiting strategies for Verb applications including sliding window, token bucket, and distributed rate limiting with Redis.

## Core Rate Limiting Middleware

### In-Memory Rate Limiting

```typescript
import type { VerbRequest, VerbResponse, Middleware } from 'verb';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface RateLimitOptions {
  windowMs: number;          // Time window in milliseconds
  max: number;               // Max requests per window
  keyGenerator?: (req: VerbRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (req: VerbRequest, res: VerbResponse) => void;
  message?: string | ((req: VerbRequest) => string);
  headers?: boolean;         // Include rate limit headers
  standardHeaders?: boolean; // Use standard headers (draft-6)
}

// In-memory store for development/single instance
class MemoryStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.resetTime < now) {
          this.store.delete(key);
        }
      }
    }, 60000);
  }

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (entry && entry.resetTime < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  increment(key: string, windowMs: number): RateLimitEntry {
    const now = Date.now();
    const existing = this.get(key);

    if (!existing) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + windowMs,
        firstRequest: now
      };
      this.set(key, newEntry);
      return newEntry;
    }

    existing.count++;
    this.set(key, existing);
    return existing;
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Basic rate limiting middleware
export const rateLimit = (options: RateLimitOptions): Middleware => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    keyGenerator = (req) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    onLimitReached,
    message = 'Too many requests, please try again later.',
    headers = true,
    standardHeaders = false
  } = options;

  const store = new MemoryStore();

  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Get current state
    let entry = store.get(key);
    
    // If no entry exists, create one
    if (!entry) {
      entry = store.increment(key, windowMs);
    }
    
    const timeUntilReset = Math.max(0, entry.resetTime - now);
    const remainingRequests = Math.max(0, max - entry.count);
    
    // Add rate limit headers
    if (headers) {
      if (standardHeaders) {
        // Draft 6 standard headers
        res.header('RateLimit-Limit', max.toString());
        res.header('RateLimit-Remaining', remainingRequests.toString());
        res.header('RateLimit-Reset', new Date(entry.resetTime).toISOString());
      } else {
        // Legacy headers
        res.header('X-RateLimit-Limit', max.toString());
        res.header('X-RateLimit-Remaining', remainingRequests.toString());
        res.header('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());
      }
    }
    
    // Check if limit exceeded
    if (entry.count > max) {
      if (headers) {
        res.header('Retry-After', Math.ceil(timeUntilReset / 1000).toString());
      }
      
      // Call custom handler if provided
      if (onLimitReached) {
        onLimitReached(req, res);
        return;
      }
      
      const errorMessage = typeof message === 'function' ? message(req) : message;
      res.status(429).json({ error: errorMessage });
      return;
    }

    // Track the request
    const originalSend = res.send;
    const originalJson = res.json;
    let hasResponded = false;
    
    const incrementIfNeeded = (statusCode: number) => {
      if (hasResponded) return;
      hasResponded = true;
      
      const shouldSkip = 
        (skipSuccessfulRequests && statusCode < 400) ||
        (skipFailedRequests && statusCode >= 400);
      
      if (!shouldSkip) {
        store.increment(key, windowMs);
      }
    };

    res.send = (data: any) => {
      incrementIfNeeded(res.statusCode || 200);
      return originalSend.call(res, data);
    };

    res.json = (data: any) => {
      incrementIfNeeded(res.statusCode || 200);
      return originalJson.call(res, data);
    };

    next();
  };
};
```

## Redis-Based Distributed Rate Limiting

### Redis Store Implementation

```typescript
import Redis from 'redis';

interface RedisStoreOptions {
  redisClient?: Redis.RedisClientType;
  redisUrl?: string;
  prefix?: string;
}

class RedisStore {
  private client: Redis.RedisClientType;
  private prefix: string;

  constructor(options: RedisStoreOptions = {}) {
    this.prefix = options.prefix || 'rl:';
    
    if (options.redisClient) {
      this.client = options.redisClient;
    } else {
      this.client = Redis.createClient({
        url: options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379'
      });
      this.client.connect();
    }
  }

  async get(key: string): Promise<RateLimitEntry | undefined> {
    try {
      const data = await this.client.get(`${this.prefix}${key}`);
      return data ? JSON.parse(data) : undefined;
    } catch {
      return undefined;
    }
  }

  async set(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void> {
    try {
      await this.client.setEx(
        `${this.prefix}${key}`,
        Math.ceil(ttlMs / 1000),
        JSON.stringify(entry)
      );
    } catch (error) {
      console.error('Redis rate limit set failed:', error);
    }
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now();
    const redisKey = `${this.prefix}${key}`;
    
    try {
      // Use Lua script for atomic increment operation
      const luaScript = `
        local key = KEYS[1]
        local window = tonumber(ARGV[1])
        local now = tonumber(ARGV[2])
        
        local current = redis.call('GET', key)
        if current == false then
          local entry = cjson.encode({
            count = 1,
            resetTime = now + window,
            firstRequest = now
          })
          redis.call('SETEX', key, math.ceil(window / 1000), entry)
          return entry
        else
          local data = cjson.decode(current)
          if data.resetTime < now then
            -- Window expired, reset
            local entry = cjson.encode({
              count = 1,
              resetTime = now + window,
              firstRequest = now
            })
            redis.call('SETEX', key, math.ceil(window / 1000), entry)
            return entry
          else
            -- Increment counter
            data.count = data.count + 1
            local entry = cjson.encode(data)
            local ttl = math.ceil((data.resetTime - now) / 1000)
            redis.call('SETEX', key, ttl, entry)
            return entry
          end
        end
      `;
      
      const result = await this.client.eval(luaScript, {
        keys: [redisKey],
        arguments: [windowMs.toString(), now.toString()]
      });
      
      return JSON.parse(result as string);
    } catch (error) {
      console.error('Redis rate limit increment failed:', error);
      // Fallback to basic increment
      const existing = await this.get(key);
      
      if (!existing || existing.resetTime < now) {
        const newEntry: RateLimitEntry = {
          count: 1,
          resetTime: now + windowMs,
          firstRequest: now
        };
        await this.set(key, newEntry, windowMs);
        return newEntry;
      }
      
      existing.count++;
      await this.set(key, existing, existing.resetTime - now);
      return existing;
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.client.del(`${this.prefix}${key}`);
    } catch (error) {
      console.error('Redis rate limit reset failed:', error);
    }
  }
}

// Distributed rate limiting middleware
export const distributedRateLimit = (options: RateLimitOptions & RedisStoreOptions): Middleware => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    keyGenerator = (req) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    onLimitReached,
    message = 'Too many requests, please try again later.',
    headers = true,
    standardHeaders = false,
    ...redisOptions
  } = options;

  const store = new RedisStore(redisOptions);

  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    try {
      // Get current state
      const entry = await store.increment(key, windowMs);
      
      const timeUntilReset = Math.max(0, entry.resetTime - now);
      const remainingRequests = Math.max(0, max - entry.count);
      
      // Add rate limit headers
      if (headers) {
        if (standardHeaders) {
          res.header('RateLimit-Limit', max.toString());
          res.header('RateLimit-Remaining', remainingRequests.toString());
          res.header('RateLimit-Reset', new Date(entry.resetTime).toISOString());
        } else {
          res.header('X-RateLimit-Limit', max.toString());
          res.header('X-RateLimit-Remaining', remainingRequests.toString());
          res.header('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());
        }
      }
      
      // Check if limit exceeded
      if (entry.count > max) {
        if (headers) {
          res.header('Retry-After', Math.ceil(timeUntilReset / 1000).toString());
        }
        
        if (onLimitReached) {
          onLimitReached(req, res);
          return;
        }
        
        const errorMessage = typeof message === 'function' ? message(req) : message;
        res.status(429).json({ error: errorMessage });
        return;
      }
      
      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // On error, allow the request to proceed
      next();
    }
  };
};
```

## Advanced Rate Limiting Patterns

### Sliding Window Rate Limiting

```typescript
// Sliding window implementation using Redis sorted sets
class SlidingWindowRateLimit {
  private client: Redis.RedisClientType;
  private prefix: string;

  constructor(redisClient: Redis.RedisClientType, prefix = 'sw:') {
    this.client = redisClient;
    this.prefix = prefix;
  }

  async checkLimit(key: string, limit: number, windowMs: number): Promise<{
    allowed: boolean;
    count: number;
    remaining: number;
    resetTime: number;
  }> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `${this.prefix}${key}`;
    
    const luaScript = `
      local key = KEYS[1]
      local window_start = tonumber(ARGV[1])
      local now = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local window_ms = tonumber(ARGV[4])
      
      -- Remove old entries
      redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
      
      -- Count current requests
      local current_count = redis.call('ZCARD', key)
      
      if current_count < limit then
        -- Add current request
        redis.call('ZADD', key, now, now)
        redis.call('EXPIRE', key, math.ceil(window_ms / 1000))
        return {1, current_count + 1, limit - current_count - 1, now + window_ms}
      else
        return {0, current_count, 0, now + window_ms}
      end
    `;
    
    try {
      const result = await this.client.eval(luaScript, {
        keys: [redisKey],
        arguments: [windowStart.toString(), now.toString(), limit.toString(), windowMs.toString()]
      }) as [number, number, number, number];
      
      return {
        allowed: result[0] === 1,
        count: result[1],
        remaining: result[2],
        resetTime: result[3]
      };
    } catch (error) {
      console.error('Sliding window rate limit error:', error);
      // Fail open
      return {
        allowed: true,
        count: 0,
        remaining: limit,
        resetTime: now + windowMs
      };
    }
  }
}

export const slidingWindowRateLimit = (options: {
  windowMs: number;
  max: number;
  redisClient: Redis.RedisClientType;
  keyGenerator?: (req: VerbRequest) => string;
}): Middleware => {
  const {
    windowMs,
    max,
    redisClient,
    keyGenerator = (req) => req.ip || 'unknown'
  } = options;
  
  const limiter = new SlidingWindowRateLimit(redisClient);
  
  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    const key = keyGenerator(req);
    
    try {
      const result = await limiter.checkLimit(key, max, windowMs);
      
      res.header('X-RateLimit-Limit', max.toString());
      res.header('X-RateLimit-Remaining', result.remaining.toString());
      res.header('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
      
      if (!result.allowed) {
        res.header('Retry-After', Math.ceil(windowMs / 1000).toString());
        res.status(429).json({ error: 'Too many requests' });
        return;
      }
      
      next();
    } catch (error) {
      console.error('Sliding window rate limit error:', error);
      next();
    }
  };
};
```

### Token Bucket Rate Limiting

```typescript
// Token bucket implementation
class TokenBucket {
  private capacity: number;
  private tokens: number;
  private refillRate: number; // tokens per second
  private lastRefill: number;

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  consume(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // Convert to seconds
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getTokens(): number {
    this.refill();
    return this.tokens;
  }

  getWaitTime(tokens: number = 1): number {
    this.refill();
    
    if (this.tokens >= tokens) {
      return 0;
    }
    
    const tokensNeeded = tokens - this.tokens;
    return (tokensNeeded / this.refillRate) * 1000; // Convert to milliseconds
  }
}

// Redis-backed token bucket
class RedisTokenBucket {
  private client: Redis.RedisClientType;
  private prefix: string;

  constructor(redisClient: Redis.RedisClientType, prefix = 'tb:') {
    this.client = redisClient;
    this.prefix = prefix;
  }

  async consume(key: string, capacity: number, refillRate: number, tokens: number = 1): Promise<{
    allowed: boolean;
    tokens: number;
    waitTime: number;
  }> {
    const now = Date.now();
    const redisKey = `${this.prefix}${key}`;
    
    const luaScript = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refill_rate = tonumber(ARGV[2])
      local tokens_requested = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])
      
      local bucket_data = redis.call('HMGET', key, 'tokens', 'last_refill')
      local current_tokens = tonumber(bucket_data[1]) or capacity
      local last_refill = tonumber(bucket_data[2]) or now
      
      -- Refill tokens
      local time_passed = (now - last_refill) / 1000
      local tokens_to_add = time_passed * refill_rate
      current_tokens = math.min(capacity, current_tokens + tokens_to_add)
      
      local allowed = 0
      local wait_time = 0
      
      if current_tokens >= tokens_requested then
        current_tokens = current_tokens - tokens_requested
        allowed = 1
      else
        local tokens_needed = tokens_requested - current_tokens
        wait_time = (tokens_needed / refill_rate) * 1000
      end
      
      -- Update bucket state
      redis.call('HMSET', key, 'tokens', current_tokens, 'last_refill', now)
      redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 1)
      
      return {allowed, current_tokens, wait_time}
    `;
    
    try {
      const result = await this.client.eval(luaScript, {
        keys: [redisKey],
        arguments: [capacity.toString(), refillRate.toString(), tokens.toString(), now.toString()]
      }) as [number, number, number];
      
      return {
        allowed: result[0] === 1,
        tokens: result[1],
        waitTime: result[2]
      };
    } catch (error) {
      console.error('Token bucket error:', error);
      return {
        allowed: true,
        tokens: capacity,
        waitTime: 0
      };
    }
  }
}

export const tokenBucketRateLimit = (options: {
  capacity: number;
  refillRate: number; // tokens per second
  tokensPerRequest?: number;
  redisClient?: Redis.RedisClientType;
  keyGenerator?: (req: VerbRequest) => string;
}): Middleware => {
  const {
    capacity,
    refillRate,
    tokensPerRequest = 1,
    redisClient,
    keyGenerator = (req) => req.ip || 'unknown'
  } = options;
  
  // Use Redis if provided, otherwise use in-memory
  const buckets = new Map<string, TokenBucket>();
  const redisBucket = redisClient ? new RedisTokenBucket(redisClient) : null;
  
  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    const key = keyGenerator(req);
    
    try {
      let result: { allowed: boolean; tokens: number; waitTime: number };
      
      if (redisBucket) {
        result = await redisBucket.consume(key, capacity, refillRate, tokensPerRequest);
      } else {
        // In-memory fallback
        if (!buckets.has(key)) {
          buckets.set(key, new TokenBucket(capacity, refillRate));
        }
        
        const bucket = buckets.get(key)!;
        const allowed = bucket.consume(tokensPerRequest);
        result = {
          allowed,
          tokens: bucket.getTokens(),
          waitTime: allowed ? 0 : bucket.getWaitTime(tokensPerRequest)
        };
      }
      
      res.header('X-RateLimit-Limit', capacity.toString());
      res.header('X-RateLimit-Remaining', Math.floor(result.tokens).toString());
      
      if (!result.allowed) {
        res.header('Retry-After', Math.ceil(result.waitTime / 1000).toString());
        res.status(429).json({ 
          error: 'Too many requests',
          retryAfter: Math.ceil(result.waitTime / 1000)
        });
        return;
      }
      
      next();
    } catch (error) {
      console.error('Token bucket rate limit error:', error);
      next();
    }
  };
};
```

## Tiered Rate Limiting

### User-Based Rate Limiting

```typescript
// Different limits based on user type
interface UserTier {
  name: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit?: number;
}

const USER_TIERS: Record<string, UserTier> = {
  free: {
    name: 'Free',
    requestsPerMinute: 10,
    requestsPerHour: 100,
    requestsPerDay: 1000
  },
  premium: {
    name: 'Premium',
    requestsPerMinute: 100,
    requestsPerHour: 2000,
    requestsPerDay: 20000,
    burstLimit: 200
  },
  enterprise: {
    name: 'Enterprise',
    requestsPerMinute: 1000,
    requestsPerHour: 50000,
    requestsPerDay: 500000,
    burstLimit: 2000
  }
};

export const tieredRateLimit = (options: {
  redisClient: Redis.RedisClientType;
  getUserTier: (req: VerbRequest) => Promise<string>;
  defaultTier?: string;
}): Middleware => {
  const { redisClient, getUserTier, defaultTier = 'free' } = options;
  const store = new RedisStore({ redisClient });
  
  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    try {
      const userTier = await getUserTier(req) || defaultTier;
      const tier = USER_TIERS[userTier] || USER_TIERS[defaultTier];
      
      const userId = req.user?.id || req.ip || 'anonymous';
      const now = Date.now();
      
      // Check multiple time windows
      const checks = [
        { window: 60 * 1000, limit: tier.requestsPerMinute, name: 'minute' },
        { window: 60 * 60 * 1000, limit: tier.requestsPerHour, name: 'hour' },
        { window: 24 * 60 * 60 * 1000, limit: tier.requestsPerDay, name: 'day' }
      ];
      
      for (const check of checks) {
        const key = `${userId}:${check.name}`;
        const entry = await store.increment(key, check.window);
        
        if (entry.count > check.limit) {
          const resetTime = Math.ceil((entry.resetTime - now) / 1000);
          
          res.header('X-RateLimit-Limit', check.limit.toString());
          res.header('X-RateLimit-Remaining', '0');
          res.header('X-RateLimit-Reset', resetTime.toString());
          res.header('X-RateLimit-Tier', tier.name);
          res.header('Retry-After', resetTime.toString());
          
          res.status(429).json({
            error: `Rate limit exceeded for ${check.name}ly requests`,
            tier: tier.name,
            limit: check.limit,
            retryAfter: resetTime
          });
          return;
        }
      }
      
      // Add tier information to headers
      res.header('X-RateLimit-Tier', tier.name);
      res.header('X-RateLimit-Minute-Limit', tier.requestsPerMinute.toString());
      res.header('X-RateLimit-Hour-Limit', tier.requestsPerHour.toString());
      res.header('X-RateLimit-Day-Limit', tier.requestsPerDay.toString());
      
      next();
    } catch (error) {
      console.error('Tiered rate limit error:', error);
      next();
    }
  };
};
```

## Endpoint-Specific Rate Limiting

### Resource-Based Limits

```typescript
// Different limits for different endpoints
interface EndpointLimits {
  [endpoint: string]: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests?: boolean;
    message?: string;
  };
}

const ENDPOINT_LIMITS: EndpointLimits = {
  '/api/auth/login': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: 'Too many login attempts'
  },
  '/api/auth/register': {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour per IP
    message: 'Too many registration attempts'
  },
  '/api/password/reset': {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset attempts per hour
    message: 'Too many password reset attempts'
  },
  '/api/upload': {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 uploads per minute
    skipSuccessfulRequests: false
  },
  '/api/search': {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 searches per minute
    skipSuccessfulRequests: true
  }
};

export const endpointRateLimit = (options: {
  redisClient?: Redis.RedisClientType;
  endpointLimits?: EndpointLimits;
  keyGenerator?: (req: VerbRequest, endpoint: string) => string;
}): Middleware => {
  const {
    redisClient,
    endpointLimits = ENDPOINT_LIMITS,
    keyGenerator = (req, endpoint) => `${req.ip || 'unknown'}:${endpoint}`
  } = options;
  
  const store = redisClient ? new RedisStore({ redisClient }) : new MemoryStore();
  
  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    const endpoint = req.url.split('?')[0]; // Remove query parameters
    const limits = endpointLimits[endpoint];
    
    if (!limits) {
      return next();
    }
    
    const key = keyGenerator(req, endpoint);
    
    try {
      let entry: RateLimitEntry;
      
      if (redisClient && store instanceof RedisStore) {
        entry = await store.increment(key, limits.windowMs);
      } else if (store instanceof MemoryStore) {
        entry = store.increment(key, limits.windowMs);
      } else {
        return next();
      }
      
      const now = Date.now();
      const timeUntilReset = Math.max(0, entry.resetTime - now);
      const remainingRequests = Math.max(0, limits.max - entry.count);
      
      res.header('X-RateLimit-Limit', limits.max.toString());
      res.header('X-RateLimit-Remaining', remainingRequests.toString());
      res.header('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());
      
      if (entry.count > limits.max) {
        res.header('Retry-After', Math.ceil(timeUntilReset / 1000).toString());
        res.status(429).json({
          error: limits.message || 'Too many requests',
          endpoint,
          retryAfter: Math.ceil(timeUntilReset / 1000)
        });
        return;
      }
      
      next();
    } catch (error) {
      console.error('Endpoint rate limit error:', error);
      next();
    }
  };
};
```

## Usage Examples

### Basic API Rate Limiting

```typescript
import { server } from 'verb';
import { rateLimit, distributedRateLimit } from './middleware/rate-limiting';

const app = server.http();

// Global rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true
}));

// Or distributed rate limiting with Redis
app.use(distributedRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  redisUrl: process.env.REDIS_URL
}));

app.listen(3000);
```

### Advanced Multi-Tier Setup

```typescript
// Production setup with multiple rate limiting strategies
const setupRateLimiting = (app: any) => {
  // 1. Global IP-based rate limiting
  app.use(rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute per IP
    keyGenerator: (req) => req.ip,
    headers: true
  }));
  
  // 2. Endpoint-specific rate limiting
  app.use(endpointRateLimit({
    redisClient: redisClient,
    endpointLimits: {
      '/api/auth/login': { windowMs: 15 * 60 * 1000, max: 5 },
      '/api/search': { windowMs: 60 * 1000, max: 100 },
      '/api/upload': { windowMs: 60 * 1000, max: 10 }
    }
  }));
  
  // 3. User-based tiered rate limiting
  app.use('/api', tieredRateLimit({
    redisClient: redisClient,
    getUserTier: async (req) => {
      return req.user?.subscription || 'free';
    }
  }));
  
  // 4. Token bucket for burst handling
  app.use('/api/heavy-operation', tokenBucketRateLimit({
    capacity: 10,
    refillRate: 1, // 1 token per second
    tokensPerRequest: 1,
    redisClient: redisClient
  }));
};
```

## Monitoring and Analytics

### Rate Limit Metrics

```typescript
// Rate limiting metrics collection
export class RateLimitMetrics {
  static recordRateLimitHit(endpoint: string, userTier: string, limitType: string) {
    // Record to metrics system
    if (global.verbMetrics) {
      global.verbMetrics.incrementCounter('rate_limit_hits_total', {
        endpoint,
        user_tier: userTier,
        limit_type: limitType
      });
    }
  }
  
  static recordRateLimitBreach(endpoint: string, userTier: string, exceedBy: number) {
    if (global.verbMetrics) {
      global.verbMetrics.incrementCounter('rate_limit_breaches_total', {
        endpoint,
        user_tier: userTier
      });
      
      global.verbMetrics.observeHistogram('rate_limit_exceed_amount', exceedBy, {
        endpoint,
        user_tier: userTier
      });
    }
  }
}
```

## Best Practices

### 1. **Rate Limiting Strategy**
- Use multiple time windows for comprehensive protection
- Implement different limits for different user tiers
- Consider burst capacity for legitimate traffic spikes

### 2. **Key Generation**
- Use IP address for anonymous users
- Use user ID for authenticated users
- Combine multiple factors for more sophisticated limiting

### 3. **Error Handling**
- Fail open when rate limiting services are unavailable
- Provide clear error messages and retry guidance
- Include appropriate HTTP headers

### 4. **Performance**
- Use Redis for distributed applications
- Implement efficient cleanup for in-memory stores
- Use Lua scripts for atomic operations

### 5. **Monitoring**
- Track rate limit hit rates and breach patterns
- Monitor for abuse patterns
- Alert on unusual rate limiting activity

This comprehensive rate limiting system provides enterprise-grade protection for Verb applications with multiple strategies and deployment options.