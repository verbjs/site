# Performance Optimization Guide

Comprehensive strategies to maximize Verb application performance across all protocols and deployment scenarios.

## HTTP Performance Optimization

### Response Caching
Implement intelligent caching strategies:

```typescript
// In-memory cache with TTL
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>();

  set(key: string, data: any, ttlMs: number = 300000) { // 5min default
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlMs
    });
  }

  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  clear() {
    this.cache.clear();
  }
}

const cache = new MemoryCache();

// Cache middleware
const cacheMiddleware = (ttlMs: number = 300000) => (req, res, next) => {
  // Only cache GET requests
  if (req.method !== 'GET') return next();
  
  const key = `cache:${req.url}`;
  const cached = cache.get(key);
  
  if (cached) {
    res.headers.set('X-Cache', 'HIT');
    return res.json(cached);
  }
  
  // Override res.json to cache response
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    cache.set(key, data, ttlMs);
    res.headers.set('X-Cache', 'MISS');
    return originalJson(data);
  };
  
  return next();
};

// Usage
app.get('/api/products', cacheMiddleware(600000), async (req, res) => {
  const products = await productService.getAll();
  return res.json(products);
});
```

### HTTP Headers Optimization
Set performance-enhancing headers:

```typescript
// Performance headers middleware
const performanceHeadersMiddleware = (req, res, next) => {
  // Enable compression
  res.headers.set('Content-Encoding', 'gzip');
  
  // Cache static assets
  if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    res.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  
  // Cache API responses briefly
  if (req.url.startsWith('/api/')) {
    res.headers.set('Cache-Control', 'public, max-age=300'); // 5 minutes
  }
  
  // Security headers that don't impact performance
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  
  return next();
};

app.use(performanceHeadersMiddleware);
```

### Request Body Size Limiting
Prevent memory exhaustion:

```typescript
const bodyLimitMiddleware = (maxSizeBytes: number = 1024 * 1024) => async (req, res, next) => {
  const contentLength = req.headers.get('content-length');
  
  if (contentLength && parseInt(contentLength) > maxSizeBytes) {
    return res.status(413).json({
      error: 'Request too large',
      maxSize: maxSizeBytes,
      receivedSize: parseInt(contentLength)
    });
  }
  
  return next();
};

app.use('/api/', bodyLimitMiddleware(2 * 1024 * 1024)); // 2MB limit
```

### Connection Pooling
Optimize database connections:

```typescript
import { Pool } from 'pg';

// Optimized connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  min: 5,  // Minimum connections to maintain
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  acquireTimeoutMillis: 5000,
  
  // Connection validation
  allowExitOnIdle: true,
  
  // Performance options
  statement_timeout: 10000, // 10 seconds
  query_timeout: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

// Optimized query execution
const dbService = {
  async query(text: string, params?: any[]) {
    const start = performance.now();
    
    try {
      const result = await pool.query(text, params);
      const duration = performance.now() - start;
      
      // Log slow queries
      if (duration > 1000) {
        console.warn('Slow query detected:', { text, duration });
      }
      
      return result;
    } catch (error) {
      console.error('Query error:', { text, params, error });
      throw error;
    }
  },
  
  // Prepared statements for frequently used queries
  async preparedQuery(name: string, text: string, params: any[]) {
    return pool.query({ name, text }, params);
  }
};
```

## WebSocket Performance

### Connection Management
Efficiently manage WebSocket connections:

```typescript
class WebSocketManager {
  private connections = new Map<string, WebSocket>();
  private channels = new Map<string, Set<string>>();
  
  addConnection(id: string, ws: WebSocket) {
    this.connections.set(id, ws);
    
    // Clean up on close
    ws.on('close', () => {
      this.removeConnection(id);
    });
  }
  
  removeConnection(id: string) {
    this.connections.delete(id);
    
    // Remove from all channels
    for (const [channel, subscribers] of this.channels.entries()) {
      subscribers.delete(id);
      if (subscribers.size === 0) {
        this.channels.delete(channel);
      }
    }
  }
  
  subscribe(connectionId: string, channel: string) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(connectionId);
  }
  
  unsubscribe(connectionId: string, channel: string) {
    this.channels.get(channel)?.delete(connectionId);
  }
  
  broadcast(channel: string, message: any) {
    const subscribers = this.channels.get(channel);
    if (!subscribers) return;
    
    const serialized = JSON.stringify(message);
    let sent = 0;
    let failed = 0;
    
    for (const connectionId of subscribers) {
      const ws = this.connections.get(connectionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(serialized);
          sent++;
        } catch (error) {
          failed++;
          this.removeConnection(connectionId);
        }
      } else {
        failed++;
        this.removeConnection(connectionId);
      }
    }
    
    console.log(`Broadcast to ${channel}: ${sent} sent, ${failed} failed`);
  }
  
  getStats() {
    return {
      totalConnections: this.connections.size,
      totalChannels: this.channels.size,
      channelStats: Array.from(this.channels.entries()).map(([name, subs]) => ({
        name,
        subscribers: subs.size
      }))
    };
  }
}

const wsManager = new WebSocketManager();

app.websocket('/ws/optimized', {
  open: (ws) => {
    const connectionId = crypto.randomUUID();
    ws.id = connectionId;
    wsManager.addConnection(connectionId, ws);
    
    // Send connection info
    ws.send(JSON.stringify({
      type: 'connected',
      connectionId,
      timestamp: Date.now()
    }));
  },
  
  message: (ws, message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'subscribe':
          wsManager.subscribe(ws.id, data.channel);
          break;
        case 'unsubscribe':
          wsManager.unsubscribe(ws.id, data.channel);
          break;
        case 'broadcast':
          wsManager.broadcast(data.channel, data.payload);
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  },
  
  close: (ws) => {
    wsManager.removeConnection(ws.id);
  }
});

// Performance monitoring endpoint
app.get('/api/ws/stats', (req, res) => {
  return res.json(wsManager.getStats());
});
```

### Message Batching
Batch WebSocket messages for better performance:

```typescript
class MessageBatcher {
  private batches = new Map<string, any[]>();
  private timers = new Map<string, NodeJS.Timeout>();
  
  add(channel: string, message: any, maxBatchSize = 10, maxDelayMs = 100) {
    if (!this.batches.has(channel)) {
      this.batches.set(channel, []);
    }
    
    const batch = this.batches.get(channel)!;
    batch.push(message);
    
    // Send immediately if batch is full
    if (batch.length >= maxBatchSize) {
      this.flush(channel);
      return;
    }
    
    // Set timer if not already set
    if (!this.timers.has(channel)) {
      const timer = setTimeout(() => this.flush(channel), maxDelayMs);
      this.timers.set(channel, timer);
    }
  }
  
  private flush(channel: string) {
    const batch = this.batches.get(channel);
    const timer = this.timers.get(channel);
    
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(channel);
    }
    
    if (batch && batch.length > 0) {
      wsManager.broadcast(channel, {
        type: 'batch',
        messages: batch,
        count: batch.length,
        timestamp: Date.now()
      });
      
      this.batches.set(channel, []);
    }
  }
}

const messageBatcher = new MessageBatcher();

// Usage
app.post('/api/events', async (req, res) => {
  const event = await req.json();
  
  // Add to batch instead of sending immediately
  messageBatcher.add('events', event, 5, 50); // Max 5 messages or 50ms delay
  
  return res.json({ status: 'queued' });
});
```

## Memory Optimization

### Object Pooling
Reuse objects to reduce garbage collection:

```typescript
class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  
  constructor(createFn: () => T, resetFn: (obj: T) => void, initialSize = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(createFn());
    }
  }
  
  acquire(): T {
    return this.pool.pop() || this.createFn();
  }
  
  release(obj: T) {
    this.resetFn(obj);
    this.pool.push(obj);
  }
  
  size() {
    return this.pool.length;
  }
}

// Response object pool
interface ResponseObj {
  data?: any;
  error?: string;
  timestamp?: number;
}

const responsePool = new ObjectPool<ResponseObj>(
  () => ({}),
  (obj) => {
    obj.data = undefined;
    obj.error = undefined;
    obj.timestamp = undefined;
  },
  50
);

// Usage in route handlers
app.get('/api/pooled/:id', async (req, res) => {
  const response = responsePool.acquire();
  
  try {
    response.data = await dataService.getById(req.params.id);
    response.timestamp = Date.now();
    
    const result = { ...response }; // Copy for response
    return res.json(result);
  } finally {
    responsePool.release(response);
  }
});
```

### Memory Monitoring
Track memory usage patterns:

```typescript
const memoryMiddleware = (req, res, next) => {
  const memBefore = process.memoryUsage();
  
  res.on('finish', () => {
    const memAfter = process.memoryUsage();
    const memDelta = {
      rss: memAfter.rss - memBefore.rss,
      heapUsed: memAfter.heapUsed - memBefore.heapUsed,
      heapTotal: memAfter.heapTotal - memBefore.heapTotal,
      external: memAfter.external - memBefore.external
    };
    
    // Alert on significant memory increases
    if (memDelta.heapUsed > 10 * 1024 * 1024) { // 10MB
      console.warn('High memory usage:', {
        route: `${req.method} ${req.url}`,
        delta: memDelta,
        total: memAfter
      });
    }
  });
  
  return next();
};

app.use(memoryMiddleware);

// Memory cleanup endpoint
app.post('/api/gc', (req, res) => {
  if (global.gc) {
    const before = process.memoryUsage();
    global.gc();
    const after = process.memoryUsage();
    
    return res.json({
      message: 'Garbage collection triggered',
      before,
      after,
      freed: {
        rss: before.rss - after.rss,
        heapUsed: before.heapUsed - after.heapUsed,
        heapTotal: before.heapTotal - after.heapTotal
      }
    });
  } else {
    return res.status(503).json({
      error: 'GC not exposed (run with --expose-gc)'
    });
  }
});
```

## CPU Optimization

### Async Processing
Offload CPU-intensive tasks:

```typescript
// CPU-intensive task worker
class TaskWorker {
  private queue: Array<{ task: () => Promise<any>; resolve: Function; reject: Function }> = [];
  private processing = false;
  
  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }
  
  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift()!;
      
      try {
        const result = await task();
        resolve(result);
      } catch (error) {
        reject(error);
      }
      
      // Yield control periodically
      await new Promise(resolve => setImmediate(resolve));
    }
    
    this.processing = false;
  }
}

const taskWorker = new TaskWorker();

// CPU-intensive route
app.post('/api/process-data', async (req, res) => {
  const data = await req.json();
  
  // Offload CPU-intensive processing
  const result = await taskWorker.enqueue(async () => {
    // Simulate heavy computation
    let sum = 0;
    for (let i = 0; i < data.iterations; i++) {
      sum += Math.sqrt(i);
      
      // Yield every 10000 iterations
      if (i % 10000 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    return sum;
  });
  
  return res.json({ result });
});
```

### Response Streaming
Stream large responses to reduce memory usage:

```typescript
app.get('/api/large-dataset', async (req, res) => {
  res.headers.set('Content-Type', 'application/json');
  res.headers.set('Transfer-Encoding', 'chunked');
  
  // Start streaming response
  res.write('{"data":[');
  
  let first = true;
  const batchSize = 1000;
  let offset = 0;
  
  while (true) {
    const batch = await dataService.getBatch(offset, batchSize);
    
    if (batch.length === 0) break;
    
    for (const item of batch) {
      if (!first) res.write(',');
      res.write(JSON.stringify(item));
      first = false;
    }
    
    offset += batchSize;
    
    // Yield control
    await new Promise(resolve => setImmediate(resolve));
  }
  
  res.write(']}');
  res.end();
});
```

## UDP/TCP Performance

### UDP Batching
Batch UDP messages for efficiency:

```typescript
class UDPBatcher {
  private messages: Buffer[] = [];
  private timer?: NodeJS.Timeout;
  
  add(buffer: Buffer, maxBatchSize = 10, maxDelayMs = 50) {
    this.messages.push(buffer);
    
    if (this.messages.length >= maxBatchSize) {
      this.flush();
      return;
    }
    
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), maxDelayMs);
    }
  }
  
  private flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    
    if (this.messages.length === 0) return;
    
    // Combine messages
    const combined = Buffer.concat(this.messages);
    
    // Send batched message
    app.udpSend(combined, 8081, 'localhost');
    
    this.messages = [];
  }
}

const udpBatcher = new UDPBatcher();

app.udp(8080, {
  message: (buffer, rinfo) => {
    // Add to batch instead of processing immediately
    udpBatcher.add(buffer);
  }
});
```

### TCP Connection Reuse
Reuse TCP connections efficiently:

```typescript
class TCPConnectionPool {
  private connections = new Map<string, net.Socket>();
  private maxConnections = 100;
  
  async getConnection(host: string, port: number): Promise<net.Socket> {
    const key = `${host}:${port}`;
    let socket = this.connections.get(key);
    
    if (!socket || socket.destroyed) {
      socket = new net.Socket();
      socket.connect(port, host);
      
      socket.on('close', () => {
        this.connections.delete(key);
      });
      
      this.connections.set(key, socket);
    }
    
    return socket;
  }
  
  closeAll() {
    for (const socket of this.connections.values()) {
      socket.destroy();
    }
    this.connections.clear();
  }
}

const tcpPool = new TCPConnectionPool();
```

## Monitoring and Metrics

### Performance Metrics Collection
```typescript
class PerformanceMetrics {
  private metrics = {
    requests: { total: 0, success: 0, error: 0 },
    responseTime: { sum: 0, count: 0, min: Infinity, max: 0 },
    memory: { peak: 0, current: 0 },
    connections: { websocket: 0, tcp: 0, udp: 0 }
  };
  
  recordRequest(success: boolean, responseTime: number) {
    this.metrics.requests.total++;
    if (success) this.metrics.requests.success++;
    else this.metrics.requests.error++;
    
    this.metrics.responseTime.sum += responseTime;
    this.metrics.responseTime.count++;
    this.metrics.responseTime.min = Math.min(this.metrics.responseTime.min, responseTime);
    this.metrics.responseTime.max = Math.max(this.metrics.responseTime.max, responseTime);
  }
  
  updateMemory() {
    const mem = process.memoryUsage();
    this.metrics.memory.current = mem.heapUsed;
    this.metrics.memory.peak = Math.max(this.metrics.memory.peak, mem.heapUsed);
  }
  
  getStats() {
    return {
      ...this.metrics,
      responseTime: {
        ...this.metrics.responseTime,
        average: this.metrics.responseTime.sum / this.metrics.responseTime.count || 0
      },
      successRate: this.metrics.requests.success / this.metrics.requests.total || 0
    };
  }
  
  reset() {
    this.metrics = {
      requests: { total: 0, success: 0, error: 0 },
      responseTime: { sum: 0, count: 0, min: Infinity, max: 0 },
      memory: { peak: 0, current: 0 },
      connections: { websocket: 0, tcp: 0, udp: 0 }
    };
  }
}

const metrics = new PerformanceMetrics();

// Metrics middleware
app.use((req, res, next) => {
  const start = performance.now();
  
  res.on('finish', () => {
    const duration = performance.now() - start;
    metrics.recordRequest(res.statusCode < 400, duration);
    metrics.updateMemory();
  });
  
  return next();
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  return res.json(metrics.getStats());
});

// Reset metrics endpoint
app.post('/metrics/reset', (req, res) => {
  metrics.reset();
  return res.json({ message: 'Metrics reset' });
});
```

These optimization strategies will significantly improve your Verb application's performance across all protocols and use cases.